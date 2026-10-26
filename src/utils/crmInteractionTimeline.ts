import {effectiveContactRecords} from './crmRecordAmendments';
/** Independent facts. No task, Tier, read-state or notification writes. */
export type InteractionTrack='communication'|'customer'|'sales';
export type InteractionEvent={id:string;at?:string;recordedAt?:string;timeBasis:'occurred'|'received'|'unrecorded';channel:string;source:'contact'|'chat'|'request'|'assessment';text:string;actor?:string;result?:string;direction?:string;log?:any;assessment?:any;conversationId?:string;messageId?:string;undatedCount?:number};
export type InteractionTimeline=Record<InteractionTrack,InteractionEvent|null>;
export function interactionInstant(value:any):string|undefined {if(typeof value!=='string')return;const normalized=/^\d{4}-\d\d-\d\d \d\d:/.test(value)?value.replace(' ','T')+'Z':value;const date=normalized.match(/^(\d{4})-(\d{2})-(\d{2})T/);if(!date||Number(date[2])<1||Number(date[2])>12||Number(date[3])<1||Number(date[3])>new Date(Date.UTC(Number(date[1]),Number(date[2]),0)).getUTCDate())return;if(!/(Z|[+-]\d\d:\d\d)$/.test(normalized)||!Number.isFinite(Date.parse(normalized))||Date.parse(normalized)<=0)return;return new Date(normalized).toISOString();}
/** Optional occurrence is never inferred from recording time. */
export function optionalOccurrence(value:any,now:Date):string|null{
 if(value===undefined||value===null)return null;
 const at=typeof value==='string'&&/T.*(Z|[+-]\d\d:\d\d)$/.test(value)?interactionInstant(value):undefined;
 if(!at||Date.parse(at)>now.getTime())throw Error('实际发生时间不正确，不能晚于当前时间');
 return at;
}
export function contactOccurrence(body:any,now:Date){
 if(body.recordKind!=='contact'){if(body.contactDirection!==undefined||body.occurrenceMode!==undefined)throw Error('Contact timing belongs to contact records');const at=optionalOccurrence(body.occurredAt,now);return at?{occurredAt:at}:{};}
 if(!['sales','customer'].includes(body.contactDirection))throw Error('Choose who initiated the contact');
 if(body.contactDirection==='customer'&&body.connectStatus!=='Connected')throw Error('Customer-initiated contact requires a real reply');
 if(!['now','specified','unknown'].includes(body.occurrenceMode))throw Error('Choose when contact occurred');
 if(body.occurrenceMode==='unknown'){if(body.occurredAt!==undefined&&body.occurredAt!==null)throw Error('Unknown occurrence cannot include a timestamp');return {occurredAt:null,contactDirection:body.contactDirection};}
 if(body.occurrenceMode==='specified'&&(typeof body.occurredAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(body.occurredAt)))throw Error('Contact time must be valid and not in the future');
 const at=body.occurrenceMode==='now'?now.toISOString():interactionInstant(body.occurredAt);
 if(!at||Date.parse(at)>now.getTime())throw Error('Contact time must be valid and not in the future');
 if(body.occurrenceMode==='now'&&body.occurredAt!==undefined)throw Error('Unexpected explicit contact time');
 return {occurredAt:at,contactDirection:body.contactDirection};
}
function last(events:InteractionEvent[]):InteractionEvent|null{
 const dated=events.filter(e=>e.at).sort((a,b)=>Date.parse(b.at!)-Date.parse(a.at!)||a.id.localeCompare(b.id));
 const undated=events.filter(e=>!e.at).sort((a,b)=>Date.parse(b.recordedAt||'')-Date.parse(a.recordedAt||'')||a.id.localeCompare(b.id));
 const chosen=dated[0]||undated[0];return chosen?{...chosen,undatedCount:undated.length}:null;
}
export function projectInteractionTimeline(lead:any,customerEvents:InteractionEvent[]=[]):InteractionTimeline{
 const contact:InteractionEvent[]=effectiveContactRecords(lead).filter((l:any)=>l.recordKind!=='closure'&&l.recordKind!=='internal'&&['Connected','No Response','Wrong Number'].includes(l.connectStatus)).map((l:any)=>({id:l.id||l.requestId||'legacy:'+String(l.timestamp||l.at),at:interactionInstant(l.occurredAt),recordedAt:l.timestampKnown===false?undefined:interactionInstant(l.timestamp||l.at),timeBasis:interactionInstant(l.occurredAt)?'occurred':'unrecorded',channel:l.channel||'Other',source:'contact',text:l.summary||'',actor:l.staffName||l.actor,result:l.connectStatus,direction:l.contactDirection||'unknown',log:l}));
 return {communication:last(contact.filter(e=>e.result==='Connected')),customer:last([...customerEvents,...contact.filter(e=>e.direction==='customer')]),sales:last(contact.filter(e=>e.direction==='sales'))};
}
