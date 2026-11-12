//! Leaderboards between friends: km of the week and of the month, streaks of active days.
//! Weeks start on Monday and days follow Paris time (specification).

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

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(get_leaderboard))
}

#[derive(Deserialize, IntoParams)]
pub struct LeaderboardQuery {
    /// `week`, `month` or `streak`.
    period: String,
}

#[derive(Serialize, ToSchema)]
pub struct Leaderboard {
    period: String,
    /// First and last day of the week or month (`YYYY-MM-DD`, Paris time); today for streaks.
    starts_on: String,
    ends_on: String,
    /// Best first; ties share a rank.
    entries: Vec<LeaderboardEntry>,
}

#[derive(Serialize, ToSchema)]
pub struct LeaderboardEntry {
    rank: usize,
    user_id: Uuid,
    first_name: String,
    username: String,
    avatar_url: Option<String>,
    /// The current user.
    me: bool,
    /// Metres walked (week, month) or days in a row (streak).
    value: f64,
    /// Longest streak ever, in days (streak only).
    best: Option<i64>,
}

/// The current user and their friends, ranked.
#[utoipa::path(get, path = "/leaderboards", tag = "leaderboards", security(("bearer" = [])),
    params(LeaderboardQuery),
    responses((status = 200, body = Leaderboard), (status = 400, body = ErrorBody)))]
async fn get_leaderboard(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Query(query): Query<LeaderboardQuery>,
) -> AppResult<Json<Leaderboard>> {
    let today = sqlx::query_scalar!("SELECT (now() AT TIME ZONE 'Europe/Paris')::date AS \"today!\"")
        .fetch_one(&state.db)
        .await?;
    let (starts_on, ends_on, mut entries) = match query.period.as_str() {
        "week" | "month" => {
            let week = query.period == "week";
            let starts_on = if week {
                today - Duration::days(i64::from(today.weekday().number_days_from_monday()))
            } else {
                today.replace_day(1).map_err(AppError::internal)?
            };
            let ends_on = if week { starts_on + Duration::days(6) } else { last_day_of_month(starts_on) };
            (starts_on, ends_on, distances(&state, user_id, starts_on).await?)
        }
        "streak" => (today, today, streak_entries(&state, user_id, today).await?),
        _ => return Err(AppError::bad_request("invalid_period", "period must be week, month or streak")),
    };
    entries.sort_by(|a, b| b.value.total_cmp(&a.value).then_with(|| a.first_name.cmp(&b.first_name)));
    let values: Vec<f64> = entries.iter().map(|e| e.value).collect();
    for entry in &mut entries {
        entry.rank = 1 + values.iter().filter(|&&v| v > entry.value).count();
    }
    Ok(Json(Leaderboard {
        period: query.period,
        starts_on: starts_on.to_string(),
        ends_on: ends_on.to_string(),
        entries,
    }))
}

/// Metres walked since `since` (a Paris date) by the user and their friends.
async fn distances(state: &AppState, user_id: Uuid, since: Date) -> AppResult<Vec<LeaderboardEntry>> {
    let rows = sqlx::query!(
        "WITH members AS (
             SELECT $1::uuid AS id
             UNION
             SELECT CASE WHEN user_id = $1 THEN friend_id ELSE user_id END
             FROM friendships WHERE status = 'accepted' AND (user_id = $1 OR friend_id = $1)
         )
         SELECT u.id, u.first_name, u.username, u.avatar_url,
                COALESCE(SUM(s.distance_m), 0) AS \"distance_m!\"
         FROM members m
         JOIN users u ON u.id = m.id
         LEFT JOIN sessions s ON s.user_id = u.id AND s.started_at >= ($2::date::timestamp AT TIME ZONE 'Europe/Paris')
         GROUP BY u.id",
        user_id,
        since
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
            value: r.distance_m,
            best: None,
        })
        .collect())
}

/// Current and best streaks of the user and their friends.
async fn streak_entries(state: &AppState, user_id: Uuid, today: Date) -> AppResult<Vec<LeaderboardEntry>> {
    let rows = sqlx::query!(
        "WITH members AS (
             SELECT $1::uuid AS id
             UNION
             SELECT CASE WHEN user_id = $1 THEN friend_id ELSE user_id END
             FROM friendships WHERE status = 'accepted' AND (user_id = $1 OR friend_id = $1)
         )
         SELECT u.id, u.first_name, u.username, u.avatar_url,
                COALESCE(array_agg(DISTINCT (s.started_at AT TIME ZONE 'Europe/Paris')::date)
                         FILTER (WHERE s.id IS NOT NULL), '{}') AS \"days!: Vec<Date>\"
         FROM members m
         JOIN users u ON u.id = m.id
         LEFT JOIN sessions s ON s.user_id = u.id AND s.source = 'treadmill'
         GROUP BY u.id",
        user_id
    )
    .fetch_all(&state.db)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| {
            let (current, best) = streaks(r.days, today);
            LeaderboardEntry {
                rank: 0,
                me: r.id == user_id,
                user_id: r.id,
                first_name: r.first_name,
                username: r.username,
                avatar_url: r.avatar_url,
                #[allow(clippy::cast_precision_loss)] // a streak is a few thousand days at most
                value: current as f64,
                best: Some(best),
            }
        })
        .collect())
}

/// Days in a row with a treadmill session, ending today or yesterday (today
/// may still come), and the longest run ever.
fn streaks(mut days: Vec<Date>, today: Date) -> (i64, i64) {
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
