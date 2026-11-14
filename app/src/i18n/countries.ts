import i18n from 'i18next';

import { COUNTRIES } from './country-names';

const byCode = new Map(COUNTRIES.map(([code, fr, en]) => [code, { fr, en }]));

/** The country's name in the app's language, or its code when unknown. */
export function countryName(code: string): string {
  const names = byCode.get(code);
  if (!names) return code;
  return i18n.language?.startsWith('en') ? names.en : names.fr;
}

/** Every country, sorted by name in the app's language. */
export function allCountries(): { code: string; name: string }[] {
  const locale = i18n.language?.startsWith('en') ? 'en' : 'fr';
  return COUNTRIES.map(([code]) => ({ code, name: countryName(code) })).sort((a, b) =>
    a.name.localeCompare(b.name, locale),
  );
}
