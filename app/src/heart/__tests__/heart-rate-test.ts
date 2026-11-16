import { decodeHeartRate, heartSummary, zoneOf } from '../heart-rate';

describe('decodeHeartRate', () => {
  it('reads an 8-bit value', () => {
    expect(decodeHeartRate(new Uint8Array([0x00, 72]))).toBe(72);
  });

  it('reads a 16-bit value', () => {
    expect(decodeHeartRate(new Uint8Array([0x01, 0x2c, 0x00]))).toBe(44);
  });

  it('ignores short or impossible frames', () => {
    expect(decodeHeartRate(new Uint8Array([0x00]))).toBeNull();
    expect(decodeHeartRate(new Uint8Array([0x01, 0x10]))).toBeNull();
    expect(decodeHeartRate(new Uint8Array([0x00, 0]))).toBeNull();
  });
});

describe('zoneOf', () => {
  it('splits the maximum into five zones', () => {
    expect(zoneOf(100)).toBe(1);
    expect(zoneOf(120)).toBe(2);
    expect(zoneOf(140)).toBe(3);
    expect(zoneOf(160)).toBe(4);
    expect(zoneOf(180)).toBe(5);
  });
});

describe('heartSummary', () => {
  it('gives the average and the highest value', () => {
    expect(
      heartSummary([
        [0, 100],
        [5_000, 120],
        [10_000, 141],
      ]),
    ).toEqual({ average: 120, max: 141 });
    expect(heartSummary([])).toBeNull();
  });
});
