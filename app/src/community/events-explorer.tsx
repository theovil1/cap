import { router } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useEvents, type EventFilter } from '@/api/community';
import type { EventCard, RoutePhoto } from '@/api/types';
import { formatAgo, formatDate, formatKm, formatNumber } from '@/i18n/format';
import { useColors } from '@/theme';
import { type } from '@/tokens';
import { EventRow, LiveEventCard } from '@/ui/cards';
import { EmptyState, useWide } from '@/ui/layout';

import { RouteCover } from './route-cover';

export const EVENT_FILTERS: EventFilter[] = ['all', 'mine', 'friends'];

/** The photo of a scheduled journey as the cover component expects it. */
export function eventPhotos(event: EventCard): RoutePhoto[] {
  return event.photo_url ? [{ kind: 'end', url: event.photo_url }] : [];
}

function openEvent(event: EventCard) {
  router.push({ pathname: '/event/[id]', params: { id: event.id } });
}

/** Time of day as the app speaks it: "9 h" or "9 h 30" (fr), "9:30 AM" (en). */
export function formatHour(iso: string): string {
  const date = new Date(iso);
  return formatDate(date, { hour: 'numeric', minute: date.getMinutes() ? '2-digit' : undefined });
}

/** The Planifiés part of the Explorer: under way first, then the next ones. */
export function EventsExplorer({ search, filter }: { search: string; filter: EventFilter }) {
  const { t } = useTranslation();
  const colors = useColors();
  const wide = useWide();
  const q = useDeferredValue(search.trim());
  const { data: events = [], isLoading } = useEvents(filter, q);
  const [now] = useState(() => Date.now());
  const live = events.filter((e) => e.state === 'live');
  const upcoming = events.filter((e) => e.state !== 'live');

  if (isLoading) return <ActivityIndicator color={colors.textMuted} style={styles.loading} />;
  if (events.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays size={22} color={colors.accentText} />}
        title={t(filter === 'all' ? 'events.empty' : 'events.emptyFiltered')}
        text={t('events.emptyText')}
      />
    );
  }
  const walkers = (event: EventCard) =>
    event.friends.map((f) => ({ id: f.id, name: f.first_name, photo: f.avatar_url }));
  const liveCards = live.map((event) => (
    <LiveEventCard
      key={event.id}
      cover={<RouteCover photos={eventPhotos(event)} place={event.end} small />}
      live={t('events.live')}
      walkers={walkers(event)}
      walking={t('events.walkingNow', {
        count: event.walking_now,
        n: formatNumber(event.walking_now),
      })}
      title={event.title}
      subtitle={t('events.liveFacts', {
        km: formatKm(event.distance_m),
        ago: formatAgo(event.starts_at, now),
      })}
      action={event.me_registered ? t('events.watch') : t('events.join')}
      onPress={() => openEvent(event)}
    />
  ));
  const upcomingTitle = upcoming.length > 0 && (
    <Text style={[type.label, { color: colors.textSecondary }]}>{t('events.upcoming')}</Text>
  );
  const upcomingRows = upcoming.map((event) => {
    const start = new Date(event.starts_at);
    return (
      <EventRow
        key={event.id}
        day={formatDate(start, { day: 'numeric' })}
        month={formatDate(start, { month: 'short' }).replace('.', '')}
        title={event.title}
        subtitle={t('events.facts', {
          km: formatKm(event.distance_m, 0),
          hour: formatHour(event.starts_at),
          name: event.organizer.first_name,
        })}
        walkers={walkers(event)}
        people={[
          t('events.registered', {
            count: event.registered,
            n: formatNumber(event.registered),
          }),
          event.state === 'ended'
            ? t('events.ended')
            : event.me_registered
              ? t('events.youreIn')
              : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        onPress={() => openEvent(event)}
      />
    );
  });
  // iPad, as in the mockup: under way on the left, the next ones on the right.
  if (wide) {
    return (
      <View style={styles.columns}>
        {live.length > 0 ? <View style={styles.column}>{liveCards}</View> : null}
        <View style={styles.column}>
          {upcomingTitle}
          <View style={live.length > 0 ? styles.column : styles.grid}>
            {upcomingRows.map((row, i) => (
              <View key={i} style={live.length > 0 ? null : styles.cell}>
                {row}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }
  return (
    <>
      {liveCards}
      {upcomingTitle}
      {upcomingRows}
    </>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 40 },
  columns: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  column: { flex: 1, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexBasis: 320, flexGrow: 1, maxWidth: '50%' },
});
