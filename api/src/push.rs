//! Push notifications, sent straight to Apple (APNs) with the team's .p8 key.
//!
//! What to tell a walker is written to `push_outbox` in the same transaction as
//! what happened; a background task sends it, in the walker's language.

use std::{
    sync::{Mutex, PoisonError},
    time::{Duration, Instant},
};

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use jsonwebtoken::{Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use serde_json::json;
use time::{OffsetDateTime, UtcOffset};
use utoipa::ToSchema;
use utoipa_axum::{router::OpenApiRouter, routes};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult, ErrorBody},
    leaderboards::streaks,
    state::AppState,
};

/// Everything Cap can tell a walker. Stored as JSON in the outbox.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Message {
    RaceInvite { journey_id: Uuid, from: String },
    RaceStarted { journey_id: Uuid, from: String },
    Overtaken { journey_id: Uuid, by: String },
    RaceFinished { journey_id: Uuid, rank: i32 },
    FriendRequest { from: String },
    FriendAccepted { user_id: Uuid, from: String },
    NewFollower { user_id: Uuid, from: String },
    Bravo { post_id: Uuid, from: String },
    Comment { post_id: Uuid, from: String },
    StreakReminder { days: i64 },
}

impl Message {
    /// Title and text, in French or English.
    fn render(&self, english: bool) -> (String, String) {
        let pick = |fr: String, en: String| if english { en } else { fr };
        match self {
            Self::RaceInvite { from, .. } => (
                pick("Invitation à une course".into(), "Race invitation".into()),
                pick(
                    format!("{from} te défie, rejoins la course."),
                    format!("{from} challenges you, join the race."),
                ),
            ),
            Self::RaceStarted { from, .. } => (
                pick("C'est parti !".into(), "Go!".into()),
                pick(
                    format!("{from} a lancé la course. À toi de marcher."),
                    format!("{from} started the race. Time to walk."),
                ),
            ),
            Self::Overtaken { by, .. } => (
                pick("Tu t'es fait doubler".into(), "You were overtaken".into()),
                pick(format!("{by} vient de passer devant toi."), format!("{by} just passed you.")),
            ),
            Self::RaceFinished { rank, .. } => (
                pick("Course terminée".into(), "Race over".into()),
                if *rank == 1 {
                    pick("Tu as gagné, bravo !".into(), "You won, well done!".into())
                } else {
                    pick(format!("Tu finis {rank}e."), format!("You finished {}.", ordinal(*rank)))
                },
            ),
            Self::FriendRequest { from } => (
                pick("Demande d'ami".into(), "Friend request".into()),
                pick(format!("{from} veut être ton ami."), format!("{from} wants to be your friend.")),
            ),
            Self::FriendAccepted { from, .. } => (
                pick("Nouvel ami".into(), "New friend".into()),
                pick(format!("{from} a accepté ta demande."), format!("{from} accepted your request.")),
            ),
            Self::NewFollower { from, .. } => (
                pick("Nouvel abonné".into(), "New follower".into()),
                pick(format!("{from} te suit."), format!("{from} follows you.")),
            ),
            Self::Bravo { from, .. } => (
                pick("Bravo !".into(), "Bravo!".into()),
                pick(format!("{from} t'a dit bravo."), format!("{from} cheered you.")),
            ),
            Self::Comment { from, .. } => (
                pick("Nouveau commentaire".into(), "New comment".into()),
                pick(format!("{from} a commenté ta publication."), format!("{from} commented on your post.")),
            ),
            Self::StreakReminder { days } => (
                pick(format!("Série de {days} jours"), format!("{days}-day streak")),
                pick(
                    "Une petite marche ce soir pour la garder ?".into(),
                    "A short walk tonight to keep it?".into(),
                ),
            ),
        }
    }

    /// The screen the app opens when the notification is tapped.
    fn path(&self) -> String {
        match self {
            Self::RaceInvite { journey_id, .. }
            | Self::RaceStarted { journey_id, .. }
            | Self::Overtaken { journey_id, .. }
            | Self::RaceFinished { journey_id, .. } => format!("/race/{journey_id}"),
            Self::FriendRequest { .. } => "/friends".into(),
            Self::FriendAccepted { user_id, .. } | Self::NewFollower { user_id, .. } => {
                format!("/walker/{user_id}")
            }
            Self::Bravo { post_id, .. } | Self::Comment { post_id, .. } => format!("/post/{post_id}"),
            Self::StreakReminder { .. } => "/".into(),
        }
    }
}

