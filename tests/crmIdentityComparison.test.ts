import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {identityRoute,identityUrl} from '../src/utils/crmIdentityNavigation.ts';
test('identity direct URL preserves customer/tab/filter/hash context',()=>{
 const start='http://localhost:3000/crm?tab=leads&lead=A&leadView=profile#context';
 const next=identityUrl(start,{leadId:'B & C',candidateId:'D'});
 assert.deepEqual(identityRoute(next),{leadId:'B & C',candidateId:'D'});assert.equal(identityUrl(next,null),start);assert.equal(identityRoute(start),null);
});
if(process.env.MYSQL_NATIVE_TEST_ENV){
 const {setupNativeTest}=await import('./helpers/mysql.mjs');await setupNativeTest('identity_comparison');process.env.PLATFORM_MODE='local';
 const {pool}=await import('../server/portal/store.ts');const {mountPortal}=await import('../server/portal/runtime.ts');const {default:express}=await import('express');
 test('comparison access, original evidence, stale snapshot rejection and exact idempotent decision',async t=>{
  const app=express();app.use(express.json());await mountPortal(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;
  t.after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();});
  const session=()=>{let cookie='';return async(path:string,body?:any,method?:string)=>{const r=await fetch(base+path,{method:method||(body===undefined?'GET':'POST'),headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});for(const h of r.headers.getSetCookie())cookie=h.split(';')[0];return {status:r.status,data:await r.json()};};};
  const sales=session(),manager=session();for(const [s,n]of [[sales,'Fadhil'],[manager,'Suki']]as const)assert.equal((await s('/api/crm/auth/login',{loginId:n,password:n})).status,200);
  const a='TEST-comparison-'+randomUUID(),b='TEST-peer-'+randomUUID(),visitor=randomUUID();
  for(const [id,name,owner]of [[a,'TEST Contacted','Fadhil'],[b,'TEST Different Name',null]])await pool.query('INSERT INTO portal_leads(id,business_number,profile) VALUES(:p1,:p2,:p3)',[id,id,{id,fullName:name,email:'comparison@example.invalid',whatsapp:'',owner,manualNotes:'Hot is customer original text',tier:'Hot',currentStage:'New',latestAssessment:{score:17,maxScore:20}}]);
  await pool.query('INSERT INTO visitor_sessions(id,expires_at) VALUES(:p1,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY))',[visitor]);await pool.query('INSERT INTO identity_candidates(visitor_id,lead_id,candidate_id) VALUES(:p1,:p2,:p3)',[visitor,a,b]);
  const before=(await pool.query('SELECT id,profile FROM portal_leads WHERE id IN (:p1,:p2) ORDER BY id',[a,b])).rows;
  const path='/api/crm/leads/'+a;
  const forbidden=await sales(path+'/identity-comparison?candidateId='+b);assert.equal(forbidden.status,403);assert.equal(forbidden.data.left,undefined);
  const first=await manager(path+'/identity-comparison');assert.equal(first.status,200);assert.equal(first.data.candidateId,b);assert.equal(first.data.canConfirm,true);assert.equal(first.data.left.recordRole,'review_subject');assert.equal(first.data.right.recordRole,'existing_match');const reverseComparison=await manager('/api/crm/leads/'+b+'/identity-comparison?candidateId='+a);assert.equal(reverseComparison.data.left.recordRole,'existing_match');assert.equal(reverseComparison.data.right.recordRole,'review_subject');assert.deepEqual(first.data.basis,['email']);assert.equal(first.data.left.profile.manualNotes,'Hot is customer original text');
  assert.equal((await manager(path+'/identity-comparison?candidateId=missing')).status,404);
  const body={requestId:randomUUID(),candidateId:b,decision:'shared',reason:'TEST two people sharing an email',expectedComparisonRevision:first.data.revision};
  await pool.query("UPDATE portal_leads SET profile=JSON_SET(profile,'$.city','TEST new city') WHERE id=:p1",[b]);
  const changed=await manager(path+'/identity-actions',body);assert.equal(changed.status,409);assert.equal(changed.data.error,'Identity evidence changed; refresh and review');assert.equal((await pool.query('SELECT decision FROM identity_candidates WHERE lead_id=:p1',[a])).rows[0].decision,'pending');
  const latest=await manager(path+'/identity-comparison?candidateId='+b);body.expectedComparisonRevision=latest.data.revision;
  const saved=await manager(path+'/identity-actions',body);assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal((await manager(path+'/identity-actions',body)).data.replayed,true);
  const lookup=await manager(path+'/operations/'+body.requestId);assert.equal(lookup.status,200);assert.equal(lookup.data.saved,true);assert.equal(lookup.data.leadId,a);
  const after=await manager(path+'/identity-comparison?candidateId='+b);assert.equal(after.data.pending,false);assert.equal(after.data.decision,'shared');assert.equal(after.data.canConfirm,false);assert.equal(after.data.decidedBy,'Suki');assert.match(after.data.decidedAt,/Z$/);assert.ok(Math.abs(Date.now()-Date.parse(after.data.decidedAt))<10000);
  const profiles=(await pool.query('SELECT id,profile FROM portal_leads WHERE id IN (:p1,:p2) ORDER BY id',[a,b])).rows;
  for(let i=0;i<before.length;i++){assert.equal(profiles[i].profile.owner,before[i].profile.owner);assert.deepEqual(profiles[i].profile.latestAssessment,before[i].profile.latestAssessment);}
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM followup_tasks')).rows[0].n),0);
  assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM crm_facts WHERE kind='identity.shared' AND lead_id=:p1",[a])).rows[0].n),1);
  // Global controls never replace the caller's existing record permissions.
  const policy=(await manager('/api/crm/policy-config')).data;assert.equal(policy.identityReviewManagerOnly,true);assert.equal(policy.ownerAssignmentManagerOnly,false);assert.equal(policy.sourceAttributionManagerOnly,true);
  assert.equal((await sales('/api/crm/policy-config',{ownerAssignmentManagerOnly:false})).status,403);
  assert.equal((await manager('/api/crm/policy-config',{ownerAssignmentManagerOnly:'true'})).status,400);
  assert.equal((await manager('/api/crm/policy-config',{identityReviewManagerOnly:false,ownerAssignmentManagerOnly:true})).status,200);
  const c='TEST-control-'+randomUUID(),d='TEST-owned-'+randomUUID(),v2=randomUUID();
  for(const [id,owner]of [[c,null],[d,'Fadhil']])await pool.query('INSERT INTO portal_leads(id,business_number,profile) VALUES(:p1,:p2,:p3)',[id,id,{id,fullName:id,email:'comparison@example.invalid',owner,currentStage:'New'}]);
  await pool.query('INSERT INTO visitor_sessions(id,expires_at) VALUES(:p1,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY))',[v2]);
  await pool.query('INSERT INTO identity_candidates(visitor_id,lead_id,candidate_id) VALUES(:p1,:p2,:p3)',[v2,a,d]);
  const salesCompare=await sales(path+'/identity-comparison?candidateId='+d);assert.equal(salesCompare.status,200);assert.equal(salesCompare.data.canConfirm,true);
  const controlDecision={requestId:randomUUID(),candidateId:d,decision:'different',reason:'TEST same owner, different people',expectedComparisonRevision:salesCompare.data.revision};
  assert.equal((await sales(path+'/identity-actions',controlDecision)).status,200);
  assert.equal((await sales('/api/crm/leads/'+c+'/claim',{})).data.error,'OWNER_MANAGER_REQUIRED');
  assert.equal((await sales(path,{owner:'Wigar'},'PATCH')).data.error,'OWNER_MANAGER_REQUIRED');
  assert.equal((await manager('/api/crm/leads/'+c+'/claim',{})).data.error,'Sales claim permission required');
  assert.equal((await manager('/api/crm/leads/'+c)).data.lead.identityReview.ownerAssignmentManagerOnly,true);
  assert.equal((await manager('/api/crm/leads/'+c,{owner:'Wigar'},'PATCH')).status,200);
  assert.equal((await manager('/api/crm/leads/'+c)).data.lead.owner,'Wigar');
  assert.equal((await manager('/api/crm/leads/'+c,{owner:null},'PATCH')).status,200);
  const stored=(await manager('/api/crm/policy-config')).data;assert.deepEqual(stored.businessHours,policy.businessHours);assert.deepEqual(stored.firstResponseSla,policy.firstResponseSla);
  assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM portal_audit WHERE action='crm.access-controls.save'")).rows[0].n),1);
  // Enabled Sales review does not authorize a second owner's records.
  await pool.query("UPDATE portal_leads SET profile=JSON_SET(profile,'$.owner','Wigar') WHERE id=:p1",[d]);
  assert.equal((await sales(path+'/identity-comparison?candidateId='+d)).status,404);
  // Old pages cannot submit after the manager-only gate is switched back on.
  assert.equal((await manager('/api/crm/policy-config',{identityReviewManagerOnly:true,ownerAssignmentManagerOnly:false})).status,200);
  assert.equal((await sales(path+'/identity-actions',{...controlDecision,requestId:randomUUID()})).data.error,'IDENTITY_MANAGER_REQUIRED');
  assert.equal((await sales('/api/crm/leads/'+c+'/claim',{})).status,200);
  assert.equal((await sales(path,{owner:'Wigar'},'PATCH')).data.error,'Lead assignment permission required');
  const {canReviewSourceAttribution,assertSourceAttributionReviewer}=await import('../server/portal/crmAccessControls.ts');
  const operator:any={id:'TEST Marketing Operator',active:true,roles:['sales'],permissions:['crm.read','campaigns.manage'],scope:'all'};
  assert.equal(await canReviewSourceAttribution(pool,operator),false);
  await assert.rejects(assertSourceAttributionReviewer(pool,operator),(e:any)=>e.status===403);
  assert.equal((await manager('/api/crm/policy-config',{sourceAttributionManagerOnly:false})).status,200);
  assert.equal(await canReviewSourceAttribution(pool,operator),true);
  assert.equal(await canReviewSourceAttribution(pool,{...operator,permissions:['crm.read']}),false);
  assert.equal(await canReviewSourceAttribution(pool,{...operator,active:false}),false);
  assert.equal((await manager('/api/crm/policy-config',{sourceAttributionManagerOnly:'false'})).status,400);
  assert.equal((await manager('/api/crm/policy-config',{sourceAttributionManagerOnly:true})).status,200);
  await assert.rejects(assertSourceAttributionReviewer(pool,operator),(e:any)=>e.status===403);


 });
}
