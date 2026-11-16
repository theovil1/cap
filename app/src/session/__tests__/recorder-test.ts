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
  it('keeps one heart rate value every 5 s, only while recording', () => {
    const recorder = newRecorder();
    recorder.addHeartRate(90, 0);
    walk(recorder, 0, 60, 6);
    for (let s = 0; s < 60; s++) recorder.addHeartRate(120, s * 1000);
    const finished = recorder.finish(60_000);
    expect(finished?.heartRates).toHaveLength(12);
    expect(finished?.heartRates?.[0]).toEqual([0, 120]);
  });

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
  it('credits what the counter walked while the app was closed', () => {
    const recorder = newRecorder();
    for (let s = 0; s < 120; s++)
      recorder.update({ speedKmh: 6, distanceM: Math.round((s * 6) / 3.6 / 100) * 100 }, s * 1000);
    const saved = recorder.live!;
    expect(saved.rawCounterM).toBe(200);
    // Closed for two minutes at 6 km/h: the counter moved on by 200 m.
    const resumed = newRecorder();
    resumed.resume(saved);
    resumed.update({ speedKmh: 6, distanceM: 400 }, 240_000);
    expect(resumed.live!.distanceM).toBeGreaterThan(saved.distanceM + 140);
  });

  it('counts the time behind a Bluetooth gap so the speed stays credible', () => {
    const recorder = newRecorder();
    for (let s = 0; s <= 60; s++)
      recorder.update({ speedKmh: 6, distanceM: Math.round((s * 6) / 3.6 / 100) * 100 }, s * 1000);
    // Three minutes without frames, the belt kept going: 300 m more on the counter.
    recorder.update({ speedKmh: 6, distanceM: 400 }, 240_000);
    const finished = recorder.finish()!;
    expect((finished.distanceM / finished.durationS) * 3.6).toBeLessThan(8);
  });

  it('does not start a new session while the belt slows down after Finish', () => {
    const recorder = newRecorder();
    walk(recorder, 0, 120, 5);
    expect(recorder.finishByHand(120_000)).not.toBeNull();
    walk(recorder, 120_000, 5, 2);
    expect(recorder.live).toBeNull();
    walk(recorder, 125_000, 2, 0);
    walk(recorder, 127_000, 5, 4);
    expect(recorder.live).not.toBeNull();
  });
});
