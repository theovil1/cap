import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useEvent, useLiveStandings, usePublicRoute, useRegister } from '@/api/community';
import type { Standing } from '@/api/types';
import { formatKm, formatNumber } from '@/i18n/format';
import type { Rival } from '@/map/route-map';
import { RouteMap } from '@/map/route-map';
import { fonts, useColors, useShadows } from '@/theme';
import { useWide } from '@/ui/layout';
import { LivePill } from '@/ui/pills';
import { Avatar, Button, Glass, GlassButton, ProgressBar } from '@/ui/primitives';
import { RankRow } from '@/ui/stats';

/** Big pawns: my friends, then the three leaders; everyone else is a dot. */
function pawns(leaders: Standing[], friends: Standing[], me: string | undefined): Rival[] {
  const seen = new Set<string>();
  return [...friends, ...leaders.slice(0, 3)]
    .filter((s) => s.walker.id !== me && !seen.has(s.walker.id) && seen.add(s.walker.id))
    .map((s) => ({
      id: s.walker.id,
      initial: s.walker.first_name,
      distanceM: s.distance_m,
      speedMps: (s.speed_kmh ?? 0) / 3.6,
      label: s.walker.first_name,
    }));
}

/** A scheduled journey live: everyone on the map, my place and the leaders. */
export default function EventLiveScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const shadows = useShadows();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event } = useEvent(id);
  const { data: route } = usePublicRoute(event?.public_route_id);
  const { data: standings } = useLiveStandings(id);
  const register = useRegister();
  const me = standings?.me ?? null;
  // The server counts my session under way too (live progress).
  const myM = me?.distance_m ?? 0;
  const total = standings?.route_distance_m ?? route?.distance_m ?? 1;
  const gained = me && standings?.my_rank_before ? standings.my_rank_before - me.rank : 0;

  const leaderRows = (standings?.leaders ?? []).slice(0, 3);
  const showMe = me && !leaderRows.some((s) => s.walker.id === me.walker.id);

  const panel = (
    <>
      {me ? (
        <>
          <View style={styles.head}>
            <View>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('events.yourPlace')}
              </Text>
              <Text style={[styles.place, { color: colors.text }]}>
                {formatNumber(me.rank)}
                <Text style={[styles.of, { color: colors.textSecondary }]}>
                  {' '}
                  {t('race.of', { count: standings?.registered ?? 0 })}
                </Text>
              </Text>
            </View>
            <View style={styles.right}>
              {gained !== 0 ? (
                <Text style={[styles.gain, { color: gained > 0 ? colors.success : colors.danger }]}>
                  {t(gained > 0 ? 'events.gained' : 'events.lost', {
                    count: Math.abs(gained),
                  })}
                </Text>
              ) : null}
              <Text style={[styles.small, { color: colors.textSecondary }]}>
                {t('events.kmOf', { walked: formatKm(myM), total: formatKm(total) })}
              </Text>
            </View>
          </View>
          <ProgressBar ratio={myM / total} height={8} />
        </>
      ) : event && event.state !== 'ended' ? (
        <Button
          tone="accent"
          title={t('events.join')}
          onPress={() => register.mutate({ id: event.id, on: true })}
          loading={register.isPending}
        />
      ) : null}
      <View style={{ gap: 2 }}>
        {leaderRows.map((s, i) => (
          <RankRow
            key={s.walker.id}
            compact
            first={i === 0}
            me={s.walker.id === me?.walker.id}
            rank={s.rank}
            name={s.walker.id === me?.walker.id ? t('rankings.you') : s.walker.first_name}
            value={formatKm(s.distance_m)}
            unit={t('units.km')}
            avatar={
              <Avatar
                name={s.walker.first_name}
                seed={s.walker.id}
                photo={s.walker.avatar_url}
                tone={s.walker.id === me?.walker.id ? 'accent' : 'walker'}
                size={30}
              />
            }
          />
        ))}
        {showMe && me ? (
          <RankRow
            compact
            me
            rank={me.rank}
            name={t('rankings.you')}
            value={formatKm(me.distance_m)}
            unit={t('units.km')}
            avatar={<Avatar name={me.walker.first_name} photo={me.walker.avatar_url} size={30} />}
          />
        ) : null}
      </View>
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.inset }]}>
      {route ? (
        <RouteMap
          path={route.path}
          walkedM={myM}
          stages={route.stage_list}
          mode="overview"
          initial={me?.walker.first_name}
          rivals={pawns(standings?.leaders ?? [], standings?.friends ?? [], me?.walker.id)}
          crowd={standings?.others_m ?? []}
          padding={
            wide
              ? { top: insets.top + 90, bottom: 40, left: 40, right: 470 }
              : { top: insets.top + 90, bottom: 380, left: 40, right: 40 }
          }
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View
        style={[styles.top, { top: insets.top + 8, right: wide ? 470 : 20 }]}
        pointerEvents="box-none"
      >
        <GlassButton
          icon={<ChevronDown size={22} color={colors.text} />}
          onPress={() => router.back()}
          label={t('common.close')}
        />
        <Glass style={styles.titleBar}>
          <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>
            {event?.title ?? ''}
          </Text>
          <LivePill label={formatNumber(standings?.walking_now ?? 0)} large />
        </Glass>
      </View>
      <View
        style={[
          wide ? styles.panelWide : styles.sheet,
          { backgroundColor: colors.surface },
          wide
            ? { top: insets.top + 20, bottom: insets.bottom + 20 }
            : { paddingBottom: insets.bottom + 16 },
          shadows.sheet,
        ]}
      >
        <ScrollView contentContainerStyle={styles.panelContent} scrollEnabled={wide}>
          {!wide && <View style={[styles.grabber, { backgroundColor: colors.track }]} />}
          {panel}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { position: 'absolute', left: 20, flexDirection: 'row', gap: 12, alignItems: 'center' },
  titleBar: {
    flex: 1,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 18,
    paddingRight: 8,
    gap: 10,
  },
  titleText: { flexShrink: 1, fontFamily: fonts.textSemiBold, fontSize: 14.5 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
  },
  panelWide: { position: 'absolute', right: 20, width: 420, borderRadius: 30, overflow: 'hidden' },
  panelContent: { padding: 20, paddingTop: 10, gap: 14 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 99, marginBottom: 4 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  label: { fontFamily: fonts.textSemiBold, fontSize: 13 },
  place: {
    fontFamily: fonts.display,
    fontSize: 52,
    letterSpacing: -1.8,
    fontVariant: ['tabular-nums'],
  },
  of: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 0 },
  right: { alignItems: 'flex-end', gap: 2, paddingBottom: 8 },
  gain: { fontFamily: fonts.textSemiBold, fontSize: 13.5 },
  small: { fontFamily: fonts.text, fontSize: 13, fontVariant: ['tabular-nums'] },
});
