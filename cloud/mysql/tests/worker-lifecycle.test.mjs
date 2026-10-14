import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import fs from 'node:fs/promises';import test from 'node:test';import {randomUUID} from 'node:crypto';import {openTrialDatabase,transaction} from '../database.mjs';import {migrate} from '../migrate.mjs';
test('two real MySQL worker processes recover leases without duplicate inbox or unknown Lark resend',{skip:!process.env.MYSQL_WORKER_TEST,timeout:30000},async()=>{
const root=new URL('../../../',import.meta.url);
const env={...process.env,PORTAL_DATABASE_DRIVER:'mysql',PLATFORM_MODE:'local',PORTAL_NOTIFICATION_MODE:'simulation',PORT:'4412'};for(const key of ['DATABASE_URL','LARK_GROUP_CRM'])delete env[key];
const db=await openTrialDatabase(env);const ids={event:randomUUID(),rule:randomUUID(),inapp:randomUUID(),lark:randomUUID(),simulated:randomUUID(),cancelled:randomUUID(),heldEvent:randomUUID(),heldJob:randomUUID(),heldTask:randomUUID(),heldLead:randomUUID()};
await migrate(db,new URL(env.MYSQL_TRIAL_URL).pathname.slice(1));
const {defaults}=await import('../../../server/portal/policy.ts');
const rule={...defaults,event:'TEST.lifecycle',group:'TEST_LIFECYCLE',businessOnly:false,workHours:false,timing:'immediate',dedupeMinutes:0,language:'en',channels:['inapp','lark'],retries:[]};
await transaction(db,async c=>{
 await c.execute("INSERT INTO portal_leads(id,business_number,profile) VALUES(?,?,?)",[ids.heldLead,'20991231-'+BigInt('0x'+ids.heldLead.replaceAll('-','').slice(0,12)),JSON.stringify({id:ids.heldLead,fullName:'TEST migration hold',owner:'Robert',tier:'Hot',currentStage:'New'})]);
 await c.execute("INSERT INTO followup_tasks(id,lead_id,kind,status,due_at) VALUES(?,?,'TEST_hold','open','2000-01-01')",[ids.heldTask,ids.heldLead]);
 await c.execute("INSERT INTO outbox(id,type,payload) VALUES(?,'TEST.legacy','{}')",[ids.heldEvent]);
 await c.execute("INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,state,due_at,snapshot) VALUES(?,?,?,1,'inapp','Robert','pending','2000-01-01',?)",[ids.heldJob,ids.heldEvent,ids.rule,JSON.stringify({rule:{event:'TEST.legacy'},payload:{}})]);
 for(const [kind,id] of [['task',ids.heldTask],['event',ids.heldEvent],['job',ids.heldJob]])await c.execute('INSERT INTO notification_migration_holds(kind,id,reason) VALUES(?,?,?)',[kind,id,'TEST migration no replay']);

 const [live]=await c.query("SELECT id FROM notification_channels WHERE config->>'$.mode'<>'simulation'");assert.equal(live.length,0,'Do not run worker with live channel');
 await c.execute('INSERT INTO notification_channels(id,config) VALUES(?,?) ON DUPLICATE KEY UPDATE config=?',[rule.group,JSON.stringify({groupName:'TEST lifecycle',mode:'simulation',maxPerHour:10080}),JSON.stringify({groupName:'TEST lifecycle',mode:'simulation',maxPerHour:10080})]);
 await c.execute("INSERT INTO outbox(id,type,payload,created_at,processed_at) VALUES(?,'TEST.lifecycle','{}',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",[ids.event]);
 for(const [id,channel,state] of [[ids.inapp,'inapp','sending'],[ids.lark,'lark','sending'],[ids.simulated,'lark','pending'],[ids.cancelled,'inapp','cancelled']]){
  await c.execute("INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,state,due_at,lease_until,snapshot) VALUES(?,?,?,1,?,?,?,'2000-01-01','2000-01-01',?)",[id,ids.event,ids.rule+id,channel,channel==='inapp'?'Robert':rule.group,state,JSON.stringify({rule,event:rule.event,leadId:null,payload:{test:true}})]);
 }
});
const children=[];
async function worker(){const child=spawn(process.execPath,['scripts/mysql-worker.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});children.push(child);let error='';child.stderr.on('data',c=>{error+=c;});await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Worker start timeout: '+error.slice(0,300))),10000);child.stdout.on('data',c=>{if(c.toString().includes('mysqlWorkerReady')){clearTimeout(timeout);resolve();}});child.once('exit',()=>{clearTimeout(timeout);reject(Error('Worker exited before ready: '+error.slice(0,300)));});});return child;}
async function stop(child){if(child.exitCode!==null)return;const stopped=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Worker graceful shutdown timeout'));},10000);child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Worker shutdown failed'));});});child.kill('SIGTERM');await stopped;}
async function waitState(){for(let i=0;i<50;i++){const [rows]=await db.execute('SELECT id,state FROM notification_jobs WHERE event_id=?',[ids.event]);const states=Object.fromEntries(rows.map(r=>[r.id,r.state]));if(states[ids.inapp]==='accepted'&&states[ids.simulated]==='simulated')return states;await new Promise(r=>setTimeout(r,200));}throw Error('Notification delivery timeout');}
try{
 const first=await worker();await stop(first); // Persisted leases survive process restart.
 const a=await worker(),b=await worker();const states=await waitState();assert.equal(states[ids.lark],'unknown');assert.equal(states[ids.cancelled],'cancelled');
 await Promise.all([stop(a),stop(b)]);
 const [inbox]=await db.execute('SELECT id FROM notification_inbox WHERE id=?',[ids.inapp]);assert.equal(inbox.length,1);
 const c=await worker();await new Promise(r=>setTimeout(r,1500));await stop(c);
 const [after]=await db.execute('SELECT id,state,attempts FROM notification_jobs WHERE event_id=?',[ids.event]);assert.equal(after.find(r=>r.id===ids.lark).state,'unknown');assert.equal(after.find(r=>r.id===ids.cancelled).state,'cancelled');assert.equal(after.find(r=>r.id===ids.inapp).attempts,1);
 const [heldEvent]=await db.execute('SELECT processed_at FROM outbox WHERE id=?',[ids.heldEvent]);assert.equal(heldEvent[0].processed_at,null);
 const [heldJob]=await db.execute('SELECT state,attempts FROM notification_jobs WHERE id=?',[ids.heldJob]);assert.equal(heldJob[0].state,'pending');assert.equal(heldJob[0].attempts,0);
 const [heldTask]=await db.execute('SELECT status,due_at FROM followup_tasks WHERE id=?',[ids.heldTask]);assert.equal(heldTask[0].status,'open');assert.ok(heldTask[0].due_at.startsWith('2000-01-01'));
 const evidence={historicalEventsJobsAndOverdueTasksNotReplayed:true,persistentLeasesRecovered:true,twoWorkerProcesses:true,inappOneRecord:true,simulationSent:true,larkUnknownNotRetried:true,cancelledNotSent:true,gracefulShutdown:true,realLarkCalls:0,ids};console.log(evidence);
}finally{await Promise.all(children.filter(c=>c.exitCode===null).map(stop));await db.end();}

});
