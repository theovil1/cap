import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import type { SessionResult } from '@/api/types';

import type { FinishedSession, LiveSnapshot } from './recorder';

/** A finished session kept on the phone, synced or waiting to be. */
export type StoredSession = FinishedSession & {
  steps: number;
  journeyIds: string[] | null;
  result: SessionResult | null;
};

let db: SQLiteDatabase | null = null;

function database(): SQLiteDatabase {
  if (db) return db;
  db = openDatabaseSync('cap.db');
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS live_session (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (
      local_id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      data TEXT NOT NULL,
      result TEXT
    );
  `);
  return db;
}

export function getValue<T>(key: string): T | null {
  const row = database().getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row ? (JSON.parse(row.value) as T) : null;
}

export function setValue(key: string, value: unknown): void {
  database().runSync(
    'INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)',
    key,
    JSON.stringify(value),
  );
}

export function clearAll(): void {
  database().execSync('DELETE FROM kv; DELETE FROM live_session; DELETE FROM sessions;');
}

/** Written every 5 s during a session (specification: never lose distance). */
export function saveLive(snapshot: LiveSnapshot): void {
  database().runSync(
    'INSERT OR REPLACE INTO live_session (id, data) VALUES (1, ?)',
    JSON.stringify(snapshot),
  );
}

export function loadLive(): LiveSnapshot | null {
  const row = database().getFirstSync<{ data: string }>(
    'SELECT data FROM live_session WHERE id = 1',
  );
  return row ? (JSON.parse(row.data) as LiveSnapshot) : null;
}

export function clearLive(): void {
  database().runSync('DELETE FROM live_session');
}

/** Stores a finished session and drops the live one, in one transaction. */
export function saveFinished(session: Omit<StoredSession, 'result'>): void {
  const { journeyIds, ...rest } = session;
  database().withTransactionSync(() => {
    database().runSync(
      'INSERT OR IGNORE INTO sessions (local_id, started_at, data) VALUES (?, ?, ?)',
      session.localId,
      session.startedAt,
      JSON.stringify({ ...rest, journeyIds }),
    );
    database().runSync('DELETE FROM live_session');
  });
}

export function markSynced(localId: string, result: SessionResult): void {
  database().runSync(
    'UPDATE sessions SET result = ? WHERE local_id = ?',
    JSON.stringify(result),
    localId,
  );
}

type Row = { data: string; result: string | null };
const parse = (row: Row): StoredSession => ({
  ...(JSON.parse(row.data) as Omit<StoredSession, 'result'>),
  result: row.result ? (JSON.parse(row.result) as SessionResult) : null,
});

export function pendingSessions(): StoredSession[] {
  return database()
    .getAllSync<Row>('SELECT data, result FROM sessions WHERE result IS NULL ORDER BY started_at')
    .map(parse);
}

export function getSession(localId: string): StoredSession | null {
  const row = database().getFirstSync<Row>(
    'SELECT data, result FROM sessions WHERE local_id = ?',
    localId,
  );
  return row ? parse(row) : null;
}

/** Sessions since a time, newest first: today's steps and the streak work offline. */
export function sessionsSince(fromMs: number): StoredSession[] {
  return database()
    .getAllSync<Row>(
      'SELECT data, result FROM sessions WHERE started_at >= ? ORDER BY started_at DESC',
      fromMs,
    )
    .map(parse);
}
