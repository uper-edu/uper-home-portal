import { cscaEn } from "./cscaFaqs_en";
import { cscaId } from "./cscaFaqs_id";
import { cscaZh } from "./cscaFaqs_zh";

export interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export const cscaFaqsByLang: Record<string, FAQItem[]> = {
  en: cscaEn,
  id: cscaId,
  zh: cscaZh,
};
