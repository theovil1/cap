//! Scheduled journeys: a public route walked together from a set time until an
//! end date. Walkers sign up before or during it, start from zero, and the
//! first to arrive wins. Live standings are polled, not pushed: there can be
//! thousands of walkers.

use std::{
    collections::{HashMap, VecDeque},
    sync::{LazyLock, Mutex},
};

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use time::{Duration, OffsetDateTime};
use utoipa::{IntoParams, ToSchema};
use utoipa_axum::{router::OpenApiRouter, routes};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult, ErrorBody},
    geo::Place,
    live::LiveHub,
    public_routes::{Walker, can_see},
    state::AppState,
};

/// Walkers shown as dots on the live map, besides the leaders and friends.
const MAX_DOTS: usize = 150;
/// Places gained or lost are measured over this time.
const DELTA_WINDOW: Duration = Duration::minutes(10);

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(create_event, list_events))
        .routes(routes!(get_event))
        .routes(routes!(register, unregister))
        .routes(routes!(live_standings))
}

/// Moves scheduled journeys on with the clock: under way at their start, over at their end.
pub async fn tick(db: &PgPool) -> AppResult<()> {
    sqlx::query!(
        "UPDATE journeys SET status = CASE WHEN ends_at <= now() THEN 'finished' ELSE 'active' END
         WHERE kind = 'event' AND status <> 'finished' AND (starts_at <= now() AND status = 'waiting' OR ends_at <= now())"
    )
    .execute(db)
    .await?;
    Ok(())
}

#[derive(Serialize, ToSchema)]
pub struct EventCard {
    id: Uuid,
    title: String,
    public_route_id: Uuid,
    /// `upcoming`, `live` or `ended`.
    state: String,
    #[serde(with = "time::serde::rfc3339")]
    starts_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    ends_at: OffsetDateTime,
    organizer: Walker,
    start: Place,
    end: Place,
    start_town: Option<String>,
    end_town: Option<String>,
    distance_m: f64,
    stages: i64,
    /// Photo of the destination, else none (the app shows it from the sky).
    photo_url: Option<String>,
    registered: i64,
    /// Walkers on the treadmill right now.
    walking_now: i64,
    /// Up to five friends signed up.
    friends: Vec<Walker>,
    friends_registered: i64,
    me_registered: bool,
}

#[derive(Deserialize, ToSchema)]
pub struct CreateEvent {
    public_route_id: Uuid,
    title: String,
    #[serde(with = "time::serde::rfc3339")]
    starts_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    ends_at: OffsetDateTime,
}

#[derive(Deserialize, IntoParams)]
pub struct ListQuery {
    /// `all` (default), `mine` (signed up or organised) or `friends` (a friend is in).
    filter: Option<String>,
    /// Words in the title or the towns.
    q: Option<String>,
}

