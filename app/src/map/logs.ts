import { LogManager } from '@maplibre/maplibre-react-native';

/**
 * A map tile the server could not send (IGN answers 502 now and then) is
 * left blank and asked again later by MapLibre: not an error worth the red
 * screen in development. Other MapLibre logs go through as before.
 */
LogManager.onLog((log) => /Failed to load tile|HTTP status code/.test(log.message));
