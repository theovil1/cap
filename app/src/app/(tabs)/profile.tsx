import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import {
  Bluetooth,
  Check,
  ChevronRight,
  Footprints,
  History,
  Minus,
  Plus,
  Settings,
  ShieldCheck,
} from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/api/auth';
import { useUpdateProfile, type ProfilePatch } from '@/api/profile';
import { useActiveJourney, useJourneys, useSessions } from '@/api/queries';
import type { UserProfile } from '@/api/types';
import { formatDate, formatKm, formatNumber } from '@/i18n/format';
import { MedalView } from '@/journey/medal-view';
import { medalsFor } from '@/journey/medals';
import { DEFAULT_SESSION_M, estimateArrival } from '@/journey/progress';
import { useSession } from '@/session/session-context';
import { useDayStats } from '@/session/stats';
import { WeekCard } from '@/session/week-card';
import type { AppColor, MapMood } from '@/settings/appearance';
import { ACCENTS, fonts, useColors } from '@/theme';
import { SectionHeader, Tabs } from '@/ui/controls';
import { TabScreen, useWide } from '@/ui/layout';
import { StatusLabel } from '@/ui/pills';
import { Avatar, Button, Card, RoundButton } from '@/ui/primitives';
import { Segment } from '@/ui/segment';
import { StatTile } from '@/ui/stats';

const COLORS: AppColor[] = ['orange', 'blue', 'green', 'purple', 'pink'];
const MOODS: MapMood[] = ['auto', 'day', 'night'];
const GOAL_STEP = 500;
/** Walking speed used to turn the step goal into a time (km/h). */
const GOAL_SPEED_KMH = 4.5;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user } = useAuth();
  const wide = useWide();
  const { data: sessions = [] } = useSessions();
  const day = useDayStats();
  if (!user) return null;

  const walkedM = sessions.reduce((sum, s) => sum + s.distance_m, 0);
  const since = formatDate(new Date(user.created_at), { month: 'long' });
  const settings = (
    <RoundButton
      icon={<Settings size={21} color={colors.text} />}
      onPress={() => router.push('/account')}
      label={t('account.title')}
    />
  );

  if (wide) {
    return (
      <TabScreen style={styles.wideScreen}>
        <View style={styles.wideHeader}>
          <Text style={[styles.wideTitle, { color: colors.text }]}>{t('nav.profile')}</Text>
          {settings}
        </View>
        <View style={styles.columns}>
          <View style={styles.left}>
            <Identity user={user} walkedM={walkedM} since={since} />
            <MedalsCard walkedM={walkedM} />
            <WeekCard metres={day.weekM} />
          </View>
          <View style={styles.right}>
            <GoalCard user={user} wide />
            <View style={styles.pair}>
              <StrideCard user={user} wide />
              <PerWeekCard user={user} wide />
            </View>
            <ColorCard user={user} wide />
            <View style={styles.pair}>
              <TreadmillCard />
              <HistoryCard count={sessions.length} />
            </View>
          </View>
        </View>
      </TabScreen>
    );
  }

  return (
    <TabScreen>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push('/me')}
          accessibilityRole="button"
          accessibilityHint={t('profile.seeMine')}
          style={[styles.row, styles.flex]}
        >
          <Avatar name={user.first_name} size={64} photo={user.avatar_url} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {user.first_name}
            </Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              {t('profile.walkedSince', { km: formatKm(walkedM, 0), since })}
            </Text>
            <Text style={[styles.link, { color: colors.blueText }]}>{t('profile.seeMine')} ›</Text>
          </View>
        </Pressable>
        {settings}
      </View>
      <GoalCard user={user} />
      <StrideCard user={user} />
      <PerWeekCard user={user} />
      <ColorCard user={user} />
      <HistoryCard count={sessions.length} />
    </TabScreen>
  );
}

