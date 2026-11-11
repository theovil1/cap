import type { LayerSpecification, StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { useQuery } from '@tanstack/react-query';
import { useColorScheme } from 'react-native';

import { getValue, setValue } from '@/session/store';

/** OpenFreeMap Liberty: free vector tiles with 3D buildings, no key needed. */
const LIBERTY_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** Map colours from the mockups (docs/sources/Seance*.dc.html). */
const MAP_COLORS = {
  day: {
    ground: '#ECE7DE',
    green: '#D2E5C1',
    water: '#BBD6EE',
    road: '#FCFBF8',
    casing: '#D9D2C6',
    building: '#E9E4DB',
    lit: '#E9E4DB',
    rail: '#C9C2B6',
    label: '#5C5E67',
    halo: '#F4F2EE',
  },
  night: {
    ground: '#14151A',
    green: '#15211A',
    water: '#0E1A2B',
    road: '#2A2C33',
    casing: '#1A1B22',
    building: '#23252E',
    /** Lit windows: one building in seven glows. */
    lit: '#5C4A2E',
    rail: '#2E303A',
    label: '#A2A4AD',
    halo: '#0B0C0F',
  },
};

type Mood = keyof typeof MAP_COLORS;

const HIDDEN =
  /^(poi_|road_one_way|highway-shield|road_shield|airport|natural_earth|landuse_(hospital|school))/;

function recolor(
  layer: LayerSpecification,
  c: (typeof MAP_COLORS)[Mood],
): LayerSpecification | null {
  const id = layer.id;
  if (HIDDEN.test(id)) return null;
  const paint = { ...(('paint' in layer && layer.paint) || {}) } as Record<string, unknown>;
  if (layer.type === 'background') paint['background-color'] = c.ground;
  else if (layer.type === 'fill' && /park|wood|grass|pitch|track|cemetery/.test(id)) {
    paint['fill-color'] = c.green;
    paint['fill-opacity'] = 0.9;
    delete paint['fill-outline-color'];
  } else if (layer.type === 'line' && id === 'park_outline') return null;
  else if (layer.type === 'fill' && id === 'landuse_residential') paint['fill-color'] = c.ground;
  else if (layer.type === 'fill' && id === 'water') paint['fill-color'] = c.water;
  else if (layer.type === 'line' && id.startsWith('waterway')) paint['line-color'] = c.water;
  else if (layer.type === 'line' && /rail/.test(id)) paint['line-color'] = c.rail;
  else if (layer.type === 'line' && id.endsWith('_casing')) paint['line-color'] = c.casing;
  else if (layer.type === 'line' && /^(road|bridge|tunnel)_/.test(id)) {
    paint['line-color'] = c.road;
    delete paint['line-dasharray'];
  } else if (layer.type === 'fill' && id === 'building') paint['fill-color'] = c.building;
  else if (layer.type === 'fill-extrusion') {
    paint['fill-extrusion-color'] = [
      'case',
      ['==', ['%', ['to-number', ['id'], 1], 7], 0],
      c.lit,
      c.building,
    ];
    paint['fill-extrusion-opacity'] = 0.92;
  } else if (layer.type === 'symbol') {
    paint['text-color'] = c.label;
    paint['text-halo-color'] = c.halo;
    paint['text-halo-width'] = 1.2;
  }
  return { ...layer, paint } as LayerSpecification;
}

/** Cap's map: Liberty recoloured with the palette, day or night. */
export function capStyle(base: StyleSpecification, mood: Mood): StyleSpecification {
  const c = MAP_COLORS[mood];
  return {
    ...base,
    light: { anchor: 'viewport', color: '#FFFFFF', intensity: mood === 'day' ? 0.35 : 0.2 },
    layers: base.layers
      .map((layer) => recolor(layer, c))
      .filter((l): l is LayerSpecification => l !== null),
  };
}

/** The style follows iOS light and dark mode (map mood setting comes later). */
export function useMapStyle(): StyleSpecification | null {
  const mood: Mood = useColorScheme() === 'dark' ? 'night' : 'day';
  const { data } = useQuery({
    queryKey: ['map-style'],
    staleTime: 7 * 86_400_000,
    initialData: () => getValue<StyleSpecification>('map-style') ?? undefined,
    initialDataUpdatedAt: 0,
    queryFn: async () => {
      const style = (await (await fetch(LIBERTY_URL)).json()) as StyleSpecification;
      setValue('map-style', style);
      return style;
    },
  });
  return data ? capStyle(data, mood) : null;
}
