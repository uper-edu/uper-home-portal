import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import {learnerPreviewToken} from '../utils/enrollmentLearnerPreview';

import en from './locales/en.json';
import id from './locales/id.json';
import zh from './locales/zh.json';

const languageKey = 'i18nextLng';
const detector = new LanguageDetector().addDetector({
  name: 'savedPortalLanguage',
  lookup() {
    try { return window.localStorage.getItem(languageKey) || undefined; }
    catch { return undefined; }
  },
  cacheUserLanguage(language) {
    try {
      const storage = window.localStorage;
      if (storage.getItem(languageKey) !== language) storage.setItem(languageKey, language);
    } catch { /* A blocked preference write must not interrupt translation. */ }
  },
});

i18n
  .use(detector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      id: { translation: id },
      zh: { translation: zh },
    },
    fallbackLng: 'id',
    supportedLngs: ['id', 'en', 'zh'],
    nonExplicitSupportedLngs: true,
    returnNull: false,
    returnEmptyString: false,
    detection: {
      order: ['querystring', 'savedPortalLanguage', 'navigator', 'htmlTag'],
      caches: typeof window !== 'undefined' && !learnerPreviewToken() ? ['savedPortalLanguage'] : [],
      lookupQuerystring: 'lang',
    },
    interpolation: {
      escapeValue: false, // React already safe from xss
    },
  });

// Route modules register their copy before rendering. Keep the existing keys
// and Indonesian fallback without making public entry pages download that copy.
export function addRouteTranslations(section: string, translations: Record<'id'|'en'|'zh', object>) {
  for (const [language, copy] of Object.entries(translations)) {
    i18n.addResourceBundle(language, 'translation', {[section]:copy});
  }
}

export default i18n;
