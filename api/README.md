# Cap API

Rust API (Axum, Tokio, SQLx, PostgreSQL) for accounts, walking routes, journeys and treadmill sessions. The app never talks to GraphHopper or Photon directly: the API sits in between.

## Endpoints

Interactive documentation is served at `/docs` (OpenAPI at `/openapi.json`).

| Endpoint | Purpose |
| --- | --- |
| `POST /auth/register`, `/auth/login`, `/auth/apple` | Sign up or sign in, returns an access token (15 min) and a refresh token (60 days) |
| `POST /auth/refresh`, `/auth/logout` | Rotate or revoke a refresh token (reuse of a revoked token logs the user out everywhere) |
| `GET`, `PATCH`, `DELETE /me` | Profile and settings (app colour, map mood, units, visibility...), account deletion |
| `PUT`, `DELETE /me/avatar`, `GET /avatars/{id}` | Profile photo (raw JPEG or PNG, 512 KB at most) |
| `GET /me/export` | All the data kept about the user, as JSON (GDPR) |
| `GET /friends`, `POST /friends` | Friends and pending requests; ask by username or join through an invite code |
| `POST /friends/{id}/accept`, `DELETE /friends/{id}` | Accept a request; remove a friend, decline or cancel a request |
| `GET /friends/invite`, `/users/search` | Personal invite code (page at `/invite/{code}` opens the app), username search |
| `GET /leaderboards` | Rankings (`period`: `week`, `month`, `all` or `streak`; `scope`: `friends`, `country` or `world`): km since Monday or the 1st (Paris time) or ever, days in a row with a treadmill session; my place and my place over the previous period |
| `GET /geocode`, `/reverse` | Address autocomplete, nearest address to a point (Photon) |
| `POST /routes` | Compute a safe walking route (GraphHopper) and its stages, for a preview |
| `POST /journeys` | Start a solo journey on a computed route |
| `GET /journeys`, `/journeys/{id}` | Journeys with progress, route geometry and stages |
| `POST /journeys/{id}/reset` | Start a solo journey again from the beginning |
| `DELETE /journeys/{id}` | Delete a solo journey or cancel a race not started yet (sessions stay in the history) |
| `POST /races` | Create a race on a computed route and invite friends |
| `POST /journeys/{id}/join`, `/leave`, `/start` | Accept an invitation, leave a race, start it (creator; unanswered invitations drop) |
| `POST /public-routes`, `GET /public-routes` | Publish a computed route; browse (`sort`: `popular`, `new`, `near`; `q`, `tag`, `max_km`) |
| `GET /public-routes/featured` | Route of the week (chosen by an admin, else the most started this week) |
| `GET`, `DELETE /public-routes/{id}`, `POST /public-routes/{id}/start` | Map, stages and ten fastest by walking time; unpublish; start a solo journey on it |
| `PUT`, `DELETE /public-routes/{id}/photos/{kind}`, `GET` (no token) | Start, end or path photo (JPEG or PNG, 2 MB at most) |
| `POST /reports` | Report a route, post, comment or walker; three reports hide a route or a post |
| `GET /admin/reports`, `PATCH /admin/public-routes/{id}` | Admins: open reports; hide, show or feature a route |
| `POST /events`, `GET /events` | Schedule a journey on a public route (title, start, end); list them, under way first (`filter`: `all`, `mine`, `friends`) |
| `GET /events/{id}`, `POST`, `DELETE /events/{id}/register` | A scheduled journey; sign up (until its end, late walkers start from zero) or leave |
| `GET /events/{id}/live` | Live standings: leaders, friends, my place and my place ten minutes ago, dots for the others |
| `GET /users/{id}/profile` | A walker's profile: totals, streaks, finished journeys, the journey under way (friends only when the profile is), followers, friends in common |
| `POST`, `DELETE /users/{id}/follow` | Follow a walker (one way, besides friends) or stop |
| `GET /feed` | Activity of me, my friends and the walkers I follow: arrivals, stages, medals, routes published |
| `PATCH`, `DELETE /posts/{id}`, `POST`, `DELETE /posts/{id}/bravo` | My word on a post, or delete it; Bravo |
| `GET`, `POST /posts/{id}/comments`, `DELETE /comments/{id}` | Comments (deleted by their author or the post author) |
| `PUT`, `DELETE /admin/users/{id}/badges/{badge}` | Admins: give or take back a badge (team, certified, developer, github, supporter with a tier, beta, moderator, club); founder, organizer, route maker and ambassador come by themselves |
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
