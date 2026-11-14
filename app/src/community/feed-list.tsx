import { router } from 'expo-router';
import { Ellipsis, Flag, Newspaper, PenLine, Route as RouteIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  useAddNote,
  useBravo,
  useDeletePost,
  useEditPost,
  useFeed,
  useReport,
} from '@/api/community';
import { ActionMenu, type MenuItem } from '@/ui/action-menu';
import { useMe } from '@/api/queries';
import type { FeedPost } from '@/api/types';
import { formatAgo, formatKm, formatNumber } from '@/i18n/format';
import { ArrivalMedal } from '@/journey/arrival-medal';
import { fonts, useColors } from '@/theme';

import { useBadgeName } from './profile-badges';
import { WalkerAvatar } from './team';
import { BravoButton, FeedAttachment, FeedCard } from '@/ui/feed';
import { EmptyState } from '@/ui/layout';
import { Badge } from '@/ui/badge';
import { Medal } from '@/ui/medal';
import { Avatar, Button, Card } from '@/ui/primitives';

const DISTANCE_LEVELS = [100, 500, 1_000, 5_000];
const STREAK_LEVELS = [7, 30, 100, 365];
const METALS = ['bronze', 'silver', 'gold', 'cap'] as const;
const RIBBONS = ['green', 'blue', 'cap', 'black'] as const;

function walker(id: string) {
  router.push({ pathname: '/walker/[id]', params: { id } });
}

/** What happened, as the inset block of the card. */
function Attachment({ post }: { post: FeedPost }) {
  const { t } = useTranslation();
  const colors = useColors();
  const d = post.data;
  switch (post.kind) {
    case 'arrived':
      return (
        <FeedAttachment
          visual={
            d.end ? (
              <ArrivalMedal
                lat={d.end.lat}
                lon={d.end.lon}
                distance=""
                width={44}
                zoom={13}
                label={d.title ?? ''}
              />
            ) : null
          }
          title={d.title ?? ''}
          detail={t('feed.arrivedFacts', {
            km: formatKm(d.distance_m ?? 0, 0),
            sessions: t('feed.sessions', { count: d.sessions ?? 0 }),
            days: t('feed.days', { count: d.days ?? 0 }),
          })}
        />
      );
    case 'stage':
      return (
        <FeedAttachment
          visual={
            <View style={[styles.tile, { backgroundColor: colors.blueSoft }]}>
              <Flag size={20} color={colors.blueText} />
            </View>
          }
          title={t('feed.stageTitle', { name: d.stage ?? '' })}
          detail={t('feed.stageFacts', {
            title: d.title ?? '',
            position: d.position ?? 0,
            stages: d.stages ?? 0,
          })}
        />
      );
    case 'medal': {
      const distance = d.medal === 'distance';
      const level = Math.max(
        0,
        (distance ? DISTANCE_LEVELS : STREAK_LEVELS).indexOf(
          distance ? (d.km ?? 0) : (d.days ?? 0),
        ),
      );
      return (
        <FeedAttachment
          visual={
            <Medal
              metal={METALS[level]}
              ribbon={RIBBONS[level]}
              width={42}
              face={
                distance
                  ? { kind: 'number', value: formatNumber(d.km ?? 0), unit: 'KM' }
                  : {
                      kind: 'icon',
                      icon: 'streak',
                      label: t('medals.days', { count: d.days ?? 0 }),
                    }
              }
              label={t('feed.medal')}
            />
          }
          title={
            distance
              ? t('feed.distanceMedal', { km: formatNumber(d.km ?? 0) })
              : t('medals.streak', { count: d.days ?? 0 })
          }
          detail={t('feed.newMedal')}
        />
      );
    }
    case 'note':
      return null;
    case 'published':
      return (
        <Pressable
          onPress={() =>
            d.public_route_id &&
            router.push({ pathname: '/public-route/[id]', params: { id: d.public_route_id } })
          }
          accessibilityRole="link"
        >
          <FeedAttachment
            visual={
              <View style={[styles.tile, { backgroundColor: colors.accentSoft }]}>
                <RouteIcon size={20} color={colors.accentText} />
              </View>
            }
            title={d.title ?? ''}
            detail={t('feed.publishedFacts', { km: formatKm(d.distance_m ?? 0, 0) })}
          />
        </Pressable>
      );
  }
}

