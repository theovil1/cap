import { BleManager, State, type Device, type Subscription } from 'react-native-ble-plx';

import {
  FTMS_SERVICE_UUID,
  TREADMILL_DATA_UUID,
  base64ToBytes,
  decodeTreadmillData,
  type TreadmillData,
} from './ftms';

export type ConnectionStatus =
  | 'starting'
  | 'bluetoothOff'
  | 'unauthorized'
  | 'unsupported'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

export type ConnectionSnapshot = { status: ConnectionStatus; deviceName: string | null };

type Listeners = {
  onStatus: (snapshot: ConnectionSnapshot) => void;
  onData: (data: TreadmillData, timeMs: number) => void;
};

const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000];
const CONNECT_TIMEOUT_MS = 10_000;

/** Prefer FitShow modules (Zipro Luma) when several FTMS devices answer. */
function score(device: Device): number {
  const name = device.localName ?? device.name ?? '';
  return name.startsWith('FS-') ? 1 : 0;
}

/**
 * Finds an FTMS treadmill, connects, streams Treadmill Data and reconnects on
 * its own. Read-only: Cap never writes to the treadmill.
 */
export class TreadmillConnection {
  private readonly manager = new BleManager();
  private readonly subscriptions: Subscription[] = [];
  private readonly connectionSubscriptions: Subscription[] = [];
  private status: ConnectionStatus = 'starting';
  private deviceId: string | null = null;
  private deviceName: string | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private readonly listeners: Listeners) {}

  start(): void {
    this.subscriptions.push(
      this.manager.onStateChange((state) => this.onAdapterState(state), true),
    );
  }

  destroy(): void {
    this.stopped = true;
    this.clearTimers();
    this.dropConnectionSubscriptions();
    this.subscriptions.splice(0).forEach((s) => s.remove());
    void this.manager.destroy();
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.listeners.onStatus({ status, deviceName: this.deviceName });
  }

  private onAdapterState(state: State): void {
    if (state === State.PoweredOn) {
      if (this.status !== 'connected' && this.status !== 'connecting') this.findTreadmill();
    } else if (state === State.PoweredOff) {
      this.clearTimers();
      this.setStatus('bluetoothOff');
    } else if (state === State.Unauthorized) {
      this.setStatus('unauthorized');
    } else if (state === State.Unsupported) {
      this.setStatus('unsupported');
    }
  }

  private findTreadmill(): void {
    if (this.deviceId) {
      void this.connect(this.deviceId);
      return;
    }
    this.setStatus('scanning');
    let best: Device | null = null;
    void this.manager.startDeviceScan([FTMS_SERVICE_UUID], null, async (error, device) => {
      if (error || !device) return;
      if (!best || score(device) > score(best)) best = device;
      // A FitShow module is what we want: connect right away. Otherwise wait a bit.
      if (score(device) > 0) this.pick(device);
      else if (!this.scanTimer) this.scanTimer = setTimeout(() => best && this.pick(best), 2_000);
    });
  }

  private pick(device: Device): void {
    if (this.status !== 'scanning') return;
    this.clearTimers();
    void this.manager.stopDeviceScan();
    this.deviceId = device.id;
    this.deviceName = device.localName ?? device.name ?? null;
    void this.connect(device.id);
  }

  private async connect(id: string): Promise<void> {
    if (this.stopped) return;
    this.setStatus(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
    try {
      const device = await this.manager.connectToDevice(id, { timeout: CONNECT_TIMEOUT_MS });
      await device.discoverAllServicesAndCharacteristics();
      this.deviceName = device.localName ?? device.name ?? this.deviceName;
      this.dropConnectionSubscriptions();
      this.connectionSubscriptions.push(
        this.manager.onDeviceDisconnected(id, () => {
          this.dropConnectionSubscriptions();
          this.scheduleReconnect();
        }),
        device.monitorCharacteristicForService(
          FTMS_SERVICE_UUID,
          TREADMILL_DATA_UUID,
          (error, characteristic) => {
            if (error || !characteristic?.value) return;
            const data = decodeTreadmillData(base64ToBytes(characteristic.value));
            if (data) this.listeners.onData(data, Date.now());
          },
        ),
      );
      this.reconnectAttempt = 0;
      this.setStatus('connected');
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    const delay =
      RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt += 1;
    this.setStatus('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.deviceId) void this.connect(this.deviceId);
    }, delay);
  }

  private dropConnectionSubscriptions(): void {
    this.connectionSubscriptions.splice(0).forEach((s) => s.remove());
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.scanTimer) clearTimeout(this.scanTimer);
    this.reconnectTimer = null;
    this.scanTimer = null;
  }
}
