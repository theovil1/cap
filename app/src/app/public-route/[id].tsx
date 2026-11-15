import { router, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  Ellipsis,
  Flag,
  MapPin,
  Route as RouteIcon,
  Share as ShareIcon,
  Sparkles,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionMenu, type MenuItem } from '@/ui/action-menu';
import { ApiError } from '@/api/client';
import { useReport, useStartPublicRoute, useUnpublish, usePublicRoute } from '@/api/community';
import type { PublicRouteDetail, RoutePhoto } from '@/api/types';
import { RouteCover } from '@/community/route-cover';
import { isTeam, WalkerAvatar } from '@/community/team';
import { RouteMap } from '@/map/route-map';
import { Badge } from '@/ui/badge';
import { formatKm, formatNumber } from '@/i18n/format';
import { fonts, useColors, useShadows } from '@/theme';
import { HOME } from '@/ui/routes';
import { useWide } from '@/ui/layout';
import { PhotoChip, Tag } from '@/ui/pills';
import { Avatar, Button, Figure, GlassButton } from '@/ui/primitives';
import { RankRow, StatTile } from '@/ui/stats';

const KINDS: RoutePhoto['kind'][] = ['start', 'end', 'path'];

/** "9 h 12" or "48 min" of walking. */
export function walkingTime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** A public route: pictures, numbers, the fastest walkers, and a way to start it. */
export default function PublicRouteScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const wide = useWide();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: route, isLoading } = usePublicRoute(id);

  if (!route) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.background }]}>
        {isLoading ? (
          <ActivityIndicator color={colors.textMuted} />
        ) : (
          <Text style={[styles.small, { color: colors.textSecondary }]}>
            {t('publicRoute.gone')}
          </Text>
        )}
      </View>
    );
  }
  return wide ? <Wide route={route} /> : <Phone route={route} />;
}

function useActions(route: PublicRouteDetail) {
  const { t } = useTranslation();
  const start = useStartPublicRoute();
  const unpublish = useUnpublish();
  const report = useReport();
  const share = () =>
    Share.share({
      message: t('publicRoute.shareText', {
        title: route.title,
        km: formatKm(route.distance_m, 0),
      }),
    });
  const begin = () => {
    if (route.my_journey_id) {
      router.dismissTo(HOME);
      return;
    }
    start.mutate(route.id, {
      onSuccess: () => router.dismissTo(HOME),
      onError: (error) =>
        Alert.alert(
          error instanceof ApiError && error.code === 'already_started'
            ? t('publicRoute.alreadyStarted')
            : t('errors.generic'),
        ),
    });
  };
  // Schedule a journey on it; edit or unpublish mine, report someone else's.
  const more: MenuItem[] = [
    {
      label: t('plan.schedule'),
      icon: 'calendar.badge.plus',
      onPress: () => router.push({ pathname: '/plan', params: { publicRouteId: route.id } }),
    },
    ...(route.mine
      ? [
          {
            label: t('publicRoute.photos'),
            icon: 'photo' as const,
            onPress: () =>
              router.push({ pathname: '/publish', params: { publicRouteId: route.id } }),
          },
          {
            label: t('publicRoute.unpublish'),
            icon: 'trash' as const,
            destructive: true,
            onPress: () =>
              Alert.alert(t('publicRoute.unpublishTitle'), t('publicRoute.unpublishBody'), [
                { text: t('journeys.cancel'), style: 'cancel' },
                {
                  text: t('publicRoute.unpublish'),
                  style: 'destructive',
                  onPress: () => unpublish.mutate(route.id, { onSuccess: () => router.back() }),
                },
              ]),
          },
        ]
      : [
          {
            label: t('publicRoute.report'),
            icon: 'flag' as const,
            destructive: true,
            onPress: () =>
              report.mutate(
                { target_type: 'route', target_id: route.id },
                { onSuccess: () => Alert.alert(t('publicRoute.reported')) },
              ),
          },
        ]),
  ];
  return { share, begin, more, starting: start.isPending };
}

