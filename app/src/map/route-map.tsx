import { Camera, GeoJSONSource, Layer, Map, ViewAnnotation } from '@maplibre/maplibre-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { Stage } from '@/api/types';
import {
  bounds,
  followCenter,
  headingAt,
  positionAt,
  simplify,
  splitAt,
  type RoutePoint,
} from '@/journey/route';
import { fonts, useColors } from '@/theme';
import { Glass } from '@/ui/primitives';

import { useSmoothDistance } from '@/journey/smooth';

import { useMapStyle } from './style';

/**
 * - `follow`: 3D camera behind the pawn (live session).
 * - `card`: a small tilted view around the pawn (home card), not interactive.
 * - `overview`: the whole route from above with its stages (preview).
 */
export type MapMode = 'follow' | 'card' | 'overview';

const FOLLOW_ZOOM = 17.6;
const FOLLOW_PITCH = 60;

type Props = {
  path: RoutePoint[];
  walkedM: number;
  mode: MapMode;
  stages?: Stage[];
  initial?: string;
  padding?: { top?: number; bottom?: number; left?: number; right?: number };
  style?: StyleProp<ViewStyle>;
  /** In `follow` mode, false leaves the camera where the walker moved it. */
  following?: boolean;
  /** Called when the walker drags the map away (a pinch only zooms). */
  onUserMove?: () => void;
  /** Treadmill speed: in `follow` mode the pawn keeps walking between frames. */
  speedMps?: number;
  /** Other walkers of a race, drawn as blue pawns. */
  rivals?: Rival[];
  /** Distances of many other walkers (a scheduled journey), drawn as small dots. */
  crowd?: number[];
};

export type Rival = {
  id: string;
  initial: string;
  distanceM: number;
  speedMps: number;
  /** Gap to me in a glass bubble above the pawn: "+2,4 km". */
  label?: string;
};

export function RouteMap({
  path,
  walkedM,
  mode,
  stages = [],
  initial,
  padding,
  style,
  following = true,
  onUserMove,
  speedMps = 0,
  rivals = [],
  crowd = [],
}: Props) {
  const colors = useColors();
  const mapStyle = useMapStyle();
  const { height: screenH } = useWindowDimensions();
  // While a finger is on the map the camera holds still; a pinch keeps following.
  const [touching, setTouching] = useState(false);
  // Read by the map events, which may arrive before the next render.
  const gesture = useRef(false);
  const [followZoom, setFollowZoom] = useState(FOLLOW_ZOOM);
  // Long routes are lightened for the overview; the session keeps every point.
  const shown = useMemo(() => (mode === 'overview' ? simplify(path, 60) : path), [path, mode]);
  const { walked, left } = useMemo(() => splitAt(shown, walkedM), [shown, walkedM]);
  const pawn = positionAt(path, walkedM);

  const lines = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { part: 'left' },
          geometry: { type: 'LineString', coordinates: left },
        },
        {
          type: 'Feature',
          properties: { part: 'walked' },
          geometry: { type: 'LineString', coordinates: walked },
        },
      ],
    }),
    [walked, left],
  );
  const stagePoints = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      // No dot under the pawn: it already marks where the walker stands.
      features: stages
        .filter((s) => Math.abs(s.at_m - walkedM) > 1)
        .map((s) => ({
          type: 'Feature',
          properties: {
            passed: s.at_m <= walkedM,
            end: s.position === 0 || s.at_m >= path.at(-1)![2],
          },
          geometry: { type: 'Point', coordinates: positionAt(path, s.at_m) },
        })),
    }),
    [stages, walkedM, path],
  );

  if (!mapStyle || path.length < 2)
    return <View style={[{ backgroundColor: colors.inset }, style]} />;

  const [west, south, east, north] = bounds(shown);
  const camera =
    mode === 'overview'
      ? {
          bounds: [west, south, east, north] as [number, number, number, number],
          padding,
          duration: 800,
        }
      : mode === 'follow'
        ? null
        : {
            center: pawn,
            zoom: 15.2,
            pitch: 52,
            bearing: 0,
            padding,
            duration: 900,
            easing: 'linear' as const,
          };
  const interactive = mode !== 'card';

  return (
    <Map
      style={style}
      mapStyle={mapStyle}
      attribution
      attributionPosition={{ bottom: 8, left: 8 }}
      logo={false}
      compass={false}
      scaleBar={false}
      dragPan={interactive}
      touchZoom={interactive}
      touchRotate={interactive}
      touchPitch={interactive}
      doubleTapZoom={interactive}
      onRegionWillChange={(event) => {
        if (mode === 'follow' && following && event.nativeEvent.userInteraction) {
          gesture.current = true;
          setTouching(true);
        }
      }}
      onRegionDidChange={(event) => {
        if (!gesture.current) return;
        gesture.current = false;
        setTouching(false);
        const { zoom } = event.nativeEvent;
        if (Math.abs(zoom - followZoom) > 0.05) setFollowZoom(zoom);
        else onUserMove?.();
      }}
    >
      {camera ? (
        <Camera {...camera} />
      ) : (
        <FollowCamera
          path={path}
          walkedM={walkedM}
          speedMps={speedMps}
          active={following && !touching}
          zoom={followZoom}
          screenH={screenH}
          padding={padding}
          initial={initial ?? ''}
        />
      )}
      <GeoJSONSource id="route" data={lines}>
        <Layer
          id="route-left"
          type="line"
          filter={['==', ['get', 'part'], 'left']}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': colors.blue,
            'line-width': mode === 'overview' ? 4 : 6,
            'line-dasharray': [0.1, 2],
          }}
        />
        <Layer
          id="route-walked"
          type="line"
          filter={['==', ['get', 'part'], 'walked']}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': colors.accent, 'line-width': mode === 'overview' ? 5 : 8 }}
        />
      </GeoJSONSource>
      {mode === 'overview' && (
        <GeoJSONSource id="stages" data={stagePoints}>
          <Layer
            id="stage-dots"
            type="circle"
            paint={{
              'circle-radius': ['case', ['get', 'end'], 7, 5],
              'circle-color': colors.surface,
              'circle-stroke-width': ['case', ['get', 'end'], 3, 2],
              'circle-stroke-color': [
                'case',
                ['get', 'passed'],
                colors.accent,
                colors.textSecondary,
              ],
            }}
          />
        </GeoJSONSource>
      )}
      {crowd.length > 0 && (
        <GeoJSONSource
          id="crowd"
          data={{
            type: 'FeatureCollection',
            features: crowd.map((m, i) => ({
              type: 'Feature',
              properties: { tone: i % 3 },
              geometry: { type: 'Point', coordinates: positionAt(path, m) },
            })),
          }}
        >
          <Layer
            id="crowd-dots"
            type="circle"
            paint={{
              'circle-radius': 4.5,
              'circle-color': [
                'match',
                ['get', 'tone'],
                0,
                colors.blue,
                1,
                colors.success,
                colors.accent,
              ],
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#FFFFFF',
            }}
          />
        </GeoJSONSource>
      )}
      {rivals.map((rival) => (
        <RivalPawn key={rival.id} path={path} rival={rival} />
      ))}
      {camera && (
        <ViewAnnotation id="pawn" lngLat={pawn} anchor="center">
          <Pawn initial={initial ?? ''} />
        </ViewAnnotation>
      )}
    </Map>
  );
}

