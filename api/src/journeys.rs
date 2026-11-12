//! Routes (computed once, previewed) and journeys (a solo trip or a race on a route).

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use time::OffsetDateTime;
use utoipa::ToSchema;
use utoipa_axum::{router::OpenApiRouter, routes};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult, ErrorBody},
    geo::{self, Place},
    live::{LiveHub, LivePosition},
    stages::{self, Stage},
    state::AppState,
};

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(create_route))
        .routes(routes!(start_solo_journey, list_journeys))
        .routes(routes!(get_journey, delete_journey))
        .routes(routes!(reset_journey))
}

#[derive(Deserialize, ToSchema)]
pub struct CreateRoute {
    start: Place,
    end: Place,
}

#[derive(Serialize, ToSchema)]
pub struct RouteDetail {
    id: Uuid,
    start: Place,
    end: Place,
    distance_m: f64,
    /// Route geometry: `[lon, lat, cumulative_m]` points.
    #[schema(value_type = Vec<[f64; 3]>)]
    path: serde_json::Value,
    /// Towns along the route, from the start (position 0) to the destination.
    stages: Vec<Stage>,
}

#[derive(Deserialize, ToSchema)]
pub struct StartJourney {
    route_id: Uuid,
}

#[derive(Serialize, ToSchema)]
pub struct JourneySummary {
    id: Uuid,
    /// `solo` or `race`.
    kind: String,
    /// `waiting` (a race not started yet), `active` or `finished`.
    status: String,
    /// The current user has joined (false: invited to a race).
    joined: bool,
    /// The current user created it.
    mine: bool,
    /// Walkers in (1 for a solo journey).
    players: i64,
    #[serde(with = "time::serde::rfc3339::option")]
    starts_at: Option<OffsetDateTime>,
    /// Arrival order of the current user in a race.
    rank: Option<i32>,
    route_id: Uuid,
    start: Place,
    end: Place,
    route_distance_m: f64,
    /// Town of the start and of the destination, e.g. `Romorantin-Lanthenay`.
    start_town: Option<String>,
    end_town: Option<String>,
    /// Distance walked by the current user on this journey.
    distance_m: f64,
    /// Sessions of the current user that counted for this journey.
    sessions: i64,
    /// The public route it was started from, or published as.
    public_route_id: Option<Uuid>,
    /// Title of a scheduled journey.
    title: Option<String>,
    /// End of a scheduled journey.
    #[serde(with = "time::serde::rfc3339::option")]
    ends_at: Option<OffsetDateTime>,
    #[serde(with = "time::serde::rfc3339::option")]
    arrived_at: Option<OffsetDateTime>,
    #[serde(with = "time::serde::rfc3339")]
    created_at: OffsetDateTime,
}

#[derive(Serialize, ToSchema)]
pub struct JourneyStage {
    #[serde(flatten)]
    stage: Stage,
    #[serde(with = "time::serde::rfc3339::option")]
    unlocked_at: Option<OffsetDateTime>,
}

#[derive(Serialize, ToSchema)]
pub struct JourneyDetail {
    #[serde(flatten)]
    summary: JourneySummary,
    /// Route geometry: `[lon, lat, cumulative_m]` points.
    #[schema(value_type = Vec<[f64; 3]>)]
    path: serde_json::Value,
    stages: Vec<JourneyStage>,
    /// Everyone on the journey, the leader first.
    participants: Vec<Participant>,
}

#[derive(Serialize, ToSchema)]
pub struct Participant {
    user_id: Uuid,
    first_name: String,
    username: String,
    me: bool,
    /// False while invited to a race.
    joined: bool,
    /// Distance counted from synced sessions.
    distance_m: f64,
    #[serde(with = "time::serde::rfc3339::option")]
    arrived_at: Option<OffsetDateTime>,
    rank: Option<i32>,
    /// End of their last session, for `2 hours ago`.
    #[serde(with = "time::serde::rfc3339::option")]
    last_session_at: Option<OffsetDateTime>,
    /// Set while they walk right now: distance including the session under way.
    live: Option<LivePosition>,
}

/// Compute a safe walking route and its stages, for a preview. Nothing starts yet.
#[utoipa::path(post, path = "/routes", tag = "journeys", security(("bearer" = [])), request_body = CreateRoute,
    responses((status = 201, body = RouteDetail), (status = 422, body = ErrorBody), (status = 502, body = ErrorBody)))]
