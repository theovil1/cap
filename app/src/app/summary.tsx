import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Check, Flag, Flame, Share as ShareIcon, Sparkle, Swords, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/api/auth';
import { useActiveJourney, useJourney, useJourneys } from '@/api/queries';
import type { Stage } from '@/api/types';
import {
  formatDate,
  formatKm,
  formatNumber,
  formatPace,
  formatRank,
  formatSpeed,
} from '@/i18n/format';
import { journeyTitle } from '@/journey/names';
import { useRacers } from '@/live/use-racers';
import { paceMinPerKm } from '@/journey/progress';
import { RouteMap } from '@/map/route-map';
import { useDayStats } from '@/session/stats';
import { getSession, pendingSessions } from '@/session/store';
import { fonts, useColors } from '@/theme';
import { HOME } from '@/ui/routes';
import { SpeedBars, SpeedChart } from '@/ui/charts';
import { useWide } from '@/ui/layout';
import { Button, Card, Figure, Glass, GlassButton, Label } from '@/ui/primitives';
import { StatTile } from '@/ui/stats';

/** Playful comparisons, picked by distance (identity: "équivalence ludique"). */
const EQUIVALENCES = [
  { key: 'eiffel', meters: 330 },
  { key: 'football', meters: 105 },
  { key: 'champs', meters: 1_910 },
];

function equivalence(distanceM: number, seed: string): { key: string; count: number } {
  const usable = EQUIVALENCES.filter((e) => distanceM / e.meters >= 2);
  const pool = usable.length > 0 ? usable : EQUIVALENCES.slice(1, 2);
  const pick = pool[seed.charCodeAt(0) % pool.length];
  return { key: pick.key, count: Math.max(1, Math.round(distanceM / pick.meters)) };
}

