import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { useAuth } from '@/api/auth';

import { Avatar } from './primitives';

/** My picture at the right of a tab title (48), opening my profile. */
export function MeAvatar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <Pressable
      onPress={() => router.navigate('/profile')}
      accessibilityRole="button"
      accessibilityLabel={t('nav.profile')}
    >
      <Avatar
        name={user?.first_name ?? '?'}
        seed={user?.id}
        photo={user?.avatar_url}
        tone="accent"
        size={48}
      />
    </Pressable>
  );
}
