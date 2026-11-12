//! Public profiles of walkers, and following (one way, besides friends).

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde::Serialize;
use time::{Date, OffsetDateTime};
use utoipa::ToSchema;
use utoipa_axum::{router::OpenApiRouter, routes};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    badges::{Badge, badges_of},
    error::{AppError, AppResult, ErrorBody},
    geo::Place,
    leaderboards::streaks,
    public_routes::Walker,
    state::AppState,
};

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(get_profile)).routes(routes!(follow, unfollow))
}

/// A journey a walker finished: a medal on their profile.
#[derive(Serialize, ToSchema)]
pub struct FinishedJourney {
    id: Uuid,
    /// `solo`, `race` or `event`.
    kind: String,
    title: Option<String>,
    start: Place,
    end: Place,
    start_town: Option<String>,
    end_town: Option<String>,
    route_distance_m: f64,
    #[serde(with = "time::serde::rfc3339")]
    arrived_at: OffsetDateTime,
    /// Arrival order in a race or a scheduled journey.
    rank: Option<i32>,
}

/// The journey a walker is on.
#[derive(Serialize, ToSchema)]
pub struct UnderWay {
    id: Uuid,
    title: Option<String>,
    start: Place,
    end: Place,
    start_town: Option<String>,
    end_town: Option<String>,
    distance_m: f64,
    route_distance_m: f64,
    /// Route geometry: `[lon, lat, cumulative_m]` points.
    #[schema(value_type = Vec<[f64; 3]>)]
    path: serde_json::Value,
}

#[derive(Serialize, ToSchema)]
pub struct PublicProfile {
    walker: Walker,
    /// Rarest first; only `certified` goes next to the name.
    badges: Vec<Badge>,
    home_city: Option<String>,
    country: String,
    #[serde(with = "time::serde::rfc3339")]
    created_at: OffsetDateTime,
    total_m: f64,
    finished: i64,
    best_streak: i64,
    streak: i64,
    followers: i64,
    following: i64,
    /// `me`, `friend`, `incoming` (they asked me), `outgoing` (I asked them) or `none`.
    relation: String,
    i_follow: bool,
    follows_me: bool,
    /// Friends we have in common.
    mutual_friends: i64,
    /// A few of them, for "Nadia, Marc and 10 others".
    mutual_names: Vec<String>,
    journeys: Vec<FinishedJourney>,
    /// Hidden from walkers who are not friends when the profile is for friends only.
    under_way: Option<UnderWay>,
}

/// A walker's public profile: numbers, finished journeys, the journey under way.
#[utoipa::path(get, path = "/users/{id}/profile", tag = "profiles", security(("bearer" = [])),
    params(("id" = Uuid, Path)), responses((status = 200, body = PublicProfile), (status = 404, body = ErrorBody)))]
async fn get_profile(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<PublicProfile>> {
    let db = &state.db;
    let user = sqlx::query!(
        "SELECT u.id, u.first_name, u.username, u.avatar_url, u.home_city, u.country, u.visibility, u.created_at,
                COALESCE((SELECT sum(distance_m) FROM sessions WHERE user_id = u.id), 0) AS \"total_m!\",
                (SELECT count(*) FROM follows WHERE followee_id = u.id) AS \"followers!\",
                (SELECT count(*) FROM follows WHERE follower_id = u.id) AS \"following!\",
                EXISTS (SELECT 1 FROM follows WHERE follower_id = $2 AND followee_id = u.id) AS \"i_follow!\",
                EXISTS (SELECT 1 FROM follows WHERE follower_id = u.id AND followee_id = $2) AS \"follows_me!\",
                (SELECT CASE WHEN f.status = 'accepted' THEN 'friend'
                             WHEN f.user_id = $2 THEN 'outgoing' ELSE 'incoming' END
                 FROM friendships f
                 WHERE (f.user_id = $2 AND f.friend_id = u.id) OR (f.friend_id = $2 AND f.user_id = u.id)) AS relation,
                (SELECT COALESCE(array_agg(DISTINCT (s.started_at AT TIME ZONE 'Europe/Paris')::date), '{}')
                 FROM sessions s WHERE s.user_id = u.id AND s.source = 'treadmill') AS \"days!: Vec<Date>\",
                (now() AT TIME ZONE 'Europe/Paris')::date AS \"today!\"
         FROM users u WHERE u.id = $1",
        id,
        me
    )
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::not_found("walker not found"))?;
    let relation =
        if id == me { "me".to_owned() } else { user.relation.unwrap_or_else(|| "none".to_owned()) };
    let (streak, best_streak) = streaks(user.days, user.today);

    let mutual = sqlx::query_scalar!(
        "WITH mine AS (
             SELECT CASE WHEN user_id = $1 THEN friend_id ELSE user_id END AS id FROM friendships
             WHERE status = 'accepted' AND (user_id = $1 OR friend_id = $1)),
         theirs AS (
             SELECT CASE WHEN user_id = $2 THEN friend_id ELSE user_id END AS id FROM friendships
             WHERE status = 'accepted' AND (user_id = $2 OR friend_id = $2))
         SELECT u.first_name FROM users u JOIN mine USING (id) JOIN theirs USING (id) ORDER BY lower(u.first_name)",
        me,
        id
    )
    .fetch_all(db)
    .await?;

    let journeys = finished_journeys(db, id).await?;

    let private = user.visibility == "friends" && relation != "friend" && relation != "me";
    let under_way = if private { None } else { under_way(db, id).await? };

    let badges = badges_of(db, &[id]).await?.pop().map(|(_, b)| b).unwrap_or_default();
    Ok(Json(PublicProfile {
        badges,
        walker: Walker {
            id: user.id,
            first_name: user.first_name,
            username: user.username,
            avatar_url: user.avatar_url,
        },
        home_city: user.home_city,
        country: user.country,
        created_at: user.created_at,
        total_m: user.total_m,
        finished: i64::try_from(journeys.len()).unwrap_or(0),
        best_streak,
        streak,
        followers: user.followers,
        following: user.following,
        relation,
        i_follow: user.i_follow,
        follows_me: user.follows_me,
        mutual_friends: i64::try_from(mutual.len()).unwrap_or(0),
        mutual_names: mutual.into_iter().take(2).collect(),
        journeys,
        under_way,
    }))
}

