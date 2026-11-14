import { useMutation } from '@tanstack/react-query';

import { storedUser, useAuth } from './auth';
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

/** Last change sent: an older answer from the server must not undo a newer tap. */
let latest = 0;

/** Changes the profile at once on screen, then on the server (back on failure). */
export function useUpdateProfile() {
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => api<UserProfile>('/me', { method: 'PATCH', body: patch }),
    onMutate: (patch) => {
      const before = storedUser();
      if (before) setUser({ ...before, ...patch });
      return { before, id: ++latest };
    },
    onSuccess: (profile, _patch, context) => {
      if (context?.id === latest) setUser(profile);
    },
    onError: (_error, _patch, context) => {
      if (context?.before && context.id === latest) setUser(context.before);
    },
  });
}
