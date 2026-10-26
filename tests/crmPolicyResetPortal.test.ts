import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {restorePolicyDefaults} from '../src/utils/crmPolicyReset.ts';
import {DEFAULT_CRM_POLICY_CONFIG} from '../src/types/crmPolicyConfig.ts';
if(!process.env.MYSQL_NATIVE_TEST_ENV){test('policy restore requires isolated MySQL',{skip:'Set MYSQL_NATIVE_TEST_ENV'},()=>{});}else{
 const {setupNativeTest}=await import('./helpers/mysql.mjs');await setupNativeTest('reset678');process.env.PLATFORM_MODE='local';
 const {pool}=await import('../server/portal/store.ts');const {mountPortal}=await import('../server/portal/runtime.ts');const app=express();app.use(express.json());await mountPortal(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;
 const login=async(name:string)=>{const r=await fetch(base+'/api/crm/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({loginId:name,password:name})});assert.equal(r.status,200);return r.headers.get('set-cookie')!.split(';')[0];};
 const request=(cookie:string)=>(async(path:any,options:any={})=>fetch(base+path,{...options,headers:{...options.headers,Origin:base,Cookie:cookie}})) as typeof fetch;
 await test('#678 defaults persist through validated save, preserve tasks/notifications, reject Sales, reconcile lost receipt',async t=>{
  t.after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();});const manager=request(await login('Suki')),sales=request(await login('Fadhil'));
  await pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',['TEST678',{id:'TEST678',owner:'Fadhil',currentStage:'New'}]);
  await pool.query("INSERT INTO followup_tasks(id,lead_id,kind,status,due_at,original_due_at) VALUES('TEST678-task','TEST678','consultation','open','2027-12-01 03:00:00','2027-12-01 03:00:00')");
  const protectedState=async()=>JSON.stringify({tasks:(await pool.query('SELECT * FROM followup_tasks ORDER BY id')).rows,rules:(await pool.query('SELECT * FROM notification_rules ORDER BY id')).rows,channels:(await pool.query('SELECT * FROM notification_channels ORDER BY id')).rows,jobs:(await pool.query('SELECT * FROM notification_jobs ORDER BY id')).rows});
  const before=await protectedState();const changed=structuredClone(DEFAULT_CRM_POLICY_CONFIG);changed.firstResponseSla.hot.value=7;
  assert.equal((await manager('/api/crm/policy-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(changed)})).status,200);
  const saved=await restorePolicyDefaults(manager);assert.deepEqual(saved.firstResponseSla,DEFAULT_CRM_POLICY_CONFIG.firstResponseSla);
  assert.deepEqual((await(await manager('/api/crm/policy-config')).json()).businessHours,DEFAULT_CRM_POLICY_CONFIG.businessHours);
  await assert.rejects(restorePolicyDefaults(sales),(e:any)=>e.code==='policy_save_forbidden');
  let writes=0;const lost=(async(path:any,options:any={})=>{const r=await manager(path,options);if(options.method==='POST'){writes++;await r.json();throw Error('TEST lost receipt after server commit');}return r;}) as typeof fetch;
  await restorePolicyDefaults(lost);assert.equal(writes,1);assert.equal(await protectedState(),before);
  assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM portal_audit WHERE action='sla.save'")).rows[0].n),3);
 });
}