export default function SummaryScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { localId } = useLocalSearchParams<{ localId: string }>();
  const session = localId ? getSession(localId) : null;
  const active = useActiveJourney();
  // The journey may be finished by this very session: follow the allocation, not the active one.
  const journeyId = session?.result?.allocations[0]?.journey_id ?? active.summary?.id;
  const detail = useJourney(journeyId).data ?? null;
  const summary = detail;
  const day = useDayStats();
  const { data: journeys = [] } = useJourneys();
  const races = journeys.filter((j) => j.kind === 'race' && j.status !== 'waiting' && j.joined);
  const [chartWidth, setChartWidth] = useState(0);
  const wide = useWide();

  if (!session) return <Redirect href={HOME} />;

  // Stages passed: from the server once synced, else worked out on the phone.
  const allocation = session.result?.allocations.find((a) => a.journey_id === summary?.id);
  let unlocked: Stage[] = allocation?.unlocked_stages ?? [];
  let afterM = allocation?.total_m ?? 0;
  if (!session.result && summary && detail) {
    const otherPending = pendingSessions()
      .filter((s) => s.localId !== session.localId)
      .reduce((sum, s) => sum + s.distanceM, 0);
    const beforeM = summary.distance_m + otherPending;
    afterM = Math.min(summary.route_distance_m, beforeM + session.distanceM);
    unlocked = detail.stages.filter((s) => s.position > 0 && s.at_m > beforeM && s.at_m <= afterM);
  }
  const stage = unlocked.at(-1) ?? null;
  const stages = detail?.stages ?? [];
  const previous = stage ? stages.find((s) => s.position === stage.position - 1) : null;
  const next = stage ? stages.find((s) => s.position === stage.position + 1) : null;
  const newCounty = stage?.county && previous?.county !== stage.county;

  const goal = user?.daily_step_goal ?? 7000;
  const reached = day.todaySteps >= goal;
  const fun = equivalence(session.distanceM, session.localId);
  const minutes = Math.round(session.durationS / 60);
  const avgSpeed = (session.distanceM / session.durationS) * 3.6;

  const share = () =>
    Share.share({
      message: t('summary.shareText', { km: formatKm(session.distanceM, 2), minutes }),
    });
  const stageText = stage
    ? `${
        newCounty
          ? t('summary.newCounty', { county: stage.county })
          : t('summary.stageKm', { km: formatKm(stage.at_m), start: summary?.start_town ?? '' })
      }${next ? ` ${t('summary.nextStage', { name: next.name })}` : ''}`
    : '';
  const goalText = `${
    reached
      ? t('summary.goalReached', { steps: formatNumber(day.todaySteps) })
      : t('summary.goalLeft', { steps: formatNumber(goal - day.todaySteps) })
  } ${t(`summary.fun.${fun.key}`, { count: fun.count })}`;

  if (wide) {
    const total = detail?.route_distance_m ?? 0;
    const walkedM = afterM || (detail?.distance_m ?? 0);
    return (
      <View style={[styles.wide, { backgroundColor: colors.inset }]}>
        {detail && (
          <RouteMap
            path={detail.path}
            walkedM={walkedM}
            mode="card"
            initial={user?.first_name}
            padding={{ right: 440 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {detail && (
          <Glass style={[styles.mapTitle, { top: insets.top + 16 }]}>
            <Text style={[styles.mapTitleText, { color: colors.text }]} numberOfLines={1}>
              {journeyTitle(detail)}
            </Text>
            <Text style={[styles.mapTitleDetail, { color: colors.textSecondary }]}>
              {t('summary.mapProgress', {
                walked: formatKm(walkedM),
                total: formatKm(total, 0),
                percent: formatNumber(Math.floor((100 * walkedM) / (total || 1))),
              })}
            </Text>
          </Glass>
        )}
        <View
          style={[
            styles.panel,
            { backgroundColor: colors.surface, top: insets.top + 16, bottom: insets.bottom + 16 },
          ]}
        >
          <ScrollView contentContainerStyle={styles.panelContent}>
            <View style={styles.panelTop}>
              <View style={styles.inline}>
                <Check size={16} color={colors.success} strokeWidth={2.4} />
                <Text style={[styles.kicker, { color: colors.success }]}>{t('summary.ended')}</Text>
              </View>
              <Text style={[styles.date, { color: colors.textSecondary }]}>
                {formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
            </View>
            <View style={{ gap: 6 }}>
              <Label style={styles.hello}>
                {t('summary.wellDone', { name: user?.first_name ?? '' })}
              </Label>
              <Figure value={formatKm(session.distanceM, 2)} unit={t('units.km')} size={104} />
            </View>
            <View style={styles.tiles}>
              <StatTile label={t('summary.duration')} value={formatMinutes(minutes)} />
              <StatTile label={t('session.steps')} value={formatNumber(session.steps)} />
              <StatTile
                label={t('session.speed')}
                value={formatSpeed(avgSpeed)}
                unit={t('units.kmh')}
              />
            </View>
            {session.speeds.length >= 2 && (
              <View style={[styles.bars, { backgroundColor: colors.inset }]}>
                <View style={styles.chartHeader}>
                  <Label>{t('session.speed')}</Label>
                  <Text style={[styles.axis, { color: colors.textMuted }]}>
                    {[0, 1 / 4, 1 / 2, 1].map((f) => Math.round(minutes * f)).join(' · ')} min
                  </Text>
                </View>
                <SpeedBars speeds={session.speeds} />
              </View>
            )}
            {races.map((race) => (
              <RacePlace key={race.id} id={race.id} />
            ))}
            {stage && (
              <View style={[styles.note, { backgroundColor: colors.blueSoft }]}>
                <View style={[styles.noteIcon, { backgroundColor: colors.blue }]}>
                  <Flag size={20} color="#FFFFFF" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.noteTitle, { color: colors.text }]}>
                    {t('summary.stageReached', { name: stage.name })}
                  </Text>
                  <Text style={[styles.noteText, { color: colors.textSecondary }]}>
                    {stageText}
                  </Text>
                </View>
              </View>
            )}
            <View style={[styles.note, { backgroundColor: colors.successSoft }]}>
              <Flame size={17} color={colors.success} strokeWidth={2.2} />
              <Text style={[styles.noteText, styles.flex, { color: colors.text }]}>{goalText}</Text>
            </View>
            {!session.result && (
              <Text style={[styles.pending, { color: colors.textMuted }]}>
                {t('summary.pendingSync')}
              </Text>
            )}
          </ScrollView>
          <View style={styles.actions}>
            <Button
              tone="light"
              title={t('summary.share')}
              icon={<ShareIcon size={18} color={colors.text} />}
              onPress={share}
              style={styles.flex}
            />
            <Button
              tone="dark"
              title={t('summary.finish')}
              onPress={() => router.dismissTo(HOME)}
              style={styles.flexWide}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 },
        ]}
      >
        <View style={styles.column}>
          <View style={styles.header}>
            <GlassButton
              icon={<X size={22} color={colors.text} />}
              onPress={() => router.dismissTo(HOME)}
              label={t('common.close')}
            />
            <GlassButton
              icon={<ShareIcon size={20} color={colors.text} />}
              onPress={share}
              label={t('summary.share')}
            />
          </View>

          <View style={styles.inline}>
            <Sparkle size={15} color={colors.accentText} />
            <Text style={[styles.kicker, { color: colors.accentText }]}>
              {t('summary.done', { minutes })}
            </Text>
          </View>
          <Figure value={`+${formatKm(session.distanceM, 2)}`} unit={t('units.km')} size={84} />
          <Text style={[styles.lead, { color: colors.textSecondary }]}>
            {reached
              ? t('summary.goalReached', { steps: formatNumber(day.todaySteps) })
              : t('summary.goalLeft', { steps: formatNumber(goal - day.todaySteps) })}{' '}
            {t(`summary.fun.${fun.key}`, { count: fun.count })}
          </Text>

          {races.map((race) => (
            <RacePlace key={race.id} id={race.id} />
          ))}

          {stage && detail && (
            <Card style={styles.stageCard}>
              <View style={styles.stageMap}>
                <RouteMap
                  path={detail.path}
                  walkedM={stage.at_m}
                  mode="card"
                  initial={user?.first_name}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={[styles.badge, { backgroundColor: colors.blueSoft }]}>
                  <Flag size={13} color={colors.blueText} strokeWidth={2.2} />
                  <Text style={[styles.badgeText, { color: colors.blueText }]}>
                    {t('summary.stageUnlocked', { n: stage.position, total: stages.length - 1 })}
                  </Text>
                </View>
                <Text style={[styles.stageName, { color: colors.text }]} numberOfLines={2}>
                  {stage.name}
                </Text>
                <Text style={[styles.stageText, { color: colors.textSecondary }]}>
                  {newCounty
                    ? t('summary.newCounty', { county: stage.county })
                    : t('summary.stageKm', {
                        km: formatKm(stage.at_m),
                        start: summary?.start_town ?? '',
                      })}
                  {next ? ` ${t('summary.nextStage', { name: next.name })}` : ''}
                </Text>
              </View>
            </Card>
          )}

          {session.speeds.length >= 2 && (
            <Card style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Label>{t('summary.speedDuring')}</Label>
                <Text style={[styles.avg, { color: colors.text }]}>
                  {t('summary.average', { speed: formatSpeed(avgSpeed) })}
                </Text>
              </View>
              <View onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
                <SpeedChart speeds={session.speeds} width={chartWidth} height={110} />
              </View>
              <View style={styles.chartAxis}>
                {[0, 0.5, 1].map((f) => (
                  <Text key={f} style={[styles.axis, { color: colors.textMuted }]}>
                    {Math.round(minutes * f)} min
                  </Text>
                ))}
              </View>
            </Card>
          )}

          <View style={styles.tiles}>
            {[
              [t('session.steps'), formatNumber(session.steps), undefined],
              [t('session.pace'), formatPace(paceMinPerKm(avgSpeed)), t('units.pace')],
              [t('session.incline'), formatNumber(session.avgInclinePct, 1), '%'],
            ].map(([label, value, unit]) => (
              <View key={label} style={[styles.tile, { backgroundColor: colors.inset }]}>
                <Text style={[styles.tileLabel, { color: colors.textSecondary }]}>{label}</Text>
                <Figure value={value ?? ''} unit={unit} size={22} />
              </View>
            ))}
          </View>
          {!session.result && (
            <Text style={[styles.pending, { color: colors.textMuted }]}>
              {t('summary.pendingSync')}
            </Text>
          )}
          {afterM > 0 && summary && afterM >= summary.route_distance_m && (
            <Text style={[styles.lead, { color: colors.accentText }]}>{t('summary.arrived')}</Text>
          )}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.column}>
          <Button
            tone="dark"
            title={t('summary.continue')}
            onPress={() => router.dismissTo(HOME)}
          />
        </View>
      </View>
    </View>
  );
}

