//! Public routes: walkers publish a route they computed, everyone (or their
//! friends) can browse it, start it and see who walked it fastest.

use axum::{
    Json,
    body::Bytes,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use time::OffsetDateTime;
use utoipa::{IntoParams, ToSchema};
use utoipa_axum::{router::OpenApiRouter, routes};
use uuid::Uuid;

use crate::{
    account::check_image,
    auth::AuthUser,
    error::{AppError, AppResult, ErrorBody, is_unique_violation},
    geo::Place,
    journeys::{JourneyDetail, fetch_detail},
    stages::Stage,
    state::AppState,
};

/// Tags an author can put on a route, for the Explorer filters.
pub const TAGS: [&str; 6] = ["mountain", "sea", "castles", "countryside", "city", "river"];
/// Photos are sent as 1600 px JPEGs, a few hundred kilobytes.
const MAX_PHOTO_BYTES: usize = 2 * 1024 * 1024;
/// A route is hidden once this many walkers report it.
pub const HIDE_AFTER_REPORTS: i64 = 3;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(publish, list_public_routes))
        .routes(routes!(featured))
        .routes(routes!(get_public_route, delete_public_route))
        .routes(routes!(start_public_route))
        .routes(routes!(set_photo, delete_photo))
        .routes(routes!(report))
        .routes(routes!(admin_update_route))
        .routes(routes!(admin_reports))
}

