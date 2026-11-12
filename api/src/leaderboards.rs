//! Leaderboards: km of the week, of the month or of all time, and streaks of
//! active days, between friends, in my country or in the world. Weeks start
//! on Monday and days follow Paris time (specification). Profiles for friends
//! only stay out of the country and world rankings; there, only treadmill
//! sessions count.

use axum::{
    Json,
    extract::{Query, State},
};
use serde::{Deserialize, Serialize};
use time::{Date, Duration, Month};
use utoipa::{IntoParams, ToSchema};
use utoipa_axum::{router::OpenApiRouter, routes};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult, ErrorBody},
    state::AppState,
};

/// Rows sent for the country and the world (me always comes on top of them).
const TOP: usize = 50;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(get_leaderboard))
}

#[derive(Deserialize, IntoParams)]
pub struct LeaderboardQuery {
    /// `week`, `month`, `all` or `streak`.
    period: String,
    /// `friends` (default), `country` or `world`.
    scope: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct Leaderboard {
    period: String,
    scope: String,
    /// First and last day of the week or month (`YYYY-MM-DD`, Paris time); today otherwise.
    starts_on: String,
    ends_on: String,
    /// Walkers ranked (who walked in the period, and me).
    total: usize,
    /// My country (ISO code), for the `country` scope.
    country: String,
    /// Best first; ties share a rank. The first fifty for the country and the world.
    entries: Vec<LeaderboardEntry>,
    /// My row, even when I am not in `entries`.
    me: Option<LeaderboardEntry>,
    /// My rank over the previous week or month, to show the places won.
    previous_rank: Option<usize>,
}

#[derive(Serialize, ToSchema, Clone)]
pub struct LeaderboardEntry {
    rank: usize,
    user_id: Uuid,
    first_name: String,
    username: String,
    avatar_url: Option<String>,
    country: String,
    /// The current user.
    me: bool,
    /// Metres walked (week, month, all) or days in a row (streak).
    value: f64,
    /// Longest streak ever, in days (streak only).
    best: Option<i64>,
}

/// Ranks best first, ties sharing a rank.
fn ranked(mut entries: Vec<LeaderboardEntry>) -> Vec<LeaderboardEntry> {
    entries.sort_by(|a, b| b.value.total_cmp(&a.value).then_with(|| a.first_name.cmp(&b.first_name)));
    let values: Vec<f64> = entries.iter().map(|e| e.value).collect();
    for entry in &mut entries {
        entry.rank = 1 + values.iter().filter(|&&v| v > entry.value).count();
    }
    entries
}

/// The current user ranked with their friends, their country or the world.
#[utoipa::path(get, path = "/leaderboards", tag = "leaderboards", security(("bearer" = [])),
    params(LeaderboardQuery),
    responses((status = 200, body = Leaderboard), (status = 400, body = ErrorBody)))]
async fn get_leaderboard(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Query(query): Query<LeaderboardQuery>,
) -> AppResult<Json<Leaderboard>> {
    let scope = query.scope.clone().unwrap_or_else(|| "friends".to_owned());
    if !["friends", "country", "world"].contains(&scope.as_str()) {
        return Err(AppError::bad_request("invalid_scope", "scope must be friends, country or world"));
    }
    let context = sqlx::query!(
        "SELECT (now() AT TIME ZONE 'Europe/Paris')::date AS \"today!\", country FROM users WHERE id = $1",
        user_id
    )
    .fetch_one(&state.db)
    .await?;
    let today = context.today;
    let (starts_on, ends_on, previous) = match query.period.as_str() {
        "week" => {
            let start = today - Duration::days(i64::from(today.weekday().number_days_from_monday()));
            (start, start + Duration::days(6), Some(start - Duration::days(7)))
        }
        "month" => {
            let start = today.replace_day(1).map_err(AppError::internal)?;
            let before = (start - Duration::days(1)).replace_day(1).map_err(AppError::internal)?;
            (start, last_day_of_month(start), Some(before))
        }
        "all" | "streak" => (today, today, None),
        _ => {
            return Err(AppError::bad_request("invalid_period", "period must be week, month, all or streak"));
        }
    };
    let entries = match query.period.as_str() {
        "streak" => streak_entries(&state, user_id, &scope, today).await?,
        "all" => distances(&state, user_id, &scope, None, None).await?,
        _ => distances(&state, user_id, &scope, Some(starts_on), None).await?,
    };
    let entries = ranked(entries);
    let previous_rank = match previous {
        Some(from) => ranked(distances(&state, user_id, &scope, Some(from), Some(starts_on)).await?)
            .iter()
            .find(|e| e.me && e.value > 0.0)
            .map(|e| e.rank),
        None => None,
    };
    let me = entries.iter().find(|e| e.me).cloned();
    let total = entries.len();
    let entries = if scope == "friends" { entries } else { entries.into_iter().take(TOP).collect() };
    Ok(Json(Leaderboard {
        period: query.period,
        scope,
        starts_on: starts_on.to_string(),
        ends_on: ends_on.to_string(),
        total,
        country: context.country,
        entries,
        me,
        previous_rank,
    }))
}

