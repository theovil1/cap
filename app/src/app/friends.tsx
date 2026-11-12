import { router } from 'expo-router';
import { Check, ChevronLeft, Search, Share2, UserPlus, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_URL } from '@/api/client';
import {
  useAcceptFriend,
  useAddFriend,
  useFriends,
  useInviteCode,
  useRemoveFriend,
  useUserSearch,
} from '@/api/queries';
import type { UserMatch } from '@/api/types';
import { fonts, useColors } from '@/theme';
import { Avatar, Button, Card, GlassButton } from '@/ui/primitives';

export default function FriendsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const { data: list } = useFriends();
  const search = useUserSearch(query);
  const invite = useInviteCode();
  const add = useAddFriend();
  const accept = useAcceptFriend();
  const remove = useRemoveFriend();
  const failed = () => Alert.alert(t('friends.failed'));

  const share = () => {
    if (!invite.data) return;
    Share.share({
      message: t('friends.shareMessage', { url: `${API_URL}/invite/${invite.data.code}` }),
    });
  };
  const confirmRemove = (id: string, name: string) =>
    Alert.alert(t('friends.removeTitle', { name }), t('friends.removeBody'), [
      { text: t('journeys.cancel'), style: 'cancel' },
      {
        text: t('friends.remove'),
        style: 'destructive',
        onPress: () => remove.mutate(id, { onError: failed }),
      },
    ]);

  const searching = query.trim().replace(/^@/, '').length >= 2;
  const matchAction = (user: UserMatch): ReactNode => {
    switch (user.relation) {
      case 'friend':
        return (
          <Text style={[styles.tag, { color: colors.textMuted }]}>{t('friends.isFriend')}</Text>
        );
      case 'outgoing':
        return <Text style={[styles.tag, { color: colors.textMuted }]}>{t('friends.sent')}</Text>;
      case 'incoming':
        return (
          <IconButton
            label={t('friends.accept')}
            onPress={() => accept.mutate(user.id, { onError: failed })}
            tone="accent"
            icon={<Check size={18} color={colors.onAccent} />}
          />
        );
      default:
        return (
          <IconButton
            label={t('friends.add')}
            onPress={() => add.mutate({ username: user.username }, { onError: failed })}
            tone="accent"
            icon={<UserPlus size={18} color={colors.onAccent} />}
          />
        );
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.column}>
        <View style={styles.header}>
          <GlassButton
            icon={<ChevronLeft size={22} color={colors.text} />}
            onPress={() => router.back()}
            label={t('common.back')}
          />
          <Text style={[styles.title, { color: colors.text }]}>{t('friends.title')}</Text>
        </View>

        <Card style={styles.invite}>
          <Text style={[styles.inviteTitle, { color: colors.text }]}>
            {t('friends.inviteTitle')}
          </Text>
          <Text style={[styles.inviteText, { color: colors.textSecondary }]}>
            {t('friends.inviteText')}
          </Text>
          <Button
            tone="accent"
            title={t('friends.share')}
            icon={<Share2 size={19} color={colors.onAccent} />}
            onPress={share}
            loading={invite.isLoading}
            disabled={!invite.data}
          />
        </Card>

        <View
          style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Search size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('friends.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: colors.text }]}
          />
          {search.isFetching && <ActivityIndicator size="small" />}
        </View>
        {searching && (
          <Card>
            {(search.data ?? []).map((user, i) => (
              <Row key={user.id} name={user.first_name} username={user.username} first={i === 0}>
                {matchAction(user)}
              </Row>
            ))}
            {search.data?.length === 0 && (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>
                {t('friends.noMatch')}
              </Text>
            )}
          </Card>
        )}

        {!!list?.incoming.length && (
          <Section title={t('friends.incoming')}>
            {list.incoming.map((friend, i) => (
              <Row
                key={friend.id}
                name={friend.first_name}
                username={friend.username}
                first={i === 0}
              >
                <IconButton
                  label={t('friends.decline')}
                  onPress={() => remove.mutate(friend.id, { onError: failed })}
                  icon={<X size={18} color={colors.textSecondary} />}
                />
                <IconButton
                  label={t('friends.accept')}
                  onPress={() => accept.mutate(friend.id, { onError: failed })}
                  tone="accent"
                  icon={<Check size={18} color={colors.onAccent} />}
                />
              </Row>
            ))}
          </Section>
        )}

        <Section title={t('friends.list', { count: list?.friends.length ?? 0 })}>
          {list?.friends.map((friend, i) => (
            <Row
              key={friend.id}
              name={friend.first_name}
              username={friend.username}
              first={i === 0}
            >
              <IconButton
                label={t('friends.remove')}
                onPress={() => confirmRemove(friend.id, friend.first_name)}
                icon={<X size={18} color={colors.textSecondary} />}
              />
            </Row>
          ))}
          {!list?.friends.length && (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              {t('friends.empty')}
            </Text>
          )}
        </Section>

        {!!list?.outgoing.length && (
          <Section title={t('friends.outgoing')}>
            {list.outgoing.map((friend, i) => (
              <Row
                key={friend.id}
                name={friend.first_name}
                username={friend.username}
                first={i === 0}
              >
                <Pressable
                  onPress={() => remove.mutate(friend.id, { onError: failed })}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text style={[styles.tag, { color: colors.blueText }]}>
                    {t('friends.cancel')}
                  </Text>
                </Pressable>
              </Row>
            ))}
          </Section>
        )}
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ gap: 8, marginTop: 6 }}>
      <Text style={[styles.section, { color: colors.textSecondary }]}>{title}</Text>
      <Card>{children}</Card>
    </View>
  );
}

function Row({
  name,
  username,
  first,
  children,
}: {
  name: string;
  username: string;
  first: boolean;
  children: ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.row,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
      ]}
    >
      <Avatar name={name} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.username, { color: colors.textSecondary }]} numberOfLines={1}>
          @{username}
        </Text>
      </View>
      <View style={styles.actions}>{children}</View>
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  tone,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  tone?: 'accent';
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: tone === 'accent' ? colors.accent : colors.inset,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 19 },
  column: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  title: { fontFamily: fonts.display, fontSize: 31, letterSpacing: -0.9 },
  invite: { padding: 18, gap: 10 },
  inviteTitle: { fontFamily: fonts.display, fontSize: 19 },
  inviteText: { fontFamily: fonts.text, fontSize: 14.5, lineHeight: 20, marginBottom: 4 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  input: { flex: 1, fontFamily: fonts.textMedium, fontSize: 16 },
  section: { fontFamily: fonts.textSemiBold, fontSize: 13, marginLeft: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  name: { fontFamily: fonts.textSemiBold, fontSize: 16 },
  username: { fontFamily: fonts.text, fontSize: 13.5 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: { fontFamily: fonts.textSemiBold, fontSize: 13.5 },
  empty: { fontFamily: fonts.text, fontSize: 14.5, padding: 16, textAlign: 'center' },
});
