import { router } from 'expo-router';
import { Compass, Flag, Sparkles } from 'lucide-react-native';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useFeaturedRoute, usePublicRoutes, type PublicRouteFilters } from '@/api/community';
import { useJourneys } from '@/api/queries';
import type { PublicRouteCard } from '@/api/types';
import { formatKm, formatNumber } from '@/i18n/format';
import { fonts, useColors } from '@/theme';
import { RouteCard, RouteRow, RouteTile } from '@/ui/cards';
import { SectionHeader } from '@/ui/controls';
import { EmptyState, useWide } from '@/ui/layout';
import { Button } from '@/ui/primitives';

import { RouteCover } from './route-cover';

/** Explorer chips and what they ask the API. */
export const ROUTE_FILTERS = [
  'popular',
  'near',
  'new',
  'short',
  'mountain',
  'sea',
  'castles',
] as const;
export type RouteFilter = (typeof ROUTE_FILTERS)[number];

const TAG: Partial<Record<RouteFilter, string>> = {
  mountain: 'mountain',
  sea: 'sea',
  castles: 'castles',
};
/** "Courts": a few weeks of sessions at most. */
const SHORT_KM = 60;

function openRoute(route: PublicRouteCard) {
  router.push({ pathname: '/public-route/[id]', params: { id: route.id } });
}

/** The Trajets part of the Explorer: the route of the week, then the list. */
export function RoutesExplorer({
  search,
  filter,
  height,
}: {
  search: string;
  filter: RouteFilter;
  /** iPad: the height left under the filters, which the hero and the grid fill. */
  height?: number;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const wide = useWide();
  const q = useDeferredValue(search.trim());
  // "Near you": from the start of my latest journey, the only place Cap knows.
  const { data: journeys = [] } = useJourneys();
  const home = journeys[0]?.start;
  const filters: PublicRouteFilters = {
    sort: filter === 'near' ? 'near' : filter === 'new' ? 'new' : 'popular',
    q: q || undefined,
    tag: TAG[filter],
    max_km: filter === 'short' ? SHORT_KM : undefined,
    lat: filter === 'near' ? home?.lat : undefined,
    lon: filter === 'near' ? home?.lon : undefined,
  };
  const list = usePublicRoutes(filters, filter !== 'near' || !!home);
  const featured = useFeaturedRoute();
  const [all, setAll] = useState(false);
  const showFeatured = filter === 'popular' && !q && featured.data;
  const routes = (list.data ?? []).filter((r) => !showFeatured || r.id !== featured.data?.id);

  const facts = (route: PublicRouteCard) => ({
    distance: `${formatKm(route.distance_m, 0)} ${t('units.km')}`,
    walkers: t('explore.walkers', { count: route.walkers, n: formatNumber(route.walkers) }),
  });
  const subtitle = (route: PublicRouteCard) =>
    [route.description || null, t('explore.stages', { count: route.stages })]
      .filter(Boolean)
      .join(' · ');

  const hero = showFeatured && featured.data && (
    <RouteCard
      cover={<RouteCover photos={featured.data.photos} place={featured.data.end} small />}
      tag={t('explore.ofTheWeek')}
      tagIcon={Sparkles}
      caption={t('explore.arrival', {
        place: featured.data.end_town ?? featured.data.end.label,
      })}
      captionIcon={Flag}
      title={featured.data.title}
      subtitle={subtitle(featured.data)}
      {...facts(featured.data)}
      onPress={() => featured.data && openRoute(featured.data)}
      fill={wide}
      action={
        wide ? (
          <Button
            tone="accent"
            size="medium"
            title={t('explore.start')}
            icon={<Flag size={17} color={colors.onAccent} />}
            onPress={() => featured.data && openRoute(featured.data)}
            style={styles.start}
          />
        ) : undefined
      }
    />
  );

  if (list.isLoading) return <ActivityIndicator color={colors.textMuted} style={styles.loading} />;
  if (filter === 'near' && !home) {
    return (
      <EmptyState
        icon={<Compass size={22} color={colors.accentText} />}
        title={t('explore.nearNoPlace')}
        text={t('explore.nearNoPlaceText')}
      />
    );
  }
  if (!hero && routes.length === 0) {
    return (
      <EmptyState
        icon={<Compass size={22} color={colors.accentText} />}
        title={t(q ? 'explore.noResult' : 'explore.empty')}
        text={t(q ? 'explore.noResultText' : 'explore.emptyText')}
      />
    );
  }

  const rows = routes.map((route) => (
    <RouteRow
      key={route.id}
      cover={<RouteCover photos={route.photos} place={route.end} zoom={13} small />}
      title={route.title}
      subtitle={subtitle(route)}
      {...facts(route)}
      onPress={() => openRoute(route)}
    />
  ));

  if (wide) {
    // The mockup: the route of the week on the left, two by two tiles on the
    // right filling the screen; "Tout voir" shows the others below.
    const shown = all ? routes : routes.slice(0, 4);
    const pairs = Array.from({ length: Math.ceil(shown.length / 2) }, (_, i) =>
      shown.slice(2 * i, 2 * i + 2),
    );
    return (
      <View style={[styles.wide, { minHeight: height }]}>
        {hero ? <View style={styles.heroWide}>{hero}</View> : null}
        <View style={[styles.listWide, !hero && styles.full]}>
          <View style={styles.listHead}>
            <Text style={[styles.listTitle, { color: colors.text }]}>
              {t(`explore.lists.${filter}`)}
            </Text>
            {routes.length > 4 ? (
              <Pressable onPress={() => setAll(!all)} accessibilityRole="button" hitSlop={8}>
                <Text style={[styles.seeAll, { color: colors.blueText }]}>
                  {all ? t('explore.seeLess') : t('explore.seeAll')} ›
                </Text>
              </Pressable>
            ) : null}
          </View>
          {pairs.map((pair, i) => (
            <View key={i} style={[styles.pair, !all && styles.pairFill]}>
              {pair.map((route) => (
                <RouteTile
                  key={route.id}
                  fill
                  cover={<RouteCover photos={route.photos} place={route.end} zoom={13} small />}
                  title={route.title}
                  subtitle={subtitle(route)}
                  {...facts(route)}
                  onPress={() => openRoute(route)}
                />
              ))}
              {pair.length === 1 ? <View style={styles.flex} /> : null}
            </View>
          ))}
        </View>
      </View>
    );
  }
  return (
    <>
      {hero}
      {routes.length > 0 && <SectionHeader title={t(`explore.lists.${filter}`)} />}
      {rows}
    </>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 40 },
  // As in the iPad mockup: the route of the week (1.15) beside the tiles (1).
  wide: { flexDirection: 'row', gap: 20, alignItems: 'stretch' },
  heroWide: { flex: 1.15 },
  listWide: { flex: 1, gap: 12 },
  full: { flex: 1 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  listTitle: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.4 },
  seeAll: { fontFamily: fonts.textSemiBold, fontSize: 14 },
  pair: { flexDirection: 'row', gap: 14, minHeight: 230 },
  pairFill: { flex: 1 },
  flex: { flex: 1 },
  start: { height: 46, borderRadius: 999, paddingHorizontal: 18 },
});
