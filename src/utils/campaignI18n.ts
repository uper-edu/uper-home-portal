import translations from "./campaign-ui.json";
export type CampaignUiLanguage = "en" | "id" | "zh";
export const campaignUiMessages: Record<string, string[]> = translations;
/** Only system-authored presentation keys belong here. Interpolated names, codes and notes stay verbatim. */
export const campaignUi =
  (lang: CampaignUiLanguage) =>
  (key: string, values: Record<string, string | number> = {}) => {
    const pair = campaignUiMessages[key];
    const text = lang === "en" ? key : (pair?.[lang === "id" ? 0 : 1] ?? key);
    return text.replace(/\s*[·・]\s*(?:optional|opsional|选填|可选)\s*$/i,'').replace(/\{([a-zA-Z][\w]*)\}/g, (match, name) =>
      Object.hasOwn(values, name) ? String(values[name]) : match,
    );
  };
export const campaignUiLocale = (lang: CampaignUiLanguage) =>
  ({ en: "en-GB", id: "id-ID", zh: "zh-CN" })[lang];
/** Do not expose a new server diagnostic as an untranslated UI sentence. */
export const campaignUiError = (lang: CampaignUiLanguage, message: string) =>
  campaignUi(lang)(
    campaignUiMessages[message] || lang === "en"
      ? message
      : "The request failed. Your input is retained. Retry or ask a CRM Manager.",
  );
