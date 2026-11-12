import type { JourneyDetail, Participant } from '@/api/types';

import { racers, trackWindow } from '../race';

const person = (id: string, distance: number, extra: Partial<Participant> = {}): Participant => ({
  user_id: id,
  first_name: id,
  username: id,
  me: false,
  joined: true,
  distance_m: distance,
  arrived_at: null,
  rank: null,
  last_session_at: null,
  live: null,
  ...extra,
});

const race = (participants: Participant[]) =>
  ({ route_distance_m: 10_000, participants }) as unknown as JourneyDetail;

describe('racers', () => {
  it('ranks by distance, live positions first, and skips invited friends', () => {
    const detail = race([
      person('me', 3_000, { me: true }),
      person('lilou', 2_000),
      person('max', 9_000, { joined: false }),
    ]);
    const now = 100_000;
    const list = racers(detail, { lilou: { distanceM: 3_500, speedKmh: 5, at: now - 2_000 } }, now);
    expect(list.map((r) => [r.userId, r.place])).toEqual([
      ['lilou', 1],
      ['me', 2],
    ]);
    expect(list[0].speedKmh).toBe(5);
  });

  it('ignores stale live positions and counts my session under way', () => {
    const detail = race([person('me', 3_000, { me: true }), person('lilou', 2_000)]);
    const list = racers(detail, { lilou: { distanceM: 9_000, speedKmh: 5, at: 0 } }, 60_000, 3_400);
    expect(list[0]).toMatchObject({ userId: 'me', distanceM: 3_400 });
    expect(list[1]).toMatchObject({ distanceM: 2_000, speedKmh: null });
  });

  it('puts arrivals first, in arrival order', () => {
    const detail = race([
      person('me', 4_000, { me: true }),
      person('lilou', 10_000, { rank: 2, arrived_at: 'x' }),
      person('max', 10_000, { rank: 1, arrived_at: 'y' }),
    ]);
    expect(racers(detail, {}, 0).map((r) => r.userId)).toEqual(['max', 'lilou', 'me']);
  });
});

describe('trackWindow', () => {
  it('frames the walkers on round kilometres', () => {
    expect(trackWindow([39_000, 50_100, 52_500])).toEqual({ startM: 35_000, endM: 55_000 });
  });

  it('keeps at least 10 km and starts at 0 at most', () => {
    expect(trackWindow([1_200, 1_500])).toEqual({ startM: 0, endM: 10_000 });
  });
});
