import { hskEn } from "./hskFaqs_en";
import { hskId } from "./hskFaqs_id";
import { hskZh } from "./hskFaqs_zh";

export interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export const hskFaqsByLang: Record<string, FAQItem[]> = {
  en: hskEn,
  id: hskId,
  zh: hskZh,
};
