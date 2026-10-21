export const CAMPAIGN_CODE_TIMEZONE = "Asia/Jakarta";
export const CAMPAIGN_LINK_PLACEHOLDER = "{{campaign_link}}";

/** Neutral creation-time code. Type and format never determine identity; old codes are never recomputed. */
export function campaignCodeBase(type: string, medium: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPAIGN_CODE_TIMEZONE,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const stamp = ["year", "month", "day", "hour", "minute", "second"]
    .map((key) => parts.find((p) => p.type === key)!.value)
    .join("");
  return "camp-" + stamp;
}

/** Only explicit generated-link placeholders are replaced; ordinary human copy is retained. */
export function resolveCampaignLinks(value: any, link: string): any {
  if (typeof value === "string")
    return value.replaceAll(CAMPAIGN_LINK_PLACEHOLDER, link);
  if (Array.isArray(value))
    return value.map((v) => resolveCampaignLinks(v, link));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveCampaignLinks(v, link)]),
    );
  return value;
}
