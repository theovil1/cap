//! Accounts: email and password, Sign in with Apple, access and refresh tokens.

pub mod apple;
pub mod password;
pub mod tokens;

use axum::{Json, extract::FromRequestParts, extract::State, http::StatusCode, http::request::Parts};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use utoipa::ToSchema;
use utoipa_axum::{router::OpenApiRouter, routes};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult, ErrorBody, is_unique_violation},
    state::AppState,
    users::{self, UserProfile},
};

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(register))
        .routes(routes!(login))
        .routes(routes!(sign_in_with_apple))
        .routes(routes!(refresh))
        .routes(routes!(logout))
}

/// Authenticated user, extracted from the `Authorization: Bearer` header.
pub struct AuthUser(pub Uuid);

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    #[allow(clippy::unused_async_trait_impl)] // signature imposed by the axum trait
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> AppResult<Self> {
        let token = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.strip_prefix("Bearer "))
            .ok_or_else(|| AppError::unauthorized("missing_token", "missing bearer token"))?;
        tokens::verify_access(&state.config.jwt_secret, token)
            .map(AuthUser)
            .ok_or_else(|| AppError::unauthorized("invalid_token", "invalid or expired token"))
    }
}

#[derive(Deserialize, ToSchema)]
pub struct RegisterRequest {
    #[schema(example = "theo@example.com")]
    email: String,
    password: String,
    first_name: String,
    #[schema(example = "theo")]
    username: String,
}

#[derive(Deserialize, ToSchema)]
pub struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Deserialize, ToSchema)]
pub struct AppleRequest {
    /// Identity token returned by Sign in with Apple on the device.
    identity_token: String,
    /// Only sent by Apple on the very first sign-in.
    first_name: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct RefreshRequest {
    refresh_token: String,
}

#[derive(Serialize, ToSchema)]
pub struct AuthResponse {
    access_token: String,
    refresh_token: String,
    /// Access token lifetime in seconds.
    expires_in: i64,
    user: UserProfile,
}

fn normalize_email(email: &str) -> AppResult<String> {
    let email = email.trim().to_lowercase();
    let valid = email.len() <= 254
        && email.split_once('@').is_some_and(|(local, domain)| {
            !local.is_empty() && domain.contains('.') && !domain.starts_with('.')
        });
    if valid { Ok(email) } else { Err(AppError::bad_request("invalid_email", "invalid email")) }
}

/// Create an account with email and password.
#[utoipa::path(post, path = "/auth/register", tag = "auth", request_body = RegisterRequest,
    responses((status = 201, body = AuthResponse), (status = 400, body = ErrorBody), (status = 409, body = ErrorBody)))]
async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterRequest>,
) -> AppResult<(StatusCode, Json<AuthResponse>)> {
    let email = normalize_email(&body.email)?;
    if body.password.chars().count() < password::MIN_LENGTH {
        return Err(AppError::bad_request("weak_password", "password must have at least 10 characters"));
    }
    let first_name = users::validate_first_name(&body.first_name)?;
    let username = users::validate_username(&body.username)?;
    let hash = password::hash(&body.password)?;

    let id = Uuid::now_v7();
    let result = sqlx::query!(
        "INSERT INTO users (id, email, password_hash, first_name, username) VALUES ($1, $2, $3, $4, $5)",
        id,
        email,
        hash,
        first_name,
        username,
    )
    .execute(&state.db)
    .await;
    match result {
        Ok(_) => {}
        Err(e) if is_unique_violation(&e, "users_email_key") => {
            return Err(AppError::conflict("email_taken", "this email is already registered"));
        }
        Err(e) if is_unique_violation(&e, "users_username_key") => {
            return Err(AppError::conflict("username_taken", "this username is already taken"));
        }
        Err(e) => return Err(e.into()),
    }
    Ok((StatusCode::CREATED, Json(issue_tokens(&state, id).await?)))
}

/// Sign in with email and password.
#[utoipa::path(post, path = "/auth/login", tag = "auth", request_body = LoginRequest,
    responses((status = 200, body = AuthResponse), (status = 401, body = ErrorBody)))]
async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> AppResult<Json<AuthResponse>> {
    let invalid = || AppError::unauthorized("invalid_credentials", "invalid email or password");
    let email = normalize_email(&body.email).map_err(|_| invalid())?;
    let row = sqlx::query!("SELECT id, password_hash FROM users WHERE email = $1", email)
        .fetch_optional(&state.db)
        .await?;
    let Some(row) = row else {
        // Hash anyway so that unknown emails take as long as wrong passwords.
        let _ = password::hash(&body.password);
        return Err(invalid());
    };
    let hash = row.password_hash.ok_or_else(invalid)?;
    if !password::verify(&body.password, &hash) {
        return Err(invalid());
    }
    Ok(Json(issue_tokens(&state, row.id).await?))
}

