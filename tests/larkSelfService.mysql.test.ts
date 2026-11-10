import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {setupNativeTest} from './helpers/mysql.mjs';
import {disposeNativeTest} from './helpers/disposeNativeTest.mjs';
if(!process.env.MYSQL_NATIVE_TEST_ENV){test('Lark self service requires approved isolation',{skip:true},()=>{});}else{
 const fixture=await setupNativeTest('lark_self_service');
 const {pool}=await import('../server/portal/store.ts');
 // This suite uses the live code path with a fully intercepted provider.
 process.env.TRIAL_DATASET='local-crm';
 const setMode=(mode:string)=>pool.query("INSERT INTO portal_settings(id,value) VALUES('lark_personal_channel',:p1) ON DUPLICATE KEY UPDATE value=:p1",[{mode,revision:1}]);
 await setMode('live');const {platform}=await import('../server/portal/identity.ts');
 const original=platform.authenticate,native=globalThis.fetch;let tenant='tenant_synthetic',openId='ou_maya',sends=0,loseResponse=false,active=true,profileMode='sales';
 platform.authenticate=async(q:any)=>['maya','arif'].includes(q.headers['x-user'])&&active?{id:q.headers['x-user'],active:true,roles:profileMode==='manager'?['crm_leader']:['sales'],teams:[],permissions:profileMode==='cms'?[]:profileMode==='manager'?['crm.read','notifications.manage']:['crm.read'],scope:'own'}:null;
 Object.assign(process.env,{LARK_APP_ID:'cli_synthetic',LARK_APP_SECRET:'synthetic-only',LARK_TENANT_KEY:tenant,PORT:'3000'});
 globalThis.fetch=async(url,o)=>{
 if(String(url).startsWith('http://127.0.0.1:'))return native(url,o);
 const u=String(url);
 if(u.endsWith('/auth/v3/app_access_token/internal'))return Response.json({code:0,app_access_token:'synthetic-app-token'});
 if(u.endsWith('/auth/v3/tenant_access_token/internal'))return Response.json({code:0,tenant_access_token:'synthetic-tenant-token',expire:7200});
 if(u.endsWith('/authen/v1/access_token'))return Response.json({code:0,data:{access_token:'synthetic-user-token',refresh_token:'do-not-store'}});
 if(u.endsWith('/authen/v1/user_info'))return Response.json({code:0,data:{open_id:openId,tenant_key:tenant,name:'Maya Putri'}});
 if(u.includes('/im/v1/messages?receive_id_type=open_id')){sends++;assert.equal(JSON.parse(String(o?.body)).receive_id,openId);if(loseResponse)throw Error('Synthetic response loss');return Response.json({code:0,data:{message_id:'synthetic-message'}});}
 throw Error('Unexpected external request blocked');
 };
 const express=(await import('express')).default,app=express();app.use(express.json());const {mountLarkSelfService}=await import('../server/portal/larkSelfService.ts');mountLarkSelfService(app);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;
 process.env.LARK_OAUTH_REDIRECT_URI=base+'/api/crm/lark/callback';
 const req=(path:string,body?:any,user='maya',cookie=user,origin=base)=>globalThis.fetch(base+'/api/crm/lark/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-user':user,Cookie:'uper_crm_session_3000='+cookie,Origin:origin},body:body?JSON.stringify(body):undefined,redirect:'manual'});
 const authorize=async(user='maya')=>{const r=await req('authorize',{returnTo:'/crm?tab=leads&lead=sample',lang:'zh'},user);assert.equal(r.status,200);const d=await r.json();return new URL(d.url).searchParams.get('state')!;};
 const callback=async(state:string,user='maya',cookie=user)=>{const r=await req('callback?state='+state+'&code=synthetic-code',undefined,user,cookie);return new URL(r.headers.get('location')!,base);};
 try{
 await pool.query("INSERT INTO access_state(id,value) VALUES('policy',:p1)",[{initialized:true}]);
 for(const id of ['maya','arif'])await pool.query("INSERT INTO crm_users(id,login_id,display_name,password_hash,roles,teams) VALUES(:p1,:p1,:p1,'synthetic',:p2,:p3)",[id,'[]','[]']);
 await test('ordinary employees read only their own status; login, origin and configuration are required',async()=>{
 assert.equal((await req('me',undefined,'anonymous')).status,401);assert.equal((await req('me')).status,200);
 assert.equal((await req('authorize',{},'maya','maya','https://foreign.invalid')).status,403);
 const prior=process.env.LARK_TENANT_KEY;delete process.env.LARK_TENANT_KEY;assert.equal((await req('authorize',{})).status,409);process.env.LARK_TENANT_KEY=prior;
 assert.equal((await req('authorize',{returnTo:'https://evil.invalid/'})).status,400);
 });
 await test('Strict-cookie cross-site return commits a safe origin page and still requires the original session',async()=>{
 const state=await authorize(),path='callback?state='+state+'&code=synthetic-code';
 const bridge=await native(base+'/api/crm/lark/'+path,{redirect:'manual'});
 assert.equal(bridge.status,200);assert.match(bridge.headers.get('content-security-policy')!,/default-src 'none'/);
 const html=await bridge.text();assert.match(html,/location.replace/);assert.match(html,/resume=1/);assert.ok(!html.includes('synthetic-user-token'));assert.equal(sends,0);
 const missing=await native(base+'/api/crm/lark/'+path+'&resume=1',{redirect:'manual'});assert.equal(missing.status,303);assert.match(missing.headers.get('location')!,/Login/);
 const restored=await req(path+'&resume=1');assert.equal(restored.status,303);assert.equal(new URL(restored.headers.get('location')!,base).searchParams.get('lark'),'verified');assert.equal(sends,0);
 });
 await test('authorization state is tied to employee and session, and callback does not bind or send',async()=>{
 const state=await authorize();assert.equal((await callback(state,'arif')).searchParams.get('lark'),'error');assert.equal((await callback(state,'maya','different-session')).searchParams.get('lark'),'error');
 const url=await callback(state);assert.equal(url.searchParams.get('lead'),'sample');assert.equal(url.searchParams.get('lark'),'verified');
 assert.equal((await (await req('me')).json()).bound,false);assert.equal(sends,0);
 assert.equal((await callback(state)).searchParams.get('lark'),'error');
 const flowId=url.searchParams.get('flow');const candidate=await (await req('me?flow='+flowId)).json();assert.equal(candidate.candidate.name,'Maya Putri');assert.ok(!JSON.stringify(candidate).includes('synthetic-user-token'));
 const saved=await req('bind',{flowId,employeeId:'arif'});assert.equal(saved.status,200);assert.equal((await saved.json()).confirmation,'accepted');assert.equal(sends,1);
 assert.equal((await (await req('me',undefined,'arif')).json()).bound,false);
 assert.equal((await req('bind',{flowId})).status,200);assert.equal(sends,1);
 });
 await test('wrong tenant is rejected, expired state cannot authorize, duplicate identity cannot bind',async()=>{
 let state=await authorize();tenant='another-tenant';assert.equal((await callback(state)).searchParams.get('reason'),'lark_wrong_organization');tenant='tenant_synthetic';
 state=await authorize();const key='lark_oauth:'+crypto.createHash('sha256').update(state).digest('hex');const row=(await pool.query('SELECT value FROM portal_settings WHERE id=:p1',[key])).rows[0];await pool.query('UPDATE portal_settings SET value=:p2 WHERE id=:p1',[key,{...row.value,expiresAt:'2000-01-01T00:00:00Z'}]);assert.equal((await callback(state)).searchParams.get('reason'),'lark_authorization_expired');
 const url=await callback(await authorize('arif'),'arif');assert.equal((await req('bind',{flowId:url.searchParams.get('flow')},'arif')).status,409);assert.equal(sends,1);
 });
 await test('unchanged identity does not repeat confirmation and unbind checks revision without notifications',async()=>{
 const flowId=(await callback(await authorize())).searchParams.get('flow');assert.equal((await req('bind',{flowId})).status,200);assert.equal(sends,1);
 assert.equal((await req('unbind',{revision:0})).status,409);assert.equal((await req('unbind',{revision:1,employeeId:'arif'})).status,200);assert.equal(sends,1);assert.equal((await (await req('me')).json()).bound,false);
 assert.equal((await req('unbind',{revision:1})).status,200);
 });
 await test('ambiguous confirmation is never resent and tokens are never persisted',async()=>{
 const flowId=(await callback(await authorize())).searchParams.get('flow');loseResponse=true;const r=await req('bind',{flowId});assert.equal((await r.json()).confirmation,'unknown');assert.equal(sends,2);
 assert.equal((await req('bind',{flowId})).status,200);assert.equal(sends,2);
 const rows=(await pool.query("SELECT value FROM portal_settings WHERE id LIKE 'lark_%'")).rows;const text=JSON.stringify(rows);assert.ok(!text.includes('synthetic-user-token'));assert.ok(!text.includes('synthetic-app-token'));assert.ok(!text.includes('do-not-store'));assert.ok(!text.includes('synthetic-code'));
 active=false;assert.equal((await req('me')).status,401);active=true;
 });
 await test('configuration rejects unsafe callbacks and cannot leak another employee authorization candidate',async()=>{
 const {larkSelfConfiguration}=await import('../server/portal/larkSelfService.ts');
 for(const url of ['http://external.invalid/api/crm/lark/callback','https://example.com/wrong','https://user:password@example.com/api/crm/lark/callback','https://example.com/api/crm/lark/callback?x=1'])assert.equal(larkSelfConfiguration({...process.env,LARK_OAUTH_REDIRECT_URI:url}).ready,false);
 const location=await callback(await authorize());const status=await (await req('me?flow='+location.searchParams.get('flow'),undefined,'arif')).json();assert.equal(status.candidate,undefined);assert.equal(status.authorizationError,'lark_authorization_expired');
 });
 await test('audit failure rolls back binding and confirmation record before any send',async()=>{
 const mysql=(await import('mysql2/promise')).default;const u=new URL(process.env.MYSQL_TRIAL_URL!);const connection=await mysql.createConnection({user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.slice(1),socketPath:fixture.socket});
 openId='ou_arif';loseResponse=false;const flowId=(await callback(await authorize('arif'),'arif')).searchParams.get('flow');const before=sends;
 await connection.query("CREATE TRIGGER reject_self_binding BEFORE INSERT ON portal_audit FOR EACH ROW BEGIN IF NEW.action='access.lark.self.bind' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic audit failure'; END IF; END");
 try{assert.equal((await req('bind',{flowId},'arif')).status,503);assert.equal((await (await req('me',undefined,'arif')).json()).bound,false);assert.equal(sends,before);}finally{await connection.query('DROP TRIGGER reject_self_binding');await connection.end();}
 assert.equal((await req('bind',{flowId},'arif')).status,200);assert.equal(sends,before+1);
 });
 await test('personal preferences are own-only, validated, concurrent, idempotent and transactional without sending',async()=>{
 const before=sends;
 const status=await (await req('me')).json();assert.deepEqual(status.preferences,{revision:0,language:'rule',disabledTypes:[]});assert.deepEqual(status.systemTypes,[]);
 await pool.query("INSERT INTO notification_rules(id,version,config,enabled,effective_at) VALUES('pref-active',1,:p1,true,'2020-01-01')",[{event:'assessment.completed',channels:['lark']}]);
 await pool.query("INSERT INTO notification_rules(id,version,config,enabled,effective_at) VALUES('pref-inapp',1,:p1,true,'2020-01-01')",[{event:'lead.created',channels:['inapp']}]);
 assert.deepEqual((await (await req('me')).json()).systemTypes,['assessment.completed']);
 assert.equal((await req('preferences',{revision:0,language:'xx',disabledTypes:[]})).status,400);
 assert.equal((await req('preferences',{revision:0,language:'en',disabledTypes:['daily.digest']})).status,400);
 assert.equal((await req('preferences',{revision:0,language:'en',disabledTypes:[]},'maya','maya','https://foreign.invalid')).status,403);
 assert.equal((await req('preferences',{revision:0,language:'en',disabledTypes:[]},'anonymous')).status,401);
 const body={revision:0,language:'en',disabledTypes:['assessment.completed'],employeeId:'arif'};
 await setMode('simulation');
 assert.equal((await req('preferences',body)).status,409);
 await setMode('live');
 assert.equal((await req('preferences',{revision:0,language:'en',disabledTypes:['lead.created']})).status,409);
 for(const type of ['handoff.requested','booking.requested','enrollment.requested','commitment.due','task.overdue','ai.failed','notification.failed'])assert.equal((await req('preferences',{revision:0,language:'en',disabledTypes:[type]})).status,400,type);
 profileMode='cms';assert.deepEqual((await (await req('me')).json()).visibleTypes,[]);assert.equal((await req('preferences',body)).status,409);profileMode='sales';
 assert.ok(!(await (await req('me')).json()).visibleTypes.includes('notification.failed'));
 profileMode='manager';assert.ok(!(await (await req('me')).json()).visibleTypes.includes('notification.failed'),'group-only operational faults are not offered as personal choices');profileMode='sales';
 const saved=await (await req('preferences',body)).json();assert.equal(saved.preferences.revision,1);
 assert.equal((await (await req('me',undefined,'arif')).json()).preferences.revision,0);
 assert.equal((await (await req('preferences',body)).json()).preferences.revision,1);
 assert.equal((await req('preferences',{revision:0,language:'id',disabledTypes:[]})).status,409);
 const mysql=(await import('mysql2/promise')).default;const u=new URL(process.env.MYSQL_TRIAL_URL!);const c=await mysql.createConnection({user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.slice(1),socketPath:fixture.socket});
 await c.query("CREATE TRIGGER reject_notification_pref BEFORE INSERT ON portal_audit FOR EACH ROW BEGIN IF NEW.action='access.notifications.preferences' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic preference audit failure'; END IF; END");
 try{assert.equal((await req('preferences',{revision:1,language:'id',disabledTypes:[]})).status,503);assert.equal((await (await req('me')).json()).preferences.language,'en');}finally{await c.query('DROP TRIGGER reject_notification_pref');await c.end();}
 assert.equal(sends,before);
 const all=(await pool.query("SELECT value FROM access_state WHERE id='lark_bindings'")).rows[0].value;
 const savedBinding=all.maya;all.maya={...savedBinding,openId:''};
 await pool.query("UPDATE access_state SET value=:p1 WHERE id='lark_bindings'",[all]);
 assert.equal((await req('preferences',{revision:1,language:'id',disabledTypes:['assessment.completed']})).status,409);
 all.maya={...savedBinding,appId:'different-app'};
 await pool.query("UPDATE access_state SET value=:p1 WHERE id='lark_bindings'",[all]);
 assert.equal((await req('preferences',{revision:1,language:'id',disabledTypes:['assessment.completed']})).status,409);
 all.maya=savedBinding;await pool.query("UPDATE access_state SET value=:p1 WHERE id='lark_bindings'",[all]);await setMode('simulation');
 });
 }finally{globalThis.fetch=native;platform.authenticate=original;await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));await pool.end();await disposeNativeTest(fixture);}
}
