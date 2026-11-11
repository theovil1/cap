import reference from '@/treadmill/__tests__/fixtures/luma-reference.json';
import { decodeTreadmillData, hexToBytes } from '@/treadmill/ftms';

import { SessionRecorder, STOP_AFTER_MS } from '../recorder';

let ids = 0;
const newRecorder = () => new SessionRecorder(() => `id-${++ids}`);

/** Frames every second at a constant speed. */
function walk(recorder: SessionRecorder, fromMs: number, seconds: number, speedKmh: number) {
  let finished = null;
  for (let s = 0; s < seconds; s++) {
    finished = recorder.update({ speedKmh, inclinePct: 2 }, fromMs + s * 1000) ?? finished;
  }
  return finished;
}

describe('SessionRecorder', () => {
  it('waits for the belt to move', () => {
    const recorder = newRecorder();
    expect(walk(recorder, 0, 30, 0)).toBeNull();
    expect(recorder.live).toBeNull();
  });

  it('ends after a long stop with the distance walked', () => {
    const recorder = newRecorder();
    walk(recorder, 0, 600, 6);
    expect(recorder.live?.distanceM).toBeCloseTo(998, -1);
    const finished = walk(recorder, 600_000, STOP_AFTER_MS / 1000 + 2, 0);
    expect(finished).not.toBeNull();
    expect(finished?.distanceM).toBeCloseTo(998, -1);
    expect(finished?.durationS).toBe(599);
    expect(finished?.avgInclinePct).toBe(2);
    expect(finished?.speeds.length).toBeGreaterThan(30);
    expect(recorder.live).toBeNull();
  });

  it('keeps going through a short pause', () => {
    const recorder = newRecorder();
    walk(recorder, 0, 60, 5);
    expect(walk(recorder, 60_000, 30, 0)).toBeNull();
    walk(recorder, 90_000, 60, 5);
    expect(recorder.live?.movingMs).toBe(119_000);
  });

  it('resumes after the app was killed', () => {
    const recorder = newRecorder();
    walk(recorder, 0, 300, 6);
    const saved = recorder.live!;
    const resumed = newRecorder();
    resumed.resume(saved);
    walk(resumed, 400_000, 300, 6);
    const finished = resumed.finish();
    expect(finished?.localId).toBe(saved.localId);
    expect(finished?.distanceM).toBeCloseTo(saved.distanceM + 498, -1);
  });

  it('drops accidental sessions', () => {
    const recorder = newRecorder();
    walk(recorder, 0, 10, 3);
    expect(recorder.finish()).toBeNull();
  });

  it('credits the Luma reference session like the tracker', () => {
    const recorder = newRecorder();
    for (const [tMs, hex] of reference as [number, string][]) {
      const data = decodeTreadmillData(hexToBytes(hex));
      if (data) recorder.update(data, tMs);
    }
    const finished = recorder.finish();
    expect(finished?.distanceM).toBeGreaterThan(199);
    expect(finished?.distanceM).toBeLessThan(204);
  });
});
