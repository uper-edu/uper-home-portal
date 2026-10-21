import { campaignUi } from "../../utils/campaignI18n";
import React from "react";
import { CrmPageAction } from "./CrmPageAction";
import { CrmPageIdentity } from "./CrmPageIdentity";
import { ArrowLeft, ClipboardCheck, Plus, RefreshCw } from "lucide-react";
import type { SourceReviewState } from "../../utils/campaignSourceNavigation";
export function CampaignWorkspaceHeading({
  title = "Marketing Campaigns",
  reviewing,
  canManage,
  isLight,
  state,
  onOpen,
  onReturn,
  headingRef,
  lang = "en",
  showSubtitle = false,
  onCreate,
  onRefresh,
  refreshing = false,
}: {
  lang?: "en" | "id" | "zh";
  showSubtitle?: boolean;
  onCreate?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  title?: string;
  reviewing: boolean;
  canManage: boolean;
  isLight: boolean;
  state: SourceReviewState;
  onOpen: () => void;
  onReturn: () => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  const u = campaignUi(lang);
  const status = [
    state.pending ? u("Items need review") : "",
    state.loading
      ? u("Checking review status")
      : state.unavailable
        ? u("Review status unavailable")
        : "",
  ]
    .filter(Boolean)
    .join("; ");
  return (
    <header
      className="admin-page-toolbar crm-home-page-heading campaign-page-heading"
      data-theme={isLight ? "light" : "dark"}
    >
      <CrmPageIdentity
        title={reviewing ? u("Source review") : u(title)}
        headingRef={headingRef}
        subtitle={
          showSubtitle && !reviewing
            ? u(
                "Create campaigns and promotion links, verify acquisition sources, and review customer and enrollment results.",
              )
            : undefined
        }
      />
      <div className="campaign-page-actions">
        {!reviewing && onCreate && canManage && (
          <CrmPageAction
            label={u("Create campaign")}
            icon={Plus}
            variant="primary"
            onClick={onCreate}
          />
        )}
        {reviewing ? (
          <CrmPageAction
            label={u("Campaigns")}
            icon={ArrowLeft}
            className="campaign-source-return"
            onClick={onReturn}
          />
        ) : (
          canManage && (
            <CrmPageAction
              id="campaign-source-review-trigger"
              label={u("Source review")}
              icon={ClipboardCheck}
              onClick={onOpen}
              title={
                status ||
                u("Review unknown campaign codes and promotion link issues")
              }
            >
              {state.pending && (
                <span className="campaign-review-dot" aria-hidden="true" />
              )}
              {(state.loading || state.unavailable) && (
                <span className="campaign-review-status">
                  {state.loading ? u("Checking…") : u("Status unavailable")}
                </span>
              )}
              {state.pending && (
                <span className="sr-only"> {u("— Items need review")}</span>
              )}
            </CrmPageAction>
          )
        )}
        {!reviewing && onRefresh && (
          <CrmPageAction
            label={u("Refresh campaigns")}
            icon={RefreshCw}
            iconOnly
            loading={refreshing}
            onClick={onRefresh}
          />
        )}
      </div>
    </header>
  );
}
