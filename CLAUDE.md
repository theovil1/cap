# Cap

iPhone and iPad app that moves a pawn along a real walking route (e.g. Romorantin to Paris) using the distance walked on a Bluetooth treadmill, with real-time races between friends. Open source (MIT): https://github.com/theovil1/cap

## Reference documents (local only, not versioned)

Read them before starting a step. `docs/` is git-ignored except `docs/github/`.

- `docs/Cap, cahier des charges.md`: specification (features, architecture, data model, steps). Written in French.
- `docs/captures/*.png` and `docs/sources/*.dc.html`: validated mockups, iPhone and iPad, light and dark. Take exact colours and sizes from the HTML sources.
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
app/          Expo app (to come)
api/          Rust API (to come)
infra/        Docker Compose, GraphHopper, Photon (to come)
tools/        ble-probe: Python BLE probe (bleak)
docs/github/  README banners and social preview
```

## Status

- Step 0 (treadmill decoding) done: the Luma speaks standard FTMS.
- Next: step "iPhone proof", a minimal Expo app showing live speed and distance.
