import i18n from '.';

const locale = () => i18n.language;

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString(locale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Kilometres from metres: one decimal under 100 km, none above. */
export function formatKm(meters: number, digits?: number): string {
  const km = meters / 1000;
  return formatNumber(km, digits ?? (km < 100 ? 1 : 0));
}

/** `38:12` or `1:04:09`. */
export function formatDuration(totalS: number): string {
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = Math.floor(totalS % 60);
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/** Pace as `14:17`, from minutes per km. */
export function formatPace(minPerKm: number | null): string {
  if (minPerKm === null || !Number.isFinite(minPerKm)) return '--:--';
  const totalS = Math.round(minPerKm * 60);
  return `${Math.floor(totalS / 60)}:${String(totalS % 60).padStart(2, '0')}`;
}

export function formatDate(date: Date, options: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString(locale(), options);
}

/** First part of a geocoded label: `12 rue de la Pierre, 41200, ...` gives the street. */
export function shortPlace(label: string): string {
  return label.split(',')[0].trim();
}
