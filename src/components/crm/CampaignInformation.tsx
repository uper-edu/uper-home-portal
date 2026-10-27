import {campaignViewerSchedule} from '../../utils/campaignScheduleInput';
import { campaignUi, campaignUiLocale } from "../../utils/campaignI18n";
import { CrmDisclosure } from "./CrmDisclosure";
import React from "react";
import type { CrmCampaignRecord } from "../../types/crmCampaign";
import {
  CAMPAIGN_TYPE_OPTIONS,
  CAMPAIGN_STATUS_OPTIONS,
} from "../../types/crmCampaign";
import { crmValue } from "../../utils/crmLanguage";
import { campaignAttendanceUrl } from "../../utils/campaignPresentation";

function dateTime(value: string, lang: "en" | "id" | "zh") {
  if (!value || !Number.isFinite(Date.parse(value)))
    return campaignUi(lang)("Not recorded");
  return new Intl.DateTimeFormat(campaignUiLocale(lang), {
    dateStyle: "medium",
    timeStyle: "short",

  }).format(new Date(value));
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="campaign-info-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
export function CampaignInformation({
  campaign: c,
  onEdit,
  lang = "en",
}: {
  campaign: CrmCampaignRecord;
  onEdit?: () => void;
  lang?: "en" | "id" | "zh";
}) {
  const u = campaignUi(lang);
  const r = (value: unknown) =>
    typeof value === "string" && value.trim() ? value : u("Not recorded");
  const schedule = (date?: string, time?: string) => {
    const shown=campaignViewerSchedule(date,time);
    return shown.date || shown.time ? `${shown.date || u("Date not recorded")} · ${shown.time || u("Time not recorded")}` : u("Not recorded");
  };
  const hasSchedule = Boolean(
    c.startDate ||
    c.endDate ||
    c.startTime ||
    c.endTime ||
    c.city ||
    c.venue ||
    c.address ||
    c.onlineLink ||
    c.scheduleNotes,
  );
  const hasContext =
    c.stats.budgetCost != null ||
    c.targetAudience?.length > 0 ||
    c.keyTopics?.length > 0 ||
    c.speakers?.length > 0;
  const attendanceUrl = campaignAttendanceUrl(c);
  return (
    <div className="campaign-information">
      <p className="campaign-hint">
        {u(
          "Internal facts about this campaign. Distribution settings belong to each promotion link.",
        )}
      </p>
      <section
        className="campaign-info-section"
        aria-labelledby="campaign-basic-heading"
      >
        <h3 id="campaign-basic-heading">{u("Basic information")}</h3>
        <dl className="campaign-info-grid">
          <Field label={u("Campaign name")}>{r(c.name)}</Field>
          <Field label={u("Campaign code")}>
            <code>{c.code}</code>
          </Field>
          <Field label={u("Status")}>
            {u(
              CAMPAIGN_STATUS_OPTIONS.find((o) => o.value === c.status)
                ?.labelEn || r(c.status),
            )}
          </Field>
          <Field label={u("Campaign type")}>
            {u(
              CAMPAIGN_TYPE_OPTIONS.find((o) => o.value === c.type)?.labelEn ||
                "Not recorded",
            )}
          </Field>
          <Field label={u("Delivery format")}>
            {u(
              { offline: "On-site", online: "Online", hybrid: "Hybrid" }[
                c.locationType
              ] || "Not recorded",
            )}
          </Field>
          <Field label={u("Organizer / campaign contact")}>
            {r(c.organizer)}
          </Field>
        </dl>
      </section>
      <CrmDisclosure
        className="campaign-info-section"
        open={hasSchedule}
        heading={
          <>
            {u("Schedule and location")}
            {!hasSchedule && <small>{u("Not recorded · optional")}</small>}
          </>
        }
      >
        <p className="campaign-hint">
          {u(
            "The attendance link is separate from customer acquisition links.",
          )}
        </p>
        <dl className="campaign-info-grid">
          <Field label={u("Start")}>{schedule(c.startDate, c.startTime)}</Field>
          <Field label={u("End")}>{schedule(c.endDate, c.endTime)}</Field>
          <Field label={u("City")}>{r(c.city)}</Field>
          <Field label={u("Venue")}>{r(c.venue)}</Field>
          <Field label={u("Address")}>{r(c.address)}</Field>
          <Field label={u("Online attendance link")}>
            {attendanceUrl ? (
              <a href={attendanceUrl} target="_blank" rel="noopener noreferrer">
                {c.onlineLink}
              </a>
            ) : (
              r(c.onlineLink)
            )}
          </Field>
          <Field label={u("Schedule notes")}>{r(c.scheduleNotes)}</Field>
        </dl>
      </CrmDisclosure>
      <CrmDisclosure
        className="campaign-info-section"
        open={hasContext}
        heading={
          <>
            {u("Additional campaign context")}
            {!hasContext && <small>{u("Not recorded · optional")}</small>}
          </>
        }
      >
        <dl className="campaign-info-grid">
          <Field label={u("Planned budget (IDR)")}>
            {c.stats.budgetCost == null
              ? u("Not recorded")
              : c.stats.budgetCost.toLocaleString(campaignUiLocale(lang))}
          </Field>
          <Field label={u("Target audience")}>
            {c.targetAudience?.length ? (
              <ul>
                {c.targetAudience.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            ) : (
              u("Not recorded")
            )}
          </Field>
          <Field label={u("Confirmed talking points")}>
            {c.keyTopics?.length ? (
              <ul>
                {c.keyTopics.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            ) : (
              u("Not recorded")
            )}
          </Field>
          <Field label={u("Speakers")}>
            {c.speakers?.length ? (
              <ul>
                {c.speakers.map((x, i) => (
                  <li key={i}>
                    <strong>{x.name}</strong>
                    {x.title && ` · ${x.title}`}
                    {x.bio && <p>{x.bio}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              u("Not recorded")
            )}
          </Field>
        </dl>
      </CrmDisclosure>
      <CrmDisclosure
        className="campaign-info-section campaign-info-audit"
        heading={u("System record")}
      >
        <dl className="campaign-info-grid">
          <Field label={u("Created")}>
            {dateTime(c.createdAt, lang)}
          </Field>
          <Field label={u("Last updated")}>
            {dateTime(c.updatedAt, lang)}
          </Field>
        </dl>
        {c.promotionModel !== "multiple" && (
          <>
            <h3>{u("Legacy campaign link defaults")}</h3>
            <p className="campaign-hint">
              {u(
                "Only used by the original campaign-only link. Promotion links have their own settings.",
              )}
            </p>
            <dl className="campaign-info-grid">
              <Field label={u("Source")}>{r(c.boundUtm?.utm_source)}</Field>
              <Field label={u("Medium")}>{r(c.boundUtm?.utm_medium)}</Field>
              <Field label={u("Customer language")}>
                {u(
                  { en: "English", id: "Bahasa Indonesia", zh: "Chinese" }[
                    c.boundUtm?.defaultLang
                  ] || "Not recorded",
                )}
              </Field>
              <Field label={u("Legacy entry service")}>
                {crmValue(c.boundUtm?.defaultHook, lang)}
              </Field>
            </dl>
          </>
        )}
      </CrmDisclosure>
    </div>
  );
}
