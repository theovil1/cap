import { useSyncExternalStore } from 'react';

import type { UserProfile } from '@/api/types';
import { getValue, setValue } from '@/session/store';

export type AppColor = 'orange' | 'blue' | 'green' | 'purple' | 'pink';
export type MapMood = 'auto' | 'day' | 'night';
export type Units = 'km' | 'mi';

type Appearance = { appColor: AppColor; mapMood: MapMood; units: Units };

const DEFAULTS: Appearance = { appColor: 'orange', mapMood: 'auto', units: 'km' };

/** Kept on the phone so the first screen already has the right colours. */
let current: Appearance = { ...DEFAULTS, ...(getValue<Appearance>('appearance') ?? {}) };
const listeners = new Set<() => void>();

let onUnits: ((units: Units) => void) | null = null;

/** Lets the text formatting follow the units without an import cycle. */
export function onUnitsChange(handler: (units: Units) => void) {
  onUnits = handler;
  handler(current.units);
}

export function getAppearance(): Appearance {
  return current;
}

/** Follows the profile from the server (or a change made on this phone). */
export function syncAppearance(user: Pick<UserProfile, 'app_color' | 'map_mood' | 'units'>) {
  const next: Appearance = { appColor: user.app_color, mapMood: user.map_mood, units: user.units };
  if (
    next.appColor === current.appColor &&
    next.mapMood === current.mapMood &&
    next.units === current.units
  ) {
    return;
  }
  const unitsChanged = next.units !== current.units;
  current = next;
  setValue('appearance', next);
  if (unitsChanged) onUnits?.(next.units);
  listeners.forEach((listener) => listener());
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
