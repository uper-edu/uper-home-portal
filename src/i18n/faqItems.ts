import {normalizeSiteLanguage} from '../utils/siteMetadata';
import items from './locales/faqItems.json';

export function localizedFaqItems(language?:string) {
  return items[normalizeSiteLanguage(language)];
}
