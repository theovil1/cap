import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { IGN_ORTHO } from './style';

const TILE = 256;
/** A tile the server refused is asked again, a little later each time. */
const RETRIES = 4;
/** Earth tone behind the tiles while they load: no white or black squares. */
const GROUND = '#7B7A6A';

/** Web Mercator pixel of a point at a zoom level. */
export function worldPixel(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const size = TILE * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

function Tile({
  x,
  y,
  zoom,
  left,
  top,
}: {
  x: number;
  y: number;
  zoom: number;
  left: number;
  top: number;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!failed || attempt >= RETRIES) return;
    const timer = setTimeout(
      () => {
        setFailed(false);
        setAttempt((a) => a + 1);
      },
      800 * (attempt + 1),
    );
    return () => clearTimeout(timer);
  }, [failed, attempt]);
  const uri =
    IGN_ORTHO.replace('{z}', String(zoom)).replace('{x}', String(x)).replace('{y}', String(y)) +
    (attempt ? `&retry=${attempt}` : '');
  return (
    <Image
      source={{ uri }}
      cachePolicy="disk"
      onError={() => setFailed(true)}
      transition={150}
      style={[styles.tile, { left, top }]}
    />
  );
}

/**
 * IGN aerial photo centred on a place (France only), made of the tiles that
 * cover the view: the picture of a destination without any photo library.
 */
export function AerialView({
  lat,
  lon,
  size,
  width = size,
  height = size,
  zoom = 15,
  style,
}: {
  lat: number;
  lon: number;
  /** Side of a square view, in points; or give `width` and `height`. */
  size?: number;
  width?: number;
  height?: number;
  zoom?: number;
  style?: StyleProp<ViewStyle>;
}) {
  // One tile pixel per point on screen keeps the photo sharp enough.
  const w = width ?? 0;
  const h = height ?? 0;
  const center = worldPixel(lat, lon, zoom);
  // Only the tiles that show: a wide view asked for dozens of hidden ones,
  // and the server turned some of the visible ones down.
  const span = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const xs = span(Math.floor((center.x - w / 2) / TILE), Math.floor((center.x + w / 2) / TILE));
  const ys = span(Math.floor((center.y - h / 2) / TILE), Math.floor((center.y + h / 2) / TILE));
  return (
    <View style={[{ width, height, overflow: 'hidden', backgroundColor: GROUND }, style]}>
      {ys.flatMap((y) =>
        xs.map((x) => (
          <Tile
            key={`${x}-${y}`}
            x={x}
            y={y}
            zoom={zoom}
            left={w / 2 + x * TILE - center.x}
            top={h / 2 + y * TILE - center.y}
          />
        )),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { position: 'absolute', width: TILE, height: TILE },
});
