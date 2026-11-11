import { estimateArrival, nextStage, stepsFor, streaks } from '../progress';
import { headingAt, positionAt, simplify, splitAt, type RoutePoint } from '../route';

// About 222 m due north, then 100 m east.
const path: RoutePoint[] = [
  [1, 47, 0],
  [1, 47.001, 111.2],
  [1, 47.002, 222.4],
  [1.0013, 47.002, 322.4],
];

describe('route', () => {
  it('interpolates the pawn position', () => {
    expect(positionAt(path, 0)).toEqual([1, 47]);
    const [lon, lat] = positionAt(path, 55.6);
    expect(lon).toBe(1);
    expect(lat).toBeCloseTo(47.0005, 6);
    expect(positionAt(path, 10_000)).toEqual([1.0013, 47.002]);
    expect(positionAt(path, -5)).toEqual([1, 47]);
  });

  it('gives the heading', () => {
    expect(headingAt(path, 100)).toBeCloseTo(0, 0);
    expect(headingAt(path, 300)).toBeCloseTo(90, 0);
  });

  it('splits at the pawn', () => {
    const { walked, left } = splitAt(path, 150);
    expect(walked).toHaveLength(3);
    expect(left).toHaveLength(3);
    expect(walked[walked.length - 1]).toEqual(left[0]);
  });

  it('simplifies but keeps both ends', () => {
    const simple = simplify(path, 200);
    expect(simple[0]).toBe(path[0]);
    expect(simple[simple.length - 1]).toBe(path[3]);
    expect(simple).toHaveLength(3);
  });
});

describe('progress', () => {
  const stages = [
    { position: 0, at_m: 0 },
    { position: 1, at_m: 24_000 },
    { position: 2, at_m: 54_000 },
  ];

  it('finds the next stage', () => {
    expect(nextStage(stages, 0)?.position).toBe(1);
    expect(nextStage(stages, 30_000)?.position).toBe(2);
    expect(nextStage(stages, 54_000)).toBeNull();
  });

  it('estimates the arrival', () => {
    const from = new Date('2026-11-11T12:00:00Z');
    const { sessions, date } = estimateArrival(45_000, 3, 4_500, from);
    expect(sessions).toBe(10);
    expect(Math.round((date.getTime() - from.getTime()) / 86_400_000)).toBe(24);
  });

  it('counts steps from the stride', () => {
    expect(stepsFor(1_000, 73)).toBe(1370);
    expect(stepsFor(700, null)).toBe(1000);
  });

  it('counts streaks', () => {
    const today = new Date('2026-11-11T18:00:00');
    const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-09', '2026-11-10'];
    expect(streaks(days, today)).toEqual({ current: 2, best: 3 });
    expect(streaks([...days, '2026-11-11'], today)).toEqual({ current: 3, best: 3 });
    expect(streaks(['2026-11-08'], today).current).toBe(0);
  });
});
