import {crmError} from '../src/utils/crmLanguage';
import test from 'node:test';import assert from 'node:assert/strict';
import {notificationTarget,notificationDestination} from '../src/utils/crmNotificationTarget.ts';
import {leadDetailUrl} from '../src/utils/crmDetailNavigation.ts';
import {resolveNotificationTarget,matchesDigestTarget,digestTargetScope} from '../server/portal/notificationTarget.ts';
import {standardLarkCard,dailyDigestCard} from '../server/portal/notificationDelivery.ts';
test('source routes retain exact opaque IDs and correct page; moving customers clears stale targets',()=>{
 for(const [kind,tab] of [['assessment','assessment'],['request','activities'],['message','chat'],['task','activities'],['fact','profile']] as const){const u=notificationDestination('http://localhost:3000','lead-a',{kind,id:'source:one & two'});assert.equal(u.searchParams.get('leadView'),tab);assert.deepEqual(notificationTarget(u.href),{kind,id:'source:one & two'});assert.equal(new URL(leadDetailUrl(u.href,'lead-b')).searchParams.get('targetId'),null);assert.equal(new URL(leadDetailUrl(u.href,'lead-a',tab)).searchParams.get('targetId'),'source:one & two');}
 assert.throws(()=>notificationTarget('http://localhost/crm?target=bogus&targetId=x'));assert.throws(()=>notificationTarget('http://localhost/crm?target=assessment'));assert.equal(notificationTarget('http://localhost/crm'),null);
});
test('cards select exact assessment, request, failed message, original delivery job and aggregate scope',()=>{
 const clock=new Date();
 const a=standardLarkCard({kind:'assessment.completed',language:'zh',name:'Arif',target:{kind:'assessment',id:'attempt-old'}},'lead-a',undefined,clock);const u=new URL(a.card.elements[1].actions[0].url);assert.equal(u.searchParams.get('targetId'),'attempt-old');assert.equal(u.searchParams.get('leadView'),'assessment');
 const f=standardLarkCard({kind:'notification.failed',language:'zh',name:'',jobId:'original-failed-job'},undefined,undefined,clock);const j=new URL(f.card.elements[1].actions[0].url);assert.equal(j.searchParams.get('policyTopic'),'notification-jobs');assert.equal(j.searchParams.get('job'),'original-failed-job');
 const m=standardLarkCard({kind:'ai.failed',language:'id',name:'Maya',target:{kind:'message',id:'failed-reply'}},'lead-a',undefined,clock);assert.equal(new URL(m.card.elements[1].actions[0].url).searchParams.get('targetId'),'failed-reply');
 const d=dailyDigestCard({language:'en',jobId:'daily-job',date:'2030-01-06',counts:[]},undefined,clock);assert.equal(new URL(d.card.elements[1].actions[0].url).searchParams.get('digestJob'),'daily-job');
});
test('exact source lookup keeps missing source absent and uses customer ownership on every record query',async()=>{
 const calls:any[]=[];const db={query:async(sql:string,args:any[])=>{calls.push({sql,args});return {rows:[]};}};
 for(const kind of ['assessment','request','conversation','message','task','fact','submission'])assert.equal(await resolveNotificationTarget(db,'lead-a',kind,'source-b'),null);
 assert.ok(calls.every(c=>c.args.includes('lead-a')));assert.ok(calls.every(c=>c.sql.includes('lead_id')));
 const r=await resolveNotificationTarget({query:async()=>({rows:[{id:'old-attempt'}]})},'lead-a','assessment','old-attempt');assert.deepEqual(r,{tab:'assessment',assessmentId:'old-attempt'});
});
test('digest drilldown uses the saved operating date and filters; it never changes date-only scope with viewer timezone',async()=>{
 const scope={date:'2030-01-06',timezone:'Asia/Jakarta',tiers:['Hot'],states:['progress:discovery'],sources:['standalone_chat']};const p={tier:'Hot',currentStage:'progress:discovery',entryPoint:'standalone_chat'};
 assert.equal(matchesDigestTarget(p,'2030-01-05T18:00:00Z',scope),true);assert.equal(matchesDigestTarget(p,'2030-01-05T16:59:59Z',scope),false);assert.equal(matchesDigestTarget({...p,tier:'Cold'},'2030-01-06T01:00:00Z',scope),false);assert.equal(matchesDigestTarget(p,null,scope),false);
 const saved=await digestTargetScope({query:async()=>({rows:[{snapshot:{event:'daily.digest',rule:scope,payload:{date:scope.date}}}]})},'job');assert.deepEqual(saved,scope);
 assert.equal(await digestTargetScope({query:async()=>({rows:[{snapshot:{event:'lead.created'}}]})},'job'),null);
});

test('requests resolve their exact original interaction box, not a latest message',async()=>{let n=0;const r=await resolveNotificationTarget({query:async()=>({rows:++n===1?[{id:'request-a',data:{conversationId:'conv-a',messageId:'req-a'}}]:[{id:'original-msg',conversation_id:'conv-a'}]})},'lead-a','request','request-a');assert.deepEqual(r,{tab:'activities',historyId:'message:original-msg',conversationId:'conv-a',messageId:'original-msg'});});

test('unavailable notification target retains a safe specific explanation in all languages',()=>{for(const lang of ['zh','en','id'] as const){assert.match(crmError('NOTIFICATION_TARGET_UNAVAILABLE',lang),lang==='zh'?/无法定位/:lang==='en'?/unavailable/:/tidak dapat/);assert.notEqual(crmError('NOTIFICATION_TARGET_UNAVAILABLE',lang),crmError('private backend detail',lang));}});
