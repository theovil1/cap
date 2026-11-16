import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import {
  ChevronDown,
  Flag,
  Footprints,
  Gauge,
  LocateFixed,
  MapPin,
  PanelRightClose,
  PanelRightOpen,
  TvMinimalPlay,
  X,
  TrendingUp,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/api/auth';
import { useActiveJourney } from '@/api/queries';
import {
  formatDuration,
  formatKm,
  formatNumber,
  formatPace,
  formatRank,
  formatSpeed,
} from '@/i18n/format';
import { journeyTitle } from '@/journey/names';
import { nextStage, paceMinPerKm, stepsFor } from '@/journey/progress';
import { rivalPawns, useRacers } from '@/live/use-racers';
import { MapKindButton } from '@/map/map-kind-button';
import { RouteMap } from '@/map/route-map';
import { useSession } from '@/session/session-context';
import { MusicCard, MusicPill } from '@/music/music-player';
import { useMusic } from '@/music/use-music';
import { GoalTile } from '@/session/goal-tile';
import { HeartTile } from '@/heart/heart-tile';
import { useDayStats } from '@/session/stats';
import { useVideoTip } from '@/session/video-tip';
import { getValue, pendingSessions, setValue } from '@/session/store';
import { fonts, useColors, type Colors } from '@/theme';
import { useWide } from '@/ui/layout';
import { useWindowControlsInset } from '@/ui/window-controls';
import { Avatar, Button, Figure, Glass, GlassButton, Label, ProgressBar } from '@/ui/primitives';
import { ConfettiBurst } from '@/ui/confetti-burst';
import { Sheet } from '@/ui/sheet';

/** Height of the top bar (minimise button, journey and place) over the map. */
const TOP_BAR_H = 64;

export default function SessionScreen() {
  useKeepAwake();
  const { t } = useTranslation();
  const colors = useColors();
  const controls = useWindowControlsInset();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const { user } = useAuth();
  const { connection, data, live, finishNow } = useSession();
  const { summary, detail } = useActiveJourney();
  // The camera stops following the pawn while the walker looks around.
  const [following, setFollowing] = useState(true);
  // Phone: the sheet snaps to a single line, the big figures, or everything.
  const [stops, setStops] = useState({ minimal: 0, compact: 0 });
  const [sheet, setSheet] = useState({ index: 2, height: 0 });
  const onSheetChange = useCallback(
    (index: number, height: number) => setSheet({ index, height }),
    [],
  );
  // iPad: the side panel can be hidden for a full-size map.
  const [panelHidden, setPanelHidden] = useState(false);
  const bottomOf = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    return y + height + insets.bottom + 14;
  };
  const minimal = !wide && sheet.index === 0;

  const sessionM = live?.distanceM ?? 0;
  const steps = stepsFor(sessionM, user?.stride_cm);
  const day = useDayStats(sessionM, steps);
  const goal = user?.daily_step_goal ?? 7000;
  // Sessions not synced yet already count for the pawn.
  const unsyncedM = pendingSessions().reduce((sum, s) => sum + s.distanceM, 0);
  const total = summary?.route_distance_m ?? 0;
  const walked = summary ? Math.min(total, summary.distance_m + unsyncedM + sessionM) : 0;
  const stage = detail ? nextStage(detail.stages, walked) : null;
  const racers = useRacers(detail, walked);
  const me = racers.find((r) => r.me);
  const gap = (m: number) => `${m >= 0 ? '+' : '−'}${formatKm(Math.abs(m))} ${t('units.km')}`;
  const rivals = rivalPawns(racers, gap);
  // iPad: the first rival walking right now gets a card in the panel.
  const walking = racers.find((r) => !r.me && (r.speedKmh ?? 0) > 0);
  const marks = (detail?.stages ?? [])
    .filter((s) => s.position > 0 && s.at_m < total)
    .map((s) => s.at_m / total);
  const speed = data?.speedKmh ?? 0;
  const name = connection.deviceName ?? t('treadmill.unknownName');
  const connected = connection.status === 'connected';

  // Steps per minute, from the speed and the stride (the treadmill does not count steps).
  const strideM = (user?.stride_cm && user.stride_cm > 0 ? user.stride_cm : 70) / 100;
  const stepsPerMinute = live && speed > 0 ? (speed / 3.6 / strideM) * 60 : 0;
  const reached = day.todaySteps >= goal;
  const [celebrating, setCelebrating] = useState(false);
  const wasReached = useRef(reached);
  useEffect(() => {
    // Confetti once a day, when the goal is passed during a session.
    const today = new Date().toDateString();
    if (reached && !wasReached.current && live && getValue<string>(GOAL_KEY) !== today) {
      setValue(GOAL_KEY, today);
      setCelebrating(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    wasReached.current = reached;
  }, [reached, live]);
  const endCelebration = useCallback(() => setCelebrating(false), []);

  const music = useMusic();
  // iPad: how to watch a video in another app next to the session.
  const videoTip = useVideoTip();

  const tiles: [ReactNode, string, string, string?][] = [
    [
      <Gauge key="pace" size={15} color={colors.textSecondary} />,
      t('session.pace'),
      formatPace(paceMinPerKm(speed)),
      t('units.pace'),
    ],
    [
      <TrendingUp key="incline" size={15} color={colors.textSecondary} />,
      t('session.incline'),
      formatNumber(data?.inclinePct ?? 0),
      '%',
    ],
    [
      <Footprints key="steps" size={15} color={colors.textSecondary} />,
      t('session.steps'),
      formatNumber(steps),
    ],
  ];
  if (wide) tiles.splice(1, 0, tiles.splice(2, 1)[0]);

  const content = (
    <>
      <View
        style={styles.statusRow}
        onLayout={(e) => {
          const minimalH = bottomOf(e);
          setStops((old) => ({ ...old, minimal: minimalH }));
        }}
      >
        <View style={styles.inline}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: connected ? colors.success : colors.textMuted },
              connected && { boxShadow: `0 0 0 4px ${colors.successSoft}` },
            ]}
          />
          {minimal ? (
            <Text style={[styles.status, { color: colors.text }]} numberOfLines={1}>
              {formatKm(sessionM, 2)} {t('units.km')}
              {'  ·  '}
              <Text style={{ color: colors.accentText }}>
                {formatSpeed(speed)} {t('units.kmh')}
              </Text>
            </Text>
          ) : (
            <Text style={[styles.status, { color: colors.textSecondary }]} numberOfLines={1}>
              {t(`treadmill.status.${connection.status}`, { name })}
            </Text>
          )}
        </View>
        <Text style={[styles.status, { color: colors.textSecondary }]}>
          {formatDuration((live?.movingMs ?? 0) / 1000)}
        </Text>
      </View>

      <View
        style={wide ? { gap: 18 } : styles.bigRow}
        onLayout={(e) => {
          const compactH = bottomOf(e);
          setStops((old) => ({ ...old, compact: compactH }));
        }}
      >
        <View style={{ gap: 8, flexShrink: 1 }}>
          <Label style={wide && styles.labelWide}>{t('session.today')}</Label>
          <Figure
            value={formatKm(sessionM, 2)}
            unit={t('units.km')}
            size={wide ? 140 : 82}
            unitSize={wide ? 34 : undefined}
          />
        </View>
        <SpeedBlock
          wide={wide}
          speed={speed}
          colors={colors}
          label={t('session.speed')}
          unit={t('units.kmh')}
        />
      </View>
      {!live && (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('session.waiting')}</Text>
      )}

      <View style={[styles.tiles, wide && styles.tilesWide]}>
        {tiles.map(([icon, label, value, unit]) => (
          <View
            key={label}
            style={[
              styles.tile,
              styles.tileHalf,
              { backgroundColor: colors.inset },
              wide && styles.tileWide,
            ]}
          >
            <View style={styles.inline}>
              {icon}
              <Text
                style={[
                  styles.tileLabel,
                  wide && styles.tileLabelWide,
                  { color: colors.textSecondary },
                ]}
              >
                {label}
              </Text>
            </View>
            <Figure
              value={value}
              unit={unit}
              size={wide ? 30 : 24}
              unitSize={wide ? 16 : undefined}
            />
          </View>
        ))}
        <GoalTile
          steps={day.todaySteps}
          goal={goal}
          stepsPerMinute={stepsPerMinute}
          wide={wide}
          style={[styles.tile, styles.tileHalf, wide && styles.tileWide]}
        />
        <HeartTile wide={wide} />
      </View>

      {wide && walking && me ? (
        <View style={[styles.rival, { borderColor: colors.border }]}>
          <Avatar name={walking.firstName} tone="other" size={40} />
          <View style={styles.rivalText}>
            <Text style={[styles.rivalName, { color: colors.text }]} numberOfLines={1}>
              {t('session.rivalWalking', { name: walking.firstName })}
            </Text>
            <Text style={[styles.caption, { color: colors.textSecondary }]} numberOfLines={1}>
              {t(walking.distanceM >= me.distanceM ? 'session.rivalAhead' : 'session.rivalBehind', {
                km: formatKm(Math.abs(walking.distanceM - me.distanceM)),
              })}
              {' · '}
              {formatSpeed(walking.speedKmh ?? 0)} {t('units.kmh')}
            </Text>
          </View>
        </View>
      ) : null}
      {wide && <View style={{ flex: 1 }} />}
      {wide && music.visible ? <MusicCard music={music} /> : null}
      {summary && (
        <View style={{ gap: wide ? 10 : 9 }}>
          <ProgressBar ratio={walked / total} marks={marks} height={wide ? 10 : 8} />
          <View
            style={styles.progressRow}
            accessible
            accessibilityLabel={`${formatKm(walked)} ${t('units.km')} ${t('session.fromStart', {
              place: summary.start_town ?? '',
            })}, ${t('session.toEnd', { place: summary.end_town ?? '', km: formatKm(total - walked) })}`}
          >
            <View style={styles.inline}>
              <MapPin size={wide ? 16 : 15} color={colors.textSecondary} strokeWidth={2.2} />
              <Text
                style={[
                  styles.caption,
                  wide && styles.captionWide,
                  styles.barKm,
                  { color: colors.text },
                ]}
              >
                {formatKm(walked)} {t('units.km')}
              </Text>
            </View>
            <View style={styles.inline}>
              <Text
                style={[
                  styles.caption,
                  wide && styles.captionWide,
                  { color: colors.textSecondary },
                ]}
              >
                {formatKm(total - walked)} {t('units.km')}
              </Text>
              <Flag size={wide ? 16 : 15} color={colors.text} strokeWidth={2.2} />
            </View>
          </View>
        </View>
      )}
      {live && (
        <Button tone="light" size="medium" title={t('session.finish')} onPress={finishNow} />
      )}
    </>
  );

  const mapButtons = detail && (
    <>
      {!following && (
        <GlassButton
          icon={<LocateFixed size={21} color={colors.text} />}
          onPress={() => setFollowing(true)}
          label={t('map.recenter')}
        />
      )}
      {wide && <MapKindButton />}
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.inset }]}>
      {celebrating ? <ConfettiOverlay onDone={endCelebration} /> : null}
      {detail ? (
        <RouteMap
          path={detail.path}
          walkedM={walked}
          mode="follow"
          speedMps={live ? speed / 3.6 : 0}
          rivals={rivals}
          following={following}
          onUserMove={() => setFollowing(false)}
          initial={user?.first_name}
          padding={
            wide
              ? { top: insets.top + TOP_BAR_H, right: panelHidden ? 0 : 440 }
              : { top: insets.top + TOP_BAR_H, bottom: sheet.height || 360 }
          }
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noJourney]}>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {t('session.noJourney')}
          </Text>
        </View>
      )}

      <View
        style={[
          styles.top,
          wide
            ? { top: 28 + controls, left: 28, right: panelHidden ? 28 : 448, gap: 14 }
            : { top: insets.top + 8, right: 20 },
        ]}
      >
        <GlassButton
          icon={<ChevronDown size={22} color={colors.text} />}
          onPress={() => router.back()}
          label={t('session.minimize')}
        />
        {summary && (
          <Glass style={[styles.titleChip, !wide && styles.grow]}>
            <Text
              style={[styles.titleText, wide && styles.titleTextWide, { color: colors.text }]}
              numberOfLines={1}
            >
              {journeyTitle(summary)}
            </Text>
            {me && racers.length > 1 ? (
              <View style={[styles.place, { backgroundColor: colors.accent }]}>
                <Text style={[styles.placeText, { color: colors.onAccent }]}>
                  {formatRank(me.place)}
                </Text>
              </View>
            ) : null}
          </Glass>
        )}
        {wide && stage ? (
          <Glass style={[styles.stageChip, styles.stageWide, styles.stageChipWide]}>
            <Flag size={16} color={colors.blueText} strokeWidth={2.2} />
            <Text style={[styles.stageText, { color: colors.text }]} numberOfLines={1}>
              {t('session.stageIn', { name: stage.name, km: formatKm(stage.at_m - walked) })}
            </Text>
          </Glass>
        ) : null}
        {!wide && detail ? <MapKindButton /> : null}
      </View>
      {wide && videoTip.shown ? (
        <View
          style={[styles.tipSpot, { top: 28 + controls + 50, right: panelHidden ? 28 : 448 }]}
          pointerEvents="box-none"
        >
          <Glass style={[styles.stageChip, styles.tipChip]}>
            <Pressable
              onPress={() => router.push('/video-tip')}
              accessibilityRole="button"
              accessibilityLabel={t('videoTip.open')}
              style={styles.tipOpen}
            >
              <TvMinimalPlay size={16} color={colors.accentText} strokeWidth={2.2} />
              <Text style={[styles.stageText, { color: colors.text }]}>{t('videoTip.pill')}</Text>
            </Pressable>
            <View style={[styles.tipLine, { backgroundColor: colors.border }]} />
            <Pressable
              onPress={videoTip.hide}
              accessibilityRole="button"
              accessibilityLabel={t('videoTip.close')}
              style={styles.tipClose}
              hitSlop={6}
            >
              <X size={13} color={colors.textSecondary} strokeWidth={2.6} />
            </Pressable>
          </Glass>
        </View>
      ) : null}
      {!wide && stage ? (
        <Glass style={[styles.stageChip, styles.stagePhone, { top: insets.top + 72 }]}>
          <Flag size={15} color={colors.blueText} strokeWidth={2.2} />
          <Text style={[styles.stageSmall, { color: colors.text }]} numberOfLines={1}>
            {t('session.stageShort', { km: formatKm(stage.at_m - walked) })}
          </Text>
        </Glass>
      ) : null}
      {wide ? (
        <>
          <View
            style={[
              styles.mapButtons,
              { bottom: insets.bottom + 20, right: wide && !panelHidden ? 460 : 20 },
            ]}
          >
            {mapButtons}
            <GlassButton
              icon={
                panelHidden ? (
                  <PanelRightOpen size={21} color={colors.text} />
                ) : (
                  <PanelRightClose size={21} color={colors.text} />
                )
              }
              onPress={() => setPanelHidden((hidden) => !hidden)}
              label={t(panelHidden ? 'session.showPanel' : 'session.hidePanel')}
            />
          </View>
          {!panelHidden && (
            <View
              style={[
                styles.panel,
                styles.panelWide,
                {
                  backgroundColor: colors.surface,
                  shadowColor: colors.shadow,
                  top: 20,
                  bottom: 20,
                },
              ]}
            >
              {/* Scrolls when the tiles, the rival and the progress do not all fit. */}
              <ScrollView
                style={[styles.panelScroll, styles.panelScrollWide]}
                contentContainerStyle={[styles.panelContent, styles.panelContentWide]}
                showsVerticalScrollIndicator={false}
              >
                {content}
              </ScrollView>
            </View>
          )}
        </>
      ) : (
        <Sheet
          stops={[stops.minimal, stops.compact]}
          onChange={onSheetChange}
          grabberColor={colors.track}
          grabberLabel={t('session.resizePanel')}
          above={
            <View style={styles.above} pointerEvents="box-none">
              <View style={[styles.mapButtons, styles.mapButtonsPhone]}>{mapButtons}</View>
              {music.visible ? <MusicPill music={music} /> : null}
            </View>
          }
          style={[
            styles.panel,
            {
              backgroundColor: colors.surface,
              shadowColor: colors.shadow,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {content}
        </Sheet>
      )}
    </View>
  );
}

function SpeedBlock({
  wide,
  speed,
  colors,
  label,
  unit,
}: {
  wide: boolean;
  speed: number;
  colors: Colors;
  label: string;
  unit: string;
}) {
  if (wide) {
    return (
      <View style={[styles.speedWide, { backgroundColor: colors.accentSoft }]}>
        <Text style={[styles.tileLabel, { color: colors.text, fontSize: 15 }]}>{label}</Text>
        <Figure
          value={formatSpeed(speed)}
          unit={unit}
          size={48}
          unitSize={18}
          color={colors.accentText}
        />
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'flex-end', gap: 6, paddingBottom: 6 }}>
      <Label>{label}</Label>
      <Figure value={formatSpeed(speed)} unit={unit} size={32} color={colors.accentText} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  noJourney: { alignItems: 'center', justifyContent: 'center', padding: 40, paddingBottom: 380 },
  top: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  grow: { flex: 1 },
  titleChip: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 20,
  },
  titleText: {
    flexShrink: 1,
    fontFamily: fonts.textSemiBold,
    fontSize: 14.5,
    letterSpacing: -0.15,
  },
  place: { height: 22, paddingHorizontal: 8, borderRadius: 999, justifyContent: 'center' },
  placeText: { fontFamily: fonts.display, fontSize: 12 },
  stageChip: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 18,
  },
  stageWide: { marginLeft: 'auto' },
  stagePhone: { position: 'absolute', right: 20, height: 32, paddingHorizontal: 12, gap: 7 },
  stageSmall: { fontFamily: fonts.textSemiBold, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  rival: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
  },
  rivalText: { flex: 1, gap: 2 },
  rivalName: { fontFamily: fonts.textSemiBold, fontSize: 15 },
  mapButtons: { position: 'absolute', gap: 10, alignItems: 'flex-end' },
  mapButtonsPhone: {
    position: 'relative',
    alignSelf: 'flex-end',
  },
  above: { gap: 10, paddingHorizontal: 20, marginBottom: 12 },
  stageText: {
    flexShrink: 1,
    fontFamily: fonts.textSemiBold,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  panel: {
    gap: 18,
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 1,
    shadowRadius: 40,
  },
  panelScroll: { flex: 1, marginHorizontal: -20 },
  panelScrollWide: { marginHorizontal: -20 },
  panelContentWide: { paddingHorizontal: 26, paddingBottom: 26 },
  labelWide: { fontSize: 15, fontFamily: fonts.textSemiBold },
  tilesWide: { gap: 10 },
  tileLabelWide: { fontSize: 14 },
  captionWide: { fontSize: 14 },
  titleTextWide: { fontSize: 16 },
  stageChipWide: { height: 40, paddingHorizontal: 14 },
  tipSpot: { position: 'absolute', alignItems: 'flex-end' },
  tipChip: { height: 40, paddingHorizontal: 0, gap: 0 },
  tipOpen: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 10,
  },
  tipLine: { width: StyleSheet.hairlineWidth, height: 16 },
  tipClose: { height: 40, width: 38, alignItems: 'center', justifyContent: 'center' },
  panelContent: { flexGrow: 1, gap: 18, paddingHorizontal: 20, paddingBottom: 22 },
  right: { textAlign: 'right' },
  panelWide: {
    overflow: 'hidden',
    position: 'absolute',
    right: 20,
    width: 404,
    paddingTop: 26,
    borderRadius: 34,
    borderCurve: 'continuous',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 99, marginRight: 2 },
  status: { fontFamily: fonts.textSemiBold, fontSize: 13, fontVariant: ['tabular-nums'] },
  bigRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  hint: { fontFamily: fonts.textMedium, fontSize: 14.5, textAlign: 'center' },
  speedWide: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 22,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flex: 1, minWidth: 96, gap: 8, padding: 14, paddingBottom: 13, borderRadius: 20 },
  tileHalf: { flexBasis: '45%' },
  barKm: { fontFamily: fonts.textSemiBold },
  tileWide: { flexBasis: '45%', padding: 18, paddingBottom: 18, gap: 10, borderRadius: 22 },
  tileLabel: { fontFamily: fonts.textMedium, fontSize: 12.5 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  caption: { fontFamily: fonts.text, fontSize: 12.5, fontVariant: ['tabular-nums'], flexShrink: 1 },
});

/** Kept for the day the goal was last celebrated, so confetti falls once. */
const GOAL_KEY = 'goalCelebrated';

/** Above the map and the panel, without taking touches. */
function ConfettiOverlay({ onDone }: { onDone: () => void }) {
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 50 }]} pointerEvents="none">
      <ConfettiBurst onDone={onDone} />
    </View>
  );
}
