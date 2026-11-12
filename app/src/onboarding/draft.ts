import type { Place, RouteDetail } from '@/api/types';
import { estimateArrival } from '@/journey/progress';

/** A place with the short name shown on screen (the label may be a full address). */
export type NamedPlace = { place: Place; name: string };

/** What the walker chose so far; profile fields are saved step by step. */
export type Draft = {
  home: NamedPlace | null;
  destination: (NamedPlace & { distanceM: number }) | null;
  /** The route of the first journey, created when leaving the destination step. */
  route: RouteDetail | null;
  firstName: string;
  heightCm: number;
  /** Local picture shown while the avatar uploads. */
  photo: string | null;
  goal: number;
  perWeek: number;
};

export const GOALS = [5_000, 7_000, 10_000] as const;
export const RECOMMENDED_GOAL = 7_000;
export const PER_WEEK = [2, 3, 4, 5] as const;
export const HEIGHT_RANGE: [number, number] = [120, 220];

/** Stride estimated from height (specification: 0.415 x height). */
export function strideFor(heightCm: number): number {
  return Math.round(heightCm * 0.415);
}

/** Distance of a day's goal, in metres. */
export function goalMetres(goal: number, heightCm: number): number {
  return (goal * strideFor(heightCm)) / 100;
}

/** Length of the first journey: the real route once known, else the estimate. */
export function journeyMetres(draft: Draft): number | null {
  return draft.route?.distance_m ?? draft.destination?.distanceM ?? null;
}

/** When the walker arrives if each session reaches the daily goal. */
export function arrivalDate(draft: Draft, from = new Date()): Date | null {
  const metres = journeyMetres(draft);
  if (metres === null) return null;
  return estimateArrival(metres, draft.perWeek, goalMetres(draft.goal, draft.heightCm), from).date;
}
