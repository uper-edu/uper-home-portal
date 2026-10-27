import {historyChanges,type HistoryGroup} from './crmHistoryTimeline';
import {profileFields} from './crmDynamicProfile';
import {sameProfileValue} from './crmFieldValues';
import {activeExtractionEvidence,observationKey} from './crmExtractionEvidence';
import {signalLabels,stageEventLabels} from './crmExtractionContract';
export type HistoryCitation={id:string;scope:string;quote:string;start?:number;sourceText:string};
export type HistoryInformation={id:string;scope:string;kind:string;field:string;label:string;value:any;before?:any;beforeKnown:boolean;retainedValue?:any;retainedKnown:boolean;status:string;sources:string[];reasons:string[];citations:HistoryCitation[];factIds:string[];extractionIds:string[];superseded:boolean;observation?:any;manualSourceId?:string;aiReferences:{value:any;reason:string}[]};
const unique=(xs:string[])=>[...new Set(xs.filter(Boolean))];
export function historyExtractionScope(group:HistoryGroup,row:any){
 if(row.source_type!=='sales_amendment')return 'main';
 const event=group.events.find(e=>e.eventType==='record.amended'&&[e.eventId,e.payload?.id,e.sourceRecordId].includes(row.source_id));
 return event?(event.payload?.id||event.eventId):'sales_amendment:'+row.source_id;
}
/** Projection only: never consult current profile values to reconstruct a past save. */
export function historyInformation(group:HistoryGroup,allRows:any[]=group.extractions){
 const items:HistoryInformation[]=[],rows=group.extractions||[],events=group.events||[];
 const amendments=events.filter(e=>e.eventType==='record.amended');
 const amendmentIds=new Map<string,string>();for(const a of amendments){for(const id of [a.eventId,a.payload?.id,a.sourceRecordId].filter(Boolean))amendmentIds.set(id,a.payload?.id||a.eventId);}
 const scopeForId=(id:string)=>amendmentIds.get(id)||'main';
 const rowScope=(r:any)=>historyExtractionScope(group,r);
 const aiFactIds=(r:any)=>{if(r.output?.eventId)return [r.output.eventId];const matches=events.filter(e=>e.eventType==='information.extracted'&&e.payload?.sourceId===r.source_id);return matches.length===1?[matches[0].eventId]:[];};
 const linkedRows=(e:any)=>{
  const ids=e.payload?.basisFactIds||[];
  const exact=rows.filter(r=>aiFactIds(r).some(id=>ids.includes(id)));if(exact.length)return exact;
  const bySource=rows.filter(r=>r.source_id===e.payload?.sourceRecordId);
  return bySource.length===1?bySource:[];
 };
 const add=(data:Partial<HistoryInformation>&Pick<HistoryInformation,'id'|'field'|'value'>)=>{const item:HistoryInformation={scope:'main',kind:'field',label:profileFields[data.field]||data.field,beforeKnown:false,retainedKnown:false,status:'recorded',sources:[],reasons:[],citations:[],factIds:[],extractionIds:[],superseded:false,aiReferences:[],...data};items.push(item);return item;};
 for(const event of events){
  const links=linkedRows(event),scope=links.length===1?rowScope(links[0]):scopeForId(event.payload?.sourceRecordId||event.payload?.basisFactIds?.find((id:string)=>amendmentIds.has(id)));
  historyChanges(event).forEach((c:any,i:number)=>add({id:event.eventId+':'+i,scope,field:c.field,value:c.applied===false?c.observation:c.after,before:c.before,beforeKnown:Object.hasOwn(c,'before'),retainedValue:c.applied===false?c.before:undefined,retainedKnown:c.applied===false&&Object.hasOwn(c,'before'),status:c.applied===false?'difference':c.applied===true?'applied':'unknown',manualSourceId:event.actor!=='ai'&&!String(event.payload?.sourceType||'').startsWith('ai_')?event.payload?.sourceRecordId:undefined,sources:[event.actor==='ai'||String(event.payload?.sourceType||'').startsWith('ai_')?'AI提取':event.actor==='visitor'||event.payload?.sourceType==='questionnaire'?'客户问卷':'人工填写'],reasons:c.reason?[c.reason]:[],factIds:[event.eventId],extractionIds:links.map(r=>r.id)}));
 }
 const manual=[{scope:'main',sourceId:group.log?.id,results:group.log?.result?.profileFieldResults,updates:group.log?.profileUpdates},...amendments.map(a=>({scope:a.payload?.id||a.eventId,sourceId:a.payload?.id,results:a.payload?.profileFieldResults,updates:a.payload?.profileUpdates}))];
 for(const source of manual){
  for(const [i,r]of (source.results||[]).entries()){
   const value=r.status==='difference'?r.requestedValue:r.currentValue;
   const matches=items.filter(item=>item.scope===source.scope&&item.field===r.field&&item.status===r.status&&sameProfileValue(r.field,item.value,value)&&item.factIds.some(id=>{const p=events.find(e=>e.eventId===id)?.payload;return p?.sourceRecordId===source.sourceId||(p?.basisFactIds||[]).some((id:string)=>amendmentIds.get(id)===source.scope);}));
   const item=matches.length===1?matches[0]:add({id:'save:'+source.scope+':'+i,scope:source.scope,field:r.field,value,status:r.status,sources:['人工填写']});
   if(r.status==='difference'){item.retainedValue=r.currentValue;item.retainedKnown=Object.hasOwn(r,'currentValue');}
   item.manualSourceId=source.sourceId;item.reasons=unique([...item.reasons,r.reason]);
  }
  if(!source.results?.length)for(const[field,value]of Object.entries(source.updates||{})){
   if(items.some(item=>item.scope===source.scope&&item.field===field&&sameProfileValue(field,item.value,value)&&item.factIds.some(id=>events.find(e=>e.eventId===id)?.payload?.sourceRecordId===source.sourceId)))continue;
   add({id:'legacy:'+source.scope+':'+field,scope:source.scope,field,value,manualSourceId:source.sourceId,status:'unknown',sources:['人工填写'],reasons:['本次记录包含此值，未找到明确的保存采用结果']});
  }
 }
 const active=activeExtractionEvidence(allRows||[]);
 for(const row of rows.filter(r=>r.status==='completed')){
  (row.output?.observations||[]).forEach((o:any,i:number)=>{
   const superseded=!!active.find(e=>e.row.id===row.id&&observationKey(e.observation)===observationKey(o)&&e.observation.quote===o.quote)?.supersededBy,scope=rowScope(row);
   const linked=items.filter(item=>o.kind==='field'&&item.scope===scope&&item.field===o.field&&item.extractionIds.includes(row.id)&&sameProfileValue(o.field,item.value,o.value)&&item.status===({apply:'applied',difference:'difference'}as any)[o.decision]);
   const explicitCandidates=items.filter(item=>o.kind==='field'&&item.scope===scope&&item.field===o.field&&row.input?.explicitFields?.includes(o.field)&&item.sources.includes('人工填写')&&item.manualSourceId===row.source_id);const sameExplicit=explicitCandidates.filter(item=>sameProfileValue(o.field,item.value,o.value));const explicit=sameExplicit.length===1?sameExplicit:explicitCandidates;
   const item=linked.length===1?linked[0]:!linked.length&&explicit.length===1?explicit[0]:add({id:'ai:'+row.id+':'+i,scope,kind:o.kind,field:o.field,label:profileFields[o.field]||signalLabels[o.field]||stageEventLabels[o.field]||'约定建议',value:o.value,status:({apply:'applied',difference:'difference',evidence:'evidence',suggestion:'suggestion'}as any)[o.decision]||'unknown',observation:o});
   if(explicit.includes(item)&&!sameProfileValue(o.field,item.value,o.value)&&!item.aiReferences.some(ref=>sameProfileValue(o.field,ref.value,o.value)&&ref.reason===o.reason))item.aiReferences.push({value:o.value,reason:o.reason||'仅供参考，未覆盖人工填写'});
   item.observation=o;item.superseded=superseded;item.extractionIds=unique([...item.extractionIds,row.id]);item.sources=unique([...item.sources,item.sources.includes('人工填写')&&row.input?.explicitFields?.includes(o.field)?'AI参考':'AI提取']);item.reasons=unique([...item.reasons,o.reason]);
   if(o.quote){const citation={id:row.source_type+':'+row.source_id+':'+o.quote,scope,quote:o.quote,start:o.start,sourceText:row.input?.text||''};if(!item.citations.some(c=>c.id===citation.id))item.citations.push(citation);}
  });
 }
 const stages=new Set<string>();
 for(const stage of group.log?.stageObservations||[]){stages.add(stage);add({id:'legacy-stage:'+stage,field:stage,kind:'legacy_stage',label:'阶段事实',value:stage,status:'recorded',sources:['人工填写']});}
 for(const event of events.filter(e=>e.eventType==='sales.stage_observed')){if(stages.has(event.payload?.stage)&&event.payload?.sourceLogId===group.log?.id)continue;add({id:event.eventId,field:event.payload?.stage,kind:'legacy_stage',label:'阶段事实',value:event.payload?.stage,status:'recorded',sources:['人工填写'],factIds:[event.eventId]});}
 for(const signal of group.log?.buyingSignalsDetected||[]){
  const field=({"Asked price":'price_inquiry',"Asked schedule":'schedule_inquiry'}as Record<string,string>)[signal];
  const matches=field?items.filter(item=>item.scope==='main'&&item.kind==='signal'&&item.field===field&&item.observation?.subject==='customer'&&item.observation?.temporality==='current'&&item.extractionIds.some(id=>rows.some(r=>r.id===id&&r.source_type==='sales_record'&&r.source_id===group.log?.id))):[];
  if(matches.length===1)matches[0].sources=unique([...matches[0].sources,'人工填写']);
  else add({id:'legacy-signal:'+signal,field:signal,kind:'legacy_signal',label:'观察到的信号',value:signal,status:'recorded',sources:['人工填写']});
 }
 return items;
}
/** Use the validated offset or a unique verbatim match; never guess between repeated passages. */
export function historyQuoteRange(text:string,citation:HistoryCitation){
 if(Number.isInteger(citation.start)&&text.slice(citation.start,citation.start!+citation.quote.length)===citation.quote)return {start:citation.start!,end:citation.start!+citation.quote.length};
 const start=text.indexOf(citation.quote);return citation.quote&&start>=0&&text.indexOf(citation.quote,start+1)<0?{start,end:start+citation.quote.length}:null;
}

