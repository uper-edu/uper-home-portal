import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import net from 'node:net';
import https from 'node:https';
import http from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import express from 'express';
import mysql from 'mysql2/promise';
import {companyConfiguration,companyOrigin,exactPrivateProxy,productionConfiguration,productionOrigin} from '../server/companyTrial.ts';
import {configureAccessTransport} from '../server/portal/accessTransport.ts';
import {openTrialDatabase} from '../cloud/mysql/database.mjs';
import {resolveMetadata,publicPages} from '../src/utils/siteMetadata.ts';
import {acquireCompanyRuntimeLease,companyRuntimeLock} from '../cloud/mysql/company-maintenance.mjs';
const valid:any={PORTAL_DEPLOYMENT:'company-trial',NODE_ENV:'production',APP_ENV:'production',TRIAL_DATASET:'synthetic',PLATFORM_MODE:'local',PORTAL_DATABASE_DRIVER:'mysql',APP_URL:companyOrigin,ACCESS_PUBLIC_ORIGIN:companyOrigin,ACCESS_TRUSTED_PROXIES:'172.20.0.10',ACCESS_OPERATION_KEY:'x'.repeat(40),TRIAL_FRONTEND_DIRECTORY:'/app/web',MYSQL_CA_PEM:'placeholder',PORTAL_NOTIFICATION_MODE:'simulation',PORTAL_WORKER_ENABLED:'false'};
const production:any={PORTAL_ENV:'prod',PORTAL_DEPLOYMENT:'production',PORTAL_PRODUCTION_READY:'true',NODE_ENV:'production',APP_ENV:'production',TRIAL_DATASET:'synthetic',PLATFORM_MODE:'local',PORTAL_DATABASE_DRIVER:'mysql',APP_URL:productionOrigin,ACCESS_PUBLIC_ORIGIN:productionOrigin,ACCESS_TRUSTED_PROXIES:'10.20.0.8',ACCESS_OPERATION_KEY:'x'.repeat(40),MYSQL_TLS_MODE:'disabled',MYSQL_TRIAL_URL:'mysql://Home:password@10.20.0.9:3306/prod_uper_trial_home',PORT:'8080',PORTAL_NOTIFICATION_MODE:'simulation',PORTAL_WORKER_ENABLED:'false'};
test('company deployment gate preserves local safeguards and rejects unsafe configuration',()=>{
 assert.equal(companyConfiguration({} as any),null);assert.deepEqual(companyConfiguration(valid),{port:8080,host:'0.0.0.0'});
 for(const [key,value] of Object.entries({NODE_ENV:'development',APP_ENV:'test',TRIAL_DATASET:'local-crm',PLATFORM_MODE:'mock',PORTAL_LOCAL_CUTOVER:'true',PORTAL_FAULT_TEST:'true',ACCESS_ALLOW_TEST_PASSWORDS:'true',APP_URL:'http://home.prototype.uperedu.com',ACCESS_OPERATION_KEY:'short',MYSQL_TRIAL_SOCKET:'/private/local.sock',MYSQL_CA_PEM:'',PORT:'3000',PORTAL_NOTIFICATION_MODE:'',TRIAL_FRONTEND_DIRECTORY:''}))assert.throws(()=>companyConfiguration({...valid,[key]:value}),key);
 assert.throws(()=>companyConfiguration({...valid,PORTAL_NOTIFICATION_MODE:'configured'}));
 assert.throws(()=>companyConfiguration({...valid,ACCESS_TRUSTED_PROXIES:'0.0.0.0/0'}));
 assert.throws(()=>companyConfiguration({...valid,PORTAL_WORKER_ENABLED:''}));
 assert.throws(()=>companyConfiguration({...valid,ACCESS_RECOVERY_MAINTENANCE:'true'}));
 assert.ok(companyConfiguration({...valid,PORTAL_NOTIFICATION_MODE:'configured',LARK_TEST_GROUP:'CRM_Leads_Update'}));
});
test('production gate allows the approved internal no-TLS MySQL path and canonical origin',()=>{
 assert.equal(productionConfiguration({} as any),null);assert.deepEqual(productionConfiguration(production),{port:8080,host:'0.0.0.0'});
 assert.throws(()=>productionConfiguration({...production,APP_URL:companyOrigin}));
 assert.throws(()=>productionConfiguration({...production,MYSQL_TLS_MODE:'required'}));
 assert.throws(()=>productionConfiguration({...production,ACCESS_TRUSTED_PROXIES:'0.0.0.0/0'}));
});
test('company runtime lease loss fails closed and never returns a locked session to the pool',async()=>{
 assert.equal(companyRuntimeLock({MYSQL_TRIAL_URL:'mysql://test:test@localhost/uper_trial_lease'}),companyRuntimeLock({MYSQL_TRIAL_URL:'mysql://test:test@localhost/uper%5Ftrial%5Flease'}));
 let destroyed=0,returned=0,lost=0;
 const c={execute:async(sql:string)=>sql.includes('GET_LOCK')?[[{acquired:1}]]:[[ {held:0} ]],destroy:()=>destroyed++,release:()=>returned++};
 let observed:()=>void;const done=new Promise<void>(r=>observed=r);
 const release=await acquireCompanyRuntimeLease({getConnection:async()=>c},{MYSQL_TRIAL_URL:'mysql://test:test@localhost/uper_trial_lease'},()=>{lost++;observed();});
 try{await Promise.race([done,new Promise((_,reject)=>setTimeout(()=>reject(Error('lease loss not detected')),2500))]);assert.equal(lost,1);assert.equal(destroyed,1);assert.equal(returned,0);}
 finally{await release();}
});
test('company HTTPS gate rejects forged forwarded headers from an untrusted actual peer, including HTML',async()=>{
 const app=express();configureAccessTransport(app,valid);app.get('/api/check',(_q,r)=>r.json({ok:true}));app.get('/',(_q,r)=>r.send('test'));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try{for(const route of ['/api/check','/']){const r=await fetch('http://127.0.0.1:'+(server.address() as any).port+route,{headers:{Host:'home.prototype.uperedu.com','X-Forwarded-Proto':'https','X-Forwarded-For':'10.0.0.1'}});assert.equal(r.status,403);assert.equal((await r.json()).error,'access_proxy_rejected');}}
 finally{await new Promise<void>(r=>server.close(()=>r()));}
});
test('company proxy trust accepts exact private peers only, never networks or public peers',()=>{
 for(const v of ['172.20.0.10','10.0.0.2','192.168.2.8','::ffff:172.20.0.10','127.0.0.1'])assert.equal(exactPrivateProxy(v),true,v);
 for(const v of ['0.0.0.0/0','172.20.0.0/16','true','*','8.8.8.8','0.0.0.0','nginx','::'])assert.equal(exactPrivateProxy(v),false,v);
 configureAccessTransport(express(),valid);
 assert.throws(()=>configureAccessTransport(express(),{...valid,ACCESS_TRUSTED_PROXIES:'172.20.0.0/16'}));
 assert.throws(()=>configureAccessTransport(express(),{ACCESS_TRUSTED_PROXIES:'172.20.0.10',ACCESS_PUBLIC_ORIGIN:companyOrigin}));
});
test('company browser metadata stays noindex across public pages and all three languages',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{configurable:true,value:{location:{hostname:'home.prototype.uperedu.com'}}});
 try{for(const route of Object.keys(publicPages))for(const lang of ['en','id','zh'] as const){const m=resolveMetadata(route,lang);assert.equal(m.indexable,false);assert.equal(m.canonical,undefined);assert.deepEqual(m.schema,[]);assert.deepEqual(m.alternates,[]);}}
 finally{if(descriptor)Object.defineProperty(globalThis,'window',descriptor);else delete (globalThis as any).window;}
});
async function freePort(){const s=net.createServer();s.listen(0,'127.0.0.1');await new Promise<void>(r=>s.once('listening',r));const port=(s.address() as any).port;await new Promise<void>(r=>s.close(()=>r()));return port;}
async function stop(child:any){if(!child||child.exitCode!==null)return;const done=new Promise<void>(r=>child.once('exit',()=>r()));child.kill('SIGTERM');await Promise.race([done,new Promise<void>(r=>setTimeout(()=>{child.kill('SIGKILL');r();},10000).unref())]);}
if(process.env.MYSQL_NATIVE_TEST_ENV)await test('company packaged application: independent MySQL TLS, canonical HTTPS proxy, permissions and notification closure',{timeout:120000},async t=>{
 execFileSync(process.execPath,['scripts/build-company-trial.mjs','.local-backups/company-trial-20261014/package'],{stdio:'ignore'});
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'uper-company-'));await fs.chmod(dir,0o700);
 let daemon:any,app:any,proxy:any,db:any,portalPool:any,appLog:any;
 const caKey=path.join(dir,'ca-key.pem'),caCert=path.join(dir,'ca.pem');
 const openssl=(args:string[])=>execFileSync('/usr/bin/openssl',args,{stdio:'ignore'});
 openssl(['req','-x509','-nodes','-newkey','rsa:2048','-keyout',caKey,'-out',caCert,'-days','1','-subj','/CN=TEST Company CA']);
 async function certificate(name:string,sans:string){const key=path.join(dir,name+'-key.pem'),cert=path.join(dir,name+'.pem'),csr=path.join(dir,name+'.csr'),ext=path.join(dir,name+'.ext');
  await fs.writeFile(ext,'subjectAltName='+sans+'\nextendedKeyUsage=serverAuth\n');
  openssl(['req','-nodes','-newkey','rsa:2048','-keyout',key,'-out',csr,'-subj','/CN='+name]);
  openssl(['x509','-req','-in',csr,'-CA',caCert,'-CAkey',caKey,'-CAcreateserial','-out',cert,'-days','1','-extfile',ext]);await fs.chmod(key,0o600);return{key,cert};}
 const sqlCert=await certificate('mysql','DNS:localhost'),webCert=await certificate('web','DNS:home.prototype.uperedu.com');
 const binary=process.env.MYSQL_BIN_DIRECTORY!;
 const data=path.join(dir,'mysql');await fs.mkdir(data);
 execFileSync(path.join(binary,'mysqld'),['--no-defaults','--initialize-insecure','--basedir='+path.dirname(binary),'--datadir='+data],{stdio:'ignore'});
 const sqlPort=await freePort(),appPort=await freePort(),socket=path.join(dir,'mysql.sock');
 const log=await fs.open(path.join(dir,'mysql.log'),'a',0o600);
 daemon=spawn(path.join(binary,'mysqld'),['--no-defaults','--basedir='+path.dirname(binary),'--datadir='+data,'--socket='+socket,'--port='+sqlPort,'--bind-address=127.0.0.1','--mysqlx=OFF','--ssl-ca='+caCert,'--ssl-cert='+sqlCert.cert,'--ssl-key='+sqlCert.key,'--require-secure-transport=ON','--innodb-buffer-pool-size=32M','--pid-file='+path.join(dir,'mysql.pid'),'--log-error='+path.join(dir,'mysql-error.log')],{stdio:['ignore',log.fd,log.fd]});
 t.after(async()=>{if(proxy)await new Promise<void>(r=>proxy.close(()=>r()));await stop(app);if(portalPool)await portalPool.end();if(db)await db.end();await stop(daemon);if(appLog)await appLog.close();await log.close();await fs.rm(dir,{recursive:true,force:true});});
 let root:any;
 for(let n=0;n<100;n++){try{root=await mysql.createConnection({user:'root',socketPath:socket});break;}catch{await new Promise(r=>setTimeout(r,100));}}
 assert.ok(root,'isolated TLS mysqld started');
 const password=crypto.randomBytes(24).toString('hex'),name='uper_trial_company_acceptance';
 await root.query('CREATE DATABASE '+name+' CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin');
 await root.query("CREATE USER 'trial'@'localhost' IDENTIFIED BY ? REQUIRE SSL",[password]);
 await root.query("GRANT ALL ON "+name+".* TO 'trial'@'localhost'");await root.end();
 const users=['Suki','Robert','Fadhil','Zainul','Wigar','Tester','Fenny','Ethan','Monite'],passwords=Object.fromEntries(users.map(u=>[u,'TEST-'+u+'-'+crypto.randomBytes(10).toString('hex')]));
 const initial=path.join(dir,'initial.json');await fs.writeFile(initial,JSON.stringify(passwords),{mode:0o600});
 const env:any={...process.env,...valid,PORTAL_ENV:'test',PORTAL_ENV_SOURCE:'injected',PORT:String(appPort),ACCESS_TRUSTED_PROXIES:'127.0.0.1',MYSQL_CA_PEM:await fs.readFile(caCert,'utf8'),MYSQL_TRIAL_URL:`mysql://trial:${password}@localhost:${sqlPort}/${name}`,TRIAL_FRONTEND_DIRECTORY:path.resolve('.local-backups/company-trial-20261014/package/web'),ACCESS_INITIAL_PASSWORDS_FILE:initial,PORTAL_WORKER_ENABLED:'false'};
 for(const k of ['MYSQL_TRIAL_SOCKET','PORTAL_LOCAL_CUTOVER','PORTAL_ENV_FILE','ACCESS_ALLOW_TEST_PASSWORDS','PORTAL_FAULT_TEST','OPENAI_API_KEY','DEEPSEEK_API_KEY','LARK_GROUP_CRM'])delete env[k];
 await assert.rejects(async()=>{const p=await openTrialDatabase({...env,MYSQL_CA_PEM:''});try{await p.query('SELECT 1');}finally{await p.end();}});
 await assert.rejects(async()=>{const p=await openTrialDatabase({...env,MYSQL_CA_PEM:'invalid CA'});try{await p.query('SELECT 1');}finally{await p.end();}});
 await assert.rejects(async()=>{const p=await openTrialDatabase({...env,MYSQL_TRIAL_URL:env.MYSQL_TRIAL_URL.replace('@localhost:', '@127.0.0.1:')});try{await p.query('SELECT 1');}finally{await p.end();}});
 const originalCert=await fs.readFile(sqlCert.cert);const originalKey=await fs.readFile(sqlCert.key);
 const mismatch=await certificate('mismatch','DNS:wrong.invalid');await fs.copyFile(mismatch.cert,sqlCert.cert);await fs.copyFile(mismatch.key,sqlCert.key);
 const tlsAdmin=await mysql.createConnection({user:'root',socketPath:socket});await tlsAdmin.query('ALTER INSTANCE RELOAD TLS');
 await assert.rejects(async()=>{const p=await openTrialDatabase(env);try{await p.query('SELECT 1');}finally{await p.end();}});
 await fs.writeFile(sqlCert.cert,originalCert);await fs.writeFile(sqlCert.key,originalKey);await tlsAdmin.query('ALTER INSTANCE RELOAD TLS');await tlsAdmin.end();
 db=await openTrialDatabase(env);const [ssl]=await db.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");assert.ok(ssl[0].Value);
 appLog=await fs.open(path.join(dir,'app.log'),'a',0o600);
 app=spawn(process.execPath,[path.resolve('.local-backups/company-trial-20261014/package/runtime/server.mjs')],{cwd:dir,env,stdio:['ignore',appLog.fd,appLog.fd]});
 for(let n=0;n<100;n++){if(app.exitCode!==null)throw Error('Packaged app exited: '+await fs.readFile(path.join(dir,'app.log'),'utf8'));try{await new Promise<void>((resolve,reject)=>{const s=net.connect(appPort,'127.0.0.1',()=>{s.destroy();resolve();});s.on('error',reject);});break;}catch{await new Promise(r=>setTimeout(r,100));}}
 const ca=await fs.readFile(caCert);
 proxy=https.createServer({key:await fs.readFile(webCert.key),cert:await fs.readFile(webCert.cert)},(q,r)=>{
  const headers={...q.headers,host:'home.prototype.uperedu.com','x-forwarded-host':'home.prototype.uperedu.com','x-forwarded-proto':'https','x-forwarded-for':q.socket.remoteAddress};delete headers['forwarded'];
  const up=http.request({hostname:'127.0.0.1',port:appPort,path:q.url,method:q.method,headers},v=>{r.writeHead(v.statusCode!,v.headers);v.pipe(r);});up.on('error',()=>{r.writeHead(502);r.end();});q.pipe(up);
 });proxy.listen(0,'127.0.0.1');await new Promise<void>(r=>proxy.once('listening',r));
 const proxyPort=proxy.address().port;
 const client=()=>{const jar=new Map<string,string>();return{async call(route:string,body?:any,options:any={}){return new Promise<any>((resolve,reject)=>{
  const req=https.request({hostname:'127.0.0.1',servername:'home.prototype.uperedu.com',port:proxyPort,ca,method:options.method||(body?'POST':'GET'),path:route,headers:{Host:'home.prototype.uperedu.com',Origin:companyOrigin,'Content-Type':'application/json',Cookie:[...jar.values()].join('; '),...options.headers}},r=>{for(const c of r.headers['set-cookie']||[]){const v=c.split(';')[0];jar.set(v.split('=')[0],v);}let text='';r.on('data',x=>text+=x);r.on('end',()=>{let data:any;try{data=JSON.parse(text);}catch{data=text;}resolve({status:r.statusCode,data,headers:r.headers});});});req.on('error',reject);if(body)req.write(JSON.stringify(body));req.end();});}};};
 const anon=client(),manager=client(),sales=client(),other=client(),cms=client();
 const health=await anon.call('/api/health');assert.equal(health.status,200);assert.equal(health.data.environment,'test');assert.equal(health.data.dataset,'synthetic');const version=await anon.call('/api/version');assert.equal(version.data.mode,'package');assert.equal(version.data.consistent,true);assert.equal(version.data.backend.buildId,health.data.version.backend.buildId);assert.equal(version.headers['x-uper-build'],version.data.backend.buildId);
 for(const route of ['/','/chat','/crm','/cms','/system'])for(const lang of ['en','id','zh']){const r=await anon.call(route+'?lang='+lang);assert.equal(r.status,200,route);assert.match(r.headers['x-robots-tag'],/noindex/);assert.match(r.data,/name="robots" content="noindex/);assert.doesNotMatch(r.data,/rel="canonical"|application\/ld\+json/);}
 assert.equal((await anon.call('/robots.txt')).data,'User-agent: *\nDisallow: /\n');assert.equal((await anon.call('/sitemap.xml')).status,404);
 const bad=await anon.call('/api/crm/auth/login',{loginId:'Robert',password:passwords.Robert},{headers:{Origin:'https://evil.invalid'}});assert.equal(bad.status,403);
 for(const [c,id]of [[manager,'Robert'],[sales,'Fadhil'],[other,'Wigar'],[cms,'Fenny']] as const){const r=await c.call('/api/crm/auth/login',{loginId:id,password:passwords[id]});assert.equal(r.status,200,JSON.stringify(r.data));assert.match(r.headers['set-cookie'][0],/Secure/);assert.match(r.headers['set-cookie'][0],/HttpOnly/);assert.match(r.headers['set-cookie'][0],/SameSite=Strict/);}
 assert.equal((await anon.call('/api/admin/access')).status,401);
 assert.equal((await manager.call('/api/admin/access')).status,200);
 assert.equal((await sales.call('/api/admin/access')).status,403);
 assert.equal((await sales.call('/api/cms/content/news',{items:[],revision:0},{method:'PUT'})).status,403);
 assert.equal((await cms.call('/api/crm/leads')).status,403);
 const monite=(await manager.call('/api/admin/access')).data.users.find((u:any)=>u.id==='Monite');assert.equal((await manager.call('/api/admin/access/users/Monite/password',{temporaryPassword:'Monite',revision:monite.revision,operationId:crypto.randomUUID(),reason:'TEST retired exception must not allow short password'})).status,400);
 // The API consumes CMS writes through /api/content; authenticated read-only public content stays public.
 const conversation=(await anon.call('/api/portal/conversations',{source:'standalone_chat',campaign:'TEST-company-trial'})).data.conversationId;assert.ok(conversation);
 const reg=await anon.call('/api/portal/register',{fullName:'TEST Company Trial Learner',phone:'000771122',email:'company-trial@example.invalid'});assert.equal(reg.status,200,JSON.stringify(reg.data));const leadId=reg.data.lead.id;
 assert.equal((await sales.call('/api/crm/leads/'+leadId+'/claim',{})).status,200);
 assert.ok([403,404].includes((await other.call('/api/crm/leads/'+leadId)).status));
 assert.equal((await sales.call('/api/crm/leads/'+leadId,{owner:'Wigar'},{method:'PATCH'})).status,403);
 const tasks=(await sales.call('/api/crm/leads/'+leadId+'/tasks')).data;assert.ok(tasks.length);
 const body={requestId:crypto.randomUUID(),recordKind:'contact',channel:'WhatsApp',connectStatus:'No Response',summary:'TEST no response; retain existing arrangement',completeTaskIds:[],disposition:'keep'};
 const saved=await sales.call('/api/crm/leads/'+leadId+'/logs',body);assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal((await sales.call('/api/crm/leads/'+leadId+'/logs',body)).status,200);
 const [afterTasks]=await db.execute('SELECT id,due_at,status FROM followup_tasks WHERE lead_id=?',[leadId]);assert.equal(afterTasks.length,tasks.length);for(const task of afterTasks){assert.notEqual(task.status,'completed');}
 // Direct HTTP or a forged host cannot bypass the canonical HTTPS transport gate.
 const direct=await fetch('http://127.0.0.1:'+appPort+'/api/health');assert.equal(direct.status,403);
 const wrongHost=await fetch('http://127.0.0.1:'+appPort+'/api/health',{headers:{Host:'evil.invalid','X-Forwarded-Proto':'https'}});assert.equal(wrongHost.status,403);
 // Run the real worker against the same TLS database, with transport stubbed only for Lark.
 Object.assign(process.env,env);for(const k of ['MYSQL_TRIAL_SOCKET','PORTAL_LOCAL_CUTOVER'])delete process.env[k];
 const store=await import('../server/portal/store.ts');portalPool=store.pool;
 const {tick}=await import('../server/portal/worker.ts');const {defaults}=await import('../server/portal/policy.ts');
 await db.query('UPDATE notification_rules SET enabled=false');
 const ev=crypto.randomUUID();await db.execute("INSERT INTO outbox(id,type,lead_id,payload,processed_at) VALUES(?,'TEST.company',?,'{}',UTC_TIMESTAMP(6))",[ev,leadId]);
 const makeJob=async(channel:string,recipient:string,held=false,overrides:any={})=>{const id=crypto.randomUUID();await db.execute("INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,state,due_at,snapshot) VALUES(?,?,?,1,?,?,'pending','2000-01-01',?)",[id,ev,crypto.randomUUID(),channel,recipient,JSON.stringify({rule:{...defaults,event:'TEST.company',workHours:false,businessOnly:false,calendarMode:'custom',channels:[channel],dedupeMinutes:0,retries:[],...overrides},event:'TEST.company',leadId,payload:{test:true}})]);if(held)await db.execute("INSERT INTO notification_migration_holds(kind,id,reason) VALUES('job',?,'TEST no replay')",[id]);return id;};
 const group='CRM_Leads_Update';await db.execute('INSERT INTO notification_channels(id,config) VALUES(?,?) ON DUPLICATE KEY UPDATE config=VALUES(config)',[group,JSON.stringify({mode:'simulation',groupName:'CRM Bot',maxPerHour:1000})]);
 const inbox=await makeJob('inapp','Fadhil'),simulated=await makeJob('lark',group),missing=await makeJob('lark','missing'),held=await makeJob('lark',group,true);
 const native=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('No external calls in simulation');};
 try{for(let i=0;i<4;i++)await tick();}finally{globalThis.fetch=native;}
 const state=async(id:string)=>(await db.execute('SELECT state,attempts,result FROM notification_jobs WHERE id=?',[id]))[0][0];
 assert.equal((await state(inbox)).state,'accepted');assert.equal((await state(simulated)).state,'simulated');assert.equal((await state(missing)).state,'failed');assert.equal((await state(held)).state,'pending');assert.equal(calls,0);
 await db.execute('UPDATE notification_channels SET config=? WHERE id=?',[JSON.stringify({mode:'live',groupName:'CRM Bot',secretRef:'LARK_GROUP_CRM',signingEnabled:false,maxPerHour:1000}),group]);
 const blocked=await makeJob('lark',group);await tick();assert.equal((await state(blocked)).state,'failed');
 process.env.PORTAL_NOTIFICATION_MODE='configured';process.env.LARK_TEST_GROUP=group;process.env.LARK_GROUP_CRM='https://open.larksuite.com/open-apis/bot/v2/hook/TEST_COMPANY_ONLY';
 const accepted=await makeJob('lark',group),unknown=await makeJob('lark',group);let first=true;let card:any;
 globalThis.fetch=async(url:any,options:any)=>{assert.equal(url,process.env.LARK_GROUP_CRM);calls++;card=JSON.parse(options.body);if(first){first=false;return new Response(JSON.stringify({code:0}),{status:200});}throw new DOMException('TEST send timeout','TimeoutError');};
 try{await tick();await tick();const statuses=[(await state(accepted)).state,(await state(unknown)).state];assert.deepEqual(statuses.sort(),['accepted','unknown']);const before=calls;await tick();assert.equal(calls,before);assert.equal(card.card.header.title.content,'UPER · TEST');assert.ok(JSON.stringify(card).includes(companyOrigin+'/crm?lead='));}finally{globalThis.fetch=native;}
 const limited=await makeJob('lark',group,false,{retries:[1]});globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({code:999}),{status:429,headers:{'retry-after':'60'}});};try{await tick();assert.equal((await state(limited)).state,'pending');}finally{globalThis.fetch=native;}
 const failed=await makeJob('lark',group);globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({code:123,msg:'TEST business failure'}),{status:200});};try{await tick();assert.equal((await state(failed)).state,'failed');}finally{globalThis.fetch=native;}
 const [inboxRows]=await db.execute('SELECT id FROM notification_inbox WHERE id=?',[inbox]);assert.equal(inboxRows.length,1);
 const untouchedTask=crypto.randomUUID();await db.execute("INSERT INTO followup_tasks(id,lead_id,kind,status,owner_id,due_at) VALUES(?,?,'booking','open','Fadhil',UTC_TIMESTAMP(6)+INTERVAL 2 day)",[untouchedTask,leadId]);
 const [originalDeadline]=await db.execute('SELECT due_at FROM followup_tasks WHERE id=?',[untouchedTask]);
 const linked=await makeJob('inapp','Fadhil');await db.execute("UPDATE notification_jobs SET due_at=UTC_TIMESTAMP(6)+INTERVAL 1 day,snapshot=JSON_SET(snapshot,'$.payload.taskId',?) WHERE id=?",[tasks[0].id,linked]);
 const closure=await sales.call('/api/crm/leads/'+leadId+'/logs',{requestId:crypto.randomUUID(),recordKind:'closure',summary:'TEST close selected task; retain unrelated booking',completeTaskIds:[tasks[0].id],disposition:'none',contactArrangement:{state:'stopped',reason:'TEST internal verification only',version:0}});assert.equal(closure.status,200,JSON.stringify(closure.data));
 assert.equal((await state(linked)).state,'cancelled');
 const [untouched]=await db.execute('SELECT due_at,status FROM followup_tasks WHERE id=?',[untouchedTask]);assert.equal(untouched[0].due_at,originalDeadline[0].due_at);assert.equal(untouched[0].status,'open');
 const backupFile=path.join(dir,'test-backup.sql');const {backup}=await import('../cloud/mysql/backup.mjs');assert.ok((await backup({...env,MYSQL_BIN_DIRECTORY:binary},backupFile)).bytes>0);
 const {exerciseCompanyRecovery}=await import('./helpers/companyRecovery.ts');
 const recoveryEvidence=await exerciseCompanyRecovery({t,env,dir,db,client,stopApp:()=>stop(app),restart:async(nextEnv:any)=>{await stop(app);app=spawn(process.execPath,[path.resolve('.local-backups/company-trial-20261014/package/runtime/server.mjs')],{cwd:dir,env:nextEnv,stdio:['ignore',appLog.fd,appLog.fd]});let ready=false;for(let i=0;i<100;i++){if(app.exitCode!==null)throw Error('Company restart failed: '+await fs.readFile(path.join(dir,'app.log'),'utf8'));try{await new Promise<void>((r,j)=>{const c=net.connect(appPort,'127.0.0.1',()=>{c.destroy();r();});c.on('error',j);});ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(ready);},createRestoreTarget:async()=>{const c=await mysql.createConnection({user:'root',socketPath:socket});try{await c.query('CREATE DATABASE '+name+'_restore CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin');await c.query("GRANT ALL ON "+name+"_restore.* TO 'trial'@'localhost'");}finally{await c.end();}return env.MYSQL_TRIAL_URL.replace('/'+name,'/'+name+'_restore');}});
 await fs.mkdir('.local-backups/company-recovery-20261014',{recursive:true});await fs.writeFile('.local-backups/company-recovery-20261014/integration-acceptance.json',JSON.stringify(recoveryEvidence,null,2),{mode:0o600});
 assert.equal((await state(held)).state,'pending');
 const evidence={target:companyOrigin,packagedApp:true,mysqlTLSVerified:true,wrongCAAndHostnameRejected:true,httpsCanonicalProxy:true,trilingualNoindexPages:15,secureCookies:true,permissions:true,leadClaimAndFollowupIdempotency:true,contactRecordDoesNotAutoCompleteTasks:true,onlySelectedTaskNotificationCancelled:true,unrelatedTaskDeadlinePreserved:true,simulationNoExternalCalls:true,larkAcceptedAndUnknownStubVerified:true,rateLimitAndBusinessFailure:true,verifiedTlsBackup:true,historicalHoldNotReplayed:true,realLarkCalls:0,realAiCalls:0};
 await fs.mkdir('.local-backups/company-trial-20261014',{recursive:true});await fs.writeFile('.local-backups/company-trial-20261014/integration-acceptance.json',JSON.stringify(evidence,null,2),{mode:0o600});console.log(evidence);

});
