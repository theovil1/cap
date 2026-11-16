import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { AerialView, worldPixel } from '@/map/aerial';
import { useColors } from '@/theme';

type Point = [number, number];

/** Metres between two `[lon, lat]` points. */
function metres(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const x = (b[0] - a[0]) * rad * Math.cos(((a[1] + b[1]) / 2) * rad);
  const y = (b[1] - a[1]) * rad;
  return Math.hypot(x, y) * 6_371_000;
}

/**
 * What the map is framed on: the stretch walked and only the start of what
 * comes next (40 % of the walked length), so the walked line fills the view.
 */
function framed(walked: Point[], ahead: Point[]): Point[] {
  let length = 0;
  for (let i = 1; i < walked.length; i++) length += metres(walked[i - 1], walked[i]);
  const room = Math.max(150, length * 0.4);
  const next: Point[] = [];
  let run = 0;
  for (let i = 0; i < ahead.length && run <= room; i++) {
    if (i > 0) run += metres(ahead[i - 1], ahead[i]);
    next.push(ahead[i]);
  }
  return [...walked, ...next];
}

/** Zoom that fits the points with a margin, between the region and the street. */
function fit(points: Point[], width: number, height: number) {
  const lats = points.map((p) => p[1]);
  const lons = points.map((p) => p[0]);
  const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const lon = (Math.min(...lons) + Math.max(...lons)) / 2;
  for (let zoom = 17; zoom > 8; zoom--) {
    const a = worldPixel(Math.max(...lats), Math.min(...lons), zoom);
    const b = worldPixel(Math.min(...lats), Math.max(...lons), zoom);
    if (b.x - a.x <= width * 0.8 && b.y - a.y <= height * 0.75) return { lat, lon, zoom };
  }
  return { lat, lon, zoom: 9 };
}

/** From this zoom on, the map shows streets and houses. */
export const STREET_ZOOM = 15;

/** The zoom a session map of this size will use, to know whether it shows streets. */
export function sessionMapZoom(walked: Point[], ahead: Point[], width: number, height = 180) {
  const all = framed(walked, ahead);
  return all.length > 1 ? fit(all, width, height).zoom : 0;
}

/**
 * A session's stretch of route seen from above, on the IGN aerial photo: the
 * part walked in full, what comes next dotted, and the pawn where it stopped.
 */
export function SessionMap({
  walked,
  ahead,
  height = 180,
  style,
}: {
  walked: Point[];
  ahead: Point[];
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const all = framed(walked, ahead);
  const view = all.length > 1 && width > 0 ? fit(all, width, height) : null;
  const centre = view ? worldPixel(view.lat, view.lon, view.zoom) : null;
  const toScreen = (p: Point) => {
    if (!view || !centre) return { x: 0, y: 0 };
    const w = worldPixel(p[1], p[0], view.zoom);
    return { x: w.x - centre.x + width / 2, y: w.y - centre.y + height / 2 };
  };
  const line = (points: Point[]) =>
    points
      .map(toScreen)
      .map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ');
  const start = walked[0] ? toScreen(walked[0]) : null;
  const pawn = walked.at(-1) ? toScreen(walked.at(-1) as Point) : null;

  return (
    <View
      style={[styles.box, { height }, style]}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {view ? (
        <>
          <AerialView
            lat={view.lat}
            lon={view.lon}
            width={width}
            height={height}
            zoom={view.zoom}
          />
          <Svg style={StyleSheet.absoluteFill}>
            {ahead.length > 1 ? (
              <Polyline
                points={line(ahead)}
                fill="none"
                stroke="#FFFFFF"
                strokeOpacity={0.75}
                strokeWidth={3}
                strokeDasharray="2 7"
                strokeLinecap="round"
              />
            ) : null}
            <Polyline
              points={line(walked)}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Polyline
              points={line(walked)}
              fill="none"
              stroke={colors.accent}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {start ? <Circle cx={start.x} cy={start.y} r={5} fill="#FFFFFF" /> : null}
            {pawn ? (
              <Circle
                cx={pawn.x}
                cy={pawn.y}
                r={9}
                fill={colors.accent}
                stroke="#FFFFFF"
                strokeWidth={3}
              />
            ) : null}
          </Svg>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', overflow: 'hidden', backgroundColor: '#7B7A6A' },
});
