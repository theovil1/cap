//! The activity feed: arrivals, stages, medals and published routes of me, my
//! friends and the walkers I follow, with a word, Bravos and comments.

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{PgConnection, PgPool};
use time::OffsetDateTime;
use utoipa::{IntoParams, ToSchema};
use utoipa_axum::{router::OpenApiRouter, routes};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult, ErrorBody},
    leaderboards::streaks,
    public_routes::Walker,
    state::AppState,
};

/// Distance medals (km) and streak medals (days), as on the medal board.
const DISTANCE_KM: [f64; 4] = [100.0, 500.0, 1_000.0, 5_000.0];
const STREAK_DAYS: [i64; 4] = [7, 30, 100, 365];

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(feed))
        .routes(routes!(edit_post, delete_post))
        .routes(routes!(bravo, unbravo))
        .routes(routes!(list_comments, add_comment))
        .routes(routes!(delete_comment))
}

/// A journey a session counted for, as the feed needs it.
pub struct Passed {
    pub journey_id: Uuid,
    pub arrived: bool,
    /// The last stage this session unlocked on it.
    pub stage_id: Option<Uuid>,
}

async fn insert(
    tx: &mut PgConnection,
    author: Uuid,
    kind: &str,
    journey: Option<Uuid>,
    data: Value,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO posts (id, author_id, kind, journey_id, data) VALUES ($1, $2, $3, $4, $5)",
        Uuid::now_v7(),
        author,
        kind,
        journey,
        data
    )
    .execute(tx)
    .await?;
    Ok(())
}

/// Posts what a session did: arrivals, the last stage passed on each journey,
/// and the distance or streak medals it won.
pub async fn after_session(
    tx: &mut PgConnection,
    user_id: Uuid,
    session_m: f64,
    passed: &[Passed],
) -> AppResult<()> {
    for p in passed {
        let journey = sqlx::query!(
            "SELECT j.kind, j.title, r.distance_m, r.end_lat, r.end_lon, jp.rank,
                    COALESCE(j.starts_at, j.created_at) AS \"started!\",
                    (SELECT name FROM route_stages WHERE route_id = r.id ORDER BY position LIMIT 1) AS start_town,
                    (SELECT name FROM route_stages WHERE route_id = r.id ORDER BY position DESC LIMIT 1) AS end_town,
                    (SELECT count(*) FROM route_stages WHERE route_id = r.id AND position > 0) AS \"stages!\",
                    (SELECT count(*) FROM session_allocations a JOIN sessions s ON s.id = a.session_id
                     WHERE a.journey_id = j.id AND s.user_id = $2 AND a.distance_m > 0) AS \"sessions!\"
             FROM journeys j JOIN routes r ON r.id = j.route_id
             JOIN journey_participants jp ON jp.journey_id = j.id AND jp.user_id = $2
             WHERE j.id = $1",
            p.journey_id,
            user_id
        )
        .fetch_one(&mut *tx)
        .await?;
        let title = journey.title.clone().unwrap_or_else(|| {
            format!(
                "{} → {}",
                journey.start_town.clone().unwrap_or_default(),
                journey.end_town.clone().unwrap_or_default()
            )
        });
        if p.arrived {
            let days = (OffsetDateTime::now_utc() - journey.started).whole_days() + 1;
            let data = json!({ "title": title, "kind": journey.kind, "distance_m": journey.distance_m,
                "sessions": journey.sessions, "days": days, "rank": journey.rank,
                "end_town": journey.end_town, "end": { "lat": journey.end_lat, "lon": journey.end_lon } });
            insert(tx, user_id, "arrived", Some(p.journey_id), data).await?;
        } else if let Some(stage_id) = p.stage_id {
            let stage = sqlx::query!("SELECT name, position FROM route_stages WHERE id = $1", stage_id)
                .fetch_one(&mut *tx)
                .await?;
            let data = json!({ "title": title, "stage": stage.name, "position": stage.position,
                "stages": journey.stages });
            insert(tx, user_id, "stage", Some(p.journey_id), data).await?;
        }
    }
    let days = sqlx::query!(
        "SELECT COALESCE(sum(distance_m), 0) AS \"total_m!\",
                COALESCE(array_agg(DISTINCT (started_at AT TIME ZONE 'Europe/Paris')::date)
                         FILTER (WHERE source = 'treadmill'), '{}') AS \"days!: Vec<time::Date>\",
                (now() AT TIME ZONE 'Europe/Paris')::date AS \"today!\"
         FROM sessions WHERE user_id = $1",
        user_id
    )
    .fetch_one(&mut *tx)
    .await?;
    let (after_km, before_km) = (days.total_m / 1000.0, (days.total_m - session_m) / 1000.0);
    for km in DISTANCE_KM {
        if before_km < km && after_km >= km {
            insert(tx, user_id, "medal", None, json!({ "medal": "distance", "km": km })).await?;
        }
    }
    let (streak, _) = streaks(days.days, days.today);
    if STREAK_DAYS.contains(&streak) {
        let already = sqlx::query_scalar!(
            "SELECT EXISTS (SELECT 1 FROM posts WHERE author_id = $1 AND kind = 'medal'
               AND data->>'medal' = 'streak' AND (data->>'days')::int = $2
               AND created_at > now() - interval '2 days') AS \"e!\"",
            user_id,
            i32::try_from(streak).unwrap_or(0)
        )
        .fetch_one(&mut *tx)
        .await?;
        if !already {
            insert(tx, user_id, "medal", None, json!({ "medal": "streak", "days": streak })).await?;
        }
    }
    Ok(())
}

