import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalIdentity,consolidatedProfile,identityProjectionRows,mergeIdentityLead,assertIdentitySalesAllowed,activateIdentityLead,explicitIdentityRefusal} from '../server/portal/identityConsolidation.ts';
import {attachIdentity,identityMatch} from '../server/portal/identityReview.ts';
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
