import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {openTrialDatabase} from '../../cloud/mysql/database.mjs';
import {backup,restore} from '../../cloud/mysql/backup.mjs';

/** Called only from the self-contained TLS MySQL fixture, never a configured business database. */
export async function exerciseCompanyRecovery({t,env,dir,db,client,restart,stopApp,createRestoreTarget}:any){
 let completed=0;const stage=async(name:string,fn:()=>Promise<void>)=>t.test(name,async()=>{await fn();completed++;});
 const compiled=path.resolve('.local-backups/company-trial-20261014/package/runtime/cloud/mysql/access-recovery.mjs');
 const recovery=await import(pathToFileURL(compiled).href);
 const maintenance={...env,ACCESS_RECOVERY_MAINTENANCE:'true',PORTAL_WORKER_ENABLED:'false',MYSQL_BIN_DIRECTORY:process.env.MYSQL_BIN_DIRECTORY};
 const op=(b:any)=>({...b,operationId:crypto.randomUUID()});
 const login=async(id:string,password:string)=>{const c=client();const r=await c.call('/api/crm/auth/login',{loginId:id,password});assert.equal(r.status,200,JSON.stringify(r.data));return c;};
 const passwords=JSON.parse(await fs.readFile(env.ACCESS_INITIAL_PASSWORDS_FILE,'utf8'));
 let admin=await login('Robert',passwords.Robert);
 const ethanBefore=(await db.execute("SELECT roles,password_hash FROM crm_users WHERE id='Ethan'"))[0][0];
 const ethan=(await admin.call('/api/admin/access')).data.users.find((u:any)=>u.id==='Ethan');
 assert.equal((await admin.call('/api/admin/access/users/Ethan',op({...ethan,roles:[...ethan.roles,'access_admin'],reason:'TEST explicit second administrator'}))).status,200);
 const ethanAfter=(await db.execute("SELECT roles,password_hash FROM crm_users WHERE id='Ethan'"))[0][0];
 assert.equal(ethanAfter.password_hash,ethanBefore.password_hash);
 assert.deepEqual(ethanAfter.roles.filter((r:string)=>r!=='access_admin'),ethanBefore.roles);
 await db.query("UPDATE notification_channels SET config=JSON_SET(config,'$.mode','simulation')");
 const checkpoint=path.join(dir,'trusted-checkpoint.json');const checkpointInfo=await recovery.securityCheckpoint(maintenance,checkpoint);
 const authorize=async(c:any,extra:any={})=>{
  const body=op({userId:'Ethan',enableAccount:false,restoreSystemAccess:false,reason:'TEST approved company maintenance',...extra});
  const r=await c.call('/api/admin/access/recovery/authorize',body);assert.equal(r.status,200,JSON.stringify(r.data));
  const file=path.join(dir,body.operationId+'.permit.json');await fs.writeFile(file,JSON.stringify(r.data.authorization),{mode:0o600});
  return {id:body.operationId,input:{userId:'Ethan',authorizationFile:file,recordFile:path.join(dir,body.operationId+'.receipt.json'),servicesStopped:true,reason:'TEST company offline recovery'}};
 };
 const a=await authorize(admin);
 await stage('company recovery requires explicit maintenance, signed scope and application exclusion',async()=>{
  await assert.rejects(recovery.recoveryPreview(env,a.input),/maintenance/);
  await assert.rejects(recovery.recoveryPreview({...maintenance,APP_ENV:'test'},a.input),/production/);
  await assert.rejects(recovery.recoveryPreview({...maintenance,PORTAL_WORKER_ENABLED:'true'},a.input),/paused/);
  await assert.rejects(recovery.recoveryPreview(maintenance,{...a.input,enable:true}),/scope/);
  const pre=await recovery.recoveryPreview(maintenance,a.input);
  await assert.rejects(recovery.recoverAdministrator(maintenance,{...a.input,confirmation:pre.confirmation,servicesStopped:false},'TEST-Recovery-strong-2026'),/stopped/);
  await assert.rejects(recovery.recoverAdministrator(maintenance,{...a.input,confirmation:pre.confirmation},'TEST-Recovery-strong-2026'),/busy|running/);
  assert.equal((await recovery.queryRecoveryResult(maintenance,a.id)).state,'unconfirmed');
 });
 const jobSnapshot=async(database:any)=>({leads:(await database.query('SELECT * FROM portal_leads ORDER BY id'))[0],jobs:(await database.query('SELECT * FROM notification_jobs ORDER BY id'))[0],tasks:(await database.query('SELECT * FROM followup_tasks ORDER BY id'))[0],events:(await database.query('SELECT * FROM outbox ORDER BY id'))[0]});
 let ordinaryId:string;
 await stage('ordinary company recovery installs a review gate, invalidates sessions and retains business records',async()=>{
  const before=await jobSnapshot(db);
  await stopApp();
  const pre=await recovery.recoveryPreview(maintenance,a.input);
  const password='TEST-Ethan-company-recovered-2026';
  const userBefore=(await db.query("SELECT password_hash FROM crm_users WHERE id='Ethan'"))[0][0];
  const holdsBefore=(await db.query('SELECT * FROM notification_migration_holds ORDER BY kind,id'))[0];
  await assert.rejects(recovery.recoverAdministrator(maintenance,{...a.input,confirmation:pre.confirmation,recordFile:path.join(dir,'missing','receipt.json')},password));
  assert.equal((await db.query("SELECT password_hash FROM crm_users WHERE id='Ethan'"))[0][0].password_hash,userBefore.password_hash);
  assert.deepEqual((await db.query('SELECT * FROM notification_migration_holds ORDER BY kind,id'))[0],holdsBefore);
  assert.equal((await recovery.queryRecoveryResult(maintenance,a.id)).state,'unconfirmed');
  const result=await recovery.recoverAdministrator(maintenance,{...a.input,confirmation:pre.confirmation},password);ordinaryId=result.id;
  assert.ok(result.restoreId);
  assert.equal((await recovery.queryRecoveryResult(maintenance,a.id)).state,'committed');
  assert.deepEqual(await jobSnapshot(db),before);
  const [sessions]=await db.query('SELECT * FROM crm_sessions');assert.equal(sessions.length,0);
  const repeated=await recovery.recoverAdministrator(maintenance,{...a.input,confirmation:pre.confirmation},password);assert.equal(repeated.replayed,true);
  const [audits]=await db.execute("SELECT id FROM portal_audit WHERE action='access.recovery' AND data->>'$.id'=?",[a.id]);assert.equal(audits.length,1);
  const privateEnv=path.join(dir,'maintenance.env');const dotenv=(await import('dotenv')).default;
  await fs.writeFile(privateEnv,Object.entries(maintenance).filter(([,v])=>v!==undefined).map(([k,v])=>`${k}=${JSON.stringify(String(v))}`).join('\n'),{mode:0o600});
  // Actual compiled CLI result query, using a private explicit env; no password or signature in output.
  const cli=execFileSync(process.execPath,[compiled,'--env',privateEnv,'--result',a.id],{encoding:'utf8'});
  assert.match(cli,/committed/);assert.ok(!cli.includes(password)&&!cli.includes(maintenance.ACCESS_OPERATION_KEY));
  await restart({...env,PORTAL_WORKER_ENABLED:'true'});
  const old=await admin.call('/api/admin/access');assert.equal(old.status,401);
  assert.equal((await client().call('/api/crm/auth/login',{loginId:'Robert',password:passwords.Robert})).status,423);
  admin=await login('Ethan',password);
  const health=await client().call('/api/health');assert.equal(health.status,200);assert.equal(health.data.businessReady,false);
  assert.equal((await admin.call('/api/crm/leads')).status,423);
  await reviewAndRelease(admin,password,'TEST-normal-review');
  const stale=await admin.call('/api/admin/access');assert.equal(stale.status,401);
  admin=await login('Robert','TEST-normal-review-Robert-2026');
  await new Promise(r=>setTimeout(r,1300));
  assert.deepEqual(await jobSnapshot(db),before);
  await restart({...env,PORTAL_WORKER_ENABLED:'true'});await new Promise(r=>setTimeout(r,1300));assert.deepEqual(await jobSnapshot(db),before);
 });
 async function reviewAndRelease(c:any,ethanPassword:string,prefix:string){
  let state=(await c.call('/api/admin/access/restore')).data;
  const reason='TEST verify independent authorizations';
  const eligible=(await c.call('/api/admin/access')).data.users.find((u:any)=>u.id==='Ethan');
  assert.equal((await c.call('/api/admin/access/users/Ethan',op({...eligible,roles:eligible.roles.filter((r:string)=>r!=='access_admin'),reason}))).data.error,'access_restore_recovery_administrator');
  assert.equal((await c.call('/api/admin/access/restore/release',op({restoreId:state.restoreId,reason}))).status,409);
  assert.equal((await c.call('/api/admin/access/restore/review',op({restoreId:state.restoreId,userId:'Ethan',authorizationStamp:'stale',confirmAuthorization:true,reason}))).status,409);
  for(const u of (await c.call('/api/admin/access')).data.users){
   if(u.active&&u.id!=='Ethan')assert.equal((await c.call('/api/admin/access/users/'+u.id+'/password',op({revision:u.revision,temporaryPassword:`${prefix}-${u.id}-2026`,reason}))).status,200);
   state=(await c.call('/api/admin/access/restore')).data;
   assert.equal((await c.call('/api/admin/access/restore/review',op({restoreId:state.restoreId,userId:u.id,authorizationStamp:state.users.find((x:any)=>x.id===u.id).authorizationStamp,confirmAuthorization:true,reason}))).status,200);
  }
  // A second complete administrator is a release condition, not an inferred role label.
  let robert=(await c.call('/api/admin/access')).data.users.find((u:any)=>u.id==='Robert');
  assert.equal((await c.call('/api/admin/access/users/Robert',op({...robert,roles:robert.roles.filter((v:string)=>v!=='access_admin'),reason}))).status,200);
  state=(await c.call('/api/admin/access/restore')).data;
  assert.equal((await c.call('/api/admin/access/restore/review',op({restoreId:state.restoreId,userId:'Robert',authorizationStamp:state.users.find((u:any)=>u.id==='Robert').authorizationStamp,confirmAuthorization:true,reason}))).status,200);
  assert.equal((await c.call('/api/admin/access/restore/release',op({restoreId:state.restoreId,reason}))).data.error,'access_restore_two_administrators');
  robert=(await c.call('/api/admin/access')).data.users.find((u:any)=>u.id==='Robert');
  assert.equal((await c.call('/api/admin/access/users/Robert',op({...robert,roles:[...robert.roles,'access_admin'],reason}))).status,200);
  state=(await c.call('/api/admin/access/restore')).data;
  assert.equal((await c.call('/api/admin/access/restore/review',op({restoreId:state.restoreId,userId:'Robert',authorizationStamp:state.users.find((u:any)=>u.id==='Robert').authorizationStamp,confirmAuthorization:true,reason}))).status,200);
  assert.equal((await c.call('/api/admin/access/restore/release',op({restoreId:state.restoreId,reason}))).data.released,true);
 }
 await stage('restore to isolated TLS database, recover Ethan, release and restart without replaying history',async()=>{
  const target=await createRestoreTarget();const targetEnv={...maintenance,MYSQL_TRIAL_URL:target};
  const file=path.join(dir,'company-recovery-backup.sql'),saved=await backup(maintenance,file);
  const a=await authorize(admin,{targetDatabase:new URL(target).pathname.slice(1),backupSha256:saved.sha256});
  await assert.rejects(restore(targetEnv,file,saved.sha256),/stopped/);
  await restore(targetEnv,file,saved.sha256,{servicesStopped:true});
  assert.equal((await recovery.queryRecoveryResult(targetEnv,ordinaryId)).state,'historical');
  const targetDb=await openTrialDatabase(targetEnv);
  try{
   const before=await jobSnapshot(targetDb),holds=(await targetDb.query('SELECT * FROM notification_migration_holds ORDER BY kind,id'))[0];
   assert.ok(holds.some((h:any)=>h.kind==='event')&&holds.some((h:any)=>h.kind==='job')&&holds.some((h:any)=>h.kind==='task'));
   const preview=await recovery.recoveryPreview(targetEnv,a.input);
   const result=await recovery.recoverAdministrator(targetEnv,{...a.input,confirmation:preview.confirmation},'TEST-Ethan-restore-company-2026');
   assert.equal((await recovery.queryRecoveryResult(targetEnv,result.id)).state,'committed');
   await restart({...env,MYSQL_TRIAL_URL:target,PORTAL_WORKER_ENABLED:'true'});
   const c=await login('Ethan','TEST-Ethan-restore-company-2026');assert.equal((await c.call('/api/crm/leads')).status,423);
   assert.equal((await client().call('/api/health')).data.reviewRequired,true);
   assert.equal((await c.call('/api/crm/auth/operations/'+result.id+'?actor=offline-recovery')).data.state,'committed');
   await reviewAndRelease(c,'TEST-Ethan-restore-company-2026','TEST-restored-review');
   const again=await login('Robert','TEST-restored-review-Robert-2026');assert.equal((await again.call('/api/crm/leads')).status,200);
   await new Promise(r=>setTimeout(r,1300));assert.deepEqual(await jobSnapshot(targetDb),before);
   await restart({...env,MYSQL_TRIAL_URL:target,PORTAL_WORKER_ENABLED:'true'});await new Promise(r=>setTimeout(r,1300));assert.deepEqual(await jobSnapshot(targetDb),before);
   assert.deepEqual((await targetDb.query('SELECT * FROM notification_migration_holds ORDER BY kind,id'))[0],holds);
   // New business events must still work after release; no historical blanket un-hold.
   const {defaults}=await import('../../server/portal/policy.ts');
   const rule={...defaults,event:'lead.created',channels:['inapp'],recipient:'owner',businessOnly:false,calendarMode:'custom',dedupeMinutes:0};
   await targetDb.execute('INSERT INTO notification_rules(id,version,config,enabled) VALUES(?,1,?,true)',['TEST.company.recovery.new',JSON.stringify(rule)]);
   const fresh=client();await fresh.call('/api/portal/conversations',{source:'standalone_chat'});const reg=await fresh.call('/api/portal/register',{fullName:'TEST After Recovery Learner',phone:'000775544',email:'after-recovery@example.invalid'});assert.equal(reg.status,200);
   let found=false;for(let i=0;i<60;i++){const [inbox]=await targetDb.execute("SELECT i.id FROM notification_inbox i JOIN notification_jobs j ON j.id=i.id JOIN outbox o ON o.id=j.event_id WHERE o.lead_id=?",[reg.data.lead.id]);if(inbox.length){found=true;break;}await new Promise(r=>setTimeout(r,100));}assert.equal(found,true,'new event delivered within 6 seconds');
   const oldIds=before.jobs.map((j:any)=>j.id);const after=await jobSnapshot(targetDb);assert.deepEqual(after.jobs.filter((j:any)=>oldIds.includes(j.id)),before.jobs);
  }finally{await targetDb.end();}
 });
 await stage('emergency company approval requires independent trusted evidence and does not promote a sales account',async()=>{
  // The source app is no longer running (the child now uses the restored target).
  const input={userId:'Ethan',approvedBy:'TEST incident approver',approvalReference:'TEST-INCIDENT-2026',reason:'TEST emergency with independent custody',authorizationId:crypto.randomUUID(),checkpointFile:checkpoint,checkpointSha256:checkpointInfo.sha256,authorizationFile:path.join(dir,'emergency-company.json'),servicesStopped:true};
  const pre=await recovery.emergencyAuthorizationPreview(maintenance,input);
  await assert.rejects(recovery.emergencyAuthorizationPreview(maintenance,{...input,userId:'Fadhil'}),/administrator|checkpoint/);
  await assert.rejects(recovery.emergencyAuthorizationPreview(maintenance,{...input,checkpointSha256:'0'.repeat(64)}),/checksum|trusted/);
  assert.equal((await recovery.prepareEmergencyAuthorization(maintenance,{...input,confirmation:pre.confirmation})).state,'authorized');
  assert.equal((await recovery.queryEmergencyAuthorization(maintenance,input.authorizationId)).state,'authorized');
 });
 assert.equal(completed,4,'all company recovery stages must complete before acceptance evidence');
 return {companyRecovery:true,maintenanceExclusion:true,ordinaryRecoveryGate:true,atomicRollback:true,restoreAndRelease:true,twoAdministratorsRequired:true,queryAndRetry:true,historicalNotificationsNotReplayed:true,newNotificationsAfterRelease:true,compiledCli:true,emergencyEvidence:true,realExternalCalls:0};
}
