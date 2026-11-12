import { router } from 'expo-router';
import { Newspaper, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useFriends } from '@/api/queries';
import { Rankings } from '@/community/rankings';
import { fonts, useColors } from '@/theme';
import { Tabs } from '@/ui/controls';
import { EmptyState, ScreenHeader, TabScreen } from '@/ui/layout';
import { RoundButton } from '@/ui/primitives';

type Part = 'feed' | 'rankings';

/** Community tab: the activity feed and the rankings. */
export default function CommunityScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const [part, setPart] = useState<Part>('feed');
  const { data: friends } = useFriends();
  const waiting = friends?.incoming.length ?? 0;

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
      </ScreenHeader>
      <Tabs
        options={[
          { value: 'feed', label: t('community.feed') },
          { value: 'rankings', label: t('community.rankings') },
        ]}
        value={part}
        onChange={setPart}
      />
      {part === 'feed' ? (
        <EmptyState
          icon={<Newspaper size={22} color={colors.accentText} />}
          title={t('community.feedSoon')}
          text={t('community.feedSoonText')}
        />
      ) : (
        <Rankings />
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
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
