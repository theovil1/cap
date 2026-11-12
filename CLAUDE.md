# Cap

iPhone and iPad app that moves a pawn along a real walking route (e.g. Romorantin to Paris) using the distance walked on a Bluetooth treadmill, with real-time races between friends. Open source (MIT): https://github.com/theovil1/cap

## Reference documents (local only, not versioned)

Read them before starting a step. `docs/` is git-ignored except `docs/github/`.

- `docs/Cap, cahier des charges.md`: specification (features, architecture, data model, steps). Written in French.
- `docs/design/maquettes/`: current mockups (start with `LISEZMOI.md`), iPhone and iPad, light and dark, plus badge and medal boards. Take exact values from `sources/*.dc.html`; tokens live in `app/src/tokens.ts`. `docs/captures` and `docs/sources` are the first, older set.
- `tools/ble-probe/README.md`: Zipro Luma Bluetooth protocol (versioned).

## Stack (imposed)

- App: Expo with a native development build (never Expo Go), React Native, TypeScript, Expo Router, MapLibre React Native + OpenFreeMap, react-native-ble-plx, expo-sqlite, TanStack Query.
- API: Rust (Axum, Tokio, SQLx) + PostgreSQL, WebSocket for live races.
- Routing and geocoding: self-hosted GraphHopper and Photon.
- Deployment: Docker Compose, on Théo's home server first.

## Working rules

- Work step by step, in the order of the specification. Before each step, propose a short plan and wait for approval.
- Everything in the repository is in English: code, comments, identifiers, commit messages, docs, translation keys. Only conversations with Théo are in French.
- The app UI ships in French (default) and English from the start. No hard-coded user-facing strings.
- Never use em dashes, in code or in text.
- Keep files and docs short. No secrets in the repository: use `.env.example`.
- Pin dependency versions. Run linters and tests before committing.

## Git

- [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, imperative, lowercase, no final period. Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`. Scopes: `app`, `api`, `infra`, `tools`.
- Author identity: Théo Vilain <288923546+theovil1@users.noreply.github.com> (set in the local git config).
- Never push without asking Théo.

## Decisions since the specification was validated

- The app is universal iPhone + iPad. On iPad: landscape first, two columns (map on the left, fixed panel on the right during a session), floating navigation bar at the top.
- Credited distance: speed integrated at each frame, re-anchored on the treadmill counter, which only moves in 100 m steps on the Luma (details in `tools/ble-probe/README.md`).

## Layout

```
app/          Expo app (SDK 58), see app/README.md
api/          Rust API (Axum, SQLx), see api/README.md
infra/        Docker Compose, GraphHopper, Photon, see infra/README.md
tools/        ble-probe: Python BLE probe (bleak)
docs/github/  README banners and social preview
```

## Status

- Step 0 (treadmill decoding) done: the Luma speaks standard FTMS.
- iPhone proof done (11 Nov 2026): live speed, incline and distance on a development build, matching the console (410 m credited for a 400 m counter, same speed, incline and duration).
- Foundation done (11 Nov 2026): API online at https://cap.theovilain.fr (docs at /docs), with GraphHopper (foot_safe) and Photon (France). Deployed on the home server in ~/cap/infra (nginx + certbot, 7 GB RAM: GraphHopper in MMAP mode).
- Solo loop done (12 Nov 2026), tried on the iPhone with the treadmill: route preview with stages, sign-in, live 3D map (plan or IGN satellite, resizable sheet, smooth pawn), summary, home screen, local SQLite save and sync queue, journey reset and deletion. API deployed.
- Multiplayer coded and deployed (12 Nov 2026): friends (username search, requests, invite link /invite/{code} opening cap://invite/{code}), leaderboards (week, month, streak, Paris time), live races (invitations, start by the creator, /live WebSocket relaying positions every 2 s, rival pawns, race screen, place in the summary). Not yet tried with a second walker.
- Next: try a real race with a friend, then Profile and finishing touches, after a short plan.
- Still to verify: whether the treadmill counters reset between two sessions.
