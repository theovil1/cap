import { router } from 'expo-router';
import { Bluetooth, Flame, Footprints, Plus, Route as RouteIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/api/auth';
import { useActiveJourney } from '@/api/queries';
import { formatDate, formatKm, formatNumber } from '@/i18n/format';
import { MyJourneys } from '@/journey/my-journeys';
import { RaceCard } from '@/live/race-card';
import { WeekCard } from '@/session/week-card';
import { journeyTitle } from '@/journey/names';
import { nextStage, stepsFor } from '@/journey/progress';
import { RouteMap } from '@/map/route-map';
import { useSession } from '@/session/session-context';
import { useDayStats } from '@/session/stats';
import { fonts, useColors } from '@/theme';
import { MeAvatar } from '@/ui/me-avatar';
import { Ring } from '@/ui/charts';
import { ScreenHeader, TabScreen, useWide } from '@/ui/layout';
import { Avatar, Button, Card, Figure, Glass, Label, ProgressBar } from '@/ui/primitives';

export default function HomeScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user } = useAuth();
  const { live } = useSession();
  const wide = useWide();
  const liveSteps = live ? stepsFor(live.distanceM, user?.stride_cm) : 0;
  const stats = useDayStats(live?.distanceM ?? 0, liveSteps);
  const goal = user?.daily_step_goal ?? 7000;
  const strideM = (user?.stride_cm ?? 70) / 100;
  const leftSteps = Math.max(0, goal - stats.todaySteps);
  const { detail } = useActiveJourney();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // iPad: the journey and the cards fill the screen under the title, as in the mockup.
  const rowHeight = height - (insets.top + 2) - 54 - 20 - (insets.bottom + 32);

  return (
    <TabScreen>
      {wide ? (
        <ScreenHeader
          kicker={formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
          title={t('home.hello', { name: user?.first_name ?? '' })}
        >
          <MeAvatar />
        </ScreenHeader>
      ) : (
        <View style={styles.header}>
          <View style={{ gap: 3 }}>
            <Text style={[styles.date, { color: colors.textSecondary }]}>
              {formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <Text style={[styles.hello, { color: colors.text }]}>
              {t('home.hello', { name: user?.first_name ?? '' })}
            </Text>
          </View>
          <Pressable
            onPress={() => router.navigate('/profile')}
            accessibilityLabel={t('nav.profile')}
          >
            <Avatar name={user?.first_name ?? '?'} photo={user?.avatar_url} />
          </Pressable>
        </View>
      )}

      <View style={[styles.columns, wide && styles.columnsWide, wide && { minHeight: rowHeight }]}>
        <View style={[styles.column, wide && styles.mapColumn]}>
          <JourneyCard walkingM={live?.distanceM ?? 0} />
        </View>
        <View style={[styles.column, wide && styles.sideColumn]}>
          <View style={[styles.row, wide && styles.rowWide]}>
            <Card style={[styles.small, wide ? styles.smallWide : { flex: 1.15 }]}>
              <Label style={wide && styles.labelWide}>{t('home.dailyGoal')}</Label>
              {wide ? (
                <>
                  <Ring
                    ratio={stats.todaySteps / goal}
                    label={`${formatNumber(Math.min(999, (100 * stats.todaySteps) / goal))} %`}
                    size={104}
                    labelSize={20}
                  />
                  <Text style={[styles.goalLine, { color: colors.textSecondary }]}>
                    <Text style={[styles.strong, { color: colors.text }]}>
                      {formatNumber(stats.todaySteps)}
                    </Text>{' '}
                    {t('home.ofStepsShort', { goal: formatNumber(goal) })}
                  </Text>
                </>
              ) : (
                <View style={styles.goal}>
                  <Ring
                    ratio={stats.todaySteps / goal}
                    label={`${formatNumber(Math.min(999, (100 * stats.todaySteps) / goal))} %`}
                  />
                  <View style={styles.goalFigure}>
                    <Figure value={formatNumber(stats.todaySteps)} size={21} />
                    <Text style={[styles.caption, { color: colors.textSecondary }]}>
                      {t('home.ofSteps', { goal: formatNumber(goal) })}
                    </Text>
                  </View>
                </View>
              )}
              {/* Under the ring, on the whole width of the card, so nothing gets cut. */}
              {wide ? null : (
                <Text style={[styles.caption, styles.strong, { color: colors.accentText }]}>
                  {leftSteps > 0
                    ? t('home.stillKm', { km: formatKm(leftSteps * strideM) })
                    : t('home.goalReached')}
                </Text>
              )}
            </Card>
            <Card style={[styles.small, wide ? styles.smallWide : { flex: 1 }]}>
              <View style={styles.inline}>
                <Flame size={15} color={colors.accentText} strokeWidth={2.2} />
                <Label style={wide && styles.labelWide}>{t('home.streak')}</Label>
              </View>
              <Figure
                value={String(stats.streak)}
                unit={t('home.days', { count: stats.streak })}
                size={wide ? 52 : 34}
                unitSize={wide ? 16 : undefined}
              />
              {wide ? <View style={styles.grow} /> : null}
              {/* This week, Monday first: today is dashed until walked, days to come are faint. */}
              <View style={styles.dots}>
                {stats.weekM.map((metres, i) => {
                  const today = i === stats.todayIndex;
                  return (
                    <View key={i} style={styles.day}>
                      <View
                        style={[
                          styles.dot,
                          wide && styles.dotWide,
                          metres > 0
                            ? { backgroundColor: colors.accent }
                            : today
                              ? {
                                  borderWidth: 2,
                                  borderStyle: 'dashed',
                                  borderColor: colors.accent,
                                }
                              : { borderWidth: 1.5, borderColor: colors.track },
                          i > stats.todayIndex && styles.later,
                        ]}
                      />
                      <Text
                        style={[
                          styles.dayLetter,
                          { color: today ? colors.text : colors.textMuted },
                          today && styles.strong,
                        ]}
                      >
                        {t('home.weekdays').split(',')[i]}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={[styles.record, wide && styles.recordWide, { color: colors.textMuted }]}>
                {t('home.record', { count: stats.bestStreak })}
              </Text>
            </Card>
          </View>
          <TreadmillBanner />
          {detail ? (
            <RaceCard detail={detail} myDistanceM={detail.distance_m + (live?.distanceM ?? 0)} />
          ) : null}
          {wide ? <WeekCard metres={stats.weekM} /> : null}
        </View>
      </View>
      <MyJourneys />
    </TabScreen>
  );
}

function JourneyCard({ walkingM }: { walkingM: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  const wide = useWide();
  const { user } = useAuth();
  const { summary, detail, isLoading } = useActiveJourney();

  if (!summary) {
    if (isLoading) return <Card style={{ height: 260 }}>{null}</Card>;
    return (
      <Card style={styles.empty}>
        <RouteIcon size={28} color={colors.accent} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('home.noJourney')}</Text>
        <Text style={[styles.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
          {t('home.noJourneyHint')}
        </Text>
        <Button
          title={t('home.createJourney')}
          icon={<Plus size={20} color="#FFFFFF" />}
          onPress={() => router.push('/new-journey')}
          style={{ alignSelf: 'stretch' }}
        />
      </Card>
    );
  }

  const total = summary.route_distance_m;
  const walked = Math.min(total, summary.distance_m + walkingM);
  const stage = detail ? nextStage(detail.stages, walked) : null;
  const marks = (detail?.stages ?? [])
    .filter((s) => s.position > 0 && s.at_m < total)
    .map((s) => s.at_m / total);

  return (
    <Pressable onPress={() => router.push('/session')} style={wide && styles.grow}>
      <Card style={[styles.journey, wide && styles.journeyWide, wide && styles.grow]}>
        <View style={[styles.mapBox, wide && styles.grow]}>
          {detail && (
            <RouteMap
              path={detail.path}
              walkedM={walked}
              stages={detail.stages}
              mode="card"
              initial={user?.first_name}
              photo={user?.avatar_url}
              style={StyleSheet.absoluteFill}
            />
          )}
          <Glass style={[styles.chip, wide && styles.chipWide]}>
            <RouteIcon size={wide ? 16 : 15} color={colors.accent} strokeWidth={2.2} />
            <Text style={[styles.chipText, wide && styles.chipTextWide, { color: colors.text }]}>
              {t('home.activeJourney')}
            </Text>
          </Glass>
        </View>
        <View style={[styles.cardBody, wide && styles.cardBodyWide]}>
          <View style={[styles.titleRow, wide && styles.titleRowWide]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={[
                  styles.journeyTitle,
                  wide && styles.journeyTitleWide,
                  { color: colors.text },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {journeyTitle(summary)}
              </Text>
              <Text
                style={[
                  styles.caption,
                  wide && styles.captionWide,
                  { color: colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                <Text style={[styles.strong, { color: colors.text }]}>{formatKm(walked)}</Text>{' '}
                {t('home.ofKm', { total: formatKm(total, 0) })}
                {stage ? ` · ${t('home.stageIn', { km: formatKm(stage.at_m - walked) })}` : ''}
              </Text>
            </View>
            <Figure
              value={formatNumber(Math.floor((100 * walked) / total))}
              unit="%"
              size={wide ? 52 : 32}
              unitSize={wide ? 24 : undefined}
              color={colors.accentText}
            />
          </View>
          <ProgressBar ratio={walked / total} marks={marks} height={wide ? 12 : 9} />
        </View>
      </Card>
    </Pressable>
  );
}

function TreadmillBanner() {
  const { t } = useTranslation();
  const colors = useColors();
  const { connection, live } = useSession();
  const connected = connection.status === 'connected';
  const name = connection.deviceName ?? t('treadmill.unknownName');
  const wide = useWide();
  return (
    <Pressable
      onPress={() => router.push('/session')}
      style={[
        styles.banner,
        wide && styles.bannerWide,
        { backgroundColor: connected ? colors.bluetooth : colors.textSecondary },
      ]}
    >
      <View style={[styles.bannerIcon, wide && styles.bannerIconWide]}>
        {connected ? (
          <Footprints size={21} color={colors.onBluetooth} />
        ) : (
          <Bluetooth size={21} color="#FFFFFF" />
        )}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text
          style={[
            styles.bannerTitle,
            wide && styles.bannerTitleWide,
            connected && { color: colors.onBluetooth },
          ]}
          numberOfLines={1}
        >
          {connected
            ? t('home.treadmillConnected', { name })
            : t(`treadmill.status.${connection.status}`, { name })}
        </Text>
        <Text
          style={[
            styles.bannerText,
            wide && styles.bannerTextWide,
            connected && { color: colors.onBluetooth, opacity: 0.85 },
          ]}
          numberOfLines={1}
        >
          {live
            ? t('home.sessionRunning')
            : connected
              ? t('session.waiting')
              : t('home.treadmillHint')}
        </Text>
      </View>
      {connected && <View style={styles.liveDot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  date: { fontFamily: fonts.textMedium, fontSize: 14, textTransform: 'capitalize' },
  hello: { fontFamily: fonts.display, fontSize: 31, lineHeight: 33, letterSpacing: -0.9 },
  columns: { gap: 12 },
  // iPad mockup: 680 for the journey, the rest for the cards, 20 apart.
  columnsWide: { flexDirection: 'row', alignItems: 'stretch', gap: 20 },
  mapColumn: { flex: 680 },
  sideColumn: { flex: 430, gap: 16 },
  rowWide: { gap: 16 },
  smallWide: { flex: 1, padding: 18, gap: 12, borderRadius: 26 },
  labelWide: { fontSize: 14 },
  goalLine: { fontFamily: fonts.text, fontSize: 13, fontVariant: ['tabular-nums'] },
  dotWide: { width: 16, height: 16 },
  recordWide: { fontSize: 12.5 },
  cardBodyWide: { gap: 16, paddingHorizontal: 26, paddingVertical: 22 },
  titleRowWide: { alignItems: 'flex-end' },
  journeyTitleWide: { fontSize: 30, letterSpacing: -0.6 },
  captionWide: { fontSize: 15 },
  chipWide: { left: 18, top: 18, height: 34, paddingHorizontal: 14, gap: 7 },
  chipTextWide: { fontSize: 14 },
  bannerWide: { paddingVertical: 16, paddingHorizontal: 18, borderRadius: 24, gap: 14 },
  bannerIconWide: { width: 44, height: 44, borderRadius: 14 },
  bannerTitleWide: { fontSize: 16 },
  bannerTextWide: { fontSize: 13.5 },
  grow: { flex: 1 },
  journey: { overflow: 'hidden', borderRadius: 28 },
  journeyWide: { borderRadius: 32 },
  column: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  small: { padding: 14, gap: 10 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalFigure: { gap: 3, flex: 1, minWidth: 0 },
  day: { alignItems: 'center', gap: 4 },
  dayLetter: { fontFamily: fonts.text, fontSize: 10.5 },
  later: { opacity: 0.45 },
  caption: { fontFamily: fonts.text, fontSize: 12, fontVariant: ['tabular-nums'] },
  strong: { fontFamily: fonts.textSemiBold },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dots: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 12, height: 12, borderRadius: 99 },
  record: { fontFamily: fonts.text, fontSize: 11.5 },
  empty: { padding: 22, gap: 10, alignItems: 'center' },
  emptyTitle: { fontFamily: fonts.display, fontSize: 21 },
  mapBox: { height: 132, minHeight: 132, overflow: 'hidden' },
  chip: {
    position: 'absolute',
    left: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
  },
  chipText: { fontFamily: fonts.textSemiBold, fontSize: 12.5 },
  cardBody: { gap: 11, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  journeyTitle: { fontFamily: fonts.display, fontSize: 21, letterSpacing: -0.4 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderCurve: 'continuous',
  },
  bannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { color: '#FFFFFF', fontFamily: fonts.textSemiBold, fontSize: 15 },
  bannerText: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.text, fontSize: 12.5 },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
    backgroundColor: '#7CF0A9',
    boxShadow: '0 0 0 5px rgba(124,240,169,0.25)',
  },
});
