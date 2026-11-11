import { Camera, GeoJSONSource, Layer, Map, ViewAnnotation } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Stage } from '@/api/types';
import { bounds, headingAt, positionAt, simplify, splitAt, type RoutePoint } from '@/journey/route';
import { fonts, useColors } from '@/theme';

import { useMapStyle } from './style';

/**
 * - `follow`: 3D camera behind the pawn (live session).
 * - `card`: a small tilted view around the pawn (home card), not interactive.
 * - `overview`: the whole route from above with its stages (preview).
 */
export type MapMode = 'follow' | 'card' | 'overview';

type Props = {
  path: RoutePoint[];
  walkedM: number;
  mode: MapMode;
  stages?: Stage[];
  initial?: string;
  padding?: { top?: number; bottom?: number; left?: number; right?: number };
  style?: StyleProp<ViewStyle>;
};

export function RouteMap({ path, walkedM, mode, stages = [], initial, padding, style }: Props) {
  const colors = useColors();
  const mapStyle = useMapStyle();
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
      features: stages.map((s) => ({
        type: 'Feature',
        properties: {
          name: s.name,
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
      : {
          center: pawn,
          zoom: mode === 'follow' ? 16.6 : 15.2,
          pitch: mode === 'follow' ? 60 : 52,
          bearing: mode === 'follow' ? heading : 0,
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
          <Layer
            id="stage-names"
            type="symbol"
            layout={{
              'text-field': ['get', 'name'],
              'text-font': ['Noto Sans Regular'],
              'text-size': 12,
              'text-anchor': 'left',
              'text-offset': [0.9, 0],
              'text-optional': true,
            }}
            paint={{
              'text-color': colors.text,
              'text-halo-color': colors.background,
              'text-halo-width': 1.5,
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
