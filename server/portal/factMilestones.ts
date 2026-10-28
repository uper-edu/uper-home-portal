import {identityProjectionRows} from './identityConsolidation.ts';
import {groupFactMilestones} from '../../src/utils/crmFactMilestones.ts';
const iso=(v:any)=>{if(!v)return null;const d=new Date(typeof v==='string'&&!/(Z|[+-]\d\d:\d\d)$/.test(v)?v.replace(' ','T')+'Z':v);return Number.isFinite(d.getTime())?d.toISOString():null;};
/** Occurrence is never inferred from ingestion, extraction or profile save time. */
export function assessmentOccurrence(a:any){const r=a.result||{},completed=iso(r.attempt?.completedAt),started=iso(r.attempt?.startedAt),received=iso(a.created_at);return completed&&received&&Date.parse(completed)<=Date.parse(received)+60000&&(!started||Date.parse(completed)>=Date.parse(started))?completed:null;}
/** One established-event projector for both the worklist and detail evidence. */
export function establishedFactMilestones(attempts:any[],facts:any[]){return [
 ...attempts.map(a=>({id:'assessment:'+a.id,established:true,factType:'assessment',title:'完成测评',source:'真实测评记录',occurredAt:assessmentOccurrence(a),receivedAt:iso(a.created_at),timeBasis:'reported_completion',recordedAt:iso(a.created_at),text:'测评结果以此原始记录为准',basis:{type:'assessment',id:a.id},data:a.result})),
 ...facts.filter(f=>f.kind==='stage.changed'&&f.data?.schema===2&&f.data.after==='progress:enrolled'&&f.data.enrollmentConfirmed===true).map(f=>({id:'enrollment:'+f.id,established:true,factType:'enrollment_confirmation',title:'人工确认报名成立',source:'销售明确确认',enrollmentScope:f.data.enrollmentScope==='course'?'course':undefined,occurredAt:iso(f.data.effectiveAt),timeBasis:'staff_reported',recordedAt:iso(f.created_at),text:f.data.reason||'',basisSnapshots:f.data.basis||[]}))
];}
/** Caller supplies only already-authorized profiles. Batch reads avoid a request per list row. */
export async function attachFactMilestones(db:any,profiles:any[]){
 if(!profiles.length)return;
 const ids=JSON.stringify(profiles.map(p=>p.id));
 const attempts=(await identityProjectionRows(db,profiles,'SELECT id,lead_id,result,created_at FROM hsk_attempts WHERE JSON_CONTAINS(:p1,JSON_QUOTE(lead_id)) ORDER BY created_at DESC,id DESC'));
 const facts=(await identityProjectionRows(db,profiles,"SELECT id,lead_id,kind,data,created_at FROM crm_facts WHERE JSON_CONTAINS(:p1,JSON_QUOTE(lead_id)) AND kind='stage.changed' ORDER BY created_at DESC,id DESC"));
 for(const profile of profiles){
  const own=attempts.filter((a:any)=>a.lead_id===profile.id);
  const groups=groupFactMilestones(establishedFactMilestones(own,facts.filter((f:any)=>f.lead_id===profile.id)));
  profile.factMilestoneSummary=groups.map(g=>({key:g.key,title:g.title,enrollmentScope:g.enrollmentScope,count:g.count,unknownCount:g.unknownCount,latest:{id:g.latest.id,occurredAt:g.latest.occurredAt,timeBasis:g.latest.timeBasis}}));
  // Read-only repair of a stale/missing display cache; never persist, regrade or alter Tier/stage.
  const latestAssessment=groups.find(g=>g.key.startsWith('assessment:'))?.latest;
  if(latestAssessment)profile.latestAssessment=latestAssessment.data;
 }
}
