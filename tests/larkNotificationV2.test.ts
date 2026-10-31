import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults, schedule, sla} from '../server/portal/policy.ts';
import {larkNotificationPreview,scheduleLarkV2} from '../server/portal/larkNotificationV2.ts';

test('new Lark timing is independent of work calendar; legacy and SLA stay unchanged',()=>{
  const sunday=new Date('2026-10-11T01:00:00Z');
  assert.equal(scheduleLarkV2(sunday,defaults).toISOString(),sunday.toISOString());
  assert.equal(schedule(sunday,defaults,'lark').toISOString(),'2026-10-12T02:00:00.000Z');
  assert.equal(schedule(sunday,defaults,'inapp').toISOString(),sunday.toISOString());
  assert.equal(sla(new Date('2026-10-10T12:00:00Z'),3,defaults).toISOString(),'2026-10-12T02:00:00.000Z');
  assert.equal(scheduleLarkV2(sunday,{...defaults,timing:'digest'}).toISOString(),'2026-10-11T11:00:00.000Z');
  assert.equal(scheduleLarkV2(new Date('2026-10-11T11:00:01Z'),{...defaults,timing:'digest'}).toISOString(),'2026-10-12T11:00:00.000Z');
  assert.equal(scheduleLarkV2(sunday,{...defaults,quiet:{start:'07:00',end:'09:00'}}).toISOString(),'2026-10-11T02:00:00.000Z');
});

test('three localized previews preserve source values and omit unrestricted original request',()=>{
  for(const language of ['zh','en','id'] as const)for(const kind of ['lead.created','handoff.requested','assessment.completed'] as const){
    const result=larkNotificationPreview({language,kind,name:'Maya Putri',score:12,maxScore:20});
    assert.ok(result.title);assert.equal(result.rows[0].value,'Maya Putri');
    assert.equal(result.rows.some(row=>row.value==='12 / 20'),kind==='assessment.completed');
    assert.equal(result.note,undefined);
  }
});

test('delay crosses weekend freely, explicit quiet stays independent and legacy remains unchanged',()=>{
 const at=new Date('2026-10-10T13:00:00Z');
 assert.equal(scheduleLarkV2(at,{...defaults,timing:'delay',delayMinutes:30}).toISOString(),'2026-10-10T13:30:00.000Z');
 assert.equal(schedule(at,defaults,'lark').toISOString(),'2026-10-12T02:00:00.000Z');
 assert.equal(scheduleLarkV2(new Date('2026-10-11T11:00:00Z'),{...defaults,timing:'digest'}).toISOString(),'2026-10-11T11:00:00.000Z');
});

test('source queries use exact customer and source; missing references never read latest profile or original private text',async()=>{
 const {larkEventSource}=await import('../server/portal/larkNotificationV2.ts');
 const calls:any[]=[];
 const db={query:async(sql:string,args:any[])=>{calls.push({sql,args});return {rows:args[0]==='fact-a'&&args[1]==='lead-a'?[{id:'fact-a',created_at:'2026-10-31T01:00:00Z'}]:[]};}};
 assert.equal((await larkEventSource(db,'lead.created','lead-a',{questionnaireFactId:'fact-a'}))?.source,'questionnaire');
 assert.equal(await larkEventSource(db,'lead.created','lead-b',{questionnaireFactId:'fact-a'}),null);
 const before=calls.length;
 assert.equal(await larkEventSource(db,'lead.created','lead-a',{}),null);
 assert.equal(calls.length,before);
 assert.ok(calls.every(c=>c.sql.includes('lead_id=:p2')));
 const requestDb={query:async()=>({rows:[{id:'request-a',created_at:'2026-10-31T01:00:00Z',data:{sourceType:'sales_record',text:'private phone and address',occurredAt:null}}]})};
 const source=await larkEventSource(requestDb,'handoff.requested','lead-a',{requestEvidenceId:'request-a'});
 assert.equal(source?.source,'sales_record');
 assert.equal(source?.occurredAt,null);
 assert.ok(!JSON.stringify(source).includes('private phone'));
});

