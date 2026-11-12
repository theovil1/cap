import { router } from 'expo-router';
import { Compass, Flag, Sparkles } from 'lucide-react-native';
import { useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useFeaturedRoute, usePublicRoutes, type PublicRouteFilters } from '@/api/community';
import { useJourneys } from '@/api/queries';
import type { PublicRouteCard } from '@/api/types';
import { formatKm, formatNumber } from '@/i18n/format';
import { useColors } from '@/theme';
import { RouteCard, RouteRow } from '@/ui/cards';
import { SectionHeader } from '@/ui/controls';
import { EmptyState, useWide } from '@/ui/layout';

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
export function RoutesExplorer({ search, filter }: { search: string; filter: RouteFilter }) {
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
      cover={<RouteCover photos={featured.data.photos} place={featured.data.end} />}
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
    <View key={route.id} style={wide && styles.cell}>
      <RouteRow
        cover={<RouteCover photos={route.photos} place={route.end} zoom={13} />}
        title={route.title}
        subtitle={subtitle(route)}
        {...facts(route)}
        onPress={() => openRoute(route)}
      />
    </View>
  ));

  if (wide) {
    return (
      <View style={styles.wide}>
        {hero ? <View style={styles.heroWide}>{hero}</View> : null}
        <View style={styles.listWide}>
          <SectionHeader title={t(`explore.lists.${filter}`)} />
          <View style={styles.grid}>{rows}</View>
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
  wide: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  heroWide: { flex: 1 },
  listWide: { flex: 1, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { width: '48%', flexGrow: 1 },
});
