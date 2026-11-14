import { router } from 'expo-router';
import { UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFriends } from '@/api/queries';
import { FeedSide } from '@/community/feed-side';
import { FeedList } from '@/community/feed-list';
import { Rankings } from '@/community/rankings';
import { fonts, useColors } from '@/theme';
import { MeAvatar } from '@/ui/me-avatar';
import { Tabs } from '@/ui/controls';
import { ScreenHeader, TabScreen, useWide } from '@/ui/layout';
import { RoundButton } from '@/ui/primitives';

type Part = 'feed' | 'rankings';

/** Community tab: the activity feed and the rankings. */
export default function CommunityScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const wide = useWide();
  const [part, setPart] = useState<Part>('feed');
  const { data: friends } = useFriends();
  const waiting = friends?.incoming.length ?? 0;
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Under the title (54) and the tabs (40), 20 apart.
  const listHeight = height - (insets.top + 2) - 54 - 20 - 40 - 20 - (insets.bottom + 32);

  return (
    <TabScreen>
      <ScreenHeader title={t('nav.community')}>
        {/* The mockup's bell comes with notifications; friends meanwhile. */}
        <View>
          <RoundButton
            icon={<UsersRound size={20} color={colors.text} strokeWidth={2} />}
            onPress={() => router.push('/friends')}
            label={t('friends.title')}
          />
          {waiting > 0 && (
            <View style={[styles.count, { backgroundColor: colors.accent }]} pointerEvents="none">
              <Text style={[styles.countText, { color: colors.onAccent }]}>{waiting}</Text>
            </View>
          )}
        </View>
        {wide ? <MeAvatar /> : null}
      </ScreenHeader>
      <View style={wide ? styles.partsWide : null}>
        <Tabs
          options={[
            { value: 'feed', label: t('community.feed') },
            { value: 'rankings', label: t('community.rankings') },
          ]}
          value={part}
          onChange={setPart}
        />
      </View>
      {/* iPad mockups: the feed beside "Cette semaine" and "À suivre"; the
          rankings fill the screen under the tabs. */}
      {part === 'feed' ? (
        wide ? (
          <View style={styles.feedRow}>
            <View style={styles.feedColumn}>
              <FeedList />
            </View>
            <FeedSide onRankings={() => setPart('rankings')} />
          </View>
        ) : (
          <FeedList />
        )
      ) : (
        <Rankings height={wide ? listHeight : undefined} />
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  // iPad mockups: the two parts take 360 on the left.
  partsWide: { width: 360 },
  feedRow: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  feedColumn: { flex: 1, gap: 14 },
  count: {
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
  countText: { fontFamily: fonts.textSemiBold, fontSize: 11.5 },
});
