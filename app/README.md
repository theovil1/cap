# Cap app

Expo (SDK 58) app for iPhone and iPad, written in TypeScript with Expo Router.

## Run it

Bluetooth needs native code, so Cap runs in a [development build](https://docs.expo.dev/develop/development-builds/introduction/), never in Expo Go.

```bash
npm install
npx eas-cli@latest build --platform ios --profile development   # once, then install it on the device
npx expo start                                                  # dev server, the build connects to it
```

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
| `src/app/` | Screens (Expo Router) |
| `src/treadmill/` | FTMS decoder, distance tracker, Bluetooth connection |
| `src/i18n/` | Translations (French and English) and native permission strings |
| `src/theme.ts` | Colours and fonts from the mockups |

Treadmill protocol details: [`tools/ble-probe/README.md`](../tools/ble-probe/README.md).
