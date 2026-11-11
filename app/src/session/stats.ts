import { useEffect, useMemo, useState } from 'react';

import { useSessions } from '@/api/queries';
import type { SessionItem } from '@/api/types';
import { dayKey, streaks } from '@/journey/progress';

import { sessionsSince, type StoredSession } from './store';

const DAY_MS = 86_400_000;

export type DayStats = {
  todaySteps: number;
  todayM: number;
  streak: number;
  bestStreak: number;
  /** The last seven days, oldest first: true when active. */
  week: boolean[];
};

/** Merges the server history with sessions still on the phone (same local id = same session). */
export function computeDayStats(
  remote: SessionItem[],
  local: StoredSession[],
  nowMs: number,
  extraM = 0,
  extraSteps = 0,
): DayStats {
  const byId = new Map<string, { day: string; m: number; steps: number }>();
  for (const s of remote) {
    if (s.source !== 'treadmill') continue;
    byId.set(s.local_id, { day: dayKey(new Date(s.started_at)), m: s.distance_m, steps: s.steps });
  }
  for (const s of local) {
    byId.set(s.localId, { day: dayKey(new Date(s.startedAt)), m: s.distanceM, steps: s.steps });
  }
  const now = new Date(nowMs);
  const today = dayKey(now);
  let todaySteps = extraSteps;
  let todayM = extraM;
  const days = new Set<string>();
  for (const s of byId.values()) {
    days.add(s.day);
    if (s.day === today) {
      todaySteps += s.steps;
      todayM += s.m;
    }
  }
  if (extraM > 0) days.add(today);
  const { current, best } = streaks(days, now);
  const week = Array.from({ length: 7 }, (_, i) =>
    days.has(dayKey(new Date(nowMs - (6 - i) * DAY_MS))),
  );
  return { todaySteps, todayM, streak: current, bestStreak: best, week };
}

/** Current time, refreshed every minute so "today" changes at midnight. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Steps of the day and streak; right even offline, with the session in progress added. */
export function useDayStats(extraM = 0, extraSteps = 0): DayStats {
  const { data: remote = [] } = useSessions();
  const now = useNow();
  return useMemo(
    () => computeDayStats(remote, sessionsSince(now - 400 * DAY_MS), now, extraM, extraSteps),
    [remote, now, extraM, extraSteps],
  );
}
