# Cap API

Rust API (Axum, Tokio, SQLx, PostgreSQL) for accounts, walking routes, journeys and treadmill sessions. The app never talks to GraphHopper or Photon directly: the API sits in between.

## Endpoints

Interactive documentation is served at `/docs` (OpenAPI at `/openapi.json`).

| Endpoint | Purpose |
| --- | --- |
| `POST /auth/register`, `/auth/login`, `/auth/apple` | Sign up or sign in, returns an access token (15 min) and a refresh token (60 days) |
| `POST /auth/refresh`, `/auth/logout` | Rotate or revoke a refresh token (reuse of a revoked token logs the user out everywhere) |
| `GET`, `PATCH`, `DELETE /me` | Profile, account deletion |
| `GET /geocode` | Address autocomplete (Photon) |
| `POST /journeys` | Compute a safe walking route (GraphHopper) and start a solo journey |
| `GET /journeys`, `/journeys/{id}` | Journeys with progress, route geometry |
| `POST /sessions` | Upload a session, idempotent on `local_id`, rejected above 20 km/h |
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
