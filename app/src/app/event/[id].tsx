import { router, useLocalSearchParams } from 'expo-router';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Radio,
  Share as ShareIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { useEvent, useRegister } from '@/api/community';
import type { EventCard } from '@/api/types';
import { eventPhotos, formatHour } from '@/community/events-explorer';
import { RouteCover } from '@/community/route-cover';
import { formatDate, formatKm, formatNumber } from '@/i18n/format';
import { fonts, useColors, useShadows } from '@/theme';
import { useWide } from '@/ui/layout';
import { LivePill, PhotoChip } from '@/ui/pills';
import { Button, Card, GlassButton } from '@/ui/primitives';
import { AvatarStack, CountTile } from '@/ui/stats';

/** Days, hours, minutes and seconds until a date, ticking every second. */
function useCountdown(iso: string): [number, number, number, number] {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, Math.floor((Date.parse(iso) - now) / 1000));
  return [
    Math.floor(left / 86_400),
    Math.floor(left / 3600) % 24,
    Math.floor(left / 60) % 60,
    left % 60,
  ];
}

/** A scheduled journey: when, how far, who is in, and signing up. */
export default function EventScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event, isLoading } = useEvent(id);
  if (!event) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.background }]}>
        {isLoading ? (
          <ActivityIndicator color={colors.textMuted} />
        ) : (
          <Text style={[styles.small, { color: colors.textSecondary }]}>{t('events.gone')}</Text>
        )}
      </View>
    );
  }
  return <EventView event={event} />;
}

function Countdown({ iso }: { iso: string }) {
  const { t } = useTranslation();
  const [days, hours, minutes, seconds] = useCountdown(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <View style={styles.countdown}>
      <CountTile value={formatNumber(days)} label={t('events.days', { count: days })} />
      <CountTile value={pad(hours)} label={t('events.hours')} />
      <CountTile value={pad(minutes)} label={t('events.minutes')} />
      <CountTile value={pad(seconds)} label={t('events.seconds')} />
    </View>
  );
}

