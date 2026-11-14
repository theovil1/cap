import { router } from 'expo-router';
import { CalendarDays, Plus } from 'lucide-react-native';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View, Pressable } from 'react-native';

import { useEvents, type EventFilter } from '@/api/community';
import type { EventCard, RoutePhoto } from '@/api/types';
import { formatAgo, formatDate, formatKm, formatNumber } from '@/i18n/format';
import { fonts, useColors } from '@/theme';
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
export function EventsExplorer({
  search,
  filter,
  height,
}: {
  search: string;
  filter: EventFilter;
  /** iPad: the height under the filters, which the two columns fill. */
  height?: number;
}) {
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
      fill={wide}
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
        wide={wide}
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
  // iPad, as in the mockup: under way on the left, the next ones in 470 on
  // the right, with "Organise ton départ" at the bottom.
  if (wide) {
    const organise = (
      <Pressable
        onPress={() => router.push('/plan')}
        accessibilityRole="button"
        style={[styles.organise, { borderColor: colors.track }]}
      >
        <View style={[styles.organiseIcon, { backgroundColor: colors.accentSoft }]}>
          <CalendarDays size={22} color={colors.accentText} />
        </View>
        <View style={styles.organiseText}>
          <Text style={[styles.organiseTitle, { color: colors.text }]}>{t('events.organise')}</Text>
          <Text style={[styles.organiseSub, { color: colors.textSecondary }]}>
            {t('events.organiseText')}
          </Text>
        </View>
        <Plus size={20} color={colors.textSecondary} />
      </Pressable>
    );
    const heading = (label: string) => (
      <Text style={[styles.heading, { color: colors.text }]}>{label}</Text>
    );
    return (
      <View style={[styles.columns, { minHeight: height }]}>
        {live.length > 0 ? (
          <View style={styles.liveColumn}>
            {heading(t('events.underWay'))}
            {liveCards}
          </View>
        ) : null}
        <View style={live.length > 0 ? styles.upcomingColumn : styles.liveColumn}>
          {upcoming.length > 0 ? heading(t('events.upcoming')) : null}
          {upcomingRows}
          <View style={styles.spacer} />
          {organise}
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
  columns: { flexDirection: 'row', gap: 20, alignItems: 'stretch' },
  liveColumn: { flex: 1, gap: 12 },
  upcomingColumn: { width: 470, gap: 12 },
  heading: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.4 },
  spacer: { flex: 1 },
  organise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  organiseIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  organiseText: { flex: 1, gap: 2 },
  organiseTitle: { fontFamily: fonts.textSemiBold, fontSize: 16 },
  organiseSub: { fontFamily: fonts.text, fontSize: 13 },
});
