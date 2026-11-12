//! Live races: walkers send their session distance over a WebSocket (about every
//! 2 seconds) and the server relays it to their rivals.

use std::{
    collections::HashMap,
    sync::{
        Mutex, PoisonError,
        atomic::{AtomicU64, Ordering},
    },
    time::{Duration, Instant},
};

use axum::{
    extract::{
        State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::Response,
};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use tokio::sync::mpsc;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{auth::AuthUser, state::AppState};

/// A walker without news for this long is no longer live.
const FRESH: Duration = Duration::from_secs(12);
/// Same ceiling as uploaded sessions (the Luma tops out at 12 km/h).
const MAX_SPEED_KMH: f64 = 20.0;
/// Slack for the treadmill counter catching up in 100 m steps.
const SLACK_M: f64 = 120.0;

#[derive(Serialize, ToSchema, Clone, Copy, Debug, PartialEq)]
pub struct LivePosition {
    /// Distance on the race, the session under way included.
    pub distance_m: f64,
    pub speed_kmh: f64,
}

struct Walking {
    started_at: OffsetDateTime,
    session_m: f64,
    speed_kmh: f64,
    at: Instant,
}

/// Open sockets of each user, each with its id.
type Clients = HashMap<Uuid, Vec<(u64, mpsc::UnboundedSender<String>)>>;

/// Who walks right now, and the open sockets to reach each user.
#[derive(Default)]
pub struct LiveHub {
    walking: Mutex<HashMap<Uuid, Walking>>,
    clients: Mutex<Clients>,
    next_id: AtomicU64,
}

impl LiveHub {
    /// Live position of a walker on a race started at `starts_at`, if they walk now.
    pub fn race_position(
        &self,
        user_id: Uuid,
        starts_at: Option<OffsetDateTime>,
        synced_m: f64,
        route_m: f64,
    ) -> Option<LivePosition> {
        let walking = self.walking.lock().unwrap_or_else(PoisonError::into_inner);
        let w = walking.get(&user_id)?;
        let counts = starts_at.is_some_and(|start| w.started_at >= start);
        (w.at.elapsed() <= FRESH && counts).then(|| LivePosition {
            distance_m: (synced_m + w.session_m).min(route_m),
            speed_kmh: w.speed_kmh,
        })
    }

    /// Records a progress message; false when it is not credible.
    fn update(&self, user_id: Uuid, started_at: OffsetDateTime, session_m: f64, speed_kmh: f64) -> bool {
        let now = OffsetDateTime::now_utc();
        let elapsed_s = (now - started_at).as_seconds_f64();
        if !credible(session_m, speed_kmh, elapsed_s) {
            return false;
        }
        let mut walking = self.walking.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some(previous) = walking.get(&user_id).filter(|w| w.started_at == started_at) {
            let since_s = previous.at.elapsed().as_secs_f64();
            if session_m - previous.session_m > MAX_SPEED_KMH / 3.6 * since_s + SLACK_M {
                return false;
            }
        }
        walking.insert(user_id, Walking { started_at, session_m, speed_kmh, at: Instant::now() });
        true
    }

    fn stop(&self, user_id: Uuid) {
        self.walking.lock().unwrap_or_else(PoisonError::into_inner).remove(&user_id);
    }

    fn subscribe(&self, user_id: Uuid) -> (u64, mpsc::UnboundedReceiver<String>) {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (sender, receiver) = mpsc::unbounded_channel();
        self.clients
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .entry(user_id)
            .or_default()
            .push((id, sender));
        (id, receiver)
    }

    fn unsubscribe(&self, user_id: Uuid, id: u64) {
        let mut clients = self.clients.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some(list) = clients.get_mut(&user_id) {
            list.retain(|(other, _)| *other != id);
            if list.is_empty() {
                clients.remove(&user_id);
            }
        }
    }

    fn send(&self, user_id: Uuid, text: &str) {
        if let Some(list) = self.clients.lock().unwrap_or_else(PoisonError::into_inner).get(&user_id) {
            for (_, sender) in list {
                let _ = sender.send(text.to_owned());
            }
        }
    }
}

/// A session distance that a treadmill could have produced.
fn credible(session_m: f64, speed_kmh: f64, elapsed_s: f64) -> bool {
    session_m.is_finite()
        && session_m >= 0.0
        && (0.0..=MAX_SPEED_KMH).contains(&speed_kmh)
        && elapsed_s >= -60.0
        && session_m <= MAX_SPEED_KMH / 3.6 * elapsed_s.max(0.0) + SLACK_M
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ClientMessage {
    /// Distance of the session under way.
    Progress {
        #[serde(with = "time::serde::rfc3339")]
        started_at: OffsetDateTime,
        session_m: f64,
        speed_kmh: f64,
    },
    /// The session is over.
    Stop,
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ServerMessage {
    Position { journey_id: Uuid, user_id: Uuid, distance_m: f64, speed_kmh: f64 },
    Stop { journey_id: Uuid, user_id: Uuid },
}

/// `GET /live`: WebSocket for live races (bearer token in the `Authorization` header).
pub async fn live_socket(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
) -> Response {
    ws.on_upgrade(move |socket| run(socket, state, user_id))
}

async fn run(mut socket: WebSocket, state: AppState, user_id: Uuid) {
    let (id, mut outbox) = state.live.subscribe(user_id);
    loop {
        tokio::select! {
            incoming = socket.recv() => match incoming {
                Some(Ok(Message::Text(text))) => {
                    if let Ok(message) = serde_json::from_str::<ClientMessage>(&text)
                        && let Err(error) = handle(&state, user_id, message).await
                    {
                        tracing::warn!(%error, "live message failed");
                    }
                }
                Some(Ok(Message::Close(_)) | Err(_)) | None => break,
                Some(Ok(_)) => {}
            },
            outgoing = outbox.recv() => match outgoing {
                Some(text) => {
                    if socket.send(Message::Text(text.into())).await.is_err() {
                        break;
                    }
                }
                None => break,
            },
        }
    }
    state.live.unsubscribe(user_id, id);
}

async fn handle(state: &AppState, user_id: Uuid, message: ClientMessage) -> Result<(), sqlx::Error> {
    let races = sqlx::query!(
        "SELECT p.journey_id, p.distance_m, r.distance_m AS route_distance_m, j.starts_at,
                COALESCE(array_agg(o.user_id) FILTER (WHERE o.user_id IS NOT NULL), '{}') AS \"rivals!\"
         FROM journey_participants p
         JOIN journeys j ON j.id = p.journey_id
         JOIN routes r ON r.id = j.route_id
         LEFT JOIN journey_participants o
           ON o.journey_id = p.journey_id AND o.user_id <> p.user_id AND o.joined_at IS NOT NULL
         WHERE p.user_id = $1 AND j.kind = 'race' AND j.status = 'active'
           AND p.joined_at IS NOT NULL AND p.arrived_at IS NULL
         GROUP BY p.journey_id, p.distance_m, r.distance_m, j.starts_at",
        user_id
    )
    .fetch_all(&state.db)
    .await?;
    match message {
        ClientMessage::Progress { started_at, session_m, speed_kmh } => {
            if !state.live.update(user_id, started_at, session_m, speed_kmh) {
                return Ok(());
            }
            for race in races {
                let Some(position) =
                    state.live.race_position(user_id, race.starts_at, race.distance_m, race.route_distance_m)
                else {
                    continue;
                };
                let text = to_text(&ServerMessage::Position {
                    journey_id: race.journey_id,
                    user_id,
                    distance_m: position.distance_m,
                    speed_kmh: position.speed_kmh,
                });
                race.rivals.iter().for_each(|rival| state.live.send(*rival, &text));
            }
        }
        ClientMessage::Stop => {
            state.live.stop(user_id);
            for race in races {
                let text = to_text(&ServerMessage::Stop { journey_id: race.journey_id, user_id });
                race.rivals.iter().for_each(|rival| state.live.send(*rival, &text));
            }
        }
    }
    Ok(())
}

fn to_text(message: &ServerMessage) -> String {
    serde_json::to_string(message).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_treadmill_speeds_are_credible() {
        assert!(credible(1_000.0, 5.0, 600.0));
        assert!(!credible(1_000.0, 25.0, 600.0), "speed above 20 km/h");
        assert!(!credible(5_000.0, 5.0, 600.0), "5 km in 10 minutes");
        assert!(!credible(-1.0, 5.0, 600.0));
        assert!(!credible(f64::NAN, 5.0, 600.0));
    }

    #[test]
    fn positions_count_from_the_race_start() {
        let hub = LiveHub::default();
        let user = Uuid::now_v7();
        let started = OffsetDateTime::now_utc() - time::Duration::minutes(10);
        assert!(hub.update(user, started, 800.0, 5.0));
        let before = Some(started - time::Duration::minutes(1));
        assert_eq!(
            hub.race_position(user, before, 1_000.0, 5_000.0),
            Some(LivePosition { distance_m: 1_800.0, speed_kmh: 5.0 })
        );
        assert_eq!(hub.race_position(user, before, 4_900.0, 5_000.0).unwrap().distance_m, 5_000.0);
        // A race started after this session: the session does not count.
        assert_eq!(hub.race_position(user, Some(OffsetDateTime::now_utc()), 0.0, 5_000.0), None);
        // A jump too big for the time since the last message is refused.
        assert!(!hub.update(user, started, 2_000.0, 5.0));
        hub.stop(user);
        assert_eq!(hub.race_position(user, before, 0.0, 5_000.0), None);
    }
}
