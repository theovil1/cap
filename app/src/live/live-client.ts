import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { API_URL, freshAccessToken } from '@/api/client';

/** A rival's position heard on the live socket. */
export type RivalPosition = { distanceM: number; speedKmh: number; at: number };

/** Positions older than this are no longer live. */
export const LIVE_FOR_MS = 12_000;

type ServerMessage =
  | { type: 'position'; journey_id: string; user_id: string; distance_m: number; speed_kmh: number }
  | { type: 'stop'; journey_id: string; user_id: string };

const WS_URL = `${API_URL.replace(/^http/, 'ws')}/live`;

let socket: WebSocket | null = null;
let opening = false;
let wanted = false;
let retryMs = 1_000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
/** journey id -> user id -> position. Replaced on each change for React. */
let positions: Record<string, Record<string, RivalPosition>> = {};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

async function open() {
  if (!wanted || socket || opening || AppState.currentState !== 'active') return;
  opening = true;
  const token = await freshAccessToken().finally(() => {
    opening = false;
  });
  if (!wanted || socket) return;
  if (!token) {
    retryLater();
    return;
  }
  // React Native's WebSocket takes headers as a third argument.
  const ws = new (
    WebSocket as unknown as new (
      url: string,
      protocols: string[] | null,
      options: { headers: Record<string, string> },
    ) => WebSocket
  )(WS_URL, null, { headers: { authorization: `Bearer ${token}` } });
  socket = ws;
  ws.onopen = () => {
    retryMs = 1_000;
  };
  ws.onmessage = (event) => {
    let message: ServerMessage;
    try {
      message = JSON.parse(String(event.data)) as ServerMessage;
    } catch {
      return;
    }
    const race = { ...(positions[message.journey_id] ?? {}) };
    if (message.type === 'position') {
      race[message.user_id] = {
        distanceM: message.distance_m,
        speedKmh: message.speed_kmh,
        at: Date.now(),
      };
    } else {
      delete race[message.user_id];
    }
    positions = { ...positions, [message.journey_id]: race };
    emit();
  };
  ws.onclose = () => {
    if (socket === ws) socket = null;
    retryLater();
  };
  ws.onerror = () => ws.close();
}

function retryLater() {
  if (!wanted || retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    open();
  }, retryMs);
  retryMs = Math.min(retryMs * 2, 30_000);
}

function close() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  socket?.close();
  socket = null;
}

AppState.addEventListener('change', (state) => {
  if (state === 'active') open();
  else close();
});

/** Keeps the live socket open while signed in and the app is in front. */
export function setLiveWanted(value: boolean) {
  wanted = value;
  if (value) open();
  else {
    close();
    positions = {};
    emit();
  }
}

function send(message: object) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

/** Distance of the session under way, about every 2 seconds. */
export function sendProgress(startedAt: number, sessionM: number, speedKmh: number) {
  send({
    type: 'progress',
    started_at: new Date(startedAt).toISOString(),
    session_m: sessionM,
    speed_kmh: speedKmh,
  });
}

export function sendStop() {
  send({ type: 'stop' });
}

/** Rivals heard live on a race, by user id. */
export function useRivalPositions(journeyId: string | undefined): Record<string, RivalPosition> {
  const all = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => positions,
  );
  return (journeyId && all[journeyId]) || EMPTY;
}

const EMPTY: Record<string, RivalPosition> = {};