/** Common captions require one proven source and consecutive equal states; never merge records. */
export function historyInformationBatches(group:HistoryGroup,items:HistoryInformation[]){
 const origin=(item:HistoryInformation)=>{
  if(item.extractionIds?.length){const roots=[...new Set(item.extractionIds.map(id=>(group.extractions||[]).find(r=>r.id===id)).map(r=>r?.source_type&&r?.source_id?JSON.stringify([r.source_type,r.source_id]):''))];return roots.length===1?roots[0]:'';}
  if(item.manualSourceId)return JSON.stringify(['record',item.manualSourceId]);
  const roots=[...new Set((item.factIds||[]).map(id=>(group.events||[]).find(e=>e.eventId===id)?.payload).map(p=>p?.sourceRecordId?JSON.stringify(['record',p.sourceRecordId]):p?.basisFactIds?.length===1?JSON.stringify(['fact',p.basisFactIds[0]]):''))];
  return roots.length===1?roots[0]:'';
 };
 const key=(i:HistoryInformation)=>{const source=origin(i);return source?JSON.stringify([i.scope,source,[...i.sources].sort(),i.status,i.superseded,i.observation?.temporality||'',i.observation?.subject||'']):null;};
 const batches:{items:HistoryInformation[];shared:boolean;sharedReasons:boolean;key:string|null}[]=[];
 for(const item of items){const k=key(item),last=batches.at(-1);if(k&&last?.key===k)last.items.push(item);else batches.push({items:[item],shared:false,sharedReasons:false,key:k});}
 for(const b of batches){b.shared=b.items.length>1;b.sharedReasons=b.shared&&b.items[0].status==='applied'&&b.items[0].reasons.length>0&&b.items.every(i=>JSON.stringify(i.reasons)===JSON.stringify(b.items[0].reasons));}
 return batches;
}
export function historyFieldCount(group:HistoryGroup){return new Set(group.events.flatMap(historyChanges).map((c:any)=>c.field)).size;}
export function historyAmendmentTitle(amendment:any,items:HistoryInformation[]){
 const scope=amendment.payload?.id||amendment.eventId;
 const labels=[...new Set(items.filter(i=>i.scope===scope).map(i=>i.label))];
 if(amendment.payload?.contactResult)labels.push('联系结果');
 return {kind:amendment.payload?.kind==='correction'?'修正':'补充',labels:[...new Set(labels)]};
}