/// Posts a newly published route.
pub async fn published(
    db: &PgPool,
    author: Uuid,
    public_route_id: Uuid,
    title: &str,
    distance_m: f64,
) -> AppResult<()> {
    let mut conn = db.acquire().await?;
    insert(
        &mut conn,
        author,
        "published",
        None,
        json!({ "public_route_id": public_route_id, "title": title, "distance_m": distance_m }),
    )
    .await
}

#[derive(Serialize, ToSchema)]
pub struct FeedPost {
    id: Uuid,
    author: Walker,
    /// `arrived`, `stage`, `medal` or `published`.
    kind: String,
    /// What the card shows, frozen when it happened.
    #[schema(value_type = Object)]
    data: Value,
    journey_id: Option<Uuid>,
    /// The author's word about it.
    text: Option<String>,
    bravos: i64,
    i_bravo: bool,
    comments: i64,
    mine: bool,
    #[serde(with = "time::serde::rfc3339")]
    created_at: OffsetDateTime,
}

#[derive(Deserialize, IntoParams)]
pub struct FeedQuery {
    /// Posts older than this one (RFC 3339), for the next page.
    #[param(value_type = Option<String>)]
    #[serde(default, with = "time::serde::rfc3339::option")]
    before: Option<OffsetDateTime>,
    limit: Option<i64>,
}

/// Posts of me, my friends and the walkers I follow (a profile for friends
/// only stays among friends), newest first.
#[utoipa::path(get, path = "/feed", tag = "feed", security(("bearer" = [])), params(FeedQuery),
    responses((status = 200, body = Vec<FeedPost>)))]
async fn feed(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Query(query): Query<FeedQuery>,
) -> AppResult<Json<Vec<FeedPost>>> {
    let ids = sqlx::query_scalar!(
        "WITH friends AS (
             SELECT CASE WHEN user_id = $1 THEN friend_id ELSE user_id END AS id FROM friendships
             WHERE status = 'accepted' AND (user_id = $1 OR friend_id = $1))
         SELECT p.id FROM posts p JOIN users u ON u.id = p.author_id
         WHERE NOT p.hidden
           AND (p.author_id = $1 OR p.author_id IN (SELECT id FROM friends)
                OR (u.visibility = 'everyone' AND EXISTS (
                    SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = p.author_id)))
           AND ($2::timestamptz IS NULL OR p.created_at < $2)
         ORDER BY p.created_at DESC LIMIT $3",
        me,
        query.before,
        query.limit.unwrap_or(20).clamp(1, 50)
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(posts(&state.db, me, &ids).await?))
}

