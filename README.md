<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/github/banner-dark.png">
  <img alt="Cap: walk real-world routes on your treadmill" src="docs/github/banner-light.png">
</picture>

# Cap

**Walk real-world routes on your treadmill.** Pick a real start and destination (say, Romorantin to Paris) and every kilometre walked on your Bluetooth treadmill moves your pawn along the actual walking route, at a 1:1 scale. The trip takes weeks, session after session. Race your friends on the same route in real time.

> Cap is in early development. The treadmill connection works on iPhone and the API is online; the app does not use it yet, and the map and races are not built yet.

## Features (planned for the first version)

- Live 3D map following your pawn, with buildings, during each session.
- Treadmill connection over Bluetooth FTMS, starting with the Zipro Luma, plus a wizard to add any other treadmill.
- Safe walking routes computed once, split into stages (towns along the way).
- Real-time races between friends, weekly and monthly leaderboards, streaks.
- No distance ever lost: sessions are saved locally and synced when possible.
- iPhone and iPad, light and dark mode, French and English.

## Stack

| Part | Technology |
| --- | --- |
| App | Expo (native dev build), React Native, TypeScript, MapLibre + OpenFreeMap, react-native-ble-plx |
| API | Rust (Axum, Tokio, SQLx), PostgreSQL, WebSocket |
| Routing | Self-hosted GraphHopper (walking profile) and Photon (geocoding), OpenStreetMap data |
| Deployment | Docker Compose |

## Repository

| Path | Content |
| --- | --- |
| [`app`](app) | Expo app (iPhone and iPad) |
| [`api`](api) | Rust API: accounts, routes, journeys, sessions |
| [`infra`](infra) | Docker Compose: PostgreSQL, API, GraphHopper, Photon |
| [`tools/ble-probe`](tools/ble-probe) | Python tools to reverse-engineer a treadmill over Bluetooth, and the Zipro Luma protocol |

## Roadmap

- [x] Step 0: decode the treadmill from a PC
- [x] iPhone proof: live speed and distance in a minimal Expo app
- [x] Foundation: Rust API, PostgreSQL, GraphHopper and Photon in Docker Compose
- [ ] Solo loop: routes, live 3D map, session summary, offline sync
- [ ] Multiplayer: friends, live races, leaderboards
- [ ] Profile, finishing touches, treadmill wizard, TestFlight

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, tiles by [OpenFreeMap](https://openfreemap.org).
