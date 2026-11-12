import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, Check, ChevronLeft, Flag, ShieldCheck, Swords } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/api/auth';
import { keys, useCreateRace, useFriends, useSessions, useStartJourney } from '@/api/queries';
import type { RouteDetail } from '@/api/types';
import { formatDate, formatKm, shortPlace } from '@/i18n/format';
import { DEFAULT_SESSION_M, estimateArrival } from '@/journey/progress';
import { MapKindButton } from '@/map/map-kind-button';
import { RouteMap } from '@/map/route-map';
import { fonts, useColors, useShadows } from '@/theme';
import { Tabs } from '@/ui/controls';
import { HOME } from '@/ui/routes';
import { useWide } from '@/ui/layout';
import { Avatar, Button, Figure, Glass, GlassButton, Label } from '@/ui/primitives';
import { AvatarStack, StatTile } from '@/ui/stats';

/** Average of the last treadmill sessions, or 4.5 km for a new walker. */
function useAverageSessionM(): number {
  const { data = [] } = useSessions();
  const recent = data.filter((s) => s.source === 'treadmill').slice(0, 10);
  if (recent.length < 3) return DEFAULT_SESSION_M;
  return recent.reduce((sum, s) => sum + s.distance_m, 0) / recent.length;
}

export default function PreviewScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const shadows = useShadows();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const { user } = useAuth();
  const { routeId } = useLocalSearchParams<{ routeId: string }>();
  const route = useQueryClient().getQueryData<RouteDetail>(keys.route(routeId));
  const startJourney = useStartJourney();
  const averageM = useAverageSessionM();
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<'solo' | 'race'>('solo');
  const [picked, setPicked] = useState<string[]>([]);
  const createRace = useCreateRace();
  const { data: friendList } = useFriends();
  const friends = friendList?.friends ?? [];

  // The preview lives in memory only: after a restart, start again.
  if (!route) return <Redirect href="/new-journey" />;

  const estimate = estimateArrival(route.distance_m, user?.sessions_per_week ?? 3, averageM);
  const first = route.stages[0]?.name || shortPlace(route.start.label);
  const last = route.stages.at(-1)?.name || shortPlace(route.end.label);

  const start = () => {
    setFailed(false);
    if (mode === 'race') {
      createRace.mutate(
        { route_id: route.id, friend_ids: picked },
        {
          onSuccess: (race) => {
            router.dismissTo(HOME);
            router.push({ pathname: '/race/[id]', params: { id: race.id } });
          },
          onError: () => setFailed(true),
        },
      );
      return;
    }
    startJourney.mutate(route.id, {
      onSuccess: () => router.dismissTo(HOME),
      onError: () => setFailed(true),
    });
  };
  const toggle = (id: string) =>
    setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const sessionsText = t('preview.sessions', { count: estimate.sessions, km: formatKm(averageM) });
  const arrivalText = t('preview.arrival', {
    date: formatDate(estimate.date, { day: 'numeric', month: 'long' }),
  });
  const chosen = friends.filter((f) => picked.includes(f.id));

  const safe = (
    <View style={[styles.safe, { backgroundColor: colors.successSoft }]}>
      <ShieldCheck size={17} color={colors.success} />
      <Text style={[styles.safeText, { color: colors.text }]}>{t('preview.safe')}</Text>
    </View>
  );

  const modes = wide ? (
    <Tabs
      options={[
        { value: 'solo', label: t('preview.solo') },
        { value: 'race', label: t('preview.race') },
      ]}
      value={mode}
      onChange={setMode}
    />
  ) : (
    <View style={[styles.segment, { backgroundColor: colors.inset }]} accessibilityRole="tablist">
      {(['solo', 'race'] as const).map((m) => (
        <Pressable
          key={m}
          onPress={() => setMode(m)}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === m }}
          style={[
            styles.segmentItem,
            mode === m && { backgroundColor: colors.segmentThumb, ...shadows.card },
          ]}
        >
          <Text
            style={[styles.segmentText, { color: mode === m ? colors.text : colors.textSecondary }]}
          >
            {t(`preview.${m}`)}
          </Text>
          {m === 'race' && chosen.length > 0 ? (
            <AvatarStack
              walkers={chosen.map((f) => ({ id: f.id, name: f.first_name, photo: f.avatar_url }))}
              size={20}
              ring={mode === m ? colors.segmentThumb : colors.inset}
            />
          ) : null}
        </Pressable>
      ))}
    </View>
  );

  const friendPicker =
    mode === 'race' &&
    (friends.length === 0 ? (
      <Pressable onPress={() => router.push('/friends')} accessibilityRole="button">
        <Text style={[styles.caption, { color: colors.blueText }]}>{t('preview.noFriends')}</Text>
      </Pressable>
    ) : (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.friends}
      >
        {friends.map((friend) => {
          const on = picked.includes(friend.id);
          return (
            <Pressable
              key={friend.id}
              onPress={() => toggle(friend.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={styles.friend}
            >
              <View>
                <Avatar
                  name={friend.first_name}
                  seed={friend.id}
                  photo={friend.avatar_url}
                  size={46}
                  tone={on ? 'blue' : 'plain'}
                />
                {on && (
                  <View
                    style={[
                      styles.tick,
                      { backgroundColor: colors.blue, borderColor: colors.surface },
                    ]}
                  >
                    <Check size={11} color="#FFFFFF" strokeWidth={3} />
                  </View>
                )}
              </View>
              <Text style={[styles.friendName, { color: colors.text }]} numberOfLines={1}>
                {friend.first_name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    ));

  const action = (
    <>
      {failed && (
        <Text style={[styles.caption, { color: colors.danger }]}>{t('errors.network')}</Text>
      )}
      <Button
        tone="accent"
        title={
          mode === 'race'
            ? t('preview.createRace', { count: picked.length, players: picked.length + 1 })
            : t('preview.start')
        }
        icon={
          mode === 'race' ? (
            <Swords size={20} color={colors.onAccent} />
          ) : (
            <Flag size={20} color={colors.onAccent} />
          )
        }
        onPress={start}
        loading={startJourney.isPending || createRace.isPending}
        disabled={mode === 'race' && picked.length === 0}
      />
    </>
  );

  const stageName = (i: number) => route.stages[i].name || (i === 0 ? first : last);

  const phonePanel = (
    <View
      style={[
        styles.panel,
        { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 },
        shadows.sheet,
      ]}
    >
      <View style={styles.head}>
        <View style={{ gap: 8 }}>
          <Label>{t('preview.walkingRoute')}</Label>
          <Figure value={formatKm(route.distance_m, 0)} unit={t('units.km')} size={56} />
        </View>
        <View style={styles.arrival}>
          <View style={styles.inline}>
            <CalendarDays size={15} color={colors.text} />
            <Text style={[styles.arrivalText, { color: colors.text }]}>{arrivalText}</Text>
          </View>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>{sessionsText}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.stagesScroll}
        contentContainerStyle={styles.stages}
      >
        {route.stages.map((stage, i) => (
          <View key={stage.id} style={styles.stage}>
            <View style={styles.stageTrack}>
              <View
                style={[
                  styles.stageLine,
                  { backgroundColor: i === 0 ? 'transparent' : colors.track },
                ]}
              />
              <View
                style={[
                  styles.stageDot,
                  {
                    borderColor:
                      i === 0
                        ? colors.accent
                        : i === route.stages.length - 1
                          ? colors.text
                          : colors.textMuted,
                    backgroundColor: colors.surface,
                  },
                ]}
              />
              <View
                style={[
                  styles.stageLine,
                  {
                    backgroundColor: i === route.stages.length - 1 ? 'transparent' : colors.track,
                  },
                ]}
              />
            </View>
            <Text style={[styles.stageName, { color: colors.text }]} numberOfLines={2}>
              {stageName(i)}
            </Text>
            <Text style={[styles.stageKm, { color: colors.textMuted }]}>
              {formatKm(stage.at_m, 0)} {t('units.km')}
            </Text>
          </View>
        ))}
      </ScrollView>

      {safe}
      {modes}
      {friendPicker}
      {action}
    </View>
  );

  const widePanel = (
    <View
      style={[
        styles.widePanel,
        { backgroundColor: colors.surface, top: insets.top + 20, bottom: insets.bottom + 20 },
        shadows.floating,
      ]}
    >
      <View style={{ gap: 6 }}>
        <Label>{t('preview.walkingRoute')}</Label>
        <Text style={[styles.wideTitle, { color: colors.text }]} numberOfLines={2}>
          {first} → {last}
        </Text>
      </View>
      <View style={styles.tiles}>
        <StatTile
          label={t('preview.distance')}
          value={formatKm(route.distance_m, 0)}
          unit={t('units.km')}
        />
        <StatTile
          label={t('preview.stagesTile')}
          value={String(Math.max(0, route.stages.length - 1))}
        />
        <StatTile
          label={t('preview.sessionsTile')}
          value={t('preview.about', { count: estimate.sessions })}
        />
      </View>
      {safe}
      <ScrollView style={styles.flex} contentContainerStyle={styles.list}>
        {route.stages.map((stage, i) => {
          const end = i === 0 || i === route.stages.length - 1;
          return (
            <View key={stage.id} style={styles.listRow}>
              <View
                style={[
                  styles.listDot,
                  {
                    borderColor: colors.accent,
                    backgroundColor: end ? colors.accent : colors.surface,
                  },
                ]}
              />
              <Text style={[styles.listName, { color: colors.text }]} numberOfLines={1}>
                {stageName(i)}
              </Text>
              <Text style={[styles.listKm, { color: colors.textSecondary }]}>
                {formatKm(stage.at_m, 0)} {t('units.km')}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ gap: 12 }}>
        <Label>{arrivalText}</Label>
        {modes}
        {friendPicker}
        {action}
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1 }}>
        <RouteMap
          path={route.path}
          walkedM={0}
          stages={route.stages}
          mode="overview"
          initial={user?.first_name}
          padding={
            wide
              ? { top: insets.top + 90, bottom: 40, left: 40, right: 470 }
              : { top: insets.top + 90, bottom: 60, left: 40, right: 40 }
          }
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.top, { top: insets.top + 12 }, wide && styles.topWide]}>
          <GlassButton
            icon={<ChevronLeft size={22} color={colors.text} />}
            onPress={router.back}
            label={t('common.back')}
          />
          {!wide && (
            <Glass style={styles.titlePill}>
              <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>
                {first} → {last}
              </Text>
            </Glass>
          )}
          <MapKindButton />
        </View>
      </View>
      {wide ? widePanel : phonePanel}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  top: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', gap: 10 },
  topWide: { right: 472, justifyContent: 'space-between' },
  titlePill: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  titleText: { fontFamily: fonts.textSemiBold, fontSize: 15 },
  panel: {
    gap: 16,
    paddingTop: 22,
    paddingHorizontal: 20,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    marginTop: -34,
  },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  arrival: { alignItems: 'flex-end', gap: 4, paddingBottom: 4, flexShrink: 1 },
  arrivalText: { fontFamily: fonts.textSemiBold, fontSize: 13, fontVariant: ['tabular-nums'] },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  caption: {
    flexShrink: 1,
    fontFamily: fonts.text,
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
  },
  stagesScroll: { marginHorizontal: -20 },
  stages: { paddingVertical: 2, paddingHorizontal: 16 },
  stage: { width: 78, alignItems: 'center', gap: 6 },
  stageTrack: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  stageLine: { flex: 1, height: 2 },
  stageDot: { width: 12, height: 12, borderRadius: 99, borderWidth: 2.5 },
  stageName: {
    paddingHorizontal: 3,
    fontFamily: fonts.textSemiBold,
    fontSize: 11.5,
    lineHeight: 14,
    textAlign: 'center',
  },
  stageKm: { fontFamily: fonts.text, fontSize: 11, fontVariant: ['tabular-nums'] },
  safe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  safeText: { flex: 1, fontFamily: fonts.text, fontSize: 13.5, lineHeight: 19 },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 18 },
  segmentItem: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  segmentText: { fontFamily: fonts.textSemiBold, fontSize: 15 },
  friends: { gap: 14, paddingVertical: 2 },
  friend: { width: 62, alignItems: 'center', gap: 5 },
  friendName: { fontFamily: fonts.textMedium, fontSize: 12.5 },
  tick: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 19,
    height: 19,
    borderRadius: 99,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  widePanel: {
    position: 'absolute',
    right: 20,
    width: 412,
    gap: 16,
    padding: 26,
    borderRadius: 30,
    borderCurve: 'continuous',
  },
  wideTitle: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -0.9 },
  tiles: { flexDirection: 'row', gap: 8 },
  list: { gap: 12, paddingVertical: 4 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listDot: { width: 16, height: 16, borderRadius: 99, borderWidth: 2 },
  listName: { flex: 1, fontFamily: fonts.textMedium, fontSize: 15 },
  listKm: { fontFamily: fonts.text, fontSize: 13, fontVariant: ['tabular-nums'] },
});
