/** Standard Bluetooth Heart Rate service, broadcast by chest straps and many watches. */
export const HEART_RATE_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
export const HEART_RATE_MEASUREMENT_UUID = '00002a37-0000-1000-8000-00805f9b34fb';

/** Beats per minute from a Heart Rate Measurement, or null when unusable. */
export function decodeHeartRate(bytes: Uint8Array): number | null {
  if (bytes.length < 2) return null;
  const wide = (bytes[0] & 0x01) !== 0;
  if (wide && bytes.length < 3) return null;
  const bpm = wide ? bytes[1] | (bytes[2] << 8) : bytes[1];
  return bpm > 0 && bpm < 250 ? bpm : null;
}

/** Without an age in the profile, zones follow a common maximum of 190 bpm. */
const MAX_BPM = 190;
export const ZONE_KEYS = ['easy', 'endurance', 'tempo', 'threshold', 'max'] as const;

/** Training zone from 1 to 5 (50-60 %, 60-70 %, 70-80 %, 80-90 %, 90 % and more). */
export function zoneOf(bpm: number): number {
  const ratio = bpm / MAX_BPM;
  if (ratio < 0.6) return 1;
  if (ratio < 0.7) return 2;
  if (ratio < 0.8) return 3;
  if (ratio < 0.9) return 4;
  return 5;
}

/** Average and highest of `[timeMs, bpm]` samples. */
export function heartSummary(samples: [number, number][] | undefined) {
  if (!samples || samples.length === 0) return null;
  let sum = 0;
  let max = 0;
  for (const [, bpm] of samples) {
    sum += bpm;
    max = Math.max(max, bpm);
  }
  return { average: Math.round(sum / samples.length), max };
}
