import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import id from './locales/id.json';
import en from './locales/en.json';
import { getLanguageForPublicOrGuestSession } from '../utils/preferences';

export const SUPPORTED_LANGUAGES = ['id', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

if (!i18n.isInitialized) {
  void i18n
    .use(initReactI18next)
    .init({
      resources: {
        id: { translation: id },
        en: { translation: en },
      },
      lng: 'id',
      fallbackLng: 'id',
      supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    })
    .then(async () => {
      // Indonesian-first: default is `id`, but allow explicit user preference to override.
      const preferred = await getLanguageForPublicOrGuestSession();
      if (preferred) {
        await i18n.changeLanguage(preferred);
        return;
      }
      // No saved preference: force Indonesian.
      await i18n.changeLanguage('id');
    });
}

export default i18n;

