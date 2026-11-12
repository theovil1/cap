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

import { useMapStyle } from './style';

/**
 * - `follow`: 3D camera behind the pawn (live session).
 * - `card`: a small tilted view around the pawn (home card), not interactive.
 * - `overview`: the whole route from above with its stages (preview).
 */
export type MapMode = 'follow' | 'card' | 'overview';

const FOLLOW_ZOOM = 16.6;
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
  const heading = headingAt(path, walkedM);

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
        ? following && !touching
          ? {
              // No camera padding here: see followCenter.
              center: followCenter(
                pawn,
                { heading, zoom: followZoom, pitch: FOLLOW_PITCH, height: screenH },
                {
                  top: padding?.top ?? 0,
                  bottom: padding?.bottom ?? 0,
                  right: padding?.right ?? 0,
                },
              ),
              zoom: followZoom,
              pitch: FOLLOW_PITCH,
              bearing: heading,
              padding: { top: 0, bottom: 0, left: 0, right: 0 },
              duration: 900,
              easing: 'linear' as const,
            }
          : {}
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
      <Camera {...camera} />
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
      <ViewAnnotation id="pawn" lngLat={pawn} anchor="center">
        <Pawn initial={initial ?? ''} />
      </ViewAnnotation>
    </Map>
  );
}

function Pawn({ initial }: { initial: string }) {
  const colors = useColors();
  return (
    <View style={styles.pawnArea} pointerEvents="none">
      <View style={[styles.halo, { backgroundColor: colors.accent }]} />
      <View style={[styles.pawn, { backgroundColor: colors.accent, borderColor: colors.surface }]}>
        <Text style={[styles.initial, { color: colors.onAccent }]}>
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
});
