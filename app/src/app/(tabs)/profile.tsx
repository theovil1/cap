import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import {
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
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/api/auth';
import { useUpdateProfile, type ProfilePatch } from '@/api/profile';
import { useActiveJourney, useSessions } from '@/api/queries';
import type { UserProfile } from '@/api/types';
import { formatDate, formatKm, formatNumber } from '@/i18n/format';
import { DEFAULT_SESSION_M, estimateArrival } from '@/journey/progress';
import type { AppColor, MapMood } from '@/settings/appearance';
import { ACCENTS, fonts, useColors } from '@/theme';
import { TabScreen } from '@/ui/layout';
import { Avatar, Card } from '@/ui/primitives';
import { Segment } from '@/ui/segment';

const COLORS: AppColor[] = ['orange', 'blue', 'green', 'purple', 'pink'];
const MOODS: MapMood[] = ['auto', 'day', 'night'];
const GOAL_STEP = 500;
/** Walking speed used to turn the step goal into a time (km/h). */
const GOAL_SPEED_KMH = 4.5;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user } = useAuth();
  const update = useUpdateProfile();
  const { data: sessions = [] } = useSessions();
  const { summary } = useActiveJourney();
  const [goal, setGoal] = useGoal(user, update.mutate);
  if (!user) return null;

  const walkedM = sessions.reduce((sum, s) => sum + s.distance_m, 0);
  const since = formatDate(new Date(user.created_at), { month: 'long' });
  const stride = user.stride_cm ?? 70;
  const goalM = (goal * stride) / 100;
  const goalMinutes = Math.round((goalM / 1000 / GOAL_SPEED_KMH) * 60);
  const arrival = summary
    ? estimateArrival(
        summary.route_distance_m - summary.distance_m,
        user.sessions_per_week,
        DEFAULT_SESSION_M,
      )
    : null;
  const set = (patch: ProfilePatch) => update.mutate(patch);

  return (
    <TabScreen>
      <View style={styles.header}>
        <Avatar name={user.first_name} size={64} photo={user.avatar_url} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {user.first_name}
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {t('profile.walkedSince', { km: formatKm(walkedM, 0), since })}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/account')}
          accessibilityRole="button"
          accessibilityLabel={t('account.title')}
          style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Settings size={21} color={colors.text} />
        </Pressable>
      </View>

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('profile.goalTitle')}</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {t('profile.goalEquals', { km: formatKm(goalM), time: duration(goalMinutes, t) })}
          </Text>
        </View>
        <View style={styles.stepper}>
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
              {t('profile.stepsPerDay')}
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
        <View style={[styles.note, { backgroundColor: colors.successSoft }]}>
          <ShieldCheck size={17} color={colors.success} />
          <Text style={[styles.noteText, { color: colors.text }]}>{t('profile.goalNote')}</Text>
        </View>
      </Card>

      <Card style={[styles.card, styles.strideCard]}>
        <View style={[styles.icon, { backgroundColor: colors.blueSoft }]}>
          <Footprints size={20} color={colors.blueText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {t('profile.stride', { cm: stride })}
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {user.height_cm
              ? t('profile.strideFromHeight', { cm: user.height_cm })
              : t('profile.strideDefault')}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/stride')}
          accessibilityRole="button"
          style={[styles.pill, { borderColor: colors.border }]}
        >
          <Text style={[styles.pillText, { color: colors.text }]}>{t('profile.measure')}</Text>
        </Pressable>
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {t('profile.perWeekTitle')}
          </Text>
          {arrival && summary && (
            <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
              {t('profile.arrivalAround', {
                place: summary.end_town ?? '',
                date: formatDate(arrival.date, { day: 'numeric', month: 'long' }),
              })}
            </Text>
          )}
        </View>
        <Segment
          options={[2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))}
          value={user.sessions_per_week}
          onChange={(n) => set({ sessions_per_week: n })}
        />
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('profile.colorTitle')}</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {t(`profile.colors.${user.app_color}`)}
          </Text>
        </View>
        <View style={styles.swatches}>
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
        <View style={styles.moodRow}>
          <Text style={[styles.label, { color: colors.text }]}>{t('profile.map')}</Text>
          <View style={{ flex: 1, maxWidth: 230 }}>
            <Segment
              options={MOODS.map((m) => ({ value: m, label: t(`profile.moods.${m}`) }))}
              value={user.map_mood}
              onChange={(m) => set({ map_mood: m })}
            />
          </View>
        </View>
      </Card>

      <Card>
        <Pressable
          onPress={() => router.push('/history')}
          accessibilityRole="button"
          style={styles.linkRow}
        >
          <History size={20} color={colors.textSecondary} />
          <Text style={[styles.label, { color: colors.text, flex: 1 }]}>{t('history.title')}</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {formatNumber(sessions.length)}
          </Text>
          <ChevronRight size={18} color={colors.textMuted} />
        </Pressable>
      </Card>
    </TabScreen>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  name: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -0.6 },
  sub: { fontFamily: fonts.text, fontSize: 13, flexShrink: 1, fontVariant: ['tabular-nums'] },
  round: {
    width: 44,
    height: 44,
    borderRadius: 99,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { padding: 16, gap: 14 },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 10,
  },
  cardTitle: { fontFamily: fonts.textSemiBold, fontSize: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16 },
  noteText: { flex: 1, fontFamily: fonts.text, fontSize: 13.5, lineHeight: 19 },
  strideCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pill: {
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 99,
    borderWidth: 1,
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.textSemiBold, fontSize: 14 },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
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
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    minHeight: 54,
  },
});
