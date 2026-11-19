export type OpportunitySourceRef = {type:'fact'|'customer_message'|'sales_record';id:string};
export type OpportunitySource = OpportunitySourceRef & {
  sourceKind?:string;factId?:string;text?:string;occurredAt?:string;receivedAt?:string;recordedAt?:string;
};

export function opportunitySourceKind(source: {type:string;sourceKind?:string;factId?:string}) {
  if (source.type==='fact'&&source.sourceKind==='questionnaire') return 'questionnaire';
  if (source.type==='customer_message') return 'message';
  if (source.type==='sales_record'&&source.factId) return 'sales_record';
}
