import { calibrated, correction } from '../calibration';

jest.mock('@/session/store', () => ({ getValue: () => null, setValue: () => {} }));

describe('calibration', () => {
  it('turns the console speed into a correction', () => {
    expect(correction(4, 4)).toBe(1);
    expect(correction(4.2, 4)).toBe(1.05);
  });

  it('refuses a correction that cannot be real', () => {
    expect(correction(8, 4)).toBeNull();
    expect(correction(4, 0)).toBeNull();
  });

  it('corrects speed and distance', () => {
    expect(calibrated({ speedKmh: 4, distanceM: 1000, inclinePct: 2 }, 1.05)).toEqual({
      speedKmh: 4.2,
      distanceM: 1050,
      inclinePct: 2,
    });
  });
});