test('version and channel boundary: legacy jobs keep schedule and weekend inapp digest is excluded',async()=>{
 const {scheduleNotification,digestChannelAllowed}=await import('../server/portal/larkNotificationV2.ts');
 const at=new Date('2026-10-11T01:00:00Z');
 for(const payload of [{},{notificationPolicyVersion:1},{notificationPolicyVersion:'2'}])assert.equal(scheduleNotification(at,defaults,'lark',payload).toISOString(),'2026-10-12T02:00:00.000Z');
 assert.equal(scheduleNotification(at,defaults,'lark',{notificationPolicyVersion:2}).toISOString(),at.toISOString());
 assert.equal(scheduleNotification(at,defaults,'inapp',{notificationPolicyVersion:2}).toISOString(),at.toISOString());
 assert.equal(digestChannelAllowed('inapp',{inappDigestAllowed:false}),false);
 assert.equal(digestChannelAllowed('lark',{inappDigestAllowed:false}),true);
 assert.equal(digestChannelAllowed('inapp',{}),true);
});

test('structured questionnaire goal only, localized source names and complete recorded-time card',async()=>{
 const {larkEventSource}=await import('../server/portal/larkNotificationV2.ts');
 const db={query:async()=>({rows:[{id:'fact-a',created_at:'2026-10-31T01:00:00Z',data:{answers:{goal:'Prepare for HSK certification',goals:['Prepare for HSK certification','private free text 08123456']}}}]})};
 const source=await larkEventSource(db,'lead.created','lead-a',{questionnaireFactId:'fact-a'});
 assert.deepEqual(source && 'goals' in source?source.goals:[],['Prepare for HSK certification']);
 for(const language of ['zh','en','id'] as const){
 const preview=larkNotificationPreview({kind:'lead.created',language,name:'Maya Putri',source:'questionnaire',owner:'Arif',recordedAt:'2026-10-31 08:00',goals:['Prepare for HSK certification'],internalReview:true});
 assert.ok(preview.rows.some(r=>r.value==='Arif'));
 assert.ok(preview.rows.some(r=>r.value==='2026-10-31 08:00'));
 assert.ok(!preview.rows.some(r=>r.value==='questionnaire'));
 assert.ok(preview.rows.length>=6);
 }
});

test('worker and authorized live acceptance share the exact card builder and localized customer button',async()=>{
 const {standardLarkCard}=await import('../server/portal/notificationDelivery.ts');
 const oldEnv=process.env.APP_ENV,oldUrl=process.env.APP_URL;
 process.env.APP_ENV='local';process.env.APP_URL='http://localhost:3000';
 try{for(const language of ['zh','en','id'] as const){
 const card=standardLarkCard({kind:'handoff.requested',language,name:'Dewi Lestari',source:'customer_message'},'sample-a',undefined,new Date('2026-10-31T00:00:00Z'));
 assert.ok(card.card.header.title.content.includes('TEST'));
 assert.equal(card.card.elements[0].text.tag,'plain_text');
 assert.equal(new URL(card.card.elements[1].actions[0].url).searchParams.get('lead'),'sample-a');
 assert.equal(new URL(card.card.elements[1].actions[0].url).searchParams.get('leadView'),'activities');
 assert.equal(card.card.elements[1].actions[0].text.content,language==='zh'?'查看客户':language==='id'?'Lihat pelanggan':'View customer');
 }}finally{if(oldEnv===undefined)delete process.env.APP_ENV;else process.env.APP_ENV=oldEnv;if(oldUrl===undefined)delete process.env.APP_URL;else process.env.APP_URL=oldUrl;}
});


