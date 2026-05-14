import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import tl from './locales/tl';

export type SupportedLanguage = 'en' | 'tl';

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'tl', label: 'Tagalog', nativeLabel: 'Tagalog' },
];

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      tl: { translation: tl },
    },
    lng:          'en',
    fallbackLng:  'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