/// Sign in (or sign up) with an Apple identity token.
#[utoipa::path(post, path = "/auth/apple", tag = "auth", request_body = AppleRequest,
    responses((status = 200, body = AuthResponse), (status = 401, body = ErrorBody)))]
async fn sign_in_with_apple(
    State(state): State<AppState>,
    Json(body): Json<AppleRequest>,
) -> AppResult<Json<AuthResponse>> {
    let claims = state
        .apple_keys
        .verify(&state.http, &body.identity_token, &state.config.apple_bundle_id)
        .await
        .map_err(|e| {
            tracing::info!(error = %e, "rejected Apple identity token");
            AppError::unauthorized("invalid_apple_token", "invalid Apple identity token")
        })?;

    let existing = sqlx::query_scalar!("SELECT id FROM users WHERE apple_sub = $1", claims.sub)
        .fetch_optional(&state.db)
        .await?;
    let id = match existing {
        Some(id) => id,
        None => create_apple_user(&state, &claims, body.first_name.as_deref()).await?,
    };
    Ok(Json(issue_tokens(&state, id).await?))
}

async fn create_apple_user(
    state: &AppState,
    claims: &apple::AppleClaims,
    first_name: Option<&str>,
) -> AppResult<Uuid> {
    let first_name = first_name
        .and_then(|name| users::validate_first_name(name).ok())
        .unwrap_or_else(|| "Walker".to_owned());
    let mut email = claims.email.as_deref().and_then(|e| normalize_email(e).ok());
    for _ in 0..5 {
        let id = Uuid::now_v7();
        let username = users::generate_username(&first_name);
        let result = sqlx::query!(
            "INSERT INTO users (id, email, apple_sub, first_name, username) VALUES ($1, $2, $3, $4, $5)",
            id,
            email,
            claims.sub,
            first_name,
            username,
        )
        .execute(&state.db)
        .await;
        match result {
            Ok(_) => return Ok(id),
            // Never merge accounts implicitly: keep the Apple account without email.
            Err(e) if is_unique_violation(&e, "users_email_key") => email = None,
            Err(e) if is_unique_violation(&e, "users_username_key") => {}
            Err(e) => return Err(e.into()),
        }
    }
    Err(AppError::internal("could not generate a unique username"))
}

/// Exchange a refresh token for a new token pair (the old one is revoked).
#[utoipa::path(post, path = "/auth/refresh", tag = "auth", request_body = RefreshRequest,
    responses((status = 200, body = AuthResponse), (status = 401, body = ErrorBody)))]
async fn refresh(
    State(state): State<AppState>,
    Json(body): Json<RefreshRequest>,
) -> AppResult<Json<AuthResponse>> {
    let invalid = || AppError::unauthorized("invalid_refresh_token", "invalid or expired refresh token");
    let hash = tokens::hash_refresh(&body.refresh_token);
    let row = sqlx::query!(
        "SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1",
        hash
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(invalid)?;

    if row.revoked_at.is_some() {
        // A revoked token was reused: it may have leaked, so log the user out everywhere.
        sqlx::query!(
            "UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
            row.user_id
        )
        .execute(&state.db)
        .await?;
        return Err(invalid());
    }
    if row.expires_at < OffsetDateTime::now_utc() {
        return Err(invalid());
    }
    let revoked = sqlx::query!(
        "UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL",
        row.id
    )
    .execute(&state.db)
    .await?;
    if revoked.rows_affected() == 0 {
        return Err(invalid());
    }
    Ok(Json(issue_tokens(&state, row.user_id).await?))
}

/// Revoke a refresh token.
#[utoipa::path(post, path = "/auth/logout", tag = "auth", request_body = RefreshRequest,
    responses((status = 204)))]
async fn logout(State(state): State<AppState>, Json(body): Json<RefreshRequest>) -> AppResult<StatusCode> {
    sqlx::query!(
        "UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
        tokens::hash_refresh(&body.refresh_token)
    )
    .execute(&state.db)
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn issue_tokens(state: &AppState, user_id: Uuid) -> AppResult<AuthResponse> {
    let refresh_token = tokens::new_refresh();
    sqlx::query!(
        "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
        Uuid::now_v7(),
        user_id,
        tokens::hash_refresh(&refresh_token),
        OffsetDateTime::now_utc() + tokens::REFRESH_TTL,
    )
    .execute(&state.db)
    .await?;
    Ok(AuthResponse {
        access_token: tokens::issue_access(&state.config.jwt_secret, user_id)?,
        refresh_token,
        expires_in: tokens::ACCESS_TTL.whole_seconds(),
        user: users::fetch_profile(&state.db, user_id).await?,
    })
}
