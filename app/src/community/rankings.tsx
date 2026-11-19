import { router } from 'expo-router';
import { TrendingUp } from 'lucide-react-native';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { countryName } from '@/i18n/countries';
import { Flag } from '@/ui/flag';
import { useLeaderboard } from '@/api/queries';
import type {
  Leaderboard,
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardScope,
} from '@/api/types';
import { formatDate, formatKm, formatNumber, formatRank } from '@/i18n/format';
import { fonts, useColors } from '@/theme';
import { radius, type } from '@/tokens';
import { MenuPill } from '@/ui/action-menu';
import { useWide } from '@/ui/layout';
import { Avatar, Card, Figure } from '@/ui/primitives';
import { RankCard, RankRow } from '@/ui/stats';

const PERIODS: LeaderboardPeriod[] = ['week', 'month', 'all', 'streak'];
const SCOPES: LeaderboardScope[] = ['world', 'country', 'friends'];
const SCOPE_ICONS = { world: 'globe.europe.africa', country: 'flag', friends: 'person.2' } as const;

/** Rankings part of the Community tab: period and scope, my place, the list. */
export function Rankings({ height }: { height?: number } = {}) {
  const { t } = useTranslation();
  const colors = useColors();
  const wide = useWide();
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const [scope, setScope] = useState<LeaderboardScope>('world');
  const { data: board } = useLeaderboard(period, scope);
  const current = board?.period === period && board.scope === scope ? board : null;
  const entries = current?.entries ?? [];
  const me = current?.me ?? null;
  const streak = period === 'streak';
  const value = (entry: LeaderboardEntry) =>
    streak ? formatNumber(entry.value) : formatKm(entry.value, entry.value >= 100_000 ? 0 : 1);
  const unit = (entry: LeaderboardEntry) =>
    streak ? t('rankings.days', { count: entry.value }) : t('units.km');
  const row = (entry: LeaderboardEntry, first: boolean) => (
    <RankRow
      key={entry.user_id}
      first={first}
      me={entry.me && scope !== 'friends'}
      rank={entry.rank}
      name={entry.me ? t('rankings.you') : entry.first_name}
      detail={scope === 'world' ? countryName(entry.country) : `@${entry.username}`}
      detailIcon={scope === 'world' ? <Flag code={entry.country} height={11} /> : undefined}
      value={value(entry)}
      unit={unit(entry)}
      onPress={
        entry.me
          ? undefined
          : () => router.push({ pathname: '/walker/[id]', params: { id: entry.user_id } })
      }
      avatar={
        <Avatar
          name={entry.first_name}
          seed={entry.user_id}
          photo={entry.avatar_url}
          tone={entry.me ? 'accent' : 'walker'}
          size={36}
        />
      }
    />
  );
  const delta = me && current?.previous_rank ? current.previous_rank - me.rank : 0;
  const filters = (
    <View style={styles.filters}>
      <MenuPill
        label={t(`rankings.${period}`)}
        title={t('rankings.periodTitle')}
        items={PERIODS.map((p) => ({
          label: t(`rankings.${p}`),
          checked: p === period,
          onPress: () => setPeriod(p),
        }))}
      />
      <MenuPill
        label={t(`rankings.${scope}`)}
        icon={
          scope === 'country' && current?.country ? (
            <Flag code={current.country} height={12} />
          ) : undefined
        }
        title={t('rankings.scopeTitle')}
        items={SCOPES.map((s) => ({
          label: t(`rankings.${s}`),
          icon: SCOPE_ICONS[s],
          checked: s === scope,
          onPress: () => setScope(s),
        }))}
      />
    </View>
  );
  const myLine =
    me && current
      ? scope === 'friends'
        ? hint(entries, period, t)
        : t('rankings.top', {
            percent: formatNumber(Math.max(1, Math.ceil((100 * me.rank) / current.total))),
            value: `${value(me)} ${unit(me)}`,
            period: t(`rankings.during.${period}`),
          })
      : '';

  // iPad mockup: the podium of the first three in a card, the others and
  // what it takes to move up on the right.
  if (wide) {
    const top = entries.slice(0, 3);
    const rest = entries.slice(3);
    const podium = [top[1], top[0], top[2]];
    const bars = [250, 340, 180];
    return (
      <View style={[styles.wideRow, { minHeight: height }]}>
        <Card style={styles.podiumCard}>
          <View style={styles.podiumHead}>
            <Text style={[styles.podiumSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {current ? subtitle(current, t) : ''}
            </Text>
            {filters}
          </View>
          <View style={styles.podium}>
            {podium.map((entry, i) =>
              entry ? (
                <Pressable
                  key={entry.user_id}
                  style={styles.step}
                  onPress={
                    entry.me
                      ? undefined
                      : () =>
                          router.push({ pathname: '/walker/[id]', params: { id: entry.user_id } })
                  }
                >
                  <Avatar
                    name={entry.first_name}
                    seed={entry.user_id}
                    photo={entry.avatar_url}
                    tone={entry.me ? 'accent' : 'walker'}
                    size={i === 1 ? 72 : 60}
                  />
                  <Text style={[styles.stepName, { color: colors.text }]} numberOfLines={1}>
                    {entry.me ? t('rankings.you') : entry.first_name}
                  </Text>
                  <Figure value={value(entry)} unit={unit(entry)} size={24} unitSize={13} />
                  <View
                    style={[
                      styles.bar,
                      { height: bars[i], backgroundColor: i === 1 ? colors.accent : colors.inset },
                    ]}
                  >
                    <Text
                      style={[
                        styles.barRank,
                        { color: i === 1 ? colors.onAccent : colors.textSecondary },
                      ]}
                    >
                      {entry.rank}
                    </Text>
                  </View>
                </Pressable>
              ) : (
                <View key={i} style={styles.step} />
              ),
            )}
          </View>
        </Card>
        <View style={styles.wideSide}>
          {rest.length > 0 || (me && !top.some((e) => e.me)) ? (
            <Card style={styles.restCard}>
              {[...rest, ...(me && !entries.some((e) => e.me) ? [me] : [])].map((entry) => (
                <Pressable
                  key={entry.user_id}
                  style={[styles.restRow, entry.me && { backgroundColor: colors.accentSoft }]}
                  onPress={
                    entry.me
                      ? undefined
                      : () =>
                          router.push({ pathname: '/walker/[id]', params: { id: entry.user_id } })
                  }
                >
                  <Text style={[styles.restRank, { color: colors.textSecondary }]}>
                    {entry.rank}
                  </Text>
                  <Avatar
                    name={entry.first_name}
                    seed={entry.user_id}
                    photo={entry.avatar_url}
                    tone={entry.me ? 'accent' : 'walker'}
                    size={42}
                  />
                  <Text style={[styles.restName, { color: colors.text }]} numberOfLines={1}>
                    {entry.me ? t('rankings.you') : entry.first_name}
                  </Text>
                  <Figure value={value(entry)} unit={unit(entry)} size={20} unitSize={12} />
                </Pressable>
              ))}
            </Card>
          ) : null}
          {myLine ? (
            <View style={[styles.tip, { backgroundColor: colors.blueSoft }]}>
              <View style={[styles.tipIcon, { backgroundColor: colors.blue }]}>
                <TrendingUp size={22} color={colors.onBlue} />
              </View>
              <Text style={[styles.tipText, { color: colors.text }]}>{myLine}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <>
      {/* Two menus on one line: the period and who I am ranked with. */}
      {filters}
      {current && (
        <Text style={[type.footnote, { color: colors.textSecondary }]}>{subtitle(current, t)}</Text>
      )}

      {me && current && (
        <RankCard
          label={t(`rankings.myPlace.${scope}`, { country: countryName(current.country) })}
          place={formatRank(me.rank)}
          detail={myLine}
          delta={
            delta !== 0 ? `${delta > 0 ? '▲' : '▼'} ${formatNumber(Math.abs(delta))}` : undefined
          }
        />
      )}

      {entries.length > 0 && (
        <Card small style={styles.list}>
          {/* Clipped inside the card (which keeps its shadow) so a highlighted row fills it. */}
          <View style={styles.listClip}>
            {entries.map((entry, index) => row(entry, index === 0))}
            {me && !entries.some((e) => e.me) ? row(me, false) : null}
          </View>
        </Card>
      )}
    </>
  );
}

type T = TFunction;

function subtitle(board: Leaderboard, t: T): string {
  const scope = t(`rankings.scopeLabel.${board.scope}`, {
    country: countryName(board.country),
  });
  // Dates come as `YYYY-MM-DD`: read them at noon to stay on the right day.
  const day = (iso: string) => new Date(`${iso}T12:00:00`);
  if (board.period === 'week') {
    const start = day(board.starts_on);
    const end = day(board.ends_on);
    return t('rankings.weekOf', {
      scope,
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
      scope,
      month: formatDate(day(board.starts_on), { month: 'long', year: 'numeric' }),
    });
  }
  if (board.period === 'all') return t('rankings.allInfo', { scope });
  return t('rankings.streakInfo', { scope });
}

/** What it takes to move up, or how the streak stands (between friends). */
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
  if (period === 'all') {
    return t('rankings.gapAll', { km: formatKm(gap), place: formatRank(above.rank) });
  }
  return t(period === 'week' ? 'rankings.gapWeek' : 'rankings.gapMonth', {
    km: formatKm(gap),
    place: formatRank(above.rank),
  });
}

const styles = StyleSheet.create({
  wideRow: { flexDirection: 'row', gap: 20, alignItems: 'stretch' },
  podiumCard: {
    flex: 1.2,
    borderRadius: 32,
    paddingTop: 28,
    paddingHorizontal: 32,
    paddingBottom: 0,
    gap: 10,
  },
  podiumHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  podiumSub: { flexShrink: 1, fontFamily: fonts.text, fontSize: 14 },
  podium: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 18 },
  step: { flex: 1, alignItems: 'center', gap: 10 },
  stepName: { fontFamily: fonts.textSemiBold, fontSize: 16 },
  bar: {
    width: '100%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    alignItems: 'center',
    paddingTop: 14,
  },
  barRank: { fontFamily: fonts.display, fontSize: 30 },
  wideSide: { flex: 1, gap: 16 },
  restCard: { borderRadius: 26, paddingVertical: 6, paddingHorizontal: 0 },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  restRank: { width: 20, fontFamily: fonts.display, fontSize: 18 },
  restName: { flex: 1, fontFamily: fonts.textSemiBold, fontSize: 16 },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  tipIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: { flex: 1, fontFamily: fonts.text, fontSize: 15, lineHeight: 21 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { padding: 0 },
  listClip: { borderRadius: radius.cardSmall - 1, borderCurve: 'continuous', overflow: 'hidden' },
});
