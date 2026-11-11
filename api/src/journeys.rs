//! Routes (computed once) and journeys (a solo trip or a race on a route).

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use utoipa::ToSchema;
use utoipa_axum::{router::OpenApiRouter, routes};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult, ErrorBody},
    geo::{self, Place},
    state::AppState,
};

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(create_solo_journey, list_journeys)).routes(routes!(get_journey))
}

#[derive(Deserialize, ToSchema)]
pub struct CreateJourney {
    start: Place,
    end: Place,
}

#[derive(Serialize, ToSchema)]
pub struct JourneySummary {
    id: Uuid,
    /// `solo` or `race`.
    kind: String,
    /// `invited`, `waiting`, `active` or `finished`.
    status: String,
    route_id: Uuid,
    start: Place,
    end: Place,
    route_distance_m: f64,
    /// Distance walked by the current user on this journey.
    distance_m: f64,
    #[serde(with = "time::serde::rfc3339::option")]
    arrived_at: Option<OffsetDateTime>,
    #[serde(with = "time::serde::rfc3339")]
    created_at: OffsetDateTime,
}

#[derive(Serialize, ToSchema)]
pub struct JourneyDetail {
    #[serde(flatten)]
    summary: JourneySummary,
    /// Route geometry: `[lon, lat, cumulative_m]` points.
    #[schema(value_type = Vec<[f64; 3]>)]
    path: serde_json::Value,
}

/// Compute a safe walking route and start a solo journey on it.
#[utoipa::path(post, path = "/journeys", tag = "journeys", security(("bearer" = [])), request_body = CreateJourney,
    responses((status = 201, body = JourneyDetail), (status = 422, body = ErrorBody), (status = 502, body = ErrorBody)))]
async fn create_solo_journey(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Json(body): Json<CreateJourney>,
) -> AppResult<(StatusCode, Json<JourneyDetail>)> {
    for place in [&body.start, &body.end] {
        let valid = (-90.0..=90.0).contains(&place.lat) && (-180.0..=180.0).contains(&place.lon);
        if !valid || place.label.trim().is_empty() || place.label.len() > 300 {
            return Err(AppError::bad_request("invalid_place", "invalid start or destination"));
        }
    }
    let route = geo::walking_route(&state, &body.start, &body.end).await?;
    let path = serde_json::to_value(&route.path).map_err(AppError::internal)?;

    let route_id = Uuid::now_v7();
    let journey_id = Uuid::now_v7();
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
        "INSERT INTO journeys (id, route_id, kind, status, starts_at, created_by)
         VALUES ($1, $2, 'solo', 'active', now(), $3)",
        journey_id,
        route_id,
        user_id,
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "INSERT INTO journey_participants (journey_id, user_id) VALUES ($1, $2)",
        journey_id,
        user_id
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    let detail = fetch_detail(&state, user_id, journey_id).await?;
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
        "SELECT j.id, j.kind, j.status, j.created_at, r.id AS route_id,
                r.start_label, r.start_lat, r.start_lon, r.end_label, r.end_lat, r.end_lon,
                r.distance_m AS route_distance_m, p.distance_m, p.arrived_at
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
                id: r.id,
                kind: r.kind,
                status: r.status,
                route_id: r.route_id,
                start: Place { label: r.start_label, lat: r.start_lat, lon: r.start_lon },
                end: Place { label: r.end_label, lat: r.end_lat, lon: r.end_lon },
                route_distance_m: r.route_distance_m,
                distance_m: r.distance_m,
                arrived_at: r.arrived_at,
                created_at: r.created_at,
            })
            .collect(),
    ))
}

/// One journey with its route geometry.
#[utoipa::path(get, path = "/journeys/{id}", tag = "journeys", security(("bearer" = [])),
    params(("id" = Uuid, Path)),
    responses((status = 200, body = JourneyDetail), (status = 404, body = ErrorBody)))]
async fn get_journey(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<JourneyDetail>> {
    Ok(Json(fetch_detail(&state, user_id, id).await?))
}

async fn fetch_detail(state: &AppState, user_id: Uuid, journey_id: Uuid) -> AppResult<JourneyDetail> {
    let r = sqlx::query!(
        "SELECT j.id, j.kind, j.status, j.created_at, r.id AS route_id,
                r.start_label, r.start_lat, r.start_lon, r.end_label, r.end_lat, r.end_lon,
                r.distance_m AS route_distance_m, r.path, p.distance_m, p.arrived_at
         FROM journey_participants p
         JOIN journeys j ON j.id = p.journey_id
         JOIN routes r ON r.id = j.route_id
         WHERE p.user_id = $1 AND j.id = $2",
        user_id,
        journey_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::not_found("journey not found"))?;
    Ok(JourneyDetail {
        summary: JourneySummary {
            id: r.id,
            kind: r.kind,
            status: r.status,
            route_id: r.route_id,
            start: Place { label: r.start_label, lat: r.start_lat, lon: r.start_lon },
            end: Place { label: r.end_label, lat: r.end_lat, lon: r.end_lon },
            route_distance_m: r.route_distance_m,
            distance_m: r.distance_m,
            arrived_at: r.arrived_at,
            created_at: r.created_at,
        },
        path: r.path,
    })
}
