import { Footprints, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/api/auth';
import { api } from '@/api/client';
import { useUpdateProfile } from '@/api/profile';
import type { UserProfile } from '@/api/types';
import { pickPhoto } from '@/community/pick-photo';
import { useColors, useShadows } from '@/theme';
import { Stepper, TextField } from '@/ui/controls';
import { InfoPill } from '@/ui/pills';
import { Avatar, Button } from '@/ui/primitives';

import { HEIGHT_RANGE, strideFor, type Draft } from '../draft';
import { Headline, OnboardingFrame, type FrameNav } from '../frame';

type Props = {
  nav: FrameNav;
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  next: () => void;
};

/** Étape 2: first name, photo and height (for the stride, hence the steps). */
export function ProfileStep({ nav, draft, setDraft, next }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const shadows = useShadows();
  const { user, setUser } = useAuth();
  const update = useUpdateProfile();
  const name = draft.firstName.trim();

  const photo = async () => {
    try {
      const picked = await pickPhoto(512, [1, 1]);
      if (!picked) return;
      setDraft({ photo: picked.uri });
      setUser(
        await api<UserProfile>('/me/avatar', {
          method: 'PUT',
          raw: picked.bytes,
          contentType: 'image/jpeg',
        }),
      );
    } catch (error) {
      setDraft({ photo: null });
      Alert.alert(
        t((error as Error).message === 'needs-update' ? 'account.needsUpdate' : 'errors.generic'),
      );
    }
  };

  const height = (delta: number) =>
    setDraft({
      heightCm: Math.min(HEIGHT_RANGE[1], Math.max(HEIGHT_RANGE[0], draft.heightCm + delta)),
    });

  const go = () => {
    update.mutate({
      ...(name && name !== user?.first_name ? { first_name: name } : {}),
      height_cm: draft.heightCm,
    });
    next();
  };

  return (
    <OnboardingFrame
      {...nav}
      footer={<Button tone="dark" title={t('onboarding.continue')} onPress={go} disabled={!name} />}
    >
      <Headline
        kicker={t('onboarding.profile.kicker')}
        title={t('onboarding.profile.title')}
        text={t('onboarding.profile.text')}
      />
      <View style={styles.identity}>
        <Pressable
          onPress={photo}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.profile.photo')}
        >
          <Avatar name={name || '?'} size={76} photo={draft.photo ?? user?.avatar_url} />
          <View
            style={[
              styles.plus,
              { backgroundColor: colors.inverse, borderColor: colors.background },
            ]}
          >
            <Plus size={15} color={colors.onInverse} strokeWidth={2.6} />
          </View>
        </Pressable>
        <View style={styles.flex}>
          <TextField
            label={t('onboarding.profile.firstName')}
            value={draft.firstName}
            onChangeText={(firstName) => setDraft({ firstName })}
            autoComplete="given-name"
            textContentType="givenName"
            returnKeyType="done"
          />
        </View>
      </View>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          shadows.card,
        ]}
      >
        <Stepper
          label={t('onboarding.profile.height')}
          value={String(draft.heightCm)}
          unit="cm"
          onMinus={() => height(-1)}
          onPlus={() => height(1)}
          minusLabel={t('onboarding.profile.less')}
          plusLabel={t('onboarding.profile.more')}
        >
          <InfoPill
            label={t('onboarding.profile.stride', { cm: strideFor(draft.heightCm) })}
            icon={Footprints}
          />
        </Stepper>
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  plus: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 99,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { borderRadius: 26, borderWidth: 1, padding: 20 },
});
