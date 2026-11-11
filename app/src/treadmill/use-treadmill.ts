import { useCallback, useEffect, useRef, useState } from 'react';

import { TreadmillConnection, type ConnectionSnapshot } from './connection';
import { DistanceTracker } from './distance';
import type { TreadmillData } from './ftms';

export type SessionState = {
  active: boolean;
  distanceM: number;
  startedAtMs: number | null;
};

const IDLE_SESSION: SessionState = { active: false, distanceM: 0, startedAtMs: null };

/**
 * Connects to the treadmill and tracks the current session. A session starts
 * as soon as the belt speed goes above zero (specification, "Faire une séance").
 */
export function useTreadmill() {
  const [connection, setConnection] = useState<ConnectionSnapshot>({
    status: 'starting',
    deviceName: null,
  });
  const [data, setData] = useState<TreadmillData | null>(null);
  const [session, setSession] = useState<SessionState>(IDLE_SESSION);
  const tracker = useRef<DistanceTracker | null>(null);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    const treadmill = new TreadmillConnection({
      onStatus: setConnection,
      onData: (frame, timeMs) => {
        setData(frame);
        if (!tracker.current && frame.speedKmh > 0) {
          tracker.current = new DistanceTracker();
          startedAt.current = timeMs;
        }
        if (tracker.current) {
          tracker.current.update(frame, timeMs);
          setSession({
            active: true,
            distanceM: tracker.current.distanceM,
            startedAtMs: startedAt.current,
          });
        }
      },
    });
    treadmill.start();
    return () => treadmill.destroy();
  }, []);

  const resetSession = useCallback(() => {
    tracker.current = null;
    startedAt.current = null;
    setSession(IDLE_SESSION);
  }, []);

  return { connection, data, session, resetSession };
}
