import { arrivalDate, goalMetres, journeyMetres, strideFor, type Draft } from '../draft';

const draft: Draft = {
  home: { place: { label: 'Romorantin', lat: 47.36, lon: 1.74 }, name: 'Romorantin' },
  destination: {
    place: { label: 'Paris', lat: 48.8566, lon: 2.3522 },
    name: 'Paris',
    distanceM: 201_000,
  },
  route: null,
  firstName: 'Théo',
  heightCm: 176,
  photo: null,
  goal: 7_000,
  perWeek: 3,
};

describe('onboarding draft', () => {
  it('estimates the stride and the distance of a daily goal', () => {
    // The mockups: 176 cm gives a 73 cm stride, 7 000 steps about 5,1 km.
    expect(strideFor(176)).toBe(73);
    expect(goalMetres(7_000, 176)).toBeCloseTo(5_110);
  });

  it('prefers the real route length over the estimate', () => {
    expect(journeyMetres(draft)).toBe(201_000);
    const route = { id: 'r', start: draft.home!.place, end: draft.destination!.place };
    expect(
      journeyMetres({ ...draft, route: { ...route, distance_m: 198_000, path: [], stages: [] } }),
    ).toBe(198_000);
    expect(journeyMetres({ ...draft, destination: null })).toBeNull();
  });

  it('dates the arrival from the goal and the sessions per week', () => {
    const from = new Date('2026-11-13T12:00:00Z');
    // 201 km at 5,11 km a session: 40 sessions, 3 a week: 94 days.
    const date = arrivalDate(draft, from)!;
    expect(Math.round((date.getTime() - from.getTime()) / 86_400_000)).toBe(94);
    expect(arrivalDate({ ...draft, destination: null }, from)).toBeNull();
  });
});
