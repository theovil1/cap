import { api, ApiError } from '@/api/client';
import type { SessionResult, SessionUpload } from '@/api/types';

import { markSynced, pendingSessions, type StoredSession } from './store';

let running: Promise<number> | null = null;

function toUpload(session: StoredSession): SessionUpload {
  return {
    local_id: session.localId,
    started_at: new Date(session.startedAt).toISOString(),
    ended_at: new Date(session.endedAt).toISOString(),
    distance_m: session.distanceM,
    duration_s: session.durationS,
    steps: session.steps,
    avg_incline_pct: session.avgInclinePct,
    source: 'treadmill',
    journey_ids: session.journeyIds ?? undefined,
  };
}

/**
 * Sends every session not yet confirmed by the server, oldest first. Uploads are
 * idempotent (local id), so retrying after a failure never counts a session twice.
 * Returns how many were synced.
 */
export function syncPending(): Promise<number> {
  running ??= (async () => {
    let synced = 0;
    try {
      for (const session of pendingSessions()) {
        try {
          const result = await api<SessionResult>('/sessions', {
            method: 'POST',
            body: toUpload(session),
          });
          markSynced(session.localId, result);
          synced++;
        } catch (error) {
          // A rejected session will never be accepted: keep it locally, stop retrying it.
          const rejected =
            error instanceof ApiError &&
            [400, 422].includes(error.status) &&
            error.code !== 'http_error';
          if (rejected) {
            markSynced(session.localId, { id: '', created: false, allocations: [] });
            continue;
          }
          break;
        }
      }
    } finally {
      running = null;
    }
    return synced;
  })();
  return running;
}
