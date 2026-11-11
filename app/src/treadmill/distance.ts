import type { TreadmillData } from './ftms';

/** The Luma counter moves in 100 m steps, rounded to the nearest step. */
const HALF_STEP_M = 50;
/** The counter flips a few metres late: allow the integral to run ahead a bit. */
const LAG_TOLERANCE_M = 15;
/** Beyond this gap between frames, trust the counter rather than extrapolating. */
const MAX_GAP_MS = 10_000;

/**
 * Credited distance for one session: speed integrated at every frame,
 * re-anchored on the treadmill distance counter (see tools/ble-probe/README.md).
 */
export class DistanceTracker {
  private integralM = 0;
  private lastTimeMs: number | null = null;
  private lastSpeedKmh = 0;
  private baselineM: number | null = null;
  private lastRawCounterM: number | null = null;
  private counterM: number | null = null;

  /** Distance to display and to sync, in metres. Never decreases. */
  get distanceM(): number {
    return this.integralM;
  }

  update(data: TreadmillData, timeMs: number): void {
    if (this.lastTimeMs !== null) {
      const gap = timeMs - this.lastTimeMs;
      if (gap > 0 && gap <= MAX_GAP_MS) {
        this.integralM += (this.lastSpeedKmh / 3.6) * (gap / 1000);
      }
    }
    this.lastTimeMs = timeMs;
    this.lastSpeedKmh = data.speedKmh;

    if (data.distanceM !== undefined) {
      this.updateCounter(data.distanceM);
      const counter = this.counterM ?? 0;
      const low = counter - HALF_STEP_M;
      const high = counter + HALF_STEP_M + LAG_TOLERANCE_M;
      this.integralM = Math.max(this.integralM, low);
      this.integralM = Math.min(this.integralM, high);
    }
    this.integralM = Math.max(this.integralM, 0);
  }

  /** Distance to credit when the session ends. */
  finalDistanceM(): number {
    if (this.counterM === null) return this.integralM;
    const withinStep = Math.abs(this.integralM - this.counterM) <= HALF_STEP_M;
    return withinStep ? this.integralM : this.counterM;
  }

  private updateCounter(rawM: number): void {
    if (this.baselineM === null) {
      this.baselineM = rawM;
    } else if (this.lastRawCounterM !== null && rawM < this.lastRawCounterM) {
      // The treadmill restarted its counter mid-session: keep counting from where we were.
      this.baselineM = rawM - (this.counterM ?? 0);
    }
    this.lastRawCounterM = rawM;
    this.counterM = rawM - this.baselineM;
  }
}
