import * as SecureStore from 'expo-secure-store';

import type { AuthResponse } from './types';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://cap.theovilain.fr';

const REFRESH_KEY = 'cap.refreshToken';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type Session = { accessToken: string; refreshToken: string };

let session: Session | null = null;
let refreshing: Promise<boolean> | null = null;
let onSignedOut: (() => void) | null = null;

/** Called when the refresh token is rejected: the user must sign in again. */
export function setSignedOutHandler(handler: (() => void) | null): void {
  onSignedOut = handler;
}

export async function saveSession(auth: AuthResponse): Promise<void> {
  session = { accessToken: auth.access_token, refreshToken: auth.refresh_token };
  await SecureStore.setItemAsync(REFRESH_KEY, auth.refresh_token);
}

export async function clearSession(): Promise<void> {
  session = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

/** Restores the stored session at launch. False when the user must sign in. */
export async function restoreSession(): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return false;
  session = { accessToken: '', refreshToken };
  try {
    return await refresh();
  } catch {
    // Offline: stay signed in, sessions are recorded locally and synced later.
    return true;
  }
}

/** A new access token, for the live WebSocket (null when signed out or offline). */
export async function freshAccessToken(): Promise<string | null> {
  try {
    return (await refresh()) ? (session?.accessToken ?? null) : null;
  } catch {
    return null;
  }
}

export function storedRefreshToken(): string | null {
  return session?.refreshToken ?? null;
}

async function refresh(): Promise<boolean> {
  if (!session) return false;
  refreshing ??= (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: session?.refreshToken }),
      });
      if (response.status === 401) {
        await clearSession();
        onSignedOut?.();
        return false;
      }
      if (!response.ok) throw new ApiError(response.status, 'refresh_failed', 'refresh failed');
      await saveSession((await response.json()) as AuthResponse);
      return true;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

type RequestOptions = { method?: string; body?: unknown; query?: Record<string, string | number> };

/** Calls the API with the access token, refreshing it once when it has expired. */
export async function api<T>(
  path: string,
  options: RequestOptions = {},
  retried = false,
): Promise<T> {
  const query = options.query
    ? '?' + new URLSearchParams(Object.entries(options.query).map(([k, v]) => [k, String(v)]))
    : '';
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (session?.accessToken) headers.authorization = `Bearer ${session.accessToken}`;

  const response = await fetch(`${API_URL}${path}${query}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (response.status === 401 && session && !retried && !path.startsWith('/auth/')) {
    if (await refresh()) return api<T>(path, options, true);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    throw new ApiError(
      response.status,
      body?.error ?? 'http_error',
      body?.message ?? response.statusText,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
