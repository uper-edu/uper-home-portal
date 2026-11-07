import { AdminFormSection } from '../AdminFormLayout';
import { CrmDisclosure } from './CrmDisclosure';
import { campaignUi, type CampaignUiLanguage } from '../../utils/campaignI18n';

import { formatCrmEventTime } from "../../utils/crmOperatingTime";

export function CampaignSourceEvidence({
  leadId,
  evidence,
  originalPromotionId,
  onLead,
  lang = 'en',
}: {
  leadId: string;
  evidence: any;
  originalPromotionId?: string;
  onLead?: (id: string) => void;
  lang?: CampaignUiLanguage;
}) {
  const u = campaignUi(lang);
  const distinctParameters = (parameters: {key: string; value: string}[] = []) =>
    [...new Map(parameters
      .filter(({key, value}) => key !== 'p' || value !== originalPromotionId)
      .map(parameter => [JSON.stringify([parameter.key, parameter.value]), parameter])).values()];
  const parameterList = (parameters: {key: string; value: string}[]) => parameters.length > 0 && (
    <dl className="campaign-source-evidence-fields">
      {parameters.map(({key, value}, index) => (
        <div key={key + '-' + index}>
          <dt><code>{key}</code></dt>
          <dd><code className="campaign-source-param">{value || u('(empty value)')}</code></dd>
        </div>
      ))}
    </dl>
  );
  const savedParameters = distinctParameters(evidence?.parameters);
  return (
    <AdminFormSection className="campaign-source-evidence crm-form-section" title={u('Source evidence')}
      actions={onLead && <button type="button" className="campaign-workspace-action" onClick={() => onLead(leadId)}>{u('Open customer')}</button>}>
      {parameterList(savedParameters)}
      {evidence?.entries?.map((entry: any) => {
        const heading = <>{entry.path} · {formatCrmEventTime(entry.lastActivityAt) || u('Time not recorded')}</>;
        const additional = distinctParameters(entry.parameters).filter(({key, value}) =>
          !savedParameters.some(parameter => parameter.key === key && parameter.value === value));
        return additional.length || entry.possiblyTruncated ? (
          <CrmDisclosure key={entry.conversationId} className="campaign-review-evidence-entry" heading={heading}>
            {parameterList(additional)}
            {entry.possiblyTruncated && <p role="note">{u('The saved entry was limited to 300 characters; later parameters may be missing or incomplete.')}</p>}
          </CrmDisclosure>
        ) : <p className="campaign-review-evidence-entry" key={entry.conversationId}>{heading}</p>;
      })}
      {!savedParameters.length && !evidence?.entries?.length && <p>{u('No additional entry parameters recorded.')}</p>}
    </AdminFormSection>
  );
}
