import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router, usePathname } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/api/auth';
import { stepsFor } from '@/journey/progress';
import { TreadmillConnection, type ConnectionSnapshot } from '@/treadmill/connection';
import type { TreadmillData } from '@/treadmill/ftms';

import { SessionRecorder, type FinishedSession, type LiveSession } from './recorder';
import { clearLive, loadLive, pendingSessions, saveFinished, saveLive } from './store';
import { syncPending } from './sync';

const SAVE_EVERY_MS = 5_000;
/** A saved session younger than this is resumed at launch, older ones are closed. */
const RESUME_WITHIN_MS = 3 * 60_000;
/** Treadmill gone (switched off) for this long: the session is over. */
const GONE_AFTER_MS = 3 * 60_000;

type SessionContextValue = {
  connection: ConnectionSnapshot;
  data: TreadmillData | null;
  live: LiveSession | null;
  /** Ends the current session now and opens its summary. */
  finishNow: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Lives for the whole app: keeps the treadmill connected, records sessions as soon as
 * the belt moves, saves them every 5 s and syncs them when the network allows.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState<ConnectionSnapshot>({
    status: 'starting',
    deviceName: null,
  });
  const [data, setData] = useState<TreadmillData | null>(null);
  const [live, setLive] = useState<LiveSession | null>(null);
  const recorder = useRef(new SessionRecorder(randomUUID));
  const lastSaved = useRef(0);
  const strideCm = useRef<number | null>(null);
  useEffect(() => {
    strideCm.current = user?.stride_cm ?? null;
  }, [user]);
  // The walker may already be on the live view: never open a second one on top.
  const pathname = usePathname();
  const onSessionScreen = useRef(false);
  useEffect(() => {
    onSessionScreen.current = pathname === '/session';
  }, [pathname]);

  const sync = useCallback(async () => {
    if (pendingSessions().length === 0) return;
    if ((await syncPending()) > 0) {
      await Promise.all(
        ['journeys', 'sessions', 'me', 'leaderboards'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
    }
  }, [queryClient]);

  const store = useCallback(
    (finished: FinishedSession | null) => {
      setLive(null);
      if (!finished) {
        clearLive();
        return;
      }
      saveFinished({
        ...finished,
        steps: stepsFor(finished.distanceM, strideCm.current),
        journeyIds: null,
      });
      router.push({ pathname: '/summary', params: { localId: finished.localId } });
      sync().catch(() => {});
    },
    [sync],
  );

  // A session interrupted by a crash or a closed app: resume it, or close it if too old.
  useEffect(() => {
    if (status !== 'signedIn') return;
    const saved = loadLive();
    if (!saved) return;
    recorder.current.resume(saved);
    if (Date.now() - saved.updatedAt >= RESUME_WITHIN_MS)
      store(recorder.current.finish(saved.updatedAt));
  }, [status, store]);

  useEffect(() => {
    if (status !== 'signedIn') return;
    const treadmill = new TreadmillConnection({
      onStatus: setConnection,
      onData: (frame) => {
        const now = Date.now();
        setData(frame);
        const wasRecording = recorder.current.live !== null;
        const finished = recorder.current.update(frame, now);
        const current = recorder.current.live;
        if (finished) {
          store(finished);
          return;
        }
        setLive(current);
        if (current && !wasRecording && !onSessionScreen.current) {
          onSessionScreen.current = true;
          router.push('/session');
        }
        if (current && now - lastSaved.current >= SAVE_EVERY_MS) {
          saveLive(current);
          lastSaved.current = now;
        }
      },
    });
    treadmill.start();

    const timer = setInterval(() => {
      const current = recorder.current.live;
      if (current && Date.now() - current.updatedAt > GONE_AFTER_MS)
        store(recorder.current.finish());
      sync().catch(() => {});
    }, 60_000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync().catch(() => {});
    });
    sync().catch(() => {});
    return () => {
      treadmill.destroy();
      clearInterval(timer);
      appState.remove();
    };
  }, [status, store, sync]);

  const finishNow = useCallback(() => store(recorder.current.finish(Date.now())), [store]);

  return (
    <SessionContext.Provider value={{ connection, data, live, finishNow }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession outside SessionProvider');
  return value;
}
