import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { IGN_ORTHO } from './style';

const TILE = 256;

/** Web Mercator pixel of a point at a zoom level. */
function worldPixel(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const size = TILE * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

/**
 * IGN aerial photo centred on a place (France only), from three by three
 * tiles: the picture of a destination without any photo library.
 */
export function AerialView({
  lat,
  lon,
  size,
  zoom = 15,
  style,
}: {
  lat: number;
  lon: number;
  /** Width and height of the square shown, in points. */
  size: number;
  zoom?: number;
  style?: StyleProp<ViewStyle>;
}) {
  // One tile pixel per point on screen keeps the photo sharp enough.
  const center = worldPixel(lat, lon, zoom);
  const tileX = Math.floor(center.x / TILE);
  const tileY = Math.floor(center.y / TILE);
  const tiles = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [tileX + dx, tileY + dy]));
  return (
    <View style={[{ width: size, height: size, overflow: 'hidden' }, style]}>
      {tiles.map(([x, y]) => (
        <Image
          key={`${x}-${y}`}
          source={{
            uri: IGN_ORTHO.replace('{z}', String(zoom))
              .replace('{x}', String(x))
              .replace('{y}', String(y)),
          }}
          cachePolicy="disk"
          style={[
            styles.tile,
            { left: size / 2 + x * TILE - center.x, top: size / 2 + y * TILE - center.y },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { position: 'absolute', width: TILE, height: TILE },
});
