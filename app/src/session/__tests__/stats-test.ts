import { computeDayStats } from '../stats';

jest.mock('@/api/queries', () => ({ useSessions: () => ({ data: [] }) }));
jest.mock('../store', () => ({ sessionsSince: () => [] }));

describe('computeDayStats', () => {
  it('gives the metres of each day of the week, Monday first', () => {
    // Thursday 12 November 2026, at noon.
    const now = new Date(2026, 10, 12, 12).getTime();
    const session = (day: number, m: number) => ({
      local_id: `s${day}${m}`,
      started_at: new Date(2026, 10, day, 18).toISOString(),
      distance_m: m,
      steps: 0,
      source: 'treadmill' as const,
    });
    const stats = computeDayStats(
      [session(9, 3_000), session(11, 2_000), session(11, 500), session(8, 9_000)] as never,
      [],
      now,
      1_200,
    );
    expect(stats.weekM).toEqual([3_000, 0, 2_500, 1_200, 0, 0, 0]);
  });
});
