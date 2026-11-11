//! The signed-in user's profile.

use axum::{Json, extract::State, http::StatusCode};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use time::OffsetDateTime;
use utoipa::ToSchema;
use utoipa_axum::{router::OpenApiRouter, routes};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult, ErrorBody, is_unique_violation},
    state::AppState,
};

/// Stride estimated from height when the user did not set one (specification: 0.415 x height).
const STRIDE_FROM_HEIGHT: f64 = 0.415;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(get_me, update_me, delete_me))
}

#[derive(Serialize, ToSchema)]
pub struct UserProfile {
    pub id: Uuid,
    pub email: Option<String>,
    pub first_name: String,
    pub username: String,
    pub avatar_url: Option<String>,
    pub country: String,
    pub home_city: Option<String>,
    pub height_cm: Option<i32>,
    /// Stride set by the user, or estimated from height.
    pub stride_cm: Option<i32>,
    pub daily_step_goal: i32,
    pub sessions_per_week: i32,
    pub language: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateProfile {
    first_name: Option<String>,
    username: Option<String>,
    home_city: Option<String>,
    height_cm: Option<i32>,
    stride_cm: Option<i32>,
    daily_step_goal: Option<i32>,
    sessions_per_week: Option<i32>,
    language: Option<String>,
}

pub fn validate_first_name(name: &str) -> AppResult<String> {
    let name = name.trim();
    if (1..=50).contains(&name.chars().count()) {
        Ok(name.to_owned())
    } else {
        Err(AppError::bad_request("invalid_first_name", "first name must have 1 to 50 characters"))
    }
}

/// Usernames: 3 to 20 lowercase letters, digits or underscores.
pub fn validate_username(username: &str) -> AppResult<String> {
    let username = username.trim().to_lowercase();
    let valid = (3..=20).contains(&username.len())
        && username.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_');
    if valid {
        Ok(username)
    } else {
        Err(AppError::bad_request(
            "invalid_username",
            "username must have 3 to 20 lowercase letters, digits or underscores",
        ))
    }
}

/// Username derived from a first name, e.g. `theo4821`.
pub fn generate_username(first_name: &str) -> String {
    let base: String = first_name
        .to_lowercase()
        .chars()
        .filter_map(|c| match c {
            'a'..='z' | '0'..='9' => Some(c),
            'à' | 'â' | 'ä' => Some('a'),
            'é' | 'è' | 'ê' | 'ë' => Some('e'),
            'î' | 'ï' => Some('i'),
            'ô' | 'ö' => Some('o'),
            'ù' | 'û' | 'ü' => Some('u'),
            'ç' => Some('c'),
            _ => None,
        })
        .take(14)
        .collect();
    let base = if base.len() < 3 { "walker".to_owned() } else { base };
    format!("{base}{:04}", rand::random_range(0..10_000))
}

pub async fn fetch_profile(db: &PgPool, user_id: Uuid) -> AppResult<UserProfile> {
    let row = sqlx::query!(
        "SELECT id, email, first_name, username, avatar_url, country, home_city, height_cm,
                stride_cm, daily_step_goal, sessions_per_week, language, created_at
         FROM users WHERE id = $1",
        user_id
    )
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::unauthorized("unknown_user", "this account no longer exists"))?;

    #[allow(clippy::cast_possible_truncation)]
    let estimated_stride = row.height_cm.map(|h| (f64::from(h) * STRIDE_FROM_HEIGHT).round() as i32);
    Ok(UserProfile {
        id: row.id,
        email: row.email,
        first_name: row.first_name,
        username: row.username,
        avatar_url: row.avatar_url,
        country: row.country,
        home_city: row.home_city,
        height_cm: row.height_cm,
        stride_cm: row.stride_cm.or(estimated_stride),
        daily_step_goal: row.daily_step_goal,
        sessions_per_week: row.sessions_per_week,
        language: row.language,
        created_at: row.created_at,
    })
}

/// Current user's profile.
#[utoipa::path(get, path = "/me", tag = "users", security(("bearer" = [])),
    responses((status = 200, body = UserProfile), (status = 401, body = ErrorBody)))]
async fn get_me(State(state): State<AppState>, AuthUser(user_id): AuthUser) -> AppResult<Json<UserProfile>> {
    Ok(Json(fetch_profile(&state.db, user_id).await?))
}

/// Update the current user's profile. Omitted fields are left unchanged.
#[utoipa::path(patch, path = "/me", tag = "users", security(("bearer" = [])), request_body = UpdateProfile,
    responses((status = 200, body = UserProfile), (status = 400, body = ErrorBody), (status = 409, body = ErrorBody)))]
async fn update_me(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Json(body): Json<UpdateProfile>,
) -> AppResult<Json<UserProfile>> {
    let first_name = body.first_name.as_deref().map(validate_first_name).transpose()?;
    let username = body.username.as_deref().map(validate_username).transpose()?;
    if let Some(language) = &body.language
        && !["fr", "en"].contains(&language.as_str())
    {
        return Err(AppError::bad_request("invalid_language", "language must be fr or en"));
    }
    let result = sqlx::query!(
        "UPDATE users SET
            first_name = COALESCE($2, first_name),
            username = COALESCE($3, username),
            home_city = COALESCE($4, home_city),
            height_cm = COALESCE($5, height_cm),
            stride_cm = COALESCE($6, stride_cm),
            daily_step_goal = COALESCE($7, daily_step_goal),
            sessions_per_week = COALESCE($8, sessions_per_week),
            language = COALESCE($9, language)
         WHERE id = $1",
        user_id,
        first_name,
        username,
        body.home_city,
        body.height_cm,
        body.stride_cm,
        body.daily_step_goal,
        body.sessions_per_week,
        body.language,
    )
    .execute(&state.db)
    .await;
    match result {
        Ok(_) => Ok(Json(fetch_profile(&state.db, user_id).await?)),
        Err(e) if is_unique_violation(&e, "users_username_key") => {
            Err(AppError::conflict("username_taken", "this username is already taken"))
        }
        Err(sqlx::Error::Database(db)) if db.is_check_violation() => {
            Err(AppError::bad_request("invalid_value", "a value is out of range"))
        }
        Err(e) => Err(e.into()),
    }
}

/// Delete the current account and all its data (GDPR).
#[utoipa::path(delete, path = "/me", tag = "users", security(("bearer" = [])), responses((status = 204)))]
async fn delete_me(State(state): State<AppState>, AuthUser(user_id): AuthUser) -> AppResult<StatusCode> {
    let mut tx = state.db.begin().await?;
    // Solo journeys belong to their creator only.
    sqlx::query!("DELETE FROM journeys WHERE created_by = $1 AND kind = 'solo'", user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query!("DELETE FROM users WHERE id = $1", user_id).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn usernames() {
        assert_eq!(validate_username(" Theo_42 ").unwrap(), "theo_42");
        assert!(validate_username("ab").is_err());
        assert!(validate_username("théo").is_err());
        let generated = generate_username("Théo");
        assert!(generated.starts_with("theo"));
        assert!(validate_username(&generated).is_ok());
        assert!(generate_username("李").starts_with("walker"));
    }
}
