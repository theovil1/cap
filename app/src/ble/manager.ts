import { BleManager, type Device } from 'react-native-ble-plx';

/**
 * One Bluetooth manager for the whole app. react-native-ble-plx keeps a single
 * native instance, so the treadmill and the heart rate sensor share it and
 * neither may destroy it.
 */
let shared: BleManager | null = null;

export function bleManager(): BleManager {
  shared ??= new BleManager();
  return shared;
}

type Scan = { service: string; onDevice: (device: Device) => void };
const scans = new Set<Scan>();

/**
 * iOS runs one scan at a time: every caller's service joins a single scan and
 * each device goes to the callers whose service it advertises.
 */
export function scanFor(service: string, onDevice: (device: Device) => void): () => void {
  const scan = { service: service.toLowerCase(), onDevice };
  scans.add(scan);
  restart();
  return () => {
    if (!scans.delete(scan)) return;
    restart();
  };
}

function restart(): void {
  const manager = bleManager();
  void manager.stopDeviceScan();
  if (scans.size === 0) return;
  const services = [...new Set([...scans].map((s) => s.service))];
  void manager.startDeviceScan(services, null, (error, device) => {
    if (error || !device) return;
    const advertised = (device.serviceUUIDs ?? []).map((u) => u.toLowerCase());
    for (const scan of [...scans]) {
      if (advertised.length === 0 || advertised.includes(scan.service)) scan.onDevice(device);
    }
  });
}
