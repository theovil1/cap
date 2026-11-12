import { router } from 'expo-router';
import { Trophy, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useFriends } from '@/api/queries';

import { fonts, useColors } from '@/theme';
import { TabScreen } from '@/ui/layout';
import { Card } from '@/ui/primitives';

/** Leaderboards come next; the friends screen opens from the header. */
export default function RankingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { data: friends } = useFriends();
  const waiting = friends?.incoming.length ?? 0;
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
      <Card style={styles.card}>
        <Trophy size={28} color={colors.accent} />
        <Text style={[styles.text, { color: colors.textSecondary }]}>{t('rankings.soon')}</Text>
      </Card>
    </TabScreen>
  );
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
    width: 46,
    height: 46,
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
  card: { padding: 22, gap: 12, alignItems: 'center' },
  text: { fontFamily: fonts.text, fontSize: 15, textAlign: 'center', lineHeight: 21 },
});
