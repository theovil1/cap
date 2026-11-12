//! Races: friends on the same route, everyone from zero, the first to arrive wins.

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde::Deserialize;
use utoipa::ToSchema;
use utoipa_axum::{router::OpenApiRouter, routes};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult, ErrorBody},
    journeys::{JourneyDetail, fetch_detail},
    state::AppState,
};

/// Up to 8 walkers per race.
const MAX_INVITES: usize = 7;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(create_race))
        .routes(routes!(join_race))
        .routes(routes!(leave_race))
        .routes(routes!(start_race))
}

#[derive(Deserialize, ToSchema)]
pub struct CreateRace {
    /// A route computed by the current user.
    route_id: Uuid,
    /// Friends to invite (1 to 7).
    friend_ids: Vec<Uuid>,
}

/// Create a race on a computed route and invite friends. It waits for its creator to start it.
#[utoipa::path(post, path = "/races", tag = "races", security(("bearer" = [])), request_body = CreateRace,
    responses((status = 201, body = JourneyDetail), (status = 400, body = ErrorBody),
        (status = 404, body = ErrorBody), (status = 422, body = ErrorBody)))]
async fn create_race(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Json(body): Json<CreateRace>,
) -> AppResult<(StatusCode, Json<JourneyDetail>)> {
    let mut friend_ids = body.friend_ids;
    friend_ids.sort_unstable();
    friend_ids.dedup();
    friend_ids.retain(|id| *id != user_id);
    if friend_ids.is_empty() || friend_ids.len() > MAX_INVITES {
        return Err(AppError::bad_request("invalid_race", "invite 1 to 7 friends"));
    }
    let journey_id = Uuid::now_v7();
    let mut tx = state.db.begin().await?;
    let inserted = sqlx::query!(
        "INSERT INTO journeys (id, route_id, kind, status, created_by)
         SELECT $1, id, 'race', 'waiting', $3 FROM routes WHERE id = $2 AND created_by = $3",
        journey_id,
        body.route_id,
        user_id,
    )
    .execute(&mut *tx)
    .await?;
    if inserted.rows_affected() == 0 {
        return Err(AppError::not_found("route not found"));
    }
    sqlx::query!(
        "INSERT INTO journey_participants (journey_id, user_id) VALUES ($1, $2)",
        journey_id,
        user_id
    )
    .execute(&mut *tx)
    .await?;
    let invited = sqlx::query!(
        "INSERT INTO journey_participants (journey_id, user_id, joined_at)
         SELECT $1, f.id, NULL FROM unnest($3::uuid[]) AS f(id)
         WHERE EXISTS (SELECT 1 FROM friendships
                       WHERE status = 'accepted'
                         AND ((user_id = $2 AND friend_id = f.id) OR (user_id = f.id AND friend_id = $2)))",
        journey_id,
        user_id,
        &friend_ids,
    )
    .execute(&mut *tx)
    .await?;
    if usize::try_from(invited.rows_affected()).ok() != Some(friend_ids.len()) {
        return Err(AppError::unprocessable("not_friends", "only friends can be invited"));
    }
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(fetch_detail(&state.db, &state.live, user_id, journey_id).await?)))
}

/// Accept an invitation to a race that has not started yet.
#[utoipa::path(post, path = "/journeys/{id}/join", tag = "races", security(("bearer" = [])),
    params(("id" = Uuid, Path)),
    responses((status = 200, body = JourneyDetail), (status = 404, body = ErrorBody)))]
async fn join_race(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<JourneyDetail>> {
    let joined = sqlx::query!(
        "UPDATE journey_participants p SET joined_at = now()
         FROM journeys j
         WHERE j.id = p.journey_id AND p.journey_id = $1 AND p.user_id = $2
           AND p.joined_at IS NULL AND j.status = 'waiting'",
        id,
        user_id
    )
    .execute(&state.db)
    .await?;
    if joined.rows_affected() == 0 {
        return Err(AppError::not_found("invitation not found"));
    }
    Ok(Json(fetch_detail(&state.db, &state.live, user_id, id).await?))
}

/// Decline an invitation or leave a race. Its creator cancels it instead.
#[utoipa::path(post, path = "/journeys/{id}/leave", tag = "races", security(("bearer" = [])),
    params(("id" = Uuid, Path)),
    responses((status = 204), (status = 404, body = ErrorBody)))]
async fn leave_race(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let mut tx = state.db.begin().await?;
    let left = sqlx::query!(
        "DELETE FROM journey_participants p USING journeys j
         WHERE j.id = p.journey_id AND p.journey_id = $1 AND p.user_id = $2
           AND j.kind = 'race' AND j.created_by <> $2",
        id,
        user_id
    )
    .execute(&mut *tx)
    .await?;
    if left.rows_affected() == 0 {
        return Err(AppError::not_found("race not found"));
    }
    finish_if_everyone_arrived(&mut tx, id).await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Start a race: invitations not accepted yet are dropped and everyone starts from zero.
#[utoipa::path(post, path = "/journeys/{id}/start", tag = "races", security(("bearer" = [])),
    params(("id" = Uuid, Path)),
    responses((status = 200, body = JourneyDetail), (status = 404, body = ErrorBody), (status = 422, body = ErrorBody)))]
async fn start_race(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<JourneyDetail>> {
    let mut tx = state.db.begin().await?;
    let started = sqlx::query!(
        "UPDATE journeys SET status = 'active', starts_at = now()
         WHERE id = $1 AND created_by = $2 AND kind = 'race' AND status = 'waiting'",
        id,
        user_id
    )
    .execute(&mut *tx)
    .await?;
    if started.rows_affected() == 0 {
        return Err(AppError::not_found("race not found"));
    }
    let players = sqlx::query_scalar!(
        "SELECT count(*) AS \"count!\" FROM journey_participants WHERE journey_id = $1 AND joined_at IS NOT NULL",
        id
    )
    .fetch_one(&mut *tx)
    .await?;
    if players < 2 {
        return Err(AppError::unprocessable("no_opponent", "wait for a friend to join"));
    }
    sqlx::query!("DELETE FROM journey_participants WHERE journey_id = $1 AND joined_at IS NULL", id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(fetch_detail(&state.db, &state.live, user_id, id).await?))
}

/// Arrival order of a walker in a race; the race ends when everyone is in.
pub async fn record_arrival(tx: &mut sqlx::PgConnection, journey_id: Uuid, user_id: Uuid) -> AppResult<()> {
    sqlx::query!(
        "UPDATE journey_participants SET rank = (
             SELECT count(*) FROM journey_participants WHERE journey_id = $1 AND arrived_at IS NOT NULL)
         WHERE journey_id = $1 AND user_id = $2",
        journey_id,
        user_id
    )
    .execute(&mut *tx)
    .await?;
    finish_if_everyone_arrived(tx, journey_id).await
}

/// A race is over once every walker still in it has arrived.
pub async fn finish_if_everyone_arrived(tx: &mut sqlx::PgConnection, journey_id: Uuid) -> AppResult<()> {
    sqlx::query!(
        "UPDATE journeys j SET status = 'finished'
         WHERE j.id = $1 AND j.kind = 'race' AND j.status = 'active'
           AND NOT EXISTS (SELECT 1 FROM journey_participants p
                           WHERE p.journey_id = j.id AND p.arrived_at IS NULL)",
        journey_id
    )
    .execute(tx)
    .await?;
    Ok(())
}