/// A walker as shown next to what they did.
#[derive(Serialize, ToSchema, Clone)]
pub struct Walker {
    pub id: Uuid,
    pub first_name: String,
    pub username: String,
    pub avatar_url: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct Photo {
    /// `start`, `end` or `path`.
    kind: String,
    url: String,
}

/// A public route as a card in the Explorer.
#[derive(Serialize, ToSchema)]
pub struct PublicRouteCard {
    id: Uuid,
    route_id: Uuid,
    title: String,
    description: String,
    author: Walker,
    /// `everyone` or `friends`.
    visibility: String,
    tags: Vec<String>,
    start: Place,
    end: Place,
    start_town: Option<String>,
    end_town: Option<String>,
    distance_m: f64,
    /// Stages between the start and the destination, the destination included.
    stages: i64,
    /// Walkers who started it.
    walkers: i64,
    /// Walkers who finished it.
    finished: i64,
    photos: Vec<Photo>,
    featured: bool,
    #[serde(with = "time::serde::rfc3339")]
    created_at: OffsetDateTime,
}

/// One of the fastest walkers of a route: walking time on the treadmill.
#[derive(Serialize, ToSchema)]
pub struct Fastest {
    rank: i64,
    walker: Walker,
    walking_s: i64,
    sessions: i64,
    #[serde(with = "time::serde::rfc3339")]
    arrived_at: OffsetDateTime,
}

#[derive(Serialize, ToSchema)]
pub struct PublicRouteDetail {
    #[serde(flatten)]
    card: PublicRouteCard,
    /// Route geometry: `[lon, lat, cumulative_m]` points.
    #[schema(value_type = Vec<[f64; 3]>)]
    path: serde_json::Value,
    stage_list: Vec<Stage>,
    /// Ten fastest by walking time.
    fastest: Vec<Fastest>,
    /// My journey on it, if I started it.
    my_journey_id: Option<Uuid>,
    /// I published it.
    mine: bool,
}

#[derive(Deserialize, ToSchema)]
pub struct Publish {
    /// A route the current user computed.
    route_id: Uuid,
    title: String,
    #[serde(default)]
    description: String,
    /// `everyone` (default) or `friends`.
    #[serde(default = "everyone")]
    visibility: String,
    #[serde(default)]
    tags: Vec<String>,
}

fn everyone() -> String {
    "everyone".to_owned()
}

#[derive(Deserialize, IntoParams)]
pub struct ListQuery {
    /// `popular` (default), `new` or `near`.
    sort: Option<String>,
    /// Words in the title, the start or the destination.
    q: Option<String>,
    /// One of the tags.
    tag: Option<String>,
    /// Routes up to this length.
    max_km: Option<f64>,
    /// Where `near` measures from.
    lat: Option<f64>,
    lon: Option<f64>,
    limit: Option<i64>,
    offset: Option<i64>,
}

/// Cards of the given public routes, in the order of `ids`.
async fn cards(db: &PgPool, me: Uuid, ids: &[Uuid]) -> AppResult<Vec<PublicRouteCard>> {
    let rows = sqlx::query!(
        "SELECT p.id, p.route_id, p.title, p.description, p.visibility, p.tags, p.featured_at, p.created_at,
                u.id AS author_id, u.first_name, u.username, u.avatar_url,
                r.start_label, r.start_lat, r.start_lon, r.end_label, r.end_lat, r.end_lon, r.distance_m,
                (SELECT name FROM route_stages WHERE route_id = r.id ORDER BY position LIMIT 1) AS start_town,
                (SELECT name FROM route_stages WHERE route_id = r.id ORDER BY position DESC LIMIT 1) AS end_town,
                (SELECT count(*) FROM route_stages WHERE route_id = r.id AND position > 0) AS \"stages!\",
                (SELECT count(DISTINCT jp.user_id) FROM journeys j JOIN journey_participants jp ON jp.journey_id = j.id
                 WHERE j.public_route_id = p.id AND jp.joined_at IS NOT NULL) AS \"walkers!\",
                (SELECT count(*) FROM journeys j JOIN journey_participants jp ON jp.journey_id = j.id
                 WHERE j.public_route_id = p.id AND jp.arrived_at IS NOT NULL) AS \"finished!\",
                (SELECT COALESCE(array_agg(ph.kind || ':' || extract(epoch FROM ph.updated_at)::bigint ORDER BY ph.kind), '{}')
                 FROM public_route_photos ph WHERE ph.public_route_id = p.id) AS \"photos!\"
         FROM public_routes p
         JOIN users u ON u.id = p.author_id
         JOIN routes r ON r.id = p.route_id
         WHERE p.id = ANY($1) AND (NOT p.hidden OR p.author_id = $2)",
        ids,
        me
    )
    .fetch_all(db)
    .await?;
    let mut cards: Vec<PublicRouteCard> = rows
        .into_iter()
        .map(|r| PublicRouteCard {
            photos: r
                .photos
                .iter()
                .filter_map(|p| p.split_once(':'))
                .map(|(kind, version)| Photo {
                    url: format!("/public-routes/{}/photos/{kind}?v={version}", r.id),
                    kind: kind.to_owned(),
                })
                .collect(),
            id: r.id,
            route_id: r.route_id,
            title: r.title,
            description: r.description,
            author: Walker {
                id: r.author_id,
                first_name: r.first_name,
                username: r.username,
                avatar_url: r.avatar_url,
            },
            visibility: r.visibility,
            tags: r.tags,
            start: Place { label: r.start_label, lat: r.start_lat, lon: r.start_lon },
            end: Place { label: r.end_label, lat: r.end_lat, lon: r.end_lon },
            start_town: r.start_town.filter(|t| !t.is_empty()),
            end_town: r.end_town.filter(|t| !t.is_empty()),
            distance_m: r.distance_m,
            stages: r.stages,
            walkers: r.walkers,
            finished: r.finished,
            featured: r.featured_at.is_some(),
            created_at: r.created_at,
        })
        .collect();
    cards.sort_by_key(|c| ids.iter().position(|id| *id == c.id));
    Ok(cards)
}

/// Public route ids the current user may see, in the requested order.
async fn visible_ids(db: &PgPool, me: Uuid, query: &ListQuery) -> AppResult<Vec<Uuid>> {
    let sort = query.sort.as_deref().unwrap_or("popular");
    if !["popular", "new", "near"].contains(&sort) {
        return Err(AppError::bad_request("invalid_sort", "sort is popular, new or near"));
    }
    if sort == "near" && (query.lat.is_none() || query.lon.is_none()) {
        return Err(AppError::bad_request("missing_position", "near needs lat and lon"));
    }
    let q = query.q.as_deref().map(str::trim).filter(|q| !q.is_empty()).map(|q| format!("%{q}%"));
    let ids = sqlx::query_scalar!(
        "SELECT p.id FROM public_routes p JOIN routes r ON r.id = p.route_id
         WHERE NOT p.hidden
           AND (p.visibility = 'everyone' OR p.author_id = $1 OR EXISTS (
                SELECT 1 FROM friendships f WHERE f.status = 'accepted'
                  AND ((f.user_id = $1 AND f.friend_id = p.author_id) OR (f.friend_id = $1 AND f.user_id = p.author_id))))
           AND ($2::text IS NULL OR p.title ILIKE $2 OR r.start_label ILIKE $2 OR r.end_label ILIKE $2)
           AND ($3::text IS NULL OR $3 = ANY(p.tags))
           AND ($4::float8 IS NULL OR r.distance_m <= $4 * 1000)
         ORDER BY
           CASE WHEN $5 = 'popular' THEN (SELECT count(*) FROM journeys j WHERE j.public_route_id = p.id) END DESC NULLS LAST,
           CASE WHEN $5 = 'near' THEN (r.start_lat - $6) ^ 2 + ((r.start_lon - $7) * cos(radians($6))) ^ 2 END ASC NULLS LAST,
           p.created_at DESC
         LIMIT $8 OFFSET $9",
        me,
        q,
        query.tag,
        query.max_km,
        sort,
        query.lat,
        query.lon,
        query.limit.unwrap_or(20).clamp(1, 50),
        query.offset.unwrap_or(0).max(0),
    )
    .fetch_all(db)
    .await?;
    Ok(ids)
}

/// Whether the current user may see this public route (hidden ones: only the author).
async fn can_see(db: &PgPool, me: Uuid, id: Uuid) -> AppResult<bool> {
    Ok(sqlx::query_scalar!(
        "SELECT EXISTS (SELECT 1 FROM public_routes p WHERE p.id = $2
           AND (p.author_id = $1 OR (NOT p.hidden AND (p.visibility = 'everyone' OR EXISTS (
                SELECT 1 FROM friendships f WHERE f.status = 'accepted'
                  AND ((f.user_id = $1 AND f.friend_id = p.author_id) OR (f.friend_id = $1 AND f.user_id = p.author_id)))))))
         AS \"visible!\"",
        me,
        id
    )
    .fetch_one(db)
    .await?)
}

