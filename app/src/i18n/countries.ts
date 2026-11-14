import i18n from 'i18next';

import { COUNTRIES } from './country-names';

const byCode = new Map(COUNTRIES.map(([code, fr, en]) => [code, { fr, en }]));

/** 🇫🇷 from "FR": two regional indicator letters. */
export function flag(code: string): string {
  return /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)))
    : '';
}

/** The country's name in the app's language, or its code when unknown. */
export function countryName(code: string): string {
  const names = byCode.get(code);
  if (!names) return code;
  return i18n.language?.startsWith('en') ? names.en : names.fr;
}

/** "🇫🇷 France". */
export function countryLabel(code: string): string {
  return `${flag(code)} ${countryName(code)}`.trim();
}

/** Every country, sorted by name in the app's language. */
export function allCountries(): { code: string; name: string }[] {
  const locale = i18n.language?.startsWith('en') ? 'en' : 'fr';
  return COUNTRIES.map(([code]) => ({ code, name: countryName(code) })).sort((a, b) =>
    a.name.localeCompare(b.name, locale),
  );
}
