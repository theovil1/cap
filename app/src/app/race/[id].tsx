import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronLeft, Flag, Medal, Share as ShareIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useDeleteJourney,
  useJoinRace,
  useJourney,
  useLeaveRace,
  useStartRace,
} from '@/api/queries';
import type { JourneyDetail } from '@/api/types';
import { formatAgo, formatKm, formatNumber, formatRank, formatSpeed } from '@/i18n/format';
import { journeyTitle } from '@/journey/names';
import { DEFAULT_SESSION_M } from '@/journey/progress';
import type { Racer } from '@/live/race';
import { rivalPawns, useRacers } from '@/live/use-racers';
import { RouteMap } from '@/map/route-map';
import { fonts, useColors, useShadows } from '@/theme';
import { useWide } from '@/ui/layout';
import { Avatar, Button, Card, Glass, GlassButton, ProgressBar } from '@/ui/primitives';

export default function RaceScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const shadows = useShadows();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: race, refetch } = useJourney(id);
  const list = useRacers(race ?? null);
  const me = list.find((r) => r.me);
  const [openedAt] = useState(() => Date.now());

  // Positions of rivals who are not walking come from the server: refresh now and then.
  useEffect(() => {
    const timer = setInterval(() => refetch(), 30_000);
    return () => clearInterval(timer);
  }, [refetch]);

  if (!race) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const day = race.starts_at
    ? Math.floor((openedAt - Date.parse(race.starts_at)) / 86_400_000) + 1
    : null;
  const kicker = day ? t('race.day', { count: day }) : t('race.waitingTitle');
  const share = () =>
    Share.share({
      message: me
        ? t('race.shareText', {
            place: formatRank(me.place),
            count: list.length,
            title: journeyTitle(race),
          })
        : journeyTitle(race),
    });
  const panel = (
    <ScrollView
      style={[
        styles.panel,
        { backgroundColor: colors.surface },
        wide && [
          styles.panelWide,
          shadows.floating,
          { top: insets.top + 20, bottom: insets.bottom + 20 },
        ],
      ]}
      contentContainerStyle={{ gap: 16, paddingBottom: wide ? 26 : insets.bottom + 24 }}
    >
      {wide && (
        <View style={{ gap: 4 }}>
          <Text style={[styles.kicker, { color: colors.textSecondary, fontSize: 13 }]}>
            {kicker}
          </Text>
          <Text style={[styles.wideTitle, { color: colors.text }]} numberOfLines={2}>
            {journeyTitle(race)}
          </Text>
        </View>
      )}
      {race.status === 'waiting' ? (
        <Waiting race={race} />
      ) : (
        <Standings race={race} list={list} me={me} />
      )}
    </ScrollView>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={wide ? StyleSheet.absoluteFill : styles.mapArea}>
        <RouteMap
          path={race.path}
          walkedM={me?.distanceM ?? 0}
          stages={race.stages}
          mode="overview"
          rivals={rivalPawns(list)}
          initial={me?.firstName}
          padding={{ top: insets.top + 90, bottom: 60, left: 40, right: wide ? 470 : 40 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.top, { top: insets.top + 12 }]}>
          <GlassButton
            icon={<ChevronLeft size={22} color={colors.text} />}
            onPress={() => router.back()}
            label={t('common.back')}
          />
          {!wide && (
            <>
              <Glass style={styles.titlePill}>
                <Text style={[styles.kicker, { color: colors.textSecondary }]}>{kicker}</Text>
                <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>
                  {journeyTitle(race)}
                </Text>
              </Glass>
              <GlassButton
                icon={<ShareIcon size={20} color={colors.text} />}
                onPress={share}
                label={t('summary.share')}
              />
            </>
          )}
        </View>
      </View>
      {panel}
    </View>
  );
}