async fn is_admin(db: &PgPool, me: Uuid) -> AppResult<bool> {
    Ok(sqlx::query_scalar!("SELECT is_admin FROM users WHERE id = $1", me)
        .fetch_optional(db)
        .await?
        .unwrap_or(false))
}

/// Publish a route the current user computed.
#[utoipa::path(post, path = "/public-routes", tag = "public routes", security(("bearer" = [])), request_body = Publish,
    responses((status = 201, body = PublicRouteDetail), (status = 400, body = ErrorBody), (status = 404, body = ErrorBody), (status = 409, body = ErrorBody)))]
async fn publish(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Json(body): Json<Publish>,
) -> AppResult<(StatusCode, Json<PublicRouteDetail>)> {
    let title = body.title.trim();
    if !(3..=80).contains(&title.chars().count()) {
        return Err(AppError::bad_request("invalid_title", "the title is 3 to 80 characters"));
    }
    let description = body.description.trim();
    if description.chars().count() > 600 {
        return Err(AppError::bad_request(
            "invalid_description",
            "the description is 600 characters at most",
        ));
    }
    if !["everyone", "friends"].contains(&body.visibility.as_str()) {
        return Err(AppError::bad_request("invalid_visibility", "visibility is everyone or friends"));
    }
    let mut tags = body.tags.clone();
    tags.sort();
    tags.dedup();
    if tags.iter().any(|t| !TAGS.contains(&t.as_str())) {
        return Err(AppError::bad_request("invalid_tag", "unknown tag"));
    }
    let id = Uuid::now_v7();
    let inserted = sqlx::query!(
        "INSERT INTO public_routes (id, route_id, author_id, title, description, visibility, tags)
         SELECT $1, r.id, $3, $4, $5, $6, $7 FROM routes r WHERE r.id = $2 AND r.created_by = $3",
        id,
        body.route_id,
        me,
        title,
        description,
        body.visibility,
        &tags,
    )
    .execute(&state.db)
    .await
    .map_err(|e| {
        if is_unique_violation(&e, "public_routes_route_id_key") {
            AppError::conflict("already_published", "this route is already published")
        } else {
            e.into()
        }
    })?;
    if inserted.rows_affected() == 0 {
        return Err(AppError::not_found("route not found"));
    }
    // Journeys of the author on this route now count for it.
    sqlx::query!(
        "UPDATE journeys SET public_route_id = $1 WHERE route_id = $2 AND public_route_id IS NULL",
        id,
        body.route_id
    )
    .execute(&state.db)
    .await?;
    Ok((StatusCode::CREATED, Json(detail(&state.db, me, id).await?)))
}

