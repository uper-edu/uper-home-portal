import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {promotionReviewActions} from '../src/utils/promotionReviewActions.ts';
import {PROMOTION_EXPERIENCE} from '../src/utils/campaignPromotion.ts';
test('review action explanations separate evidence-based linking, new entry creation, deferral and invalid attribution',()=>{
 assert.deepEqual(promotionReviewActions.map(a=>a.value),['link','create','defer','invalid']);
 assert.match(promotionReviewActions[1].effect,/new p/);assert.match(promotionReviewActions[2].effect,/Needs review/);assert.match(promotionReviewActions[3].effect,/Keep the customer/);
});
if(process.env.MYSQL_NATIVE_TEST_ENV){
 const {setupNativeTest}=await import('./helpers/mysql.mjs');await setupNativeTest('promotion_reviews');
 const {pool}=await import('../server/portal/store.ts');const {nativePool}=await import('../cloud/mysql/runtime.mjs');
 const {listPromotionReviews,reviewPromotion,promotionReviewResult}=await import('../server/portal/promotionReviews.ts');const {promotionAttribution}=await import('../server/portal/campaignPromotion.ts');
 const manager:any={id:'Manager',active:true,scope:'all',roles:['crm_leader'],permissions:['crm.read','crm.followup','campaigns.manage']};
 const entry={id:'p-existing',name:'TEST Instagram',source:'instagram',medium:'paid_social',language:'en',experience:PROMOTION_EXPERIENCE,createdAt:'2026-10-20T00:00:00Z'};
 const campaign={id:'A',code:'camp-test-A',name:'TEST Campaign A',promotionLinks:[entry],stats:{impressions:7}},other={id:'B',code:'camp-test-B',name:'TEST Campaign B',promotionLinks:[{...entry,id:'p-other'}],stats:{}};
 for(const c of [campaign,other])await pool.query('INSERT INTO trial_campaigns(id,code,config) VALUES(:p1,:p2,:p3)',[c.id,c.code,c]);
 const originals=new Map<string,any>();
 const base=(id:string,patch:any={})=>({id,fullName:'TEST '+id,campaignId:campaign.code,campaign:campaign.name,rawPromotionLinkId:'bad-p',promotionLinkStatus:'unverified',entryPoint:'unverified_source',placement:'unrecorded',owner:'Sales',tier:'Hot',quizScore:28,submittedAt:'2026-10-20T00:00:00Z',...patch});
 async function seed(id:string,patch:any={}){await pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',[id,base(id,patch)]);originals.set(id,(await pool.query('SELECT profile FROM portal_leads WHERE id=:p1',[id])).rows[0].profile);}
 const body=(action:string,extra:any={})=>({action,reason:'TEST evidence from operator',revision:0,campaignId:campaign.id,rawCode:campaign.code,rawPromotionLinkId:'bad-p',requestId:randomUUID(),...extra});
 await test('queue detects known campaign / bad p; valid p, legacy missing p and unknown campaigns are not mixed in',async()=>{
  await seed('link');await seed('create');await seed('defer');await seed('invalid');await seed('valid',{rawPromotionLinkId:undefined,promotionLinkId:entry.id,promotionLinkStatus:'verified'});await seed('legacy',{rawPromotionLinkId:undefined,promotionLinkStatus:undefined});await seed('unknown-c',{campaignId:'unknown-c',campaign:'unknown-c'});
  assert.deepEqual((await listPromotionReviews(manager)).map((r:any)=>r.leadId).sort(),['create','defer','invalid','link']);
 });
 await test('link existing entry preserves raw first-touch fields, tasks, deadlines and notification jobs; retries/results are exact',async()=>{
  await pool.query("INSERT INTO followup_tasks(id,lead_id,kind,due_at,details) VALUES('keep-task','link','consultation','2030-01-01',:p1)",[{action:'TEST keep task'}]);
  await pool.query("INSERT INTO outbox(id,type,lead_id,payload) VALUES('keep-event','test','link',:p1)",[{}]);
  await pool.query("INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,snapshot) VALUES('keep-job','keep-event','test',1,'test','TEST','2030-01-01',:p1)",[{}]);
  const tasks=(await pool.query('SELECT * FROM followup_tasks')).rows,jobs=(await pool.query('SELECT * FROM notification_jobs')).rows;
  const b=body('link',{linkId:entry.id}),before=originals.get('link');const result=await reviewPromotion('link',b,manager);
  for(let i=0;i<10;i++)assert.deepEqual(await reviewPromotion('link',b,manager),result);
  assert.deepEqual(await promotionReviewResult('link',b.requestId,manager),result);
  const p=(await pool.query("SELECT profile FROM portal_leads WHERE id='link'")).rows[0].profile;assert.equal(p.promotionReview.linkId,entry.id);const original={...p};delete original.promotionReview;assert.deepEqual(original,before);
  assert.deepEqual((await pool.query('SELECT * FROM followup_tasks')).rows,tasks);assert.deepEqual((await pool.query('SELECT * FROM notification_jobs')).rows,jobs);
 });
 await test('reject cross-campaign entry, unauthorized users and stale review versions without writes',async()=>{
  await assert.rejects(reviewPromotion('defer',undefined,manager),(e:any)=>e.status===400);
  await assert.rejects(reviewPromotion('defer',body('create'),manager),(e:any)=>e.status===400);
  await assert.rejects(reviewPromotion('defer',body('link',{linkId:'p-other'}),manager),(e:any)=>e.status===400);
  await assert.rejects(reviewPromotion('defer',body('invalid'),{...manager,permissions:['crm.read']}),(e:any)=>e.status===403);
  await assert.rejects(reviewPromotion('defer',body('invalid'),{...manager,id:'OtherSales',scope:'own'}),(e:any)=>e.status===403);
  await assert.rejects(reviewPromotion('defer',body('invalid',{rawPromotionLinkId:'changed'}),manager),(e:any)=>e.status===409);
  await assert.rejects(reviewPromotion('link',body('invalid'),manager),(e:any)=>e.status===409);
 });
 await test('create-and-link is atomic and idempotent under ten parallel retries; new arrivals do not inherit approval',async()=>{
  const b=body('create',{entry:{name:'TEST Poster',source:'campus_a',medium:'poster',language:'id',experience:PROMOTION_EXPERIENCE}});
  const results=await Promise.all(Array.from({length:10},()=>reviewPromotion('create',b,manager)));results.forEach(r=>assert.deepEqual(r,results[0]));
  const c=(await pool.query("SELECT config FROM trial_campaigns WHERE id='A'")).rows[0].config;assert.equal(c.promotionLinks.length,2);assert.match(results[0].linkId,/^p_/);assert.equal(results[0].scope,'this_customer_only');
  const audits=(await pool.query("SELECT data FROM portal_audit WHERE action='campaign.promotion.review' AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.leadId'))='create'")).rows;assert.equal(audits.length,1);
  await seed('future');assert.equal((await listPromotionReviews(manager)).find((r:any)=>r.leadId==='future').status,'pending');
  const p=await promotionAttribution(pool,{}, {campaignId:campaign.code,promotionLinkId:'bad-p'});assert.equal(p.promotionLinkStatus,'unverified');assert.equal(p.promotionSnapshot,undefined);
  await assert.rejects(reviewPromotion('create',{...b,reason:'different'},manager),(e:any)=>e.status===409);
 });
 await test('deferral, invalidation and correction preserve history and do not change campaign or customer quality',async()=>{
  const defer=await reviewPromotion('defer',body('defer'),manager);assert.equal(defer.status,'deferred');
  const invalid=await reviewPromotion('invalid',body('invalid'),manager);assert.equal(invalid.status,'invalid');
  const corrected=await reviewPromotion('invalid',body('link',{revision:1,linkId:entry.id}),manager);assert.equal(corrected.status,'linked');
  const rows=await listPromotionReviews(manager);assert.equal(rows.find((r:any)=>r.leadId==='invalid').history.length,2);assert.equal(rows.find((r:any)=>r.leadId==='defer').status,'deferred');
  for(const id of ['link','create','defer','invalid']){const p=(await pool.query('SELECT profile FROM portal_leads WHERE id=:p1',[id])).rows[0].profile;delete p.promotionReview;assert.deepEqual(p,originals.get(id));}
  assert.equal(Number((await pool.query("SELECT COUNT(*) AS n FROM campaign_source_reviews")).rows[0].n),0);
 });
 await test('a database failure rolls back entry creation, resolution and audit; the same request can be retried safely',async()=>{
  await seed('rollback');const before=(await pool.query("SELECT config FROM trial_campaigns WHERE id='A'")).rows[0].config;
  await nativePool.query("CREATE TRIGGER test_promotion_rollback BEFORE UPDATE ON portal_leads FOR EACH ROW BEGIN IF NEW.id='rollback' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST rollback'; END IF; END");
  const b=body('create',{entry:{name:'TEST rollback',source:'facebook',medium:'social',language:'en',experience:PROMOTION_EXPERIENCE}});
  try{await assert.rejects(reviewPromotion('rollback',b,manager));}finally{await nativePool.query('DROP TRIGGER test_promotion_rollback');}
  assert.deepEqual((await pool.query("SELECT config FROM trial_campaigns WHERE id='A'")).rows[0].config,before);assert.equal((await pool.query("SELECT profile FROM portal_leads WHERE id='rollback'")).rows[0].profile.promotionReview,undefined);
  await assert.rejects(promotionReviewResult('rollback',b.requestId,manager),(e:any)=>e.status===404);assert.equal((await reviewPromotion('rollback',b,manager)).createdLink,true);
 });
 await test('promotion attribution uses the same Manager-only gate, including old requests',async()=>{
  await seed('policy-controlled');const operator={...manager,roles:['sales']},b=body('invalid');
  await assert.rejects(reviewPromotion('policy-controlled',b,operator),(e:any)=>e.status===403);
  await pool.query("INSERT INTO portal_settings(id,value) VALUES('crm_policy',:p1) ON DUPLICATE KEY UPDATE value=:p1",[{sourceAttributionManagerOnly:false}]);
  assert.equal((await reviewPromotion('policy-controlled',b,operator)).status,'invalid');
  await pool.query("UPDATE portal_settings SET value=:p1 WHERE id='crm_policy'",[{sourceAttributionManagerOnly:true}]);
  await assert.rejects(reviewPromotion('policy-controlled',b,operator),(e:any)=>e.status===403);
 });
 await pool.end();
}else test('promotion review transactions require independent native MySQL fixture',{skip:true},()=>{});
