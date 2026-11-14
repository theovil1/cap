import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { showActions } from '@/ui/action-sheet';
import { useEvents, type EventFilter } from '@/api/community';
import { EVENT_FILTERS, EventsExplorer } from '@/community/events-explorer';
import { ROUTE_FILTERS, RoutesExplorer, type RouteFilter } from '@/community/routes-explorer';
import { useColors } from '@/theme';
import { type } from '@/tokens';
import { Chip, ChipRow, SearchBar, Tabs } from '@/ui/controls';
import { ScreenHeader, TabScreen, useWide } from '@/ui/layout';
import { RoundButton } from '@/ui/primitives';

type Part = 'routes' | 'planned';

/** Explore tab: public routes and scheduled journeys. */
export default function ExploreScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const wide = useWide();
  const [part, setPart] = useState<Part>('routes');
  const [routeFilter, setRouteFilter] = useState<RouteFilter>('popular');
  const [plannedFilter, setPlannedFilter] = useState<EventFilter>('all');
  // A green dot on Planifiés while one is under way.
  const { data: events = [] } = useEvents('all');
  const live = events.some((e) => e.state === 'live');
  const [search, setSearch] = useState('');

  // New journey, or publish one of mine for the community.
  const add = (from?: GestureResponderEvent) =>
    showActions(
      from,
      {
        options: [t('journeys.new'), t('publish.title'), t('journeys.cancel')],
        cancelButtonIndex: 2,
      },
      (index) => {
        if (index === 0) router.push('/new-journey');
        if (index === 1) router.push('/publish');
      },
    );

  return (
    <TabScreen>
      <ScreenHeader title={t('nav.explore')}>
        <RoundButton
          icon={<Plus size={20} color={colors.text} strokeWidth={2} />}
          onPress={add}
          label={t('explore.add')}
        />
      </ScreenHeader>
      {/* iPad: the two parts and the search side by side, as in the mockup. */}
      <View style={wide ? styles.bar : styles.stack}>
        <View style={wide ? styles.parts : null}>
          <Tabs
            options={[
              { value: 'routes', label: t('explore.routes') },
              { value: 'planned', label: t('explore.planned'), dot: live },
            ]}
            value={part}
            onChange={setPart}
          />
        </View>
        <View style={wide ? styles.flex : null}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder={t(part === 'routes' ? 'explore.searchRoutes' : 'explore.searchPlanned')}
          />
        </View>
      </View>
      <ChipRow>
        {part === 'routes'
          ? ROUTE_FILTERS.map((key) => (
              <Chip
                key={key}
                label={t(`explore.filters.${key}`)}
                on={routeFilter === key}
                onPress={() => setRouteFilter(key)}
              />
            ))
          : EVENT_FILTERS.map((key) => (
              <Chip
                key={key}
                label={t(`explore.filters.${key}`)}
                on={plannedFilter === key}
                onPress={() => setPlannedFilter(key)}
              />
            ))}
      </ChipRow>
      {part === 'routes' ? (
        <RoutesExplorer search={search} filter={routeFilter} />
      ) : (
        <>
          <Text style={[type.subhead, { color: colors.textSecondary }]}>
            {t('explore.plannedIntro')}
          </Text>
          <EventsExplorer search={search} filter={plannedFilter} />
        </>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  parts: { width: 300 },
  flex: { flex: 1 },
});