/** iPad: who I am, how far, how many journeys, my best streak. */
function Identity({ user, walkedM, since }: { user: UserProfile; walkedM: number; since: string }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { data: journeys = [] } = useJourneys();
  const { bestStreak } = useDayStats();
  const finished = journeys.filter((j) => j.arrived_at).length;
  return (
    <Card style={styles.identity}>
      <View style={styles.identityTop}>
        <Avatar name={user.first_name} size={76} photo={user.avatar_url} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {user.first_name}
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {t('profile.walkedSince', { km: formatKm(walkedM, 0), since })}
          </Text>
        </View>
      </View>
      <View style={styles.pair}>
        <StatTile label={t('profile.total')} value={formatKm(walkedM, 0)} unit={t('units.km')} />
        <StatTile label={t('profile.finished')} value={formatNumber(finished)} />
        <StatTile
          label={t('profile.bestStreak')}
          value={formatNumber(bestStreak)}
          unit={t('profile.daysShort')}
        />
      </View>
      <Button
        tone="light"
        size="medium"
        title={t('profile.seeMine')}
        onPress={() => router.push('/me')}
      />
    </Card>
  );
}

/** iPad: medals won, then the next one to win. */
function MedalsCard({ walkedM }: { walkedM: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { data: journeys = [] } = useJourneys();
  const { bestStreak } = useDayStats();
  const medals = medalsFor({ journeys, totalM: walkedM, bestStreak });
  return (
    <Card style={styles.card}>
      <SectionHeader title={t('medals.title')} />
      {medals.length > 1 || medals[0]?.metal !== 'locked' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.medals}
        >
          {medals.map((medal, i) => (
            <MedalView key={i} medal={medal} width={58} />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.medals}>
          {medals[0] ? <MedalView medal={medals[0]} width={58} /> : null}
          <Text style={[styles.sub, styles.flex, { color: colors.textSecondary }]}>
            {t('medals.none')}
          </Text>
        </View>
      )}
    </Card>
  );
}

function GoalCard({ user, wide }: { user: UserProfile; wide?: boolean }) {
  const { t } = useTranslation();
  const colors = useColors();
  const update = useUpdateProfile();
  const [goal, setGoal] = useGoal(user, update.mutate);
  const stride = user.stride_cm ?? 70;
  const goalM = (goal * stride) / 100;
  const goalMinutes = Math.round((goalM / 1000 / GOAL_SPEED_KMH) * 60);
  const stepper = (
    <View style={[styles.stepper, wide && styles.stepperWide]}>
      <StepButton
        label={t('profile.less')}
        onPress={() => setGoal(goal - GOAL_STEP)}
        disabled={goal <= 1000}
      >
        <Minus size={20} color={colors.text} />
      </StepButton>
      <View style={{ alignItems: 'center' }}>
        <Text style={[styles.goal, { color: colors.text }]}>{formatNumber(goal)}</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          {wide ? t('profile.stepsAndKm', { km: formatKm(goalM) }) : t('profile.stepsPerDay')}
        </Text>
      </View>
      <StepButton
        label={t('profile.more')}
        onPress={() => setGoal(goal + GOAL_STEP)}
        disabled={goal >= 30_000}
      >
        <Plus size={20} color={colors.text} />
      </StepButton>
    </View>
  );
  if (wide) {
    return (
      <Card style={[styles.card, styles.goalWide]}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('profile.goalTitle')}</Text>
          <Text style={[styles.noteText, { color: colors.textSecondary }]}>
            {t('profile.goalNote')}
          </Text>
        </View>
        {stepper}
      </Card>
    );
  }
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('profile.goalTitle')}</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          {t('profile.goalEquals', { km: formatKm(goalM), time: duration(goalMinutes, t) })}
        </Text>
      </View>
      {stepper}
      <View style={[styles.note, { backgroundColor: colors.successSoft }]}>
        <ShieldCheck size={17} color={colors.success} />
        <Text style={[styles.noteText, { color: colors.text }]}>{t('profile.goalNote')}</Text>
      </View>
    </Card>
  );
}

