import {buildHistoryTimeline,historyGroupFor} from './crmHistoryTimeline';
import {crmInstant} from './crmOperatingTime';
import {signalLabels} from './crmExtractionContract';
/** Presentation grouping only. Identical wording is never a source identity. */
export function groupFollowupInteractions(points:any[],lead:any,events:any[],rows:any[]){
 const history=buildHistoryTimeline(events,lead,rows),groups=new Map<string,any>(),output:any[]=[];
 for(const point of points){
  let ids:string[]=[];
  if(point.kind==='message')ids=[point.value.id||point.value.request_id];
  else if(point.kind==='communication')ids=[point.value.id];
  else if(point.kind==='changes')ids=[point.commonEvidenceId];
  else if(point.kind==='hint'&&['change','evidence'].includes(point.value.kind))ids=point.value.evidenceIds||[];
  else if(point.kind==='request'){const d=point.value.data||{};ids=[d.messageId||d.sourceMessageId||point.value.source_id||point.value.id];}
  const id=ids.length===1&&ids[0],amendment=id&&(rows.some(r=>r.source_id===id&&r.source_type==='sales_amendment')||events.some(e=>e.eventId===id&&(e.eventType==='record.amended'||e.payload?.sourceType==='sales_amendment')));
  const origin=id&&!amendment?historyGroupFor(history,id):null;
  if(!origin||point.times.length!==1){output.push(point);continue;}
  const at=point.times[0].at?crmInstant(point.times[0].at)?.toISOString()||null:null;
  const key=JSON.stringify([origin.id,at]);let group=groups.get(key);
  if(!group){group={...point,kind:'interaction',id:'interaction:'+key,origin,parts:[],times:point.times};groups.set(key,group);output.push(group);}
  group.parts.push(point);
 }
 return output.map(p=>{
  if(p.kind!=='interaction')return p;
  if(p.parts.length===1)return p.parts[0];
  const labels=[...new Set<string>(p.parts.flatMap((v:any)=>v.kind==='hint'&&v.value.kind==='evidence'?[signalLabels[v.value.id?.replace('text-signal:','')]||v.value.text.split(' · ')[0]]:v.kind==='request'?['客户明确诉求']:v.kind==='communication'?['有效沟通']:v.kind==='changes'||v.kind==='hint'&&v.value.kind==='change'?['资料更新']:[]))];
  return {...p,title:labels.join('、')||(p.origin.category==='message'?'客户对话':'沟通记录'),evidenceId:p.origin.root?.eventId||p.origin.aliases[0]};
 });
}
