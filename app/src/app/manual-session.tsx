import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/api/auth';
import { getAppearance } from '@/settings/appearance';
import { stepsFor } from '@/journey/progress';
import { saveManual } from '@/session/store';
import { syncPending } from '@/session/sync';
import { fonts, useColors } from '@/theme';
import { Button, GlassButton } from '@/ui/primitives';
import { Segment } from '@/ui/segment';

const KM_PER_MILE = 1.609344;

/** A session added by hand when the treadmill could not connect. */
export default function ManualSessionScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [day, setDay] = useState<0 | 1 | 2>(0);
  const [distance, setDistance] = useState('');
  const [minutes, setMinutes] = useState('');

  const value = Number.parseFloat(distance.replace(',', '.'));
  const durationMin = Number.parseInt(minutes, 10);
  const distanceM = value * 1000 * (getAppearance().units === 'mi' ? KM_PER_MILE : 1);
  const speedKmh = distanceM / 1000 / (durationMin / 60);
  const valid = distanceM >= 50 && durationMin >= 1 && speedKmh <= 20;

  const save = () => {
    if (!valid) {
      Alert.alert(t('manual.invalid'));
      return;
    }
    // The session ends at the time it is added, on the chosen day.
    const ended = new Date();
    ended.setDate(ended.getDate() - day);
    const endedAt = ended.getTime();
    const durationS = durationMin * 60;
    saveManual({
      localId: randomUUID(),
      startedAt: endedAt - durationS * 1000,
      endedAt,
      distanceM,
      durationS,
      avgInclinePct: 0,
      speeds: [],
      steps: stepsFor(distanceM, user?.stride_cm),
      journeyIds: null,
    });
    syncPending()
      .then(() =>
        Promise.all(
          ['journeys', 'sessions', 'leaderboards'].map((key) =>
            queryClient.invalidateQueries({ queryKey: [key] }),
          ),
        ),
      )
      .catch(() => {});
    router.back();
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.column}>
        <GlassButton
          icon={<X size={22} color={colors.text} />}
          onPress={() => router.back()}
          label={t('common.close')}
        />
        <Text style={[styles.title, { color: colors.text }]}>{t('manual.title')}</Text>
        <Text style={[styles.text, { color: colors.textSecondary }]}>{t('manual.explain')}</Text>

        <Text style={[styles.label, { color: colors.text }]}>{t('manual.day')}</Text>
        <Segment
          options={[
            { value: 0 as const, label: t('manual.today') },
            { value: 1 as const, label: t('ago.yesterday') },
            { value: 2 as const, label: t('manual.dayBefore') },
          ]}
          value={day}
          onChange={setDay}
        />

        <Text style={[styles.label, { color: colors.text }]}>{t('manual.distance')}</Text>
        <Field
          value={distance}
          onChange={setDistance}
          unit={t('units.km')}
          keyboard="decimal-pad"
          placeholder="4,5"
        />
        <Text style={[styles.label, { color: colors.text }]}>{t('manual.duration')}</Text>
        <Field
          value={minutes}
          onChange={setMinutes}
          unit="min"
          keyboard="number-pad"
          placeholder="60"
        />

        <Button
          tone="accent"
          title={t('manual.save')}
          onPress={save}
          disabled={!distance || !minutes}
        />
      </View>
    </ScrollView>
  );
}

function Field({
  value,
  onChange,
  unit,
  keyboard,
  placeholder,
}: {
  value: string;
  onChange: (text: string) => void;
  unit: string;
  keyboard: 'decimal-pad' | 'number-pad';
  placeholder: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text }]}
      />
      <Text style={[styles.unit, { color: colors.textSecondary }]}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 19 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -0.8, marginTop: 10 },
  text: { fontFamily: fonts.text, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fonts.textSemiBold, fontSize: 14, marginTop: 8 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
  },
  input: { flex: 1, fontFamily: fonts.display, fontSize: 22, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: fonts.textSemiBold, fontSize: 15 },
});