/** One post: who, when, their word, what happened, Bravo and comments. */
export function PostCard({ post, now }: { post: FeedPost; now: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  const bravo = useBravo();
  const edit = useEditPost();
  const remove = useDeletePost();
  const report = useReport();
  const badgeName = useBadgeName();
  const [draft, setDraft] = useState<string | null>(null);
  const word = () => setDraft(post.text ?? '');
  const save = () =>
    edit.mutate(
      { id: post.id, text: draft?.trim() ?? '' },
      {
        onSuccess: () => setDraft(null),
        onError: () => Alert.alert(t('feed.postFailed')),
      },
    );
  const editor =
    draft === null ? null : (
      <View style={styles.editor}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('feed.wordTitle')}
          placeholderTextColor={colors.textMuted}
          maxLength={280}
          multiline
          autoFocus
          style={[
            styles.editorInput,
            { color: colors.text, backgroundColor: colors.inset, borderColor: colors.track },
          ]}
        />
        <View style={styles.composerActions}>
          <Button
            size="small"
            tone="light"
            title={t('journeys.cancel')}
            onPress={() => setDraft(null)}
          />
          <Button
            size="small"
            tone="accent"
            title={t('account.save')}
            onPress={save}
            loading={edit.isPending}
            disabled={post.kind === 'note' && !draft.trim()}
          />
        </View>
      </View>
    );
  const when = post.edited_at
    ? t('feed.whenEdited', {
        when: formatAgo(post.created_at, now),
        edited: formatAgo(post.edited_at, now).toLowerCase(),
      })
    : formatAgo(post.created_at, now);
  // Edit or delete mine, report someone else's.
  const more: MenuItem[] = post.mine
    ? [
        {
          label: post.text ? t('feed.editWord') : t('feed.addWord'),
          icon: 'pencil',
          onPress: word,
        },
        {
          label: t('feed.delete'),
          icon: 'trash',
          destructive: true,
          onPress: () => remove.mutate(post.id),
        },
      ]
    : [
        {
          label: t('feed.report'),
          icon: 'flag',
          destructive: true,
          onPress: () =>
            report.mutate(
              { target_type: 'post', target_id: post.id },
              { onSuccess: () => Alert.alert(t('publicRoute.reported')) },
            ),
        },
      ];
  return (
    <View>
      <FeedCard
        avatar={
          <Pressable onPress={() => walker(post.author.id)} accessibilityRole="link">
            <WalkerAvatar walker={post.author} tone={post.mine ? 'accent' : 'walker'} size={40} />
          </Pressable>
        }
        name={post.author.first_name}
        badge={
          post.author_badge ? (
            <Badge kind={post.author_badge.kind} size={17} label={badgeName(post.author_badge)} />
          ) : undefined
        }
        when={when}
        text={editor ? undefined : (post.text ?? undefined)}
        addText={
          editor ??
          (post.mine ? (
            <Pressable
              onPress={word}
              accessibilityRole="button"
              hitSlop={6}
              style={[styles.addWord, { backgroundColor: colors.inset }]}
            >
              <PenLine size={15} color={colors.textSecondary} />
              <Text style={[styles.addWordText, { color: colors.textSecondary }]}>
                {t('feed.addWord')}
              </Text>
            </Pressable>
          ) : undefined)
        }
        attachment={<Attachment post={post} />}
        bravo={
          <BravoButton
            label={t('feed.bravo', { n: formatNumber(post.bravos) })}
            given={post.i_bravo}
            onPress={() => bravo.mutate({ id: post.id, on: !post.i_bravo })}
          />
        }
        comments={formatNumber(post.comments)}
        onComments={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
      />
      <ActionMenu items={more} label={t('publicRoute.more')} style={styles.more}>
        <View style={styles.moreTarget}>
          <Ellipsis size={18} color={colors.textMuted} />
        </View>
      </ActionMenu>
    </View>
  );
}

/** A few words of my own, at the top of the Fil. */
function Composer() {
  const { t } = useTranslation();
  const colors = useColors();
  const me = useMe();
  const add = useAddNote();
  const [text, setText] = useState('');
  const post = () =>
    add.mutate(text.trim(), {
      onSuccess: () => setText(''),
      onError: () => Alert.alert(t('feed.postFailed')),
    });
  return (
    <Card style={styles.composer}>
      <View style={styles.composerRow}>
        <Avatar
          name={me.data?.first_name ?? ''}
          seed={me.data?.id}
          photo={me.data?.avatar_url}
          tone="accent"
          size={40}
        />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('feed.notePlaceholder')}
          placeholderTextColor={colors.textMuted}
          maxLength={280}
          multiline
          style={[styles.composerInput, { color: colors.text }]}
        />
      </View>
      {text.trim() ? (
        <View style={styles.composerActions}>
          <Text style={[styles.count, { color: colors.textMuted }]}>{280 - text.length}</Text>
          <Button
            size="small"
            tone="accent"
            title={t('feed.post')}
            onPress={post}
            loading={add.isPending}
          />
        </View>
      ) : null}
    </Card>
  );
}

/** The Fil part of the Community tab. */
export function FeedList() {
  const { t } = useTranslation();
  const colors = useColors();
  const feed = useFeed();
  const [now] = useState(() => Date.now());
  const posts = feed.data?.pages.flat() ?? [];
  if (feed.isLoading) return <ActivityIndicator color={colors.textMuted} style={styles.loading} />;
  if (posts.length === 0) {
    return (
      <>
        <Composer />
        <EmptyState
          icon={<Newspaper size={22} color={colors.accentText} />}
          title={t('feed.empty')}
          text={t('feed.emptyText')}
        />
      </>
    );
  }
  return (
    <>
      <Composer />
      {posts.map((post) => (
        <PostCard key={post.id} post={post} now={now} />
      ))}
      {feed.hasNextPage ? (
        <Button
          tone="light"
          size="medium"
          title={t('feed.more')}
          onPress={() => feed.fetchNextPage()}
          loading={feed.isFetchingNextPage}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 40 },
  tile: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  more: { position: 'absolute', right: 6, top: 8 },
  // A finger-sized target around the small icon.
  moreTarget: { padding: 10 },
  editor: { gap: 10 },
  editorInput: {
    minHeight: 64,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    fontFamily: fonts.text,
    fontSize: 14.5,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  addWord: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  addWordText: { fontFamily: fonts.textMedium, fontSize: 13.5 },
  composer: { paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  composerInput: {
    flex: 1,
    minHeight: 40,
    paddingTop: 10,
    fontFamily: fonts.text,
    fontSize: 15,
    lineHeight: 21,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  count: { fontFamily: fonts.text, fontSize: 12.5, fontVariant: ['tabular-nums'] },
});