/**
 * Camera and pawn of the live session. They refresh about 30 times a second
 * from the smoothed distance, apart from the rest of the map.
 */
function FollowCamera({
  path,
  walkedM,
  speedMps,
  active,
  zoom,
  screenH,
  padding,
  initial,
}: {
  path: RoutePoint[];
  walkedM: number;
  speedMps: number;
  active: boolean;
  zoom: number;
  screenH: number;
  padding?: Props['padding'];
  initial: string;
}) {
  const shownM = useSmoothDistance(walkedM, speedMps);
  const pawn = positionAt(path, shownM);
  const heading = headingAt(path, shownM);
  const moving = speedMps > 0;
  return (
    <>
      <Camera
        {...(active
          ? {
              // No camera padding here: see followCenter.
              center: followCenter(
                pawn,
                { heading, zoom, pitch: FOLLOW_PITCH, height: screenH },
                {
                  top: padding?.top ?? 0,
                  bottom: padding?.bottom ?? 0,
                  right: padding?.right ?? 0,
                },
              ),
              zoom,
              pitch: FOLLOW_PITCH,
              bearing: heading,
              padding: { top: 0, bottom: 0, left: 0, right: 0 },
              // Short steps while walking, a smooth glide when recentring.
              duration: moving ? 120 : 900,
              easing: 'linear' as const,
            }
          : {})}
      />
      <ViewAnnotation id="pawn" lngLat={pawn} anchor="center">
        <Pawn initial={initial} />
      </ViewAnnotation>
    </>
  );
}

/** A rival walks smoothly too, from the positions heard live. */
function RivalPawn({ path, rival }: { path: RoutePoint[]; rival: Rival }) {
  const shownM = useSmoothDistance(rival.distanceM, rival.speedMps);
  const colors = useColors();
  const at = positionAt(path, shownM);
  return (
    <>
      <ViewAnnotation id={`rival-${rival.id}`} lngLat={at} anchor="center">
        <Pawn initial={rival.initial} rival />
      </ViewAnnotation>
      {rival.label ? (
        <ViewAnnotation
          id={`rival-label-${rival.id}`}
          lngLat={at}
          anchor="bottom"
          offset={[-24, -22]}
        >
          <Glass style={styles.bubble}>
            <View style={[styles.bubbleDot, { backgroundColor: colors.blue }]}>
              <Text style={styles.bubbleInitial}>{rival.initial.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={[styles.bubbleText, { color: colors.text }]}>{rival.label}</Text>
          </Glass>
        </ViewAnnotation>
      ) : null}
    </>
  );
}

function Pawn({ initial, rival = false }: { initial: string; rival?: boolean }) {
  const colors = useColors();
  const color = rival ? colors.blue : colors.accent;
  return (
    <View style={[styles.pawnArea, rival && styles.rivalArea]} pointerEvents="none">
      {!rival && <View style={[styles.halo, { backgroundColor: color }]} />}
      <View
        style={[
          styles.pawn,
          rival && styles.rivalPawn,
          { backgroundColor: color, borderColor: colors.surface },
        ]}
      >
        <Text style={[styles.initial, { color: rival ? '#FFFFFF' : colors.onAccent }]}>
          {initial.charAt(0).toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pawnArea: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 64, height: 64, borderRadius: 999, opacity: 0.18 },
  pawn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: fonts.display, fontSize: 14 },
  rivalArea: { width: 34, height: 34 },
  rivalPawn: { width: 28, height: 28, borderWidth: 2.5 },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingLeft: 5,
    paddingRight: 11,
  },
  bubbleDot: {
    width: 21,
    height: 21,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleInitial: { fontFamily: fonts.display, fontSize: 9, color: '#FFFFFF' },
  bubbleText: { fontFamily: fonts.textSemiBold, fontSize: 12.5, fontVariant: ['tabular-nums'] },
});
