import {
  campaignUi,
  campaignUiLocale,
  type CampaignUiLanguage,
} from "./campaignI18n";
import type { CrmCampaignRecord } from "../types/crmCampaign";
import { isOrganicCampaign } from "./organicCampaign";

type Summary = Partial<CrmCampaignRecord>;
const day = (value?: string) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? date
    : null;
};
const dateText = (
  date: Date,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
  lang: CampaignUiLanguage = "en",
) =>
  new Intl.DateTimeFormat(campaignUiLocale(lang), {
    ...options,
    timeZone: "UTC",
  }).format(date);
/** Date-only facts stay date-only, independent of the employee's browser timezone. */
export function campaignDateRange(c: Summary, lang: CampaignUiLanguage = "en") {
  const u = campaignUi(lang),
    format = (d: Date, o?: Intl.DateTimeFormatOptions) => dateText(d, o, lang);
  if (!c.startDate && !c.endDate) return "";
  const start = day(c.startDate),
    end = day(c.endDate);
  if (
    (c.startDate && !start) ||
    (c.endDate && !end) ||
    (start && end && end < start)
  )
    return u("Recorded dates need review");
  if (!start) return u("Ends {date}", { date: format(end!) });
  if (!end || c.startDate === c.endDate) return format(start);
  if (lang !== "zh" && start.getUTCFullYear() === end.getUTCFullYear()) {
    const first = format(
      start,
      start.getUTCMonth() === end.getUTCMonth()
        ? { day: "numeric" }
        : { day: "numeric", month: "short" },
    );
    return first + "–" + format(end);
  }
  return format(start) + "–" + format(end);
}
export function campaignTimeRange(c: Summary, lang: CampaignUiLanguage = "en") {
  const u = campaignUi(lang);
  const start = c.startTime || "",
    end = c.endTime || "";
  if (!start && !end) return "";
  // On multi-day events, label the endpoints rather than implying daily hours.
  const time =
    c.startDate && c.endDate && c.startDate !== c.endDate
      ? [start && u("Start") + " " + start, end && u("End") + " " + end]
          .filter(Boolean)
          .join(" · ")
      : start && end
        ? start + "–" + end
        : start
          ? u("Starts {date}", { date: start })
          : u("Ends {date}", { date: end });
  return time + " · Asia/Jakarta";
}
/** One schedule range, with each time attached to its recorded date (never daily opening hours). */
export function campaignScheduleRange(
  c: Summary,
  lang: CampaignUiLanguage = "en",
) {
  const u = campaignUi(lang),
    format = (d: Date, o?: Intl.DateTimeFormatOptions) => dateText(d, o, lang);
  if (!c.startTime && !c.endTime) return campaignDateRange(c, lang);
  const dates = campaignDateRange(c, lang),
    timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (
    dates === u("Recorded dates need review") ||
    [c.startTime, c.endTime].some((t) => t && !timePattern.test(t)) ||
    (c.startDate &&
      c.startDate === c.endDate &&
      c.startTime &&
      c.endTime &&
      c.endTime < c.startTime)
  )
    return u("Recorded schedule needs review");
  const suffix = " · WIB";
  if (c.startDate && c.startDate === c.endDate) {
    const date = format(day(c.startDate)!);
    return (
      date +
      ", " +
      (c.startTime && c.endTime
        ? `${c.startTime}–${c.endTime}`
        : c.startTime
          ? u("starts {date}", { date: c.startTime }) +
            " · " +
            u("End time not recorded")
          : u("Start time not recorded") +
            " · " +
            u("ends {date}", { date: c.endTime })) +
      suffix
    );
  }
  if (
    lang !== "zh" &&
    c.startDate &&
    c.endDate &&
    c.startTime &&
    c.endTime &&
    c.startDate.slice(0, 4) === c.endDate.slice(0, 4)
  ) {
    const short = { day: "numeric", month: "short" } as const;
    return (
      `${format(day(c.startDate)!, short)} ${c.startTime} → ${format(day(c.endDate)!, short)} ${c.endTime}, ${c.endDate.slice(0, 4)}` +
      suffix
    );
  }
  const endpoint = (date: string | undefined, time: string | undefined) =>
    date
      ? format(day(date)!) +
        (time ? ", " + time : " · " + u("Time not recorded"))
      : u("Date not recorded") + ", " + time;
  const start =
      c.startDate || c.startTime ? endpoint(c.startDate, c.startTime) : "",
    end = c.endDate || c.endTime ? endpoint(c.endDate, c.endTime) : "";
  return (
    (start && end
      ? `${start} → ${end}`
      : start
        ? u("Starts {date}", { date: start })
        : u("Ends {date}", { date: end })) + suffix
  );
}
export function campaignDeliveryLabel(
  c: Summary,
  lang: CampaignUiLanguage = "en",
) {
  return campaignUi(lang)(
    { offline: "Onsite", online: "Online", hybrid: "Hybrid" }[
      c.locationType || ""
    ] || "Not set",
  );
}
export function campaignLocation(c: Summary) {
  if (c.locationType === "online") return "";
  return [c.venue, c.city].filter(Boolean).join(" · ");
}
/** Configuration summary, not a live availability check or measured traffic. */
export function campaignEntrySummary(
  c: Summary,
  lang: CampaignUiLanguage = "en",
) {
  const u = campaignUi(lang);
  if (isOrganicCampaign(c))
    return {
      kind: "system" as const,
      label: u("System source"),
      action: u("View customers"),
    };
  const count = c.promotionLinks?.length || 0;
  if (count)
    return {
      kind: "saved" as const,
      label: u(count === 1 ? "1 promotion link" : "{count} promotion links", {
        count,
      }),
      action: u("Links & QR"),
    };
  if (c.promotionModel === "multiple")
    return {
      kind: "empty" as const,
      label: u("No promotion entry saved"),
      action: u("Add promotion link"),
    };
  return {
    kind: "legacy" as const,
    label: u("Legacy campaign link retained"),
    action: u("Link & QR"),
  };
}
export function campaignCollectionLabel(
  campaigns: Summary[],
  lang: CampaignUiLanguage = "en",
) {
  const u = campaignUi(lang);
  const system = campaigns.filter(isOrganicCampaign).length,
    regular = campaigns.length - system;
  return (
    u(regular === 1 ? "1 campaign" : "{count} campaigns", { count: regular }) +
    (system
      ? " · " +
        u(system === 1 ? "1 system source" : "{count} system sources", {
          count: system,
        })
      : "")
  );
}

/** A saved meeting address is optional; never make a non-web legacy value clickable. */
export function campaignAttendanceUrl(c: Summary) {
  try {
    const url = new URL(c.onlineLink || "");
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
