import { useMutation } from '@tanstack/react-query';

import { useAuth } from './auth';
import { api } from './client';
import type { UserProfile } from './types';

export type ProfilePatch = Partial<
  Pick<
    UserProfile,
    | 'first_name'
    | 'username'
    | 'email'
    | 'country'
    | 'home_city'
    | 'height_cm'
    | 'stride_cm'
    | 'daily_step_goal'
    | 'sessions_per_week'
    | 'language'
    | 'app_color'
    | 'map_mood'
    | 'units'
    | 'notifications'
    | 'visibility'
  >
>;

/** Changes the profile at once on screen, then on the server (back on failure). */
export function useUpdateProfile() {
  const { user, setUser } = useAuth();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => api<UserProfile>('/me', { method: 'PATCH', body: patch }),
    onMutate: (patch) => {
      const before = user;
      if (user) setUser({ ...user, ...patch });
      return before;
    },
    onSuccess: (profile) => setUser(profile),
    onError: (_error, _patch, before) => {
      if (before) setUser(before);
    },
  });
}
