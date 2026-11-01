import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultRules,CRM_BOT_CHANNEL} from '../server/portal/policy.ts';
import {standardLarkCard} from '../server/portal/notificationDelivery.ts';
import {larkNotificationPreview} from '../src/utils/larkNotificationPresentation.ts';
import {agreementDueAfterActivation} from '../server/portal/taskTiming.ts';
const now=new Date('2030-01-06T07:00:00Z');
test('agreement reminder defaults to owner, in-app and existing CRM bot',()=>{const r=defaultRules.find(r=>r.event==='commitment.due')!;assert.deepEqual(r.channels,['inapp','lark']);assert.equal(r.recipient,'owner');assert.equal(r.group,CRM_BOT_CHANNEL);});
for(const language of ['zh','en','id'] as const)test('agreement card has substantive content and exact target '+language,()=>{
 const card=standardLarkCard({kind:'commitment.due',language,name:'Maya',owner:'Arif',agreementAction:'Confirm Saturday trial',due:'2030-01-06 12:00',dueAt:'2030-01-06T05:00:00Z',target:{kind:'agreement',id:'agreement-a'}},'lead-a',undefined,now);
 assert.equal(card.card.header.template,'blue');const body=card.card.elements[0].text.content;assert.ok(body.includes('Confirm Saturday trial'));assert.ok(body.includes('2030-01-06 12:00'));assert.ok(body.includes('2'));const url=new URL(card.card.elements[1].actions[0].url);assert.equal(url.searchParams.get('lead'),'lead-a');assert.equal(url.searchParams.get('target'),'agreement');assert.equal(url.searchParams.get('targetId'),'agreement-a');
});
test('date-only, privacy and internal restriction retain their meaning',()=>{
 const p=larkNotificationPreview({kind:'commitment.due',language:'zh',name:'Maya',agreementAction:'请发送验证码12345678',due:'2030-01-06',asOf:now.toISOString(),internalReview:true});
 assert.ok(!p.rows.some(r=>r.label.includes('期限状态')));assert.ok(!p.rows.some(r=>r.label==='约定事项'));assert.ok(p.rows.some(r=>r.value==='先内部核实，暂不直接联系'));assert.ok(!p.rows.some(r=>!r.value.trim()));
});
test('activation excludes historic missed dates and instants but preserves date precision',()=>{
 assert.equal(agreementDueAfterActivation('2030-01-05',now,'Asia/Jakarta'),false);assert.equal(agreementDueAfterActivation('2030-01-06',now,'Asia/Jakarta'),true);assert.equal(agreementDueAfterActivation('2030-01-06T06:59:59Z',now),false);assert.equal(agreementDueAfterActivation('2030-01-06T07:00:00Z',now),true);assert.equal(agreementDueAfterActivation(undefined,now),false);
});
test('activation is explicit, preserves custom settings and does not touch queue',async()=>{
 const {activateAgreementNotifications}=await import('../server/portal/agreementNotificationActivation.ts');const queries:any[]=[];const r=defaultRules.find(r=>r.event==='commitment.due')!;
 const row={id:'commitment.due',version:1,enabled:true,config:{...r,channels:['inapp'],group:'sales',language:'id',maxPerHour:77}};
 const c={query:async(sql:string,args:any[])=>{queries.push({sql,args});return {rows:sql.includes('notification_channels')?[{id:CRM_BOT_CHANNEL}]:sql.startsWith('SELECT *')?[row]:[]};}};
 assert.deepEqual(await activateAgreementNotifications(c,'manager'),{changed:true,version:2});const config=queries.find(q=>q.sql.startsWith('UPDATE')).args[1];assert.equal(config.language,'id');assert.equal(config.maxPerHour,77);assert.ok(!queries.some(q=>/notification_jobs|outbox/.test(q.sql)));
 row.config=config;row.version=2;queries.length=0;assert.equal((await activateAgreementNotifications(c,'manager')).changed,false);assert.ok(!queries.some(q=>q.sql.startsWith('UPDATE')));
 row.config={...config,requiresRoutingReview:true};await assert.rejects(()=>activateAgreementNotifications(c,'manager'),/review/);
});