async fn create_route(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Json(body): Json<CreateRoute>,
) -> AppResult<(StatusCode, Json<RouteDetail>)> {
    for place in [&body.start, &body.end] {
        let valid = (-90.0..=90.0).contains(&place.lat) && (-180.0..=180.0).contains(&place.lon);
        if !valid || place.label.trim().is_empty() || place.label.len() > 300 {
            return Err(AppError::bad_request("invalid_place", "invalid start or destination"));
        }
    }
    let route = geo::walking_route(&state, &body.start, &body.end).await?;
    let stages = stages::find_stages(&state, &route.path).await?;
    let path = serde_json::to_value(&route.path).map_err(AppError::internal)?;

    let route_id = Uuid::now_v7();
    let mut tx = state.db.begin().await?;
    sqlx::query!(
        "INSERT INTO routes (id, start_label, start_lat, start_lon, end_label, end_lat, end_lon,
                             distance_m, path, engine_version, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        route_id,
        body.start.label.trim(),
        body.start.lat,
        body.start.lon,
        body.end.label.trim(),
        body.end.lat,
        body.end.lon,
        route.distance_m,
        path,
        route.engine_version,
        user_id,
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "INSERT INTO route_stages (id, route_id, position, name, county, lat, lon, at_m)
         SELECT id, $1, position, name, county, lat, lon, at_m
         FROM UNNEST($2::uuid[], $3::int[], $4::text[], $5::text[], $6::float8[], $7::float8[], $8::float8[])
              AS s (id, position, name, county, lat, lon, at_m)",
        route_id,
        &stages.iter().map(|s| s.id).collect::<Vec<_>>(),
        &stages.iter().map(|s| s.position).collect::<Vec<_>>(),
        &stages.iter().map(|s| s.name.clone()).collect::<Vec<_>>(),
        &stages.iter().map(|s| s.county.clone()).collect::<Vec<_>>() as &[Option<String>],
        &stages.iter().map(|s| s.lat).collect::<Vec<_>>(),
        &stages.iter().map(|s| s.lon).collect::<Vec<_>>(),
        &stages.iter().map(|s| s.at_m).collect::<Vec<_>>(),
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    let start = Place { label: body.start.label.trim().to_owned(), ..body.start };
    let end = Place { label: body.end.label.trim().to_owned(), ..body.end };
    Ok((
        StatusCode::CREATED,
        Json(RouteDetail { id: route_id, start, end, distance_m: route.distance_m, path, stages }),
    ))
}

/// Start a solo journey on a route computed by the current user.
#[utoipa::path(post, path = "/journeys", tag = "journeys", security(("bearer" = [])), request_body = StartJourney,
    responses((status = 201, body = JourneyDetail), (status = 404, body = ErrorBody)))]
async fn start_solo_journey(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Json(body): Json<StartJourney>,
) -> AppResult<(StatusCode, Json<JourneyDetail>)> {
    let journey_id = Uuid::now_v7();
    let mut tx = state.db.begin().await?;
    let inserted = sqlx::query!(
        "INSERT INTO journeys (id, route_id, kind, status, starts_at, created_by)
         SELECT $1, id, 'solo', 'active', now(), $3 FROM routes WHERE id = $2 AND created_by = $3",
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
    tx.commit().await?;

    let detail = fetch_detail(&state.db, &state.live, user_id, journey_id).await?;
    Ok((StatusCode::CREATED, Json(detail)))
}

/// Journeys of the current user, most recent first.
#[utoipa::path(get, path = "/journeys", tag = "journeys", security(("bearer" = [])),
    responses((status = 200, body = Vec<JourneySummary>)))]
