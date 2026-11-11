import { DistanceTracker } from '@/treadmill/distance';
import type { TreadmillData } from '@/treadmill/ftms';

/** The session ends after the belt has stood still this long. */
export const STOP_AFTER_MS = 90_000;
/** One point of the speed curve every this many milliseconds. */
const SAMPLE_EVERY_MS = 15_000;
/** Shorter sessions are treated as accidental and dropped. */
export const MIN_DISTANCE_M = 50;

/** Everything needed to resume a session after the app was killed. */
export type LiveSnapshot = {
  localId: string;
  startedAt: number;
  updatedAt: number;
  distanceM: number;
  movingMs: number;
  inclineSum: number;
  speeds: number[];
};

export type FinishedSession = {
  localId: string;
  startedAt: number;
  endedAt: number;
  distanceM: number;
  durationS: number;
  avgInclinePct: number;
  /** Average speed every 15 s, in km/h, for the summary curve. */
  speeds: number[];
};

export type LiveSession = LiveSnapshot & { speedKmh: number; inclinePct: number };

/**
 * One treadmill session: starts when the belt moves, credits distance with the
 * DistanceTracker and ends after a long stop. Pure logic, fed with frames and times.
 */
export class SessionRecorder {
  private tracker: DistanceTracker | null = null;
  private snapshot: LiveSnapshot | null = null;
  /** Distance already credited before a resume. */
  private offsetM = 0;
  private lastFrameAt: number | null = null;
  private stillSince: number | null = null;
  private sampleSum = 0;
  private sampleMs = 0;
  private speedKmh = 0;
  private inclinePct = 0;

  constructor(private readonly newId: () => string) {}

  get live(): LiveSession | null {
    if (!this.snapshot) return null;
    return { ...this.snapshot, speedKmh: this.speedKmh, inclinePct: this.inclinePct };
  }

  /** Continues a session saved before the app was closed. */
  resume(saved: LiveSnapshot): void {
    this.snapshot = { ...saved, speeds: [...saved.speeds] };
    this.offsetM = saved.distanceM;
    this.tracker = new DistanceTracker();
  }

  /** Feeds one frame. Returns the finished session when this frame ends it. */
  update(data: TreadmillData, timeMs: number): FinishedSession | null {
    this.speedKmh = data.speedKmh;
    this.inclinePct = data.inclinePct ?? 0;
    if (!this.snapshot) {
      if (data.speedKmh <= 0) return null;
      this.snapshot = {
        localId: this.newId(),
        startedAt: timeMs,
        updatedAt: timeMs,
        distanceM: 0,
        movingMs: 0,
        inclineSum: 0,
        speeds: [],
      };
      this.tracker = new DistanceTracker();
    }
    const snap = this.snapshot;
    const tracker = this.tracker ?? new DistanceTracker();
    this.tracker = tracker;

    const gap = this.lastFrameAt === null ? 0 : Math.min(timeMs - this.lastFrameAt, 10_000);
    this.lastFrameAt = timeMs;
    if (gap > 0 && data.speedKmh > 0) {
      snap.movingMs += gap;
      snap.inclineSum += this.inclinePct * gap;
    }
    if (gap > 0) {
      this.sampleSum += data.speedKmh * gap;
      this.sampleMs += gap;
      if (this.sampleMs >= SAMPLE_EVERY_MS) {
        snap.speeds.push(Math.round((this.sampleSum / this.sampleMs) * 10) / 10);
        this.sampleSum = 0;
        this.sampleMs = 0;
      }
    }

    tracker.update(data, timeMs);
    snap.distanceM = this.offsetM + tracker.distanceM;
    snap.updatedAt = timeMs;

    if (data.speedKmh > 0) {
      this.stillSince = null;
    } else {
      this.stillSince ??= timeMs;
      if (timeMs - this.stillSince >= STOP_AFTER_MS) return this.finish(this.stillSince);
    }
    return null;
  }

  /** Ends the session now (button, or the treadmill went away). Null if too short. */
  finish(endedAt = this.snapshot?.updatedAt ?? Date.now()): FinishedSession | null {
    const snap = this.snapshot;
    const distanceM = snap ? this.offsetM + (this.tracker?.finalDistanceM() ?? 0) : 0;
    this.reset();
    if (!snap || distanceM < MIN_DISTANCE_M) return null;
    const durationS = Math.max(1, Math.round(snap.movingMs / 1000));
    return {
      localId: snap.localId,
      startedAt: snap.startedAt,
      endedAt: Math.max(endedAt, snap.startedAt + durationS * 1000),
      distanceM: Math.round(distanceM * 10) / 10,
      durationS,
      avgInclinePct:
        snap.movingMs > 0 ? Math.round((snap.inclineSum / snap.movingMs) * 10) / 10 : 0,
      speeds: snap.speeds,
    };
  }

  private reset(): void {
    this.tracker = null;
    this.snapshot = null;
    this.offsetM = 0;
    this.lastFrameAt = null;
    this.stillSince = null;
    this.sampleSum = 0;
    this.sampleMs = 0;
  }
}
