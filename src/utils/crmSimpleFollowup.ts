/** Facts and attention cues do not carry task-completion obligations. */
export type FirstOutcome='attempted'|'connected'|'invalid_contact'|'exception';
export function firstContactOutcome(record:{kind:'contact'|'internal';result?:string;channel?:string;summary:string;exceptionReason?:string}):FirstOutcome|null{
 if(!record.summary.trim())throw Error('Summary required');
 if(record.kind==='internal')return record.exceptionReason?.trim()?'exception':null;
 if(!record.channel)throw Error('Contact channel required');
 if(record.result==='Connected')return 'connected';
 if(record.result==='No Response')return 'attempted';
 if(record.result==='Wrong Number')return 'invalid_contact';
 throw Error('Contact result required');
}
export type Commitment={id:string;action:string;status:'active'|'fulfilled'|'rescheduled'|'cancelled'|'withdrawn';at?:string;date?:string;timezone:string;sourceId:string};
export function validateCommitment(c:Commitment){
 if(!c.action.trim()||!c.sourceId||!c.id)throw Error('Commitment evidence required');
 if(typeof c.timezone!=='string'||!c.timezone.trim())throw Error('Explicit timezone required');
 new Intl.DateTimeFormat('en',{timeZone:c.timezone});
 if(c.at&&c.date)throw Error('Choose an exact time or a date');
 if(c.at&&(!/(Z|[+-]\d\d:\d\d)$/.test(c.at)||!Number.isFinite(Date.parse(c.at))))throw Error('Explicit timezone required');
 if(c.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(c.date)||new Date(c.date+'T00:00:00Z').toISOString().slice(0,10)!==c.date))throw Error('Invalid calendar date');
 return c;
}
export type AttentionFact={id:string;kind:'request'|'message'|'assessment'|'invalid_contact'|'inactivity';at:string;sourceId:string;text:string};
export function attentionFacts(facts:AttentionFact[],stopped=false){
 const unique=new Map<string,AttentionFact>();
 for(const f of facts){if(!f.sourceId||!Number.isFinite(Date.parse(f.at)))continue;const key=f.kind+':'+f.sourceId;if(!unique.has(key))unique.set(key,f);}
 return [...unique.values()].map(f=>({...f,internalOnly:stopped})).sort((a,b)=>(a.kind==='request'?0:1)-(b.kind==='request'?0:1)||Date.parse(b.at)-Date.parse(a.at)||a.id.localeCompare(b.id));
}

/** Workflow metadata and untouched defaults are not user edits. */
export function hasSimpleWorkflowDraft(draft:Record<string,unknown>,unknown=false){
 return unknown||draft.recordKind==='contact'||Object.entries(draft).some(([key,value])=>!(key==='occurrenceMode'&&value==='now')&&!(key==='contactDirection'&&value==='unknown')&&!['requestId','recordKind','expectedRevision','expectedContactArrangementVersion','expectedStage','expectedStageRevision','workflowVersion'].includes(key)&&(Array.isArray(value)?value.length>0:typeof value==='string'?!!value.trim():value&&typeof value==='object'?Object.keys(value).length>0:!!value));
}
