import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, SendHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionSheetIOS,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAddComment, useComments, useDeleteComment, useFeed, useReport } from '@/api/community';
import type { Comment } from '@/api/types';
import { PostCard } from '@/community/feed-list';
import { formatAgo } from '@/i18n/format';
import { fonts, useColors } from '@/theme';
import { Avatar, RoundButton } from '@/ui/primitives';

/** A post and its comments, with a field to add one. */
export default function PostScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const feed = useFeed();
  const post = feed.data?.pages.flat().find((p) => p.id === id);
  const { data: comments = [] } = useComments(id);
  const add = useAddComment();
  const remove = useDeleteComment();
  const report = useReport();
  const [text, setText] = useState('');
  const [now] = useState(() => Date.now());

  const send = () => {
    const value = text.trim();
    if (!value || !id) return;
    add.mutate({ id, text: value }, { onSuccess: () => setText('') });
  };
  const more = (comment: Comment) => {
    const options = [
      comment.mine ? t('feed.delete') : t('feed.reportComment'),
      t('journeys.cancel'),
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex: 1, destructiveButtonIndex: 0 },
      (i) => {
        if (i !== 0 || !id) return;
        if (comment.mine || post?.mine) {
          remove.mutate({ commentId: comment.id, postId: id });
        } else {
          report.mutate(
            { target_type: 'comment', target_id: comment.id },
            { onSuccess: () => Alert.alert(t('publicRoute.reported')) },
          );
        }
      },
    );
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <RoundButton
            icon={<ChevronLeft size={22} color={colors.text} />}
            onPress={() => router.back()}
            label={t('common.back')}
          />
          <Text style={[styles.title, { color: colors.text }]}>{t('feed.comments')}</Text>
        </View>
        {post ? <PostCard post={post} now={now} /> : null}
        {comments.map((c) => (
          <Pressable key={c.id} onLongPress={() => more(c)} style={styles.comment}>
            <Pressable
              onPress={() => router.push({ pathname: '/walker/[id]', params: { id: c.author.id } })}
            >
              <Avatar
                name={c.author.first_name}
                seed={c.author.id}
                photo={c.author.avatar_url}
                tone={c.mine ? 'accent' : 'walker'}
                size={34}
              />
            </Pressable>
            <View
              style={[
                styles.bubble,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.author, { color: colors.text }]}>
                {c.author.first_name}
                <Text style={[styles.when, { color: colors.textMuted }]}>
                  {'  '}
                  {formatAgo(c.created_at, now)}
                </Text>
              </Text>
              <Text style={[styles.text, { color: colors.text }]}>{c.text}</Text>
            </View>
          </Pressable>
        ))}
        {comments.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('feed.noComment')}</Text>
        ) : null}
      </ScrollView>
      <View
        style={[
          styles.composer,
          {
            paddingBottom: insets.bottom + 10,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('feed.commentPlaceholder')}
          placeholderTextColor={colors.textMuted}
          maxLength={500}
          multiline
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.surface, borderColor: colors.track },
          ]}
        />
        <RoundButton
          icon={<SendHorizontal size={19} color={colors.text} />}
          onPress={send}
          label={t('feed.send')}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.7 },
  comment: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bubble: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 12, gap: 4 },
  author: { fontFamily: fonts.textSemiBold, fontSize: 14 },
  when: { fontFamily: fonts.text, fontSize: 12 },
  text: { fontFamily: fonts.text, fontSize: 14.5, lineHeight: 21 },
  empty: { fontFamily: fonts.text, fontSize: 14, textAlign: 'center', marginTop: 10 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: fonts.text,
    fontSize: 15,
  },
});