function EventView({ event }: { event: EventCard }) {
  const { t } = useTranslation();
  const colors = useColors();
  const shadows = useShadows();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const register = useRegister();
  const start = new Date(event.starts_at);
  const day = formatDate(start, { weekday: 'long', day: 'numeric', month: 'long' });
  const live = event.state === 'live';
  const ended = event.state === 'ended';

  const toggle = () =>
    register.mutate(
      { id: event.id, on: !event.me_registered },
      {
        onSuccess: (next) => {
          if (next.me_registered && next.state === 'live') {
            router.push({ pathname: '/event-live/[id]', params: { id: next.id } });
          }
        },
        onError: (error) =>
          Alert.alert(
            error instanceof ApiError && error.code === 'event_over'
              ? t('events.over')
              : error instanceof ApiError && error.code === 'organizer'
                ? t('events.organizerStays')
                : t('errors.generic'),
          ),
      },
    );
  const leave = () =>
    Alert.alert(t('events.leaveTitle'), undefined, [
      { text: t('journeys.cancel'), style: 'cancel' },
      { text: t('events.leave'), style: 'destructive', onPress: toggle },
    ]);
  const share = () =>
    Share.share({
      message: t('events.shareText', {
        title: event.title,
        day,
        hour: formatHour(event.starts_at),
      }),
    });

  const action = ended ? null : event.me_registered ? (
    live ? (
      <Button
        tone="accent"
        title={t('events.watch')}
        icon={<Radio size={20} color={colors.onAccent} />}
        onPress={() => router.push({ pathname: '/event-live/[id]', params: { id: event.id } })}
      />
    ) : (
      <Button
        tone="light"
        title={t('events.registeredLeave')}
        icon={<Check size={20} color={colors.success} />}
        onPress={leave}
        loading={register.isPending}
      />
    )
  ) : (
    <Button
      tone="accent"
      title={live ? t('events.join') : t('events.signUp')}
      icon={<Check size={20} color={colors.onAccent} />}
      onPress={toggle}
      loading={register.isPending}
    />
  );

  const body = (
    <>
      <View style={styles.when}>
        {live ? (
          <LivePill label={t('events.live')} />
        ) : (
          <>
            <CalendarDays size={16} color={colors.blueText} />
            <Text style={[styles.whenText, { color: colors.blueText }]}>
              {t('events.when', { day, hour: formatHour(event.starts_at) })}
            </Text>
          </>
        )}
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{event.title}</Text>
      <Text style={[styles.small, { color: colors.textSecondary }]}>
        {t('events.rule', {
          km: formatKm(event.distance_m, 0),
          stages: t('explore.stages', { count: event.stages }),
        })}
      </Text>
      {event.state === 'upcoming' ? <Countdown iso={event.starts_at} /> : null}
      {ended ? (
        <Text style={[styles.small, { color: colors.textSecondary }]}>{t('events.endedText')}</Text>
      ) : live ? (
        <Text style={[styles.small, { color: colors.textSecondary }]}>
          {t('events.liveUntil', {
            day: formatDate(new Date(event.ends_at), { day: 'numeric', month: 'long' }),
          })}
        </Text>
      ) : null}
      <Pressable
        onPress={() =>
          live || ended
            ? router.push({ pathname: '/event-live/[id]', params: { id: event.id } })
            : null
        }
        accessibilityRole="button"
      >
        <Card style={styles.people}>
          {event.friends.length > 0 ? (
            <AvatarStack
              walkers={event.friends.map((f) => ({
                id: f.id,
                name: f.first_name,
                photo: f.avatar_url,
              }))}
            />
          ) : null}
          <View style={styles.flex}>
            <Text style={[styles.peopleTitle, { color: colors.text }]}>
              {t('events.registered', {
                count: event.registered,
                n: formatNumber(event.registered),
              })}
            </Text>
            {event.friends_registered > 0 ? (
              <Text style={[styles.small, { color: colors.textSecondary }]}>
                {t('events.friendsIn', { count: event.friends_registered })}
              </Text>
            ) : null}
          </View>
          {live || ended ? <ChevronRight size={18} color={colors.textMuted} /> : null}
        </Card>
      </Pressable>
      <Pressable
        onPress={() =>
          router.push({ pathname: '/public-route/[id]', params: { id: event.public_route_id } })
        }
        accessibilityRole="link"
      >
        <Text style={[styles.link, { color: colors.blueText }]}>{t('events.seeRoute')} ›</Text>
      </Pressable>
    </>
  );

  const cover = (height?: number) => (
    <View style={height ? { height } : styles.flex}>
      <RouteCover photos={eventPhotos(event)} place={event.end} zoom={15} />
      <View style={[StyleSheet.absoluteFill, styles.shade]} pointerEvents="none" />
      <PhotoChip
        label={t('publicRoute.startAt', { place: event.start_town ?? event.start.label })}
        icon={Flag}
        style={[styles.chip, { bottom: wide ? 24 : 52 }]}
      />
    </View>
  );
  const top = (
    <View style={[styles.top, { top: insets.top + 8 }]} pointerEvents="box-none">
      <GlassButton
        icon={<ChevronLeft size={22} color={colors.text} />}
        onPress={() => router.back()}
        label={t('common.back')}
      />
      <GlassButton
        icon={<ShareIcon size={20} color={colors.text} />}
        onPress={share}
        label={t('summary.share')}
      />
    </View>
  );

  if (wide) {
    return (
      <View style={[styles.screen, styles.row, { backgroundColor: colors.background }]}>
        <View style={styles.flex}>
          {cover()}
          {top}
        </View>
        <View style={[styles.panel, { backgroundColor: colors.surface }, shadows.floating]}>
          <ScrollView contentContainerStyle={styles.panelContent}>{body}</ScrollView>
          <View style={styles.panelFooter}>{action}</View>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        {cover(300)}
        <View style={[styles.sheet, { backgroundColor: colors.surface }, shadows.sheet]}>
          {body}
        </View>
      </ScrollView>
      {top}
      {action ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + 12, backgroundColor: colors.surface },
          ]}
        >
          {action}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
  shade: {
    backgroundImage:
      'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 55%, rgba(20,10,6,0.45) 92%)',
  },
  chip: { position: 'absolute', left: 20 },
  top: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheet: {
    marginTop: -34,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingTop: 22,
    paddingHorizontal: 20,
    gap: 14,
  },
  when: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whenText: { fontFamily: fonts.textSemiBold, fontSize: 14.5, textTransform: 'capitalize' },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 31, letterSpacing: -0.8 },
  small: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  countdown: { flexDirection: 'row', gap: 8 },
  people: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  peopleTitle: { fontFamily: fonts.textSemiBold, fontSize: 15, fontVariant: ['tabular-nums'] },
  link: { fontFamily: fonts.textSemiBold, fontSize: 14.5 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  panel: { width: 440, margin: 20, borderRadius: 30, overflow: 'hidden' },
  panelContent: { padding: 26, gap: 14 },
  panelFooter: { padding: 22, paddingTop: 8 },
});