async fn finished_journeys(db: &sqlx::PgPool, id: Uuid) -> AppResult<Vec<FinishedJourney>> {
    Ok(sqlx::query!(
        "SELECT j.id, j.kind, j.title, p.arrived_at AS \"arrived_at!\", p.rank, r.distance_m,
                r.start_label, r.start_lat, r.start_lon, r.end_label, r.end_lat, r.end_lon,
                (SELECT name FROM route_stages WHERE route_id = r.id ORDER BY position LIMIT 1) AS start_town,
                (SELECT name FROM route_stages WHERE route_id = r.id ORDER BY position DESC LIMIT 1) AS end_town
         FROM journey_participants p JOIN journeys j ON j.id = p.journey_id JOIN routes r ON r.id = j.route_id
         WHERE p.user_id = $1 AND p.arrived_at IS NOT NULL
         ORDER BY p.arrived_at DESC",
        id
    )
    .fetch_all(db)
    .await?
    .into_iter()
    .map(|r| FinishedJourney {
        id: r.id,
        kind: r.kind,
        title: r.title,
        start: Place { label: r.start_label, lat: r.start_lat, lon: r.start_lon },
        end: Place { label: r.end_label, lat: r.end_lat, lon: r.end_lon },
        start_town: r.start_town.filter(|t| !t.is_empty()),
        end_town: r.end_town.filter(|t| !t.is_empty()),
        route_distance_m: r.distance_m,
        arrived_at: r.arrived_at,
        rank: r.rank,
    })
    .collect())
}

async fn under_way(db: &sqlx::PgPool, id: Uuid) -> AppResult<Option<UnderWay>> {
    Ok(sqlx::query!(
        "SELECT j.id, j.title, p.distance_m, r.distance_m AS route_distance_m, r.path,
                r.start_label, r.start_lat, r.start_lon, r.end_label, r.end_lat, r.end_lon,
                (SELECT name FROM route_stages WHERE route_id = r.id ORDER BY position LIMIT 1) AS start_town,
                (SELECT name FROM route_stages WHERE route_id = r.id ORDER BY position DESC LIMIT 1) AS end_town
         FROM journey_participants p JOIN journeys j ON j.id = p.journey_id JOIN routes r ON r.id = j.route_id
         WHERE p.user_id = $1 AND j.status = 'active' AND p.joined_at IS NOT NULL AND p.arrived_at IS NULL
         ORDER BY j.created_at DESC LIMIT 1",
        id
    )
    .fetch_optional(db)
    .await?
    .map(|r| UnderWay {
        id: r.id,
        title: r.title,
        start: Place { label: r.start_label, lat: r.start_lat, lon: r.start_lon },
        end: Place { label: r.end_label, lat: r.end_lat, lon: r.end_lon },
        start_town: r.start_town.filter(|t| !t.is_empty()),
        end_town: r.end_town.filter(|t| !t.is_empty()),
        distance_m: r.distance_m,
        route_distance_m: r.route_distance_m,
        path: r.path,
    }))
}

/// Follow a walker.
#[utoipa::path(post, path = "/users/{id}/follow", tag = "profiles", security(("bearer" = [])),
    params(("id" = Uuid, Path)), responses((status = 204), (status = 400, body = ErrorBody), (status = 404, body = ErrorBody)))]
async fn follow(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    if id == me {
        return Err(AppError::bad_request("self_follow", "you cannot follow yourself"));
    }
    let inserted = sqlx::query!(
        "INSERT INTO follows (follower_id, followee_id) SELECT $1, id FROM users WHERE id = $2 ON CONFLICT DO NOTHING",
        me,
        id
    )
    .execute(&state.db)
    .await?;
    let exists = inserted.rows_affected() > 0
        || sqlx::query_scalar!("SELECT EXISTS (SELECT 1 FROM users WHERE id = $1) AS \"e!\"", id)
            .fetch_one(&state.db)
            .await?;
    if !exists {
        return Err(AppError::not_found("walker not found"));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Stop following a walker.
#[utoipa::path(delete, path = "/users/{id}/follow", tag = "profiles", security(("bearer" = [])),
    params(("id" = Uuid, Path)), responses((status = 204)))]
async fn unfollow(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    sqlx::query!("DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2", me, id)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
