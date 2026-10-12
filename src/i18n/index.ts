import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import id from './locales/id.json';
import zh from './locales/zh.json';

const isStorageAccessible = (() => {
  try {
    if (typeof window === 'undefined') return false;
    const test = '__uper_i18n_test__';
    window.localStorage.setItem(test, '1');
    window.localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
})();

i18n
  .use(LanguageDetector)
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
      order: isStorageAccessible 
        ? ['querystring', 'localStorage', 'navigator', 'htmlTag'] 
        : ['querystring', 'navigator', 'htmlTag'],
      caches: isStorageAccessible ? ['localStorage'] : [],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'i18nextLng',
    },
    interpolation: {
      escapeValue: false, // React already safe from xss
    },
  });

export default i18n;
