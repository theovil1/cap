import { smoothStep } from '../smooth';

describe('smoothStep', () => {
  it('keeps walking at the treadmill speed between frames', () => {
    // 1.5 m/s, the last frame said 100 m half a second ago: about 100.75 m.
    let shown = 100;
    for (let i = 0; i < 15; i++) shown = smoothStep(shown, 100, (i + 1) / 30, 1.5, 1 / 30);
    expect(shown).toBeCloseTo(100.75, 1);
  });

  it('never steps back for a small gap, but jumps for a big one', () => {
    expect(smoothStep(105, 100, 0, 0, 1 / 30)).toBe(105);
    expect(smoothStep(0, 5000, 0, 0, 1 / 30)).toBe(5000);
  });

  it('eases onto the real distance', () => {
    let shown = 100;
    for (let i = 0; i < 30; i++) shown = smoothStep(shown, 110, 0, 0, 1 / 30);
    expect(shown).toBeGreaterThan(107); // most of the gap after one second
    for (let i = 0; i < 60; i++) shown = smoothStep(shown, 110, 0, 0, 1 / 30);
    expect(shown).toBeGreaterThan(109.7);
  });
});
