import type {OpportunitySourceRef} from './crmOpportunitySources';
import type {CrmLanguage} from './crmLanguage';

export type PurchaseIntentSuggestion = {
  id: string;
  conversationId: string;
  level: string | null;
  format: 'standard' | 'small' | 'private' | null;
  availability: string | null;
  startWindow: string | null;
  summary: string;
  evidence: Array<{messageId:string; quote:string}>;
};

export const purchaseIntentReviewLabel=(lang:CrmLanguage)=>
  lang==='zh'?'购课意向待核对':lang==='id'?'Tinjau minat membeli kursus':'Review purchase intent';

export const purchaseIntentSourceRefs=(suggestion:PurchaseIntentSuggestion):OpportunitySourceRef[]=>
  suggestion.evidence.map(({messageId})=>({type:'customer_message',id:messageId}));
