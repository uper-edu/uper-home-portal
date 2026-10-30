import type {HistoryGroup} from './crmHistoryTimeline';
import type {HistoryInformation,HistoryCitation} from './crmHistoryInformation';
import {historyRecordCorrections} from './crmHistoryCardContent';
import {historyQuoteRange,historyCitationKey} from './crmHistoryInformation';
import {sameProfileValue} from './crmFieldValues';
import {signalLabels} from './crmExtractionContract';
import {profileFields} from './crmDynamicProfile';

export type HistorySalesPoint={id:string;field:string;label:string;value:any;before?:any;showBefore:boolean;kind:'request'|'concern'|'change'|'context';qualifiers:string[];citations:HistoryCitation[];scope:string;item:HistoryInformation};
const signalNames:Record<string,string>={price_inquiry:'价格咨询',schedule_inquiry:'上课时间咨询',advisor_request:'顾问联系',assessment_interest:'测评意向',trial_interest:'试听意向',enrollment_interest:'报名意向',trial_request:'试听请求',enrollment_request:'报名请求'};
const temporalWords:Record<string,string>={past:'历史表达',future:'未来表达',conditional:'条件表达',uncertain:'尚不确定',negated:'否定表达'};
const pointKey=(point:HistorySalesPoint)=>JSON.stringify([point.scope,point.kind,point.field,point.qualifiers]);

/** Reads saved, source-linked observations only. No text matching, semantic classification,
 * new extraction, current-profile lookup or operational request-state inference. */
export function historySalesPoints(group:HistoryGroup,items:HistoryInformation[]):HistorySalesPoint[]{
 if(!['message','sales'].includes(group.category))return [];
 const corrections=historyRecordCorrections(group,items),result:HistorySalesPoint[]=[];
 for(const item of items){
  if(item.superseded||item.value===undefined||!['signal','field','insight','legacy_signal'].includes(item.kind)||item.status==='unknown')continue;
  if(item.kind==='field'&&!Object.hasOwn(profileFields,item.field))continue;
  if(corrections.some(c=>c.kind===item.kind&&c.field===item.field))continue;
  if(item.manualSourceId&&item.aiReferences.length)continue;
  const o=item.observation;
  let citations=item.citations;
  if(o){
   if(o.subject!=='customer'||!['current','past','future','conditional','uncertain','negated'].includes(o.temporality))continue;
   // Only a quote traceable to this exact root/amendment can enter the business summary.
   const source=item.scope==='main'?group.original:group.events.find(e=>e.eventType==='record.amended'&&(e.payload?.id||e.eventId)===item.scope);
   const text=typeof source==='string'?source:source?.original||source?.payload?.text||'';
   citations=item.citations.filter(c=>c.scope===item.scope&&c.sourceText===text&&typeof c.quote==='string'&&c.quote.trim()!==''&&!!historyQuoteRange(text,c));
   if(!citations.length)continue;
  }else{
   const own=item.kind==='legacy_signal'?group.log?.buyingSignalsDetected?.includes(item.value):item.scope==='main'?!!group.log?.id&&item.manualSourceId===group.log.id:group.events.some(e=>e.eventType==='record.amended'&&(e.payload?.id||e.eventId)===item.scope&&e.payload?.id===item.manualSourceId);
   if(!own||!item.sources.includes('人工填写')||!['applied','recorded'].includes(item.status))continue;
  }
  if(item.kind==='signal'&&(!o||o.value!==true||!signalNames[item.field]))continue;
  const qualifiers:string[]=[];
  if(item.scope!=='main')qualifiers.push(group.events.some(e=>e.eventType==='record.amended'&&(e.payload?.id||e.eventId)===item.scope&&e.payload?.kind==='correction')?'修正说明':'后续补充');
  const withdrawing=o?.operation==='withdraw'||o?.operation==='remove';
  if(withdrawing)qualifiers.push('撤回说明');
  if(o&&temporalWords[o.temporality]&&(!withdrawing||o.temporality!=='negated'))qualifiers.push(temporalWords[o.temporality]);
  if(item.status==='difference')qualifiers.push('与资料不同');
  if(['review','suggestion'].includes(item.status))qualifiers.push('仅作参考');
  if(item.status==='tentative'||o?.basis==='inferred')qualifiers.push('AI推断');
  if(o?.operation==='add')qualifiers.push('本次补充');
  const changed=item.status==='applied'&&o?.change==='changed'&&o?.temporality==='current';
  const kind=item.kind==='signal'||item.kind==='legacy_signal'?'request':item.field==='concerns'?'concern':changed?'change':'context';
  const label=item.kind==='signal'?'诉求与意向':item.kind==='legacy_signal'?'当次记录的意向':['goal','goals'].includes(item.field)?'学习目标':item.label;
  // Applied list values may contain older entries; the saved observation is this record's statement.
  const value=item.kind==='signal'?(o.temporality==='current'?signalLabels[item.field]:signalNames[item.field]):item.kind==='field'&&['add','remove'].includes(o?.operation)?o.value:item.value;
  const next:HistorySalesPoint={id:item.id,field:item.field,label,value,before:item.before,showBefore:changed&&item.beforeKnown&&item.before!=null&&!['add','remove'].includes(o?.operation),kind,qualifiers,citations,scope:item.scope,item};
  const duplicate=result.find(p=>pointKey(p)===pointKey(next)&&p.showBefore===next.showBefore&&sameProfileValue(item.field,p.before,next.before)&&sameProfileValue(item.field,p.value,next.value));
  if(duplicate){duplicate.citations=[...new Map([...duplicate.citations,...next.citations].map(c=>[historyCitationKey(c),c])).values()];continue;}
  result.push(next);
 }
 // Exact same-source goal values share a row; different values/qualifiers retain their evidence.
 const goals=result.filter(p=>p.kind==='context'&&['goal','goals'].includes(p.field));
 for(const goal of goals){
  if(!result.includes(goal))continue;
  const peers=goals.filter(p=>result.includes(p)&&p.scope===goal.scope&&JSON.stringify(p.qualifiers)===JSON.stringify(goal.qualifiers));
  if(peers.length<2)continue;
  const values=peers.flatMap(p=>Array.isArray(p.value)?p.value:[p.value]);
  if(!values.every(v=>typeof v==='string'))continue;
  goal.label='学习目标';goal.value=[...new Set(values)];goal.citations=[...new Map(peers.flatMap(p=>p.citations).map(c=>[historyCitationKey(c),c])).values()];
  for(const peer of peers)if(peer!==goal)result.splice(result.indexOf(peer),1);
 }
 const stronger:Record<string,string>={trial_interest:'trial_request',enrollment_interest:'enrollment_request'};
 const contextFields=['goal','goals','budgetAmount','availability','preferredStart','hskExamPlan','mode','communicationLanguage','preferredChannel','city'];
 const contextRank=(point:HistorySalesPoint)=>{const index=contextFields.indexOf(point.field);return index<0?contextFields.length:index;};
 return result.filter(p=>!stronger[p.field]||!result.some(other=>other.field===stronger[p.field]&&other.scope===p.scope&&JSON.stringify(other.qualifiers)===JSON.stringify(p.qualifiers)&&other.citations.some(c=>p.citations.some(old=>historyCitationKey(c)===historyCitationKey(old)))))
  .sort((a,b)=>({request:0,concern:1,change:2,context:3}[a.kind])-({request:0,concern:1,change:2,context:3}[b.kind])||(a.kind==='context'&&b.kind==='context'?contextRank(a)-contextRank(b):0));
}