fn ordinal(rank: i32) -> String {
    let suffix = match (rank % 10, rank % 100) {
        (1, n) if n != 11 => "st",
        (2, n) if n != 12 => "nd",
        (3, n) if n != 13 => "rd",
        _ => "th",
    };
    format!("{rank}{suffix}")
}

/// Queues a message for a walker who wants notifications and has a phone to get them.
pub async fn queue(conn: &mut sqlx::PgConnection, user_id: Uuid, message: &Message) -> AppResult<()> {
    let message = serde_json::to_value(message).map_err(AppError::internal)?;
    sqlx::query!(
        "INSERT INTO push_outbox (user_id, message)
         SELECT u.id, $2 FROM users u
         WHERE u.id = $1 AND u.notifications AND EXISTS (SELECT 1 FROM push_devices d WHERE d.user_id = u.id)",
        user_id,
        message
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// A walker's first name, as notifications call them.
pub async fn first_name(conn: &mut sqlx::PgConnection, user_id: Uuid) -> AppResult<String> {
    Ok(sqlx::query_scalar!("SELECT first_name FROM users WHERE id = $1", user_id).fetch_one(conn).await?)
}

/// Apple's push service, signed in with a token from the .p8 key.
pub struct Apns {
    key: EncodingKey,
    key_id: String,
    team_id: String,
    topic: String,
    http: reqwest::Client,
    token: Mutex<Option<(String, Instant)>>,
}

/// What Apple said about one notification.
#[derive(Debug, PartialEq, Eq)]
enum Outcome {
    Sent,
    /// The token is dead: forget it.
    Gone,
    /// The token belongs to the other environment (sandbox or production).
    WrongEnvironment,
    Failed,
}

impl Apns {
    pub fn new(pem: &[u8], key_id: String, team_id: String, topic: String) -> anyhow::Result<Self> {
        let http = reqwest::Client::builder().timeout(Duration::from_secs(15)).build()?;
        Ok(Self {
            key: EncodingKey::from_ec_pem(pem)?,
            key_id,
            team_id,
            topic,
            http,
            token: Mutex::new(None),
        })
    }

    /// Apple wants a fresh token at least every hour, and not more than every 20 minutes.
    fn bearer(&self) -> anyhow::Result<String> {
        let mut cached = self.token.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some((token, at)) = cached.as_ref()
            && at.elapsed() < Duration::from_mins(40)
        {
            return Ok(token.clone());
        }
        let mut header = Header::new(Algorithm::ES256);
        header.kid = Some(self.key_id.clone());
        let claims = json!({ "iss": self.team_id, "iat": OffsetDateTime::now_utc().unix_timestamp() });
        let token = jsonwebtoken::encode(&header, &claims, &self.key)?;
        *cached = Some((token.clone(), Instant::now()));
        Ok(token)
    }

    async fn send(&self, device: &str, sandbox: bool, title: &str, body: &str, path: &str) -> Outcome {
        let host = if sandbox { "api.sandbox.push.apple.com" } else { "api.push.apple.com" };
        let Ok(bearer) = self.bearer() else { return Outcome::Failed };
        // The path twice: expo-notifications reads the data from `body` when it is there.
        let payload = json!({ "aps": { "alert": { "title": title, "body": body }, "sound": "default" },
            "path": path, "body": { "path": path } });
        let response = self
            .http
            .post(format!("https://{host}/3/device/{device}"))
            .bearer_auth(bearer)
            .header("apns-topic", &self.topic)
            .header("apns-push-type", "alert")
            .header("apns-priority", "10")
            .json(&payload)
            .send()
            .await;
        let response = match response {
            Ok(response) => response,
            Err(error) => {
                tracing::warn!(%error, "APNs unreachable");
                return Outcome::Failed;
            }
        };
        let status = response.status();
        if status.is_success() {
            return Outcome::Sent;
        }
        let reason = response.json::<serde_json::Value>().await.ok();
        let reason = reason.as_ref().and_then(|r| r["reason"].as_str()).unwrap_or_default();
        match (status.as_u16(), reason) {
            (410, _) | (400, "DeviceTokenNotForTopic") => Outcome::Gone,
            (400, "BadDeviceToken") => Outcome::WrongEnvironment,
            _ => {
                tracing::warn!(%status, reason, "APNs refused a notification");
                Outcome::Failed
            }
        }
    }
}

/// Sends the outbox every few seconds and the streak reminders at 7 pm (Paris).
pub async fn run(state: AppState) {
    let mut interval = tokio::time::interval(Duration::from_secs(5));
    loop {
        interval.tick().await;
        if let Err(error) = remind_streaks(&state).await {
            tracing::warn!(?error, "streak reminders failed");
        }
        if let Err(error) = send_outbox(&state).await {
            tracing::warn!(?error, "push outbox failed");
        }
    }
}

async fn send_outbox(state: &AppState) -> AppResult<()> {
    let Some(apns) = state.apns.as_deref() else {
        // No key on this server: nothing can go out, keep the table small.
        sqlx::query!("DELETE FROM push_outbox WHERE created_at < now() - interval '1 day'")
            .execute(&state.db)
            .await?;
        return Ok(());
    };
    let mut tx = state.db.begin().await?;
    let notes = sqlx::query!(
        "SELECT o.id, o.user_id, o.message, u.language FROM push_outbox o JOIN users u ON u.id = o.user_id
         ORDER BY o.id LIMIT 50 FOR UPDATE OF o SKIP LOCKED"
    )
    .fetch_all(&mut *tx)
    .await?;
    for note in notes {
        sqlx::query!("DELETE FROM push_outbox WHERE id = $1", note.id).execute(&mut *tx).await?;
        let Ok(message) = serde_json::from_value::<Message>(note.message) else { continue };
        let (title, body) = message.render(note.language == "en");
        let path = message.path();
        let devices =
            sqlx::query!("SELECT token, sandbox FROM push_devices WHERE user_id = $1", note.user_id)
                .fetch_all(&mut *tx)
                .await?;
        for device in devices {
            let mut outcome = apns.send(&device.token, device.sandbox, &title, &body, &path).await;
            if outcome == Outcome::WrongEnvironment {
                // Learn the right environment for next time.
                outcome = apns.send(&device.token, !device.sandbox, &title, &body, &path).await;
                if outcome == Outcome::Sent {
                    sqlx::query!(
                        "UPDATE push_devices SET sandbox = NOT sandbox WHERE token = $1",
                        device.token
                    )
                    .execute(&mut *tx)
                    .await?;
                }
            }
            if matches!(outcome, Outcome::Gone | Outcome::WrongEnvironment) {
                sqlx::query!("DELETE FROM push_devices WHERE token = $1", device.token)
                    .execute(&mut *tx)
                    .await?;
            }
        }
    }
    tx.commit().await?;
    Ok(())
}

/// From 7 pm Paris time, once a day: walkers who walked yesterday and not yet today.
async fn remind_streaks(state: &AppState) -> AppResult<()> {
    let paris = paris_now();
    if paris.hour() < 19 {
        return Ok(());
    }
    let mut tx = state.db.begin().await?;
    // Claims today's reminders first, so two servers would never both send one.
    let walkers = sqlx::query!(
        "WITH due AS (
             UPDATE users u SET streak_reminded_on = $1
             WHERE u.notifications AND u.streak_reminded_on IS DISTINCT FROM $1
               AND EXISTS (SELECT 1 FROM push_devices d WHERE d.user_id = u.id)
               AND u.id IN (SELECT user_id FROM sessions WHERE source = 'treadmill' GROUP BY user_id
                            HAVING max((started_at AT TIME ZONE 'Europe/Paris')::date) = $1 - 1)
             RETURNING u.id)
         SELECT due.id AS \"id!\", array_agg(DISTINCT (s.started_at AT TIME ZONE 'Europe/Paris')::date)
                    AS \"days!: Vec<time::Date>\"
         FROM due JOIN sessions s ON s.user_id = due.id AND s.source = 'treadmill'
         GROUP BY due.id",
        paris.date()
    )
    .fetch_all(&mut *tx)
    .await?;
    for walker in walkers {
        let (days, _) = streaks(walker.days, paris.date());
        if days >= 2 {
            queue(&mut tx, walker.id, &Message::StreakReminder { days }).await?;
        }
    }
    tx.commit().await?;
    Ok(())
}

/// Paris local time. Summer time runs from the last Sunday of March to the last Sunday of October.
fn paris_now() -> time::PrimitiveDateTime {
    let now = OffsetDateTime::now_utc();
    let summer = is_summer_time(now);
    let offset = UtcOffset::from_hms(if summer { 2 } else { 1 }, 0, 0).unwrap_or(UtcOffset::UTC);
    let local = now.to_offset(offset);
    time::PrimitiveDateTime::new(local.date(), local.time())
}

fn is_summer_time(now: OffsetDateTime) -> bool {
    let year = now.year();
    let last_sunday = |month: time::Month| {
        let mut day = time::Date::from_calendar_date(year, month, 31).unwrap_or(now.date());
        while day.weekday() != time::Weekday::Sunday {
            day = day.previous_day().unwrap_or(day);
        }
        day.with_hms(1, 0, 0).map_or(now, time::PrimitiveDateTime::assume_utc)
    };
    now >= last_sunday(time::Month::March) && now < last_sunday(time::Month::October)
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(add_device)).routes(routes!(remove_device))
}

