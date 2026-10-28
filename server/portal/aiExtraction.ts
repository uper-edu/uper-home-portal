import {naturalRequestActions} from '../../src/utils/crmNaturalRequests.ts';
import {explicitAdvisorRequest} from '../../src/utils/crmAdvisorRequest.ts';
import {createHash,randomUUID} from 'node:crypto';
import {EXTRACTION_VERSION,extractionInstruction,stageEventInstruction,naturalRequestInstruction,validateExtraction,extractionDecision} from '../../src/utils/crmExtractionContract.ts';
import {profileFields} from '../../src/utils/crmDynamicProfile.ts';
import {recordProfileUpdates} from './dynamicProfile.ts';
import {fact} from './trustWorkflow.ts';
import {extractionFamily,extractionRoot} from '../../src/utils/crmExtractionEvidence.ts';
import {sameProfileValue} from '../../src/utils/crmFieldValues.ts';
import {supportsCourseBudget} from '../../src/utils/crmBudget.ts';
import {modelParameters} from './modelParameters.ts';
/** Called in the original source transaction. Technical processing only; never a sales task or notification. */
export async function queueExtraction(c:any,leadId:string,type:string,sourceId:string,text:string,occurredAt:string|null,actor:string,explicitFields:string[]=[],sourceRevision='1',relationship:any={}){
 const hash=createHash('sha256').update(text).digest('hex');
 const current=(await c.query('SELECT profile FROM portal_leads WHERE id=:p1',[leadId])).rows[0]?.profile;if(!current)return;
 const input={text,occurredAt,actor,explicitFields,sourceRoot:relationship.sourceRoot||{type,id:sourceId,occurredAt},...(relationship.amendment?{amendment:relationship.amendment}:{}),baseVersions:Object.fromEntries(Object.keys(profileFields).map(k=>[k,current.profileFieldMeta?.[k]?.revision||0])),context:Object.fromEntries(Object.keys(profileFields).filter(k=>current[k]!=null).map(k=>[k,current[k]]))};
 await c.query("INSERT INTO crm_ai_extractions(id,lead_id,source_type,source_id,source_revision,input_hash,contract_version,input,status) VALUES(:p1,:p2,:p3,:p4,:p5,:p6,:p7,:p8,'pending') ON DUPLICATE KEY UPDATE id=id",[randomUUID(),leadId,type,sourceId,sourceRevision,hash,EXTRACTION_VERSION,input]);
}
/** A cue requests a second AI review; it never supplies a city value or an adoption decision. */
export function needsResidenceReview(text:string,observations:any[]){
 if(/我(?:作为|是)?销售|销售(?:本人|自己)|as (?:a )?sales/i.test(text)&&!/客户(?:说|表示)?(?:长期居住地是|目前住在|现在住在|住在|现居|常住|已经搬到)/.test(text))return false;
 return !observations.some(o=>o.kind==='field'&&o.field==='city')&&/(?:居住地(?:是|为)?|住在|现居|常住|搬到|tinggal(?:\s+di)?|domisili(?:\s+di)?|lives?\s+in|living\s+in|resides?\s+in|moved\s+to).{0,12}(?:雅加达|万隆|泗水|Jakarta|Bandung|Surabaya)/i.test(text);
}
export async function extractWithAI(text:string,context:any,request:typeof fetch=fetch,providersOverride?:Array<{model:string;key?:string;url:string}>){
 const {runtimeProviders}=await import('./aiServiceConfig.ts');
 const providers=(providersOverride||await runtimeProviders()).map(p=>({...p,name:p.model}));
 for(const p of providers){if(!p.key)continue;try{
  let actualModel=p.name;
  const ask=async(review=false)=>{
   const instruction=extractionInstruction+'\n'+stageEventInstruction+'\n'+naturalRequestInstruction+(review?'\nCoverage review: the prior pass omitted city. Inspect SOURCE again ONLY for customer residence/city statements, including staff reporting customer speech. Return the same JSON schema. Preserve the exact quote, subject, negation, uncertainty, past/future and change wording. Do not infer a move, adopt a value or use CONTEXT as evidence. Return city field observations only.':'');
   const response=await request(p.url,{method:'POST',headers:{Authorization:'Bearer '+p.key,'Content-Type':'application/json'},body:JSON.stringify({model:p.name,messages:[{role:'system',content:instruction},{role:'user',content:JSON.stringify({CONTEXT:context,SOURCE:text})}],response_format:{type:'json_object'},...modelParameters(p.name,2400,0)}),signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('provider');const body=await response.json();actualModel=body.model||p.name;if(body.choices?.[0]?.finish_reason==='length')throw Error('truncated');
   return validateExtraction(JSON.parse(body.choices?.[0]?.message?.content||''),text);
  };
  const observations=await ask();
  let coverageReview:any=null;
  if(needsResidenceReview(text,observations)){
   const recovered=(await ask(true)).filter(o=>o.kind==='field'&&o.field==='city');
   if(!recovered.length)throw Error('city_coverage_incomplete');
   observations.push(...recovered);coverageReview={field:'city',reviewed:true,recovered:recovered.length};
  }
  return {observations,model:actualModel,coverageReview};
 }catch{/* Invalid output, missing coverage and provider errors retry through the configured provider chain. No source or credentials in logs. */}}
 throw Error('结构化提取暂不可用，原文已保存');
}
let running=false;
export async function processExtractionBatch(provider=extractWithAI,onError:(e:unknown)=>void=()=>{}){
 if(running)return;running=true;
 const {pool,tx}=await import('./store.ts');
 try{await pool.query("UPDATE crm_ai_extractions SET status='pending',lease_until=NULL WHERE status='processing' AND lease_until<UTC_TIMESTAMP(6)");
 const jobs=await tx(async(c:any)=>{const rows=(await c.query("SELECT * FROM crm_ai_extractions WHERE status IN ('pending','retry') AND attempts<3 AND (lease_until IS NULL OR lease_until<UTC_TIMESTAMP(6)) ORDER BY created_at LIMIT 2 FOR UPDATE SKIP LOCKED")).rows;for(const r of rows)await c.query("UPDATE crm_ai_extractions SET status='processing',attempts=attempts+1,lease_until=UTC_TIMESTAMP(6)+INTERVAL 180 SECOND WHERE id=:p1",[r.id]);return rows;});
 for(const job of jobs){try{const output=await provider(job.input.text,{profile:job.input.context,linkedRecord:job.input.amendment||null});output.observations=validateExtraction({observations:output.observations.map(({start,end,decision,reason,...v}:any)=>v)},job.input.text);
 await tx((c:any)=>applyExtractionOutput(c,job,output));
 }catch(e){onError(e);await pool.query("UPDATE crm_ai_extractions SET status=IF(attempts>=3,'failed','retry'),error_code='extraction_unavailable',lease_until=UTC_TIMESTAMP(6)+INTERVAL 30 SECOND WHERE id=:p1",[job.id]);}}
 }finally{running=false;}
}

export function extractionEventId(id:string){return createHash('sha256').update('extracted:'+id).digest('hex').slice(0,32).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');}
export async function applyExtractionOutput(c:any,job:any,output:any){const current=(await c.query('SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE',[job.lead_id])).rows[0]?.profile;if(!current)return;const locked=(await c.query('SELECT status FROM crm_ai_extractions WHERE id=:p1 FOR UPDATE',[job.id])).rows[0];if(locked?.status==='completed')return;
 let next={...current,id:job.lead_id};const observations=[];const eventId=extractionEventId(job.id);
 const isCorrection=job.input.amendment?.kind==='correction';
 const ambiguousFields=new Set(output.observations.filter((o:any)=>o.kind==='field'&&o.subject==='customer'&&o.temporality==='current').filter((o:any,_,all:any[])=>all.some(v=>v.field===o.field&&!sameProfileValue(o.field,v.value,o.value))).map((o:any)=>o.field));
 const familyRows=isCorrection?(await c.query("SELECT id,source_id,source_type,input,output,status FROM crm_ai_extractions WHERE lead_id=:p1 AND status='completed'",[job.lead_id])).rows.filter((r:any)=>extractionFamily(r)===extractionFamily(job)):[];
 const sourceIds=new Set([extractionRoot(job).id,...familyRows.map((r:any)=>r.source_id)]);
 const priorFactIds=new Set(familyRows.map((r:any)=>r.output?.eventId).filter(Boolean));
 // Older outputs lack eventId; their fact UUID is deterministic and is also stored as a basis link.
 for(const r of familyRows)priorFactIds.add(extractionEventId(r.id));
 const fieldFacts=isCorrection?(await c.query("SELECT id,data FROM crm_facts WHERE lead_id=:p1 AND kind='profile.fields_updated'",[job.lead_id])).rows:[];
 for(const f of fieldFacts)if(sourceIds.has(f.data.sourceRecordId))priorFactIds.add(f.id);
 const owned=(meta:any)=>meta?.sourceFactIds?.some((id:string)=>id===job.input.amendment?.targetFactId||fieldFacts.some((f:any)=>f.id===id&&(sourceIds.has(f.data.sourceRecordId)||(f.data.basisFactIds||[]).some((x:string)=>priorFactIds.has(x)))));
 for(const raw of output.observations){let decision=extractionDecision(raw,next,job.input.baseVersions,job.input.occurredAt,job.input.text);if(isCorrection&&raw.kind==='field'&&raw.subject==='customer'&&raw.temporality==='current'&&raw.value!==null&&(raw.field!=='budgetAmount'||supportsCourseBudget(raw.value,raw.quote))&&!sameProfileValue(raw.field,next[raw.field],raw.value)){
   const meta=next.profileFieldMeta?.[raw.field]||{};
   decision=owned(meta)&&(meta.revision||0)===(job.input.baseVersions[raw.field]||0)?{decision:'apply',reason:'关联修正仅替代该字段的原依据；原文和旧解释保留'}:{decision:'difference',reason:'当前字段已有独立来源或版本变化，修正仅保留为不同记录'};
  }
  if(ambiguousFields.has(raw.field)&&!sameProfileValue(raw.field,next[raw.field],raw.value))decision={decision:'difference',reason:'同一原文中存在多个不同的当前值，保留现值并展示差异'};
  if(job.input.explicitFields.includes(raw.field))decision={decision:'evidence',reason:'本次已明确填写该字段，AI不覆盖选填值'};const o={...raw,...decision};observations.push(o);
 if(isCorrection&&o.kind==='field'&&o.subject==='customer'){
  const meta=next.profileFieldMeta?.[o.field];if(meta?.pendingDifferences)next={...next,profileFieldMeta:{...next.profileFieldMeta,[o.field]:{...meta,pendingDifferences:meta.pendingDifferences.map((d:any)=>priorFactIds.has(d.sourceFactId)?{...d,supersededBy:job.source_id}:d)}}};
 }
 if(isCorrection&&o.kind==='field'&&owned(next.profileFieldMeta?.[o.field])&&o.decision!=='apply'&&!job.input.explicitFields.includes(o.field)&&!sameProfileValue(o.field,next[o.field],o.value)){const meta=next.profileFieldMeta[o.field];next={...next,profileFieldMeta:{...next.profileFieldMeta,[o.field]:{...meta,valueState:'correction_pending',correctionSourceId:job.source_id}}};}
 if(o.decision==='difference'){
  const meta=next.profileFieldMeta?.[o.field]||{revision:0};
  const pending=[...(meta.pendingDifferences||[]),{value:o.value,sourceFactId:eventId,sourceType:job.source_type==='customer_message'?'ai_customer_text':'ai_sales_text',effectiveAt:job.input.occurredAt,recordedAt:new Date().toISOString(),reason:o.reason}];
  next={...next,profileFieldMeta:{...(next.profileFieldMeta||{}),[o.field]:{...meta,revision:(meta.revision||0)+1,pendingDifferences:pending}}};
 }
 if(o.decision==='apply'){const unrelated=isCorrection?(next.profileFieldMeta?.[o.field]?.pendingDifferences||[]).filter((d:any)=>!d.supersededBy):[];const changed=await recordProfileUpdates(c,next,{[o.field]:o.value},null,{actor:'ai',sourceType:job.source_type==='customer_message'?'ai_customer_text':'ai_sales_text',sourceRecordId:job.source_id,basisFactIds:[eventId],occurredAt:job.input.occurredAt,recordedAt:new Date().toISOString(),reason:o.quote,correction:isCorrection&&owned(next.profileFieldMeta?.[o.field])});next=changed.profile;
   const fieldChange=changed.changes.find((v:any)=>v.field===o.field);if(fieldChange?.applied===false){o.decision='difference';o.reason=fieldChange.reason;}
   if(isCorrection&&unrelated.length&&fieldChange?.applied)next={...next,profileFieldMeta:{...next.profileFieldMeta,[o.field]:{...next.profileFieldMeta[o.field],pendingDifferences:unrelated}}};}
 }
 // Corrections amend only the same original request; they never emit a fresh handoff event.
 if(isCorrection&&(job.input.sourceRoot?.countable===false||observations.some((o:any)=>o.kind==='signal'&&o.field==='advisor_request'&&o.subject==='customer'&&o.temporality==='negated'))){
  const root=extractionRoot(job);let sourceId=root.id;
  if(root.type==='customer_message'){const m=(await c.query('SELECT request_id FROM messages WHERE id=:p1',[root.id])).rows[0];sourceId=m?.request_id||root.id;}
  const requests=(await c.query("SELECT id FROM crm_engagements WHERE lead_id=:p1 AND source_id=:p2 AND kind='task_request' AND state='pending'",[job.lead_id,sourceId])).rows;
  for(const request of requests){
   await c.query("UPDATE crm_engagements SET state='dismissed',version=version+1 WHERE id=:p1",[request.id]);
   await c.query("UPDATE notification_jobs SET state='cancelled',result='Request corrected',completed_at=UTC_TIMESTAMP(6) WHERE state='pending' AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.payload.requestEvidenceId')),'null')=:p1",[request.id]);
  }
 }
 // Only the new contract can emit AI-derived requests; never replay old queued sources or corrections.
 const actions=naturalRequestActions(observations);
 if(job.contract_version===EXTRACTION_VERSION&&!job.input.amendment&&actions.length){
  const {ensureFollowup}=await import('./followup.ts');
  if(job.source_type==='customer_message'){
   const source=(await c.query("SELECT conversation_id,request_id FROM messages WHERE id=:p1 AND role='user'",[job.source_id])).rows[0];
   const conversation=source?(await c.query('SELECT * FROM conversations WHERE id=:p1 AND lead_id=:p2',[source.conversation_id,job.lead_id])).rows[0]:null;
   if(conversation)for(const action of actions)await ensureFollowup(c,conversation,action,source.request_id||job.source_id,'zh',true);
  }else if(job.source_type==='sales_record'&&observations.some(explicitAdvisorRequest)){
   const {recordSalesAdvisorRequest}=await import('./followup.ts');
   await recordSalesAdvisorRequest(c,job,observations.find(explicitAdvisorRequest));
  }
 }
 const assessmentReferences=observations.some(o=>o.kind==='stage_event'&&o.field==='assessment_completion_reported')?(await c.query('SELECT id,result,created_at FROM hsk_attempts WHERE lead_id=:p1 ORDER BY created_at DESC,id DESC LIMIT 5',[job.lead_id])).rows.map((r:any)=>({id:r.id,mode:r.result?.mode||null,recordedAt:r.created_at})):[];
 const result={eventId,observations,assessmentReferences,sourceRoot:extractionRoot(job),amendment:job.input.amendment||null,sourceType:job.source_type,sourceId:job.source_id,contractVersion:job.contract_version,model:output.model,occurredAt:job.input.occurredAt,originalText:job.input.text,interpretationVersion:'crm-evidence-v2',...(output.coverageReview?{coverageReview:output.coverageReview}:{}),summary:'从原文提取的结构化信息，不代表已执行行动'};
 await fact(c,job.lead_id,'information.extracted','ai',result,eventId);
 await c.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[job.lead_id,next]);
 await c.query("UPDATE crm_ai_extractions SET status='completed',output=:p2,model=:p3,completed_at=UTC_TIMESTAMP(6),lease_until=NULL,error_code=NULL WHERE id=:p1",[job.id,result,output.model]);return result;
}
