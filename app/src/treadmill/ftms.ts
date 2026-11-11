/**
 * Decoder for the Bluetooth SIG Fitness Machine Service (FTMS) Treadmill Data
 * characteristic (0x2ACD). Little-endian. See tools/ble-probe/README.md.
 */

export const FTMS_SERVICE_UUID = '00001826-0000-1000-8000-00805f9b34fb';
export const TREADMILL_DATA_UUID = '00002acd-0000-1000-8000-00805f9b34fb';

export type TreadmillData = {
  speedKmh: number;
  distanceM?: number;
  inclinePct?: number;
  energyKcal?: number;
  heartRateBpm?: number;
  elapsedS?: number;
};

/** Field sizes in bytes, in flag bit order, for fields Cap does not use. */
const AVG_SPEED = 2;
const ELEVATION = 4;
const PACE = 1;
const AVG_PACE = 1;
const MET = 1;
const REMAINING = 2;
const FORCE_POWER = 4;

/**
 * Returns null for frames without instantaneous speed (bit 0 "More Data" set,
 * e.g. the Luma's secondary `01 20 ...` frame) and for truncated frames.
 * Unknown flag bits are tolerated.
 */
export function decodeTreadmillData(bytes: Uint8Array): TreadmillData | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  const has = (size: number) => pos + size <= bytes.byteLength;
  if (!has(2)) return null;
  const flags = view.getUint16(0, true);
  pos = 2;
  if (flags & 0x0001) return null;

  if (!has(2)) return null;
  const out: TreadmillData = { speedKmh: view.getUint16(pos, true) / 100 };
  pos += 2;

  if (flags & 0x0002) pos += AVG_SPEED;
  if (flags & 0x0004) {
    if (!has(3)) return null;
    out.distanceM = bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16);
    pos += 3;
  }
  if (flags & 0x0008) {
    if (!has(4)) return null;
    out.inclinePct = view.getInt16(pos, true) / 10;
    pos += 4; // inclination + ramp angle
  }
  if (flags & 0x0010) pos += ELEVATION;
  if (flags & 0x0020) pos += PACE;
  if (flags & 0x0040) pos += AVG_PACE;
  if (flags & 0x0080) {
    if (!has(5)) return null;
    out.energyKcal = view.getUint16(pos, true);
    pos += 5; // total, per hour, per minute
  }
  if (flags & 0x0100) {
    if (!has(1)) return null;
    out.heartRateBpm = bytes[pos];
    pos += 1;
  }
  if (flags & 0x0200) pos += MET;
  if (flags & 0x0400) {
    if (!has(2)) return null;
    out.elapsedS = view.getUint16(pos, true);
    pos += 2;
  }
  if (flags & 0x0800) pos += REMAINING;
  if (flags & 0x1000) pos += FORCE_POWER;
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
