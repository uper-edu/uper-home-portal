import {questionnaireAnswers} from '../../src/utils/crmQuestionnaireEvidence.ts';
import {assessmentOccurrence as assessmentTime,establishedFactMilestones} from './factMilestones.ts';
import {isSalesProgressStage} from '../../src/utils/crmSalesProgress.ts';
import {activeExtractionEvidence} from '../../src/utils/crmExtractionEvidence.ts';
import {stageEventLabels} from '../../src/utils/crmExtractionContract.ts';
const invalid=(message:string,status=400):never=>{throw Object.assign(Error(message),{status});};
const iso=(v:any)=>{if(!v)return null;const d=new Date(typeof v==='string'&&!/(Z|[+-]\d\d:\d\d)$/.test(v)?v.replace(' ','T')+'Z':v);return Number.isFinite(d.getTime())?d.toISOString():null;};
export async function salesProgressContext(c:any,leadId:string,profile:any){
 const facts=(await c.query("SELECT * FROM crm_facts WHERE (lead_id=:p1 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) ORDER BY created_at DESC,id DESC",[leadId])).rows;
 const messages=(await c.query("SELECT m.id,m.content,m.created_at,m.conversation_id FROM messages m JOIN conversations v ON v.id=m.conversation_id WHERE (v.lead_id=:p1 OR v.lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) AND m.role='user' ORDER BY m.created_at DESC,m.id DESC",[leadId])).rows;
 const attempts=(await c.query("SELECT id,result,created_at FROM hsk_attempts WHERE (lead_id=:p1 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) ORDER BY created_at DESC,id DESC",[leadId])).rows;
 const extractions=(await c.query("SELECT * FROM crm_ai_extractions WHERE (lead_id=:p1 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) ORDER BY created_at,id",[leadId])).rows;
 const campaigns=(await c.query('SELECT id,code,config FROM trial_campaigns')).rows;
 const sources:any[]=[
  ...(profile.followUpLogs||[]).map((l:any)=>({type:'sales_record',id:l.id,label:'销售记录',text:l.summary||'',occurredAt:iso(l.occurredAt),recordedAt:iso(l.at||l.timestamp),timeBasis:'staff_reported'})),
  ...messages.map((m:any)=>({type:'customer_message',id:m.id,label:'客户对话',text:m.content,occurredAt:null,receivedAt:iso(m.created_at),recordedAt:iso(m.created_at),timeBasis:'received'})),
  ...attempts.map((a:any)=>({type:'assessment',id:a.id,label:'真实测评记录',text:JSON.stringify(a.result||{}),occurredAt:assessmentTime(a),receivedAt:iso(a.created_at),recordedAt:iso(a.created_at),timeBasis:'reported_completion'})),
  ...facts.filter((f:any)=>f.kind==='questionnaire.submitted').map((f:any)=>({type:'fact',id:f.id,label:'客户问卷',sourceKind:'questionnaire',questionnaire:questionnaireAnswers({answers:{...f.data.answers,campaignName:f.data.answers?.campaignName||campaigns.find((v:any)=>[v.id,v.code].includes(f.data.answers?.campaignId))?.config?.name}}),submittedAt:f.data.answers?.submittedAt||null,text:'',occurredAt:null,receivedAt:iso(f.created_at),recordedAt:iso(f.created_at),timeBasis:'received'}))
 ];
 // Corrections have their own exact text and record identity. The original interaction remains linked separately.
 for(const a of profile.recordAmendments||[]){const root=sources.find(s=>s.id===(a.targetLogId||a.targetFactId));sources.push({type:'sales_amendment',id:a.id,label:a.kind==='correction'?'销售修正':'销售补充',text:a.text||'',occurredAt:root?.occurredAt||null,recordedAt:iso(a.recordedAt),timeBasis:'linked_interaction',relatedBasis:root?{type:root.type,id:root.id}:null});}
 for(const row of extractions.filter((r:any)=>r.source_type==='sales_amendment')){if(sources.some(s=>s.type==='sales_amendment'&&s.id===row.source_id))continue;const root=row.input?.sourceRoot;const original=sources.find(s=>s.type===root?.type&&s.id===root?.id);sources.push({type:'sales_amendment',id:row.source_id,label:row.input?.amendment?.kind==='correction'?'销售修正':'销售补充',text:row.input?.text||'',occurredAt:iso(root?.occurredAt),recordedAt:iso(row.created_at),timeBasis:'linked_interaction',relatedBasis:original?{type:original.type,id:original.id}:null});}
 const history=facts.filter((f:any)=>f.kind==='stage.changed').map((f:any)=>({id:f.id,actor:f.actor,before:f.data.before,after:f.data.after,reason:f.data.reason||'',occurredAt:iso(f.data.effectiveAt),recordedAt:iso(f.created_at),basis:(f.data.basis||[]).map((s:any)=>({...s,amendments:(profile.recordAmendments||[]).filter((a:any)=>a.targetLogId===s.id||a.targetFactId===s.id).map((a:any)=>({id:a.id,kind:a.kind,text:a.text,reason:a.reason,recordedAt:a.recordedAt}))})),enrollmentConfirmed:f.data.enrollmentConfirmed===true}));
 const milestones:any[]=establishedFactMilestones(attempts,facts);
 for(const [index,e] of activeExtractionEvidence(extractions).entries()){const o=e.observation;if(e.supersededBy||o.kind!=='stage_event')continue;const source=sources.find(s=>s.type===e.row.source_type&&s.id===e.row.source_id);milestones.push({id:e.row.id+':'+o.field+':'+index,title:stageEventLabels[o.field]||o.field,source:source?.label||'原始来源待核对',aiDerived:true,occurredAt:source?.occurredAt||null,receivedAt:source?.receivedAt||null,timeBasis:source?.timeBasis||'unknown',recordedAt:iso(e.row.created_at),text:o.quote,temporality:o.temporality,basis:source?{type:source.type,id:source.id}:null,relatedBasis:source?.relatedBasis||null});}
 for(const f of facts.filter((f:any)=>f.kind==='sales.stage_observed'))milestones.push({id:f.id,title:'历史阶段事实',stage:f.data.stage,source:'销售记录',text:f.data.summary||'',occurredAt:iso(f.data.occurredAt),timeBasis:'staff_reported',recordedAt:iso(f.created_at),basis:{type:'sales_record',id:f.data.sourceLogId}});
 return {sources,history,establishedMilestones:milestones.filter(m=>m.established===true),milestones:milestones.sort((a,b)=>(Date.parse(b.occurredAt||'')||0)-(Date.parse(a.occurredAt||'')||0)),current:{stage:profile.currentStage,version:profile.stageRevision||0,effectiveAt:profile.stageEffectiveAt??null,recordedAt:profile.stageUpdatedAt||null}};
}
export async function validateSalesProgress(c:any,leadId:string,current:any,b:any){
 if(!isSalesProgressStage(b.newStage))invalid('请选择新的七阶段；旧阶段仅保留展示');
 if(b.expectedStage!==current.currentStage||b.expectedStageRevision!==(current.stageRevision||0))invalid('Stage changed; refresh and review',409);
 if(!['now','specified','unknown'].includes(b.effectiveTimeMode))invalid('请选择阶段实际生效时间或明确未知');
 let effectiveAt:string|null=null;if(b.effectiveTimeMode==='specified'){if(typeof b.effectiveAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(b.effectiveAt)||!iso(b.effectiveAt)||iso(b.effectiveAt)!.slice(0,19)!==b.effectiveAt.slice(0,19)||Date.parse(b.effectiveAt)>Date.now()+60000)invalid('阶段生效时间无效或晚于当前时间');effectiveAt=iso(b.effectiveAt);}
 if(b.effectiveTimeMode==='now'&&b.effectiveAt!=null)invalid('选择现在时无需提供客户端时间');
 if(typeof b.reason!=='string'||b.reason.length>2000)invalid('阶段说明格式不正确');
 if(!Array.isArray(b.basisRefs)||b.basisRefs.length>5)invalid('最多关联五条依据');
 const context=await salesProgressContext(c,leadId,current),basis:any[]=[];
 for(const ref of b.basisRefs){if(!ref||!['sales_record','sales_amendment','customer_message','assessment','fact'].includes(ref.type)||typeof ref.id!=='string')invalid('依据格式不正确');if(basis.some(s=>s.type===ref.type&&s.id===ref.id))invalid('依据不能重复');const source=context.sources.find(s=>s.type===ref.type&&s.id===ref.id);if(!source)invalid('依据不属于当前客户或已不可用',404);basis.push(source);}
 if(!basis.length&&!b.reason.trim())invalid('请关联原始依据或填写具体事实说明');
 if(b.newStage==='progress:enrolled'&&b.enrollmentConfirmed!==true)invalid('请明确确认报名已成立；意向不等于报名');
 if(b.enrollmentScope!==undefined&&(b.newStage!=='progress:enrolled'||b.enrollmentScope!=='course'))invalid('正式课程报名与试听预约不能混用');
 const reason=b.reason.trim()||'依据已关联的原始记录确认当前推进阶段',recordedAt=new Date().toISOString();
 if(b.effectiveTimeMode==='now')effectiveAt=recordedAt;
 return {before:current.currentStage,after:b.newStage,reason,effectiveAt,recordedAt,basis,enrollmentConfirmed:b.newStage==='progress:enrolled',...(b.newStage==='progress:enrolled'&&b.enrollmentScope==='course'?{enrollmentScope:'course'}:{}),schema:2};
}
