import { Redirect, router, useLocalSearchParams } from 'expo-router';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Flag,
  Plus,
  Route as RouteIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFollow, useProfile, useReport } from '@/api/community';
import { useAddFriend } from '@/api/queries';
import type { PublicProfile } from '@/api/types';
import { formatDate, formatKm, formatNumber } from '@/i18n/format';
import { MedalView } from '@/journey/medal-view';
import { medalsFor } from '@/journey/medals';
import { journeyTitle } from '@/journey/names';
import { fonts, useColors } from '@/theme';
import { useWide } from '@/ui/layout';
import { Avatar, Button, Card, ProgressBar, RoundButton } from '@/ui/primitives';
import { StatTile } from '@/ui/stats';

/** Another walker's profile: follow, challenge, their numbers and medals. */
export default function WalkerScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: profile, isLoading } = useProfile(id);
  if (!profile) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.background }]}>
        {isLoading ? (
          <ActivityIndicator color={colors.textMuted} />
        ) : (
          <Text style={[styles.small, { color: colors.textSecondary }]}>{t('walker.gone')}</Text>
        )}
      </View>
    );
  }
  if (profile.relation === 'me') return <Redirect href="/me" />;
  return <ProfileView profile={profile} />;
}

function ProfileView({ profile }: { profile: PublicProfile }) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const follow = useFollow();
  const addFriend = useAddFriend();
  const report = useReport();
  const { walker } = profile;
  const medals = medalsFor({
    journeys: profile.journeys,
    totalM: profile.total_m,
    bestStreak: profile.best_streak,
  });
  const won = medals.filter((m) => m.metal !== 'locked');
  const place = [
    `@${walker.username}`,
    [
      profile.home_city,
      t(`account.countries.${profile.country}`, { defaultValue: profile.country }),
    ]
      .filter(Boolean)
      .join(', '),
    t('me.since', {
      date: formatDate(new Date(profile.created_at), { month: 'long', year: 'numeric' }),
    }),
  ].join(' · ');

  // A race needs friends: ask first, then the new journey picks them.
  const challenge = () => {
    if (profile.relation === 'friend') {
      router.push({ pathname: '/new-journey', params: { with: walker.id } });
    } else if (profile.relation === 'none') {
      addFriend.mutate(
        { username: walker.username },
        { onSuccess: () => Alert.alert(t('walker.requestSent', { name: walker.first_name })) },
      );
    } else {
      Alert.alert(t('walker.pending', { name: walker.first_name }));
    }
  };
  const more = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [t('walker.report'), t('journeys.cancel')],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      },
      (i) =>
        i === 0 &&
        report.mutate(
          { target_type: 'user', target_id: walker.id },
          { onSuccess: () => Alert.alert(t('publicRoute.reported')) },
        ),
    );

  const identity = (
    <>
      <View style={styles.identity}>
        <Avatar
          name={walker.first_name}
          seed={walker.id}
          photo={walker.avatar_url}
          tone="walker"
          size={92}
        />
        <Text style={[styles.name, { color: colors.text }]}>{walker.first_name}</Text>
        <Text style={[styles.place, { color: colors.textSecondary }]}>{place}</Text>
        <Text style={[styles.small, { color: colors.textMuted }]}>
          {t('walker.follows', {
            followers: formatNumber(profile.followers),
            following: formatNumber(profile.following),
          })}
        </Text>
      </View>
      <View style={styles.row}>
        <Button
          tone={profile.i_follow ? 'light' : 'blue'}
          size="medium"
          title={profile.i_follow ? t('walker.following') : t('walker.follow')}
          icon={
            profile.i_follow ? (
              <Check size={18} color={colors.text} />
            ) : (
              <Plus size={18} color="#FFFFFF" />
            )
          }
          onPress={() => follow.mutate({ id: walker.id, on: !profile.i_follow })}
          loading={follow.isPending}
          style={[styles.flex, styles.tall]}
        />
        <Button
          tone="light"
          size="medium"
          title={t('walker.challenge')}
          icon={<Flag size={17} color={colors.text} />}
          onPress={challenge}
          loading={addFriend.isPending}
          style={[styles.flex, styles.tall]}
        />
      </View>
      <View style={styles.row}>
        <StatTile
          label={t('profile.total')}
          value={formatKm(profile.total_m, 0)}
          unit={t('units.km')}
        />
        <StatTile label={t('profile.finished')} value={formatNumber(profile.finished)} />
        <StatTile
          label={t('profile.bestStreak')}
          value={formatNumber(profile.best_streak)}
          unit={t('profile.daysShort')}
        />
      </View>
    </>
  );

  const medalsCard = (
    <Card style={styles.card}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>
        {t('me.medals')}
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {' '}
          {formatNumber(won.length)}
        </Text>
      </Text>
      {won.length === 0 ? (
        <Text style={[styles.small, { color: colors.textSecondary }]}>{t('walker.noMedal')}</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.medals}
        >
          {won.map((medal, i) => (
            <MedalView key={i} medal={medal} width={58} />
          ))}
        </ScrollView>
      )}
    </Card>
  );

  const under = profile.under_way;
  const underCard = under ? (
    <Card style={[styles.card, styles.under]}>
      <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
        <RouteIcon size={19} color={colors.accentText} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.underTitle, { color: colors.text }]} numberOfLines={1}>
          {t('me.underWayTitle', { title: journeyTitle(under) })}
        </Text>
        <Text style={[styles.small, { color: colors.textSecondary }]}>
          {t('me.progress', {
            walked: formatKm(under.distance_m, 0),
            total: formatKm(under.route_distance_m, 0),
            percent: formatNumber(Math.floor((100 * under.distance_m) / under.route_distance_m)),
          })}
        </Text>
        {wide ? <ProgressBar ratio={under.distance_m / under.route_distance_m} height={8} /> : null}
      </View>
      <ChevronRight size={18} color={colors.textMuted} />
    </Card>
  ) : null;

  const mutual =
    profile.mutual_friends > 0 ? (
      <Text style={[styles.footer, { color: colors.textMuted }]}>
        {t('walker.mutual', {
          count: profile.mutual_friends,
          names: profile.mutual_names.join(', '),
          others: Math.max(0, profile.mutual_friends - profile.mutual_names.length),
        })}
      </Text>
    ) : null;

  const header = (
    <View style={styles.header}>
      <RoundButton
        icon={<ChevronLeft size={22} color={colors.text} />}
        onPress={() => router.back()}
        label={t('common.back')}
      />
      <RoundButton
        icon={<Ellipsis size={20} color={colors.text} />}
        onPress={more}
        label={t('publicRoute.more')}
      />
    </View>
  );

  if (wide) {
    return (
      <View
        style={[
          styles.screen,
          styles.wide,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 20,
          },
        ]}
      >
        {header}
        <View style={styles.columns}>
          <Card style={styles.left}>
            {identity}
            <View style={styles.flex} />
            {mutual}
          </Card>
          <View style={styles.right}>
            {medalsCard}
            {underCard}
          </View>
        </View>
      </View>
    );
  }
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
      ]}
    >
      {header}
      {identity}
      {medalsCard}
      {underCard}
      {mutual}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  tall: { height: 48, borderRadius: 18 },
  content: { paddingHorizontal: 20, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  identity: { alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -0.8, marginTop: 4 },
  place: { fontFamily: fonts.text, fontSize: 14, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  card: { padding: 16, gap: 14 },
  cardTitle: { fontFamily: fonts.display, fontSize: 19, letterSpacing: -0.38 },
  count: { fontFamily: fonts.textMedium, fontSize: 14, letterSpacing: 0 },
  medals: { gap: 4, alignItems: 'flex-start' },
  under: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  underTitle: { fontFamily: fonts.textSemiBold, fontSize: 15 },
  small: { fontFamily: fonts.text, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  footer: { fontFamily: fonts.text, fontSize: 13, textAlign: 'center' },
  wide: { paddingHorizontal: 32, gap: 20 },
  columns: { flex: 1, flexDirection: 'row', gap: 20 },
  left: { width: 380, padding: 26, gap: 18 },
  right: { flex: 1, gap: 20 },
});
