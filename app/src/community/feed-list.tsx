import { router } from 'expo-router';
import { Ellipsis, Flag, Newspaper, Route as RouteIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { useBravo, useDeletePost, useEditPost, useFeed, useReport } from '@/api/community';
import type { FeedPost } from '@/api/types';
import { formatAgo, formatKm, formatNumber } from '@/i18n/format';
import { ArrivalMedal } from '@/journey/arrival-medal';
import { useColors } from '@/theme';

import { useBadgeName } from './profile-badges';
import { BravoButton, FeedAttachment, FeedCard } from '@/ui/feed';
import { EmptyState } from '@/ui/layout';
import { Badge } from '@/ui/badge';
import { Medal } from '@/ui/medal';
import { Avatar, Button } from '@/ui/primitives';

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
  const more = () => {
    const options = post.mine
      ? [post.text ? t('feed.editWord') : t('feed.addWord'), t('feed.delete'), t('journeys.cancel')]
      : [t('feed.report'), t('journeys.cancel')];
    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: post.mine ? 1 : 0 },
      (i) => {
        if (post.mine && i === 0) {
          Alert.prompt(
            t('feed.wordTitle'),
            undefined,
            [
              { text: t('journeys.cancel'), style: 'cancel' },
              {
                text: t('account.save'),
                onPress: (text?: string) => edit.mutate({ id: post.id, text: text ?? '' }),
              },
            ],
            'plain-text',
            post.text ?? '',
          );
        } else if (post.mine && i === 1) {
          remove.mutate(post.id);
        } else if (!post.mine && i === 0) {
          report.mutate(
            { target_type: 'post', target_id: post.id },
            { onSuccess: () => Alert.alert(t('publicRoute.reported')) },
          );
        }
      },
    );
  };
  return (
    <View>
      <FeedCard
        avatar={
          <Pressable onPress={() => walker(post.author.id)} accessibilityRole="link">
            <Avatar
              name={post.author.first_name}
              seed={post.author.id}
              photo={post.author.avatar_url}
              tone={post.mine ? 'accent' : 'walker'}
              size={40}
            />
          </Pressable>
        }
        name={post.author.first_name}
        badge={
          post.author_badge ? (
            <Badge kind={post.author_badge.kind} size={17} label={badgeName(post.author_badge)} />
          ) : undefined
        }
        when={formatAgo(post.created_at, now)}
        text={post.text ?? undefined}
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
      <Pressable
        onPress={more}
        accessibilityRole="button"
        accessibilityLabel={t('publicRoute.more')}
        hitSlop={10}
        style={styles.more}
      >
        <Ellipsis size={18} color={colors.textMuted} />
      </Pressable>
    </View>
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
      <EmptyState
        icon={<Newspaper size={22} color={colors.accentText} />}
        title={t('feed.empty')}
        text={t('feed.emptyText')}
      />
    );
  }
  return (
    <>
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
  more: { position: 'absolute', right: 16, top: 18 },
});
