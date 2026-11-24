import {AdminRefreshAction} from '../admin/AdminRefreshAction';
import {AdminRecordHeader} from '../admin/AdminRecordHeader';
import {CrmDetailActions,CrmRecordTitle} from './CrmRecordWorkspace';
import { campaignUi } from "../../utils/campaignI18n";
import React from "react";
import { AdminPageAction } from "../admin/AdminPageAction";
import { AdminPageHeader } from '../admin/AdminPageHeader';
import { ClipboardCheck, Plus } from "lucide-react";
export function CampaignWorkspaceHeading({
  title = "Marketing Campaigns",
  reviewing,
  canManage,
  onOpen,
  onReturn,
  returnToDetail=false,
  headingRef,
  lang = "en",
  onCreate,
  onRefresh,
  refreshing = false,
}: {
  lang?: "en" | "id" | "zh";
  onCreate?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  title?: string;
  reviewing: boolean;
  canManage: boolean;
  isLight: boolean;
  onOpen?: () => void;
  onReturn: () => void;
  returnToDetail?: boolean;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  const u = campaignUi(lang);
  const refresh=onRefresh&&<AdminRefreshAction
    label={u(reviewing?"Refresh promotion reviews":"Refresh campaigns")} loading={refreshing} onClick={onRefresh}/>;
  if(reviewing)return <AdminRecordHeader
    back={{label:u(returnToDetail?"Back to campaign details":"Back to campaign list"),onClick:onReturn}}
    title={<CrmRecordTitle title={u("Promotion source exceptions")} titleRef={headingRef}/>}
    actions={<CrmDetailActions label={u("Campaign actions")} secondary={refresh}/>}/>;
  return (
    <AdminPageHeader
        title={u(title)}
        headingRef={headingRef}
        subtitle={u("Create campaigns and promotion links, verify acquisition sources, and review customer and enrollment results.")}
      actions={<>
        {canManage && onOpen && (
            <AdminPageAction
              id="campaign-source-review-trigger"
              label={u("Promotion source exceptions")}
              icon={ClipboardCheck}
              variant="warning"
              onClick={onOpen}
              title={u("Items need review")}
            >
              <span className="sr-only"> {u("— Items need review")}</span>
            </AdminPageAction>
        )}
        {refresh}
        {onCreate && canManage && (
          <AdminPageAction label={u("Create campaign")} icon={Plus}
            variant="primary" onClick={onCreate}/>
        )}
      </>}/>
  );
}