#[derive(Deserialize, ToSchema)]
pub struct DeviceBody {
    /// The APNs device token, in hex.
    token: String,
    /// True for development builds, which use Apple's sandbox.
    #[serde(default)]
    sandbox: bool,
}

/// Register this phone for push notifications.
#[utoipa::path(post, path = "/me/devices", tag = "users", security(("bearer" = [])), request_body = DeviceBody,
    responses((status = 204), (status = 400, body = ErrorBody)))]
async fn add_device(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Json(body): Json<DeviceBody>,
) -> AppResult<StatusCode> {
    let token = body.token.trim().to_lowercase();
    if token.is_empty() || token.len() > 200 || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(AppError::bad_request("invalid_token", "the device token must be hexadecimal"));
    }
    sqlx::query!(
        "INSERT INTO push_devices (token, user_id, sandbox) VALUES ($1, $2, $3)
         ON CONFLICT (token) DO UPDATE SET user_id = $2, sandbox = $3, created_at = now()",
        token,
        user_id,
        body.sandbox
    )
    .execute(&state.db)
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Stop push notifications on this phone (sign-out).
#[utoipa::path(delete, path = "/me/devices/{token}", tag = "users", security(("bearer" = [])),
    params(("token" = String, Path)), responses((status = 204)))]
