import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {contactRestriction,contactPaused} from '../src/utils/crmContact.ts';
import {outreachPolicy,outreachText} from '../src/utils/crmOutreach.ts';
import {validateContactPlan} from '../server/portal/contactPlans.ts';
const now=Date.parse('2026-10-22T12:00:00Z');
test('a future task is not a contact restriction; only explicit agreements expire by clock',()=>{
 assert.equal(contactRestriction({attention:{tasks:[{dueAt:'2099-01-01'}]}},now),null);
 const lead={contactReview:{blockBefore:true,reviewAt:'2026-10-22T13:00:00Z'}};
 assert.equal(contactRestriction(lead,now),'until');
 assert.equal(contactRestriction(lead,now+3600000),null);
 assert.equal(contactPaused({...lead,contactArrangement:{state:'stopped'}},now+3600000),true);
 for(const state of ['waiting','nurture','invalid'])assert.equal(contactRestriction({contactArrangement:{state,reviewAt:'2000-01-01'}},now),'legacy');
 for(const code of ['CONTACT_NOT_BEFORE','CONTACT_REVIEW_REQUIRED','CONTACT_EVIDENCE_REQUIRED','CONTACT_CONTEXT_CHANGED'])for(const lang of ['en','id','zh'])assert.notEqual(outreachText(code,lang),code);
});
test('restore/cancel requires a reason, fresh version and an independent next arrangement',()=>{
 const lead={contactArrangement:{state:'waiting',version:2}};
 const body={completeTaskIds:[],disposition:'keep',contactArrangement:{state:'active',reason:'TEST',version:2}};
 assert.throws(()=>validateContactPlan(lead,body,[],new Date(now)),/valid task/);
 assert.throws(()=>validateContactPlan(lead,{...body,expectedArrangementVersion:1},[],new Date(now)),/changed/);
 assert.throws(()=>validateContactPlan(lead,{...body,contactArrangement:{state:'waiting',reason:'TEST',version:2}},[],new Date(now)),/reason/);
 assert.throws(()=>validateContactPlan({contactArrangement:{state:'active',version:2},contactReview:{taskId:'only-review'}},{completeTaskIds:[],disposition:'keep',expectedArrangementVersion:2,reviewPlan:{cancel:true,reason:'TEST'}},[{id:'only-review',status:'open',kind:'contact_review',due_at:'2099-01-01'}],new Date(now)),/valid task/);
});
if(process.env.MYSQL_NATIVE_TEST_ENV){
 const {setupNativeTest}=await import('./helpers/mysql.mjs');await setupNativeTest('crm_action_gates');process.env.PLATFORM_MODE='local';
 const {pool}=await import('../server/portal/store.ts');const {mountPortal}=await import('../server/portal/runtime.ts');const {default:express}=await import('express');
 test('independent MySQL: purpose, assignment, review tasks, retries, concurrency and preservation',async t=>{
  const app=express();app.use(express.json());await mountPortal(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;
  t.after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();});
  const session=()=>{let cookie='';return async(path:string,body?:any,method?:string)=>{const r=await fetch(base+path,{method:method||(body===undefined?'GET':'POST'),headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});for(const h of r.headers.getSetCookie())cookie=h.split(';')[0];return {status:r.status,data:await r.json()};};};
  const manager=session(),sales=session(),other=session();for(const [s,n]of [[manager,'Suki'],[sales,'Fadhil'],[other,'Wigar']]as const)assert.equal((await s('/api/crm/auth/login',{loginId:n,password:n})).status,200);
  const id='TEST-GATES-'+randomUUID(),peer=id+'-peer',visitor=randomUUID();
  for(const v of [id,peer])await pool.query('INSERT INTO portal_leads(id,business_number,profile) VALUES(:p1,:p2,:p3)',[v,v,{id:v,fullName:v,email:'gates@example.invalid',owner:'Fadhil',currentStage:'Contacted',tier:'Hot',tierConfirmed:true,quizScore:81,followUpLogs:[]}]);
  for(const kind of ['handoff','booking','enrollment'])await pool.query('INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at) VALUES(:p1,:p2,:p3,:p4,:p5)',[kind,id,kind,'Fadhil','2099-01-01T09:00:00Z']);
  const original=(await pool.query('SELECT * FROM followup_tasks WHERE lead_id=:p1 ORDER BY id',[id])).rows;
  const path=(suffix:string)=>'/api/crm/leads/'+id+'/'+suffix;
  const intent=(extra:any={})=>({requestId:randomUUID(),action:'copy',purpose:'sales_followup',expectedOwner:'Fadhil',expectedArrangementVersion:0,...extra});
  assert.equal((await manager(path('contact-authorization'),intent())).status,200,'ordinary assistance needs no reason');
  await pool.query("INSERT INTO visitor_sessions(id,expires_at) VALUES(:p1,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY))",[visitor]);
  await pool.query('INSERT INTO identity_candidates(visitor_id,lead_id,candidate_id) VALUES(:p1,:p2,:p3)',[visitor,id,peer]);
  for(const s of [manager,sales])assert.equal((await s(path('contact-authorization'),intent())).data.error,'IDENTITY_REVIEW_REQUIRED');
  assert.equal((await manager('/api/crm/leads/'+id,{owner:'Wigar'},'PATCH')).data.error,'IDENTITY_REVIEW_REQUIRED');
  assert.equal((await manager('/api/crm/leads/'+id,{owner:null},'PATCH')).data.error,'IDENTITY_REVIEW_REQUIRED');
  assert.equal((await manager(path('contact-authorization'),intent({purpose:'identity_verification',candidateId:peer,reason:'TEST verify mailbox ownership'}))).status,200);
  assert.equal((await sales(path('contact-authorization'),intent({purpose:'identity_verification',candidateId:peer,reason:'TEST'}))).data.error,'IDENTITY_REVIEW_REQUIRED');
  assert.equal((await manager(path('contact-authorization'),intent({purpose:'identity_verification',candidateId:'not-readable',reason:'TEST'}))).status,403);
  const trust=await manager(path('identity-comparison')+'?candidateId='+peer);
  assert.equal((await manager(path('identity-actions'),{requestId:randomUUID(),candidateId:peer,decision:'shared',reason:'TEST distinct people',expectedComparisonRevision:trust.data.revision})).status,200);
  const save=(extra:any={})=>({requestId:randomUUID(),recordKind:'closure',summary:'TEST internal review arrangement',completeTaskIds:[],disposition:'schedule',nextAction:'Review request',nextPurpose:'Customer asked for later contact',nextFollowUpAt:'2099-02-01T09:00:00+07:00',expectedArrangementVersion:0,reviewPlan:{reason:'TEST agreed no contact before review',blockBefore:true},...extra});
  const reviewBody=save(),created=await sales(path('logs'),reviewBody);assert.equal(created.status,200,JSON.stringify(created.data));const taskId=created.data.createdTaskId;
  assert.equal(created.data.lead.contactReview.taskId,taskId);assert.equal(created.data.lead.contactArrangement.state,'active');
  for(let i=0;i<10;i++)assert.equal((await sales(path('logs'),reviewBody)).data.replayed,true);
  assert.equal((await sales(path('contact-authorization'),intent({expectedArrangementVersion:1}))).data.error,'CONTACT_NOT_BEFORE');
  assert.equal((await pool.query('SELECT profile FROM portal_leads WHERE id=:p1',[id])).rows[0].profile.followUpLogs.length,1);
  // Non-contact facts do not invent attempts or regrade an assessment.
  const profile=created.data.lead;assert.equal(profile.touchCount,0);assert.equal(profile.quizScore,81);assert.equal(profile.tier,'Hot');
  assert.deepEqual((await pool.query('SELECT * FROM followup_tasks WHERE lead_id=:p1 ORDER BY id',[id])).rows.filter((r:any)=>r.id!==taskId),original);
  // A reply exception needs a real new customer message plus human confirmation; tool opens never mark it answered.
  await pool.query("INSERT INTO conversations(id,visitor_id,lead_id,source) VALUES('gates-conversation',:p1,:p2,'TEST')",[visitor,id]);
  await pool.query("INSERT INTO messages(id,conversation_id,request_id,role,content,status,created_at) VALUES('gates-question','gates-conversation','q','user','TEST new customer question','saved',DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 SECOND))");
  await pool.query("INSERT INTO messages(id,conversation_id,request_id,role,content,status) VALUES('gates-ai','gates-conversation','q','assistant','TEST AI text','saved')");
  const reply=intent({purpose:'customer_reply',expectedArrangementVersion:1,sourceMessageId:'gates-question',replyConfirmedUnanswered:true,reason:'TEST answer only this question'});
  assert.equal((await sales(path('contact-authorization'),{...reply,replyConfirmedUnanswered:false})).data.error,'CONTACT_EVIDENCE_REQUIRED');
  assert.equal((await sales(path('contact-authorization'),{...reply,sourceMessageId:'gates-ai'})).data.error,'CONTACT_EVIDENCE_REQUIRED');
  assert.equal((await sales(path('contact-authorization'),reply)).status,200);
  assert.equal((await manager(path('contact-evidence'))).data.messages.some((m:any)=>m.id==='gates-question'),true);
  assert.equal((await sales(path('logs'),{requestId:randomUUID(),summary:'TEST actually answered linked question',recordKind:'contact',channel:'Other',connectStatus:'Connected',completeTaskIds:[],disposition:'record_only',sourceMessageAnswered:true,sourceMessageId:'gates-question',sourceConversationId:'gates-conversation'})).status,200);
  assert.equal((await sales(path('contact-authorization'),{...reply,requestId:randomUUID()})).data.error,'CONTACT_EVIDENCE_REQUIRED');
  assert.equal((await manager(path('contact-evidence'))).data.messages.some((m:any)=>m.id==='gates-question'),false);
  // Two explicit revisions compete: only one can replace the review agreement.
  const contenders=await Promise.all([sales(path('logs'),save({expectedArrangementVersion:1})),sales(path('logs'),save({expectedArrangementVersion:1}))]);assert.deepEqual(contenders.map(r=>r.status).sort(),[200,409]);
  const replacement=contenders.find(r=>r.status===200)!.data.createdTaskId;
  assert.equal((await pool.query('SELECT status FROM followup_tasks WHERE id=:p1',[taskId])).rows[0].status,'cancelled');
  // Time passes only in this independent fixture. Expiry does not complete the task.
  await pool.query("UPDATE portal_leads SET profile=JSON_SET(profile,'$.contactReview.reviewAt',:p2) WHERE id=:p1",[id,'2000-01-01T00:00:00Z']);
  assert.equal((await sales(path('contact-authorization'),intent({expectedArrangementVersion:2}))).status,200);
  assert.equal((await pool.query('SELECT status FROM followup_tasks WHERE id=:p1',[replacement])).rows[0].status,'open');
  const stopped=await sales(path('logs'),{requestId:randomUUID(),recordKind:'closure',summary:'TEST stop',completeTaskIds:[],disposition:'none',contactArrangement:{state:'stopped',reason:'TEST customer requested stop',version:2}});assert.equal(stopped.status,200,JSON.stringify(stopped.data));
  assert.equal((await manager(path('contact-authorization'),intent({purpose:'customer_reply',expectedArrangementVersion:3}))).data.error,'CONTACT_STOPPED');
  assert.equal((await other(path('logs'),save())).status,404);
  const due=(await pool.query('SELECT * FROM followup_tasks WHERE lead_id=:p1 ORDER BY id',[id])).rows.filter((r:any)=>original.some((v:any)=>v.id===r.id));assert.deepEqual(due,original);
  // Failure after writes must roll back both task and audit changes, not only the customer profile.
  const {tx}=await import('../server/portal/store.ts');const {saveSalesWorkflow}=await import('../server/portal/salesWorkflow.ts');
  const beforeFailure=(await pool.query('SELECT profile FROM portal_leads WHERE id=:p1',[id])).rows[0].profile;
  const countBefore=(await pool.query('SELECT COUNT(*) n FROM followup_tasks WHERE lead_id=:p1',[id])).rows[0].n;
  await assert.rejects(tx(async(c:any)=>{
    const proxy={query:async(sql:string,args:any[])=>{if(sql.startsWith('UPDATE portal_leads SET profile='))throw Error('TEST injected persistence failure');return c.query(sql,args);}};
    await saveSalesWorkflow(proxy,id,'Fadhil',save({expectedArrangementVersion:3}),()=>true);
  }),/injected persistence/);
  assert.deepEqual((await pool.query('SELECT profile FROM portal_leads WHERE id=:p1',[id])).rows[0].profile,beforeFailure);
  assert.equal((await pool.query('SELECT COUNT(*) n FROM followup_tasks WHERE lead_id=:p1',[id])).rows[0].n,countBefore);
  // Deactivation handover may return an identity-pending customer to the pool, never to a new owner.
  await pool.query("UPDATE identity_candidates SET decision='pending' WHERE lead_id=:p1",[id]);
  await pool.query("UPDATE crm_users SET active=false WHERE id='Fadhil'");
  const handoverId=randomUUID();await pool.query('INSERT INTO access_handovers(id,user_id,causes) VALUES(:p1,:p2,:p3)',[handoverId,'Fadhil','[]']);
  const cases=await manager('/api/crm/access-handovers');assert.equal(cases.status,200);
  const h=cases.data.find((v:any)=>v.id===handoverId),selected=h.leads.find((v:any)=>v.id===id);
  const handover={operationId:randomUUID(),revision:h.revision,reason:'TEST deactivation transfer',leads:[selected],taskIds:[],targetId:'Wigar'};
  assert.equal((await manager('/api/crm/access-handovers/'+handoverId,handover)).data.error,'IDENTITY_REVIEW_REQUIRED');
  assert.equal((await manager('/api/crm/access-handovers/'+handoverId,{...handover,operationId:randomUUID(),targetId:'__shared_pool'})).status,200);
  const released=(await pool.query('SELECT profile FROM portal_leads WHERE id=:p1',[id])).rows[0].profile;
  assert.equal(released.owner,null);assert.equal(released.quizScore,81);
  for(const old of original){const task=(await pool.query('SELECT * FROM followup_tasks WHERE id=:p1',[old.id])).rows[0];assert.deepEqual(task.due_at,old.due_at);assert.equal(task.status,old.status);}

 });
}

test("follow-up contact form keeps optional agreements without task planning",async()=>{const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {CrmWorkflowForm}=await import('../src/components/crm/CrmWorkflowForm.tsx');const render=(lang,extra={})=>renderToStaticMarkup(React.createElement(CrmWorkflowForm,{lead:{id:'TEST',fullName:'Original customer',currentStage:'Contacted'},employee:{id:'Fadhil'},lang,isLight:true,timezone:'Asia/Jakarta',...extra}));for(const lang of ['en','id','zh']){const h=render(lang,{administrative:true});assert.doesNotMatch(h,/Contacted the customer this time|Menghubungi pelanggan kali ini|本次有联系客户/);assert.match(h,/Select the actual result|Pilih hasil nyata|选择实际结果/);assert.doesNotMatch(h,/name="nextTask"|name="taskOutcome"/);assert.doesNotMatch(h,/（选填）|\(optional\)|\(opsional\)/);assert.match(h,/admin-required-star/);}});
