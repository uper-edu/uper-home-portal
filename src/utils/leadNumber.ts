import type { CrmLeadRecord } from '../types/crmLead';

// Never derive a business number from an ID or from the visible list position.
export function leadDisplayNumber(lead: Pick<CrmLeadRecord,'id'|'businessNumber'>): string {
  return lead.businessNumber || lead.id.replace(/^UPER-/, '');
}
