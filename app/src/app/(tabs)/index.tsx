import { router } from 'expo-router';
import { Bluetooth, Flame, Footprints, Plus, Route as RouteIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/api/auth';
import { useActiveJourney } from '@/api/queries';
import { formatDate, formatKm, formatNumber } from '@/i18n/format';
import { journeyTitle } from '@/journey/names';
import { nextStage, stepsFor } from '@/journey/progress';
import { RouteMap } from '@/map/route-map';
import { useSession } from '@/session/session-context';
import { useDayStats } from '@/session/stats';
import { fonts, useColors } from '@/theme';
import { Ring } from '@/ui/charts';
import { TabScreen, useWide } from '@/ui/layout';
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

  return (
    <TabScreen>
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
          <Avatar name={user?.first_name ?? '?'} />
        </Pressable>
      </View>

      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={[styles.column, wide && { flex: 1.3 }]}>
          <JourneyCard walkingM={live?.distanceM ?? 0} />
        </View>
        <View style={[styles.column, wide && { flex: 1 }]}>
          <View style={styles.row}>
            <Card style={[styles.small, { flex: 1.15 }]}>
              <Label>{t('home.dailyGoal')}</Label>
              <View style={styles.goal}>
                <Ring
                  ratio={stats.todaySteps / goal}
                  label={`${formatNumber(Math.min(999, (100 * stats.todaySteps) / goal))} %`}
                />
                <View style={{ gap: 3, flex: 1 }}>
                  <Figure value={formatNumber(stats.todaySteps)} size={21} />
                  <Text style={[styles.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                    {t('home.ofSteps', { goal: formatNumber(goal) })}
                  </Text>
                  <Text
                    style={[styles.caption, styles.strong, { color: colors.accentText }]}
                    numberOfLines={1}
                  >
                    {leftSteps > 0
                      ? t('home.stillKm', { km: formatKm(leftSteps * strideM) })
                      : t('home.goalReached')}
                  </Text>
                </View>
              </View>
            </Card>
            <Card style={[styles.small, { flex: 1 }]}>
              <View style={styles.inline}>
                <Flame size={15} color={colors.accentText} strokeWidth={2.2} />
                <Label>{t('home.streak')}</Label>
              </View>
              <Figure
                value={String(stats.streak)}
                unit={t('home.days', { count: stats.streak })}
                size={34}
              />
              <View style={styles.dots}>
                {stats.week.map((active, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      active
                        ? { backgroundColor: colors.accent }
                        : i === 6
                          ? { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.accent }
                          : { borderWidth: 1.5, borderColor: colors.track },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.record, { color: colors.textMuted }]}>
                {t('home.record', { count: stats.bestStreak })}
              </Text>
            </Card>
          </View>
          <TreadmillBanner />
        </View>
      </View>
    </TabScreen>
  );
}

function JourneyCard({ walkingM }: { walkingM: number }) {
  const { t } = useTranslation();
  const colors = useColors();
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
    <Pressable onPress={() => router.push('/session')}>
      <Card style={{ overflow: 'hidden' }}>
        <View style={styles.mapBox}>
          {detail && (
            <RouteMap
              path={detail.path}
              walkedM={walked}
              stages={detail.stages}
              mode="card"
              initial={user?.first_name}
              style={StyleSheet.absoluteFill}
            />
          )}
          <Glass style={styles.chip}>
            <RouteIcon size={15} color={colors.accent} strokeWidth={2.2} />
            <Text style={[styles.chipText, { color: colors.text }]}>{t('home.activeJourney')}</Text>
          </Glass>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={[styles.journeyTitle, { color: colors.text }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {journeyTitle(summary)}
              </Text>
              <Text style={[styles.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                <Text style={[styles.strong, { color: colors.text }]}>{formatKm(walked)}</Text>{' '}
                {t('home.ofKm', { total: formatKm(total, 0) })}
                {stage ? ` · ${t('home.stageIn', { km: formatKm(stage.at_m - walked) })}` : ''}
              </Text>
            </View>
            <Figure
              value={formatNumber(Math.floor((100 * walked) / total))}
              unit="%"
              size={32}
              color={colors.accentText}
            />
          </View>
          <ProgressBar ratio={walked / total} marks={marks} height={9} />
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
  return (
    <Pressable
      onPress={() => router.push('/session')}
      style={[styles.banner, { backgroundColor: connected ? colors.blue : colors.textSecondary }]}
    >
      <View style={styles.bannerIcon}>
        {connected ? (
          <Footprints size={21} color="#FFFFFF" />
        ) : (
          <Bluetooth size={21} color="#FFFFFF" />
        )}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={styles.bannerTitle} numberOfLines={1}>
          {connected
            ? t('home.treadmillConnected', { name })
            : t(`treadmill.status.${connection.status}`, { name })}
        </Text>
        <Text style={styles.bannerText} numberOfLines={1}>
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
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  small: { padding: 14, gap: 10 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  caption: { fontFamily: fonts.text, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  strong: { fontFamily: fonts.textSemiBold },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dots: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 12, height: 12, borderRadius: 99 },
  record: { fontFamily: fonts.text, fontSize: 11.5 },
  empty: { padding: 22, gap: 10, alignItems: 'center' },
  emptyTitle: { fontFamily: fonts.display, fontSize: 21 },
  mapBox: { height: 150, overflow: 'hidden' },
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
