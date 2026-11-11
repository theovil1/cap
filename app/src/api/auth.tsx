import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { clearAll, getValue, setValue } from '@/session/store';
import { syncPending } from '@/session/sync';

import {
  api,
  clearSession,
  restoreSession,
  saveSession,
  setSignedOutHandler,
  storedRefreshToken,
} from './client';
import type { AuthResponse, UserProfile } from './types';

type Status = 'loading' | 'signedOut' | 'signedIn';

type Auth = {
  status: Status;
  /** Last known profile, available offline. */
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    username: string;
  }) => Promise<void>;
  signInWithApple: (identityToken: string, firstName: string | null) => Promise<void>;
  setUser: (user: UserProfile) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);
const PROFILE_KEY = 'profile';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUserState] = useState<UserProfile | null>(() =>
    getValue<UserProfile>(PROFILE_KEY),
  );

  const setUser = useCallback((profile: UserProfile) => {
    setValue(PROFILE_KEY, profile);
    setUserState(profile);
  }, []);

  const forget = useCallback(() => {
    clearAll();
    queryClient.clear();
    setUserState(null);
    setStatus('signedOut');
  }, [queryClient]);

  useEffect(() => {
    setSignedOutHandler(forget);
    restoreSession().then((ok) => {
      if (ok && getValue(PROFILE_KEY)) setStatus('signedIn');
      else forget();
    });
    return () => setSignedOutHandler(null);
  }, [forget]);

  const accept = useCallback(
    async (auth: AuthResponse) => {
      // Another account on this phone: its local data must not leak to this one.
      if (getValue<UserProfile>(PROFILE_KEY)?.id !== auth.user.id) clearAll();
      await saveSession(auth);
      setUser(auth.user);
      setStatus('signedIn');
    },
    [setUser],
  );

  const value = useMemo<Auth>(
    () => ({
      status,
      user,
      setUser,
      login: async (email, password) =>
        accept(
          await api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),
        ),
      register: async ({ email, password, firstName, username }) =>
        accept(
          await api<AuthResponse>('/auth/register', {
            method: 'POST',
            body: { email, password, first_name: firstName, username },
          }),
        ),
      signInWithApple: async (identityToken, firstName) =>
        accept(
          await api<AuthResponse>('/auth/apple', {
            method: 'POST',
            body: { identity_token: identityToken, first_name: firstName },
          }),
        ),
      signOut: async () => {
        // Send what is still waiting before the local data is wiped.
        await syncPending().catch(() => 0);
        const refreshToken = storedRefreshToken();
        if (refreshToken) {
          await api('/auth/logout', {
            method: 'POST',
            body: { refresh_token: refreshToken },
          }).catch(() => {});
        }
        await clearSession();
        forget();
      },
    }),
    [status, user, setUser, accept, forget],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth outside AuthProvider');
  return auth;
}
