import { router } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Flame,
  Medal as MedalIcon,
  Pencil,
  Route as RouteIcon,
  Share as ShareIcon,
  UserPlus,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/api/auth';
import { useProfile } from '@/api/community';
import { useActiveJourney, useFriends, useJourneys, useSessions } from '@/api/queries';
import { BadgeRow, NameBadge } from '@/community/profile-badges';
import { formatAgo, formatDate, formatKm, formatNumber } from '@/i18n/format';
import { MedalView } from '@/journey/medal-view';
import { medalsFor } from '@/journey/medals';
import { journeyTitle } from '@/journey/names';
import { RouteMap } from '@/map/route-map';
import { useDayStats } from '@/session/stats';
import { fonts, useColors } from '@/theme';
import { useWide } from '@/ui/layout';
import { Avatar, Button, Card, ProgressBar, RoundButton } from '@/ui/primitives';
import { StatTile } from '@/ui/stats';

type Activity = {
  key: string;
  icon: LucideIcon;
  tone: 'accent' | 'blue' | 'green';
  text: string;
  at: string;
};

/**
 * My profile as others see it (the public profile mockup): who I am, my
 * numbers, my medals, the journey under way and, on iPad, what I did lately.
 */
export default function MyProfileScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const { user } = useAuth();
  const { data: sessions = [] } = useSessions();
  const { data: journeys = [] } = useJourneys();
  const { data: friends } = useFriends();
  const { summary, detail } = useActiveJourney();
  const day = useDayStats();
  const { data: profile } = useProfile(user?.id);
  const badges = profile?.badges ?? [];
  const [now] = useState(() => Date.now());
  if (!user) return null;

  const walkedM = sessions.reduce((sum, s) => sum + s.distance_m, 0);
  const finished = journeys.filter((j) => j.arrived_at);
  const medals = medalsFor({ journeys, totalM: walkedM, bestStreak: day.bestStreak });
  const won = medals.filter((m) => m.metal !== 'locked').length;
  const place = [
    `@${user.username}`,
    [user.home_city, t(`account.countries.${user.country}`, { defaultValue: user.country })]
      .filter(Boolean)
      .join(', '),
    t('me.since', {
      date: formatDate(new Date(user.created_at), { month: 'long', year: 'numeric' }),
    }),
  ].join(' · ');
  const share = () =>
    Share.share({
      message: t('me.shareText', {
        name: user.first_name,
        km: formatKm(walkedM, 0),
        count: won,
      }),
    });

  const activity: Activity[] = [
    ...finished.map((j) => ({
      key: `arrived-${j.id}`,
      icon: MedalIcon,
      tone: 'accent' as const,
      text: t('me.activityArrived', { title: journeyTitle(j) }),
      at: j.arrived_at ?? j.created_at,
    })),
    ...(detail?.stages ?? [])
      .filter((s) => s.unlocked_at && s.position > 0)
      .map((s) => ({
        key: `stage-${s.id}`,
        icon: Flag,
        tone: 'blue' as const,
        text: t('me.activityStage', { name: s.name }),
        at: s.unlocked_at ?? '',
      })),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 5);
  if (day.streak >= 3) {
    activity.push({
      key: 'streak',
      icon: Flame,
      tone: 'green',
      text: t('me.activityStreak', { count: day.streak }),
      at: new Date(now).toISOString(),
    });
  }

  const identity = (
    <>
      <View style={styles.identity}>
        <Avatar name={user.first_name} size={92} photo={user.avatar_url} />
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]}>{user.first_name}</Text>
          <NameBadge badges={badges} />
        </View>
        <Text style={[styles.place, { color: colors.textSecondary }]}>{place}</Text>
        <BadgeRow badges={badges} />
      </View>
      <View style={styles.row}>
        <Button
          tone="light"
          size="medium"
          title={t('me.edit')}
          icon={<Pencil size={17} color={colors.text} />}
          onPress={() => router.push('/account')}
          style={[styles.flex, styles.tall]}
        />
        <Button
          tone="blue"
          size="medium"
          title={t('me.invite')}
          icon={<UserPlus size={18} color="#FFFFFF" />}
          onPress={() => router.push('/friends')}
          style={[styles.flex, styles.tall]}
        />
      </View>
      <View style={styles.row}>
        <StatTile label={t('profile.total')} value={formatKm(walkedM, 0)} unit={t('units.km')} />
        <StatTile label={t('profile.finished')} value={formatNumber(finished.length)} />
        <StatTile
          label={t('profile.bestStreak')}
          value={formatNumber(day.bestStreak)}
          unit={t('profile.daysShort')}
        />
      </View>
    </>
  );

  const medalsCard = (
    <Card style={styles.card}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>
        {t('me.medals')}
        <Text style={[styles.count, { color: colors.textSecondary }]}> {formatNumber(won)}</Text>
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.medals}
      >
        {medals.map((medal, i) => (
          <MedalView key={i} medal={medal} width={wide ? 64 : 58} />
        ))}
      </ScrollView>
    </Card>
  );

  const ratio = summary ? summary.distance_m / summary.route_distance_m : 0;
  const progressText = summary
    ? t('me.progress', {
        walked: formatKm(summary.distance_m, 0),
        total: formatKm(summary.route_distance_m, 0),
        percent: formatNumber(Math.floor(ratio * 100)),
      })
    : '';

  const header = (
    <View style={styles.header}>
      <RoundButton
        icon={<ChevronLeft size={22} color={colors.text} />}
        onPress={() => router.back()}
        label={t('common.back')}
      />
      <RoundButton
        icon={<ShareIcon size={19} color={colors.text} />}
        onPress={share}
        label={t('summary.share')}
      />
    </View>
  );

  if (wide) {
    const tone = { accent: colors.accentSoft, blue: colors.blueSoft, green: colors.successSoft };
    const ink = { accent: colors.accentText, blue: colors.blueText, green: colors.success };
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View
          style={[styles.wide, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
        >
          {header}
          <View style={styles.columns}>
            <Card style={styles.left}>
              {identity}
              <View style={styles.flex} />
              <Text style={[styles.footer, { color: colors.textMuted }]}>
                {t('me.friends', { count: friends?.friends.length ?? 0 })}
              </Text>
            </Card>
            <View style={styles.right}>
              {medalsCard}
              <View style={[styles.row, styles.flex]}>
                <Card style={[styles.card, styles.flex]}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t('me.underWay')}</Text>
                  {summary && detail ? (
                    <Pressable onPress={() => router.push('/session')} style={{ gap: 12 }}>
                      <View style={styles.mapBox}>
                        <RouteMap
                          path={detail.path}
                          walkedM={summary.distance_m}
                          stages={detail.stages}
                          mode="overview"
                          initial={user.first_name}
                          padding={{ top: 24, bottom: 24, left: 24, right: 24 }}
                          style={StyleSheet.absoluteFill}
                        />
                      </View>
                      <View style={styles.spread}>
                        <Text style={[styles.journey, { color: colors.text }]} numberOfLines={1}>
                          {journeyTitle(summary)}
                        </Text>
                        <Text style={[styles.small, { color: colors.textSecondary }]}>
                          {progressText}
                        </Text>
                      </View>
                      <ProgressBar ratio={ratio} height={8} />
                    </Pressable>
                  ) : (
                    <Text style={[styles.small, { color: colors.textSecondary }]}>
                      {t('me.noJourney')}
                    </Text>
                  )}
                </Card>
                <Card style={[styles.card, styles.flex]}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t('me.activity')}</Text>
                  {activity.length === 0 ? (
                    <Text style={[styles.small, { color: colors.textSecondary }]}>
                      {t('me.noActivity')}
                    </Text>
                  ) : (
                    activity.map((a, i) => (
                      <View
                        key={a.key}
                        style={[
                          styles.activity,
                          i > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                        ]}
                      >
                        <View style={[styles.activityIcon, { backgroundColor: tone[a.tone] }]}>
                          <a.icon size={18} color={ink[a.tone]} />
                        </View>
                        <Text
                          style={[styles.activityText, { color: colors.text }]}
                          numberOfLines={2}
                        >
                          {a.text}
                        </Text>
                        <Text style={[styles.small, { color: colors.textMuted }]}>
                          {a.key === 'streak' ? '' : formatAgo(a.at, now)}
                        </Text>
                      </View>
                    ))
                  )}
                </Card>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}
      >
        {header}
        {identity}
        {medalsCard}
        {summary ? (
          <Pressable onPress={() => router.push('/session')} accessibilityRole="button">
            <Card style={[styles.card, styles.under]}>
              <View style={[styles.activityIcon, { backgroundColor: colors.accentSoft }]}>
                <RouteIcon size={19} color={colors.accentText} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.underTitle, { color: colors.text }]} numberOfLines={1}>
                  {t('me.underWayTitle', { title: journeyTitle(summary) })}
                </Text>
                <Text style={[styles.small, { color: colors.textSecondary }]}>{progressText}</Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </Card>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  tall: { height: 48, borderRadius: 18 },
  content: { paddingHorizontal: 20, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  identity: { alignItems: 'center', gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  name: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -0.8, marginTop: 4 },
  place: { fontFamily: fonts.text, fontSize: 14, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  card: { padding: 16, gap: 14 },
  cardTitle: { fontFamily: fonts.display, fontSize: 19, letterSpacing: -0.38 },
  count: { fontFamily: fonts.textMedium, fontSize: 14, letterSpacing: 0 },
  medals: { gap: 4, alignItems: 'flex-start' },
  under: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  underTitle: { fontFamily: fonts.textSemiBold, fontSize: 15 },
  small: { fontFamily: fonts.text, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  wide: { flex: 1, paddingHorizontal: 32, gap: 20 },
  columns: { flex: 1, flexDirection: 'row', gap: 20 },
  left: { width: 380, padding: 26, gap: 18 },
  right: { flex: 1, gap: 20 },
  footer: { fontFamily: fonts.text, fontSize: 13, textAlign: 'center' },
  mapBox: { height: 150, borderRadius: 16, overflow: 'hidden' },
  spread: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 10,
  },
  journey: { flexShrink: 1, fontFamily: fonts.display, fontSize: 16 },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: { flex: 1, fontFamily: fonts.text, fontSize: 14.5 },
});
