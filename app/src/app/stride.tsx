import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/api/auth';
import { useUpdateProfile } from '@/api/profile';
import { useSession } from '@/session/session-context';
import { fonts, useColors } from '@/theme';
import { Button, Figure, GlassButton } from '@/ui/primitives';

/** Steps the walker counts while the treadmill measures the distance. */
const STEPS = 50;

/** Stride measured on the treadmill: count 50 steps, Cap reads the distance. */
export default function StrideScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const update = useUpdateProfile();
  const { live } = useSession();
  const [startM, setStartM] = useState<number | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const walking = !!live && live.speedKmh > 0;

  const finish = () => {
    if (startM === null || !live) return;
    const cm = Math.round(((live.distanceM - startM) * 100) / STEPS);
    setStartM(null);
    if (cm < 30 || cm > 150) {
      Alert.alert(t('stride.odd'));
      return;
    }
    setResult(cm);
  };
  const save = (cm: number) =>
    update.mutate(
      { stride_cm: cm },
      { onSuccess: () => router.back(), onError: () => Alert.alert(t('errors.generic')) },
    );
  const byHand = () =>
    Alert.prompt(
      t('stride.byHand'),
      undefined,
      [
        { text: t('journeys.cancel'), style: 'cancel' },
        {
          text: t('account.save'),
          onPress: (text?: string) => {
            const cm = Number.parseInt(text ?? '', 10);
            if (cm >= 30 && cm <= 150) save(cm);
            else Alert.alert(t('stride.odd'));
          },
        },
      ],
      'plain-text',
      String(user?.stride_cm ?? ''),
      'number-pad',
    );

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <GlassButton
        icon={<X size={22} color={colors.text} />}
        onPress={() => router.back()}
        label={t('common.close')}
      />
      <Text style={[styles.title, { color: colors.text }]}>{t('stride.title')}</Text>
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        {t('stride.explain', { count: STEPS })}
      </Text>

      <View style={styles.center}>
        {result !== null ? (
          <>
            <Figure value={String(result)} unit="cm" size={88} />
            <Text style={[styles.text, { color: colors.textSecondary }]}>{t('stride.result')}</Text>
          </>
        ) : startM !== null ? (
          <>
            <Figure
              value={String(STEPS)}
              unit={t('stride.steps')}
              size={88}
              color={colors.accentText}
            />
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              {t('stride.counting')}
            </Text>
          </>
        ) : (
          <Text
            style={[
              styles.text,
              { color: walking ? colors.success : colors.textSecondary, textAlign: 'center' },
            ]}
          >
            {walking ? t('stride.ready') : t('stride.startTreadmill')}
          </Text>
        )}
      </View>

      {result !== null ? (
        <>
          <Button
            tone="accent"
            title={t('stride.keep', { cm: result })}
            onPress={() => save(result)}
            loading={update.isPending}
          />
          <Button tone="dark" title={t('stride.again')} onPress={() => setResult(null)} />
        </>
      ) : startM !== null ? (
        <Button tone="accent" title={t('stride.done', { count: STEPS })} onPress={finish} />
      ) : (
        <Button
          tone="accent"
          title={t('stride.start')}
          onPress={() => live && setStartM(live.distanceM)}
          disabled={!walking}
        />
      )}
      <Pressable onPress={byHand} accessibilityRole="button" style={styles.byHand} hitSlop={8}>
        <Text style={[styles.link, { color: colors.blueText }]}>{t('stride.byHand')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 19, gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -0.8, marginTop: 10 },
  text: { fontFamily: fonts.text, fontSize: 15, lineHeight: 21 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  byHand: { alignSelf: 'center', paddingVertical: 10 },
  link: { fontFamily: fonts.textSemiBold, fontSize: 15 },
});
