import {crmUiText} from './crmUiText';
import {profileFields} from './crmDynamicProfile';
import { crmValue, crmLocale } from "./crmLanguage";
/** Presentation only: no inferred old value, new signal, task or priority. */
export function listLeadHint(lead: any, lang: any = "zh") {
  const hints = lead.informationHints || [];
  const meaningful = hints.find((h: any) =>
    ["difference", "contact", "source"].includes(h.kind),
  );
  if (meaningful) {
    if(lang!=='zh'&&meaningful.id?.startsWith('difference:')){
      const label=profileFields[meaningful.id.slice(11)],match=meaningful.text?.match(/^.+?存在不同记录：([\s\S]*)。来源与发生时间可在客户资料查看。$/);
      if(label&&match)return `${crmUiText(label,lang)}: ${lang==='id'?'catatan berbeda':'different record'} — ${match[1]}`;
    }
    return meaningful.text;
  }
  return null;
}
/** The only budget field is the whole-course amount in IDR; never convert old periodic/range data. */
export function budgetPresentation(lead: any, lang: any = "zh") {
  const amount = lead.budgetAmount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0)
    return null;
  const label =
    lang === "zh"
      ? "课程总预算"
      : lang === "id"
        ? "Anggaran total kursus"
        : "Total course budget";
  return {
    label,
    value:
      "Rp" +
      new Intl.NumberFormat(crmLocale(lang), {
        maximumFractionDigits: 20,
      }).format(amount),
  };
}

/** Current learning needs belong in the needs column, independent of change hints. */
export function listLearningNeeds(lead: any, lang: any = "zh") {
  const t = (zh: string, en: string, id: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  const rows: Array<{ label: string; value: string }> = [];
  for (const [field, label] of [
    ["availability", t("上课时段", "Availability", "Jadwal")],
    ["preferredStart", t("计划开始", "Start", "Mulai")],
    ["concerns", t("顾虑", "Concerns", "Kendala")],
  ]) {
    const raw = lead[field];
    const values = (Array.isArray(raw) ? raw : [raw])
      .filter((v) => v != null && String(v).trim() !== "")
      .map((v) => crmValue(String(v), lang));
    if (values.length) rows.push({ label, value: values.join("、") });
  }
  const budget = budgetPresentation(lead, lang);
  if (budget) {
    budget.label = t("课程总预算", "Budget", "Anggaran");
    const concerns = rows.findIndex(
      (r) => r.label === t("顾虑", "Concerns", "Kendala"),
    );
    rows.splice(concerns < 0 ? rows.length : concerns, 0, budget);
  }
  return rows;
}

/** Short list wording only; the evidence presenter still owns all assessment decisions. */
export function listAssessmentConclusion(conclusion: string, lang: any = "zh") {
  if (lang !== "zh") return conclusion;
  return conclusion
    .replace(/^建议起点：/, "建议起点 ")
    .replace(/^达到本卷 (HSK [1-6]) 设定标准$/, "本卷达到 $1 标准")
    .replace(/^未达到本卷 /, "未达本卷 ")
    .replace(/^结果待复核$/, "待复核")
    .replace(/^起点建议待复核$/, "起点待复核");
}