/// Browse public routes: popular, new or near a place, with a search and filters.
#[utoipa::path(get, path = "/public-routes", tag = "public routes", security(("bearer" = [])), params(ListQuery),
    responses((status = 200, body = Vec<PublicRouteCard>), (status = 400, body = ErrorBody)))]
async fn list_public_routes(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Query(query): Query<ListQuery>,
) -> AppResult<Json<Vec<PublicRouteCard>>> {
    let ids = visible_ids(&state.db, me, &query).await?;
    Ok(Json(cards(&state.db, me, &ids).await?))
}

/// The route of the week: the last one chosen by the team, else the most started this week.
#[utoipa::path(get, path = "/public-routes/featured", tag = "public routes", security(("bearer" = [])),
    responses((status = 200, body = PublicRouteCard), (status = 404, body = ErrorBody)))]
async fn featured(State(state): State<AppState>, AuthUser(me): AuthUser) -> AppResult<Json<PublicRouteCard>> {
    let id = sqlx::query_scalar!(
        "SELECT p.id FROM public_routes p
         WHERE NOT p.hidden AND p.visibility = 'everyone'
         ORDER BY p.featured_at DESC NULLS LAST,
                  (SELECT count(*) FROM journeys j WHERE j.public_route_id = p.id
                     AND j.created_at > now() - interval '7 days') DESC,
                  p.created_at DESC
         LIMIT 1"
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::not_found("no public route yet"))?;
    cards(&state.db, me, &[id])
        .await?
        .pop()
        .map(Json)
        .ok_or_else(|| AppError::not_found("no public route yet"))
}

async fn detail(db: &PgPool, me: Uuid, id: Uuid) -> AppResult<PublicRouteDetail> {
    let card =
        cards(db, me, &[id]).await?.pop().ok_or_else(|| AppError::not_found("public route not found"))?;
    let path =
        sqlx::query_scalar!("SELECT path FROM routes WHERE id = $1", card.route_id).fetch_one(db).await?;
    let stage_list = sqlx::query_as!(
        Stage,
        "SELECT id, position, name, county, lat, lon, at_m FROM route_stages WHERE route_id = $1 ORDER BY position",
        card.route_id
    )
    .fetch_all(db)
    .await?;
    // Walking time: each session counts for the share of its distance that went to the journey.
    let fastest = sqlx::query!(
        "SELECT u.id, u.first_name, u.username, u.avatar_url, jp.arrived_at AS \"arrived_at!\",
                COALESCE(sum(s.duration_s * a.distance_m / NULLIF(s.distance_m, 0)), 0)::bigint AS \"walking_s!\",
                count(s.id) AS \"sessions!\"
         FROM journeys j
         JOIN journey_participants jp ON jp.journey_id = j.id
         JOIN users u ON u.id = jp.user_id
         LEFT JOIN session_allocations a ON a.journey_id = j.id
         LEFT JOIN sessions s ON s.id = a.session_id AND s.user_id = jp.user_id AND a.distance_m > 0
         WHERE j.public_route_id = $1 AND jp.arrived_at IS NOT NULL
         GROUP BY u.id, jp.journey_id, jp.arrived_at
         ORDER BY 6, jp.arrived_at
         LIMIT 10",
        id
    )
    .fetch_all(db)
    .await?
    .into_iter()
    .enumerate()
    .map(|(i, r)| Fastest {
        rank: i64::try_from(i).unwrap_or(i64::MAX) + 1,
        walker: Walker { id: r.id, first_name: r.first_name, username: r.username, avatar_url: r.avatar_url },
        walking_s: r.walking_s,
        sessions: r.sessions,
        arrived_at: r.arrived_at,
    })
    .collect();
    let my_journey_id = sqlx::query_scalar!(
        "SELECT j.id FROM journeys j JOIN journey_participants jp ON jp.journey_id = j.id
         WHERE j.public_route_id = $1 AND jp.user_id = $2 ORDER BY j.created_at DESC LIMIT 1",
        id,
        me
    )
    .fetch_optional(db)
    .await?;
    let mine = card.author.id == me;
    Ok(PublicRouteDetail { card, path, stage_list, fastest, my_journey_id, mine })
}

