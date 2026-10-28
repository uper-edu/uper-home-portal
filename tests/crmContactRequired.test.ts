import test from'node:test';import assert from'node:assert/strict';import React from'react';import{renderToStaticMarkup}from'react-dom/server';
import{CrmSimpleWorkflow}from'../src/components/crm/CrmSimpleWorkflow';import{contactOccurrence,projectInteractionTimeline}from'../src/utils/crmInteractionTimeline';import{contactDraftIncomplete,prepareProgressDraft,progressContactTime}from'../src/utils/crmProgressDraft';import{saveSimpleSalesWorkflow}from'../server/portal/simpleSalesWorkflow';
const clock=new Date('2026-10-25T10:00:00Z'),base={recordKind:'contact',channel:'WhatsApp',connectStatus:'No Response',summary:'模拟联系，未回复',contactDirection:'sales',occurrenceMode:'unknown'};
test('four contact fields require explicit choices, initiator has no unknown option and restored default now needs confirmation',()=>{
 const h=renderToStaticMarkup(React.createElement(CrmSimpleWorkflow,{lead:{id:'l'},lang:'zh',isLight:true,timezone:'Asia/Jakarta',initialDraft:{simple:{recordKind:'contact'}}}));for(const text of ['联系渠道','实际联系结果','联系发起方','实际发生时间','选择联系发起方','选择实际发生时间'])assert.ok(h.includes(text));assert.ok(!h.includes('>未注明<'));assert.ok(!h.includes('>刚刚发生<'));assert.ok(h.includes('disabled=""'));
 for(const key of ['channel','connectStatus','contactDirection','occurrenceMode'])assert.equal(contactDraftIncomplete({...base,[key]:''},'Asia/Jakarta'),true);
 assert.equal(contactDraftIncomplete(base,'Asia/Jakarta'),false);assert.equal(contactDraftIncomplete({...base,contactDirection:'unknown'},'Asia/Jakarta'),true);
 const restored=renderToStaticMarkup(React.createElement(CrmSimpleWorkflow,{lead:{id:'l'},lang:'zh',isLight:true,timezone:'Asia/Jakarta',initialDraft:{simple:{...base,summary:'旧原文保留',occurrenceMode:'now'}}}));assert.ok(restored.includes('旧原文保留'));assert.ok(restored.includes('选择实际发生时间'));
});
test('specified wall clock requires date hour and minute and rejects invalid dates, gaps and future',()=>{
 for(const s of ['','2026-10-24','2026-10-24T10','2026-10-24T10:','2026-02-31T10:00','2026-10-24T25:00'])assert.throws(()=>progressContactTime(s,'Asia/Jakarta'));
 assert.throws(()=>progressContactTime('2026-03-08T02:30','America/Vancouver'));assert.equal(progressContactTime('2026-10-24T17:00','Asia/Jakarta'),'2026-10-24T10:00:00.000Z');
 assert.equal(contactDraftIncomplete({...base,occurrenceMode:'specified',contactLocal:'2099-01-01T00:00'},'Asia/Jakarta'),true);
});
test('explicit unknown clears hidden timestamp, retains draft and never uses recording clock',()=>{
 const draft={...base,contactLocal:'2026-10-24T17:00',contactTimeConfirmed:true,occurredAt:'2099-01-01T00:00:00Z'},before=JSON.stringify(draft),b=prepareProgressDraft(draft,'Asia/Jakarta');assert.equal(b.occurredAt,null);assert.equal(b.contactLocal,undefined);assert.equal(b.contactTimeConfirmed,undefined);assert.equal(JSON.stringify(draft),before);assert.deepEqual(contactOccurrence(b,clock),{occurredAt:null,contactDirection:'sales'});
 assert.equal(contactOccurrence({...base,occurrenceMode:'now'},clock).occurredAt,clock.toISOString());assert.equal(prepareProgressDraft({...draft,occurrenceMode:'specified'},'Asia/Jakarta').occurredAt,'2026-10-24T10:00:00.000Z');
});
test('server rejects omitted choices, unknown initiator, contradictory results, incomplete and stale hidden times',()=>{
 for(const b of [{contactDirection:''},{contactDirection:'unknown'},{occurrenceMode:''},{occurrenceMode:'specified',occurredAt:'2026-10-24'},{occurrenceMode:'specified',occurredAt:'2026-10-24T10Z'},{occurrenceMode:'specified',occurredAt:'2026-10-26T10:00:00Z'},{occurrenceMode:'unknown',occurredAt:'2026-10-24T10:00:00Z'},{contactDirection:'customer'}])assert.throws(()=>contactOccurrence({...base,...b},clock));
 assert.equal(contactOccurrence({...base,contactDirection:'customer',connectStatus:'Connected'},clock).occurredAt,null);
});
function database(){let profile:any={id:'l',tier:'Hot',currentStage:'New',simpleRevision:0,stageRevision:0,followUpLogs:[],commitments:[]};const writes:any[]=[];return {writes,get profile(){return profile},async query(sql:string,p:any[]){if(sql.startsWith('SELECT profile'))return{rows:[{profile}]};if(sql.startsWith('SELECT display_name'))return{rows:[{display_name:'模拟销售'}]};if(sql.startsWith('SELECT * FROM followup_tasks'))return{rows:[{id:'first',due_at:'2026-10-26T10:00:00Z',original_due_at:'2026-10-26T10:00:00Z'}]};if(sql.startsWith('SELECT'))return{rows:[]};writes.push([sql,p]);if(sql.startsWith('UPDATE portal_leads'))profile=p[1];return{rows:[],rowCount:0};}};}
test('unknown occurrence persists through original save transaction and AI source with one idempotent contact, no new tasks or Tier change',async()=>{
 const db=database(),b={...base,occurredAt:null,requestId:'explicit-unknown',workflowVersion:3,expectedRevision:0};const first=await saveSimpleSalesWorkflow(db,'l','staff',b,()=>true,clock);assert.equal(first.createdTaskId,null);assert.deepEqual(first.completedTaskIds,['first']);assert.equal(first.firstOutcome,'attempted');assert.equal(db.profile.tier,'Hot');assert.equal(db.profile.followUpLogs[0].occurredAt,null);assert.equal(db.profile.followUpLogs[0].at,clock.toISOString());assert.ok(!db.writes.some(([s])=>s.startsWith('INSERT INTO followup_tasks')||s.startsWith('INSERT INTO notification_jobs')||s.startsWith('INSERT INTO outbox')));
 const ai=db.writes.find(([s])=>s.startsWith('INSERT INTO crm_ai_extractions'));assert.ok(ai);assert.ok(ai[1].some(v=>v&&typeof v==='object'&&v.sourceRoot?.occurredAt===null));
 for(let n=0;n<10;n++)assert.equal((await saveSimpleSalesWorkflow(db,'l','staff',b,()=>true,clock)).replayed,true);assert.equal(db.profile.followUpLogs.length,1);
 assert.equal(projectInteractionTimeline(db.profile).sales?.at,undefined);
});
test('permissions and invalid timing reject before writes in the same workflow',async()=>{
 for(const [allowed,extra]of [[false,{}],[true,{contactDirection:'unknown'}],[true,{occurrenceMode:'specified',occurredAt:'bad'}]]as any){const db=database();await assert.rejects(saveSimpleSalesWorkflow(db,'l','staff',{...base,requestId:'reject',workflowVersion:3,expectedRevision:0,...extra},()=>allowed,clock));assert.equal(db.writes.length,0);}
});