function StrideCard({ user, wide }: { user: UserProfile; wide?: boolean }) {
  const { t } = useTranslation();
  const colors = useColors();
  const stride = user.stride_cm ?? 70;
  const sub = user.height_cm
    ? t('profile.strideFromHeight', { cm: user.height_cm })
    : t('profile.strideDefault');
  const icon = (
    <View style={[styles.icon, { backgroundColor: colors.blueSoft }]}>
      <Footprints size={20} color={colors.blueText} />
    </View>
  );
  if (wide) {
    return (
      <Card style={[styles.card, styles.flex]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('profile.strideTitle')}</Text>
        <View style={styles.row}>
          {icon}
          <View style={{ flex: 1 }}>
            <Text style={[styles.strideValue, { color: colors.text }]}>
              {stride}
              <Text style={[styles.sub, { color: colors.textSecondary }]}> cm</Text>
            </Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>{sub}</Text>
          </View>
        </View>
        <Button
          tone="light"
          size="medium"
          title={t('profile.measureOnTreadmill')}
          onPress={() => router.push('/stride')}
        />
      </Card>
    );
  }
  return (
    <Card style={[styles.card, styles.row]}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          {t('profile.stride', { cm: stride })}
        </Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>{sub}</Text>
      </View>
      <Pressable
        onPress={() => router.push('/stride')}
        accessibilityRole="button"
        style={[styles.pill, { borderColor: colors.border }]}
      >
        <Text style={[styles.pillText, { color: colors.text }]}>{t('profile.measure')}</Text>
      </Pressable>
    </Card>
  );
}

function PerWeekCard({ user, wide }: { user: UserProfile; wide?: boolean }) {
  const { t } = useTranslation();
  const colors = useColors();
  const update = useUpdateProfile();
  const { summary } = useActiveJourney();
  const arrival = summary
    ? estimateArrival(
        summary.route_distance_m - summary.distance_m,
        user.sessions_per_week,
        DEFAULT_SESSION_M,
      )
    : null;
  const when =
    arrival && summary
      ? t('profile.arrivalAround', {
          place: summary.end_town ?? '',
          date: formatDate(arrival.date, { day: 'numeric', month: 'long' }),
        })
      : null;
  return (
    <Card style={[styles.card, wide && styles.flex]}>
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('profile.perWeekTitle')}</Text>
        {when && !wide ? (
          <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
            {when}
          </Text>
        ) : null}
      </View>
      <Segment
        options={[2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))}
        value={user.sessions_per_week}
        onChange={(n) => update.mutate({ sessions_per_week: n })}
      />
      {when && wide ? (
        <Text style={[styles.sub, { color: colors.textSecondary }]}>{when}</Text>
      ) : null}
    </Card>
  );
}