async fn posts(db: &PgPool, me: Uuid, ids: &[Uuid]) -> AppResult<Vec<FeedPost>> {
    let mut rows: Vec<FeedPost> = sqlx::query!(
        "SELECT p.id, p.kind, p.data, p.journey_id, p.text, p.created_at,
                u.id AS author_id, u.first_name, u.username, u.avatar_url,
                (SELECT count(*) FROM bravos b WHERE b.post_id = p.id) AS \"bravos!\",
                EXISTS (SELECT 1 FROM bravos b WHERE b.post_id = p.id AND b.user_id = $2) AS \"i_bravo!\",
                (SELECT count(*) FROM comments c WHERE c.post_id = p.id AND NOT c.hidden) AS \"comments!\"
         FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ANY($1)",
        ids,
        me
    )
    .fetch_all(db)
    .await?
    .into_iter()
    .map(|r| FeedPost {
        mine: r.author_id == me,
        author: Walker {
            id: r.author_id,
            first_name: r.first_name,
            username: r.username,
            avatar_url: r.avatar_url,
        },
        id: r.id,
        kind: r.kind,
        data: r.data,
        journey_id: r.journey_id,
        text: r.text,
        bravos: r.bravos,
        i_bravo: r.i_bravo,
        comments: r.comments,
        created_at: r.created_at,
    })
    .collect();
    rows.sort_by_key(|p| ids.iter().position(|id| *id == p.id));
    Ok(rows)
}

/// Whether the current user may see a post (same rule as the feed).
async fn visible(db: &PgPool, me: Uuid, post: Uuid) -> AppResult<()> {
    let ok = sqlx::query_scalar!(
        "SELECT EXISTS (SELECT 1 FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = $2 AND NOT p.hidden
           AND (p.author_id = $1 OR EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted'
                AND ((f.user_id = $1 AND f.friend_id = p.author_id) OR (f.friend_id = $1 AND f.user_id = p.author_id)))
                OR (u.visibility = 'everyone' AND EXISTS (
                    SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = p.author_id))))
         AS \"ok!\"",
        me,
        post
    )
    .fetch_one(db)
    .await?;
    if ok { Ok(()) } else { Err(AppError::not_found("post not found")) }
}

#[derive(Deserialize, ToSchema)]
pub struct EditPost {
    /// A word about it, 280 characters at most; empty removes it.
    text: String,
}

/// Add or change the author's word on a post.
#[utoipa::path(patch, path = "/posts/{id}", tag = "feed", security(("bearer" = [])), params(("id" = Uuid, Path)),
    request_body = EditPost, responses((status = 200, body = FeedPost), (status = 400, body = ErrorBody), (status = 404, body = ErrorBody)))]
async fn edit_post(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<EditPost>,
) -> AppResult<Json<FeedPost>> {
    let text = body.text.trim();
    if text.chars().count() > 280 {
        return Err(AppError::bad_request("invalid_text", "280 characters at most"));
    }
    let updated =
        sqlx::query!("UPDATE posts SET text = NULLIF($3, '') WHERE id = $1 AND author_id = $2", id, me, text)
            .execute(&state.db)
            .await?;
    if updated.rows_affected() == 0 {
        return Err(AppError::not_found("post not found"));
    }
    posts(&state.db, me, &[id]).await?.pop().map(Json).ok_or_else(|| AppError::not_found("post not found"))
}

/// Delete one of my posts.
#[utoipa::path(delete, path = "/posts/{id}", tag = "feed", security(("bearer" = [])), params(("id" = Uuid, Path)),
    responses((status = 204), (status = 404, body = ErrorBody)))]
async fn delete_post(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let deleted =
        sqlx::query!("DELETE FROM posts WHERE id = $1 AND author_id = $2", id, me).execute(&state.db).await?;
    if deleted.rows_affected() == 0 {
        return Err(AppError::not_found("post not found"));
    }
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize, ToSchema)]
pub struct BravoCount {
    bravos: i64,
    i_bravo: bool,
}

async fn bravo_count(db: &PgPool, me: Uuid, id: Uuid) -> AppResult<BravoCount> {
    let r = sqlx::query!(
        "SELECT count(*) AS \"bravos!\", bool_or(user_id = $2) AS i_bravo FROM bravos WHERE post_id = $1",
        id,
        me
    )
    .fetch_one(db)
    .await?;
    Ok(BravoCount { bravos: r.bravos, i_bravo: r.i_bravo.unwrap_or(false) })
}

