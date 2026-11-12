/** Route geometry: `[lon, lat, cumulative_m]` points, as stored by the API. */
export type RoutePoint = [number, number, number];
export type LngLat = [number, number];

/** Index of the last point at or before `distanceM` (binary search). */
function segmentIndex(path: RoutePoint[], distanceM: number): number {
  let low = 0;
  let high = path.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (path[mid][2] <= distanceM) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** Pawn position after walking `distanceM` along the route. */
export function positionAt(path: RoutePoint[], distanceM: number): LngLat {
  if (path.length === 0) return [0, 0];
  const last = path[path.length - 1];
  if (distanceM <= 0) return [path[0][0], path[0][1]];
  if (distanceM >= last[2]) return [last[0], last[1]];
  const i = segmentIndex(path, distanceM);
  const [lon1, lat1, d1] = path[i];
  const [lon2, lat2, d2] = path[i + 1];
  const t = d2 > d1 ? (distanceM - d1) / (d2 - d1) : 0;
  return [lon1 + (lon2 - lon1) * t, lat1 + (lat2 - lat1) * t];
}

/** Direction of travel at `distanceM`, in degrees clockwise from north. */
export function headingAt(path: RoutePoint[], distanceM: number): number {
  if (path.length < 2) return 0;
  const behind = positionAt(path, Math.max(0, distanceM - 40));
  const ahead = positionAt(path, distanceM + 40);
  const dLon = (ahead[0] - behind[0]) * Math.cos((ahead[1] * Math.PI) / 180);
  const dLat = ahead[1] - behind[1];
  return ((Math.atan2(dLon, dLat) * 180) / Math.PI + 360) % 360;
}

/** Splits the route at the pawn: the walked part and the part left. */
export function splitAt(
  path: RoutePoint[],
  distanceM: number,
): { walked: LngLat[]; left: LngLat[] } {
  if (path.length === 0) return { walked: [], left: [] };
  const pawn = positionAt(path, distanceM);
  const i = segmentIndex(path, Math.max(0, distanceM));
  const walked: LngLat[] = path.slice(0, i + 1).map((p) => [p[0], p[1]]);
  const left: LngLat[] = path.slice(i + 1).map((p) => [p[0], p[1]]);
  walked.push(pawn);
  left.unshift(pawn);
  return { walked, left };
}

/**
 * Drops points closer than `toleranceM` to the previous kept point, so long routes stay
 * light on the map. Ends are always kept.
 */
export function simplify(path: RoutePoint[], toleranceM: number): RoutePoint[] {
  if (path.length <= 2) return path;
  const kept: RoutePoint[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    if (path[i][2] - kept[kept.length - 1][2] >= toleranceM) kept.push(path[i]);
  }
  kept.push(path[path.length - 1]);
  return kept;
}

/** `[west, south, east, north]` around the route. */
export function bounds(path: RoutePoint[]): [number, number, number, number] {
  let [minLon, minLat, maxLon, maxLat] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lon, lat] of path) {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  }
  return [minLon, minLat, maxLon, maxLat];
}

/** Moves a point by `meters` towards `bearing` (degrees clockwise from north). */
export function offsetBy([lon, lat]: LngLat, bearing: number, meters: number): LngLat {
  const rad = (bearing * Math.PI) / 180;
  const dLat = (meters * Math.cos(rad)) / 111_320;
  const dLon = (meters * Math.sin(rad)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [lon + dLon, lat + dLat];
}

/**
 * Camera centre that shows the pawn in the middle of the free area of the
 * screen (above a bottom panel, left of a side panel) in a tilted view.
 * Computed here rather than with camera padding, which the iOS map applies
 * with the camera's current tilt and heading and so misses after a drag.
 */
export function followCenter(
  pawn: LngLat,
  view: { heading: number; zoom: number; pitch: number; height: number },
  free: { bottom: number; right: number },
): LngLat {
  // MapLibre: 512 px tiles and a vertical field of view of about 36.87 degrees.
  const metersPerPx =
    (40_075_016.686 * Math.cos((pawn[1] * Math.PI) / 180)) / (512 * 2 ** view.zoom);
  const toCenter = view.height / 2 / Math.tan((36.87 * Math.PI) / 360);
  const pitch = (view.pitch * Math.PI) / 180;
  // The free area's middle is `y` px above the screen centre: the pawn goes
  // there, farther from the camera, so the centre sits behind the pawn.
  const y = free.bottom / 2;
  const above = Math.atan(y / toCenter);
  const groundPx =
    toCenter * Math.cos(pitch) * Math.tan(pitch + above) - toCenter * Math.sin(pitch);
  const behind = offsetBy(pawn, view.heading + 180, groundPx * metersPerPx);
  return offsetBy(behind, view.heading + 90, (free.right / 2) * metersPerPx);
}