function ColorCard({ user, wide }: { user: UserProfile; wide?: boolean }) {
  const { t } = useTranslation();
  const colors = useColors();
  const update = useUpdateProfile();
  const set = (patch: ProfilePatch) => update.mutate(patch);
  const swatches = (
    <View style={[styles.swatches, wide && styles.swatchesWide]}>
      {COLORS.map((name) => {
        const on = user.app_color === name;
        const swatch = ACCENTS[name][colors.dark ? 'dark' : 'light'];
        return (
          <Pressable
            key={name}
            onPress={() => set({ app_color: name })}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t(`profile.colors.${name}`)}
            style={[styles.swatchRing, on && { borderColor: swatch.accent }]}
          >
            <View style={[styles.swatch, { backgroundColor: swatch.accent }]}>
              {on && <Check size={20} color={swatch.onAccent} strokeWidth={2.6} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
  const moods = wide ? (
    <View style={{ width: 300 }}>
      <Tabs
        options={MOODS.map((m) => ({ value: m, label: t(`profile.moods.${m}`) }))}
        value={user.map_mood}
        onChange={(m) => set({ map_mood: m })}
      />
    </View>
  ) : (
    <View style={{ flex: 1, maxWidth: 230 }}>
      <Segment
        options={MOODS.map((m) => ({ value: m, label: t(`profile.moods.${m}`) }))}
        value={user.map_mood}
        onChange={(m) => set({ map_mood: m })}
      />
    </View>
  );
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('profile.colorTitle')}</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          {t(`profile.colors.${user.app_color}`)}
        </Text>
      </View>
      {wide ? (
        <View style={styles.moodRow}>
          {swatches}
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('profile.map')}</Text>
            {moods}
          </View>
        </View>
      ) : (
        <>
          {swatches}
          <View style={styles.moodRow}>
            <Text style={[styles.label, { color: colors.text }]}>{t('profile.map')}</Text>
            {moods}
          </View>
        </>
      )}
    </Card>
  );
}

/** iPad: the treadmill and a way to its settings. */
function TreadmillCard() {
  const { t } = useTranslation();
  const colors = useColors();
  const { connection } = useSession();
  const connected = connection.status === 'connected';
  return (
    <Pressable
      onPress={() => router.push('/treadmill')}
      accessibilityRole="button"
      style={styles.flex}
    >
      <Card style={[styles.card, styles.row, styles.flex]}>
        <View style={[styles.bigIcon, { backgroundColor: colors.blue }]}>
          <Bluetooth size={24} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {connection.deviceName ?? t('treadmill.none')}
          </Text>
          {connected ? (
            <StatusLabel label={t('profile.treadmillConnected')} />
          ) : (
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              {t(`treadmill.status.${connection.status}`, {
                name: connection.deviceName ?? t('treadmill.unknownName'),
              })}
            </Text>
          )}
        </View>
        <Text style={[styles.link, { color: colors.blueText }]}>{t('profile.treadmill')}</Text>
        <ChevronRight size={16} color={colors.blueText} />
      </Card>
    </Pressable>
  );
}

function HistoryCard({ count }: { count: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  const wide = useWide();
  return (
    <Pressable
      onPress={() => router.push('/history')}
      accessibilityRole="button"
      style={wide && styles.flex}
    >
      <Card style={[styles.linkRow, wide && styles.flex]}>
        <History size={20} color={colors.textSecondary} />
        <Text style={[styles.label, { color: colors.text, flex: 1 }]}>{t('history.title')}</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>{formatNumber(count)}</Text>
        <ChevronRight size={18} color={colors.textMuted} />
      </Card>
    </Pressable>
  );
}

/** The goal moves at once on screen and is saved once the taps stop. */
function useGoal(
  user: UserProfile | null,
  save: (patch: ProfilePatch) => void,
): [number, (n: number) => void] {
  // A draft while tapping; the profile (updated at once on save) shows otherwise.
  const [draft, setDraft] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goal = draft ?? user?.daily_step_goal ?? 7000;
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const change = (n: number) => {
    const next = Math.min(30_000, Math.max(1000, n));
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      save({ daily_step_goal: next });
      setDraft(null);
    }, 700);
  };
  return [goal, change];
}

function duration(minutes: number, t: TFunction): string {
  if (minutes < 60) return t('profile.minutes', { count: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m < 10
    ? t('profile.hours', { count: h })
    : t('profile.hoursMinutes', { h, m: String(m).padStart(2, '0') });
}

function StepButton({
  label,
  onPress,
  disabled,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.stepButton, { borderColor: colors.border, opacity: disabled ? 0.4 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  name: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -0.6 },
  sub: { fontFamily: fonts.text, fontSize: 13, flexShrink: 1, fontVariant: ['tabular-nums'] },
  card: { padding: 16, gap: 14 },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 10,
  },
  cardTitle: { fontFamily: fonts.textSemiBold, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperWide: { gap: 26 },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goal: {
    fontFamily: fonts.display,
    fontSize: 44,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  goalWide: { flexDirection: 'row', alignItems: 'center', gap: 24, paddingHorizontal: 22 },
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16 },
  noteText: { flex: 1, fontFamily: fonts.text, fontSize: 13.5, lineHeight: 19 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bigIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strideValue: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -1 },
  pill: {
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 99,
    borderWidth: 1,
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.textSemiBold, fontSize: 14 },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  swatchesWide: { gap: 10 },
  swatchRing: {
    width: 50,
    height: 50,
    borderRadius: 99,
    borderWidth: 2.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontFamily: fonts.textMedium, fontSize: 15 },
  link: { fontFamily: fonts.textSemiBold, fontSize: 14 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    minHeight: 54,
  },
  wideScreen: { maxWidth: 1180 },
  wideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wideTitle: { fontFamily: fonts.display, fontSize: 31, letterSpacing: -0.9 },
  columns: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  left: { width: 420, gap: 18 },
  right: { flex: 1, gap: 18 },
  pair: { flexDirection: 'row', gap: 12 },
  identity: { padding: 22, gap: 18 },
  identityTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  medals: { gap: 4, alignItems: 'flex-start', flexDirection: 'row' },
});