/** Before the start: who is in, and the buttons for each role. */
function Waiting({ race }: { race: JourneyDetail }) {
  const { t } = useTranslation();
  const colors = useColors();
  const start = useStartRace();
  const join = useJoinRace();
  const leave = useLeaveRace();
  const cancel = useDeleteJourney();
  const failed = () => Alert.alert(t('journeys.failed'));
  const ready = race.participants.filter((p) => p.joined).length;

  const confirmLeave = () =>
    Alert.alert(t('race.leaveTitle'), undefined, [
      { text: t('journeys.cancel'), style: 'cancel' },
      {
        text: race.joined ? t('race.leave') : t('race.decline'),
        style: 'destructive',
        onPress: () => leave.mutate(race.id, { onSuccess: () => router.back(), onError: failed }),
      },
    ]);
  const confirmCancel = () =>
    Alert.alert(t('race.cancelTitle'), t('race.cancelBody'), [
      { text: t('journeys.cancel'), style: 'cancel' },
      {
        text: t('race.cancel'),
        style: 'destructive',
        onPress: () => cancel.mutate(race.id, { onSuccess: () => router.back(), onError: failed }),
      },
    ]);

  return (
    <>
      <Text style={[styles.heading, { color: colors.text }]}>{t('race.waitingTitle')}</Text>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>
        {race.mine ? t('race.waitingMine') : t('race.waitingOther')}
      </Text>
      <Card>
        {race.participants.map((p, i) => (
          <View
            key={p.user_id}
            style={[
              styles.row,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
            ]}
          >
            <Avatar name={p.first_name} size={38} tone={p.me ? 'accent' : 'plain'} />
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {p.me ? t('rankings.you') : p.first_name}
            </Text>
            {p.joined ? (
              <View style={styles.inline}>
                <Check size={16} color={colors.success} />
                <Text style={[styles.status, { color: colors.success }]}>{t('race.ready')}</Text>
              </View>
            ) : (
              <Text style={[styles.status, { color: colors.textMuted }]}>{t('race.invited')}</Text>
            )}
          </View>
        ))}
      </Card>
      {race.mine ? (
        <>
          <Button
            tone="accent"
            title={t('race.start')}
            icon={<Flag size={20} color={colors.onAccent} />}
            onPress={() => start.mutate(race.id, { onError: failed })}
            loading={start.isPending}
            disabled={ready < 2}
          />
          {ready < 2 && (
            <Text style={[styles.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
              {t('race.needOpponent')}
            </Text>
          )}
          <TextButton label={t('race.cancel')} onPress={confirmCancel} danger />
        </>
      ) : race.joined ? (
        <TextButton label={t('race.leave')} onPress={confirmLeave} danger />
      ) : (
        <>
          <Button
            tone="accent"
            title={t('race.join')}
            onPress={() => join.mutate(race.id, { onError: failed })}
            loading={join.isPending}
          />
          <TextButton label={t('race.decline')} onPress={confirmLeave} />
        </>
      )}
    </>
  );
}

/** During and after the race: places, gaps and who walks right now. */
function Standings({ race, list, me }: { race: JourneyDetail; list: Racer[]; me?: Racer }) {
  const { t } = useTranslation();
  const colors = useColors();
  const [now] = useState(() => Date.now());
  const leader = list[0];
  const above = me && me.place > 1 ? list[me.place - 2] : null;
  const total = race.route_distance_m;
  const marks = list.filter((r) => !r.me).map((r) => r.distanceM / total);
  const destination = race.end_town ?? race.end.label;

  return (
    <>
      {me && (
        <View style={styles.position}>
          <View>
            <Text style={[styles.caption, { color: colors.textSecondary }]}>
              {t('race.yourPlace')}
            </Text>
            <Text style={[styles.place, { color: colors.text }]}>
              {formatNumber(me.place)}
              <Text style={[styles.placeOf, { color: colors.textSecondary }]}>
                {' '}
                {t('race.of', { count: list.length })}
              </Text>
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', flexShrink: 1, gap: 2 }}>
            {race.status === 'finished' || me.arrivedAt ? (
              <Text style={[styles.gap, { color: colors.text }]}>
                {me.arrivedAt ? t('race.arrived', { place: formatRank(me.place) }) : t('race.over')}
              </Text>
            ) : above ? (
              <>
                <Text style={[styles.gap, { color: colors.text }]}>
                  {t('race.behind', {
                    km: formatKm(above.distanceM - me.distanceM),
                    name: above.firstName,
                  })}
                </Text>
                <Text style={[styles.caption, { color: colors.textSecondary }]}>
                  {t('race.sessionsToPass', {
                    count: Math.max(
                      1,
                      Math.ceil((above.distanceM - me.distanceM) / DEFAULT_SESSION_M),
                    ),
                  })}
                </Text>
              </>
            ) : (
              <Text style={[styles.gap, { color: colors.text }]}>
                {list.length > 1
                  ? t('race.ahead', { km: formatKm(me.distanceM - (list[1]?.distanceM ?? 0)) })
                  : ''}
              </Text>
            )}
          </View>
        </View>
      )}
      {me && <ProgressBar ratio={me.distanceM / total} marks={marks} />}

      <View style={{ gap: 6 }}>
        {list.map((r) => (
          <View
            key={r.userId}
            style={[styles.racer, r.me && { backgroundColor: colors.accentSoft }]}
          >
            <Text style={[styles.racerPlace, { color: colors.textSecondary }]}>{r.place}</Text>
            <View>
              <Avatar
                name={r.firstName}
                size={44}
                tone={r.me ? 'accent' : r.distanceM > (me?.distanceM ?? 0) ? 'blue' : 'plain'}
              />
              {r.arrivedAt && r.place === 1 && (
                <View style={[styles.medal, { borderColor: colors.surface }]}>
                  <Medal size={11} color="#FFFFFF" strokeWidth={2.4} />
                </View>
              )}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {r.me ? t('rankings.you') : r.firstName}
              </Text>
              {r.speedKmh !== null ? (
                <View style={styles.inline}>
                  <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.status, { color: colors.success }]}>
                    {t('race.live', { speed: formatSpeed(r.speedKmh) })}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.status, { color: colors.textSecondary }]}>
                  {r.arrivedAt
                    ? t('race.arrivedOn', { when: formatAgo(r.arrivedAt, now) })
                    : r.lastSessionAt
                      ? formatAgo(r.lastSessionAt, now)
                      : t('race.notStarted')}
                </Text>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.km, { color: colors.text }]}>
                {formatKm(r.distanceM)}
                <Text style={[styles.unit, { color: colors.textSecondary }]}> {t('units.km')}</Text>
              </Text>
              <Text style={[styles.status, { color: colors.textSecondary }]}>
                {r.place === 1
                  ? t('race.leader')
                  : `−${formatKm(leader.distanceM - r.distanceM)} ${t('units.km')}`}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={[styles.footer, { color: colors.textMuted }]}>
        {t('race.rule', { place: destination })}
      </Text>
    </>
  );
}

function TextButton({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.textButton} hitSlop={8}>
      <Text
        style={[styles.textButtonText, { color: danger ? colors.danger : colors.textSecondary }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  mapArea: { height: '44%' },
  top: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', gap: 10 },
  titlePill: {
    flex: 1,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  kicker: { fontFamily: fonts.textMedium, fontSize: 11.5 },
  titleText: { fontFamily: fonts.textSemiBold, fontSize: 15 },
  panel: {
    flex: 1,
    paddingTop: 22,
    paddingHorizontal: 20,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    marginTop: -34,
  },
  panelWide: {
    position: 'absolute',
    right: 20,
    width: 404,
    flex: 0,
    marginTop: 0,
    paddingTop: 26,
    paddingHorizontal: 24,
    borderRadius: 30,
    borderCurve: 'continuous',
  },
  wideTitle: { fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.display, fontSize: 24 },
  caption: { fontFamily: fonts.text, fontSize: 13, lineHeight: 18 },
  position: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  place: {
    fontFamily: fonts.display,
    fontSize: 56,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  placeOf: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 0 },
  gap: { fontFamily: fonts.textSemiBold, fontSize: 14, textAlign: 'right' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flex: 1, fontFamily: fonts.textSemiBold, fontSize: 16 },
  status: { fontFamily: fonts.textMedium, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  racer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  racerPlace: { width: 16, fontFamily: fonts.display, fontSize: 17 },
  liveDot: { width: 7, height: 7, borderRadius: 99 },
  km: {
    fontFamily: fonts.display,
    fontSize: 19,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontFamily: fonts.textSemiBold, fontSize: 11, letterSpacing: 0 },
  medal: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 20,
    height: 20,
    borderRadius: 99,
    borderWidth: 2.5,
    backgroundColor: '#E8A317',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    fontFamily: fonts.text,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
  textButton: { alignSelf: 'center', paddingVertical: 8 },
  textButtonText: { fontFamily: fonts.textSemiBold, fontSize: 15 },
});