/// Metres walked between two Paris dates (all time without them) by the
/// walkers of the scope; walkers who did not walk are left out, except me.
async fn distances(
    state: &AppState,
    user_id: Uuid,
    scope: &str,
    since: Option<Date>,
    until: Option<Date>,
) -> AppResult<Vec<LeaderboardEntry>> {
    let rows = sqlx::query!(
        "WITH members AS (
             SELECT u.id FROM users u
             WHERE u.id = $1
                OR ($2 = 'friends' AND EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted'
                     AND ((f.user_id = $1 AND f.friend_id = u.id) OR (f.friend_id = $1 AND f.user_id = u.id))))
                OR ($2 = 'world' AND u.visibility = 'everyone')
                OR ($2 = 'country' AND u.visibility = 'everyone'
                    AND u.country = (SELECT country FROM users WHERE id = $1))
         )
         SELECT u.id, u.first_name, u.username, u.avatar_url, u.country,
                COALESCE(SUM(s.distance_m), 0) AS \"distance_m!\"
         FROM members m
         JOIN users u ON u.id = m.id
         LEFT JOIN sessions s ON s.user_id = u.id
              AND ($2 = 'friends' OR s.source = 'treadmill')
              AND ($3::date IS NULL OR s.started_at >= ($3::date::timestamp AT TIME ZONE 'Europe/Paris'))
              AND ($4::date IS NULL OR s.started_at < ($4::date::timestamp AT TIME ZONE 'Europe/Paris'))
         GROUP BY u.id
         HAVING u.id = $1 OR $2 = 'friends' OR COALESCE(SUM(s.distance_m), 0) > 0",
        user_id,
        scope,
        since,
        until
    )
    .fetch_all(&state.db)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| LeaderboardEntry {
            rank: 0,
            me: r.id == user_id,
            user_id: r.id,
            first_name: r.first_name,
            username: r.username,
            avatar_url: r.avatar_url,
            country: r.country,
            value: r.distance_m,
            best: None,
        })
        .collect())
}

/// Current and best streaks of the walkers of the scope.
async fn streak_entries(
    state: &AppState,
    user_id: Uuid,
    scope: &str,
    today: Date,
) -> AppResult<Vec<LeaderboardEntry>> {
    let rows = sqlx::query!(
        "WITH members AS (
             SELECT u.id FROM users u
             WHERE u.id = $1
                OR ($2 = 'friends' AND EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted'
                     AND ((f.user_id = $1 AND f.friend_id = u.id) OR (f.friend_id = $1 AND f.user_id = u.id))))
                OR ($2 = 'world' AND u.visibility = 'everyone')
                OR ($2 = 'country' AND u.visibility = 'everyone'
                    AND u.country = (SELECT country FROM users WHERE id = $1))
         )
         SELECT u.id, u.first_name, u.username, u.avatar_url, u.country,
                COALESCE(array_agg(DISTINCT (s.started_at AT TIME ZONE 'Europe/Paris')::date)
                         FILTER (WHERE s.id IS NOT NULL), '{}') AS \"days!: Vec<Date>\"
         FROM members m
         JOIN users u ON u.id = m.id
         LEFT JOIN sessions s ON s.user_id = u.id AND s.source = 'treadmill'
         GROUP BY u.id",
        user_id,
        scope
    )
    .fetch_all(&state.db)
    .await?;
    Ok(rows
        .into_iter()
        .filter_map(|r| {
            let (current, best) = streaks(r.days, today);
            // Out of the friends, only walkers on a streak are ranked (and me).
            (current > 0 || scope == "friends" || r.id == user_id).then(|| LeaderboardEntry {
                rank: 0,
                me: r.id == user_id,
                user_id: r.id,
                first_name: r.first_name,
                username: r.username,
                avatar_url: r.avatar_url,
                country: r.country,
                #[allow(clippy::cast_precision_loss)] // a streak is a few thousand days at most
                value: current as f64,
                best: Some(best),
            })
        })
        .collect())
}

/// Days in a row with a treadmill session, ending today or yesterday (today
/// may still come), and the longest run ever.
pub fn streaks(mut days: Vec<Date>, today: Date) -> (i64, i64) {
    days.sort_unstable();
    days.dedup();
    let (mut best, mut run) = (0, 0);
    let mut previous: Option<Date> = None;
    for &day in &days {
        run = if previous.is_some_and(|p| p.next_day() == Some(day)) { run + 1 } else { 1 };
        best = best.max(run);
        previous = Some(day);
    }
    let alive = previous.is_some_and(|last| last == today || last.next_day() == Some(today));
    (if alive { run } else { 0 }, best)
}

fn last_day_of_month(first: Date) -> Date {
    let (year, month) = match first.month() {
        Month::December => (first.year() + 1, Month::January),
        month => (first.year(), month.next()),
    };
    Date::from_calendar_date(year, month, 1).map_or(first, |next| next - Duration::days(1))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(month: Month, day: u8) -> Date {
        Date::from_calendar_date(2026, month, day).unwrap()
    }

    #[test]
    fn streak_counts_until_yesterday_and_keeps_the_record() {
        let days = vec![
            date(Month::November, 1),
            date(Month::November, 2),
            date(Month::November, 3),
            date(Month::November, 9),
            date(Month::November, 10),
            date(Month::November, 10),
        ];
        assert_eq!(streaks(days.clone(), date(Month::November, 11)), (2, 3));
        assert_eq!(streaks(days.clone(), date(Month::November, 10)), (2, 3));
        assert_eq!(streaks(days, date(Month::November, 12)), (0, 3), "a missed day breaks it");
        assert_eq!(streaks(Vec::new(), date(Month::November, 12)), (0, 0));
    }

    #[test]
    fn months_end_on_their_last_day() {
        assert_eq!(last_day_of_month(date(Month::November, 1)), date(Month::November, 30));
        assert_eq!(last_day_of_month(date(Month::December, 1)), date(Month::December, 31));
        let leap = Date::from_calendar_date(2028, Month::February, 1).unwrap();
        assert_eq!(last_day_of_month(leap).day(), 29);
    }
}