/** Presentation-only duplicate goals: retain both complete result records and every citation. */
export type HistoryDisplayInformation=HistoryInformation&{displayMembers?:HistoryInformation[]};
export function historyDisplayInformation(group:HistoryGroup,items:HistoryInformation[]):HistoryDisplayInformation[]{
 const replacements=new Map<HistoryInformation,HistoryDisplayInformation>(),hidden=new Set<HistoryInformation>();
 const equalGoal=(a:any,b:any)=>{const values=(v:any)=>typeof v==='string'&&v!==''?[v]:Array.isArray(v)&&v.length&&v.every(x=>typeof x==='string'&&x!=='')?v:null;const x=values(a),y=values(b);return !!x&&!!y&&JSON.stringify([...x].sort())===JSON.stringify([...y].sort());};
 for(const batch of historyInformationBatches(group,items).filter(b=>b.shared)){
  const primary=batch.items.filter(i=>i.kind==='field'&&i.field==='goal'),other=batch.items.filter(i=>i.kind==='field'&&i.field==='goals');
  if(primary.length!==1||other.length!==1)continue;
  const a=primary[0],b=other[0];
  if(a.status!=='applied'||!equalGoal(a.value,b.value)||!a.beforeKnown||!b.beforeKnown||!(a.before===null&&b.before===null||equalGoal(a.before,b.before))||JSON.stringify(a.reasons)!==JSON.stringify(b.reasons)||JSON.stringify(a.aiReferences)!==JSON.stringify(b.aiReferences))continue;
  const first=batch.items.indexOf(a)<batch.items.indexOf(b)?a:b,last=first===a?b:a;
  const citations=[...new Map([...a.citations,...b.citations].map(c=>[historyCitationKey(c),c])).values()];
  replacements.set(first,{...a,id:first.id,label:'学习目标',citations,factIds:unique([...a.factIds,...b.factIds]),extractionIds:unique([...a.extractionIds,...b.extractionIds]),displayMembers:[a,b]});hidden.add(last);
 }
 return items.filter(i=>!hidden.has(i)).map(i=>replacements.get(i)||i);
}
export const historyCitationKey=(c:HistoryCitation)=>JSON.stringify([c.scope,c.quote,c.start??null,c.sourceText]);
export function historySharedCitations(items:HistoryInformation[]){
 const refs=new Map<string,{key:string;citation:HistoryCitation;items:HistoryInformation[]}>();
 for(const item of items)for(const c of item.citations){const key=historyCitationKey(c);if(!refs.has(key))refs.set(key,{key,citation:c,items:[]});const ref=refs.get(key)!;if(!ref.items.includes(item))ref.items.push(item);}
 return [...refs.values()].filter(r=>r.items.length>1);
}
/** Remove only a known rule explanation from sales presentation, never a specific business reason. */
export function historyBusinessReasons(item:HistoryInformation){return item.reasons.filter(r=>r!=='有原文依据的行为／诉求，不代表已处理或成交');}
