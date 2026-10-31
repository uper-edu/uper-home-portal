import test from 'node:test';import assert from 'node:assert/strict';
import {larkNotificationPreview,standardLarkKinds} from '../src/utils/larkNotificationPresentation.ts';
import {larkNotificationSample} from '../src/utils/larkNotificationSamples.ts';
import {standardLarkCard} from '../server/portal/notificationDelivery.ts';
import {larkEventSource,larkFailureSource} from '../server/portal/larkNotificationV2.ts';
test('all nine cards have localized meaningful content, no raw event names or empty placeholders',()=>{
 for(const kind of standardLarkKinds)for(const language of ['zh','en','id'] as const){
  const preview=larkNotificationPreview(larkNotificationSample(kind,language));const text=JSON.stringify(preview);
  assert.ok(preview.title);assert.ok(preview.rows.length>=2);assert.ok(!text.includes(kind));assert.ok(!text.includes('Unassigned'));assert.ok(!text.includes('Anonymous'));
  const empty=larkNotificationPreview({kind,language,name:'Anonymous',owner:'Unassigned'});assert.ok(!JSON.stringify(empty).includes('Anonymous'));assert.ok(!JSON.stringify(empty).includes('Unassigned'));
 }
 const booking=larkNotificationPreview(larkNotificationSample('booking.requested','zh'));assert.match(JSON.stringify(booking),/尚未确认/);
 assert.match(JSON.stringify(larkNotificationPreview(larkNotificationSample('enrollment.requested','zh'))),/不代表报名或付款已确认/);
 assert.match(JSON.stringify(larkNotificationPreview(larkNotificationSample('conversation.reactivated','zh'))),/尚不代表已发送新消息/);
 assert.ok(!larkNotificationPreview(larkNotificationSample('notification.failed','zh')).rows.some(r=>r.label==='来源'));
});
test('failure cards distinguish unknown receipt and definitive failure, keep operational errors private and links useful',async()=>{
 for(const state of ['unknown','failed']){
  const src=await larkFailureSource({query:async()=>({rows:[{state,channel:'lark',attempts:3,snapshot:{event:'lead.created',secret:'DO NOT LEAK'},result:'https://secret/token',completed_at:'2030-01-06'}]})},{jobId:'j'});
  const card=standardLarkCard({...larkNotificationSample('notification.failed','zh'),...src},undefined,undefined,new Date());const text=JSON.stringify(card);
  assert.ok(!text.includes('secret'));assert.ok(!text.includes('DO NOT LEAK'));assert.ok(card.card.elements[1].actions[0].url.includes('tab=policy'));
  assert.ok(text.includes(state==='unknown'?'发送结果未确认':'发送未成功'));
 }
 assert.equal(await larkFailureSource({query:async()=>({rows:[{state:'accepted'}]})},{jobId:'j'}),null);
});
test('request source uses exact customer and correct action; never substitutes unrelated conversation',async()=>{
 const queries:any[]=[];const db={query:async(sql:string,args:any[])=>{queries.push({sql,args});return {rows:sql.includes('crm_engagements')?[{data:{action:'booking',conversationId:'c',messageId:'m'}}]:[{content:'请帮我确认周六的试听安排。'}]};}};
 const source=await larkEventSource(db,'booking.requested','lead-a',{requestEvidenceId:'request-a'});assert.ok(source&&'excerpt'in source&&source.excerpt);
 assert.deepEqual(queries[1].args,['c','m','lead-a']);assert.ok(queries[1].sql.includes("role='user'"));
 assert.equal(await larkEventSource(db,'enrollment.requested','lead-a',{requestEvidenceId:'request-a'}),null);
 assert.equal(await larkEventSource({query:async()=>({rows:[]})},'ai.failed','other',{conversationId:'c',messageId:'m'}),null);
});
