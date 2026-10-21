import {setupNativeTest} from './helpers/mysql.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
if(process.env.MYSQL_NATIVE_TEST_ENV){
 const fixture=await setupNativeTest('policy611');
 process.env.PLATFORM_MODE='local';
 const {pool}=await import('../server/portal/store.ts');const {mountPortal}=await import('../server/portal/runtime.ts');
 const app=express();app.use(express.json());await mountPortal(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));
 const base='http://127.0.0.1:'+(server.address() as any).port;
 const request=async(path:string,cookie='',body?:any)=>{const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie,Origin:base,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]||''};};
 await test('policy611 isolated MySQL API: invalid patches atomic, valid partial merge, authorization, rollback and preservation',async t=>{
 t.after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();});
 const manager=await request('/api/crm/auth/login','',{loginId:'Robert',password:'Robert'});assert.equal(manager.status,200);
 const sales=await request('/api/crm/auth/login','',{loginId:'Fadhil',password:'Fadhil'});assert.equal(sales.status,200);
 const url='/api/crm/policy-config',cookie=manager.cookie;
 await pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',['test611',{id:'test611',fullName:'TEST policy611',owner:'Fadhil',tier:'Hot'}]);
 await pool.query("INSERT INTO followup_tasks(id,lead_id,kind,status,due_at) VALUES('task611','test611','consultation','open','2026-11-01 10:00:00')");
 const protectedState=async()=>JSON.stringify({tasks:(await pool.query('SELECT * FROM followup_tasks ORDER BY id')).rows,rules:(await pool.query('SELECT * FROM notification_rules ORDER BY id')).rows,channels:(await pool.query('SELECT * FROM notification_channels ORDER BY id')).rows,jobs:(await pool.query('SELECT * FROM notification_jobs ORDER BY id')).rows});
 const protectedBefore=await protectedState();
 const snapshot=async()=>JSON.stringify((await pool.query("SELECT * FROM portal_settings WHERE id IN ('sla','crm_policy') ORDER BY id")).rows);
 const before=await snapshot();
 const audits=async()=>Number((await pool.query("SELECT COUNT(*) AS n FROM portal_audit WHERE action='sla.save'")).rows[0].n);
 const auditBefore=await audits();
 for(const patch of [{milestones:{trialReminderBefore:{value:-4}}},{noResponseCadence:{maxRetriesBeforeNurture:-1}},{noResponseCadence:{maxRetriesBeforeNurture:1.5}},{reactivation:{reactivatedResponse:{value:0}}},{inactivityWatchdog:{hotInactivity:{unit:'weeks'}}},{businessHours:{workDays:[7]}},{businessHours:{timezone:'bad/zone'}},{businessHours:{nextDayGraceTime:''}},{businessHours:{startTime:'22:00',endTime:'20:00'}},{milestones:[]},{unknown:1}]){
 const r=await request(url,cookie,patch);assert.equal(r.status,400);assert.ok(Object.keys(r.data.fieldErrors).length);assert.equal(await snapshot(),before);assert.equal(await audits(),auditBefore);
 }
 assert.equal((await request(url,'',{})).status,401);assert.equal((await request(url,sales.cookie,{milestones:{trialReminderBefore:{value:5}}})).status,403);
 const initial=(await request(url,cookie)).data;
 assert.equal((await request(url,cookie,{milestones:{trialReminderBefore:{value:5}}})).status,200);
 let saved=(await request(url,cookie)).data;assert.equal(saved.milestones.trialReminderBefore.value,5);assert.deepEqual(saved.noResponseCadence,initial.noResponseCadence);assert.deepEqual(saved.milestones.trialFollowUpAfter,initial.milestones.trialFollowUpAfter);assert.deepEqual(saved.firstResponseSla,initial.firstResponseSla);
 // Simulate DB failure after both policy updates: the transaction must roll back all writes.
 const c=await fixture.connect();await c.query("CREATE TRIGGER reject_policy611 BEFORE INSERT ON portal_audit FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST policy611 rollback'");c.release();
 const prior=await snapshot();const priorAudit=await audits();
 assert.equal((await request(url,cookie,{firstResponseSla:{hot:{value:6}}})).status,503);assert.equal(await snapshot(),prior);assert.equal(await audits(),priorAudit);
 const d=await fixture.connect();await d.query('DROP TRIGGER reject_policy611');d.release();
 assert.equal((await request(url,cookie,{firstResponseSla:{hot:{value:6}}})).status,200);saved=(await request(url,cookie)).data;assert.equal(saved.firstResponseSla.hot.value,6);assert.deepEqual(saved.firstResponseSla.warm,initial.firstResponseSla.warm);
 const concurrent=await Promise.all([request(url,cookie,{milestones:{assessmentFollowUpAfter:{value:7}}}),request(url,cookie,{reactivation:{reactivatedResponse:{value:45}}})]);
 assert.ok(concurrent.every(r=>r.status===200));saved=(await request(url,cookie)).data;assert.equal(saved.milestones.assessmentFollowUpAfter.value,7);assert.equal(saved.reactivation.reactivatedResponse.value,45);
 assert.equal(await protectedState(),protectedBefore);
 });
}
