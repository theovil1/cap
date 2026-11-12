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
  ActionSheetIOS,
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

import { ApiError } from '@/api/client';
import { useReport, useStartPublicRoute, useUnpublish, usePublicRoute } from '@/api/community';
import type { PublicRouteDetail, RoutePhoto } from '@/api/types';
import { RouteCover } from '@/community/route-cover';
import { formatKm, formatNumber } from '@/i18n/format';
import { fonts, useColors, useShadows } from '@/theme';
import { HOME } from '@/ui/routes';
import { useWide } from '@/ui/layout';
import { PhotoChip, Tag } from '@/ui/pills';
import { Avatar, Button, GlassButton } from '@/ui/primitives';
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
  const more = () => {
    const options = route.mine
      ? [t('publicRoute.photos'), t('publicRoute.unpublish'), t('journeys.cancel')]
      : [t('publicRoute.report'), t('journeys.cancel')];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: route.mine ? 1 : 0,
      },
      (index) => {
        if (route.mine && index === 0) {
          router.push({ pathname: '/publish', params: { publicRouteId: route.id } });
        } else if (route.mine && index === 1) {
          Alert.alert(t('publicRoute.unpublishTitle'), t('publicRoute.unpublishBody'), [
            { text: t('journeys.cancel'), style: 'cancel' },
            {
              text: t('publicRoute.unpublish'),
              style: 'destructive',
              onPress: () => unpublish.mutate(route.id, { onSuccess: () => router.back() }),
            },
          ]);
        } else if (!route.mine && index === 0) {
          report.mutate(
            { target_type: 'route', target_id: route.id },
            { onSuccess: () => Alert.alert(t('publicRoute.reported')) },
          );
        }
      },
    );
  };
  return { share, begin, more, starting: start.isPending };
}

/** Swipeable pictures: start, destination, and the path photo when there is one. */
function Gallery({
  route,
  height,
  width,
}: {
  route: PublicRouteDetail;
  height: number;
  width: number;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const slides = KINDS.filter((k) => k !== 'path' || route.photos.some((p) => p.kind === 'path'));
  const label = (kind: RoutePhoto['kind']) =>
    kind === 'start'
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
            <RouteCover
              photos={route.photos}
              kind={kind}
              place={kind === 'start' ? route.start : route.end}
              zoom={15}
            />
            <View style={[StyleSheet.absoluteFill, styles.shade]} pointerEvents="none" />
            <PhotoChip
              label={label(kind)}
              icon={kind === 'end' ? Flag : MapPin}
              style={[styles.chip, { bottom: 52 }]}
            />
          </View>
        ))}
      </ScrollView>
      <View style={[styles.dots, { bottom: 60 }]} pointerEvents="none">
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

function Body({ route }: { route: PublicRouteDetail }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <>
      {route.featured ? <Tag label={t('explore.ofTheWeek')} icon={Sparkles} /> : null}
      <Text style={[styles.title, { color: colors.text }]}>{route.title}</Text>
      <View style={styles.author}>
        <Avatar
          name={route.author.first_name}
          seed={route.author.id}
          photo={route.author.avatar_url}
          tone="walker"
          size={22}
        />
        <Text style={[styles.small, { color: colors.textSecondary }]}>
          {t('publicRoute.by', {
            name: route.author.first_name,
            stages: t('explore.stages', { count: route.stages }),
          })}
        </Text>
      </View>
      {route.description ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {route.description}
        </Text>
      ) : null}
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
      <GlassButton
        icon={<Ellipsis size={22} color={colors.text} />}
        onPress={more}
        label={t('publicRoute.more')}
      />
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
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <Gallery route={route} width={width} height={330} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }, shadows.sheet]}>
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
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const panel = 440;
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Gallery route={route} width={width - panel} height={height} />
      <View
        style={[
          styles.panel,
          { backgroundColor: colors.surface, width: panel - 20, top: insets.top + 20 },
          { bottom: insets.bottom + 20 },
          shadows.floating,
        ]}
      >
        <ScrollView contentContainerStyle={styles.panelContent}>
          <Body route={route} />
        </ScrollView>
        <View style={styles.panelFooter}>
          <ActionBar route={route} />
        </View>
      </View>
      <View style={[styles.wideTop, { width: width - panel }]} pointerEvents="box-none">
        <TopButtons route={route} top={insets.top + 20} />
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
  sheet: {
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
  panel: { position: 'absolute', right: 20, borderRadius: 30, overflow: 'hidden' },
  panelContent: { padding: 26, gap: 12 },
  panelFooter: { padding: 22, paddingTop: 10 },
});
