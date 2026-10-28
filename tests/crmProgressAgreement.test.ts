import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CrmSimpleWorkflow} from '../src/components/crm/CrmSimpleWorkflow';
import {incompleteAgreement,prepareProgressDraft} from '../src/utils/crmProgressDraft';
import {saveSimpleSalesWorkflow} from '../server/portal/simpleSalesWorkflow';
import {validateSalesProgress} from '../server/portal/salesProgress';

const original={id:'old',action:'TEST 核对课程资料',status:'active',reason:'原有历史原因',sourceId:'original-request'};
const lead={id:'TEST-AGREEMENT',owner:'Robert',currentStage:'progress:proposal',simpleRevision:0,commitments:[original],followUpLogs:[{id:'historical',summary:'原文',commitmentChange:{id:'past',status:'cancelled',reason:'历史原因原文'}}]};
const draft={requestId:'TEST-change',workflowVersion:3,expectedRevision:0,recordKind:'internal',summary:'TEST 客户已收到资料，双方确认本项约定已履行。',agreementIntent:'update',commitmentChange:{id:'old',status:'fulfilled'}};
function database(value:any=lead){let profile=structuredClone(value);const writes:any[]=[];return {writes,get profile(){return profile;},async query(sql:string,params:any[]=[]):Promise<any>{
 if(sql.startsWith('SELECT profile'))return {rows:[{profile}]};
 if(sql.startsWith('SELECT display_name'))return {rows:[{display_name:'TEST staff'}]};
 if(sql.startsWith('SELECT'))return {rows:[]};
 writes.push([sql,params]);if(sql.startsWith('UPDATE portal_leads'))profile=params[1];return {rows:[],rowCount:0};
}};}
test('agreement outcome uses the single progress original, ignoring stale unsaved duplicate reason',()=>{
 assert.equal(incompleteAgreement(draft),false);
 const body=prepareProgressDraft({...draft,commitmentChange:{...draft.commitmentChange,reason:'旧草稿说明'}},'America/Vancouver');
 assert.equal(body.commitmentChange.reason,draft.summary);assert.equal(draft.commitmentChange.hasOwnProperty('reason'),false);
 for(const change of [{id:'old',status:''},{id:'',status:'fulfilled'}])assert.equal(incompleteAgreement({...draft,commitmentChange:change}),true);
 assert.equal(incompleteAgreement({...draft,commitmentChange:{id:'old',status:'rescheduled'}}),true);
});
test('three-language forms have no duplicate reason input, retain original agreement and outcome selector',()=>{
 for(const lang of ['zh','en','id']){
  const html=renderToStaticMarkup(React.createElement(CrmSimpleWorkflow,{lead,lang,isLight:true,timezone:'America/Vancouver',initialDraft:{simple:draft,sections:{agreement:true}}}));
  assert.equal((html.match(/<textarea/g)||[]).length,1);assert.match(html,/TEST 核对课程资料/);assert.doesNotMatch(html,/Agreement update reason|Alasan perubahan kesepakatan|约定更新原因/);
 }
});
test('server accepts omitted or blank duplicate reason, snapshots original text, preserves prior history, and deduplicates retries',async()=>{
 for(const reason of [undefined,'']){
  const db=database(),body={...prepareProgressDraft(draft,'America/Vancouver'),commitmentChange:{id:'old',status:'fulfilled',...(reason===undefined?{}:{reason})}};
  const before=structuredClone(db.profile.followUpLogs);await saveSimpleSalesWorkflow(db,lead.id,'Robert',body,()=>true);
  assert.equal(db.profile.commitments[0].reason,draft.summary);assert.equal(db.profile.followUpLogs.at(-1).commitmentChange.reason,draft.summary);
  assert.equal(db.profile.followUpLogs.at(-1).input,JSON.stringify(body));assert.deepEqual(db.profile.followUpLogs.slice(0,-1),before);
  assert.equal(db.profile.currentStage,lead.currentStage);assert.equal(db.profile.owner,lead.owner);
  const count=db.writes.length;for(let i=0;i<10;i++)assert.equal((await saveSimpleSalesWorkflow(db,lead.id,'Robert',body,()=>true)).replayed,true);assert.equal(db.writes.length,count);
  assert.ok(!db.writes.some(([sql])=>/^(UPDATE followup_tasks|UPDATE notification_jobs|INSERT INTO outbox|INSERT INTO followup_tasks)/.test(sql)));
 }
});
test('cancellation and rescheduling retain their outcome, original item and replacement semantics',async()=>{
 for(const status of ['cancelled','rescheduled']){
  const db=database(),body={...prepareProgressDraft(draft,'America/Vancouver'),commitmentChange:{id:'old',status},...(status==='rescheduled'?{commitment:{action:'TEST 双方改为先核对新资料',timezone:'America/Vancouver'}}:{})};
  await saveSimpleSalesWorkflow(db,lead.id,'Robert',body,()=>true);assert.equal(db.profile.commitments[0].status,status);assert.equal(db.profile.commitments[0].action,original.action);assert.equal(db.profile.commitments[0].reason,draft.summary);
  assert.equal(db.profile.commitments.length,status==='rescheduled'?2:1);
 }
});
test('stale or inactive agreement, missing original, invalid reason type, permissions, or missing replacement reject without writes',async()=>{
 const body=prepareProgressDraft(draft,'America/Vancouver');
 for(const [profile,change,allowed] of [
  [{...lead,simpleRevision:1},{},true],
  [{...lead,commitments:[{...original,status:'cancelled'}]},{},true],
  [lead,{summary:' '},true],
  [lead,{commitmentChange:{id:'old',status:'fulfilled',reason:5}},true],
  [lead,{commitmentChange:{id:'old',status:'rescheduled'}},true],
  [lead,{},false],
 ] as any[]){const db=database(profile);await assert.rejects(()=>saveSimpleSalesWorkflow(db,lead.id,'Robert',{...body,...change},()=>allowed));assert.equal(db.writes.length,0);}
});
test('explicit older-client reasons are retained; independent corrections and stage changes still require evidence',async()=>{
 const db=database(),body={...prepareProgressDraft(draft,'America/Vancouver'),commitmentChange:{id:'old',status:'fulfilled',reason:'旧版明确提供的独立说明'}};
 await saveSimpleSalesWorkflow(db,lead.id,'Robert',body,()=>true);assert.equal(db.profile.commitments[0].reason,body.commitmentChange.reason);
 await assert.rejects(()=>validateSalesProgress(database(),lead.id,lead,{newStage:'progress:discovery',expectedStage:lead.currentStage,expectedStageRevision:0,reason:'',basisRefs:[],effectiveTimeMode:'now'}),/依据|事实说明/);
});
