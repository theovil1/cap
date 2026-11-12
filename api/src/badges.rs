//! Profile badges: a role or a status. Admins give some (team, certified,
//! developer, GitHub contributor, supporter, beta tester, moderator, club);
//! the others follow from what walkers did and are worked out when asked.

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use time::{Date, Month};
use utoipa::ToSchema;
use utoipa_axum::{router::OpenApiRouter, routes};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult, ErrorBody},
    state::AppState,
};

/// Badges admins give.
pub const MANUAL: [&str; 8] =
    ["team", "certified", "developer", "github", "supporter", "beta", "moderator", "club"];
/// Rarest first: the feed shows the first one a walker has.
const RARITY: [&str; 12] = [
    "team",
    "developer",
    "moderator",
    "github",
    "club",
    "certified",
    "supporter",
    "founder",
    "organizer",
    "creator",
    "ambassador",
    "beta",
];
/// Accounts opened before this day are founding members (the public launch).
const LAUNCH: (i32, Month, u8) = (2027, Month::March, 1);
const ORGANIZER_EVENTS: i64 = 3;
const CREATOR_WALKERS: i64 = 1_000;
const AMBASSADOR_INVITES: i64 = 10;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(grant, revoke))
}

#[derive(Serialize, ToSchema, Clone, Debug, PartialEq, Eq)]
pub struct Badge {
    /// `team`, `certified`, `developer`, `github`, `supporter`, `beta`, `moderator`,
    /// `club`, `founder`, `organizer`, `creator` or `ambassador`.
    pub kind: String,
    /// Supporter level: 1 Soutien, 2 Grand soutien, 3 Mécène.
    pub tier: Option<i16>,
}

/// The badges of each walker, rarest first.
pub async fn badges_of(db: &PgPool, users: &[Uuid]) -> AppResult<Vec<(Uuid, Vec<Badge>)>> {
    let launch = Date::from_calendar_date(LAUNCH.0, LAUNCH.1, LAUNCH.2).map_err(AppError::internal)?;
    let rows = sqlx::query!(
        "SELECT u.id,
                COALESCE((SELECT array_agg(b.badge) FROM user_badges b WHERE b.user_id = u.id), '{}') AS \"manual!\",
                (SELECT b.tier FROM user_badges b WHERE b.user_id = u.id AND b.badge = 'supporter') AS tier,
                (u.created_at AT TIME ZONE 'Europe/Paris')::date < $2 AS \"founder!\",
                (SELECT count(*) FROM journeys j WHERE j.created_by = u.id AND j.kind = 'event') AS \"events!\",
                (SELECT count(DISTINCT jp.user_id) FROM public_routes p
                 JOIN journeys j ON j.public_route_id = p.id
                 JOIN journey_participants jp ON jp.journey_id = j.id
                 WHERE p.author_id = u.id AND jp.user_id <> u.id) AS \"route_walkers!\",
                (SELECT count(*) FROM friendships f WHERE f.friend_id = u.id AND f.via_invite) AS \"invited!\"
         FROM users u WHERE u.id = ANY($1)",
        users,
        launch
    )
    .fetch_all(db)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| {
            let mut kinds: Vec<&str> = r.manual.iter().map(String::as_str).collect();
            if r.founder {
                kinds.push("founder");
            }
            if r.events >= ORGANIZER_EVENTS {
                kinds.push("organizer");
            }
            if r.route_walkers >= CREATOR_WALKERS {
                kinds.push("creator");
            }
            if r.invited >= AMBASSADOR_INVITES {
                kinds.push("ambassador");
            }
            kinds.sort_by_key(|k| RARITY.iter().position(|x| x == k).unwrap_or(RARITY.len()));
            let badges = kinds
                .into_iter()
                .map(|k| Badge { tier: (k == "supporter").then_some(r.tier).flatten(), kind: k.to_owned() })
                .collect();
            (r.id, badges)
        })
        .collect())
}

#[derive(Deserialize, ToSchema)]
pub struct Grant {
    /// Supporter level (1 to 3); ignored for other badges.
    tier: Option<i16>,
}

async fn require_admin(db: &PgPool, me: Uuid) -> AppResult<()> {
    let admin =
        sqlx::query_scalar!("SELECT is_admin FROM users WHERE id = $1", me).fetch_optional(db).await?;
    if admin == Some(true) {
        Ok(())
    } else {
        Err(AppError::new(StatusCode::FORBIDDEN, "forbidden", "admins only"))
    }
}

/// Admins: give a badge.
#[utoipa::path(put, path = "/admin/users/{id}/badges/{badge}", tag = "badges", security(("bearer" = [])),
    params(("id" = Uuid, Path), ("badge" = String, Path)), request_body = Grant,
    responses((status = 204), (status = 400, body = ErrorBody), (status = 403, body = ErrorBody), (status = 404, body = ErrorBody)))]
async fn grant(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path((id, badge)): Path<(Uuid, String)>,
    Json(body): Json<Grant>,
) -> AppResult<StatusCode> {
    require_admin(&state.db, me).await?;
    if !MANUAL.contains(&badge.as_str()) {
        return Err(AppError::bad_request("invalid_badge", "this badge is not given by hand"));
    }
    let tier = if badge == "supporter" { Some(body.tier.unwrap_or(1).clamp(1, 3)) } else { None };
    let saved = sqlx::query!(
        "INSERT INTO user_badges (user_id, badge, tier) SELECT id, $2, $3 FROM users WHERE id = $1
         ON CONFLICT (user_id, badge) DO UPDATE SET tier = $3",
        id,
        badge,
        tier
    )
    .execute(&state.db)
    .await?;
    if saved.rows_affected() == 0 {
        return Err(AppError::not_found("walker not found"));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Admins: take a badge back.
#[utoipa::path(delete, path = "/admin/users/{id}/badges/{badge}", tag = "badges", security(("bearer" = [])),
    params(("id" = Uuid, Path), ("badge" = String, Path)),
    responses((status = 204), (status = 403, body = ErrorBody)))]
async fn revoke(
    State(state): State<AppState>,
    AuthUser(me): AuthUser,
    Path((id, badge)): Path<(Uuid, String)>,
) -> AppResult<StatusCode> {
    require_admin(&state.db, me).await?;
    sqlx::query!("DELETE FROM user_badges WHERE user_id = $1 AND badge = $2", id, badge)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
