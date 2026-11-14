import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MeAvatar } from '@/ui/me-avatar';
import { ActionMenu } from '@/ui/action-menu';
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
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // iPad mockup: under the title (54), the tabs and search (50) and the chips (36), 20 apart.
  const listHeight = height - (insets.top + 2) - 54 - 20 - 50 - 20 - 36 - 20 - (insets.bottom + 32);
  const [part, setPart] = useState<Part>('routes');
  const [routeFilter, setRouteFilter] = useState<RouteFilter>('popular');
  const [plannedFilter, setPlannedFilter] = useState<EventFilter>('all');
  // A green dot on Planifiés while one is under way.
  const { data: events = [] } = useEvents('all');
  const live = events.some((e) => e.state === 'live');
  const [search, setSearch] = useState('');

  return (
    <TabScreen>
      <ScreenHeader title={t('nav.explore')}>
        {/* New journey, or publish one of mine for the community. */}
        <ActionMenu
          label={t('explore.add')}
          items={[
            { label: t('journeys.new'), icon: 'map', onPress: () => router.push('/new-journey') },
            {
              label: t('publish.title'),
              icon: 'square.and.arrow.up',
              onPress: () => router.push('/publish'),
            },
          ]}
        >
          <RoundButton
            icon={<Plus size={20} color={colors.text} strokeWidth={2} />}
            onPress={() => {}}
            label={t('explore.add')}
          />
        </ActionMenu>
        {wide ? <MeAvatar /> : null}
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
      {/* iPad (Planifiés): the chips and the one-line intro share a row. */}
      <View style={wide && part === 'planned' ? styles.chipsWide : null}>
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
        {wide && part === 'planned' ? (
          <Text
            style={[type.subhead, styles.flex, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {t('explore.plannedIntro')}
          </Text>
        ) : null}
      </View>
      {part === 'routes' ? (
        <RoutesExplorer
          search={search}
          filter={routeFilter}
          height={wide ? listHeight : undefined}
        />
      ) : (
        <>
          {wide ? null : (
            <Text style={[type.subhead, { color: colors.textSecondary }]}>
              {t('explore.plannedIntro')}
            </Text>
          )}
          <EventsExplorer
            search={search}
            filter={plannedFilter}
            height={wide ? listHeight : undefined}
          />
        </>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  chipsWide: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  parts: { width: 300 },
  flex: { flex: 1 },
});
