import { DistanceTracker } from '../distance';
import { decodeTreadmillData, hexToBytes } from '../ftms';
import reference from './fixtures/luma-reference.json';

/** Replays the Zipro Luma reference recording (tools/ble-probe/recordings). */
function replay(tracker: DistanceTracker) {
  const samples: { counter: number; credited: number }[] = [];
  for (const [tMs, hex] of reference as [number, string][]) {
    const data = decodeTreadmillData(hexToBytes(hex));
    if (!data) continue;
    tracker.update(data, tMs);
    samples.push({ counter: data.distanceM ?? 0, credited: tracker.distanceM });
  }
  return samples;
}

describe('DistanceTracker', () => {
  it('integrates speed over time', () => {
    const tracker = new DistanceTracker();
    tracker.update({ speedKmh: 3.6 }, 0);
    tracker.update({ speedKmh: 3.6 }, 10_000);
    expect(tracker.distanceM).toBeCloseTo(10, 5);
  });

  it('matches the reference session within 1 %', () => {
    const tracker = new DistanceTracker();
    replay(tracker);
    expect(tracker.distanceM).toBeGreaterThan(199);
    expect(tracker.distanceM).toBeLessThan(204);
    expect(tracker.finalDistanceM()).toBeCloseTo(tracker.distanceM, 5);
  });

  it('never drifts more than 65 m from the treadmill counter and never goes back', () => {
    const samples = replay(new DistanceTracker());
    let previous = 0;
    for (const { counter, credited } of samples) {
      expect(Math.abs(credited - counter)).toBeLessThanOrEqual(65);
      expect(credited).toBeGreaterThanOrEqual(previous);
      previous = credited;
    }
  });

  it('re-anchors on the counter when the integral lags behind', () => {
    const tracker = new DistanceTracker();
    tracker.update({ speedKmh: 0, distanceM: 0 }, 0);
    tracker.update({ speedKmh: 0, distanceM: 300 }, 1_000);
    expect(tracker.distanceM).toBe(250);
  });

  it('caps the integral when the counter stays behind', () => {
    const tracker = new DistanceTracker();
    tracker.update({ speedKmh: 36, distanceM: 0 }, 0);
    tracker.update({ speedKmh: 36, distanceM: 0 }, 10_000); // 100 m integrated
    expect(tracker.distanceM).toBe(65);
    expect(tracker.finalDistanceM()).toBe(0);
  });

  it('uses the counter after a long gap instead of extrapolating', () => {
    const tracker = new DistanceTracker();
    tracker.update({ speedKmh: 4, distanceM: 0 }, 0);
    tracker.update({ speedKmh: 4, distanceM: 500 }, 600_000);
    expect(tracker.distanceM).toBe(450);
  });

  it('measures relative to the counter value at session start', () => {
    const tracker = new DistanceTracker();
    tracker.update({ speedKmh: 0, distanceM: 1200 }, 0);
    expect(tracker.distanceM).toBe(0);
    tracker.update({ speedKmh: 0, distanceM: 1300 }, 1_000);
    expect(tracker.distanceM).toBe(50);
  });

  it('works without a distance counter', () => {
    const tracker = new DistanceTracker();
    tracker.update({ speedKmh: 7.2 }, 0);
    tracker.update({ speedKmh: 7.2 }, 5_000);
    expect(tracker.finalDistanceM()).toBeCloseTo(10, 5);
  });
});
