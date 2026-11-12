//! Deleting sessions from the history. The journeys they counted for move back.

use axum::{
    extract::{Path, State},
    http::StatusCode,
};
use utoipa_axum::{router::OpenApiRouter, routes};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult, ErrorBody},
    state::AppState,
};

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(delete_session)).routes(routes!(delete_all_sessions))
}

/// Delete one session (by the app's local id); its journeys lose its distance.
#[utoipa::path(delete, path = "/sessions/{local_id}", tag = "sessions", security(("bearer" = [])),
    params(("local_id" = Uuid, Path)),
    responses((status = 204), (status = 404, body = ErrorBody)))]
async fn delete_session(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(local_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    if remove(&state, user_id, Some(&[local_id])).await? == 0 {
        return Err(AppError::not_found("session not found"));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Delete the whole history; every journey goes back to the start.
#[utoipa::path(delete, path = "/sessions", tag = "sessions", security(("bearer" = [])),
    responses((status = 204)))]
async fn delete_all_sessions(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
) -> AppResult<StatusCode> {
    remove(&state, user_id, None).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Deletes sessions (all when `local_ids` is `None`) and recomputes the
/// progress they gave: distance, arrival, unlocked stages, finished journeys.
async fn remove(state: &AppState, user_id: Uuid, local_ids: Option<&[Uuid]>) -> AppResult<u64> {
    let mut tx = state.db.begin().await?;
    let journeys = sqlx::query_scalar!(
        "SELECT DISTINCT a.journey_id FROM session_allocations a JOIN sessions s ON s.id = a.session_id
         WHERE s.user_id = $1 AND ($2::uuid[] IS NULL OR s.local_id = ANY($2))",
        user_id,
        local_ids
    )
    .fetch_all(&mut *tx)
    .await?;
    let deleted = sqlx::query!(
        "DELETE FROM sessions WHERE user_id = $1 AND ($2::uuid[] IS NULL OR local_id = ANY($2))",
        user_id,
        local_ids
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();

    // Allocations went with the sessions: what is left is the true distance.
    sqlx::query!(
        "UPDATE journey_participants p
         SET distance_m = LEAST(r.distance_m, COALESCE((
             SELECT sum(a.distance_m) FROM session_allocations a JOIN sessions s ON s.id = a.session_id
             WHERE a.journey_id = p.journey_id AND s.user_id = p.user_id), 0))
         FROM journeys j JOIN routes r ON r.id = j.route_id
         WHERE j.id = p.journey_id AND p.user_id = $1 AND p.journey_id = ANY($2)",
        user_id,
        &journeys
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "UPDATE journey_participants p SET arrived_at = NULL, rank = NULL
         FROM journeys j JOIN routes r ON r.id = j.route_id
         WHERE j.id = p.journey_id AND p.user_id = $1 AND p.journey_id = ANY($2) AND p.distance_m < r.distance_m",
        user_id,
        &journeys
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "DELETE FROM stage_unlocks u USING route_stages s, journey_participants p
         WHERE u.stage_id = s.id AND u.user_id = $1 AND u.journey_id = ANY($2)
           AND p.journey_id = u.journey_id AND p.user_id = u.user_id AND s.at_m > p.distance_m",
        user_id,
        &journeys
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "UPDATE journeys j SET status = 'active'
         WHERE j.id = ANY($1) AND j.status = 'finished'
           AND EXISTS (SELECT 1 FROM journey_participants p WHERE p.journey_id = j.id AND p.arrived_at IS NULL)",
        &journeys
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(deleted)
}
