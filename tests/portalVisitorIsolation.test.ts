import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {randomUUID} from 'node:crypto';
import {setupNativeTest} from './helpers/mysql.mjs';
import {newHskAttempt} from '../src/data/hskAssessment';
if (process.env.MYSQL_NATIVE_TEST_ENV) {
 await setupNativeTest('visitor_isolation');
 const {mountPortal}=await import('../server/portal/runtime');
 const {pool}=await import('../server/portal/store');
 const app=express();app.use(express.json());await mountPortal(app);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));
 const base=`http://127.0.0.1:${(server.address() as any).port}`;
 await test('657: live MySQL assessment isolation, stale-scope rejection and safe session profile',async t=>{
  t.after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();});
  async function request(path:string,cookie='',body?:any,scope?:string) { const r=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,'Content-Type':'application/json',...(scope?{'X-Visitor-Scope':scope}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]||cookie}; }
  const A=await request('/api/portal/session'), B=await request('/api/portal/session');assert.notEqual(A.data.cacheScope,B.data.cacheScope);
  const attempt=newHskAttempt('express',randomUUID());attempt.completedAt=new Date().toISOString();
  const saved=await request('/api/portal/assessments',A.cookie,{attempt,lang:'en'},A.data.cacheScope);assert.equal(saved.status,200);
  assert.equal((await request('/api/portal/assessments',B.cookie,undefined,B.data.cacheScope)).data.results.length,0);
  assert.equal((await request('/api/portal/assessments',B.cookie,{attempt,lang:'en'},B.data.cacheScope)).status,404);
  const fresh=newHskAttempt('full',randomUUID());fresh.completedAt=new Date().toISOString();
  assert.equal((await request('/api/portal/assessments',B.cookie,{attempt:fresh,lang:'en'},A.data.cacheScope)).status,409);
  assert.equal((await request('/api/portal/assessments',B.cookie,undefined,A.data.cacheScope)).status,409);
  assert.equal((await request('/api/portal/assessments',B.cookie)).data.results.length,0);
  assert.equal((await request('/api/portal/assessments',A.cookie)).data.results[0].attempt.attemptId,attempt.attemptId);
  const reg=await request('/api/portal/register',B.cookie,{fullName:'TEST 657 B',whatsapp:'+6281198760657',email:'657@example.invalid',levelState:'KNOWN',reportedLevel:'HSK 4+',internalNote:'do not expose'},B.data.cacheScope);assert.equal(reg.status,200);
  await pool.query("UPDATE portal_leads SET profile=JSON_SET(profile,'$.internalNote','private','$.owner','staff-secret') WHERE id=:p1",[reg.data.lead.id]);
  const session=(await request('/api/portal/session',B.cookie)).data;assert.equal(session.profile.fullName,'TEST 657 B');assert.equal(session.profile.internalNote,undefined);assert.equal(session.profile.owner,undefined);
  const after=(await request('/api/portal/assessments',B.cookie)).data;assert.deepEqual(after.results,[]);
  assert.equal((await request('/api/portal/assessments',B.cookie,{attempt:fresh,lang:'id'},B.data.cacheScope)).status,200);
  const ownB=(await request('/api/portal/assessments',B.cookie)).data.results;
  assert.equal(ownB.length,1);assert.equal(ownB[0].attempt.attemptId,fresh.attemptId);
  const ownA=(await request('/api/portal/assessments',A.cookie)).data.results;
  assert.equal(ownA.length,1);assert.equal(ownA[0].attempt.attemptId,attempt.attemptId);
 });
} else test('657 live MySQL isolation requires independent native test database',{skip:true},()=>{});
