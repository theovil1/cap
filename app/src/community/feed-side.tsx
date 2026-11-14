import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useFollow, useSuggestions } from '@/api/community';
import { useLeaderboard } from '@/api/queries';
import { formatDate, formatKm, formatNumber } from '@/i18n/format';
import { fonts, useColors } from '@/theme';
import { Avatar, Card, Figure } from '@/ui/primitives';

import { WalkerAvatar } from './team';

const walker = (id: string) => router.push({ pathname: '/walker/[id]', params: { id } });

/** iPad Fil: this week among friends, the four first. */
function WeekCard({ onRankings }: { onRankings: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { data: board } = useLeaderboard('week', 'friends');
  const entries = board?.entries.slice(0, 4) ?? [];
  const day = (iso: string) => new Date(`${iso}T12:00:00`);
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>{t('feedSide.week')}</Text>
        <Pressable onPress={onRankings} accessibilityRole="link" hitSlop={8}>
          <Text style={[styles.link, { color: colors.blueText }]}>{t('community.rankings')} ›</Text>
        </Pressable>
      </View>
      {board ? (
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          {t('feedSide.weekOf', {
            start: formatDate(day(board.starts_on), { day: 'numeric' }),
            end: formatDate(day(board.ends_on), { day: 'numeric', month: 'long' }),
          })}
        </Text>
      ) : null}
      {entries.map((e) => (
        <Pressable key={e.user_id} onPress={() => walker(e.user_id)} style={styles.row}>
          <Text style={[styles.rank, { color: colors.textSecondary }]}>{e.rank}</Text>
          <Avatar
            name={e.first_name}
            seed={e.user_id}
            photo={e.avatar_url}
            tone={e.me ? 'accent' : 'walker'}
            size={34}
          />
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {e.me ? t('rankings.you') : e.first_name}
          </Text>
          <Figure value={formatKm(e.value)} unit={t('units.km')} size={16} unitSize={10} />
        </Pressable>
      ))}
    </Card>
  );
}

/** iPad Fil: friends of my friends to follow. */
function FollowCard() {
  const { t } = useTranslation();
  const colors = useColors();
  const { data: list = [] } = useSuggestions();
  const follow = useFollow();
  if (list.length === 0) return null;
  return (
    <Card style={styles.card}>
      <Text style={[styles.title, { color: colors.text }]}>{t('feedSide.toFollow')}</Text>
      {list.map((s) => (
        <View key={s.walker.id} style={styles.suggestion}>
          <Pressable onPress={() => walker(s.walker.id)} style={styles.who}>
            <WalkerAvatar walker={s.walker} size={40} />
            <View style={styles.flex}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {s.walker.first_name}
              </Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>
                {t('feedSide.mutual', {
                  count: s.mutual_friends,
                  n: formatNumber(s.mutual_friends),
                })}
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => follow.mutate({ id: s.walker.id, on: true })}
            accessibilityRole="button"
            style={[styles.follow, { backgroundColor: colors.blueSoft }]}
          >
            <Text style={[styles.followText, { color: colors.blueText }]}>
              {t('walker.follow')}
            </Text>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

/** The 400 column on the right of the iPad Fil, as in its mockup. */
export function FeedSide({ onRankings }: { onRankings: () => void }) {
  return (
    <View style={styles.side}>
      <WeekCard onRankings={onRankings} />
      <FollowCard />
    </View>
  );
}

const styles = StyleSheet.create({
  side: { width: 400, gap: 16 },
  card: { borderRadius: 26, paddingVertical: 18, paddingHorizontal: 20, gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.4 },
  link: { fontFamily: fonts.textSemiBold, fontSize: 14 },
  sub: { fontFamily: fonts.text, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  rank: { width: 18, fontFamily: fonts.display, fontSize: 15 },
  name: { flex: 1, fontFamily: fonts.textSemiBold, fontSize: 14.5 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 1 },
  follow: {
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 999,
    justifyContent: 'center',
  },
  followText: { fontFamily: fonts.textSemiBold, fontSize: 13 },
});