/// A public route: its map, its stages, the ten fastest walkers.
#[utoipa::path(get, path = "/public-routes/{id}", tag = "public routes", security(("bearer" = [])),
    params(("id" = Uuid, Path)), responses((status = 200, body = PublicRouteDetail), (status = 404, body = ErrorBody)))]
async fn get_public_route(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<PublicRouteDetail>> {
    if !can_see(&state.db, me, id).await? {
        return Err(AppError::not_found("public route not found"));
    }
    Ok(Json(detail(&state.db, me, id).await?))
}

/// Unpublish a route (its author or an admin). Journeys on it go on.
#[utoipa::path(delete, path = "/public-routes/{id}", tag = "public routes", security(("bearer" = [])),
    params(("id" = Uuid, Path)), responses((status = 204), (status = 404, body = ErrorBody)))]
async fn delete_public_route(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let admin = is_admin(&state.db, me).await?;
    let deleted =
        sqlx::query!("DELETE FROM public_routes WHERE id = $1 AND (author_id = $2 OR $3)", id, me, admin)
            .execute(&state.db)
            .await?;
    if deleted.rows_affected() == 0 {
        return Err(AppError::not_found("public route not found"));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Start a solo journey on a public route.
#[utoipa::path(post, path = "/public-routes/{id}/start", tag = "public routes", security(("bearer" = [])),
    params(("id" = Uuid, Path)), responses((status = 201, body = JourneyDetail), (status = 404, body = ErrorBody), (status = 409, body = ErrorBody)))]
async fn start_public_route(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<(StatusCode, Json<JourneyDetail>)> {
    if !can_see(&state.db, me, id).await? {
        return Err(AppError::not_found("public route not found"));
    }
    let under_way = sqlx::query_scalar!(
        "SELECT EXISTS (SELECT 1 FROM journeys j JOIN journey_participants jp ON jp.journey_id = j.id
           WHERE j.public_route_id = $1 AND jp.user_id = $2 AND j.status = 'active' AND jp.arrived_at IS NULL)
         AS \"exists!\"",
        id,
        me
    )
    .fetch_one(&state.db)
    .await?;
    if under_way {
        return Err(AppError::conflict("already_started", "you are already on this route"));
    }
    let journey_id = Uuid::now_v7();
    let mut tx = state.db.begin().await?;
    sqlx::query!(
        "INSERT INTO journeys (id, route_id, kind, status, starts_at, created_by, public_route_id)
         SELECT $1, route_id, 'solo', 'active', now(), $3, id FROM public_routes WHERE id = $2",
        journey_id,
        id,
        me
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!("INSERT INTO journey_participants (journey_id, user_id) VALUES ($1, $2)", journey_id, me)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(fetch_detail(&state.db, &state.live, me, journey_id).await?)))
}

fn photo_kind(kind: &str) -> AppResult<()> {
    if ["start", "end", "path"].contains(&kind) {
        Ok(())
    } else {
        Err(AppError::bad_request("invalid_kind", "the photo is start, end or path"))
    }
}

