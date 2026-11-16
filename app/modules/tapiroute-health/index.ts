import { requireOptionalNativeModule } from 'expo';

export type WorkoutRecord = {
  startMs: number;
  endMs: number;
  distanceM: number;
  steps: number;
  running: boolean;
  /** `[timeMs, beatsPerMinute]` pairs from a heart rate sensor. */
  heartRates: [number, number][];
};

type NativeHealth = {
  isAvailable(): boolean;
  requestAuthorization(): Promise<boolean>;
  saveWorkout(workout: WorkoutRecord): Promise<boolean>;
  heartRateBetween(
    startMs: number,
    endMs: number,
  ): Promise<{ average: number; max: number } | null>;
  stepsToday(): Promise<number>;
};

/** Missing in builds made before the Health module: the app then skips Apple Health. */
export const TapirouteHealth = requireOptionalNativeModule<NativeHealth>('TapirouteHealth');
