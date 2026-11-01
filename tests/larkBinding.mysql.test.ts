import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setupNativeTest} from './helpers/mysql.mjs';
import {disposeNativeTest} from './helpers/disposeNativeTest.mjs';
import {builtInRoles} from '../src/utils/accessControl.ts';
if(!process.env.MYSQL_NATIVE_TEST_ENV){test('Lark binding requires approved isolation',{skip:true},()=>{});}else{
 const fixture=await setupNativeTest('lark_binding');
 const {pool}=await import('../server/portal/store.ts');
 const {platform}=await import('../server/portal/identity.ts');
 const original=platform.authenticate,native=globalThis.fetch;
 platform.authenticate=async(req:any)=>req.headers['x-test-role']==='admin'?{id:'admin',teams:[],permissions:['access.read','access.users','access.roles','access.sessions','access.audit'],scope:'all',active:true}:req.headers['x-test-role']==='sales'?{id:'sales',teams:[],permissions:['crm.read'],scope:'own',active:true}:null;
 Object.assign(process.env,{LARK_APP_ID:'cli_synthetic',LARK_APP_SECRET:'synthetic-only'});
 let lookups=0;
 globalThis.fetch=async(url,options)=>{
  if(String(url).startsWith('http://127.0.0.1:'))return native(url,options);
  if(String(url).includes('/auth/'))return Response.json({code:0,tenant_access_token:'synthetic-token',expire:7200});
  if(String(url).includes('batch_get_id')){lookups++;return Response.json({code:0,data:{user_list:[{user_id:'ou_maya'}]}});}
  throw Error('External network forbidden');
 };
 const express=(await import('express')).default,app=express();app.use(express.json());
 const {mountAccessOperations}=await import('../server/portal/accessOperations.ts');mountAccessOperations(app);
 const {mountAccessManagement}=await import('../server/portal/accessManagement.ts');mountAccessManagement(app);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));
 const base='http://127.0.0.1:'+(server.address() as any).port;
 const req=(path:string,body?:any,role='admin',origin=base)=>globalThis.fetch(base+'/api/admin/access/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-test-role':role,Origin:origin},body:body?JSON.stringify(body):undefined});
 const candidate={method:'mobile',mobile:'+6281234567890',openId:'ou_maya',revision:0};
 const body=async(id:string,larkBinding:any,patch:any={})=>{const u=(await pool.query('SELECT * FROM crm_users WHERE id=:p1',[id])).rows[0];return {operationId:randomUUID(),displayName:u.display_name,roles:u.roles,active:!!u.active,email:u.email,revision:Number(u.access_revision),reason:'Synthetic verification',larkBinding,...patch};};
 try{
 await pool.query("INSERT INTO access_state(id,value) VALUES('policy',:p1)",[{initialized:true}]);
 await pool.query("INSERT INTO access_roles(id,config) VALUES('access_admin',:p1)",[JSON.stringify(builtInRoles.access_admin)]);
 for(const id of ['admin','maya','arif'])await pool.query('INSERT INTO crm_users(id,login_id,display_name,password_hash,roles,teams) VALUES(:p1,:p1,:p1,\'synthetic\',:p2,:p3)',[id,JSON.stringify(id==='admin'?['access_admin']:[]),'[]']);
 await test('lookup is read-only and unauthorized or foreign-origin requests are rejected',async()=>{
 assert.equal((await req('lark-bindings',undefined,'')).status,401);assert.equal((await req('lark-bindings',undefined,'sales')).status,403);
 assert.equal((await req('lark-lookup',{method:'mobile',mobile:'+6281234567890'},'admin','https://foreign.invalid')).status,403);
 assert.equal((await req('lark-lookup',{method:'mobile',mobile:'+6281234567890'})).status,200);
 const d=await (await req('lark-bindings')).json();assert.deepEqual(d.bindings,{});
 assert.equal((await req('users/maya',await body('maya',candidate),'sales')).status,403);
 });
 await test('unified save rechecks identity and atomically updates employee and binding',async()=>{
 const before=lookups;
 assert.equal((await req('users/maya',await body('maya',{...candidate,openId:'ou_wrong'},{displayName:'Should not save'}))).status,409);
 const r=await req('users/maya',await body('maya',candidate,{displayName:'Maya Putri'}));assert.equal(r.status,200,JSON.stringify(await r.json()));
 const row=(await pool.query("SELECT * FROM crm_users WHERE id='maya'")).rows[0];assert.equal(row.display_name,'Maya Putri');assert.equal(row.email,null);
 const d=await (await req('lark-bindings')).json();assert.equal(d.bindings.maya.mobile,candidate.mobile);assert.equal(d.bindings.maya.revision,1);assert.ok(lookups>=before+2);
 const directory=await (await req('')).json();const summary=directory.users.find((u:any)=>u.id==='maya');assert.equal(summary.larkBound,true);assert.equal(summary.mobile,undefined);assert.equal(summary.openId,undefined);
 });
 await test('duplicate binding and stale binding revision roll back employee changes',async()=>{
 assert.equal((await req('users/arif',await body('arif',candidate,{displayName:'Wrong change'}))).status,409);
 assert.equal((await pool.query("SELECT display_name FROM crm_users WHERE id='arif'")).rows[0].display_name,'arif');
 assert.equal((await req('users/maya',await body('maya',{remove:true,revision:0},{displayName:'Wrong change'}))).status,409);
 assert.equal((await pool.query("SELECT display_name FROM crm_users WHERE id='maya'")).rows[0].display_name,'Maya Putri');
 });
 await test('same operation replay after lost response does not duplicate audit or binding writes',async()=>{
 const payload=await body('maya',{remove:true,revision:1});
 const first=await req('users/maya',payload);assert.equal(first.status,200,JSON.stringify(await first.json()));
 const count=Number((await pool.query("SELECT COUNT(*) n FROM portal_audit WHERE action='access.lark.binding'")).rows[0].n);
 const replay=await req('users/maya',payload);assert.equal(replay.status,200,JSON.stringify(await replay.json()));
 assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM portal_audit WHERE action='access.lark.binding'")).rows[0].n),count);
 const d=await (await req('lark-bindings')).json();assert.equal(d.bindings.maya.openId,undefined);assert.equal(d.bindings.maya.revision,2);
 });
 await test('old standalone save is blocked, employee concurrency and reason remain required',async()=>{
 assert.equal((await req('lark-bindings/maya',candidate)).status,409);
 assert.equal((await req('users/maya',await body('maya',{...candidate,revision:2},{reason:''}))).status,400);
 assert.equal((await req('users/maya',await body('maya',{...candidate,revision:2},{revision:-1}))).status,409);
 assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM notification_jobs')).rows[0].n),0);
 });
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));platform.authenticate=original;globalThis.fetch=native;await pool.end();await disposeNativeTest(fixture);}
}
