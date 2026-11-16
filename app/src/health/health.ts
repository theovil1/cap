import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { TapirouteHealth } from '../../modules/tapiroute-health';
import type { FinishedSession } from '@/session/recorder';
import { getValue, setValue } from '@/session/store';

/** Per device: Apple Health linked from the onboarding or My account. */
const KEY = 'appleHealth';
/** Running from this average speed on: the workout is saved as a run. */
const RUN_FROM_KMH = 7;

export function healthSupported(): boolean {
  return TapirouteHealth?.isAvailable() ?? false;
}

export function healthEnabled(): boolean {
  return healthSupported() && (getValue<boolean>(KEY) ?? false);
}

/** Asks iOS for access (once; later changes happen in the Health app) and remembers the choice. */
export async function setHealthEnabled(on: boolean): Promise<boolean> {
  if (on) {
    if (!TapirouteHealth || !(await TapirouteHealth.requestAuthorization().catch(() => false)))
      return false;
  }
  setValue(KEY, on);
  return on;
}

/** Saves a finished treadmill session as an indoor walk or run. Never throws. */
export async function saveToHealth(session: FinishedSession, steps: number): Promise<void> {
  if (!TapirouteHealth || !healthEnabled()) return;
  const kmh = session.distanceM / 1000 / (session.durationS / 3600);
  await TapirouteHealth.saveWorkout({
    startMs: session.startedAt,
    endMs: session.endedAt,
    distanceM: session.distanceM,
    steps,
    running: kmh >= RUN_FROM_KMH,
    heartRates: session.heartRates ?? [],
  }).catch(() => {});
}

/** Average and highest heart rate a watch wrote to Health during a session. */
export async function heartFromHealth(startMs: number, endMs: number) {
  if (!TapirouteHealth || !healthEnabled()) return null;
  const found = await TapirouteHealth.heartRateBetween(startMs, endMs).catch(() => null);
  return found ? { average: Math.round(found.average), max: Math.round(found.max) } : null;
}

/** Steps of the day in Health (every source, already deduplicated by iOS), or null. */
export function useHealthStepsToday(refreshKey?: unknown): number | null {
  const [steps, setSteps] = useState<number | null>(null);
  useEffect(() => {
    if (!TapirouteHealth || !healthEnabled()) return;
    let alive = true;
    const read = () =>
      TapirouteHealth?.stepsToday()
        .then((n) => alive && setSteps(Math.round(n)))
        .catch(() => {});
    read();
    const timer = setInterval(read, 60_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && read());
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [refreshKey]);
  return steps;
}
