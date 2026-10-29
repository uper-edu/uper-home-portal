import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {CUSTOMER_INSIGHTS_VERSION,applyInsightObservation,validateInsightDimension,insightLabel} from '../src/utils/crmCustomerInsights';
import {AI_PROFILE_POLICY} from '../src/utils/crmAiProfilePolicy';import {validateExtraction} from '../src/utils/crmExtractionContract';
import {applyExtractionOutput,extractWithAI} from '../server/portal/aiExtraction';import {insightCatalog,insightDimensionId} from '../server/portal/customerInsights';
import {CrmCustomerInsights} from '../src/components/crm/CrmCustomerInsights';import {CrmHistoryInformation} from '../src/components/crm/CrmHistoryInformation';import {CrmUiProvider,crmUiText} from '../src/components/crm/CrmUiLanguage';
const words={en:'Learning equipment',id:'Perangkat belajar',zh:'学习设备'};
const dimension=validateInsightDimension({labels:words,definition:{en:'Equipment available for learning',id:'Perangkat yang tersedia untuk belajar',zh:'可以用于学习的设备'}},'learning_equipment');
const raw=(patch:any={})=>({kind:'insight',field:dimension.key,dimension,value:'主要用手机，没有电脑',basis:'stated',operation:'set',quote:'本次原文',subject:'customer',temporality:'current',change:'state',...patch});
const context=(patch:any={})=>({eventId:'event-a',sourceId:'log-a',sourceType:'sales_record',root:{type:'sales_record',id:'log-a'},recordedAt:'2026-10-29T01:00:00Z',occurredAt:null,baseRevision:0,amendment:false,...patch});
const original=()=>({id:'TEST-a',fullName:'TEST原姓名',email:'original@example.invalid',phone:'+12025550100',owner:'Robert',city:'Jakarta',tier:'Hot',currentStage:'progress:discovery',commitments:[{id:'agreement'}],latestAssessment:{score:12}});
function fixture(registry=new Map<string,any>(),p:any=original()){
 let profile=structuredClone(p),status='processing';const calls:any[]=[];
 const c={query:async(sql:string,params:any[]=[])=>{calls.push({sql,params});
  if(sql.startsWith('SELECT profile'))return {rows:[{profile:structuredClone(profile)}]};
  if(sql.startsWith('SELECT status'))return {rows:[{status}]};
  if(sql.includes("kind='insight.dimension_created'"))return {rows:[...registry].map(([id,data])=>({id,data}))};
  if(sql.startsWith('SELECT data FROM crm_facts WHERE id='))return {rows:registry.has(params[0])?[{data:registry.get(params[0])}]:[]};
  if(sql.startsWith('INSERT INTO crm_facts')&&params[2]==='insight.dimension_created'&&!registry.has(params[0]))registry.set(params[0],params[4]);
  if(sql.startsWith('UPDATE portal_leads'))profile=structuredClone(params[1]);
  if(sql.startsWith('UPDATE crm_ai_extractions'))status='completed';
  return {rows:[],rowCount:1};
 }};
 const job={id:'job-a',lead_id:p.id,source_id:'log-a',source_type:'sales_record',contract_version:'fixture-no-requests',input:{text:'本次原文',recordedAt:context().recordedAt,occurredAt:null,profilePolicyVersion:AI_PROFILE_POLICY,insightsVersion:'customer-insights-v1',insightBaseVersions:{},baseVersions:{},explicitFields:[]}};
 return {c,calls,job,get profile(){return profile;},registry,run:(observations:any[])=>applyExtractionOutput(c,job,{observations,model:'fixture'})};
}
test('AI can create a new dimension and value without adding core fields, tasks or notification effects',async()=>{
 const f=fixture();const out=await f.run([raw()]);assert.equal(f.registry.size,1);assert.equal(f.profile.aiInsights.learning_equipment.value,'主要用手机，没有电脑');
 assert.deepEqual(Object.fromEntries(Object.keys(original()).map(k=>[k,f.profile[k]])),original());
 assert.equal(out.observations[0].dimension.createdBy,'ai');assert.equal(out.observations[0].decision,'apply');
 for(const call of f.calls.filter(c=>!c.sql.startsWith('SELECT')))assert.doesNotMatch(call.sql,/notification_|outbox|followup_tasks|hsk_attempts|portal_settings|crm_users/);
});
test('known definitions are reused across customers and the shared vocabulary contains no other customer values',async()=>{
 const a=fixture();await a.run([raw({value:'ONLY_CUSTOMER_A_PRIVATE_VALUE'})]);
 const b=fixture(a.registry,{...original(),id:'TEST-b'});const o=raw({value:'客户B用电脑'});delete o.dimension;await b.run([o]);
 assert.equal(a.registry.size,1);assert.equal(b.profile.aiInsights.learning_equipment.value,'客户B用电脑');assert.equal(a.profile.aiInsights.learning_equipment.value,'ONLY_CUSTOMER_A_PRIVATE_VALUE');
 const catalog=await insightCatalog(b.c);assert.equal(JSON.stringify(catalog).includes('PRIVATE_VALUE'),false);assert.deepEqual(catalog,[dimension]);
});
test('a stale proposal with an identical translated name reuses the immutable canonical definition',async()=>{
 const a=fixture();await a.run([raw()]);const b=fixture(a.registry,{...original(),id:'TEST-b'});const out=await b.run([raw({field:'device_conditions'})]);
 assert.equal(a.registry.size,1);assert.equal(out.observations[0].field,'learning_equipment');assert.deepEqual(Object.keys(b.profile.aiInsights),['learning_equipment']);
 assert.equal(insightDimensionId('learning_equipment'),insightDimensionId('learning_equipment'));
});
test('updates, explicit withdrawals and source history are retained; omission never withdraws a dimension',()=>{
 const first=applyInsightObservation(original(),dimension,raw(),context());
 const next=applyInsightObservation(first.profile,dimension,raw({value:'已经购买电脑',change:'changed'}),context({eventId:'event-b',sourceId:'log-b',root:{type:'sales_record',id:'log-b'},recordedAt:'2026-10-29T02:00:00Z',baseRevision:1}));
 assert.equal(next.profile.aiInsights.learning_equipment.value,'已经购买电脑');assert.equal(next.profile.aiInsights.learning_equipment.history.length,2);
 const withdrawn=applyInsightObservation(next.profile,dimension,raw({value:'不再提供设备信息',operation:'withdraw',change:'changed',temporality:'negated'}),context({eventId:'event-c',sourceId:'log-c',recordedAt:'2026-10-29T03:00:00Z',baseRevision:2}));
 assert.equal(withdrawn.profile.aiInsights.learning_equipment.status,'withdrawn');assert.equal(withdrawn.profile.aiInsights.learning_equipment.history.length,3);assert.equal(first.profile.aiInsights.learning_equipment.value,'主要用手机，没有电脑');
});
test('late records, stale versions and old corrections cannot override a later independent source',()=>{
 const first=applyInsightObservation(original(),dimension,raw(),context());
 for(const patch of [{recordedAt:'2026-10-28T00:00:00Z',baseRevision:1},{recordedAt:'2026-10-30T00:00:00Z',baseRevision:0},{amendment:true,root:{type:'sales_record',id:'unrelated'},baseRevision:1}]){
  const out=applyInsightObservation(first.profile,dimension,raw({value:'错误新值'}),context({eventId:'other',...patch}));assert.equal(out.decision,'difference');assert.equal(out.profile.aiInsights.learning_equipment.value,'主要用手机，没有电脑');assert.equal(out.profile.aiInsights.learning_equipment.history.length,2);
 }
 const same=applyInsightObservation(first.profile,dimension,raw({value:'原记录应为平板'}),context({eventId:'correction',amendment:true,baseRevision:1}));assert.equal(same.profile.aiInsights.learning_equipment.value,'原记录应为平板');
});
test('inference is visibly tentative and cannot replace an explicit statement; uncertain statements remain evidence',()=>{
 const inferred=applyInsightObservation(original(),dimension,raw({basis:'inferred'}),context());assert.equal(inferred.profile.aiInsights.learning_equipment.status,'tentative');
 const stated=applyInsightObservation(original(),dimension,raw(),context());const blocked=applyInsightObservation(stated.profile,dimension,raw({basis:'inferred',value:'推测有电脑'}),context({eventId:'other',recordedAt:'2026-10-30T00:00:00Z',baseRevision:1}));assert.equal(blocked.decision,'difference');
 for(const temporality of ['past','future','uncertain','conditional'])assert.equal(applyInsightObservation(original(),dimension,raw({temporality}),context()).decision,'evidence');
});
test('protected/core aliases, missing translations, invalid original quotes and arbitrary fields fail before writes',async()=>{
 for(const field of ['phone','email','owner','city','budgetAmount','__proto__','permissions']){
  const f=fixture();await assert.rejects(f.run([raw({field})]));assert.equal(f.calls.length,0);
 }
 for(const label of ['电话','客户负责人','City','电子邮件'])assert.throws(()=>validateInsightDimension({...dimension,labels:{...words,zh:label}},'different_key'));
 for(const patch of [{dimension:{labels:words}},{quote:'原文中不存在'},{unexpected:true},{operation:'execute'},{basis:'verified'}])assert.throws(()=>validateExtraction({observations:[raw(patch)]},'本次原文'));
});
test('legacy sources cannot emit new insights and completed-job replays do not write again',async()=>{
 const legacy=fixture();delete legacy.job.input.insightsVersion;await assert.rejects(legacy.run([raw()]));assert.equal(legacy.calls.length,0);
 const f=fixture();await f.run([raw()]);const writes=f.calls.filter(c=>!c.sql.startsWith('SELECT')).length;await f.run([raw()]);assert.equal(f.calls.filter(c=>!c.sql.startsWith('SELECT')).length,writes);
});
test('contradictory same-source values remain differences instead of choosing a winner',async()=>{
 const f=fixture();const out=await f.run([raw(),raw({value:'同时又说有电脑'})]);assert.ok(out.observations.every((o:any)=>o.decision==='difference'));assert.equal(f.profile.aiInsights,undefined);
});
test('profile and source history show multilingual AI-created labels while preserving original-language values',async()=>{
 const f=fixture();const out=await f.run([raw()]);
 for(const lang of ['zh','en','id'] as const){
  const html=renderToStaticMarkup(React.createElement(CrmUiProvider,{lang,children:React.createElement(CrmCustomerInsights,{lead:f.profile,lang,onSource:()=>{}})}));
  assert.match(html,new RegExp(insightLabel(dimension,lang)));assert.match(html,/主要用手机，没有电脑/);assert.match(html,/本次原文/);assert.match(html,/crm-evidence-action/);
  const history=renderToStaticMarkup(React.createElement(CrmUiProvider,{lang,children:React.createElement(CrmHistoryInformation,{group:{id:'g',log:{},events:[],extractions:[{...f.job,status:'completed',output:out}]}})}));assert.ok(history.includes(insightLabel(dimension,lang)));
 }
 for(const lang of ['en','id'])for(const label of ['客户洞察','依据与历史','已撤回的洞察','AI推断','未采用，保留当前洞察'])assert.notEqual(crmUiText(label,lang),label);
});