async fn cards(db: &PgPool, live: &LiveHub, me: Uuid, ids: &[Uuid]) -> AppResult<Vec<EventCard>> {
    let rows = sqlx::query!(
        "SELECT j.id, j.title AS \"title!\", j.public_route_id AS \"public_route_id!\", j.status,
                j.starts_at AS \"starts_at!\", j.ends_at AS \"ends_at!\",
                u.id AS organizer_id, u.first_name, u.username, u.avatar_url,
                r.start_label, r.start_lat, r.start_lon, r.end_label, r.end_lat, r.end_lon, r.distance_m,
                (SELECT name FROM route_stages WHERE route_id = r.id ORDER BY position LIMIT 1) AS start_town,
                (SELECT name FROM route_stages WHERE route_id = r.id ORDER BY position DESC LIMIT 1) AS end_town,
                (SELECT count(*) FROM route_stages WHERE route_id = r.id AND position > 0) AS \"stages!\",
                (SELECT extract(epoch FROM ph.updated_at)::bigint FROM public_route_photos ph
                 WHERE ph.public_route_id = j.public_route_id AND ph.kind = 'end') AS photo_version,
                (SELECT count(*) FROM journey_participants p WHERE p.journey_id = j.id AND p.joined_at IS NOT NULL)
                    AS \"registered!\",
                EXISTS (SELECT 1 FROM journey_participants p WHERE p.journey_id = j.id AND p.user_id = $2
                        AND p.joined_at IS NOT NULL) AS \"me_registered!\"
         FROM journeys j
         JOIN users u ON u.id = j.created_by
         JOIN routes r ON r.id = j.route_id
         WHERE j.id = ANY($1) AND j.kind = 'event'",
        ids,
        me
    )
    .fetch_all(db)
    .await?;
    let mut cards = Vec::with_capacity(rows.len());
    for r in rows {
        let friends = sqlx::query!(
            "SELECT u.id, u.first_name, u.username, u.avatar_url FROM journey_participants p
             JOIN users u ON u.id = p.user_id
             WHERE p.journey_id = $1 AND p.joined_at IS NOT NULL AND EXISTS (
                SELECT 1 FROM friendships f WHERE f.status = 'accepted'
                  AND ((f.user_id = $2 AND f.friend_id = u.id) OR (f.friend_id = $2 AND f.user_id = u.id)))
             ORDER BY p.joined_at",
            r.id,
            me
        )
        .fetch_all(db)
        .await?;
        let walking_now = if r.status == "active" {
            let walkers = sqlx::query_scalar!(
                "SELECT user_id FROM journey_participants WHERE journey_id = $1 AND joined_at IS NOT NULL
                   AND arrived_at IS NULL",
                r.id
            )
            .fetch_all(db)
            .await?;
            i64::try_from(walkers.iter().filter(|u| live.is_walking(**u)).count()).unwrap_or(0)
        } else {
            0
        };
        cards.push(EventCard {
            state: match r.status.as_str() {
                "active" => "live",
                "finished" => "ended",
                _ => "upcoming",
            }
            .to_owned(),
            friends_registered: i64::try_from(friends.len()).unwrap_or(0),
            friends: friends
                .into_iter()
                .take(5)
                .map(|f| Walker {
                    id: f.id,
                    first_name: f.first_name,
                    username: f.username,
                    avatar_url: f.avatar_url,
                })
                .collect(),
            photo_url: r
                .photo_version
                .map(|v| format!("/public-routes/{}/photos/end?v={v}", r.public_route_id)),
            id: r.id,
            title: r.title,
            public_route_id: r.public_route_id,
            starts_at: r.starts_at,
            ends_at: r.ends_at,
            organizer: Walker {
                id: r.organizer_id,
                first_name: r.first_name,
                username: r.username,
                avatar_url: r.avatar_url,
            },
            start: Place { label: r.start_label, lat: r.start_lat, lon: r.start_lon },
            end: Place { label: r.end_label, lat: r.end_lat, lon: r.end_lon },
            start_town: r.start_town.filter(|t| !t.is_empty()),
            end_town: r.end_town.filter(|t| !t.is_empty()),
            distance_m: r.distance_m,
            stages: r.stages,
            registered: r.registered,
            walking_now,
            me_registered: r.me_registered,
        });
    }
    cards.sort_by_key(|c| ids.iter().position(|id| *id == c.id));
    Ok(cards)
}

/// Schedule a journey on a public route: a title, a start and an end.
#[utoipa::path(post, path = "/events", tag = "events", security(("bearer" = [])), request_body = CreateEvent,
    responses((status = 201, body = EventCard), (status = 400, body = ErrorBody), (status = 404, body = ErrorBody)))]
