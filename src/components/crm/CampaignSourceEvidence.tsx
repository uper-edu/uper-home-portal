import { AdminFormSection } from '../AdminFormLayout';
import { campaignUi, campaignUiLocale, type CampaignUiLanguage } from '../../utils/campaignI18n';

export function CampaignSourceEvidence({
  leadId,
  evidence,
  onLead,
  lang = 'en',
}: {
  leadId: string;
  evidence: any;
  onLead?: (id: string) => void;
  lang?: CampaignUiLanguage;
}) {
  const u = campaignUi(lang);
  const parameterList = (parameters: {key: string; value: string}[]) => (
    <dl className="campaign-source-evidence-fields">
      {parameters.map(({key, value}, index) => (
        <div key={key + '-' + index}>
          <dt><code>{key}</code></dt>
          <dd><code className="campaign-source-param">{value || u('(empty value)')}</code></dd>
        </div>
      ))}
    </dl>
  );
  return (
    <AdminFormSection className="campaign-source-evidence crm-form-section" title={u('Source evidence')}
      actions={onLead && <button type="button" className="campaign-workspace-action" onClick={() => onLead(leadId)}>{u('Open customer')}</button>}>
      {evidence?.parameters?.length > 0 && parameterList(evidence.parameters)}
      {evidence?.entries?.map((entry: any) => (
        <details key={entry.conversationId}>
          <summary>
            {entry.path} · {entry.lastActivityAt
              ? new Date(entry.lastActivityAt).toLocaleString(campaignUiLocale(lang))
              : u('Time not recorded')}
          </summary>
          {parameterList(entry.parameters)}
          {entry.possiblyTruncated && <p role="note">{u('The saved entry was limited to 300 characters; later parameters may be missing or incomplete.')}</p>}
        </details>
      ))}
      {!evidence?.parameters?.length && !evidence?.entries?.length && <p>{u('No additional entry parameters recorded.')}</p>}
    </AdminFormSection>
  );
}
