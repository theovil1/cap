# Cap API

Rust API (Axum, Tokio, SQLx, PostgreSQL) for accounts, walking routes, journeys and treadmill sessions. The app never talks to GraphHopper or Photon directly: the API sits in between.

## Endpoints

Interactive documentation is served at `/docs` (OpenAPI at `/openapi.json`).

| Endpoint | Purpose |
| --- | --- |
| `POST /auth/register`, `/auth/login`, `/auth/apple` | Sign up or sign in, returns an access token (15 min) and a refresh token (60 days) |
| `POST /auth/refresh`, `/auth/logout` | Rotate or revoke a refresh token (reuse of a revoked token logs the user out everywhere) |
| `GET`, `PATCH`, `DELETE /me` | Profile, account deletion |
| `GET /friends`, `POST /friends` | Friends and pending requests; ask by username or join through an invite code |
| `POST /friends/{id}/accept`, `DELETE /friends/{id}` | Accept a request; remove a friend, decline or cancel a request |
| `GET /friends/invite`, `/users/search` | Personal invite code (page at `/invite/{code}` opens the app), username search |
| `GET /leaderboards` | Ranking with friends (`period`: `week`, `month` or `streak`): km since Monday or the 1st (Paris time), days in a row with a treadmill session |
| `GET /geocode`, `/reverse` | Address autocomplete, nearest address to a point (Photon) |
| `POST /routes` | Compute a safe walking route (GraphHopper) and its stages, for a preview |
| `POST /journeys` | Start a solo journey on a computed route |
| `GET /journeys`, `/journeys/{id}` | Journeys with progress, route geometry and stages |
| `POST /journeys/{id}/reset` | Start a solo journey again from the beginning |
| `DELETE /journeys/{id}` | Delete a solo journey or cancel a race not started yet (sessions stay in the history) |
| `POST /races` | Create a race on a computed route and invite friends |
| `POST /journeys/{id}/join`, `/leave`, `/start` | Accept an invitation, leave a race, start it (creator; unanswered invitations drop) |
| `GET /live` (WebSocket) | Send `progress` (session distance) or `stop`; receive rivals' `position` and `stop` |
| `POST /sessions` | Upload a session, idempotent on `local_id`, rejected above 20 km/h; returns the stages it unlocked |
| `GET /sessions` | Session history |
| `GET /health` | Liveness and database check |

## Development

```bash
docker compose -f ../infra/compose.yaml up -d db   # PostgreSQL
cp .env.example .env                                # then edit
cargo run                                           # migrations run at startup
```

Queries are checked at compile time against the database. After changing a query, refresh the offline data used by CI and Docker builds:

```bash
cargo sqlx prepare -- --all-targets    # requires sqlx-cli and DATABASE_URL
```

## Checks

```bash
cargo fmt
cargo clippy --all-targets -- -D warnings
cargo test        # integration tests need DATABASE_URL (one database per test)
```

`cargo run -- openapi` prints the OpenAPI document.
