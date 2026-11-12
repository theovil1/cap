import { useEffect, useState } from 'react';

import type { JourneyDetail } from '@/api/types';
import type { Rival } from '@/map/route-map';

import { useRivalPositions } from './live-client';
import { racers, type Racer } from './race';

/** Current time, refreshed every few seconds so live positions expire on screen. */
function useClock(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/** Walkers of a race, in order, with live positions; empty for a solo journey. */
export function useRacers(detail: JourneyDetail | null, myDistanceM?: number): Racer[] {
  const heard = useRivalPositions(detail?.id);
  const now = useClock(4_000);
  if (!detail || detail.kind !== 'race') return [];
  return racers(detail, heard, now, myDistanceM);
}

/** The other walkers as map pawns. */
export function rivalPawns(list: Racer[]): Rival[] {
  return list
    .filter((r) => !r.me)
    .map((r) => ({
      id: r.userId,
      initial: r.firstName,
      distanceM: r.distanceM,
      speedMps: (r.speedKmh ?? 0) / 3.6,
    }));
}
