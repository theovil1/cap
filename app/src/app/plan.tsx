import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { useCreateEvent, usePublicRoute } from '@/api/community';
import { PlanFields, usePlan } from '@/community/plan-fields';
import { formatKm } from '@/i18n/format';
import { fonts, useColors } from '@/theme';
import { TextField } from '@/ui/controls';
import { Button, RoundButton } from '@/ui/primitives';

/** Schedule a common start on a public route: a title, a day, an hour, how long it stays open. */
export default function PlanScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { publicRouteId } = useLocalSearchParams<{ publicRouteId: string }>();
  const { data: route } = usePublicRoute(publicRouteId);
  const create = useCreateEvent();
  const [title, setTitle] = useState<string | null>(null);
  const [plan, setPlan] = usePlan();
  const shownTitle = title ?? route?.title ?? '';

  const submit = () =>
    create.mutate(
      {
        public_route_id: publicRouteId,
        title: shownTitle.trim(),
        starts_at: plan.startsAt.toISOString(),
        ends_at: plan.endsAt.toISOString(),
      },
      {
        onSuccess: (event) => router.replace({ pathname: '/event/[id]', params: { id: event.id } }),
        onError: (error) =>
          Alert.alert(
            error instanceof ApiError && error.code === 'invalid_start'
              ? t('plan.tooSoon')
              : t('plan.failed'),
          ),
      },
    );

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <RoundButton
            icon={<ChevronLeft size={22} color={colors.text} />}
            onPress={() => router.back()}
            label={t('common.back')}
          />
          <Text style={[styles.title, { color: colors.text }]}>{t('plan.schedule')}</Text>
        </View>
        {route ? (
          <Text style={[styles.lead, { color: colors.textSecondary }]}>
            {t('plan.lead', { title: route.title, km: formatKm(route.distance_m, 0) })}
          </Text>
        ) : null}
        <TextField
          label={t('publish.titleLabel')}
          value={shownTitle}
          onChangeText={setTitle}
          maxLength={80}
        />
        <PlanFields plan={plan} onChange={setPlan} alwaysOn />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          tone="accent"
          title={t('plan.submit')}
          icon={<CalendarDays size={19} color={colors.onAccent} />}
          onPress={submit}
          loading={create.isPending}
          disabled={!route || shownTitle.trim().length < 3}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16, width: '100%', maxWidth: 620, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -0.8, flexShrink: 1 },
  lead: { fontFamily: fonts.text, fontSize: 15.5, lineHeight: 23 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
});
