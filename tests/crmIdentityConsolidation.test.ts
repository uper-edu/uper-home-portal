import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalIdentity,consolidatedProfile,identityProjectionRows,mergeIdentityLead,assertIdentitySalesAllowed,activateIdentityLead,explicitIdentityRefusal,lockIdentityRegistry} from '../server/portal/identityConsolidation.ts';
import {attachIdentity,discoverIdentity,identityMatch,pendingIdentity} from '../server/portal/identityReview.ts';
import {progressActionState} from '../src/utils/crmProgressAction.ts';
import {campaignMetrics} from '../src/utils/crmCampaignMetrics.ts';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CrmIdentityAction} from '../src/components/crm/CrmIdentityAction.tsx';

const a={id:'A',fullName:'TEST A',whatsapp:'+6281234567891',email:'a@example.invalid',owner:'sales-a',currentStage:'progress:needs',tier:'Hot',submittedAt:'2026-10-27T01:00:00.000Z',campaignId:'campaign-a',contactArrangement:{state:'stopped',version:2},followUpLogs:[{id:'log-a'}]};
const b={id:'B',fullName:'TEST B',whatsapp:a.whatsapp,email:'b@example.invalid',owner:null,identityLifecycle:'pending',submittedAt:'2026-10-27T02:00:00.000Z',campaignId:'campaign-b'};
function fake(extra:(sql:string,values:any[])=>any=()=>undefined){
 const writes:any[]=[];
 return {writes,async query(sql:string,values:any[]=[]){
  if(/^(UPDATE|INSERT)/.test(sql)){writes.push({sql,values});return {rows:[],rowCount:1};}
  const custom=extra(sql,values);if(custom!==undefined)return {rows:custom};
  if(sql.includes('FROM portal_leads WHERE id='))return {rows:[{id:values[0],profile:values[0]==='A'?structuredClone(a):structuredClone(b)}]};
  if(sql.includes('FROM followup_tasks'))return {rows:[]};
  if(sql.includes('SELECT candidate_id'))return {rows:[]};
  if(sql.includes('FROM identity_candidates'))return {rows:[{lead_id:'B',candidate_id:'A',decision:'pending',source_profile:b,candidate_profile:a}]};
  if(sql.includes('FROM portal_settings'))return {rows:[{value:{}}]};
  return {rows:[]};
 }};
}
test('only B is pending; the original A remains usable and the manager cannot bypass B sales restrictions',async()=>{
 const db=fake(),profiles=[structuredClone(a),structuredClone(b)];
 await attachIdentity(db,{id:'manager',roles:['crm_leader'],active:true,permissions:['crm.followup'],scope:'all'},profiles);
 assert.equal(profiles[0].identityReview.pending,false);assert.equal(profiles[1].identityReview.pending,true);assert.equal(profiles[1].identityReview.blocked,true);
 await assertIdentitySalesAllowed(db,'A');await assert.rejects(assertIdentitySalesAllowed(db,'B'),/IDENTITY_REVIEW_REQUIRED/);
 assert.equal(progressActionState({active:true,permissions:['crm.followup']},profiles[1]),'hidden');
});
test('pending identity limits a customer read in SQL and retains matching merged aliases',async()=>{
 const other={...b,id:'C'};
 const root={...a,email:'root@example.invalid',whatsapp:'+6281234567892'};
 const alias={...a,id:'alias-of-A',identityMergedInto:'A'};
 const candidates=[
  {lead_id:'B',candidate_id:'A',source_profile:b,candidate_profile:root},
  {lead_id:'C',candidate_id:'A',source_profile:other,candidate_profile:root},
 ];
 const reads:{values:string[];locked:boolean}[]=[];
 const db={async query(sql:string,values:string[]=[]){
  if(sql.includes('FROM identity_candidates')){
   const scoped=sql.includes('AND i.lead_id=:p1');
   assert.equal(scoped,values.length===1);
   reads.push({values,locked:sql.endsWith('FOR UPDATE')});
   return {rows:scoped?candidates.filter(row=>row.lead_id===values[0]):candidates};
  }
  assert.match(sql,/identityMergedInto/);
  return {rows:[{id:alias.id,profile:alias}]};
 }};
 const all=await pendingIdentity(db);
 const scoped=await pendingIdentity(db,'B');
 assert.equal(all.length,2);
 assert.deepEqual(scoped,all.filter(row=>row.lead_id==='B'));
 assert.deepEqual(scoped[0].aliasMatches,[{id:alias.id,name:alias.fullName,basis:['phone']}]);
 assert.deepEqual(await pendingIdentity(db,'B',true),scoped);
 assert.deepEqual(await pendingIdentity(db,'missing'),[]);
 assert.deepEqual(reads,[
  {values:[],locked:false},{values:['B'],locked:false},
  {values:['B'],locked:true},{values:['missing'],locked:false},
 ]);
});
test('batched discovery preserves alias evidence, pending fallback and manual decisions in MySQL',{
 skip:!process.env.MYSQL_NATIVE_TEST_ENV && 'Requires authorized isolated MySQL',
},async t=>{
 const {setupNativeTest}=await import('./helpers/mysql.mjs');
 const {disposeNativeTest}=await import('./helpers/disposeNativeTest.mjs');
 const fixture=await setupNativeTest('identity_discovery_batch');
 const {pool,tx}=await import('../server/portal/store.ts');
 t.after(async()=>{await pool.end();await disposeNativeTest(fixture);});

 const phone='+6281234597201';
 const incoming={email:'incoming@example.invalid',whatsapp:phone};
 const leads={
  newLead:incoming,
  parent:{email:incoming.email,whatsapp:'+6281234597202'},
  pending:{email:'pending@example.invalid',whatsapp:phone,identityLifecycle:'pending'},
  evidence:{email:'pending@example.invalid',identityMergedInto:'parent'},
  fallback:{email:'fallback@example.invalid',whatsapp:phone,identityLifecycle:'pending'},
  otherParent:{email:'fallback@example.invalid',whatsapp:'+6281234597203'},
  aliasOne:{whatsapp:phone,identityMergedInto:'retained'},
  aliasTwo:{whatsapp:phone,identityMergedInto:'retained'},
  retained:{email:'retained@example.invalid'},
  shared:{whatsapp:phone},
  different:{whatsapp:phone},
 };
 for(const [id,profile] of Object.entries(leads))await pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',[id,{...profile,id}]);
 for(const [id,lead] of [['visitor-new','newLead'],['visitor-prior','newLead'],['visitor-pending','pending'],['visitor-fallback','fallback']]){
  await pool.query('INSERT INTO visitor_sessions(id,lead_id,expires_at) VALUES(:p1,:p2,UTC_TIMESTAMP(6)+INTERVAL 1 HOUR)',[id,lead]);
 }
 for(const [visitor,lead,candidate,decision] of [
  ['visitor-pending','pending','parent','pending'],
  ['visitor-fallback','fallback','otherParent','pending'],
  ['visitor-prior','newLead','shared','shared'],
  ['visitor-prior','newLead','different','different'],
 ]){
  await pool.query('INSERT INTO identity_candidates(visitor_id,lead_id,candidate_id,decision) VALUES(:p1,:p2,:p3,:p4)',[visitor,lead,candidate,decision]);
 }
 const submit=()=>tx(async c=>{
  await lockIdentityRegistry(c);
  return discoverIdentity(c,'visitor-new','newLead',incoming);
 });
 assert.equal(await submit(),3);
 assert.equal(await submit(),3);
 const result=(await pool.query('SELECT candidate_id,decision FROM identity_candidates WHERE lead_id=:p1 ORDER BY candidate_id',['newLead'])).rows;
 assert.deepEqual(result.map(({candidate_id,decision})=>[candidate_id,decision]),[
  ['different','different'],['fallback','pending'],['parent','pending'],['retained','pending'],['shared','shared'],
 ]);

 await pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)', ['broken-alias',{whatsapp:phone,identityMergedInto:'missing'}]);
 await assert.rejects(submit(),{message:'IDENTITY_TARGET_CHANGED',status:409});
});
test('same-person association changes only B, retains originals and all A business state and deadlines',async()=>{
 const db=fake();const result=await mergeIdentityLead(db,b,a,'manager','TEST verified in person');
 assert.deepEqual(result,{canonicalLeadId:'A',sourceLeadId:'B',merged:true});
 const changes=db.writes.filter(w=>w.sql.startsWith('UPDATE portal_leads'));
 assert.equal(changes.length,1);assert.equal(changes[0].values[0],'B');assert.equal(changes[0].values[1].identityMergedInto,'A');
 assert.equal(db.writes.some(w=>/UPDATE (visitor_sessions|conversations|hsk_attempts|followup_tasks)/.test(w.sql)),false);
 assert.equal(db.writes.some(w=>/DELETE/.test(w.sql)),false);
 assert.ok(db.writes.some(w=>w.sql.includes("state='pending'")&&w.sql.includes('notification_jobs')));
});
test('old duplicate business and cross conflicts are rejected without partial association',async()=>{
 for(const prior of [{...b,owner:'sales-b'},{...b,followUpLogs:[{id:'old'}]},{...b,contactArrangement:{state:'stopped'}}]){
  const db=fake();await assert.rejects(mergeIdentityLead(db,prior,a,'manager','TEST'),/IDENTITY_LEGACY/);assert.equal(db.writes.length,0);
 }
 const cross=fake(sql=>sql.includes('SELECT candidate_id')?[{candidate_id:'C'}]:undefined);
 await assert.rejects(mergeIdentityLead(cross,b,a,'manager','TEST'),/IDENTITY_CROSS/);assert.equal(cross.writes.length,0);
});
test('retained A data wins, source identifiers remain searchable and campaign source does not overwrite first touch',()=>{
 const p=consolidatedProfile(a,[b]);assert.equal(p.owner,a.owner);assert.equal(p.currentStage,a.currentStage);assert.equal(p.campaignId,'campaign-a');assert.equal(p.email,a.email);
 assert.deepEqual(p.followUpLogs,a.followUpLogs);assert.deepEqual(p.contactArrangement,a.contactArrangement);
 assert.equal(p.identitySources[0].campaignId,'campaign-b');assert.match(p.identitySearchTerms,/TEST B/);
});
test('immutable B facts project under A but retain origin and IDs',async()=>{
 const fact={id:'fact-b',lead_id:'B',data:{text:'customer original'},created_at:'2026-10-27 02:00:00'};
 const db={query:async(_sql:string,v:any[])=>{assert.deepEqual(JSON.parse(v[0]),['A','B']);return {rows:[fact]};}};
 const rows=await identityProjectionRows(db,[consolidatedProfile(a,[b])],'SELECT test');
 assert.equal(rows[0].lead_id,'A');assert.equal(rows[0].originLeadId,'B');assert.equal(rows[0].id,'fact-b');assert.equal(fact.lead_id,'B');
});
test('old CRM reference resolves to A; no visitor session is reassigned or returned',async()=>{
 const db=fake((sql,values)=>sql.includes('FROM portal_leads WHERE id=')?[{id:values[0],profile:values[0]==='B'?{...b,identityMergedInto:'A'}:a}]:undefined);
 assert.equal((await canonicalIdentity(db,'B'))?.id,'A');assert.equal(db.writes.length,0);
 await assert.rejects(assertIdentitySalesAllowed(db,'B'),/IDENTITY_RECORD_MERGED/);
});
test('refusals require direct full statements, not quoted examples or questions',()=>{
 for(const text of ['请不要再联系我。','Please do not contact me again.','Jangan hubungi saya lagi.'])assert.equal(explicitIdentityRefusal(text),true,text);
 for(const text of ['如果客户说不要再联系我怎么办','What if someone says "stop contacting me"?','不要再联系我的朋友','Can you stop contacting me?'])assert.equal(explicitIdentityRefusal(text),false,text);
});
test('matching is non-empty and supports the chronological cross-contact counterexample',()=>{
 const first={whatsapp:'+6281234567891',email:'a@example.invalid'},second={whatsapp:'+6281234567892',email:'b@example.invalid'},third={whatsapp:first.whatsapp,email:second.email};
 assert.deepEqual(identityMatch(first,second),[]);assert.deepEqual(identityMatch(third,first),['phone']);assert.deepEqual(identityMatch(third,second),['email']);assert.deepEqual(identityMatch({},{ }),[]);
});
test('release does not create a second first-contact task when one already exists',async()=>{
 const db=fake(sql=>sql.includes('FROM followup_tasks')?[{id:'first-existing'}]:undefined);
 assert.equal((await activateIdentityLead(db,b,'manager')).id,'B');assert.equal(db.writes.length,0);
});
test('campaign registrations retain both sources without copying enrollment or counting pending identity as a customer',()=>{
 const p=consolidatedProfile({...a,currentStage:'Enrolled',revenue:100},[b]);
 const first=campaignMetrics([p],{id:'campaign-a',code:'campaign-a',name:'A'});
 const second=campaignMetrics([p],{id:'campaign-b',code:'campaign-b',name:'B'});
 assert.equal(first.leadsCount,1);assert.equal(first.totalRevenue,100);assert.equal(second.leadsCount,1);assert.equal(second.registrationRecordsCount,1);assert.equal(second.enrolledCount,0);assert.equal(second.totalRevenue,0);
 const pending=campaignMetrics([b],{id:'campaign-b',code:'campaign-b',name:'B'});assert.equal(pending.leadsCount,0);assert.equal(pending.pendingIdentityCount,1);assert.equal(pending.registrationRecordsCount,1);
});
test('identity review has one shared priority action and explicit labels in all three languages',()=>{
 for(const [lang,label] of [['zh','核实身份'],['en','Review identity'],['id','Verifikasi identitas']]){
  const html=renderToStaticMarkup(React.createElement(CrmIdentityAction,{lang,onClick:()=>{}}));assert.ok(html.includes(label));assert.ok(html.includes('crm-identity-action'));assert.ok(html.includes('data-identity-priority="true"'));assert.ok(html.includes('aria-hidden="true"'));
 }
});
