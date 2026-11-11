/** Average session length used for estimates until the walker has a history. */
export const DEFAULT_SESSION_M = 4_500;

export type StageLike = { position: number; at_m: number };

/** The next stage ahead of the walker, or null once arrived. */
export function nextStage<T extends StageLike>(stages: T[], walkedM: number): T | null {
  return stages.find((s) => s.position > 0 && s.at_m > walkedM) ?? null;
}

/** Sessions still needed and estimated arrival date. */
export function estimateArrival(
  leftM: number,
  sessionsPerWeek: number,
  averageSessionM = DEFAULT_SESSION_M,
  from = new Date(),
): { sessions: number; date: Date } {
  const sessions = Math.max(1, Math.ceil(leftM / Math.max(averageSessionM, 500)));
  const days = Math.ceil((sessions / Math.max(sessionsPerWeek, 1)) * 7);
  return { sessions, date: new Date(from.getTime() + days * 86_400_000) };
}

/** Steps estimated from the treadmill distance (specification: distance / stride). */
export function stepsFor(distanceM: number, strideCm: number | null | undefined): number {
  const stride = strideCm && strideCm > 0 ? strideCm : 70;
  return Math.round((distanceM * 100) / stride);
}

/** Minutes per kilometre, or null when standing still. */
export function paceMinPerKm(speedKmh: number): number | null {
  return speedKmh > 0.5 ? 60 / speedKmh : null;
}

/** Local calendar day, e.g. `2026-11-11`. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Active days in a row, ending today or yesterday (a streak is not lost before the day
 * is over), and the best streak ever. A day is active with any treadmill session.
 */
export function streaks(
  activeDays: Iterable<string>,
  today = new Date(),
): { current: number; best: number } {
  const days = new Set(activeDays);
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let previous: number | null = null;
  for (const key of sorted) {
    const time = new Date(`${key}T12:00:00`).getTime();
    run = previous !== null && Math.round((time - previous) / 86_400_000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = time;
  }
  const back = (n: number) => dayKey(new Date(today.getTime() - n * 86_400_000));
  let current = 0;
  let offset = days.has(back(0)) ? 0 : 1;
  while (days.has(back(offset))) {
    current++;
    offset++;
  }
  return { current, best };
}
