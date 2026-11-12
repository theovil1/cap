import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { useLeaderboard } from '@/api/queries';
import type { Leaderboard, LeaderboardEntry, LeaderboardPeriod } from '@/api/types';
import { formatDate, formatKm, formatNumber, formatRank } from '@/i18n/format';
import { useColors } from '@/theme';
import { type } from '@/tokens';
import { Chip, ChipRow } from '@/ui/controls';
import { Avatar, Card } from '@/ui/primitives';
import { RankCard, RankRow } from '@/ui/stats';

const PERIODS: LeaderboardPeriod[] = ['week', 'month', 'streak'];
/** World and country rankings come with the community API; friends for now. */
const SCOPES = ['world', 'country', 'friends'] as const;

/** Rankings part of the Community tab: period and scope filters, my place, the list. */
export function Rankings() {
  const { t } = useTranslation();
  const colors = useColors();
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const { data: board } = useLeaderboard(period);
  const entries = board?.period === period ? board.entries : [];
  const me = entries.find((e) => e.me);
  const streak = period === 'streak';

  return (
    <>
      <ChipRow>
        {PERIODS.map((p) => (
          <Chip key={p} label={t(`rankings.${p}`)} on={p === period} onPress={() => setPeriod(p)} />
        ))}
      </ChipRow>
      <ChipRow>
        {SCOPES.map((scope) => (
          <Chip
            key={scope}
            small
            label={t(`rankings.${scope}`)}
            on={scope === 'friends'}
            disabled={scope !== 'friends'}
            onPress={() => {}}
          />
        ))}
      </ChipRow>
      {board && (
        <Text style={[type.footnote, { color: colors.textSecondary }]}>{subtitle(board, t)}</Text>
      )}

      {me && (
        <RankCard
          label={t('rankings.myPlace')}
          place={formatRank(me.rank)}
          detail={hint(entries, period, t)}
        />
      )}

      {entries.length > 0 && (
        <Card small style={styles.list}>
          {entries.map((entry, index) => (
            <RankRow
              key={entry.user_id}
              onPress={
                entry.me
                  ? undefined
                  : () => router.push({ pathname: '/walker/[id]', params: { id: entry.user_id } })
              }
              first={index === 0}
              rank={entry.rank}
              name={entry.me ? t('rankings.you') : entry.first_name}
              detail={`@${entry.username}`}
              value={streak ? formatNumber(entry.value) : formatKm(entry.value)}
              unit={streak ? t('rankings.days', { count: entry.value }) : t('units.km')}
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
          ))}
        </Card>
      )}
    </>
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
  list: { paddingVertical: 2 },
});