async fn list_journeys(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
) -> AppResult<Json<Vec<JourneySummary>>> {
    let rows = sqlx::query!(
        "SELECT j.id, j.kind, j.status, j.created_at, j.public_route_id, j.title, j.ends_at, r.id AS route_id,
                r.start_label, r.start_lat, r.start_lon, r.end_label, r.end_lat, r.end_lon,
                r.distance_m AS route_distance_m, p.distance_m, p.arrived_at,
                (p.joined_at IS NOT NULL) AS \"joined!\", (j.created_by = $1) AS \"mine!\", j.starts_at, p.rank,
                (SELECT count(*) FROM journey_participants o
                 WHERE o.journey_id = j.id AND o.joined_at IS NOT NULL) AS \"players!\",
                (SELECT name FROM route_stages WHERE route_id = r.id ORDER BY position LIMIT 1) AS start_town,
                (SELECT name FROM route_stages WHERE route_id = r.id ORDER BY position DESC LIMIT 1) AS end_town,
                (SELECT count(*) FROM session_allocations a JOIN sessions s ON s.id = a.session_id
                 WHERE a.journey_id = j.id AND s.user_id = $1 AND a.distance_m > 0) AS \"sessions!\"
         FROM journey_participants p
         JOIN journeys j ON j.id = p.journey_id
         JOIN routes r ON r.id = j.route_id
         WHERE p.user_id = $1
         ORDER BY j.created_at DESC",
        user_id
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(
        rows.into_iter()
            .map(|r| JourneySummary {
                sessions: r.sessions,
                public_route_id: r.public_route_id,
                title: r.title,
                ends_at: r.ends_at,
                id: r.id,
                kind: r.kind,
                status: r.status,
                joined: r.joined,
                mine: r.mine,
                players: r.players,
                starts_at: r.starts_at,
                rank: r.rank,
                route_id: r.route_id,
                start: Place { label: r.start_label, lat: r.start_lat, lon: r.start_lon },
                end: Place { label: r.end_label, lat: r.end_lat, lon: r.end_lon },
                route_distance_m: r.route_distance_m,
                start_town: r.start_town.filter(|t| !t.is_empty()),
                end_town: r.end_town.filter(|t| !t.is_empty()),
                distance_m: r.distance_m,
                arrived_at: r.arrived_at,
                created_at: r.created_at,
            })
            .collect(),
    ))
}

/// One journey with its route geometry and stages.
#[utoipa::path(get, path = "/journeys/{id}", tag = "journeys", security(("bearer" = [])),
    params(("id" = Uuid, Path)),
    responses((status = 200, body = JourneyDetail), (status = 404, body = ErrorBody)))]
async fn get_journey(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<JourneyDetail>> {
    Ok(Json(fetch_detail(&state.db, &state.live, user_id, id).await?))
}

/// Delete a solo journey, or cancel a race not started yet. Sessions stay in the history.
#[utoipa::path(delete, path = "/journeys/{id}", tag = "journeys", security(("bearer" = [])),
    params(("id" = Uuid, Path)),
    responses((status = 204), (status = 404, body = ErrorBody)))]
async fn delete_journey(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    // Allocations, unlocks and participants go with it (ON DELETE CASCADE).
    let deleted = sqlx::query!(
        "DELETE FROM journeys WHERE id = $1 AND created_by = $2 AND (kind = 'solo' OR status = 'waiting')",
        id,
        user_id
    )
    .execute(&state.db)
    .await?;
    if deleted.rows_affected() == 0 {
        return Err(AppError::not_found("journey not found"));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Start a solo journey again from the beginning. The walked sessions stay
/// in the history but no longer count for this journey.
#[utoipa::path(post, path = "/journeys/{id}/reset", tag = "journeys", security(("bearer" = [])),
    params(("id" = Uuid, Path)),
    responses((status = 200, body = JourneyDetail), (status = 404, body = ErrorBody)))]
