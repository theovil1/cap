import type { Place } from '@/api/types';

/** Well-known walking destinations in France, for ideas before any routing. */
const DESTINATIONS: { name: string; area: string; lat: number; lon: number }[] = [
  { name: 'Paris', area: 'Paris', lat: 48.8566, lon: 2.3522 },
  { name: 'Lyon', area: 'Rhône', lat: 45.764, lon: 4.8357 },
  { name: 'Marseille', area: 'Bouches-du-Rhône', lat: 43.2965, lon: 5.3698 },
  { name: 'Bordeaux', area: 'Gironde', lat: 44.8378, lon: -0.5792 },
  { name: 'Toulouse', area: 'Haute-Garonne', lat: 43.6047, lon: 1.4442 },
  { name: 'Nantes', area: 'Loire-Atlantique', lat: 47.2184, lon: -1.5536 },
  { name: 'Strasbourg', area: 'Bas-Rhin', lat: 48.5734, lon: 7.7521 },
  { name: 'Lille', area: 'Nord', lat: 50.6292, lon: 3.0573 },
  { name: 'Mont-Saint-Michel', area: 'Manche', lat: 48.6361, lon: -1.5115 },
  { name: 'Château de Chambord', area: 'Loir-et-Cher', lat: 47.6162, lon: 1.517 },
  { name: 'Blois', area: 'Loir-et-Cher', lat: 47.5861, lon: 1.3359 },
  { name: 'Tours', area: 'Indre-et-Loire', lat: 47.3941, lon: 0.6848 },
  { name: 'Orléans', area: 'Loiret', lat: 47.903, lon: 1.9093 },
  { name: 'Amboise', area: 'Indre-et-Loire', lat: 47.4133, lon: 0.9825 },
  { name: 'Chartres', area: 'Eure-et-Loir', lat: 48.4439, lon: 1.489 },
  { name: 'Versailles', area: 'Yvelines', lat: 48.8049, lon: 2.1204 },
  { name: 'Reims', area: 'Marne', lat: 49.2583, lon: 4.0317 },
  { name: 'Annecy', area: 'Haute-Savoie', lat: 45.8992, lon: 6.1294 },
  { name: 'Carcassonne', area: 'Aude', lat: 43.213, lon: 2.3491 },
  { name: 'Avignon', area: 'Vaucluse', lat: 43.9493, lon: 4.8055 },
  { name: 'Saint-Malo', area: 'Ille-et-Vilaine', lat: 48.6493, lon: -2.0257 },
  { name: 'La Rochelle', area: 'Charente-Maritime', lat: 46.1603, lon: -1.1511 },
  { name: 'Biarritz', area: 'Pyrénées-Atlantiques', lat: 43.4832, lon: -1.5586 },
  { name: 'Nice', area: 'Alpes-Maritimes', lat: 43.7102, lon: 7.262 },
  { name: 'Étretat', area: 'Seine-Maritime', lat: 49.7071, lon: 0.2042 },
  { name: 'Bourges', area: 'Cher', lat: 47.081, lon: 2.3988 },
  { name: 'Dijon', area: "Côte-d'Or", lat: 47.322, lon: 5.0415 },
  { name: 'Rouen', area: 'Seine-Maritime', lat: 49.4432, lon: 1.0999 },
  { name: 'Vézelay', area: 'Yonne', lat: 47.4664, lon: 3.7476 },
  { name: 'Le Puy-en-Velay', area: 'Haute-Loire', lat: 45.0434, lon: 3.8858 },
  { name: 'Lourdes', area: 'Hautes-Pyrénées', lat: 43.0947, lon: -0.0458 },
  { name: 'Poitiers', area: 'Vienne', lat: 46.5802, lon: 0.3404 },
];

/** Walking paths wind: a rough factor from the straight line to the road. */
const WINDING = 1.25;
/** One idea per band of estimated distance, in metres. */
const BANDS: [number, number][] = [
  [10_000, 35_000],
  [35_000, 80_000],
  [80_000, 200_000],
  [200_000, Infinity],
];

export type Idea = { place: Place; area: string; distanceM: number };

/** Great circle distance in metres. */
function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/**
 * Destinations to suggest from a start: the nearest one in each band of
 * distance (short, day trip, long, very long). Distances are estimates.
 */
export function ideasFrom(start: { lat: number; lon: number }): Idea[] {
  const all = DESTINATIONS.map((d) => ({
    place: { label: d.name, lat: d.lat, lon: d.lon },
    area: d.area,
    distanceM: Math.round((haversine(start, d) * WINDING) / 1_000) * 1_000,
  })).sort((a, b) => a.distanceM - b.distanceM);
  const firsts = BANDS.flatMap(([min, max]) =>
    all.filter((i) => i.distanceM >= min && i.distanceM < max).slice(0, 1),
  );
  // A band with nothing near: the next closest destinations fill the list.
  const rest = all.filter((i) => i.distanceM >= BANDS[0][0] && !firsts.includes(i));
  return [...firsts, ...rest.slice(0, BANDS.length - firsts.length)].sort(
    (a, b) => a.distanceM - b.distanceM,
  );
}