/// Set a photo of a public route (its author): the raw JPEG or PNG image.
#[utoipa::path(put, path = "/public-routes/{id}/photos/{kind}", tag = "public routes", security(("bearer" = [])),
    params(("id" = Uuid, Path), ("kind" = String, Path, description = "start, end or path")),
    request_body(content = Vec<u8>, content_type = "image/jpeg"),
    responses((status = 200, body = PublicRouteDetail), (status = 400, body = ErrorBody), (status = 404, body = ErrorBody), (status = 413, body = ErrorBody)))]
async fn set_photo(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path((id, kind)): Path<(Uuid, String)>,
    headers: HeaderMap,
    body: Bytes,
) -> AppResult<Json<PublicRouteDetail>> {
    photo_kind(&kind)?;
    let content_type = check_image(&headers, &body, MAX_PHOTO_BYTES)?;
    let saved = sqlx::query!(
        "INSERT INTO public_route_photos (public_route_id, kind, content_type, image)
         SELECT id, $3, $4, $5 FROM public_routes WHERE id = $1 AND author_id = $2
         ON CONFLICT (public_route_id, kind) DO UPDATE SET content_type = $4, image = $5, updated_at = now()",
        id,
        me,
        kind,
        content_type,
        body.as_ref()
    )
    .execute(&state.db)
    .await?;
    if saved.rows_affected() == 0 {
        return Err(AppError::not_found("public route not found"));
    }
    Ok(Json(detail(&state.db, me, id).await?))
}

/// Remove a photo of a public route (its author).
#[utoipa::path(delete, path = "/public-routes/{id}/photos/{kind}", tag = "public routes", security(("bearer" = [])),
    params(("id" = Uuid, Path), ("kind" = String, Path)),
    responses((status = 200, body = PublicRouteDetail), (status = 404, body = ErrorBody)))]
async fn delete_photo(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path((id, kind)): Path<(Uuid, String)>,
) -> AppResult<Json<PublicRouteDetail>> {
    photo_kind(&kind)?;
    sqlx::query!(
        "DELETE FROM public_route_photos ph USING public_routes p
         WHERE ph.public_route_id = p.id AND p.id = $1 AND p.author_id = $2 AND ph.kind = $3",
        id,
        me,
        kind
    )
    .execute(&state.db)
    .await?;
    if !can_see(&state.db, me, id).await? {
        return Err(AppError::not_found("public route not found"));
    }
    Ok(Json(detail(&state.db, me, id).await?))
}

/// `GET /public-routes/{id}/photos/{kind}`: a photo, cached for a day (its URL changes with it).
pub async fn get_photo(
    State(state): State<AppState>,
    Path((id, kind)): Path<(Uuid, String)>,
) -> AppResult<Response> {
    let photo = sqlx::query!(
        "SELECT ph.content_type, ph.image FROM public_route_photos ph JOIN public_routes p ON p.id = ph.public_route_id
         WHERE ph.public_route_id = $1 AND ph.kind = $2 AND NOT p.hidden",
        id,
        kind
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::not_found("no photo"))?;
    Ok((
        [
            (header::CONTENT_TYPE, photo.content_type),
            (header::CACHE_CONTROL, "public, max-age=86400".to_owned()),
        ],
        photo.image,
    )
        .into_response())
}

#[derive(Deserialize, ToSchema)]
pub struct Report {
    /// `route`, `post`, `comment` or `user`.
    target_type: String,
    target_id: Uuid,
    #[serde(default)]
    reason: String,
}

/// Report something that has no place on Cap. A route reported by three
/// walkers is hidden until an admin looks at it; so are posts and comments.
#[utoipa::path(post, path = "/reports", tag = "public routes", security(("bearer" = [])), request_body = Report,
    responses((status = 204), (status = 400, body = ErrorBody)))]
