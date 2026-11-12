import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { useLeaderboard } from '@/api/queries';
import type {
  Leaderboard,
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardScope,
} from '@/api/types';
import { formatDate, formatKm, formatNumber, formatRank } from '@/i18n/format';
import { useColors } from '@/theme';
import { type } from '@/tokens';
import { Chip, ChipRow } from '@/ui/controls';
import { Avatar, Card } from '@/ui/primitives';
import { RankCard, RankRow } from '@/ui/stats';

const PERIODS: LeaderboardPeriod[] = ['week', 'month', 'all', 'streak'];
const SCOPES: LeaderboardScope[] = ['world', 'country', 'friends'];

/** Rankings part of the Community tab: period and scope, my place, the list. */
export function Rankings() {
  const { t } = useTranslation();
  const colors = useColors();
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const [scope, setScope] = useState<LeaderboardScope>('world');
  const { data: board } = useLeaderboard(period, scope);
  const current = board?.period === period && board.scope === scope ? board : null;
  const entries = current?.entries ?? [];
  const me = current?.me ?? null;
  const streak = period === 'streak';
  const countryName = (code: string) => t(`account.countries.${code}`, { defaultValue: code });
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

  return (
    <>
      <ChipRow>
        {PERIODS.map((p) => (
          <Chip key={p} label={t(`rankings.${p}`)} on={p === period} onPress={() => setPeriod(p)} />
        ))}
      </ChipRow>
      <ChipRow>
        {SCOPES.map((s) => (
          <Chip
            key={s}
            small
            label={
              s === 'country' && current?.country
                ? countryName(current.country)
                : t(`rankings.${s}`)
            }
            on={s === scope}
            onPress={() => setScope(s)}
          />
        ))}
      </ChipRow>
      {current && (
        <Text style={[type.footnote, { color: colors.textSecondary }]}>{subtitle(current, t)}</Text>
      )}

      {me && current && (
        <RankCard
          label={t(`rankings.myPlace.${scope}`, { country: countryName(current.country) })}
          place={formatRank(me.rank)}
          detail={
            scope === 'friends'
              ? hint(entries, period, t)
              : t('rankings.top', {
                  percent: formatNumber(Math.max(1, Math.ceil((100 * me.rank) / current.total))),
                  value: `${value(me)} ${unit(me)}`,
                  period: t(`rankings.during.${period}`),
                })
          }
          delta={
            delta !== 0 ? `${delta > 0 ? '▲' : '▼'} ${formatNumber(Math.abs(delta))}` : undefined
          }
        />
      )}

      {entries.length > 0 && (
        <Card small style={styles.list}>
          {entries.map((entry, index) => row(entry, index === 0))}
          {me && !entries.some((e) => e.me) ? row(me, false) : null}
        </Card>
      )}
    </>
  );
}

type T = TFunction;

function subtitle(board: Leaderboard, t: T): string {
  const scope = t(`rankings.scopeLabel.${board.scope}`, {
    country: t(`account.countries.${board.country}`, { defaultValue: board.country }),
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
  list: { paddingVertical: 2 },
});
