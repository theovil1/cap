import { router } from 'expo-router';
import { CalendarDays, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionSheetIOS, Text } from 'react-native';

import { ROUTE_FILTERS, RoutesExplorer, type RouteFilter } from '@/community/routes-explorer';
import { useColors } from '@/theme';
import { type } from '@/tokens';
import { Chip, ChipRow, SearchBar, Tabs } from '@/ui/controls';
import { EmptyState, ScreenHeader, TabScreen } from '@/ui/layout';
import { RoundButton } from '@/ui/primitives';

type Part = 'routes' | 'planned';

const PLANNED_FILTERS = ['all', 'mine', 'friends'] as const;

/** Explore tab: public routes and scheduled journeys. */
export default function ExploreScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const [part, setPart] = useState<Part>('routes');
  const [routeFilter, setRouteFilter] = useState<RouteFilter>('popular');
  const [plannedFilter, setPlannedFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // New journey, or publish one of mine for the community.
  const add = () =>
    ActionSheetIOS.showActionSheetWithOptions(
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
      <Tabs
        options={[
          { value: 'routes', label: t('explore.routes') },
          { value: 'planned', label: t('explore.planned') },
        ]}
        value={part}
        onChange={setPart}
      />
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={t(part === 'routes' ? 'explore.searchRoutes' : 'explore.searchPlanned')}
      />
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
          : PLANNED_FILTERS.map((key) => (
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
          <EmptyState
            icon={<CalendarDays size={22} color={colors.accentText} />}
            title={t('explore.soon')}
            text={t('explore.soonPlanned')}
          />
        </>
      )}
    </TabScreen>
  );
}
