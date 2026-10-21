import {setupNativeTest} from './helpers/mysql.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';
if(process.env.MYSQL_NATIVE_TEST_ENV){
 const fixture=await setupNativeTest('noresponse638');process.env.PLATFORM_MODE='local';
 const {pool,tx}=await import('../server/portal/store');const {mountPortal}=await import('../server/portal/runtime');
 const express=(await import('express')).default;const app=express();app.use(express.json());await mountPortal(app);
 const {saveSalesWorkflow}=await import('../server/portal/salesWorkflow');const {settleNoResponse,customerReplied}=await import('../server/portal/noResponse');const {engagement}=await import('../server/portal/trustWorkflow');const {tick}=await import('../server/portal/worker');
 await test('638 independent MySQL sequences, final-window races, reset, protection and task/notification preservation',async t=>{
 t.after(async()=>pool.end());
 await pool.query('UPDATE notification_rules SET enabled=false');
 const sla=(await pool.query("SELECT value FROM portal_settings WHERE id='sla'")).rows[0].value;
 await pool.query("UPDATE portal_settings SET value=:p1 WHERE id='sla'",[{...sla,timezone:'UTC',days:[0,1,2,3,4,5,6],start:'00:00',end:'23:59'}]);
 const get=async(id:string)=>(await pool.query('SELECT profile FROM portal_leads WHERE id=:p1',[id])).rows[0].profile;
 const seed=async(id:string,extra:any={})=>{await pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',[id,{id,fullName:'TEST '+id,owner:'Fadhil',tier:'Unqualified',touchCount:50,currentStage:'New',...extra}]);await pool.query("INSERT INTO followup_tasks(id,lead_id,kind,status,due_at,original_due_at) VALUES(:p1,:p2,'follow_up','open','2027-12-01 10:00:00','2027-12-01 10:00:00')",[id+'-task',id]);};
 const body=(requestId:string,connectStatus='No Response',extra:any={})=>({requestId,summary:'TEST actual contact evidence',channel:'WhatsApp',connectStatus,recordKind:'contact',disposition:'record_only',completeTaskIds:[],...extra});
 const save=async(id:string,time:string,b:any)=>tx((c:any)=>saveSalesWorkflow(c,id,'Fadhil',b,()=>true,new Date(time)));
 const due=(time:string)=>tx((c:any)=>settleNoResponse(c,new Date(time)));
 const snapshot=async()=>JSON.stringify({tasks:(await pool.query('SELECT * FROM followup_tasks ORDER BY id')).rows,rules:(await pool.query('SELECT * FROM notification_rules ORDER BY id')).rows,channels:(await pool.query('SELECT * FROM notification_channels ORDER BY id')).rows});
 await seed('missing');await seed('protected',{tier:'Hot',tierConfirmed:true,tierSource:'sales_confirmed'});await seed('inbound');await seed('stopped',{contactArrangement:{state:'stopped',reason:'TEST customer choice'}});
 const before=await snapshot();
 for(const id of ['missing','protected','inbound','stopped'])for(const [n,h] of [[1,'09'],[2,'13'],[3,'17']]){await save(id,`2026-10-19T${h}:00:00Z`,body(`${id}-${n}`));const p=await get(id);assert.equal(p.noResponseSequence.count,n);assert.equal(p.tier,id==='protected'?'Hot':'Unqualified');}
 const prior=await get('missing');await save('missing','2026-10-19T17:00:00Z',body('missing-3'));assert.deepEqual(await get('missing'),prior,'same request is idempotent');
 await due('2026-10-19T20:59:59Z');assert.equal((await get('missing')).tier,'Unqualified');
 await tx((c:any)=>customerReplied(c,'inbound','new customer inquiry',undefined,new Date('2026-10-19T18:00:00Z')));
 assert.equal((await get('inbound')).noResponseSequence.count,0);
 await due('2026-10-19T21:00:00Z');assert.equal((await get('missing')).tier,'Cold-Nurture');assert.equal((await get('protected')).tier,'Hot');assert.equal((await get('protected')).noResponseSequence.status,'protected');assert.equal((await get('inbound')).tier,'Unqualified');
 await tx((c:any)=>customerReplied(c,'stopped','new inquiry',undefined,new Date('2026-10-19T22:00Z')));assert.equal((await get('stopped')).contactArrangement.state,'stopped');
 await tx((c:any)=>customerReplied(c,'missing','new inquiry',undefined,new Date('2026-10-19T22:00Z')));assert.equal((await get('missing')).tier,'Unqualified');assert.equal((await get('missing')).noResponseSequence.count,0);
 // New sequence takes new config; active sequence retains its earlier 3/4h policy.
 await pool.query("INSERT INTO portal_settings(id,value) VALUES('crm_policy',:p1) ON DUPLICATE KEY UPDATE value=:p1",[{noResponseCadence:{retryInterval:{value:1,unit:'hours'},maxRetriesBeforeNurture:1}}]);
 await save('inbound','2026-10-20T09:00Z',body('new-policy'));assert.equal((await get('inbound')).noResponseSequence.policy.threshold,1);assert.equal((await get('protected')).noResponseSequence.policy.threshold,3);
 await save('inbound','2026-10-20T09:10Z',body('too-soon'));assert.equal((await get('inbound')).noResponseSequence.count,1);assert.equal((await get('inbound')).noResponseSequence.waitUntil,'2026-10-20T10:10:00.000Z');
 await save('inbound','2026-10-20T09:20Z',body('wrong','Wrong Number'));assert.equal((await get('inbound')).noResponseSequence.count,1);
 const attemptsBeforeConfirmation=(await get('inbound')).touchCount;await save('inbound','2026-10-20T09:30Z',body('manual-confirm',undefined as any,{recordKind:'closure',connectStatus:undefined,customerReplied:true,customerReplySequenceRevision:(await get('inbound')).noResponseSequence.revision}));assert.equal((await get('inbound')).noResponseSequence.count,0);assert.equal((await get('inbound')).touchCount,attemptsBeforeConfirmation);
 await save('missing','2026-10-20T09:00Z',body('fresh'));await tx((c:any)=>engagement(c,'missing','assessment','assessment-not-reply',{score:10}));assert.equal((await get('missing')).noResponseSequence.count,1);
 await tx((c:any)=>engagement(c,'missing','message','historical',{text:'old message',messageRecordedAt:'2025-01-01T00:00:00Z'}));assert.equal((await get('missing')).noResponseSequence.count,1);
 await tx((c:any)=>engagement(c,'missing','message','new-message',{text:'TEST real new inquiry'}));assert.equal((await get('missing')).noResponseSequence.count,0);
 await save('missing',new Date(Date.now()+1000).toISOString(),body('after-message'));
 await tx((c:any)=>engagement(c,'missing','message','new-message',{text:'TEST real new inquiry'}));assert.equal((await get('missing')).noResponseSequence.count,1,'duplicate message cannot clear later sequence');
 assert.equal(await snapshot(),before);
 // Internal records do not count, Connected clears, and no task is implicitly completed.
 await save('missing',new Date(Date.now()+2000).toISOString(),body('internal',undefined as any,{recordKind:'closure',connectStatus:undefined}));assert.equal((await get('missing')).noResponseSequence.count,1);
 await save('missing',new Date(Date.now()+3000).toISOString(),body('connected','Connected'));assert.equal((await get('missing')).noResponseSequence.count,0);
 // Concurrent writes serialize; a stale manual-reply draft cannot clear newer attempts.
 await seed('race');const raceBefore=await get('race');
 await Promise.all([save('race','2026-10-19T09:00Z',body('race-a')),save('race','2026-10-19T09:00Z',body('race-b'))]);assert.equal((await get('race')).noResponseSequence.count,1);
 const raceSnapshot=JSON.stringify(await get('race'));
 await assert.rejects(save('race','2026-10-19T09:10Z',body('stale-reply',undefined as any,{recordKind:'closure',connectStatus:undefined,customerReplied:true,customerReplySequenceRevision:0})),/sequence changed/);assert.equal(JSON.stringify(await get('race')),raceSnapshot);
 await assert.rejects(tx((c:any)=>saveSalesWorkflow(c,'race','Wigar',body('forged'),()=>false,new Date('2026-10-19T10:00Z'))),/Lead not found/);assert.equal(JSON.stringify(await get('race')),raceSnapshot);
 // A sequence fact failure rolls back the log, profile and counter together.
 const lease=await fixture.connect();await lease.query("CREATE TRIGGER reject_sequence638 BEFORE INSERT ON crm_facts FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST rollback638'");lease.release();
 await assert.rejects(save('race','2026-10-19T13:00Z',body('failed-save')),/rollback638/);assert.equal(JSON.stringify(await get('race')),raceSnapshot);
 const cleanup=await fixture.connect();await cleanup.query('DROP TRIGGER reject_sequence638');cleanup.release();
 // Worker integration, with no due business tasks or live channels.
 await seed('worker');await save('worker','2026-10-19T09:00Z',body('worker-1'));await tick(new Date('2026-10-19T10:00Z'));assert.equal((await get('worker')).tier,'Cold-Nurture');
 assert.equal(Number((await pool.query("SELECT COUNT(*) AS n FROM followup_tasks WHERE status<>'open'")).rows[0].n),0);
 });
}