async fn remove_device(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(token): Path<String>,
) -> AppResult<StatusCode> {
    sqlx::query!("DELETE FROM push_devices WHERE token = $1 AND user_id = $2", token.to_lowercase(), user_id)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn messages_speak_both_languages() {
        let message = Message::RaceFinished { journey_id: Uuid::nil(), rank: 2 };
        assert_eq!(message.render(false).1, "Tu finis 2e.");
        assert_eq!(message.render(true).1, "You finished 2nd.");
        assert_eq!(message.path(), format!("/race/{}", Uuid::nil()));
        assert_eq!(ordinal(11), "11th");
        assert_eq!(ordinal(22), "22nd");
    }

    #[test]
    fn messages_round_trip_through_json() {
        let message = Message::Comment { post_id: Uuid::nil(), from: "Lilou".into() };
        let value = serde_json::to_value(&message).unwrap();
        assert_eq!(value["type"], "comment");
        assert_eq!(serde_json::from_value::<Message>(value).unwrap(), message);
    }

    #[test]
    fn paris_summer_time() {
        let at = |y, m, d, h| {
            time::Date::from_calendar_date(y, m, d).unwrap().with_hms(h, 0, 0).unwrap().assume_utc()
        };
        assert!(!is_summer_time(at(2026, time::Month::March, 29, 0)));
        assert!(is_summer_time(at(2026, time::Month::March, 29, 2)));
        assert!(is_summer_time(at(2026, time::Month::October, 25, 0)));
        assert!(!is_summer_time(at(2026, time::Month::October, 25, 2)));
    }
}
