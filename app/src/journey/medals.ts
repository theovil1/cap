import type { JourneySummary } from '@/api/types';
import type { Metal } from '@/tokens';

/** What a medal needs of a finished journey (mine, or another walker's). */
export type MedalJourney = Pick<
  JourneySummary,
  | 'id'
  | 'kind'
  | 'rank'
  | 'arrived_at'
  | 'start'
  | 'end'
  | 'start_town'
  | 'end_town'
  | 'route_distance_m'
> & { title?: string | null };

type Ribbon = 'cap' | 'green' | 'blue' | 'black' | 'locked';

/** One medal of the profile, won or the next one to win. */
export type EarnedMedal =
  | { kind: 'journey'; journey: MedalJourney; metal: Metal; ribbon: Ribbon }
  | { kind: 'distance'; km: number; metal: Metal; ribbon: Ribbon; progress?: number }
  | { kind: 'streak'; days: number; metal: Metal; ribbon: Ribbon }
  | { kind: 'race'; journey: MedalJourney; place: number; metal: Metal; ribbon: Ribbon };

/** Levels of the medal board: bronze, silver, gold, then Cap, the rarest. */
const LEVELS: { metal: Metal; ribbon: Ribbon }[] = [
  { metal: 'bronze', ribbon: 'green' },
  { metal: 'silver', ribbon: 'blue' },
  { metal: 'gold', ribbon: 'cap' },
  { metal: 'cap', ribbon: 'black' },
];
export const DISTANCE_KM = [100, 500, 1_000, 5_000];
export const STREAK_DAYS = [7, 30, 100, 365];

/**
 * Medals won from what the walker did: every finished journey (gold), the
 * cumulated distance and the best streak by level, the place in each
 * finished race; then the next distance medal, locked, with its progress.
 */
export function medalsFor({
  journeys,
  totalM,
  bestStreak,
}: {
  journeys: MedalJourney[];
  totalM: number;
  bestStreak: number;
}): EarnedMedal[] {
  const arrived = journeys
    .filter((j) => j.arrived_at)
    .sort((a, b) => Date.parse(b.arrived_at ?? '') - Date.parse(a.arrived_at ?? ''));
  const medals: EarnedMedal[] = [];
  for (const j of arrived) {
    if (j.kind === 'race' && j.rank !== null) {
      const level = j.rank === 1 ? LEVELS[2] : j.rank <= 3 ? LEVELS[1] : LEVELS[0];
      medals.push({ kind: 'race', journey: j, place: j.rank, ...level });
    } else {
      medals.push({ kind: 'journey', journey: j, metal: 'gold', ribbon: 'cap' });
    }
  }
  const km = totalM / 1000;
  DISTANCE_KM.forEach((step, i) => {
    if (km >= step) medals.push({ kind: 'distance', km: step, ...LEVELS[i] });
  });
  STREAK_DAYS.forEach((step, i) => {
    if (bestStreak >= step) medals.push({ kind: 'streak', days: step, ...LEVELS[i] });
  });
  const next = DISTANCE_KM.find((step) => km < step);
  if (next) {
    medals.push({
      kind: 'distance',
      km: next,
      metal: 'locked',
      ribbon: 'locked',
      progress: km / next,
    });
  }
  return medals;
}
