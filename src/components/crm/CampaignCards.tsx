import { campaignUi, campaignUiLocale } from "../../utils/campaignI18n";
import React from "react";
import {
  Calendar,
  MapPin,
  GraduationCap,
  Briefcase,
  Video,
  Flame,
  Users,
  Award,
  Sparkles,
  QrCode,
  Globe,
  ExternalLink,
} from "lucide-react";
import type { CrmCampaignRecord } from "../../types/crmCampaign";
import {
  CAMPAIGN_STATUS_OPTIONS,
  CAMPAIGN_TYPE_OPTIONS,
} from "../../types/crmCampaign";
import { campaignName } from "../../utils/campaignWorkspace";
import {
  isOrganicCampaign,
  organicCampaignName,
} from "../../utils/organicCampaign";
import {
  campaignDateRange,
  campaignScheduleRange,
  campaignLocation,
  campaignDeliveryLabel,
  campaignEntrySummary,
  campaignAttendanceUrl,
} from "../../utils/campaignPresentation";
import { CrmSingleSelect } from "./CrmSingleSelect";
export type CampaignCardTab = "overview" | "info" | "collaterals" | "leads";
export type PromotionReviewCounts = {
  available: boolean;
  counts: Record<string, number>;
};

function CustomerMetrics({
  campaign,
  lang,
}: {
  campaign: CrmCampaignRecord;
  lang: "en" | "id" | "zh";
}) {
  const u = campaignUi(lang);
  return (
    <dl className="campaign-home-metrics">
      {[
        ["Registered customers", campaign.stats?.leadsCount],
        ["Assessed customers", campaign.stats?.assessedCount],
        ["Enrollment recorded", campaign.stats?.enrolledCount],
      ].map(([label, count]) => (
        <div key={label}>
          <dt>{u(String(label))}</dt>
          <dd>
            {typeof count === "number"
              ? count.toLocaleString(campaignUiLocale(lang))
              : "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function CampaignSidebarSummary({
  campaign,
  lang,
  reviewCount,
}: {
  campaign: CrmCampaignRecord;
  lang: "en" | "id" | "zh";
  reviewCount?: number;
}) {
  const u = campaignUi(lang);
  const organic = isOrganicCampaign(campaign),
    entry = campaignEntrySummary(campaign, lang),
    date = campaignDateRange(campaign, lang);
  return (
    <>
      <strong>
        {organic ? organicCampaignName(lang) : campaignName(campaign, lang)}
      </strong>
      <span>
        {organic
          ? u("Read-only · System managed")
          : u(
              CAMPAIGN_STATUS_OPTIONS.find((o) => o.value === campaign.status)
                ?.labelEn || campaign.status,
            ) +
            " · " +
            (entry.kind === "empty"
              ? u("No entry saved")
              : entry.kind === "legacy"
                ? u("Legacy link")
                : u(
                    campaign.promotionLinks?.length === 1
                      ? "1 link"
                      : "{count} links",
                    {
                      count: campaign.promotionLinks?.length || 0,
                    },
                  ))}
      </span>
      {!organic && (date || campaign.city) && (
        <span>
          {[date, campaign.locationType !== "online" ? campaign.city : "Online"]
            .filter(Boolean)
            .join(" · ")}
        </span>
      )}
      <span className="campaign-list-results">
        {u("Registered")} {campaign.stats?.leadsCount ?? "—"} · {u("Enrolled")}{" "}
        {campaign.stats?.enrolledCount ?? "—"}
      </span>
      {!!reviewCount && (
        <span className="campaign-review-attention">
          {u(
            reviewCount === 1
              ? "1 promotion attribution needs review"
              : "{count} promotion attributions need review",
            { count: reviewCount },
          )}
        </span>
      )}
    </>
  );
}
export function CampaignCards({
  campaigns,
  lang,
  isLight = true,
  onOpen,
  onEdit,
  reviewCounts,
  onReview,
}: {
  campaigns: CrmCampaignRecord[];
  lang: "en" | "id" | "zh";
  isLight?: boolean;
  onOpen: (campaign: CrmCampaignRecord, tab?: CampaignCardTab) => void;
  onEdit?: (campaign: CrmCampaignRecord) => void;
  reviewCounts?: PromotionReviewCounts;
  onReview?: (campaign: CrmCampaignRecord) => void;
}) {
  const u = campaignUi(lang);
  const icons = {
    campus_seminar: GraduationCap,
    enterprise_roadshow: Briefcase,
    webinar_class: Video,
    social_paid_ad: Flame,
    community_referral: Users,
    education_fair: Award,
    other: Sparkles,
  };
  const regular = campaigns.filter((c) => !isOrganicCampaign(c)),
    system = campaigns.filter(isOrganicCampaign);
  return (
    <>
      {!!regular.length && (
        <div className="campaign-home-grid" aria-label={u("Campaign cards")}>
          {regular.map((c) => {
            const name = campaignName(c, lang),
              Icon = icons[c.type] || Sparkles,
              entry = campaignEntrySummary(c, lang),
              schedule = campaignScheduleRange(c, lang),
              location = campaignLocation(c),
              attendanceUrl = campaignAttendanceUrl(c),
              issues = reviewCounts?.available
                ? reviewCounts.counts[c.id] || 0
                : 0;
            return (
              <article
                key={c.id}
                className="campaign-home-card"
                aria-label={u("Campaign: {name}", { name })}
              >
                <button
                  type="button"
                  className="campaign-home-open"
                  data-campaign-card={c.id}
                  onClick={() => onOpen(c, "overview")}
                  aria-label={u("Open campaign: {name}", { name })}
                >
                  <div className="campaign-home-card-heading">
                    <span className="campaign-home-type">
                      <Icon size={16} aria-hidden="true" />
                      {u(
                        CAMPAIGN_TYPE_OPTIONS.find((o) => o.value === c.type)
                          ?.labelEn || "Type not set",
                      )}
                      <span
                        aria-hidden="true"
                        className="campaign-type-divider"
                      >
                        ·
                      </span>
                      <span
                        aria-label={u("Delivery format: {format}", {
                          format: campaignDeliveryLabel(c, lang),
                        })}
                      >
                        {campaignDeliveryLabel(c, lang)}
                      </span>
                    </span>
                    <span
                      className="crm-campaign-status"
                      title={u(
                        "Manually maintained campaign status; not a link availability check",
                      )}
                      data-state={c.status}
                    >
                      {u(
                        CAMPAIGN_STATUS_OPTIONS.find(
                          (o) => o.value === c.status,
                        )?.labelEn || c.status,
                      )}
                    </span>
                  </div>
                  <h2 title={name}>{name}</h2>
                  <div className="campaign-home-context">
                    {schedule && (
                      <p
                        className="campaign-card-schedule"

                      >
                        <Calendar size={14} aria-hidden="true" />
                        <span>{schedule}</span>
                      </p>
                    )}
                    {location && (
                      <p>
                        <MapPin size={14} aria-hidden="true" />
                        <span>{location}</span>
                      </p>
                    )}
                    {c.organizer?.trim() && (
                      <p className="campaign-card-organizer">
                        <Users size={14} aria-hidden="true" />
                        <span>
                          {u("Organizer:")} {c.organizer}
                        </span>
                      </p>
                    )}
                  </div>
                </button>
                {attendanceUrl && (
                  <div className="campaign-card-attendance">
                    <a
                      href={attendanceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={u("Online attendance link for {name}", {
                        name,
                      })}
                    >
                      {u("Online attendance link")}
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  </div>
                )}
                <div className="campaign-card-distribution">
                  <div className="campaign-card-distribution-status">
                    <span
                      className="campaign-entry-summary"
                      data-state={entry.kind}
                    >
                      {entry.label}
                    </span>
                    {!!issues && onReview && (
                      <button
                        type="button"
                        className="campaign-review-attention campaign-card-review"
                        data-campaign-review={c.id}
                        aria-label={u(
                          issues === 1
                            ? "1 promotion attribution needs review for {name}"
                            : "{count} promotion attributions need review for {name}",
                          { count: issues, name },
                        )}
                        onClick={() => onReview(c)}
                      >
                        {u("Review")} {issues}
                      </button>
                    )}
                  </div>
                  <span className="campaign-home-code">
                    {u("Campaign ID:")} <code>{c.code}</code>
                  </span>
                  <div className="campaign-card-budget">
                    <span>{u("Planned budget")}</span>
                    <span>
                      {typeof c.stats?.budgetCost === "number" &&
                      Number.isFinite(c.stats.budgetCost)
                        ? `IDR ${c.stats.budgetCost.toLocaleString(campaignUiLocale(lang))}`
                        : u("Not recorded")}
                    </span>
                  </div>
                </div>
                <CustomerMetrics campaign={c} lang={lang} />
                <div className="campaign-home-card-footer">
                  <button
                    type="button"
                    className="campaign-card-primary"
                    onClick={() => onOpen(c, "overview")}
                  >
                    <QrCode size={15} aria-hidden="true" />
                    {entry.kind === "empty" && !onEdit
                      ? u("View link setup")
                      : entry.action}
                  </button>
                  <button
                    type="button"
                    className="campaign-card-results"
                    onClick={() => onOpen(c, "leads")}
                  >
                    {u("Results")}
                  </button>
                  <CrmSingleSelect
                    label={u("More actions for {name}", { name })}
                    displayValue={u("More")}
                    value=""
                    options={[
                      { value: "materials", label: u("Materials") },
                      ...(onEdit
                        ? [{ value: "edit", label: u("Edit information") }]
                        : []),
                    ]}
                    onChange={(value) =>
                      value === "edit" ? onEdit?.(c) : onOpen(c, "collaterals")
                    }
                    lang={lang}
                    isLight={isLight}
                    className="campaign-card-more"
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
      {!!system.length && (
        <section
          className="campaign-system-sources"
          aria-label={u("System sources")}
        >
          <header>
            <h2>{u("System sources")}</h2>
            <p>
              {u(
                "Read-only attribution buckets. Included in the current totals; not marketing campaigns.",
              )}
            </p>
          </header>
          {system.map((c) => (
            <article
              key={c.id}
              className="campaign-system-source"
              aria-label={u("System source: {name}", {
                name: organicCampaignName(lang),
              })}
            >
              <div className="campaign-system-identity">
                <Globe size={20} aria-hidden="true" />
                <div>
                  <button
                    type="button"
                    data-campaign-card={c.id}
                    onClick={() => onOpen(c, "leads")}
                  >
                    {organicCampaignName(lang)}
                  </button>
                  <p>{u("No specific campaign at first registration")}</p>
                </div>
              </div>
              <CustomerMetrics campaign={c} lang={lang} />
              <div className="campaign-system-actions">
                <button
                  type="button"
                  className="campaign-card-results"
                  onClick={() => onOpen(c, "leads")}
                >
                  {u("View customers")}
                </button>
                <button type="button" onClick={() => onOpen(c, "info")}>
                  {u("Source information")}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
