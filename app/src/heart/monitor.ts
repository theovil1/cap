import { useSyncExternalStore } from 'react';
import { State, type Device, type Subscription } from 'react-native-ble-plx';

import { bleManager, scanFor } from '@/ble/manager';
import { getValue, setValue } from '@/session/store';
import { base64ToBytes } from '@/treadmill/ftms';

import {
  HEART_RATE_MEASUREMENT_UUID,
  HEART_RATE_SERVICE_UUID,
  decodeHeartRate,
} from './heart-rate';

export type Sensor = { id: string; name: string };

export type HeartState = {
  sensor: Sensor | null;
  connected: boolean;
  bpm: number | null;
  /** When the last value arrived: the tile only shows fresh values. */
  at: number;
};

/** Per device: the walker's heart rate sensor, chosen in My account. */
const KEY = 'heartSensor';
const RETRY_MS = 5_000;
const CONNECT_TIMEOUT_MS = 10_000;

let state: HeartState = { sensor: getValue<Sensor>(KEY), connected: false, bpm: null, at: 0 };
const listeners = new Set<() => void>();
let running = false;
let subscriptions: Subscription[] = [];
let adapter: Subscription | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let onBpm: ((bpm: number, timeMs: number) => void) | null = null;

function set(next: Partial<HeartState>): void {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function drop(): void {
  subscriptions.splice(0).forEach((s) => s.remove());
  if (retry) clearTimeout(retry);
  retry = null;
}

async function connect(): Promise<void> {
  const sensor = state.sensor;
  if (!running || !sensor) return;
  drop();
  const manager = bleManager();
  try {
    const device = await manager.connectToDevice(sensor.id, { timeout: CONNECT_TIMEOUT_MS });
    await device.discoverAllServicesAndCharacteristics();
    if (!running || state.sensor?.id !== sensor.id) {
      await device.cancelConnection();
      return;
    }
    subscriptions = [
      manager.onDeviceDisconnected(sensor.id, () => {
        set({ connected: false });
        later();
      }),
      device.monitorCharacteristicForService(
        HEART_RATE_SERVICE_UUID,
        HEART_RATE_MEASUREMENT_UUID,
        (error, characteristic) => {
          if (error || !characteristic?.value) return;
          const bpm = decodeHeartRate(base64ToBytes(characteristic.value));
          if (bpm === null) return;
          const now = Date.now();
          set({ bpm, at: now });
          onBpm?.(bpm, now);
        },
      ),
    ];
    set({ connected: true });
  } catch {
    set({ connected: false });
    later();
  }
}

function later(): void {
  if (!running || retry) return;
  retry = setTimeout(() => {
    retry = null;
    void connect();
  }, RETRY_MS);
}

/** Keeps the saved sensor connected while the app runs; values go to `listener`. */
export function startHeartMonitor(listener: (bpm: number, timeMs: number) => void): () => void {
  running = true;
  onBpm = listener;
  adapter = bleManager().onStateChange((s) => {
    if (s === State.PoweredOn) void connect();
    else set({ connected: false });
  }, true);
  return () => {
    running = false;
    onBpm = null;
    adapter?.remove();
    adapter = null;
    drop();
    const id = state.sensor?.id;
    if (id)
      void bleManager()
        .cancelDeviceConnection(id)
        .catch(() => {});
    set({ connected: false });
  };
}

export function chooseSensor(device: Device): void {
  const sensor = { id: device.id, name: device.localName ?? device.name ?? '' };
  setValue(KEY, sensor);
  set({ sensor, connected: false, bpm: null, at: 0 });
  void connect();
}

export function forgetSensor(): void {
  const id = state.sensor?.id;
  drop();
  setValue(KEY, null);
  set({ sensor: null, connected: false, bpm: null, at: 0 });
  if (id)
    void bleManager()
      .cancelDeviceConnection(id)
      .catch(() => {});
}

/** Heart rate sensors around, for the Sensors screen. */
export function scanSensors(onDevice: (device: Device) => void): () => void {
  return scanFor(HEART_RATE_SERVICE_UUID, onDevice);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useHeart(): HeartState {
  return useSyncExternalStore(subscribe, () => state);
}