/// Say Bravo.
#[utoipa::path(post, path = "/posts/{id}/bravo", tag = "feed", security(("bearer" = [])), params(("id" = Uuid, Path)),
    responses((status = 200, body = BravoCount), (status = 404, body = ErrorBody)))]
async fn bravo(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<BravoCount>> {
    visible(&state.db, me, id).await?;
    sqlx::query!("INSERT INTO bravos (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", id, me)
        .execute(&state.db)
        .await?;
    Ok(Json(bravo_count(&state.db, me, id).await?))
}

/// Take a Bravo back.
#[utoipa::path(delete, path = "/posts/{id}/bravo", tag = "feed", security(("bearer" = [])), params(("id" = Uuid, Path)),
    responses((status = 200, body = BravoCount)))]
async fn unbravo(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<BravoCount>> {
    sqlx::query!("DELETE FROM bravos WHERE post_id = $1 AND user_id = $2", id, me).execute(&state.db).await?;
    Ok(Json(bravo_count(&state.db, me, id).await?))
}

#[derive(Serialize, ToSchema)]
pub struct Comment {
    id: Uuid,
    author: Walker,
    text: String,
    mine: bool,
    #[serde(with = "time::serde::rfc3339")]
    created_at: OffsetDateTime,
}

/// Comments of a post, oldest first.
#[utoipa::path(get, path = "/posts/{id}/comments", tag = "feed", security(("bearer" = [])), params(("id" = Uuid, Path)),
    responses((status = 200, body = Vec<Comment>), (status = 404, body = ErrorBody)))]
async fn list_comments(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Vec<Comment>>> {
    visible(&state.db, me, id).await?;
    let rows = sqlx::query!(
        "SELECT c.id, c.text, c.created_at, u.id AS author_id, u.first_name, u.username, u.avatar_url
         FROM comments c JOIN users u ON u.id = c.author_id
         WHERE c.post_id = $1 AND NOT c.hidden ORDER BY c.created_at",
        id
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(
        rows.into_iter()
            .map(|r| Comment {
                mine: r.author_id == me,
                author: Walker {
                    id: r.author_id,
                    first_name: r.first_name,
                    username: r.username,
                    avatar_url: r.avatar_url,
                },
                id: r.id,
                text: r.text,
                created_at: r.created_at,
            })
            .collect(),
    ))
}

#[derive(Deserialize, ToSchema)]
pub struct NewComment {
    text: String,
}

/// Comment a post.
#[utoipa::path(post, path = "/posts/{id}/comments", tag = "feed", security(("bearer" = [])), params(("id" = Uuid, Path)),
    request_body = NewComment, responses((status = 201, body = Vec<Comment>), (status = 400, body = ErrorBody), (status = 404, body = ErrorBody)))]
async fn add_comment(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<NewComment>,
) -> AppResult<(StatusCode, Json<Vec<Comment>>)> {
    let text = body.text.trim();
    if text.is_empty() || text.chars().count() > 500 {
        return Err(AppError::bad_request("invalid_text", "1 to 500 characters"));
    }
    visible(&state.db, me, id).await?;
    sqlx::query!(
        "INSERT INTO comments (id, post_id, author_id, text) VALUES ($1, $2, $3, $4)",
        Uuid::now_v7(),
        id,
        me,
        text
    )
    .execute(&state.db)
    .await?;
    let Json(list) = list_comments(State(state), AuthUser(me), Path(id)).await?;
    Ok((StatusCode::CREATED, Json(list)))
}

/// Delete a comment: its author, or the author of the post.
#[utoipa::path(delete, path = "/comments/{id}", tag = "feed", security(("bearer" = [])), params(("id" = Uuid, Path)),
    responses((status = 204), (status = 404, body = ErrorBody)))]
async fn delete_comment(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let deleted = sqlx::query!(
        "DELETE FROM comments c USING posts p WHERE c.id = $1 AND p.id = c.post_id AND (c.author_id = $2 OR p.author_id = $2)",
        id,
        me
    )
    .execute(&state.db)
    .await?;
    if deleted.rows_affected() == 0 {
        return Err(AppError::not_found("comment not found"));
    }
    Ok(StatusCode::NO_CONTENT)
}