async fn create_event(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Json(body): Json<CreateEvent>,
) -> AppResult<(StatusCode, Json<EventCard>)> {
    let title = body.title.trim();
    if !(3..=80).contains(&title.chars().count()) {
        return Err(AppError::bad_request("invalid_title", "the title is 3 to 80 characters"));
    }
    let now = OffsetDateTime::now_utc();
    if body.starts_at < now + Duration::minutes(10) || body.starts_at > now + Duration::days(365) {
        return Err(AppError::bad_request(
            "invalid_start",
            "the start is between 10 minutes and a year away",
        ));
    }
    if body.ends_at < body.starts_at + Duration::hours(1)
        || body.ends_at > body.starts_at + Duration::days(180)
    {
        return Err(AppError::bad_request("invalid_end", "the end is 1 hour to 180 days after the start"));
    }
    if !can_see(&state.db, me, body.public_route_id).await? {
        return Err(AppError::not_found("public route not found"));
    }
    let id = Uuid::now_v7();
    let mut tx = state.db.begin().await?;
    sqlx::query!(
        "INSERT INTO journeys (id, route_id, kind, status, starts_at, ends_at, title, created_by, public_route_id)
         SELECT $1, route_id, 'event', 'waiting', $3, $4, $5, $6, id FROM public_routes WHERE id = $2",
        id,
        body.public_route_id,
        body.starts_at,
        body.ends_at,
        title,
        me
    )
    .execute(&mut *tx)
    .await?;
    // The organiser walks it too.
    sqlx::query!("INSERT INTO journey_participants (journey_id, user_id) VALUES ($1, $2)", id, me)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    let card = cards(&state.db, &state.live, me, &[id])
        .await?
        .pop()
        .ok_or_else(|| AppError::internal("event lost"))?;
    Ok((StatusCode::CREATED, Json(card)))
}

/// Scheduled journeys under way first, then the next ones; the ended ones I was in last.
#[utoipa::path(get, path = "/events", tag = "events", security(("bearer" = [])), params(ListQuery),
    responses((status = 200, body = Vec<EventCard>), (status = 400, body = ErrorBody)))]
async fn list_events(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Query(query): Query<ListQuery>,
) -> AppResult<Json<Vec<EventCard>>> {
    tick(&state.db).await?;
    let filter = query.filter.as_deref().unwrap_or("all");
    if !["all", "mine", "friends"].contains(&filter) {
        return Err(AppError::bad_request("invalid_filter", "filter is all, mine or friends"));
    }
    let q = query.q.as_deref().map(str::trim).filter(|q| !q.is_empty()).map(|q| format!("%{q}%"));
    let ids = sqlx::query_scalar!(
        "SELECT j.id FROM journeys j JOIN public_routes pr ON pr.id = j.public_route_id JOIN routes r ON r.id = j.route_id
         WHERE j.kind = 'event' AND NOT pr.hidden
           AND (pr.visibility = 'everyone' OR pr.author_id = $1 OR j.created_by = $1 OR EXISTS (
                SELECT 1 FROM friendships f WHERE f.status = 'accepted'
                  AND ((f.user_id = $1 AND f.friend_id = pr.author_id) OR (f.friend_id = $1 AND f.user_id = pr.author_id))))
           AND (j.status <> 'finished' OR EXISTS (SELECT 1 FROM journey_participants p
                WHERE p.journey_id = j.id AND p.user_id = $1) AND j.ends_at > now() - interval '30 days')
           AND ($2 <> 'mine' OR j.created_by = $1 OR EXISTS (SELECT 1 FROM journey_participants p
                WHERE p.journey_id = j.id AND p.user_id = $1 AND p.joined_at IS NOT NULL))
           AND ($2 <> 'friends' OR EXISTS (SELECT 1 FROM journey_participants p JOIN friendships f
                ON f.status = 'accepted' AND ((f.user_id = $1 AND f.friend_id = p.user_id) OR (f.friend_id = $1 AND f.user_id = p.user_id))
                WHERE p.journey_id = j.id AND p.joined_at IS NOT NULL))
           AND ($3::text IS NULL OR j.title ILIKE $3 OR r.start_label ILIKE $3 OR r.end_label ILIKE $3)
         ORDER BY CASE j.status WHEN 'active' THEN 0 WHEN 'waiting' THEN 1 ELSE 2 END, j.starts_at
         LIMIT 50",
        me,
        filter,
        q
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(cards(&state.db, &state.live, me, &ids).await?))
}

async fn visible_event(db: &PgPool, me: Uuid, id: Uuid) -> AppResult<Uuid> {
    let route = sqlx::query_scalar!(
        "SELECT public_route_id AS \"public_route_id!\" FROM journeys WHERE id = $1 AND kind = 'event'",
        id
    )
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::not_found("scheduled journey not found"))?;
    if !can_see(db, me, route).await? {
        return Err(AppError::not_found("scheduled journey not found"));
    }
    Ok(id)
}

