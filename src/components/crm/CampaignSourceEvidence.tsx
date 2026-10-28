import {AdminFormSection} from '../AdminFormLayout';
import React from "react";
import {
  campaignUi,
  campaignUiLocale,
  type CampaignUiLanguage,
} from "../../utils/campaignI18n";
const fields = [
  ["promotionLinkId", "Promotion link ID (p)"],
  ["promotionLinkStatus", "Promotion link verification"],
  ["entryPoint", "Saved entry point"],
  ["placement", "Saved placement / medium"],
  ["language", "Saved customer language"],
];
export function CampaignSourceEvidence({
  source,
  onLead,
  lang = "en",
}: {
  source: any;
  onLead?: (id: string) => void;
  lang?: CampaignUiLanguage;
}) {
  const u = campaignUi(lang);
  return (
    <AdminFormSection className="campaign-source-evidence crm-form-section" title={u("What triggered this review?")}>
      <p>
        {source.promotionIssue
          ? u(
              "The customer belongs to {campaign} ({code}), but promotion ID {p} was not verified for that campaign. Review the evidence; this does not make the customer invalid.",
              {
                campaign: source.campaignName,
                code: source.rawCode,
                p: source.rawPromotionLinkId,
              },
            )
          : u(
              "A saved customer has unknown campaign code {code}. It normally comes from the entry link’s c parameter. A saved customer field alone does not prove the original URL or platform.",
              { code: source.rawCode },
            )}
      </p>
      <p>
        {u(
          "Review the recorded evidence before linking or creating a campaign. URL parameters are visitor-supplied labels, not proof of the actual referring platform. Different customers may carry different parameters.",
        )}
      </p>
      {(source.leads || []).map((lead: any) => (
        <article key={lead.id} className="campaign-source-lead-evidence">
          <header>
            <h5>{lead.name}</h5>
            {onLead && (
              <button type="button" onClick={() => onLead(lead.id)}>
                {u("Open customer")}
              </button>
            )}
          </header>
          <h5>{u("Recorded entry parameters for this code")}</h5>
          {!lead.evidence?.entries?.length ? (
            <p>
              {u(
                "No matching conversation entry URL was recorded. The original p, UTM parameters and referring site cannot be recovered from this code alone.",
              )}
            </p>
          ) : (
            lead.evidence.entries.map((entry: any, index: number) => (
              <details key={entry.conversationId} open={index === 0}>
                <summary>
                  {entry.path} · {u("Conversation last activity")}:{" "}
                  {entry.lastActivityAt
                    ? new Date(entry.lastActivityAt).toLocaleString(
                        campaignUiLocale(lang),
                        {},
                      )
                    : u("Time not recorded")}{" "}

                </summary>
                <dl className="campaign-source-evidence-fields">
                  {[
                    "c",
                    "p",
                    "lang",
                    "utm_source",
                    "utm_medium",
                    "utm_campaign",
                    "utm_content",
                    "utm_term",
                    ...["cid", "campaign"].filter((key) =>
                      entry.parameters.some((p: any) => p.key === key),
                    ),
                  ].map((key) => (
                    <div key={key}>
                      <dt>
                        <code>{key}</code>
                      </dt>
                      <dd>
                        {entry.parameters
                          .filter((p: any) => p.key === key)
                          .map((p: any, i: number) => (
                            <code key={i} className="campaign-source-param">
                              {p.value || u("(empty value)")}
                            </code>
                          ))}
                        {!entry.parameters.some((p: any) => p.key === key) &&
                          u("Not recorded")}
                      </dd>
                    </div>
                  ))}
                </dl>
                <details>
                  <summary>{u("Record details")}</summary>
                  <p>
                    {u("Application entry")}:{" "}
                    {entry.surface || u("Not recorded")} · {u("Conversation")}:{" "}
                    <code>{entry.conversationId}</code>
                  </p>
                </details>
                {entry.possiblyTruncated && (
                  <p role="note">
                    {u(
                      "The saved entry was limited to 300 characters; later parameters may be missing or incomplete.",
                    )}
                  </p>
                )}
              </details>
            ))
          )}
          <details>
            <summary>{u("Saved lead attribution")}</summary>
            <dl className="campaign-source-evidence-fields">
              <div>
                <dt>{u("Saved lead field")}</dt>
                <dd>
                  <code>
                    {lead.evidence?.leadField || "campaignId / campaign"}
                  </code>
                </dd>
              </div>
              <div>
                <dt>{u("Original campaign code")}</dt>
                <dd>
                  <code>{lead.rawCode}</code>
                </dd>
              </div>
              {fields.map(([key, label]) => (
                <div key={key}>
                  <dt>{u(label)}</dt>
                  <dd>
                    {key === "promotionLinkStatus"
                      ? u(lead.evidence?.[key] || "Not recorded")
                      : lead.evidence?.[key] || u("Not recorded")}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
          <p className="campaign-hint">
            {u(
              "Only saved marketing parameters matching this code are shown. Other URL parameters and unrelated later visits are excluded. Missing values are not reconstructed.",
            )}
          </p>
        </article>
      ))}
    </AdminFormSection>
  );
}