/** Place in a race after this session, with a way to the race screen. */
function RacePlace({ id }: { id: string }) {
  const { t } = useTranslation();
  const colors = useColors();
  const race = useJourney(id).data ?? null;
  const list = useRacers(race);
  const me = list.find((r) => r.me);
  if (!race || !me) return null;
  return (
    <Card style={styles.race}>
      <View style={[styles.raceIcon, { backgroundColor: colors.blueSoft }]}>
        <Swords size={18} color={colors.blueText} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.raceTitle, { color: colors.text }]}>
          {t('summary.racePlace', { place: formatRank(me.place), count: list.length })}
        </Text>
        <Text style={[styles.raceName, { color: colors.textSecondary }]} numberOfLines={1}>
          {journeyTitle(race)}
        </Text>
      </View>
      <Button
        title={t('summary.seeRace')}
        onPress={() => router.push({ pathname: '/race/[id]', params: { id } })}
        tone="dark"
        style={styles.raceButton}
      />
    </Card>
  );
}

/** "1 h 21" or "42 min". */
function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  wide: { flex: 1 },
  mapTitle: {
    position: 'absolute',
    left: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 20,
  },
  mapTitleText: { fontFamily: fonts.textSemiBold, fontSize: 15 },
  mapTitleDetail: { fontFamily: fonts.text, fontSize: 13, fontVariant: ['tabular-nums'] },
  panel: {
    position: 'absolute',
    right: 20,
    width: 412,
    borderRadius: 30,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  panelContent: { gap: 14, padding: 26, paddingBottom: 12 },
  panelTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontFamily: fonts.text, fontSize: 13.5, textTransform: 'capitalize' },
  hello: { fontSize: 15 },
  bars: { gap: 12, padding: 16, borderRadius: 20 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20 },
  noteIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteTitle: { fontFamily: fonts.textSemiBold, fontSize: 15 },
  noteText: { fontFamily: fonts.text, fontSize: 13, lineHeight: 19 },
  flex: { flex: 1 },
  flexWide: { flex: 1.5 },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 26,
    paddingBottom: 26,
    paddingTop: 8,
  },
  race: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  raceIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  raceTitle: { fontFamily: fonts.textSemiBold, fontSize: 15.5 },
  raceName: { fontFamily: fonts.text, fontSize: 13 },
  raceButton: { height: 40, paddingHorizontal: 14, borderRadius: 14 },
  content: { paddingHorizontal: 20 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { fontFamily: fonts.textSemiBold, fontSize: 14 },
  lead: { fontFamily: fonts.text, fontSize: 16, lineHeight: 23 },
  stageCard: { flexDirection: 'row', gap: 14, padding: 12, alignItems: 'center' },
  stageMap: { width: 118, height: 118, borderRadius: 18, overflow: 'hidden' },
  badge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  badgeText: { fontFamily: fonts.textSemiBold, fontSize: 12 },
  stageName: { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.4 },
  stageText: { fontFamily: fonts.text, fontSize: 13.5, lineHeight: 19 },
  chartCard: { padding: 16, gap: 12 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  avg: { fontFamily: fonts.textSemiBold, fontSize: 13 },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between' },
  axis: { fontFamily: fonts.text, fontSize: 12 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, gap: 8, padding: 14, borderRadius: 20 },
  tileLabel: { fontFamily: fonts.textMedium, fontSize: 12.5 },
  pending: { fontFamily: fonts.text, fontSize: 12.5, textAlign: 'center' },
  footer: { position: 'absolute', left: 20, right: 20, bottom: 0 },
});
