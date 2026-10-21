import { campaignUi } from "../../utils/campaignI18n";
import { campaignCollectionLabel } from "../../utils/campaignPresentation";
import React from "react";
import { CrmCampaignMeasures } from "./CrmCampaignMeasures";
import type { CrmCampaignRecord } from "../../types/crmCampaign";

/** Receives exactly the same filtered campaign set as the cards below it. */
export function CampaignOverview({
  campaigns,
  expanded,
  onToggle,
  loading,
  error,
  onRetry,
  isLight,
  lang = "en",
}: {
  lang?: "en" | "id" | "zh";
  campaigns: CrmCampaignRecord[];
  expanded: boolean;
  onToggle: () => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  isLight: boolean;
}) {
  const u = campaignUi(lang);
  return (
    <section className="campaign-overview" aria-label={u("Campaign overview")}>
      <button
        type="button"
        className="crm-process-toggle"
        data-theme={isLight ? "light" : "dark"}
        aria-expanded={expanded}
        aria-controls="campaign-overview-content"
        onClick={onToggle}
      >
        {u("Campaign overview · Current results")}{" "}
        <span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      <div id="campaign-overview-content" hidden={!expanded}>
        {expanded && (
          <>
            {error ? (
              <p role="alert" className="campaign-overview-message">
                {u("Campaign metrics unavailable.")}{" "}
                <button type="button" onClick={onRetry}>
                  {u("Retry")}
                </button>
              </p>
            ) : loading ? (
              <p role="status" className="campaign-overview-message">
                {u("Updating campaign metrics…")}
              </p>
            ) : (
              <CrmCampaignMeasures
                campaigns={campaigns}
                lang={lang}
                isLight={isLight}
                scopeLabel={u("Current filtered sources: {sources}", {
                  sources: campaignCollectionLabel(campaigns, lang),
                })}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
