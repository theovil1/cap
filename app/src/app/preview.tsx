import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, ChevronLeft, Flag, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/api/auth';
import { keys, useSessions, useStartJourney } from '@/api/queries';
import type { RouteDetail } from '@/api/types';
import { formatDate, formatKm, formatNumber, shortPlace } from '@/i18n/format';
import { DEFAULT_SESSION_M, estimateArrival } from '@/journey/progress';
import { MapKindButton } from '@/map/map-kind-button';
import { RouteMap } from '@/map/route-map';
import { fonts, useColors } from '@/theme';
import { HOME } from '@/ui/routes';
import { useWide } from '@/ui/layout';
import { Button, Figure, Glass, GlassButton, Label } from '@/ui/primitives';

/** Average of the last treadmill sessions, or 4.5 km for a new walker. */
function useAverageSessionM(): number {
  const { data = [] } = useSessions();
  const recent = data.filter((s) => s.source === 'treadmill').slice(0, 10);
  if (recent.length < 3) return DEFAULT_SESSION_M;
  return recent.reduce((sum, s) => sum + s.distance_m, 0) / recent.length;
}

export default function PreviewScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const { user } = useAuth();
  const { routeId } = useLocalSearchParams<{ routeId: string }>();
  const route = useQueryClient().getQueryData<RouteDetail>(keys.route(routeId));
  const startJourney = useStartJourney();
  const averageM = useAverageSessionM();
  const [failed, setFailed] = useState(false);

  // The preview lives in memory only: after a restart, start again.
  if (!route) return <Redirect href="/new-journey" />;

  const estimate = estimateArrival(route.distance_m, user?.sessions_per_week ?? 3, averageM);
  const first = route.stages[0]?.name || shortPlace(route.start.label);
  const last = route.stages.at(-1)?.name || shortPlace(route.end.label);

  const start = () => {
    setFailed(false);
    startJourney.mutate(route.id, {
      onSuccess: () => router.dismissTo(HOME),
      onError: () => setFailed(true),
    });
  };

  const panel = (
    <View
      style={[
        styles.panel,
        { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 },
        wide && styles.panelWide,
      ]}
    >
      <View style={{ gap: 6 }}>
        <Label>{t('preview.walkingRoute')}</Label>
        <Figure value={formatKm(route.distance_m, 0)} unit={t('units.km')} size={60} />
        <View style={styles.inline}>
          <CalendarDays size={16} color={colors.textSecondary} />
          <Text style={[styles.caption, { color: colors.textSecondary }]}>
            <Text style={{ color: colors.text, fontFamily: fonts.textSemiBold }}>
              {t('preview.arrival', {
                date: formatDate(estimate.date, { day: 'numeric', month: 'long' }),
              })}
            </Text>
            {'  '}
            {t('preview.sessions', { count: estimate.sessions, km: formatKm(averageM) })}
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stages}
      >
        {route.stages.map((stage, i) => (
          <View key={stage.id} style={styles.stage}>
            <View style={styles.stageTrack}>
              <View
                style={[
                  styles.stageLine,
                  { backgroundColor: i === 0 ? 'transparent' : colors.track },
                ]}
              />
              <View
                style={[
                  styles.stageDot,
                  {
                    borderColor: i === 0 ? colors.accent : colors.textMuted,
                    backgroundColor: colors.surface,
                  },
                ]}
              />
              <View
                style={[
                  styles.stageLine,
                  {
                    backgroundColor: i === route.stages.length - 1 ? 'transparent' : colors.track,
                  },
                ]}
              />
            </View>
            <Text style={[styles.stageName, { color: colors.text }]} numberOfLines={1}>
              {stage.name || (i === 0 ? first : last)}
            </Text>
            <Text style={[styles.stageKm, { color: colors.textMuted }]}>
              {formatNumber(stage.at_m / 1000)} {t('units.km')}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inline}>
        <ShieldCheck size={16} color={colors.success} />
        <Text style={[styles.caption, { color: colors.success }]}>{t('preview.safe')}</Text>
      </View>

      {failed && (
        <Text style={[styles.caption, { color: colors.danger }]}>{t('errors.network')}</Text>
      )}
      <Button
        tone="accent"
        title={t('preview.start')}
        icon={<Flag size={20} color={colors.onAccent} />}
        onPress={start}
        loading={startJourney.isPending}
      />
    </View>
  );

  return (
    <View
      style={[styles.screen, wide && styles.screenWide, { backgroundColor: colors.background }]}
    >
      <View style={{ flex: 1 }}>
        <RouteMap
          path={route.path}
          walkedM={0}
          stages={route.stages}
          mode="overview"
          initial={user?.first_name}
          padding={{ top: insets.top + 90, bottom: wide ? 40 : 60, left: 40, right: 40 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.top, { top: insets.top + 12 }]}>
          <GlassButton
            icon={<ChevronLeft size={22} color={colors.text} />}
            onPress={router.back}
            label={t('common.back')}
          />
          <Glass style={styles.titlePill}>
            <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>
              {first} → {last}
            </Text>
          </Glass>
          <MapKindButton />
        </View>
      </View>
      {panel}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  screenWide: { flexDirection: 'row' },
  top: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', gap: 10 },
  titlePill: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  titleText: { fontFamily: fonts.textSemiBold, fontSize: 15 },
  panel: {
    gap: 18,
    paddingTop: 22,
    paddingHorizontal: 20,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    marginTop: -34,
  },
  panelWide: { width: 420, marginTop: 0, borderRadius: 0, justifyContent: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  caption: {
    flexShrink: 1,
    fontFamily: fonts.textMedium,
    fontSize: 13.5,
    fontVariant: ['tabular-nums'],
  },
  stages: { paddingVertical: 2 },
  stage: { width: 96, alignItems: 'center', gap: 3 },
  stageTrack: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  stageLine: { flex: 1, height: 2 },
  stageDot: { width: 14, height: 14, borderRadius: 99, borderWidth: 2.5 },
  stageName: {
    paddingHorizontal: 4,
    fontFamily: fonts.textSemiBold,
    fontSize: 12.5,
    textAlign: 'center',
  },
  stageKm: { fontFamily: fonts.text, fontSize: 12, fontVariant: ['tabular-nums'] },
});
