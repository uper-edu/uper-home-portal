import {AdminRecordHeader} from '../admin/AdminRecordHeader';
import {CrmDetailActions,CrmRecordTitle} from './CrmRecordWorkspace';
import { campaignUi } from "../../utils/campaignI18n";
import React from "react";
import { CrmPageAction } from "./CrmPageAction";
import { CrmPageIdentity } from "./CrmPageIdentity";
import { ClipboardCheck, Plus, RefreshCw } from "lucide-react";
import type { SourceReviewState } from "../../utils/campaignSourceNavigation";
export function CampaignWorkspaceHeading({
  title = "Marketing Campaigns",
  reviewing,
  canManage,
  isLight,
  state,
  onOpen,
  onReturn,
  returnToDetail=false,
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
  onOpen?: () => void;
  onReturn: () => void;
  returnToDetail?: boolean;
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
  const refresh=onRefresh&&<CrmPageAction
    label={u(reviewing?"Refresh promotion reviews":"Refresh campaigns")}
    icon={RefreshCw} iconOnly loading={refreshing} onClick={onRefresh}/>;
  if(reviewing)return <AdminRecordHeader
    back={{label:u(returnToDetail?"Back to campaign details":"Back to campaign list"),onClick:onReturn}}
    title={<CrmRecordTitle title={u("Promotion source exceptions")} titleRef={headingRef}/>}
    actions={<CrmDetailActions label={u("Campaign actions")} secondary={refresh}/>}/>;
  return (
    <header
      className="admin-page-toolbar crm-home-page-heading campaign-page-heading"
      data-theme={isLight ? "light" : "dark"}
    >
      <CrmPageIdentity
        title={u(title)}
        headingRef={headingRef}
        subtitle={
          showSubtitle
            ? u(
                "Create campaigns and promotion links, verify acquisition sources, and review customer and enrollment results.",
              )
            : undefined
        }
      />
      <div className="campaign-page-actions">
        {onCreate && canManage && (
          <CrmPageAction
            label={u("Create campaign")}
            icon={Plus}
            variant="primary"
            onClick={onCreate}
          />
        )}
        {canManage && onOpen && (
            <CrmPageAction
              id="campaign-source-review-trigger"
              label={u("Promotion source exceptions")}
              icon={ClipboardCheck}
              onClick={onOpen}
              title={
                status ||
                u("Review promotion links that could not be identified")
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
        )}
        {refresh}
      </div>
    </header>
  );
}
