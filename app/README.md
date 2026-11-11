# Cap app

Expo (SDK 58) app for iPhone and iPad, written in TypeScript with Expo Router.

## Run it

Bluetooth needs native code, so Cap runs in a [development build](https://docs.expo.dev/develop/development-builds/introduction/), never in Expo Go.

```bash
npm install
npx eas-cli@latest build --platform ios --profile development   # once, then install it on the device
npx expo start                                                  # dev server, the build connects to it
```

## Configuration

The app talks to `https://cap.theovilain.fr` by default. Set `EXPO_PUBLIC_API_URL` to use another API (for example a local one).

## Checks

```bash
npm test            # unit tests (Jest)
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm run format      # Prettier
```

## Structure

| Path | Content |
| --- | --- |
| `src/app/` | Screens (Expo Router): tabs, new journey, preview, live session, summary |
| `src/api/` | API client, sign-in, TanStack Query hooks |
| `src/journey/` | Pawn position along the route, stages, steps, streaks |
| `src/session/` | Session recorder, local SQLite store, sync queue |
| `src/map/` | MapLibre map and the Cap style derived from OpenFreeMap Liberty |
| `src/treadmill/` | FTMS decoder, distance tracker, Bluetooth connection |
| `src/ui/` | Shared components and the floating navigation bar |
| `src/i18n/` | Translations (French and English) and native permission strings |
| `src/theme.ts` | Colours and fonts from the mockups |

Treadmill protocol details: [`tools/ble-probe/README.md`](../tools/ble-probe/README.md).
