import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import { keys as journeyKeys } from './queries';
import type {
  EventCard,
  JourneyDetail,
  LiveStandings,
  PublicProfile,
  PublicRouteCard,
  PublicRouteDetail,
  PublicRouteSort,
  RoutePhoto,
} from './types';

export const communityKeys = {
  publicRoutes: ['public-routes'] as const,
  publicRoute: (id: string) => ['public-routes', 'one', id] as const,
};

export type PublicRouteFilters = {
  sort?: PublicRouteSort;
  q?: string;
  tag?: string;
  max_km?: number;
  lat?: number;
  lon?: number;
};

/** Browse public routes; `enabled` waits for a position when sorting by distance. */
export function usePublicRoutes(filters: PublicRouteFilters, enabled = true) {
  return useQuery({
    queryKey: [...communityKeys.publicRoutes, 'list', filters],
    enabled,
    staleTime: 60_000,
    queryFn: () => api<PublicRouteCard[]>('/public-routes', { query: filters }),
  });
}

/** The route of the week; null when nothing is published yet. */
export function useFeaturedRoute() {
  return useQuery({
    queryKey: [...communityKeys.publicRoutes, 'featured'],
    staleTime: 5 * 60_000,
    queryFn: () =>
      api<PublicRouteCard>('/public-routes/featured').catch((error: { status?: number }) => {
        if (error.status === 404) return null;
        throw error;
      }),
  });
}

export function usePublicRoute(id: string | undefined) {
  return useQuery({
    queryKey: communityKeys.publicRoute(id ?? ''),
    enabled: !!id,
    queryFn: () => api<PublicRouteDetail>(`/public-routes/${id}`),
  });
}

export type PublishInput = {
  route_id: string;
  title: string;
  description: string;
  visibility: 'everyone' | 'friends';
  tags: string[];
};

export function usePublish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PublishInput) =>
      api<PublicRouteDetail>('/public-routes', { method: 'POST', body: input }),
    onSuccess: (route) => {
      queryClient.setQueryData(communityKeys.publicRoute(route.id), route);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: communityKeys.publicRoutes }),
        queryClient.invalidateQueries({ queryKey: journeyKeys.journeys }),
      ]);
    },
  });
}

/** Upload one photo (JPEG bytes) of a published route. */
export function useRoutePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      kind,
      image,
    }: {
      id: string;
      kind: RoutePhoto['kind'];
      image: ArrayBuffer;
    }) =>
      api<PublicRouteDetail>(`/public-routes/${id}/photos/${kind}`, {
        method: 'PUT',
        raw: image,
        contentType: 'image/jpeg',
      }),
    onSuccess: (route) => queryClient.setQueryData(communityKeys.publicRoute(route.id), route),
  });
}

export function useStartPublicRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<JourneyDetail>(`/public-routes/${id}/start`, { method: 'POST' }),
    onSuccess: (journey) => {
      queryClient.setQueryData(journeyKeys.journey(journey.id), journey);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: journeyKeys.journeys }),
        queryClient.invalidateQueries({ queryKey: communityKeys.publicRoutes }),
      ]);
    },
  });
}

export function useUnpublish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/public-routes/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: communityKeys.publicRoutes }),
  });
}

export type ReportTarget = 'route' | 'post' | 'comment' | 'user';

export function useReport() {
  return useMutation({
    mutationFn: (input: { target_type: ReportTarget; target_id: string; reason?: string }) =>
      api<void>('/reports', { method: 'POST', body: input }),
  });
}

export const eventKeys = {
  events: ['events'] as const,
  event: (id: string) => ['events', 'one', id] as const,
  live: (id: string) => ['events', 'live', id] as const,
};

export type EventFilter = 'all' | 'mine' | 'friends';

export function useEvents(filter: EventFilter, q?: string) {
  return useQuery({
    queryKey: [...eventKeys.events, 'list', filter, q ?? ''],
    staleTime: 30_000,
    queryFn: () => api<EventCard[]>('/events', { query: { filter, q: q || undefined } }),
  });
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: eventKeys.event(id ?? ''),
    enabled: !!id,
    queryFn: () => api<EventCard>(`/events/${id}`),
  });
}

/** Live standings, refreshed every five seconds while shown. */
export function useLiveStandings(id: string | undefined) {
  return useQuery({
    queryKey: eventKeys.live(id ?? ''),
    enabled: !!id,
    refetchInterval: 5_000,
    queryFn: () => api<LiveStandings>(`/events/${id}/live`),
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      public_route_id: string;
      title: string;
      starts_at: string;
      ends_at: string;
    }) => api<EventCard>('/events', { method: 'POST', body: input }),
    onSuccess: (event) => {
      queryClient.setQueryData(eventKeys.event(event.id), event);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: eventKeys.events }),
        queryClient.invalidateQueries({ queryKey: journeyKeys.journeys }),
      ]);
    },
  });
}

/** Sign up (`true`) or leave (`false`). */
export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) =>
      api<EventCard>(`/events/${id}/register`, { method: on ? 'POST' : 'DELETE' }),
    onSuccess: (event) => {
      queryClient.setQueryData(eventKeys.event(event.id), event);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: eventKeys.events }),
        queryClient.invalidateQueries({ queryKey: journeyKeys.journeys }),
      ]);
    },
  });
}

export const profileKeys = {
  profile: (id: string) => ['profiles', id] as const,
};

export function useProfile(id: string | undefined) {
  return useQuery({
    queryKey: profileKeys.profile(id ?? ''),
    enabled: !!id,
    queryFn: () => api<PublicProfile>(`/users/${id}/profile`),
  });
}

/** Follow (`true`) or stop following (`false`) a walker. */
export function useFollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) =>
      api<void>(`/users/${id}/follow`, { method: on ? 'POST' : 'DELETE' }),
    onSuccess: (_, { id }) => queryClient.invalidateQueries({ queryKey: profileKeys.profile(id) }),
  });
}
