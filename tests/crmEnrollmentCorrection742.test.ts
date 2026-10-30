import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {voidEnrollmentConfirmation} from '../server/portal/enrollmentCorrection';
import {establishedFactMilestones} from '../server/portal/factMilestones';
import {attachEnrollmentEvidence} from '../server/portal/enrollmentEvidence';
import {confirmedEnrollmentFacts,hasConfirmedEnrollment} from '../src/utils/crmEnrollment';
import {campaignMetrics} from '../src/utils/crmCampaignMetrics';
import {filterAndSummarize,defaultLeadFilters} from '../src/utils/crmLeadFilters';
import {projectFactLedger} from '../src/utils/crmFactLedger';
import {buildHistoryTimeline} from '../src/utils/crmHistoryTimeline';
import {CrmEnrollmentCorrectionAccess,CrmEnrollmentCorrectionAction} from '../src/components/crm/CrmEnrollmentCorrection';
import {crmUiText} from '../src/utils/crmUiText';

function fixture({stage='progress:unreached',many=false}:any={}){
 let profile:any={id:'lead',owner:'sales',currentStage:stage,stageRevision:2,campaignId:'c',contactArrangement:{state:'stopped'},goal:'Original goal'};
 const original:any={id:'confirmed',lead_id:'lead',kind:'stage.changed',actor:'original-sales',created_at:'2026-10-29T10:00:00Z',data:{schema:2,before:'progress:proposal',after:'progress:enrolled',enrollmentConfirmed:true,enrollmentScope:'course',reason:'Original course confirmation',effectiveAt:'2026-10-29T09:00:00Z'}};
 const facts:any[]=[original,...(many?[{...original,id:'another'}]:[])],queries:any[]=[],operations=new Map(),audits:any[]=[];
 const db={async query(sql:string,args:any[]=[]){
  queries.push({sql,args});
  if(sql.startsWith('SELECT profile FROM portal_leads'))return {rows:[{profile}]};
  if(sql.startsWith('SELECT * FROM crm_facts'))return {rows:facts};
  if(sql.startsWith('SELECT * FROM crm_operations'))return {rows:operations.has(args[1])?[operations.get(args[1])]:[]};
  if(sql.startsWith('INSERT INTO crm_facts'))facts.push({id:args[0],lead_id:args[1],kind:args[2],actor:args[3],data:args[4],created_at:'2026-10-29T11:00:00Z'});
  if(sql.startsWith('INSERT INTO crm_operations'))operations.set(args[1],{fingerprint:args[2],result:args[3]});
  if(sql.startsWith('INSERT INTO portal_audit'))audits.push(args[1]);
  if(sql.startsWith('UPDATE portal_leads'))profile=args[1];
  return {rows:[],rowCount:1};
 }};
 const body={requestId:'request742',targetFactId:'confirmed',reason:'Wrong customer selected',expectedStage:stage,expectedStageRevision:2,expectedEnrollmentRevision:0};
 const save=(patch:any={},allowed=true)=>voidEnrollmentConfirmation(db,'lead','manager',{...body,...patch},()=>allowed,new Date('2026-10-29T11:00:00Z'));
 return {save,facts,original,queries,audits,profile:()=>profile};
}
test('void appends an immutable correction without changing stage, owner, contact policy, tasks, AI or notifications',async()=>{
 const f=fixture(),before=JSON.stringify(f.original);const r=await f.save();
 assert.equal(r.stageChanged,false);assert.equal(r.remainingConfirmations,0);assert.equal(r.lead.owner,'sales');assert.equal(r.lead.currentStage,'progress:unreached');assert.equal(r.lead.contactArrangement.state,'stopped');assert.equal(r.lead.goal,'Original goal');
 assert.equal(JSON.stringify(f.original),before);assert.equal(f.facts.length,2);assert.equal(f.facts[1].kind,'enrollment.confirmation_voided');assert.equal(f.audits[0].targetFactId,f.original.id);
 assert.ok(f.queries.some(q=>q.sql.includes('FOR UPDATE')));
 assert.ok(!f.queries.some(q=>/^(?:INSERT|UPDATE|DELETE).*\b(?:followup_tasks|notification_jobs|outbox|crm_ai_extractions)\b/i.test(q.sql)));
});
test('last confirmation while enrolled requires an explicit correct stage; one reason drives both facts',async()=>{
 for(const stage of ['progress:enrolled','Enrolled']){
  const f=fixture({stage});await assert.rejects(()=>f.save(),/请选择纠错/);assert.equal(f.facts.length,1);
  const r=await f.save({newStage:'progress:proposal'});assert.equal(r.stageChanged,true);assert.equal(r.lead.currentStage,'progress:proposal');assert.equal(r.lead.stageRevision,3);
  const change=f.facts.find(v=>v.id!=='confirmed'&&v.kind==='stage.changed');assert.equal(change.data.reason,'Wrong customer selected');assert.equal(change.data.enrollmentConfirmed,false);
 }
});
test('other valid confirmations remain established and no unnecessary stage change is accepted',async()=>{
 const f=fixture({stage:'progress:enrolled',many:true});await assert.rejects(()=>f.save({newStage:'progress:proposal'}),/无需/);
 const r=await f.save();assert.equal(r.stageChanged,false);assert.equal(r.remainingConfirmations,1);assert.equal(r.lead.currentStage,'progress:enrolled');assert.equal(confirmedEnrollmentFacts(f.facts)[0].id,'another');
});
test('milestones, list enrollment count and campaign enrollment count use the same valid confirmation set',async()=>{
 const f=fixture();await f.save();const p=f.profile();
 await attachEnrollmentEvidence({query:async()=>({rows:f.facts})},[p]);
 assert.equal(establishedFactMilestones([],f.facts).length,0);assert.equal(hasConfirmedEnrollment(p),false);
 assert.equal(filterAndSummarize([p],defaultLeadFilters('all')).stats.enrolled,0);assert.equal(campaignMetrics([p],{id:'c',code:'c'}).enrolledCount,0);
 assert.equal(hasConfirmedEnrollment({...p,outcome:'Paid'}),true,'independent payment/legacy evidence is not erased');
 const attempts=[{id:'a',created_at:'2026-10-29T11:00:00Z',result:{score:22,attempt:{mode:'full',completedAt:'2026-10-29T10:00:00Z'}}}];assert.equal(establishedFactMilestones(attempts,f.facts)[0].data.score,22);
});
test('same request replays once, a second request on the same confirmation conflicts',async()=>{
 const f=fixture();await f.save();const r=await f.save();assert.equal(r.replayed,true);assert.equal(f.facts.length,2);assert.equal(f.audits.length,1);
 await assert.rejects(()=>f.save({requestId:'second'}),e=>(e as any).status===409);assert.equal(f.facts.length,2);
});
test('permission, foreign fact and stale stage/enrollment versions fail before writes',async()=>{
 for(const [patch,allowed,status] of [[{},false,403],[{targetFactId:'foreign'},true,404],[{expectedStageRevision:1},true,409],[{expectedEnrollmentRevision:2},true,409],[{reason:' '},true,400]] as const){
  const f=fixture();await assert.rejects(()=>f.save(patch,allowed),e=>(e as any).status===status);assert.equal(f.facts.length,1);assert.equal(f.audits.length,0);
 }
});
test('ordinary stage rollback and AI statements do not void an enrollment; history keeps original and explicit void together',async()=>{
 const f=fixture();f.facts.push({id:'rollback',lead_id:'lead',kind:'stage.changed',data:{schema:2,after:'progress:unreached',reason:'Mistaken enrollment'},created_at:'2026-10-29T10:30:00Z'});
 assert.equal(confirmedEnrollmentFacts(f.facts).length,1);await f.save();const events=projectFactLedger('lead',f.facts,[],[],f.profile());const original=events.find(e=>e.eventId==='confirmed')!;
 assert.equal(original.original,'Original course confirmation');assert.equal(original.effective,true,'stage transition history is not falsified');assert.equal(original.payload.enrollmentVoid.reason,'Wrong customer selected');
 const group=buildHistoryTimeline(events,f.profile()).find(g=>g.aliases.includes('confirmed'))!;assert.equal(group.root?.eventId,'confirmed');assert.ok(group.events.some(e=>e.eventType==='enrollment.confirmation_voided'));
});
test('entry is restricted to authorized context and active confirmations; all new business labels have three-language text',()=>{
 const markup=(authorized:boolean,voided=false)=>renderToStaticMarkup(React.createElement(CrmEnrollmentCorrectionAccess.Provider,{value:{open:authorized?()=>{}:undefined}},React.createElement(CrmEnrollmentCorrectionAction,{factId:'confirmed',voided})));
 assert.match(markup(true),/作废报名误记/);assert.equal(markup(false),'');assert.equal(markup(true,true),'');
 for(const label of ['作废报名误记','已作废 · 报名误记','纠错说明','纠错后的销售阶段','报名误记已作废，销售阶段已同步更新。'])for(const lang of ['en','id'])assert.notEqual(crmUiText(label,lang),label);
});