async fn reset_journey(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<JourneyDetail>> {
    let mut tx = state.db.begin().await?;
    let reset = sqlx::query!(
        "UPDATE journeys SET status = 'active', starts_at = now()
         WHERE id = $1 AND created_by = $2 AND kind = 'solo'",
        id,
        user_id
    )
    .execute(&mut *tx)
    .await?;
    if reset.rows_affected() == 0 {
        return Err(AppError::not_found("journey not found"));
    }
    sqlx::query!("DELETE FROM session_allocations WHERE journey_id = $1", id).execute(&mut *tx).await?;
    sqlx::query!("DELETE FROM stage_unlocks WHERE journey_id = $1", id).execute(&mut *tx).await?;
    sqlx::query!(
        "UPDATE journey_participants SET distance_m = 0, arrived_at = NULL, rank = NULL
         WHERE journey_id = $1",
        id
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(fetch_detail(&state.db, &state.live, user_id, id).await?))
}

pub(crate) async fn fetch_detail(
    db: &PgPool,
    live: &LiveHub,
    user_id: Uuid,
    journey_id: Uuid,
) -> AppResult<JourneyDetail> {
    let r = sqlx::query!(
        "SELECT j.id, j.kind, j.status, j.created_at, j.public_route_id, j.title, j.ends_at, r.id AS route_id,
                r.start_label, r.start_lat, r.start_lon, r.end_label, r.end_lat, r.end_lon,
                r.distance_m AS route_distance_m, r.path, p.distance_m, p.arrived_at,
                (p.joined_at IS NOT NULL) AS \"joined!\", (j.created_by = $1) AS \"mine!\", j.starts_at, p.rank,
                (SELECT count(*) FROM journey_participants o
                 WHERE o.journey_id = j.id AND o.joined_at IS NOT NULL) AS \"players!\",
                (SELECT name FROM route_stages WHERE route_id = r.id ORDER BY position LIMIT 1) AS start_town,
                (SELECT name FROM route_stages WHERE route_id = r.id ORDER BY position DESC LIMIT 1) AS end_town,
                (SELECT count(*) FROM session_allocations a JOIN sessions s ON s.id = a.session_id
                 WHERE a.journey_id = j.id AND s.user_id = $1 AND a.distance_m > 0) AS \"sessions!\"
         FROM journey_participants p
         JOIN journeys j ON j.id = p.journey_id
         JOIN routes r ON r.id = j.route_id
         WHERE p.user_id = $1 AND j.id = $2",
        user_id,
        journey_id
    )
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::not_found("journey not found"))?;
    let stages = sqlx::query!(
        "SELECT s.id, s.position, s.name, s.county, s.lat, s.lon, s.at_m, u.unlocked_at AS \"unlocked_at?\"
         FROM route_stages s
         LEFT JOIN stage_unlocks u ON u.stage_id = s.id AND u.journey_id = $2 AND u.user_id = $3
         WHERE s.route_id = $1
         ORDER BY s.position",
        r.route_id,
        journey_id,
        user_id
    )
    .fetch_all(db)
    .await?
    .into_iter()
    .map(|s| JourneyStage {
        stage: Stage {
            id: s.id,
            position: s.position,
            name: s.name,
            county: s.county,
            lat: s.lat,
            lon: s.lon,
            at_m: s.at_m,
        },
        unlocked_at: s.unlocked_at,
    })
    .collect();
    let participants = participants(db, live, user_id, journey_id, r.starts_at, r.route_distance_m).await?;
    Ok(JourneyDetail {
        participants,
        summary: JourneySummary {
            sessions: r.sessions,
            public_route_id: r.public_route_id,
            title: r.title,
            ends_at: r.ends_at,
            id: r.id,
            kind: r.kind,
            status: r.status,
            joined: r.joined,
            mine: r.mine,
            players: r.players,
            starts_at: r.starts_at,
            rank: r.rank,
            route_id: r.route_id,
            start: Place { label: r.start_label, lat: r.start_lat, lon: r.start_lon },
            end: Place { label: r.end_label, lat: r.end_lat, lon: r.end_lon },
            route_distance_m: r.route_distance_m,
            start_town: r.start_town.filter(|t| !t.is_empty()),
            end_town: r.end_town.filter(|t| !t.is_empty()),
            distance_m: r.distance_m,
            arrived_at: r.arrived_at,
            created_at: r.created_at,
        },
        path: r.path,
        stages,
    })
}

async fn participants(
    db: &PgPool,
    live: &LiveHub,
    user_id: Uuid,
    journey_id: Uuid,
    starts_at: Option<OffsetDateTime>,
    route_distance_m: f64,
) -> AppResult<Vec<Participant>> {
    let rows = sqlx::query!(
        "SELECT u.id, u.first_name, u.username, p.distance_m, p.arrived_at, p.rank,
                (p.joined_at IS NOT NULL) AS \"joined!\",
                (SELECT max(s.ended_at) FROM sessions s WHERE s.user_id = u.id) AS last_session_at
         FROM journey_participants p JOIN users u ON u.id = p.user_id
         WHERE p.journey_id = $1
         ORDER BY p.rank NULLS LAST, p.distance_m DESC, lower(u.first_name)",
        journey_id
    )
    .fetch_all(db)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| Participant {
            live: live
                .race_position(r.id, starts_at, r.distance_m, route_distance_m)
                .filter(|_| r.arrived_at.is_none()),
            user_id: r.id,
            first_name: r.first_name,
            username: r.username,
            me: r.id == user_id,
            joined: r.joined,
            distance_m: r.distance_m,
            arrived_at: r.arrived_at,
            rank: r.rank,
            last_session_at: r.last_session_at,
        })
        .collect())
}
