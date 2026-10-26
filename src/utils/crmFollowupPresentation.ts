import {crmInstant} from './crmOperatingTime';
import {crmMessageTimestamp} from './crmMessageTime';
import {sameProfileValue,compatibleProfileValue} from './crmFieldValues';
import {extractionRoot} from './crmExtractionEvidence';
import {profileFields} from './crmDynamicProfile';
/** Associate by original identity only; similar text is never a merge key. */
export function extractionsForLog(rows:any[],id:string){return rows.filter(r=>r.source_type==='sales_record'&&r.source_id===id||r.source_type==='sales_amendment'&&extractionRoot(r).type==='sales_record'&&extractionRoot(r).id===id);}
export function extractionSummary(row:any){
 if(row.status!=='completed')return ({pending:'原文已保存 · 等待AI整理',processing:'原文已保存 · AI整理中',retry:'原文已保存 · 等待重试',failed:'原文已保存 · AI整理失败'} as any)[row.status]||'原文已保存 · 整理状态待核对';
 const obs=row.output?.observations||[];if(!obs.length)return 'AI整理完成，未识别出可结构化的信息。';
 const applied=obs.filter((o:any)=>o.kind==='field'&&o.decision==='apply'),different=obs.filter((o:any)=>o.kind==='field'&&o.decision==='difference');const labels=[];
 if(applied.length)labels.push('当次采用：'+applied.map((o:any)=>profileFields[o.field]||o.field).join('、'));
 if(different.length)labels.push(different.length+'项不同记录');
 const signals=obs.filter((o:any)=>o.kind==='signal'&&o.subject==='customer'&&o.temporality==='current').length,stages=obs.filter((o:any)=>o.kind==='stage_event').length;
 if(signals)labels.push(signals+'项诉求／信号');if(stages)labels.push(stages+'项阶段描述');
 return 'AI整理完成 · '+(labels.join(' · ')||'仅保留原文依据');
}
export function locateLedgerEvent(events:any[],sourceId:string){return events.find(v=>v.eventId===sourceId)||events.find(v=>v.eventType==='followup.recorded'&&(v.sourceRecordId===sourceId||v.payload?.result?.logId===sourceId))||events.find(v=>v.sourceRecordId===sourceId||v.payload?.sourceId===sourceId||v.payload?.sourceLogId===sourceId);}
/** Baseline questionnaire values belong in the brief; only explicit later changes belong in recent changes. */
export function salesRecentHints(lead:any,hints:any[],display:(value:any)=>string){
 return hints.filter(h=>!(h.kind==='agreement'&&(lead.commitments||[]).some((a:any)=>a.status==='active'&&h.id==='agreement:'+a.id))).filter(h=>{if(h.kind!=='change'||!h.id?.startsWith('change:'))return true;const m=lead.profileFieldMeta?.[h.id.slice(7)];return !(m?.sourceType==='questionnaire'&&(m.valueChanged!==true||Number.isFinite(Date.parse(lead.submittedAt))&&Date.parse(m.recordedAt)===Date.parse(lead.submittedAt)));}).map(h=>{
  if(h.kind!=='change'||!h.id?.startsWith('change:'))return h;
  const key=h.id.slice(7);return {...h,text:h.text.replace('最近有更新','：'+display(lead[key]))};
 });
}

/** Occurrence only. Ingestion, save and model processing timestamps are never substitutes. */
export function hintOccurrenceTimes(lead:any,hint:any,rows:any[]=[],events:any[]=[]):{label:string;at:string|null}[]{
 const instant=(v:any)=>{const d=crmInstant(v);return d?d.toISOString():null;};
 const source=(id:string)=>{
  const log=(lead.followUpLogs||[]).find((l:any)=>l.id===id);if(log)return instant(log.occurredAt);
  const message=(lead.chatTranscript||[]).find((m:any)=>m.id===id||m.request_id===id);if(message)return crmMessageTimestamp(message);
  const row=rows.find(r=>r.source_id===id);if(row){const root=extractionRoot(row);return instant(root.occurredAt);}
  return ledgerOccurrenceTime(events,id);
 };
 if(hint.id==='budget-unit')return [{label:'当前资料状态，无单独发生时刻',at:null}];
 if(hint.id?.startsWith('change:')){const m=lead.profileFieldMeta?.[hint.id.slice(7)];return [{label:'实际发生',at:instant(m?.effectiveAt)||(hint.evidenceIds||[]).map(source).find(Boolean)||null}];}
 if(hint.id?.startsWith('difference:')){const m=lead.profileFieldMeta?.[hint.id.slice(11)];if(m){const differences=(m.pendingDifferences||[]).filter((d:any)=>d.effective!==false&&!d.supersededBy&&!compatibleProfileValue(hint.id.slice(11),lead[hint.id.slice(11)],d.value));return [{label:'当前资料依据发生',at:instant(m.effectiveAt)},...differences.map((d:any,i:number)=>({label:'不同记录'+(i+1)+'发生',at:instant(d.effectiveAt)||source(d.sourceFactId)}))];}}
 const ids=[...new Set<string>((hint.evidenceIds||[]).filter(Boolean))];return ids.length?ids.map((id,i)=>({label:ids.length>1?'依据'+(i+1)+'发生':'实际发生',at:source(id)})):[{label:'实际发生',at:null}];
}

