import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
import fr from '../locales/fr.json';

const STORAGE_KEY = 'airgocc.locale';

/** Langues supportées aujourd’hui ; ajouter une clé ici + fichier JSON pour étendre. */
export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function deviceDefaultLanguage(): AppLanguage {
  const tag = Localization.getLocales()[0]?.languageTag?.toLowerCase() ?? 'fr';
  if (tag.startsWith('en')) return 'en';
  return 'fr';
}

export async function loadStoredLanguage(): Promise<AppLanguage> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'fr') return stored;
  } catch {
    /* ignore */
  }
  return deviceDefaultLanguage();
}

export async function persistLanguage(lng: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, lng);
}

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: deviceDefaultLanguage(),
  fallbackLng: 'fr',
  supportedLngs: [...SUPPORTED_LANGUAGES],
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

void loadStoredLanguage().then((lng) => {
  void i18n.changeLanguage(lng);
});

export default i18n;