async fn report(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Json(body): Json<Report>,
) -> AppResult<StatusCode> {
    if !["route", "post", "comment", "user"].contains(&body.target_type.as_str()) {
        return Err(AppError::bad_request("invalid_target", "target_type is route, post, comment or user"));
    }
    let reason: String = body.reason.trim().chars().take(300).collect();
    sqlx::query!(
        "INSERT INTO reports (id, reporter_id, target_type, target_id, reason) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING",
        Uuid::now_v7(),
        me,
        body.target_type,
        body.target_id,
        reason
    )
    .execute(&state.db)
    .await?;
    hide_if_reported(&state.db, &body.target_type, body.target_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Hides a route, post or comment once enough walkers reported it.
pub async fn hide_if_reported(db: &PgPool, target_type: &str, target_id: Uuid) -> AppResult<()> {
    let count = sqlx::query_scalar!(
        "SELECT count(*) AS \"count!\" FROM reports WHERE target_type = $1 AND target_id = $2 AND resolved_at IS NULL",
        target_type,
        target_id
    )
    .fetch_one(db)
    .await?;
    if count >= HIDE_AFTER_REPORTS && target_type == "route" {
        sqlx::query!("UPDATE public_routes SET hidden = true WHERE id = $1", target_id).execute(db).await?;
    }
    Ok(())
}

#[derive(Deserialize, ToSchema)]
pub struct AdminRoute {
    /// Hide or show again (clears the reports when shown).
    hidden: Option<bool>,
    /// Make it the route of the week, or not.
    featured: Option<bool>,
}

/// Admins: hide, show or feature a public route.
#[utoipa::path(patch, path = "/admin/public-routes/{id}", tag = "public routes", security(("bearer" = [])),
    params(("id" = Uuid, Path)), request_body = AdminRoute,
    responses((status = 200, body = PublicRouteDetail), (status = 403, body = ErrorBody), (status = 404, body = ErrorBody)))]
async fn admin_update_route(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<AdminRoute>,
) -> AppResult<Json<PublicRouteDetail>> {
    if !is_admin(&state.db, me).await? {
        return Err(AppError::new(StatusCode::FORBIDDEN, "forbidden", "admins only"));
    }
    let updated = sqlx::query!(
        "UPDATE public_routes SET hidden = COALESCE($2, hidden),
                featured_at = CASE WHEN $3::bool IS NULL THEN featured_at WHEN $3 THEN now() ELSE NULL END
         WHERE id = $1",
        id,
        body.hidden,
        body.featured
    )
    .execute(&state.db)
    .await?;
    if updated.rows_affected() == 0 {
        return Err(AppError::not_found("public route not found"));
    }
    if body.hidden == Some(false) {
        sqlx::query!(
            "UPDATE reports SET resolved_at = now() WHERE target_type = 'route' AND target_id = $1 AND resolved_at IS NULL",
            id
        )
        .execute(&state.db)
        .await?;
    }
    Ok(Json(detail(&state.db, me, id).await?))
}

#[derive(Serialize, ToSchema)]
pub struct OpenReport {
    target_type: String,
    target_id: Uuid,
    reports: i64,
    reasons: Vec<String>,
    #[serde(with = "time::serde::rfc3339")]
    last_at: OffsetDateTime,
}

/// Admins: what walkers reported and nobody looked at yet.
#[utoipa::path(get, path = "/admin/reports", tag = "public routes", security(("bearer" = [])),
    responses((status = 200, body = Vec<OpenReport>), (status = 403, body = ErrorBody)))]
async fn admin_reports(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
) -> AppResult<Json<Vec<OpenReport>>> {
    if !is_admin(&state.db, me).await? {
        return Err(AppError::new(StatusCode::FORBIDDEN, "forbidden", "admins only"));
    }
    let rows = sqlx::query!(
        "SELECT target_type, target_id, count(*) AS \"reports!\",
                array_remove(array_agg(NULLIF(reason, '')), NULL) AS \"reasons!\", max(created_at) AS \"last_at!\"
         FROM reports WHERE resolved_at IS NULL
         GROUP BY target_type, target_id ORDER BY 3 DESC, 5 DESC"
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(
        rows.into_iter()
            .map(|r| OpenReport {
                target_type: r.target_type,
                target_id: r.target_id,
                reports: r.reports,
                reasons: r.reasons,
                last_at: r.last_at,
            })
            .collect(),
    ))
}
