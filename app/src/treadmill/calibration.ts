import { useSyncExternalStore } from 'react';

import { getValue, setValue } from '@/session/store';

import type { TreadmillData } from './ftms';

/** The treadmill added with the wizard: its Bluetooth name, a name for people, a correction. */
export type SavedTreadmill = {
  /** Name it gives in Bluetooth, e.g. `FS-A1B2`. */
  deviceName: string;
  /** Name the walker chose, e.g. `Zipro Luma`. */
  label: string;
  /** Console speed divided by the Bluetooth speed; 1 when they agree. */
  factor: number;
};

const KEY = 'treadmill';
/** A correction outside this range means a misread, not a calibration. */
export const FACTOR_RANGE: [number, number] = [0.7, 1.3];

// Read from the phone on first use, not when the module loads.
let saved: SavedTreadmill | null | undefined;
const listeners = new Set<() => void>();

export function getSavedTreadmill(): SavedTreadmill | null {
  if (saved === undefined) saved = getValue<SavedTreadmill>(KEY);
  return saved;
}

export function saveTreadmill(next: SavedTreadmill): void {
  saved = next;
  setValue(KEY, next);
  listeners.forEach((listener) => listener());
}

export function useSavedTreadmill(): SavedTreadmill | null {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, getSavedTreadmill);
}

/** Correction for the treadmill connected now (1 for any other one). */
export function factorFor(deviceName: string | null): number {
  const treadmill = getSavedTreadmill();
  return treadmill && deviceName && treadmill.deviceName === deviceName ? treadmill.factor : 1;
}

/** Console speed over Bluetooth speed, or null when it cannot be a real correction. */
export function correction(consoleKmh: number, bluetoothKmh: number): number | null {
  if (!(consoleKmh > 0) || !(bluetoothKmh > 0)) return null;
  const factor = Math.round((consoleKmh / bluetoothKmh) * 1000) / 1000;
  return factor >= FACTOR_RANGE[0] && factor <= FACTOR_RANGE[1] ? factor : null;
}

/** A frame as the console would show it: speed and distance corrected. */
export function calibrated(frame: TreadmillData, factor: number): TreadmillData {
  if (factor === 1) return frame;
  return {
    ...frame,
    speedKmh: frame.speedKmh * factor,
    distanceM: frame.distanceM === undefined ? undefined : frame.distanceM * factor,
  };
}
