import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getValue, setValue } from '@/session/store';

import { api } from './client';
import type {
  AddFriendResult,
  FriendList,
  GeocodeResult,
  Leaderboard,
  LeaderboardPeriod,
  JourneyDetail,
  JourneySummary,
  Place,
  RouteDetail,
  SessionItem,
  UserMatch,
  UserProfile,
} from './types';

export const keys = {
  me: ['me'] as const,
  journeys: ['journeys'] as const,
  journey: (id: string) => ['journeys', id] as const,
  route: (id: string) => ['routes', id] as const,
  sessions: ['sessions'] as const,
  friends: ['friends'] as const,
  userSearch: ['user-search'] as const,
};

/** Keeps the last answer on the phone so screens work offline. */
function cached<T>(key: string, fetcher: () => Promise<T>) {
  return {
    queryFn: async () => {
      const value = await fetcher();
      setValue(key, value);
      return value;
    },
    initialData: () => getValue<T>(key) ?? undefined,
    initialDataUpdatedAt: 0,
  };
}

export function useMe() {
  return useQuery({ queryKey: keys.me, ...cached('me', () => api<UserProfile>('/me')) });
}

export function useJourneys() {
  return useQuery({
    queryKey: keys.journeys,
    ...cached('journeys', () => api<JourneySummary[]>('/journeys')),
  });
}

export function useJourney(id: string | undefined) {
  return useQuery({
    queryKey: keys.journey(id ?? ''),
    enabled: !!id,
    ...cached(`journey:${id}`, () => api<JourneyDetail>(`/journeys/${id}`)),
  });
}

/** The journey receiving the km by default: the most recent active one. */
export function useActiveJourney() {
  const journeys = useJourneys();
  const active = journeys.data?.find((j) => j.status === 'active');
  const detail = useJourney(active?.id);
  return { summary: active ?? null, detail: detail.data ?? null, isLoading: journeys.isLoading };
}

export function useSessions() {
  return useQuery({
    queryKey: keys.sessions,
    ...cached('sessions', () => api<SessionItem[]>('/sessions', { query: { limit: 200 } })),
  });
}

export function useGeocode(text: string, near?: { lat: number; lon: number } | null, lang = 'fr') {
  const q = text.trim();
  return useQuery({
    queryKey: ['geocode', q, near?.lat, near?.lon, lang],
    enabled: q.length >= 3,
    staleTime: 60_000,
    queryFn: () =>
      api<GeocodeResult[]>('/geocode', {
        query: { q, lang, limit: 8, ...(near ? { lat: near.lat, lon: near.lon } : {}) },
      }),
  });
}

export function useCreateRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { start: Place; end: Place }) =>
      api<RouteDetail>('/routes', { method: 'POST', body: input }),
    onSuccess: (route) => queryClient.setQueryData(keys.route(route.id), route),
  });
}

export function useStartJourney() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (routeId: string) =>
      api<JourneyDetail>('/journeys', { method: 'POST', body: { route_id: routeId } }),
    onSuccess: (journey) => {
      queryClient.setQueryData(keys.journey(journey.id), journey);
      return queryClient.invalidateQueries({ queryKey: keys.journeys });
    },
  });
}

/** Back to the start: the walked sessions stay in the history. */
export function useResetJourney() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<JourneyDetail>(`/journeys/${id}/reset`, { method: 'POST' }),
    onSuccess: (journey) => {
      queryClient.setQueryData(keys.journey(journey.id), journey);
      return queryClient.invalidateQueries({ queryKey: keys.journeys });
    },
  });
}

export function useDeleteJourney() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/journeys/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: keys.journey(id) });
      return queryClient.invalidateQueries({ queryKey: keys.journeys });
    },
  });
}

export function useFriends() {
  return useQuery({
    queryKey: keys.friends,
    ...cached('friends', () => api<FriendList>('/friends')),
  });
}

export function useUserSearch(text: string) {
  const q = text.trim().replace(/^@/, '').toLowerCase();
  return useQuery({
    queryKey: [...keys.userSearch, q],
    enabled: q.length >= 2,
    staleTime: 10_000,
    queryFn: () => api<UserMatch[]>('/users/search', { query: { q } }),
  });
}

export function useInviteCode() {
  return useQuery({
    queryKey: ['friends', 'invite'],
    staleTime: Infinity,
    ...cached('invite-code', () => api<{ code: string }>('/friends/invite')),
  });
}

/** Any change to friends refreshes the list and the search results. */
function useFriendsMutation<T, R>(run: (arg: T) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.friends }),
        queryClient.invalidateQueries({ queryKey: keys.userSearch }),
        queryClient.invalidateQueries({ queryKey: ['leaderboards'] }),
      ]),
  });
}

export function useAddFriend() {
  return useFriendsMutation((body: { username: string } | { invite_code: string }) =>
    api<AddFriendResult>('/friends', { method: 'POST', body }),
  );
}

export function useAcceptFriend() {
  return useFriendsMutation((id: string) => api<void>(`/friends/${id}/accept`, { method: 'POST' }));
}

/** Removes a friend, declines their request or cancels yours. */
export function useRemoveFriend() {
  return useFriendsMutation((id: string) => api<void>(`/friends/${id}`, { method: 'DELETE' }));
}

export function useLeaderboard(period: LeaderboardPeriod) {
  return useQuery({
    queryKey: ['leaderboards', period],
    ...cached(`leaderboard:${period}`, () =>
      api<Leaderboard>('/leaderboards', { query: { period } }),
    ),
  });
}
