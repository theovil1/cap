import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { Footprints, Medal, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useFriends, useLeaderboard } from '@/api/queries';
import type { Leaderboard, LeaderboardEntry, LeaderboardPeriod } from '@/api/types';
import { formatDate, formatKm, formatNumber, formatRank } from '@/i18n/format';
import { fonts, useColors } from '@/theme';
import { TabScreen } from '@/ui/layout';
import { Avatar, Card } from '@/ui/primitives';

const PERIODS: LeaderboardPeriod[] = ['week', 'month', 'streak'];
/** Podium order on screen: second, first, third. */
const PODIUM = [1, 0, 2];
const STEP_HEIGHTS = [124, 92, 70];

export default function RankingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const { data: board } = useLeaderboard(period);
  const { data: friends } = useFriends();
  const waiting = friends?.incoming.length ?? 0;
  const entries = board?.period === period ? board.entries : [];
  const podium = PODIUM.map((i) => entries[i]).filter((e): e is LeaderboardEntry => !!e);

  return (
    <TabScreen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('nav.rankings')}</Text>
        <Pressable
          onPress={() => router.push('/friends')}
          accessibilityRole="button"
          accessibilityLabel={t('friends.title')}
          style={[styles.friends, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Users size={21} color={colors.text} />
          {waiting > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={[styles.badgeText, { color: colors.onAccent }]}>{waiting}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.inset }]} accessibilityRole="tablist">
        {PERIODS.map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            accessibilityRole="tab"
            accessibilityState={{ selected: p === period }}
            style={[styles.tab, p === period && { backgroundColor: colors.surface }]}
          >
            <Text
              style={[styles.tabText, { color: p === period ? colors.text : colors.textSecondary }]}
            >
              {t(`rankings.${p}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      {board && (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle(board, t)}</Text>
      )}

      {podium.length > 0 && (
        <View style={styles.podium}>
          {podium.map((entry) => {
            const place = entries.indexOf(entry);
            return (
              <View key={entry.user_id} style={styles.podiumColumn}>
                <View>
                  <Avatar
                    name={entry.first_name}
                    size={place === 0 ? 58 : 48}
                    tone={place === 0 ? 'accent' : place === 1 ? 'blue' : 'plain'}
                  />
                  {place === 0 && (
                    <View style={[styles.medal, { borderColor: colors.background }]}>
                      <Medal size={12} color="#FFFFFF" strokeWidth={2.4} />
                    </View>
                  )}
                </View>
                <Text style={[styles.podiumName, { color: colors.text }]} numberOfLines={1}>
                  {entry.me ? t('rankings.you') : entry.first_name}
                </Text>
                <Value entry={entry} period={period} />
                <View
                  style={[
                    styles.step,
                    { height: STEP_HEIGHTS[place] },
                    place === 0
                      ? { backgroundColor: colors.accent, borderColor: colors.accent }
                      : { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.stepRank,
                      { color: place === 0 ? colors.onAccent : colors.textSecondary },
                    ]}
                  >
                    {entry.rank}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {entries.length > 3 && (
        <Card style={styles.list}>
          {entries.slice(3).map((entry, i) => (
            <View
              key={entry.user_id}
              style={[
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.rowRank, { color: colors.textSecondary }]}>{entry.rank}</Text>
              <Avatar name={entry.first_name} size={38} tone="plain" />
              <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                {entry.me ? t('rankings.you') : entry.first_name}
              </Text>
              <Value entry={entry} period={period} />
            </View>
          ))}
        </Card>
      )}

      {board && (
        <View style={[styles.hint, { backgroundColor: colors.blueSoft }]}>
          <View style={[styles.hintIcon, { backgroundColor: colors.blue }]}>
            <Footprints size={18} color="#FFFFFF" />
          </View>
          <Text style={[styles.hintText, { color: colors.text }]}>{hint(entries, period, t)}</Text>
        </View>
      )}
    </TabScreen>
  );
}

function Value({ entry, period }: { entry: LeaderboardEntry; period: LeaderboardPeriod }) {
  const { t } = useTranslation();
  const colors = useColors();
  const streak = period === 'streak';
  return (
    <Text style={[styles.value, { color: colors.text }]}>
      {streak ? formatNumber(entry.value) : formatKm(entry.value)}
      <Text style={[styles.unit, { color: colors.textSecondary }]}>
        {' '}
        {streak ? t('rankings.days', { count: entry.value }) : t('units.km')}
      </Text>
    </Text>
  );
}

type T = TFunction;

function subtitle(board: Leaderboard, t: T): string {
  // Dates come as `YYYY-MM-DD`: read them at noon to stay on the right day.
  const day = (iso: string) => new Date(`${iso}T12:00:00`);
  if (board.period === 'week') {
    const start = day(board.starts_on);
    const end = day(board.ends_on);
    return t('rankings.weekOf', {
      start: formatDate(
        start,
        start.getMonth() === end.getMonth()
          ? { day: 'numeric' }
          : { day: 'numeric', month: 'long' },
      ),
      end: formatDate(end, { day: 'numeric', month: 'long' }),
    });
  }
  if (board.period === 'month') {
    return t('rankings.monthOf', {
      month: formatDate(day(board.starts_on), { month: 'long', year: 'numeric' }),
    });
  }
  return t('rankings.streakInfo');
}

/** What it takes to move up, or how the streak stands. */
function hint(entries: LeaderboardEntry[], period: LeaderboardPeriod, t: T): string {
  const index = entries.findIndex((e) => e.me);
  const me = entries[index];
  if (!me) return '';
  if (period === 'streak') {
    if (me.value === 0) return t('rankings.streakStart');
    return t('rankings.streakHint', { count: me.value, best: me.best ?? me.value });
  }
  if (entries.length === 1) return t('rankings.alone');
  const above = entries
    .slice(0, index)
    .reverse()
    .find((e) => e.value > me.value);
  if (!above) return t('rankings.leading');
  // A little more than the gap, rounded up to 100 m.
  const gap = Math.ceil((above.value - me.value + 1) / 100) * 100;
  return t(period === 'week' ? 'rankings.gapWeek' : 'rankings.gapMonth', {
    km: formatKm(gap),
    place: formatRank(above.rank),
  });
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: { fontFamily: fonts.display, fontSize: 31, letterSpacing: -0.9 },
  friends: {
    width: 44,
    height: 44,
    borderRadius: 99,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.textSemiBold, fontSize: 11.5 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 18 },
  tab: { flex: 1, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: fonts.textSemiBold, fontSize: 14 },
  subtitle: { fontFamily: fonts.text, fontSize: 13, marginTop: -4 },
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 6 },
  podiumColumn: { flex: 1, alignItems: 'center', gap: 8 },
  medal: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 99,
    borderWidth: 3,
    backgroundColor: '#E8A317',
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumName: { fontFamily: fonts.textSemiBold, fontSize: 13.5, maxWidth: '100%' },
  step: {
    alignSelf: 'stretch',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    paddingTop: 12,
  },
  stepRank: { fontFamily: fonts.display, fontSize: 26 },
  list: { paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowRank: { width: 18, fontFamily: fonts.display, fontSize: 16 },
  rowName: { flex: 1, fontFamily: fonts.textSemiBold, fontSize: 15 },
  value: {
    fontFamily: fonts.display,
    fontSize: 17,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontFamily: fonts.textSemiBold, fontSize: 11, letterSpacing: 0 },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  hintIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: { flex: 1, fontFamily: fonts.text, fontSize: 14, lineHeight: 20 },
});
