import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';

export const supportedLanguages = ['fr', 'en'] as const;
export type Language = (typeof supportedLanguages)[number];

function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return supportedLanguages.find((lang) => lang === code) ?? 'fr';
}

const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: deviceLanguage(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

export default i18n;