/** Swipeable pictures: start, destination, and the path photo when there is one. */
function Gallery({
  route,
  height,
  width,
  under = 0,
}: {
  route: PublicRouteDetail;
  height: number;
  width: number;
  /** Points hidden on the right under a panel: the dots and credit keep clear. */
  under?: number;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const photos = KINDS.filter((k) => k !== 'path' || route.photos.some((p) => p.kind === 'path'));
  // The whole route seen from above comes after the pictures.
  const slides = [...photos, 'map' as const];
  const label = (kind: RoutePhoto['kind'] | 'map') =>
    kind === 'map'
      ? t('publicRoute.mapSlide', { km: formatKm(route.distance_m, 0) })
      : kind === 'start'
        ? t('publicRoute.startAt', { place: route.start_town ?? route.start.label })
        : kind === 'end'
          ? t('publicRoute.endAt', { place: route.end_town ?? route.end.label })
          : t('publicRoute.path');
  return (
    <View style={{ height, width }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {slides.map((kind) => (
          <View key={kind} style={{ width, height }}>
            {kind === 'map' ? (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <RouteMap
                  path={route.path}
                  walkedM={0}
                  stages={route.stage_list}
                  mode="overview"
                  still
                  padding={{ top: 110, bottom: 110, left: 40, right: 40 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            ) : (
              <RouteCover
                photos={route.photos}
                kind={kind}
                place={kind === 'start' ? route.start : route.end}
                zoom={15}
              />
            )}
            <View style={[StyleSheet.absoluteFill, styles.shade]} pointerEvents="none" />
            <PhotoChip
              label={label(kind)}
              icon={kind === 'end' ? Flag : kind === 'map' ? RouteIcon : MapPin}
              style={[styles.chip, { bottom: 52 }]}
            />
            {route.photos.find((p) => p.kind === kind)?.credit ? (
              <Text style={[styles.credit, { bottom: 24, right: 16 + under }]} numberOfLines={1}>
                {t('publicRoute.credit', {
                  credit: route.photos.find((p) => p.kind === kind)?.credit,
                })}
              </Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
      <View style={[styles.dots, { bottom: 60, right: 20 + under }]} pointerEvents="none">
        {slides.map((kind, i) => (
          <View
            key={kind}
            style={[
              styles.dot,
              i === page && styles.dotOn,
              { backgroundColor: i === page ? '#FFFFFF' : 'rgba(255,255,255,0.55)' },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function Body({ route, wide = false }: { route: PublicRouteDetail; wide?: boolean }) {
  const { t } = useTranslation();
  const colors = useColors();
  // iPad mockup: three small tiles (12 pt label, 20 pt figure).
  const tiles = wide ? (
    <View style={styles.tiles}>
      {(
        [
          [t('preview.distance'), formatKm(route.distance_m, 0), t('units.km')],
          [t('publicRoute.walkers'), formatNumber(route.walkers), undefined],
          [
            t('publicRoute.finished'),
            formatNumber(route.finished),
            t('publicRoute.times', { count: route.finished }),
          ],
        ] as const
      ).map(([label, value, unit]) => (
        <View key={label} style={[styles.smallTile, { backgroundColor: colors.inset }]}>
          <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>{label}</Text>
          <Figure value={value} unit={unit} size={20} unitSize={11} />
        </View>
      ))}
    </View>
  ) : (
    <View style={styles.tiles}>
      <StatTile
        label={t('preview.distance')}
        value={formatKm(route.distance_m, 0)}
        unit={t('units.km')}
      />
      <StatTile label={t('publicRoute.walkers')} value={formatNumber(route.walkers)} />
      <StatTile
        label={t('publicRoute.finished')}
        value={formatNumber(route.finished)}
        unit={t('publicRoute.times', { count: route.finished })}
      />
    </View>
  );
  return (
    <>
      {route.featured ? <Tag label={t('explore.ofTheWeek')} icon={Sparkles} /> : null}
      <Text style={[styles.title, wide && styles.titleWide, { color: colors.text }]}>
        {route.title}
      </Text>
      <Pressable
        style={styles.author}
        onPress={() => router.push({ pathname: '/walker/[id]', params: { id: route.author.id } })}
        accessibilityRole="link"
      >
        <WalkerAvatar walker={route.author} size={22} />
        {/* As in the mockup: the badge right after the name, then the stages. */}
        <Text
          style={[styles.small, styles.shrink, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {isTeam(route.author.id)
            ? t('publicRoute.byTeam')
            : t('publicRoute.byName', { name: route.author.first_name })}
        </Text>
        {isTeam(route.author.id) ? (
          <Badge kind="certified" size={17} label={t('badges.names.certified')} />
        ) : null}
        <Text style={[styles.small, { color: colors.textSecondary }]}>
          {'· ' + t('explore.stages', { count: route.stages })}
        </Text>
      </Pressable>
      {/* iPad (mockup): the numbers first, then the words. */}
      {wide ? tiles : null}
      {route.description ? (
        <Text
          style={[
            styles.description,
            wide && styles.descriptionWide,
            { color: colors.textSecondary },
          ]}
        >
          {route.description}
        </Text>
      ) : null}
      {wide ? null : tiles}
      <View style={styles.fastestHead}>
        <Text style={[styles.section, { color: colors.text }]}>{t('publicRoute.fastest')}</Text>
        <Text style={[styles.small, { color: colors.textSecondary }]}>
          {t('publicRoute.walkingTime')}
        </Text>
      </View>
      {route.fastest.length === 0 ? (
        <Text style={[styles.small, { color: colors.textSecondary }]}>
          {t('publicRoute.noFinisher')}
        </Text>
      ) : (
        route.fastest
          .slice(0, 5)
          .map((f, i) => (
            <RankRow
              key={f.walker.id + f.arrived_at}
              onPress={() => router.push({ pathname: '/walker/[id]', params: { id: f.walker.id } })}
              first={i === 0}
              rank={f.rank}
              name={f.walker.first_name}
              detail={`@${f.walker.username}`}
              value={walkingTime(f.walking_s)}
              avatar={
                <Avatar
                  name={f.walker.first_name}
                  seed={f.walker.id}
                  photo={f.walker.avatar_url}
                  tone="walker"
                  size={36}
                />
              }
            />
          ))
      )}
    </>
  );
}

function ActionBar({ route }: { route: PublicRouteDetail }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { share, begin, starting } = useActions(route);
  return (
    <View style={styles.actions}>
      <Pressable
        onPress={share}
        accessibilityRole="button"
        accessibilityLabel={t('summary.share')}
        style={[styles.square, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <ShareIcon size={20} color={colors.text} />
      </Pressable>
      <Button
        tone="accent"
        title={route.my_journey_id ? t('publicRoute.onIt') : t('publicRoute.start')}
        icon={
          route.my_journey_id ? (
            <RouteIcon size={20} color={colors.onAccent} />
          ) : (
            <Flag size={20} color={colors.onAccent} />
          )
        }
        onPress={begin}
        loading={starting}
        style={styles.flex}
      />
    </View>
  );
}

function TopButtons({ route, top }: { route: PublicRouteDetail; top: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { more } = useActions(route);
  return (
    <View style={[styles.top, { top }]} pointerEvents="box-none">
      <GlassButton
        icon={<ChevronLeft size={22} color={colors.text} />}
        onPress={() => router.back()}
        label={t('common.back')}
      />
      <ActionMenu items={more} label={t('publicRoute.more')}>
        <GlassButton
          icon={<Ellipsis size={22} color={colors.text} />}
          onPress={() => {}}
          label={t('publicRoute.more')}
        />
      </ActionMenu>
    </View>
  );
}

function Phone({ route }: { route: PublicRouteDetail }) {
  const colors = useColors();
  const shadows = useShadows();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView style={{ backgroundColor: colors.surface }} contentContainerStyle={styles.grow}>
        <Gallery route={route} width={width} height={330} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, paddingBottom: insets.bottom + 120 },
            shadows.sheet,
          ]}
        >
          <Body route={route} />
        </View>
      </ScrollView>
      <TopButtons route={route} top={insets.top + 8} />
      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + 12, backgroundColor: colors.surface },
        ]}
      >
        <ActionBar route={route} />
      </View>
    </View>
  );
}

function Wide({ route }: { route: PublicRouteDetail }) {
  const colors = useColors();
  const shadows = useShadows();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // The panel is docked on the right, its round corners over the pictures,
  // which run under them.
  const panel = 432;
  const round = 34;
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Gallery route={route} width={width - panel + round} height={height} under={round} />
      <View
        style={[styles.panel, { backgroundColor: colors.surface, width: panel }, shadows.floating]}
      >
        <ScrollView contentContainerStyle={[styles.panelContent, { paddingTop: insets.top + 26 }]}>
          <Body route={route} wide />
        </ScrollView>
        <View style={[styles.panelFooter, { paddingBottom: insets.bottom + 26 }]}>
          <ActionBar route={route} />
        </View>
      </View>
      <View style={[styles.wideTop, { width: width - panel }]} pointerEvents="box-none">
        <TopButtons route={route} top={28} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  shade: {
    backgroundImage:
      'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 55%, rgba(20,10,6,0.45) 92%)',
  },
  chip: { position: 'absolute', left: 20 },
  // Licences of photos from elsewhere ask for the author's name.
  credit: {
    position: 'absolute',
    right: 16,
    maxWidth: '70%',
    color: 'rgba(255,255,255,0.8)',
    fontFamily: fonts.text,
    fontSize: 10.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 3,
  },
  dots: { position: 'absolute', right: 20, flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 9 },
  dotOn: { width: 18 },
  top: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  wideTop: { position: 'absolute', left: 0, top: 0 },
  grow: { flexGrow: 1 },
  shrink: { flexShrink: 1 },
  // Down to the bottom of the screen, behind the action bar.
  sheet: {
    flexGrow: 1,
    marginTop: -34,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingTop: 22,
    paddingHorizontal: 20,
    gap: 12,
  },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 31, letterSpacing: -0.8 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  small: { fontFamily: fonts.text, fontSize: 13.5, fontVariant: ['tabular-nums'] },
  description: { fontFamily: fonts.text, fontSize: 15, lineHeight: 22 },
  descriptionWide: { fontSize: 14, lineHeight: 21 },
  titleWide: { lineHeight: 30, letterSpacing: -0.84 },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 4 },
  fastestHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 8,
  },
  section: { fontFamily: fonts.textSemiBold, fontSize: 16 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  actions: { flexDirection: 'row', gap: 12 },
  square: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: 34,
    borderBottomLeftRadius: 34,
    overflow: 'hidden',
  },
  panelContent: { padding: 26, paddingBottom: 12, gap: 16 },
  panelFooter: { paddingHorizontal: 26, paddingBottom: 26, paddingTop: 10 },
  smallTile: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  smallLabel: { fontFamily: fonts.textMedium, fontSize: 12 },
});
