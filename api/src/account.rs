//! Profile photo and data export (GDPR) of the current user.

use axum::{
    Json,
    body::Bytes,
    extract::{Path, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde_json::{Value, json};
use time::OffsetDateTime;
use utoipa_axum::{router::OpenApiRouter, routes};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult, ErrorBody},
    state::AppState,
    users::{UserProfile, fetch_profile},
};

/// The app sends a 512 px JPEG, a few tens of kilobytes.
const MAX_AVATAR_BYTES: usize = 512 * 1024;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(set_avatar, delete_avatar)).routes(routes!(export))
}

/// Set the profile photo: the raw JPEG or PNG image as the request body.
#[utoipa::path(put, path = "/me/avatar", tag = "users", security(("bearer" = [])),
    request_body(content = Vec<u8>, content_type = "image/jpeg"),
    responses((status = 200, body = UserProfile), (status = 400, body = ErrorBody), (status = 413, body = ErrorBody)))]
async fn set_avatar(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    headers: HeaderMap,
    body: Bytes,
) -> AppResult<Json<UserProfile>> {
    let content_type = check_image(&headers, &body, MAX_AVATAR_BYTES)?;
    let mut tx = state.db.begin().await?;
    sqlx::query!(
        "INSERT INTO user_avatars (user_id, content_type, image) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET content_type = $2, image = $3, updated_at = now()",
        user_id,
        content_type,
        body.as_ref()
    )
    .execute(&mut *tx)
    .await?;
    // The version in the URL makes caches pick up a new photo.
    let url = format!("/avatars/{user_id}?v={}", OffsetDateTime::now_utc().unix_timestamp());
    sqlx::query!("UPDATE users SET avatar_url = $2 WHERE id = $1", user_id, url).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(fetch_profile(&state.db, user_id).await?))
}

/// The content type of a JPEG or PNG body no bigger than `max_bytes`, or the error to send.
pub(crate) fn check_image(headers: &HeaderMap, body: &Bytes, max_bytes: usize) -> AppResult<&'static str> {
    let content_type = headers.get(header::CONTENT_TYPE).and_then(|v| v.to_str().ok()).unwrap_or_default();
    let content_type = match content_type {
        "image/jpeg" if body.starts_with(&[0xFF, 0xD8, 0xFF]) => "image/jpeg",
        "image/png" if body.starts_with(&[0x89, b'P', b'N', b'G']) => "image/png",
        _ => return Err(AppError::bad_request("invalid_image", "send a JPEG or PNG image")),
    };
    if body.len() > max_bytes {
        return Err(AppError::new(
            StatusCode::PAYLOAD_TOO_LARGE,
            "image_too_large",
            format!("the image is above {} KB", max_bytes / 1024),
        ));
    }
    Ok(content_type)
}

/// Remove the profile photo.
#[utoipa::path(delete, path = "/me/avatar", tag = "users", security(("bearer" = [])),
    responses((status = 200, body = UserProfile)))]
async fn delete_avatar(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
) -> AppResult<Json<UserProfile>> {
    let mut tx = state.db.begin().await?;
    sqlx::query!("DELETE FROM user_avatars WHERE user_id = $1", user_id).execute(&mut *tx).await?;
    sqlx::query!("UPDATE users SET avatar_url = NULL WHERE id = $1", user_id).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(fetch_profile(&state.db, user_id).await?))
}

/// `GET /avatars/{user_id}`: a profile photo, cached for a day (its URL changes with it).
pub async fn get_avatar(State(state): State<AppState>, Path(user_id): Path<Uuid>) -> AppResult<Response> {
    let avatar = sqlx::query!("SELECT content_type, image FROM user_avatars WHERE user_id = $1", user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::not_found("no photo"))?;
    Ok((
        [
            (header::CONTENT_TYPE, avatar.content_type),
            (header::CACHE_CONTROL, "public, max-age=86400".to_owned()),
        ],
        avatar.image,
    )
        .into_response())
}

/// Everything Cap keeps about the current user, as JSON (GDPR).
#[utoipa::path(get, path = "/me/export", tag = "users", security(("bearer" = [])),
    responses((status = 200, body = Object)))]
async fn export(State(state): State<AppState>, AuthUser(user_id): AuthUser) -> AppResult<Json<Value>> {
    let profile = fetch_profile(&state.db, user_id).await?;
    let sessions = sqlx::query_scalar!(
        "SELECT COALESCE(json_agg(s ORDER BY s.started_at), '[]') AS \"rows!\" FROM (
             SELECT local_id, started_at, ended_at, distance_m, duration_s, steps,
                    avg_speed_kmh, avg_incline_pct, source
             FROM sessions WHERE user_id = $1) s",
        user_id
    )
    .fetch_one(&state.db)
    .await?;
    let journeys = sqlx::query_scalar!(
        "SELECT COALESCE(json_agg(x ORDER BY x.created_at), '[]') AS \"rows!\" FROM (
             SELECT j.kind, j.status, j.created_at, j.starts_at, r.start_label, r.end_label,
                    r.distance_m AS route_distance_m, p.distance_m, p.arrived_at, p.rank
             FROM journey_participants p
             JOIN journeys j ON j.id = p.journey_id JOIN routes r ON r.id = j.route_id
             WHERE p.user_id = $1) x",
        user_id
    )
    .fetch_one(&state.db)
    .await?;
    let friends = sqlx::query_scalar!(
        "SELECT COALESCE(json_agg(x ORDER BY x.username), '[]') AS \"rows!\" FROM (
             SELECT u.username, f.status, f.created_at, f.accepted_at
             FROM friendships f
             JOIN users u ON u.id = CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END
             WHERE f.user_id = $1 OR f.friend_id = $1) x",
        user_id
    )
    .fetch_one(&state.db)
    .await?;
    Ok(Json(json!({
        "exported_at": OffsetDateTime::now_utc().unix_timestamp(),
        "profile": profile,
        "sessions": sessions,
        "journeys": journeys,
        "friends": friends,
    })))
}
