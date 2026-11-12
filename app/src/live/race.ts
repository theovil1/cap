import type { JourneyDetail } from '@/api/types';

import { LIVE_FOR_MS, type RivalPosition } from './live-client';

/** One walker of a race as shown on screen. */
export type Racer = {
  userId: string;
  firstName: string;
  me: boolean;
  distanceM: number;
  /** Set while they walk right now. */
  speedKmh: number | null;
  arrivedAt: string | null;
  lastSessionAt: string | null;
  /** Place in the race, from 1. */
  place: number;
};

/**
 * Walkers of a race in order: arrived first (by arrival), then by distance.
 * Live positions heard on the socket win over the last synced distance, and the
 * current user's session under way counts with `myDistanceM`.
 */
export function racers(
  detail: JourneyDetail,
  heard: Record<string, RivalPosition>,
  now: number,
  myDistanceM?: number,
): Racer[] {
  const list = detail.participants
    .filter((p) => p.joined)
    .map((p) => {
      const fresh = heard[p.user_id] && now - heard[p.user_id].at <= LIVE_FOR_MS;
      const live = p.me ? null : fresh ? heard[p.user_id] : null;
      const distanceM = p.me
        ? (myDistanceM ?? p.distance_m)
        : live
          ? live.distanceM
          : (p.live?.distance_m ?? p.distance_m);
      return {
        userId: p.user_id,
        firstName: p.first_name,
        me: p.me,
        distanceM: Math.min(distanceM, detail.route_distance_m),
        speedKmh: live ? live.speedKmh : (p.live?.speed_kmh ?? null),
        arrivedAt: p.arrived_at,
        lastSessionAt: p.last_session_at,
        rank: p.rank,
        place: 0,
      };
    });
  list.sort((a, b) => {
    if (a.rank !== null || b.rank !== null) return (a.rank ?? Infinity) - (b.rank ?? Infinity);
    return b.distanceM - a.distanceM;
  });
  return list.map(({ rank: _rank, ...racer }, i) => ({ ...racer, place: i + 1 }));
}

/**
 * Stretch of road shown on the home race track: a little room around the
 * walkers, rounded to 5 km, at least 10 km long.
 */
export function trackWindow(distancesM: number[]): { startM: number; endM: number } {
  const step = 5_000;
  const min = Math.min(...distancesM);
  const max = Math.max(...distancesM);
  const room = Math.max(1_000, (max - min) * 0.25);
  const startM = Math.max(0, Math.floor((min - room) / step) * step);
  let endM = Math.ceil((max + room * 0.6) / step) * step;
  if (endM - startM < 2 * step) {
    endM = startM + 2 * step;
  }
  if (endM <= max) endM = max + step;
  return { startM, endM };
}