test('unknown occurrence is omitted in all three languages; explicit occurrence and recorded time stay distinct',()=>{
 for(const language of ['zh','en','id'] as const){
 for(const time of [undefined,'','  ']){
  const card=larkNotificationPreview({kind:'handoff.requested',language,name:'Dewi',time,recordedAt:'2030-01-06 14:00'});
  assert.equal(card.rows.length,2);
  assert.ok(card.rows.some(r=>r.value==='2030-01-06 14:00'));
 }
 const card=larkNotificationPreview({kind:'assessment.completed',language,name:'Arif',time:'2030-01-06 13:30',recordedAt:'2030-01-06 14:00',score:12,maxScore:20});
 assert.ok(card.rows.some(r=>r.value==='2030-01-06 13:30'));assert.ok(card.rows.some(r=>r.value==='12 / 20'));
 }
});

test('all empty and unknown values disappear; actual results and exact original excerpt lead the content',()=>{
 for(const language of ['zh','en','id'] as const){
  const empty=larkNotificationPreview({kind:'lead.created',language,name:' ',owner:'Unassigned',source:'invalid',goals:['Other','unknown'],reportedLevel:'Not sure',mode:'unknown',city:'Other',recordedAt:'',time:'未注明'});
  assert.deepEqual(empty.rows,[]);
  const original='Tolong hubungi saya melalui WhatsApp untuk memastikan jadwal kelas hari Sabtu.';
  const request=larkNotificationPreview({kind:'handoff.requested',language,name:'Dewi',excerpt:original,source:'customer_message'});
  assert.ok(request.rows.some(r=>r.value===original));
  const result=larkNotificationPreview({kind:'assessment.completed',language,name:'Arif',assessmentResult:{attempt:{mode:'full'},score:72,maxScore:100,summary:'UNTRUSTED FREE TEXT',thresholds:[{level:'HSK 1',reached:true}],sections:{listening:{correct:20,total:25},reading:{correct:16,total:25},writing:{correct:0,total:0}},skippedCount:2}});
  assert.ok(result.rows.some(r=>r.value==='72 / 100'));
  assert.ok(result.rows.some(r=>r.value.includes('20/25')));
  assert.ok(result.rows.some(r=>r.value.includes('HSK 1')));
  assert.ok(!JSON.stringify(result).includes('UNTRUSTED FREE TEXT'));
 }
});

test('privacy gate examines the whole message before truncating, never paraphrases original text',async()=>{
 const {safeNotificationExcerpt}=await import('../src/utils/larkNotificationContent.ts');
 for(const raw of ['email me at demo@example.com','WhatsApp +62 812 1234 5678','alamat rumah saya adalah Jakarta','护照信息如下','bank account is private','a'.repeat(200)+' demo@example.com'])assert.equal(safeNotificationExcerpt(raw),undefined);
 const text='请通过WhatsApp联系我，确认周六课程安排。';assert.equal(safeNotificationExcerpt(text),text);
 const risky=larkNotificationPreview({kind:'handoff.requested',language:'zh',name:'Dewi',excerpt:'demo@example.com'});assert.ok(!JSON.stringify(risky).includes('demo@example.com'));
});

test('customer excerpts are retrieved only from exact user messages, not assistant or cached request text',async()=>{
 const {larkEventSource}=await import('../server/portal/larkNotificationV2.ts');const queries:any[]=[];
 const db={query:async(sql:string,args:any[])=>{queries.push({sql,args});return {rows:sql.includes('crm_engagements')?[{data:{conversationId:'conv-a',messageId:'message-a',text:'CACHED ASSISTANT TEXT'},created_at:'2030-01-06'}]:[{content:'请通过WhatsApp联系我，确认周六课程安排。'}]};}};
 const source=await larkEventSource(db,'handoff.requested','lead-a',{requestEvidenceId:'request-a'});
 assert.ok(source && 'excerpt' in source && source.excerpt?.startsWith('请通过'));
 assert.ok(queries[1].sql.includes("m.role='user'"));assert.deepEqual(queries[1].args,['conv-a','message-a','lead-a']);
 assert.ok(!JSON.stringify(source).includes('CACHED ASSISTANT'));
});
