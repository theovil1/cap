//! Posting a session in the feed, with the stretch of route it covered.

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::PgPool;
use utoipa::ToSchema;
use utoipa_axum::{router::OpenApiRouter, routes};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult, ErrorBody},
    feed::{FeedPost, posts},
    state::AppState,
};

/// Points kept for each line of the card's map.
const MAX_POINTS: usize = 120;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(preview_session, post_session))
}

#[derive(Deserialize, ToSchema)]
pub struct NewSessionPost {
    /// A word about it, 280 characters at most.
    text: Option<String>,
    /// `friends` (friends only) or `all` (friends and followers).
    audience: String,
}

/// Post one of my sessions in the feed (once): its distance, time and the
/// stretch of route it covered on the journey it counted for.
#[utoipa::path(post, path = "/sessions/{id}/post", tag = "feed", security(("bearer" = [])),
    params(("id" = Uuid, Path)), request_body = NewSessionPost,
    responses((status = 201, body = FeedPost), (status = 400, body = ErrorBody), (status = 404, body = ErrorBody),
              (status = 409, body = ErrorBody)))]
async fn post_session(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<NewSessionPost>,
) -> AppResult<(StatusCode, Json<FeedPost>)> {
    if !matches!(body.audience.as_str(), "friends" | "all") {
        return Err(AppError::bad_request("invalid_audience", "audience is friends or all"));
    }
    let text = body.text.as_deref().map(str::trim).filter(|t| !t.is_empty());
    if text.is_some_and(|t| t.chars().count() > 280) {
        return Err(AppError::bad_request("invalid_text", "280 characters at most"));
    }
    let (data, journey) = card_data(&state.db, me, id).await?;
    let post_id = Uuid::now_v7();
    let inserted = sqlx::query!(
        "INSERT INTO posts (id, author_id, kind, journey_id, data, text, session_id, audience)
         VALUES ($1, $2, 'session', $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING",
        post_id,
        me,
        journey,
        data,
        text,
        id,
        body.audience
    )
    .execute(&state.db)
    .await?;
    if inserted.rows_affected() == 0 {
        return Err(AppError::conflict("already_posted", "this session is already in the feed"));
    }
    let post =
        posts(&state.db, me, &[post_id]).await?.pop().ok_or_else(|| AppError::not_found("post not found"))?;
    Ok((StatusCode::CREATED, Json(post)))
}

/// What the card shows: the session's figures and, on the journey it counted
/// for (a solo one first), the stretch of route it covered.
async fn card_data(db: &PgPool, me: Uuid, id: Uuid) -> AppResult<(Value, Option<Uuid>)> {
    let session = sqlx::query!(
        "SELECT distance_m, duration_s, started_at, steps FROM sessions WHERE id = $1 AND user_id = $2",
        id,
        me
    )
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::not_found("session not found"))?;

    // The journey it counted for (a solo one first), and where on it the walk began.
    let journey = sqlx::query!(
        "SELECT j.id, j.kind, j.title, r.path, r.distance_m AS route_m, a.distance_m AS added_m,
                (SELECT name FROM route_stages WHERE route_id = r.id ORDER BY position LIMIT 1) AS start_town,
                (SELECT name FROM route_stages WHERE route_id = r.id ORDER BY position DESC LIMIT 1) AS end_town,
                (SELECT COALESCE(sum(b.distance_m), 0) FROM session_allocations b JOIN sessions s ON s.id = b.session_id
                 WHERE b.journey_id = j.id AND s.started_at < $2) AS \"before_m!\"
         FROM session_allocations a JOIN journeys j ON j.id = a.journey_id JOIN routes r ON r.id = j.route_id
         WHERE a.session_id = $1
         ORDER BY (j.kind = 'solo') DESC, a.distance_m DESC LIMIT 1",
        id,
        session.started_at
    )
    .fetch_optional(db)
    .await?;

    let mut data = json!({
        "distance_m": session.distance_m,
        "duration_s": session.duration_s,
        "steps": session.steps,
        "started_at": session.started_at.unix_timestamp(),
    });
    if let Some(j) = &journey {
        let path: Vec<[f64; 3]> = serde_json::from_value(j.path.clone()).unwrap_or_default();
        let from = j.before_m.min(j.route_m);
        let to = (from + j.added_m).min(j.route_m);
        let ahead = (to + (to - from).max(500.0) * 2.0).min(j.route_m);
        data["journey"] = json!({
            "title": j.title.clone().unwrap_or_else(|| format!(
                "{} → {}",
                j.start_town.clone().unwrap_or_default(),
                j.end_town.clone().unwrap_or_default()
            )),
            "kind": j.kind,
            "from_m": from,
            "to_m": to,
            "route_m": j.route_m,
            "walked": slice(&path, from, to),
            "ahead": slice(&path, to, ahead),
        });
    }

    Ok((data, journey.map(|j| j.id)))
}

/// What posting this session would show, for the preview before posting.
#[utoipa::path(get, path = "/sessions/{id}/post", tag = "feed", security(("bearer" = [])),
    params(("id" = Uuid, Path)), responses((status = 200, body = Object), (status = 404, body = ErrorBody)))]
async fn preview_session(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    Ok(Json(card_data(&state.db, me, id).await?.0))
}

/// The `[lon, lat]` points of a route between two distances, ends included,
/// thinned to at most `MAX_POINTS`.
fn slice(path: &[[f64; 3]], from: f64, to: f64) -> Vec<[f64; 2]> {
    if path.len() < 2 || to <= from {
        return Vec::new();
    }
    let at = |m: f64| -> [f64; 2] {
        let i = path.partition_point(|p| p[2] < m).clamp(1, path.len() - 1);
        let (a, b) = (path[i - 1], path[i]);
        let span = b[2] - a[2];
        let k = if span > 0.0 { ((m - a[2]) / span).clamp(0.0, 1.0) } else { 0.0 };
        [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
    };
    let mut points = vec![at(from)];
    points.extend(path.iter().filter(|p| p[2] > from && p[2] < to).map(|p| [p[0], p[1]]));
    points.push(at(to));
    if points.len() > MAX_POINTS {
        let last = points.len() - 1;
        points = (0..MAX_POINTS).map(|i| points[i * last / (MAX_POINTS - 1)]).collect();
    }
    points
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slices_keep_their_ends() {
        let path = [[0.0, 0.0, 0.0], [1.0, 0.0, 100.0], [2.0, 0.0, 200.0]];
        assert_eq!(slice(&path, 50.0, 150.0), vec![[0.5, 0.0], [1.0, 0.0], [1.5, 0.0]]);
        assert_eq!(slice(&path, 150.0, 150.0), Vec::<[f64; 2]>::new());
        let long: Vec<[f64; 3]> = (0..1000).map(|i| [f64::from(i), 0.0, f64::from(i)]).collect();
        let thin = slice(&long, 0.0, 999.0);
        assert_eq!(thin.len(), MAX_POINTS);
        assert_eq!(thin.first(), Some(&[0.0, 0.0]));
        assert_eq!(thin.last(), Some(&[999.0, 0.0]));
    }
}
