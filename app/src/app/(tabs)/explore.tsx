import { router } from 'expo-router';
import { CalendarDays, Compass, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { useColors } from '@/theme';
import { type } from '@/tokens';
import { Chip, ChipRow, SearchBar, Tabs } from '@/ui/controls';
import { EmptyState, ScreenHeader, TabScreen } from '@/ui/layout';
import { RoundButton } from '@/ui/primitives';

type Part = 'routes' | 'planned';

const FILTERS: Record<Part, string[]> = {
  routes: ['popular', 'near', 'new', 'short', 'mountain', 'sea', 'castles'],
  planned: ['all', 'mine', 'friends'],
};

/**
 * Explore tab: public routes and scheduled journeys. The lists come with the
 * community API; until then the screen keeps its shape with an empty state.
 */
export default function ExploreScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const [part, setPart] = useState<Part>('routes');
  const [filter, setFilter] = useState<Record<Part, string>>({ routes: 'popular', planned: 'all' });
  const [search, setSearch] = useState('');

  return (
    <TabScreen>
      <ScreenHeader title={t('nav.explore')}>
        <RoundButton
          icon={<Plus size={20} color={colors.text} strokeWidth={2} />}
          onPress={() => router.push('/new-journey')}
          label={t('journeys.new')}
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
        {FILTERS[part].map((key) => (
          <Chip
            key={key}
            label={t(`explore.filters.${key}`)}
            on={filter[part] === key}
            onPress={() => setFilter((current) => ({ ...current, [part]: key }))}
          />
        ))}
      </ChipRow>
      {part === 'planned' && (
        <Text style={[type.subhead, { color: colors.textSecondary }]}>
          {t('explore.plannedIntro')}
        </Text>
      )}
      <EmptyState
        icon={
          part === 'routes' ? (
            <Compass size={22} color={colors.accentText} />
          ) : (
            <CalendarDays size={22} color={colors.accentText} />
          )
        }
        title={t('explore.soon')}
        text={t(part === 'routes' ? 'explore.soonRoutes' : 'explore.soonPlanned')}
      />
    </TabScreen>
  );
}
