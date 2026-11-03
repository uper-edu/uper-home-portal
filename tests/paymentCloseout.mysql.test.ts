import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import sharp from 'sharp';
import {setupNativeTest} from './helpers/mysql.mjs';
import {disposeNativeTest} from './helpers/disposeNativeTest.mjs';
import {builtInRoles} from '../src/utils/accessControl';
if(!process.env.MYSQL_NATIVE_TEST_ENV)test('direct refunds require authorized isolated MySQL',{skip:true},()=>{});else{
 const fixture=await setupNativeTest('payment_closeout');
 const {pool,tx}=await import('../server/portal/store');
 const {savePayment,readPayments,paymentResult,readPaymentImage}=await import('../server/portal/payments');
 const {enrollCourse}=await import('../server/portal/courseCatalog');
 const previousFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('External calls blocked during isolated financial acceptance');};
 const at=new Date(Date.now()-120000).toISOString(),profile={owner:'sales',team:'sales',currentStage:'progress:enrolled',tier:'Warm'};
 const png=await sharp({create:{width:8,height:8,channels:3,background:'#fff'}}).png().toBuffer();
 const image={name:'SYNTHETIC-refund.png',type:'image/png',data:png.toString('base64')};
 const read=(lead:string)=>tx(c=>readPayments(c,lead,'finance'));
 const make=async(lead:string)=>{
  await pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',[lead,{...profile,id:lead,fullName:'Synthetic '+lead}]);
  const enrolled=await tx(c=>enrollCourse(c,lead,'sales',{courseId:'course',courseRevision:1,discountMode:'none',discountValue:'',confirmed:true},{reason:'Synthetic enrollment'},randomUUID()));
  const projectId=enrolled.projectId;
  await tx(c=>savePayment(c,lead,'finance',{action:'receive',requestId:randomUUID(),revision:1,projectId,method:'bank_transfer',provider:'BCA',account:'COMPANY-ACCOUNT',reference:'IN-'+lead,amount:1000000,receivedAt:at,evidence:''}));
  return projectId;
 };
 const refund=(projectId:string,reference:string,patch:any={})=>({action:'refund',requestId:randomUUID(),revision:2,projectId,method:'bank_transfer',provider:'BCA',account:'SYNTHETIC-REFUND-DESTINATION',reference,amount:200000,receivedAt:at,evidence:'Synthetic completed refund reason',...patch});
 const counts=async()=>Promise.all(['crm_payment_images','crm_payment_references','crm_operations','portal_audit'].map(async table=>Number((await pool.query('SELECT COUNT(*) n FROM '+table)).rows[0].n)));
 try{
  for(const role of ['finance','sales','crm_leader'])await pool.query('INSERT INTO access_roles(id,config) VALUES(:p1,:p2)',[role,builtInRoles[role]]);
  for(const [id,role]of [['finance','finance'],['finance2','finance'],['sales','sales'],['manager','crm_leader']])await pool.query("INSERT INTO crm_users(id,login_id,display_name,password_hash,roles,teams) VALUES(:p1,:p1,:p1,'synthetic',:p2,'[]')",[id,JSON.stringify([role])]);
  await pool.query('INSERT INTO crm_courses(id,revision,value) VALUES(:p1,1,:p2)',['course',{name:'Synthetic HSK',sessions:30,price:1000000,active:true,maxDiscountBps:0,maxDiscountAmount:null,history:[]}]);
  await test('finance independently records a completed refund, preserves due/profile/deadline and private evidence, and replay/query never repeats it',async()=>{
   const id='refund-happy',projectId=await make(id);await pool.query("INSERT INTO followup_tasks(id,lead_id,kind,due_at) VALUES('original',:p1,'consultation','2020-01-02')",[id]);
   const before=await read(id),beforeProfile=(await pool.query('SELECT profile FROM portal_leads WHERE id=:p1',[id])).rows[0].profile,body=refund(projectId,'OUT-HAPPY',{images:[image]});
   const result=await tx(c=>savePayment(c,id,'finance',body));assert.equal(result.action,'refund');
   const d=await read(id),e=d.ledger.entries.find(e=>e.id===result.targetId)!;
   assert.equal(e.kind,'refund');assert.equal(e.accountRole,'refund_destination');assert.equal(e.state,'verified');assert.equal(e.account,body.account);assert.equal(e.evidence,body.evidence);assert.equal(e.receivedAt,at);assert.equal(e.verifiedBy,'finance');
   assert.deepEqual(d.ledger.projects,before.ledger.projects);assert.equal(d.summary[0].refunded,200000);assert.equal(d.summary[0].net,800000);assert.equal(d.summary[0].remaining,200000);
   assert.equal(d.ledger.history.at(-1)?.actor,'finance');assert.equal(d.ledger.history.at(-1)?.reason,body.evidence);
   assert.deepEqual((await tx(c=>readPaymentImage(c,id,'finance',e.images![0].id))).content,await sharp(png).rotate().png().toBuffer());
   const after=await counts();assert.equal((await tx(c=>savePayment(c,id,'finance',body))).replayed,true);assert.equal((await tx(c=>paymentResult(c,id,'finance',body.requestId))).targetId,result.targetId);assert.deepEqual(await counts(),after);
   await assert.rejects(()=>tx(c=>paymentResult(c,id,'finance2',body.requestId)),/missing/);
   assert.deepEqual((await pool.query('SELECT profile FROM portal_leads WHERE id=:p1',[id])).rows[0].profile,beforeProfile);
   assert.equal((await pool.query("SELECT due_at FROM followup_tasks WHERE id='original'")).rows[0].due_at.toISOString(),'2020-01-02T00:00:00.000Z');
  });
  await test('refund permission, destination, actual time, reference, reason and available net funds are enforced without residue',async()=>{
   const id='refund-invalid',p=await make(id),body=refund(p,'OUT-INVALID'),before=await read(id),beforeCounts=await counts();
   for(const actor of ['sales','manager'])await assert.rejects(()=>tx(c=>savePayment(c,id,actor,body)),/forbidden/);
   for(const patch of [{accountRole:'company_receiving'},{account:''},{reference:''},{provider:''},{evidence:''},{method:'other',methodName:''},{amount:1000001},{amount:0},{receivedAt:'2026-11-01T10:00'},{receivedAt:new Date(Date.now()+3600000).toISOString()},{projectId:'foreign-project'}])await assert.rejects(()=>tx(c=>savePayment(c,id,'finance',{...body,...patch})));
   await pool.query("UPDATE crm_users SET roles='[]' WHERE id='finance2'");await assert.rejects(()=>tx(c=>savePayment(c,id,'finance2',body)),/forbidden/);await pool.query('UPDATE crm_users SET roles=:p1 WHERE id=\'finance2\'',[JSON.stringify(['finance'])]);
   assert.deepEqual((await read(id)).ledger,before.ledger);assert.deepEqual(await counts(),beforeCounts);
  });
  await test('pending sales refund must be reviewed before another direct refund can be recorded',async()=>{
   const id='refund-pending',p=await make(id),report=await tx(c=>savePayment(c,id,'sales',{...refund(p,'OUT-PENDING'),action:'submit',kind:'refund',reportedAt:at,receivedAt:undefined}));
   await assert.rejects(()=>tx(c=>savePayment(c,id,'finance',refund(p,'OUT-SECOND',{revision:report.revision}))),/pending_refund/);
   assert.equal((await read(id)).ledger.entries.length,2);
   await tx(c=>savePayment(c,id,'finance',{action:'verify',requestId:randomUUID(),revision:report.revision,entryId:report.targetId,method:'cash',account:'Synthetic refund recipient',provider:'',reference:'REFUND-RECEIPT',amount:200000,receivedAt:at,evidence:'Synthetic cash refund completed'}));assert.equal((await read(id)).summary[0].refunded,200000);
  });
  await test('refund references are unique across customers and same-version concurrent reviewers cannot refund twice',async()=>{
   const id='refund-race',p=await make(id),body=refund(p,'OUT-RACE',{amount:700000,images:[image]});
   const jobs=[body,{...body,requestId:randomUUID()}],actors=['finance','finance2'];const all=await Promise.allSettled(jobs.map((b,i)=>tx(c=>savePayment(c,id,actors[i],b))));assert.equal(all.filter(v=>v.status==='fulfilled').length,1);
   const d=await read(id);assert.equal(d.summary[0].refunded,700000);assert.equal(d.ledger.entries.filter(e=>e.kind==='refund').length,1);
   const win=all.findIndex(v=>v.status==='fulfilled');assert.equal((await tx(c=>savePayment(c,id,actors[win],jobs[win]))).replayed,true);
   const p2=await make('refund-cross');await assert.rejects(()=>tx(c=>savePayment(c,'refund-cross','finance',refund(p2,'out-race',{account:' synthetic-refund-destination '}))),/duplicate/);
   await assert.rejects(()=>tx(c=>savePayment(c,id,'finance',refund(p,'TOO-MUCH',{revision:d.revision,amount:400000}))),/exceeds/);
  });
  await test('rollback after refund writes removes image, reference, result and audit; void retains facts and restores exact net funds',async()=>{
   const id='refund-rollback',p=await make(id),body=refund(p,'OUT-ROLLBACK',{images:[image]}),before=await read(id),beforeCounts=await counts();
   await assert.rejects(()=>tx(async c=>{await savePayment(c,id,'finance',body);throw Error('Synthetic post-write failure');}));assert.deepEqual((await read(id)).ledger,before.ledger);assert.deepEqual(await counts(),beforeCounts);await assert.rejects(()=>tx(c=>paymentResult(c,id,'finance',body.requestId)),/missing/);
   const result=await tx(c=>savePayment(c,id,'finance',body)),d=await read(id),e=d.ledger.entries.find(e=>e.id===result.targetId)!;
   await assert.rejects(()=>tx(c=>savePayment(c,id,'finance',{action:'void',requestId:randomUUID(),revision:result.revision,entryId:d.ledger.entries[0].id,reason:'Synthetic bad removal'})),/exceeds/);
   await tx(c=>savePayment(c,id,'finance2',{action:'void',requestId:randomUUID(),revision:result.revision,entryId:e.id,reason:'Synthetic mistaken refund record'}));
   const after=await read(id),voided=after.ledger.entries.find(v=>v.id===e.id)!;assert.equal(voided.verifiedAmount,200000);assert.equal(voided.receivedAt,at);assert.equal(voided.state,'void');assert.equal(after.summary[0].refunded,0);assert.equal(after.summary[0].remaining,0);assert.equal(after.ledger.history.at(-1)?.actor,'finance2');
   assert.equal(createHash('sha256').update((await tx(c=>readPaymentImage(c,id,'finance',e.images![0].id))).content).digest('hex'),e.images![0].sha256);
  });
  await test('actual HTTP refund endpoint enforces staff/origin and returns an isolated queryable idempotent result',async()=>{
   const lead='refund-http',p=await make(lead),body=refund(p,'OUT-HTTP');
   process.env.PLATFORM_MODE='local';const {platform}=await import('../server/portal/identity');const {assignmentDirectory}=await import('../server/portal/autoAssignment');const oldAuth=platform.authenticate;
   platform.authenticate=async(req:any)=>(await assignmentDirectory(pool)).find((e:any)=>e.id===req.headers['x-refund-user'])||null;
   const express=(await import('express')).default,{mountPortal}=await import('../server/portal/runtime');const app=express();app.use(express.json());await mountPortal(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;
   globalThis.fetch=async(url,options)=>{if(!String(url).startsWith(base+'/'))throw Error('External calls blocked');return previousFetch(url,options);};
   const endpoint=base+'/api/crm/leads/'+lead+'/payments';const send=(actor:string,origin=base)=>fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-refund-user':actor,Origin:origin},body:JSON.stringify(body)});
   try{
    assert.equal((await send('')).status,401);assert.equal((await send('sales')).status,403);assert.equal((await send('finance','http://untrusted.invalid')).status,403);
    const r=await send('finance');assert.equal(r.status,200);const result=await r.json();assert.equal(result.action,'refund');assert.equal(result.projectId,p);assert.equal((await (await send('finance')).json()).replayed,true);
    const query=await fetch(endpoint+'/results/'+body.requestId,{headers:{'x-refund-user':'finance'}});assert.equal(query.status,200);assert.equal((await query.json()).targetId,result.targetId);
    assert.equal((await fetch(base+'/api/crm/leads/refund-happy/payments/results/'+body.requestId,{headers:{'x-refund-user':'finance'}})).status,404);
   }finally{globalThis.fetch=async()=>{throw Error('External calls blocked');};platform.authenticate=oldAuth;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
  });
  await test('financial facts never enqueue notifications or automatic tasks',async()=>{
   for(const table of ['outbox','notification_jobs'])assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM '+table)).rows[0].n),0);
   assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM followup_tasks')).rows[0].n),1);
  });
 }finally{globalThis.fetch=previousFetch;await pool.end();await disposeNativeTest(fixture);}
}
