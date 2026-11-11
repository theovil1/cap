import { decodeTreadmillData, hexToBytes } from '../ftms';

describe('decodeTreadmillData', () => {
  it('decodes the Luma main frame', () => {
    const frame = hexToBytes('8c05900164000032000000090' + '0ffffff009e00');
    expect(decodeTreadmillData(frame)).toEqual({
      speedKmh: 4,
      distanceM: 100,
      inclinePct: 5,
      energyKcal: 9,
      heartRateBpm: 0,
      elapsedS: 158,
    });
  });

  it('decodes a frame at rest', () => {
    const frame = hexToBytes('8c0500000000000000000000' + '00ffffff000000');
    expect(decodeTreadmillData(frame)).toMatchObject({ speedKmh: 0, distanceM: 0, elapsedS: 0 });
  });

  it('ignores frames without speed (More Data bit set)', () => {
    expect(decodeTreadmillData(hexToBytes('0120000000'))).toBeNull();
  });

  it('decodes optional fields when their flags are set', () => {
    // flags 0x0002 (average speed) + 0x0020 (pace): speed 3.50, avg 3.00, pace 1.2
    const frame = hexToBytes('2200' + '5e01' + '2c01' + '0c');
    expect(decodeTreadmillData(frame)).toEqual({ speedKmh: 3.5 });
  });

  it('rejects truncated frames', () => {
    expect(decodeTreadmillData(hexToBytes('8c05c800'))).toBeNull();
    expect(decodeTreadmillData(new Uint8Array([0x8c]))).toBeNull();
  });
});