/// A scheduled journey.
#[utoipa::path(get, path = "/events/{id}", tag = "events", security(("bearer" = [])),
    params(("id" = Uuid, Path)), responses((status = 200, body = EventCard), (status = 404, body = ErrorBody)))]
async fn get_event(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<EventCard>> {
    tick(&state.db).await?;
    let id = visible_event(&state.db, me, id).await?;
    cards(&state.db, &state.live, me, &[id])
        .await?
        .pop()
        .map(Json)
        .ok_or_else(|| AppError::not_found("scheduled journey not found"))
}

/// Sign up, before the start or while it runs (until its end). Late walkers start from zero.
#[utoipa::path(post, path = "/events/{id}/register", tag = "events", security(("bearer" = [])),
    params(("id" = Uuid, Path)), responses((status = 200, body = EventCard), (status = 404, body = ErrorBody), (status = 409, body = ErrorBody)))]
async fn register(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<EventCard>> {
    tick(&state.db).await?;
    let id = visible_event(&state.db, me, id).await?;
    let open = sqlx::query_scalar!("SELECT ends_at > now() AS \"open!\" FROM journeys WHERE id = $1", id)
        .fetch_one(&state.db)
        .await?;
    if !open {
        return Err(AppError::conflict("event_over", "this scheduled journey is over"));
    }
    sqlx::query!(
        "INSERT INTO journey_participants (journey_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        id,
        me
    )
    .execute(&state.db)
    .await?;
    cards(&state.db, &state.live, me, &[id])
        .await?
        .pop()
        .map(Json)
        .ok_or_else(|| AppError::not_found("scheduled journey not found"))
}

/// Leave a scheduled journey (not after arriving). The organiser cannot leave.
#[utoipa::path(delete, path = "/events/{id}/register", tag = "events", security(("bearer" = [])),
    params(("id" = Uuid, Path)), responses((status = 200, body = EventCard), (status = 404, body = ErrorBody), (status = 409, body = ErrorBody)))]
async fn unregister(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<EventCard>> {
    let id = visible_event(&state.db, me, id).await?;
    let organizer =
        sqlx::query_scalar!("SELECT created_by = $2 AS \"mine!\" FROM journeys WHERE id = $1", id, me)
            .fetch_one(&state.db)
            .await?;
    if organizer {
        return Err(AppError::conflict("organizer", "the organiser walks it"));
    }
    sqlx::query!(
        "DELETE FROM journey_participants WHERE journey_id = $1 AND user_id = $2 AND arrived_at IS NULL",
        id,
        me
    )
    .execute(&state.db)
    .await?;
    cards(&state.db, &state.live, me, &[id])
        .await?
        .pop()
        .map(Json)
        .ok_or_else(|| AppError::not_found("scheduled journey not found"))
}

#[derive(Serialize, ToSchema, Clone)]
pub struct Standing {
    rank: i64,
    walker: Walker,
    distance_m: f64,
    friend: bool,
    /// Set while they walk right now.
    speed_kmh: Option<f64>,
    #[serde(with = "time::serde::rfc3339::option")]
    arrived_at: Option<OffsetDateTime>,
}

#[derive(Serialize, ToSchema)]
pub struct LiveStandings {
    registered: i64,
    walking_now: i64,
    route_distance_m: f64,
    /// My place, if I signed up.
    me: Option<Standing>,
    /// My place ten minutes ago, to show the places won or lost.
    my_rank_before: Option<i64>,
    /// The first ten.
    leaders: Vec<Standing>,
    /// My friends in it.
    friends: Vec<Standing>,
    /// Distances of other walkers, for dots on the map.
    others_m: Vec<f64>,
}

type Snapshots = HashMap<Uuid, VecDeque<(OffsetDateTime, HashMap<Uuid, i64>)>>;
/// Recent ranks of each scheduled journey, kept in memory for the places won or lost.
static RANKS: LazyLock<Mutex<Snapshots>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// My rank about ten minutes ago, after recording the ranks of now.
fn rank_before(event: Uuid, ranks: HashMap<Uuid, i64>, me: Uuid) -> Option<i64> {
    let now = OffsetDateTime::now_utc();
    let mut all = RANKS.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let list = all.entry(event).or_default();
    while list.front().is_some_and(|(at, _)| now - *at > DELTA_WINDOW + Duration::minutes(5)) {
        list.pop_front();
    }
    let before = list
        .iter()
        .find(|(at, _)| now - *at >= DELTA_WINDOW)
        .or(list.front())
        .and_then(|(_, r)| r.get(&me).copied());
    if list.back().is_none_or(|(at, _)| now - *at >= Duration::minutes(1)) {
        list.push_back((now, ranks));
    }
    before
}

/// Live standings: the leaders, my friends, me, and dots for everyone else.
#[utoipa::path(get, path = "/events/{id}/live", tag = "events", security(("bearer" = [])),
    params(("id" = Uuid, Path)), responses((status = 200, body = LiveStandings), (status = 404, body = ErrorBody)))]
