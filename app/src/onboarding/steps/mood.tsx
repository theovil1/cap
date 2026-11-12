import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/api/auth';
import { useUpdateProfile } from '@/api/profile';
import type { AppColor, MapMood } from '@/settings/appearance';
import { ACCENTS, fonts, useColors } from '@/theme';
import { Button } from '@/ui/primitives';

import { Headline, OnboardingFrame, type FrameNav } from '../frame';
import { GroupLabel } from '../parts';

const COLORS: AppColor[] = ['orange', 'blue', 'green', 'purple', 'pink'];
const THUMBS = {
  day: require('../../../assets/images/onboarding/mood-day.jpg'),
  night: require('../../../assets/images/onboarding/mood-night.jpg'),
};

/** Étape 4: the app colour and the map mood, applied at once to the whole app. */
export function MoodStep({ nav, next }: { nav: FrameNav; next: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { user } = useAuth();
  const update = useUpdateProfile();
  const appColor = user?.app_color ?? 'orange';
  const mood = user?.map_mood ?? 'auto';
  const setMood = (map_mood: MapMood) => update.mutate({ map_mood });

  const selected = (on: boolean) =>
    on
      ? { borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.accentSoft }
      : { borderWidth: 1, margin: 1, borderColor: colors.track, backgroundColor: colors.surface };

  return (
    <OnboardingFrame
      {...nav}
      footer={<Button tone="dark" title={t('onboarding.continue')} onPress={next} />}
    >
      <Headline
        kicker={t('onboarding.mood.kicker')}
        title={t('onboarding.mood.title')}
        text={t('onboarding.mood.text')}
      />
      <View style={styles.group}>
        <GroupLabel>{t('onboarding.mood.color')}</GroupLabel>
        <View style={styles.swatches} accessibilityRole="radiogroup">
          {COLORS.map((name) => {
            const on = appColor === name;
            const swatch = ACCENTS[name][colors.dark ? 'dark' : 'light'];
            return (
              <Pressable
                key={name}
                onPress={() => update.mutate({ app_color: name })}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t(`profile.colors.${name}`)}
                style={[styles.ring, on && { borderColor: swatch.accent }]}
              >
                <View style={[styles.swatch, { backgroundColor: swatch.accent }]}>
                  {on ? <Check size={20} color="#FFFFFF" strokeWidth={3} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.group}>
        <GroupLabel>{t('onboarding.mood.map')}</GroupLabel>
        <View style={styles.maps} accessibilityRole="radiogroup">
          {(['day', 'night'] as const).map((key) => (
            <Pressable
              key={key}
              onPress={() => setMood(key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: mood === key }}
              style={[styles.map, selected(mood === key)]}
            >
              <Image
                source={THUMBS[key]}
                style={styles.thumb}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
              <Text style={[styles.mapLabel, { color: colors.text }]}>
                {t(`profile.moods.${key}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => setMood('auto')}
          accessibilityRole="radio"
          accessibilityState={{ selected: mood === 'auto' }}
          style={[styles.auto, selected(mood === 'auto')]}
        >
          <Text style={[styles.autoText, { color: colors.text }]}>{t('onboarding.mood.auto')}</Text>
        </Pressable>
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  ring: {
    width: 58,
    height: 58,
    margin: -5,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maps: { flexDirection: 'row', gap: 10 },
  map: { flex: 1, gap: 8, padding: 5, borderRadius: 22, alignItems: 'center' },
  thumb: { alignSelf: 'stretch', height: 130, borderRadius: 16 },
  mapLabel: { fontFamily: fonts.textSemiBold, fontSize: 14, paddingBottom: 6 },
  auto: { height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  autoText: { fontFamily: fonts.textSemiBold, fontSize: 14.5 },
});