/** Sort only by evidence occurrence. Unknown stays last; equal dates preserve input order. */
export function sortFollowupOccurrences<T extends {times:{at:string|null}[]}>(entries:T[]):T[]{
 const latest=(v:T)=>Math.max(-Infinity,...v.times.map(t=>t.at?crmInstant(t.at)?.getTime()??-Infinity:-Infinity));
 return entries.map((entry,index)=>({entry,index,at:latest(entry)})).sort((a,b)=>a.at===b.at?a.index-b.index:a.at>b.at?-1:1).map(v=>v.entry);
}
export function hasFollowupOccurrence(entry:{times:{at:string|null}[]}){return entry.times.some(t=>t.at&&crmInstant(t.at));}

export const FOLLOWUP_RECENT_MS=7*24*60*60*1000;
/** Display buckets only. No record is deleted and no signal, task or Tier state changes. */
export function followupWindowGroups(entries:any[],now=Date.now()){
 const result:{recent:any[];important:any[];unknown:any[]}={recent:[],important:[],unknown:[]};
 for(const entry of sortFollowupOccurrences(entries)){
  const stamps=entry.times.map((t:any)=>t.at?crmInstant(t.at)?.getTime():undefined).filter((v:any)=>Number.isFinite(v));
  const latest=stamps.length?Math.max(...stamps):null;
  const stateOnly=entry.kind==='hint'&&entry.value?.id==='budget-unit';
  if(stateOnly){result.important.push(entry);continue;}
  if(latest===null){result.unknown.push(entry);continue;}
  const persistent=entry.kind==='hint'&&['difference','source','contact'].includes(entry.value?.kind);
  if(persistent){result.important.push(entry);continue;}
  if(latest>=now-FOLLOWUP_RECENT_MS&&latest<=now){result.recent.push(entry);continue;}
  if(entry.kind==='communication'||entry.kind==='request'||entry.kind==='hint'&&entry.value?.kind==='evidence')result.important.push(entry);
 }
 return result;
}
/** Merge only profile fields with one identical evidence ID, source type, and occurrence (including explicitly unknown time). */
export function groupSameSourceChanges(entries:any[],lead:any,events:any[]=[]){
 const output:any[]=[],groups=new Map<string,any>();
 for(const entry of entries){
  const hint=entry.value,key=hint?.id?.startsWith('change:')?hint.id.slice(7):null,meta=key&&lead.profileFieldMeta?.[key];
  const at=entry.times.length===1&&entry.times[0].at?crmInstant(entry.times[0].at)?.toISOString():null;
  const ids=hint?.evidenceIds||[];
  if(entry.kind!=='hint'||hint?.kind!=='change'||ids.length!==1||!ids[0]||!meta?.sourceType){output.push(entry);continue;}
  const event=locateLedgerEvent(events,ids[0]),basisId=event?.eventType==='profile.fields_updated'&&event.payload?.basisFactIds?.length===1?event.payload.basisFactIds[0]:null,basis=basisId?events.find(e=>e.eventId===basisId):null;
  const commonEvidenceId=basis?.eventType==='information.extracted'&&basis.payload?.sourceId===event?.payload?.sourceRecordId?basisId:ids[0];
  const identity=JSON.stringify([meta.sourceType,commonEvidenceId,at]);let group=groups.get(identity);
  if(!group){group={...entry,changes:[entry],sourceType:meta.sourceType,commonEvidenceId};groups.set(identity,group);output.push(group);}
  else {group.kind='changes';group.changes.push(entry);}
 }
 return output;
}

/** Follow only explicitly linked occurrence evidence, never save or model-processing time. */
export function ledgerOccurrenceTime(events:any[],id:string,visited=new Set<string>()):string|null{
 if(visited.has(id))return null;visited.add(id);const e=locateLedgerEvent(events,id);if(!e)return null;
 const instant=(v:any)=>crmInstant(v)?.toISOString()||null;
 if(e.eventType==='information.extracted'&&e.payload?.sourceRoot)return instant(e.payload.sourceRoot.occurredAt);
 const direct=instant(e.occurredAt)||instant(e.payload?.occurredAt);if(direct)return direct;
 if(e.eventType==='profile.fields_updated'&&e.payload?.basisFactIds?.length===1)return ledgerOccurrenceTime(events,e.payload.basisFactIds[0],visited);
 return null;
}
/** "Added" requires an explicit empty-before/nonempty-after fact for the current adopted field. */
export function profileChangeLabel(lead:any,hint:any,events:any[]=[]) {
 const field=hint.id?.startsWith('change:')?hint.id.slice(7):null,change=profileChangeValues(lead,hint,events);if(!field||!change)return '资料变化';
 const empty=(v:any)=>v==null||typeof v==='string'&&!v.trim()||Array.isArray(v)&&!v.length;
 return empty(change.before)&&!empty(change.after)?'资料新增':!compatibleProfileValue(field,change.before,change.after)?'资料变更':'资料变化';
}
/** Exact adopted field evidence only; never guess an old value from a different record. */
export function profileChangeValues(lead:any,hint:any,events:any[]=[]):{before:any;after:any}|null{
 const field=hint.id?.startsWith('change:')?hint.id.slice(7):null;if(!field)return null;
 for(const id of hint.evidenceIds||[]){const event=locateLedgerEvent(events,id);if(event?.eventType!=='profile.fields_updated')continue;const change=event.payload?.changes?.find((c:any)=>c.field===field&&c.applied===true&&Object.hasOwn(c,'before')&&Object.hasOwn(c,'after')&&sameProfileValue(field,c.after,lead[field]));if(change)return {before:change.before,after:change.after};}
 return null;
}

/** Source labels use recorded entry types, never the request wording or guessed channel. */
export function requestSourceLabel(request:any):string{
 const source=request?.data?.source;
 if(['standalone_chat','homepage_widget','homepage_floating_chatbot'].includes(source))return '客户对话原文';
 return !source||source==='legacy_unknown'?'来源未注明':'来源待识别';
}