async fn live_standings(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<LiveStandings>> {
    tick(&state.db).await?;
    let id = visible_event(&state.db, me, id).await?;
    let event = sqlx::query!(
        "SELECT j.starts_at AS \"starts_at!\", r.distance_m FROM journeys j JOIN routes r ON r.id = j.route_id WHERE j.id = $1",
        id
    )
    .fetch_one(&state.db)
    .await?;
    let rows = sqlx::query!(
        "SELECT u.id, u.first_name, u.username, u.avatar_url, p.distance_m, p.arrived_at, p.rank,
                p.joined_at AS \"joined_at!\",
                EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted'
                  AND ((f.user_id = $2 AND f.friend_id = u.id) OR (f.friend_id = $2 AND f.user_id = u.id))) AS \"friend!\"
         FROM journey_participants p JOIN users u ON u.id = p.user_id
         WHERE p.journey_id = $1 AND p.joined_at IS NOT NULL",
        id,
        me
    )
    .fetch_all(&state.db)
    .await?;
    let mut all: Vec<Standing> = rows
        .into_iter()
        .map(|r| {
            // Late walkers count from the moment they signed up.
            let from = r.joined_at.max(event.starts_at);
            let live = r
                .arrived_at
                .is_none()
                .then(|| state.live.race_position(r.id, Some(from), r.distance_m, event.distance_m))
                .flatten();
            Standing {
                rank: r.rank.map_or(0, i64::from),
                distance_m: live.as_ref().map_or(r.distance_m, |l| l.distance_m),
                speed_kmh: live.map(|l| l.speed_kmh),
                friend: r.friend,
                arrived_at: r.arrived_at,
                walker: Walker {
                    id: r.id,
                    first_name: r.first_name,
                    username: r.username,
                    avatar_url: r.avatar_url,
                },
            }
        })
        .collect();
    // Arrived first, by arrival; then by distance.
    all.sort_by(|a, b| match (a.arrived_at, b.arrived_at) {
        (Some(x), Some(y)) => x.cmp(&y),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => b.distance_m.total_cmp(&a.distance_m),
    });
    for (i, s) in all.iter_mut().enumerate() {
        s.rank = i64::try_from(i).unwrap_or(i64::MAX) + 1;
    }
    let ranks = all.iter().map(|s| (s.walker.id, s.rank)).collect();
    let my_rank_before = rank_before(id, ranks, me);
    let walking_now = i64::try_from(all.iter().filter(|s| s.speed_kmh.is_some()).count()).unwrap_or(0);
    let me_standing = all.iter().find(|s| s.walker.id == me).cloned();
    let leaders: Vec<Standing> = all.iter().take(10).cloned().collect();
    let friends: Vec<Standing> = all.iter().filter(|s| s.friend).cloned().collect();
    let others_m = all
        .iter()
        .skip(10)
        .filter(|s| !s.friend && s.walker.id != me)
        .take(MAX_DOTS)
        .map(|s| s.distance_m)
        .collect();
    Ok(Json(LiveStandings {
        registered: i64::try_from(all.len()).unwrap_or(0),
        walking_now,
        route_distance_m: event.distance_m,
        me: me_standing,
        my_rank_before,
        leaders,
        friends,
        others_m,
    }))
}
