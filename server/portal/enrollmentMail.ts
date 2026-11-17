import {createHash,randomUUID} from 'node:crypto';
import nodemailer from 'nodemailer';
import type {Express,Request,Response} from 'express';
import {pool,tx} from './store.ts';
import {validMutationOrigin} from './accessTransport.ts';
import {invalid} from './trustWorkflow.ts';
import {enrollmentSimulation} from './enrollmentSimulation.ts';
import {validContactEmail} from '../../src/utils/contactEmail.ts';
import {activeEnrollmentMailConfig,enrollmentMailPoolLimit,enrollmentSmtpLimit,mailPoolDailyLimitMax,mailPoolMembers,mailSecretReferencePattern,mailSmtpHostPattern, type EnrollmentMailConfig, type MailAccount} from '../../src/utils/enrollmentMailConfig.ts';
import {mailCredentialKeyConfigured,mailPasswordFingerprint,resolveMailPassword,sealMailPassword,type StoredMailAccount} from './enrollmentMailCredentials.ts';
import {enrollmentMailPreset} from './enrollmentMailPresets.ts';
import {selectMailAccount,type Usage} from './enrollmentMailRouting.ts';

type Client={query:(sql:string,args?:unknown[])=>Promise<{rows:any[]}>};
type RouteReason='paused'|'recipient_blocked'|'shared_window'|'pool_daily_limit'|'binding_pending'|'bound_account'|'no_capacity'|'balanced'|'priority'|'existing';
type State='accepted'|'simulated'|'rejected'|'unknown'|'waiting';
type Mail={subject:string;text:string;html:string;language:string};
const environment=()=>process.env.PORTAL_ENV||'unconfigured';
const timezone=()=>process.env.PORTAL_ENROLLMENT_MAIL_TIMEZONE||'Asia/Jakarta';

const transact=<T>(work:(c:Client)=>Promise<T>):Promise<T>=>tx(work,{isolation:'READ COMMITTED'});

const isLocalMailEnvironment=()=>environment()==='dev'&&process.env.TRIAL_DATASET==='local-crm'&&
  process.env.PORTAL_LOCAL_CUTOVER==='true'&&process.env.PORTAL_DEPLOYMENT!=='remote-dev'&&
  process.env.MYSQL_TRIAL_SOCKET==='/private/tmp/uper-crm-mysql-local3000.sock';

export function enrollmentMailMode(){
  if(process.env.PORTAL_ENROLLMENT_MAIL_TRANSPORT==='smtp'){
    if((environment()==='prod'&&process.env.PORTAL_DEPLOYMENT==='production'||environment()==='test'||isLocalMailEnvironment())&&
      process.env.PORTAL_ENROLLMENT_PUBLIC_ORIGIN)return 'smtp';
    return 'disabled';
  }
  return enrollmentSimulation()?'simulation':'disabled';
}
function permittedRecipient(recipient:string){
  return enrollmentMailMode()==='simulation'||environment()==='prod'||
    (process.env.PORTAL_ENROLLMENT_TEST_RECIPIENTS??'').split(',').map(s=>s.trim().toLowerCase()).includes(recipient);
}
function timeKeys(now:number){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone(),year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=(name:string)=>parts.find(x=>x.type===name)!.value;
  const month=part('year')+'-'+part('month');
  return {day:month+'-'+part('day'),month};
}
async function configuration(c:Client,lock=false){
  const env=environment();
  const preset=enrollmentMailPreset(env);
  if(lock)await c.query(`INSERT INTO enrollment_mail_configuration(environment,revision,config)
    VALUES(:p1,0,:p2) ON DUPLICATE KEY UPDATE environment=environment`,[env,preset]);
  const row=(await c.query(lock?
    'SELECT revision,config FROM enrollment_mail_configuration WHERE environment=:p1 FOR UPDATE':
    'SELECT revision,config FROM enrollment_mail_configuration WHERE environment=:p1',[env])).rows[0];
  const revision=Number(row?.revision??0);
  return {revision,config:revision===0?preset:enrollmentMailPreset(env,row.config)};
}
export async function enrollmentMailEnabled(c:Client){
  return enrollmentMailMode()!=='disabled'&&(await configuration(c)).config.enabled;
}
async function counters(c:Client,now:number,recipient=''){
  const {day,month}=timeKeys(now);
  const usage:Record<string,Usage>=Object.create(null);
  const rows=(await c.query(`SELECT account,
    SUM(day_key=:p2) AS daily,COUNT(DISTINCT IF(day_key=:p2 AND is_external,recipient,NULL)) AS external,
    COUNT(*) AS monthly,MAX(day_key=:p2 AND recipient=:p4) AS seen
    FROM enrollment_mail_attempts WHERE environment=:p1 AND month_key=:p3 AND state<>'rejected'
    GROUP BY account`,[environment(),day,month,recipient])).rows;
  for(const row of rows)usage[row.account]={daily:Number(row.daily),external:Number(row.external),
    monthly:Number(row.monthly),seen:!!Number(row.seen)};
  return {usage,day,month};
}
const isExternal=(recipient:string)=>!(process.env.PORTAL_ENROLLMENT_MAIL_INTERNAL_DOMAINS??'')
  .split(',').map(v=>v.trim().toLowerCase()).includes(recipient.split('@').at(-1)??'');
async function reserve(event:string,recipient:string,urgent:boolean,excluded:Set<string>){
  return transact(async c=>{
    const {config}=await configuration(c,true);
    if(!config.enabled||enrollmentMailMode()==='disabled')return {reason:'paused'} as const;
    if(!permittedRecipient(recipient))return {reason:'recipient_blocked'} as const;
    const prior=(await c.query(`SELECT state,account,started_ms FROM enrollment_mail_attempts
      WHERE environment=:p1 AND event_key=:p2 AND state<>'rejected' LIMIT 1`,[environment(),event])).rows[0];
    if(prior){
      if(prior.state==='reserved'&&Date.now()-Number(prior.started_ms)<120_000)return {reason:'binding_pending'} as const;
      return {prior:prior.state==='reserved'?'unknown':prior.state,previousAccount:prior.account} as const;
    }
    const {rows:[clock]}=await c.query('SELECT FLOOR(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(6))*1000) AS now_ms');
    const now=Number(clock.now_ms);
    const {day,month}=timeKeys(now);
    const selected=config.pools?.find(pool=>pool.id===config.selectedPool);
    if(selected&&selected.dailyLimit!==null){
      const {rows:[used]}=await c.query("SELECT COUNT(*) AS total FROM enrollment_mail_attempts WHERE environment=:p1 AND day_key=:p2 AND pool_id=:p3 AND state<>'rejected'",
        [environment(),day,selected.id]);
      if(Number(used.total)>=selected.dailyLimit)return {reason:'pool_daily_limit'} as const;
    }
    const recent=(await c.query('SELECT COUNT(*) AS total FROM enrollment_mail_attempts WHERE environment=:p1 AND started_ms>:p2',
      [environment(),now-enrollmentSmtpLimit.windowSeconds*1000])).rows[0];
    if(Number(recent.total)>=enrollmentSmtpLimit.rate)return {reason:'shared_window'} as const;
    const bound=config.sticky?(await c.query('SELECT account FROM enrollment_mail_bindings WHERE environment=:p1 AND recipient=:p2',
      [environment(),recipient])).rows[0]?.account:undefined;
    if(config.sticky&&!bound&&(await c.query(`SELECT id FROM enrollment_mail_attempts
      WHERE environment=:p1 AND recipient=:p2 AND state IN ('reserved','unknown') LIMIT 1`,[environment(),recipient])).rows.length)return {reason:'binding_pending'} as const;
    const {usage}=await counters(c,now,recipient);
    const external=isExternal(recipient);
    const members=new Set(mailPoolMembers(config));
    const candidates=config.accounts.filter(a=>a.enabled&&members.has(a.address)&&(!bound||a.address===bound)&&
      !excluded.has(a.address)&&(enrollmentMailMode()==='simulation'||resolveMailPassword(environment(),a)));
    const eligible=new Set<string>();
    for(const window of new Set(candidates.map(a=>a.windowSeconds))){
      const rows=(await c.query('SELECT account,COUNT(*) AS total FROM enrollment_mail_attempts WHERE environment=:p1 AND started_ms>:p2 GROUP BY account',
        [environment(),now-window*1000])).rows;
      const counts=new Map(rows.map(row=>[row.account,Number(row.total)]));
      for(const account of candidates){
        if(account.windowSeconds===window&&(counts.get(account.address)??0)<account.rate)eligible.add(account.address);
      }
    }
    const account=selectMailAccount(config,usage,eligible,{bound,urgent,external});
    if(!account)return {reason:bound?'bound_account':'no_capacity',waitingAccount:bound} as const;
    const id=randomUUID();
    await c.query(`INSERT INTO enrollment_mail_attempts(id,environment,event_key,account,recipient,day_key,month_key,started_ms,is_external,pool_id,state)
      VALUES(:p1,:p2,:p3,:p4,:p5,:p6,:p7,:p8,:p9,:p10,'reserved')`,
      [id,environment(),event,account.address,recipient,day,month,now,external,selected?.id??null]);
    return {id,account,bound,sticky:config.sticky,reason:bound?'bound_account':selected?.strategy??'balanced'} as const;
  });
}

async function deliver(account:StoredMailAccount,id:string,recipient:string,mail:Mail,code?:string):Promise<State|'address_rejected'>{
  const local=enrollmentMailMode()==='simulation'?enrollmentSimulation():null;
  if(local){
    try{
      if(code!==undefined)await local.deliver(id,recipient,code,mail);
      else await local.deliverMessage(id,recipient,mail);
      return 'simulated';
    }catch{return 'unknown';}
  }
  const secret=resolveMailPassword(environment(),account);
  if(!secret||enrollmentMailMode()!=='smtp')return 'rejected';
  try{
    const site=new URL(process.env.PORTAL_ENROLLMENT_PUBLIC_ORIGIN!);
    const hosts=(process.env.PORTAL_ENROLLMENT_SMTP_ALLOWED_HOSTS||'smtp.larksuite.com').split(',').map(v=>v.trim().toLowerCase());
    if((site.protocol!=='https:'&&!(isLocalMailEnvironment()&&site.origin==='http://localhost:3000'))||!hosts.includes(account.host.toLowerCase()))return 'rejected';
    const {origin}=site;
    const transport=nodemailer.createTransport({
      host:account.host,port:account.port,secure:account.port===465,requireTLS:account.port===587,
      auth:{user:account.address,pass:secret},connectionTimeout:10_000,greetingTimeout:10_000,socketTimeout:20_000,
    });
    const result=await transport.sendMail({from:{name:'UPER Admissions',address:account.address},to:recipient,
      subject:mail.subject,
      text:mail.text.replace(/(^|\s)(\/enrollment(?=[/?"\s]|$))/g,(_match,space,link)=>space+origin+link),
      html:mail.html.replace(/(href=["'])(\/enrollment(?=[/?'"]))/g,(_match,attribute,link)=>attribute+origin+link),
      disableFileAccess:true,disableUrlAccess:true});
    return result.accepted.length?'accepted':'rejected';
  }catch(error){
    const e=error as {responseCode?:number;command?:string};
    if(e.command==='RCPT TO'&&e.responseCode&&e.responseCode>=500)return 'address_rejected';
    return e.responseCode&&e.responseCode>=400||e.command==='CONN'||e.command==='AUTH'?'rejected':'unknown';
  }
}
export async function dispatchEnrollmentMail(event:string,recipient:string,mail:Mail,{code,deliveryId=createHash('sha256').update(event).digest('hex')}:{
  code?:string;deliveryId?:string;
}={}):Promise<{state:State;account?:string;reason:RouteReason}>{
  const excluded=new Set<string>();
  let lastRejected:string|undefined;
  for(;;){
    const plan=await reserve(event,recipient,code!==undefined,excluded);
    if(!('id' in plan)&&'reason' in plan){
      if(plan.reason==='recipient_blocked'||lastRejected)return {state:'rejected',account:lastRejected,reason:plan.reason};
      return {state:'waiting',account:'waitingAccount' in plan?plan.waitingAccount:undefined,reason:plan.reason};
    }
    if('prior' in plan)return {state:plan.prior,account:plan.previousAccount,reason:'existing'};
    const {id,account,bound,sticky,reason}=plan;
    const outcome=await deliver(account,deliveryId,recipient,mail,code);
    const state=outcome==='address_rejected'?'rejected':outcome;
    await transact(async c=>{
      await configuration(c,true);
      await c.query('UPDATE enrollment_mail_attempts SET state=:p2 WHERE id=:p1',[id,state]);
      if(sticky&&(state==='accepted'||state==='simulated'))await c.query(`INSERT INTO enrollment_mail_bindings(environment,recipient,account)
        VALUES(:p1,:p2,:p3) ON DUPLICATE KEY UPDATE account=account`,[environment(),recipient,account.address]);
    });
    if(state!=='rejected'||bound||outcome==='address_rejected')return {state,account:account.address,reason};
    lastRejected=account.address;
    excluded.add(account.address);
  }
}

function parseConfig(value:any):Omit<EnrollmentMailConfig,'sticky'>{
  const integer=(x:unknown,min:number,max:number)=>typeof x==='number'&&Number.isInteger(x)&&x>=min&&x<=max;
  if(!value||typeof value.name!=='string'||!value.name.trim()||value.name.length>80||
    typeof value.enabled!=='boolean'||
    !Array.isArray(value.accounts)||value.accounts.length>40)invalid('enrollment_mail_invalid',400);
  const seen=new Set<string>();
  const accounts=value.accounts.map((a:any):MailAccount=>{
    const address=typeof a?.address==='string'?a.address.trim().toLowerCase():'';
    if(!validContactEmail(address)||seen.has(address)||typeof a.host!=='string'||
      !new RegExp('^'+mailSmtpHostPattern+'$').test(a.host)||
      ![465,587].includes(a.port)||
      a.secret!==undefined&&(typeof a.secret!=='string'||a.secret!==''&&!new RegExp('^'+mailSecretReferencePattern+'$').test(a.secret))||
      typeof a.enabled!=='boolean'||!integer(a.daily,1,100000)||!integer(a.external,1,100000)||
      a.monthly!==null&&!integer(a.monthly,1,10000000)||
      !integer(a.rate,1,100000)||!integer(a.windowSeconds,1,3600))invalid('enrollment_mail_invalid',400);
    seen.add(address);
    return {address,host:a.host,port:a.port,secret:a.secret??'',enabled:a.enabled,daily:a.daily,external:a.external,monthly:a.monthly,
      rate:a.rate,windowSeconds:a.windowSeconds};
  });
  const validMembers=(members:any)=>Array.isArray(members)&&members.every(a=>typeof a==='string'&&seen.has(a))&&
    new Set(members).size===members.length;
  const pools=value.pools;
  if(value.members!==undefined&&!validMembers(value.members))invalid('enrollment_mail_invalid',400);
  if(pools!==undefined&&(!Array.isArray(pools)||pools.length<1||pools.length>enrollmentMailPoolLimit||new Set(pools.map(p=>p?.id)).size!==pools.length||
    !pools.some(p=>p?.id===value.selectedPool)||pools.some(p=>!p||typeof p.id!=='string'||!/^[a-z0-9-]{1,40}$/.test(p.id)||
      typeof p.name!=='string'||!p.name.trim()||p.name.length>80||typeof p.enabled!=='boolean'||!validMembers(p.members)||
      p.dailyLimit!==null&&!integer(p.dailyLimit,1,mailPoolDailyLimitMax)||!['balanced','priority'].includes(p.strategy))))invalid('enrollment_mail_invalid',400);
  const config:Omit<EnrollmentMailConfig,'sticky'>={name:value.name.trim(),enabled:value.enabled,accounts,members:value.members};
  if(pools!==undefined){
    config.pools=pools.map((p:any)=>({id:p.id,transport:'smtp',name:p.name.trim(),enabled:p.enabled,members:p.members,
      dailyLimit:p.dailyLimit,strategy:p.strategy}));
    config.selectedPool=value.selectedPool;
  }
  return config;
}

export async function enrollmentMailConfigured(c:Client){
  return (await configuration(c)).revision>0;
}

function mailOperationId(value:unknown){
  if(typeof value!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value))
    invalid('enrollment_mail_invalid',400);
  return 'enrollment-mail:'+value;
}

async function mailOperation<T>(c:Client,actor:string,requestId:unknown,action:string,payload:unknown,apply:()=>Promise<T>):Promise<T>{
  if(requestId===undefined)return apply();
  const operationId=mailOperationId(requestId);
  const fingerprint=createHash('sha256').update(JSON.stringify([environment(),action,payload])).digest('hex');
  const {rows:[saved]}=await c.query('SELECT * FROM access_operations WHERE actor_id=:p1 AND operation_id=:p2',[actor,operationId]);
  if(saved){
    if(saved.fingerprint!==fingerprint)invalid('enrollment_mail_operation_conflict',409);
    return saved.result.body;
  }
  const body=await apply();
  await c.query('INSERT INTO access_operations(actor_id,operation_id,action,fingerprint,result) VALUES(:p1,:p2,:p3,:p4,:p5)',
    [actor,operationId,action,fingerprint,{environment:environment(),body}]);
  return body;
}

export function mountEnrollmentMail(app:Express,{wrap,staff}:{wrap:(handler:(q:Request,r:Response)=>Promise<unknown>)=>any;
    staff:(q:Request,permission:string)=>Promise<{id:string;permissions:string[]}>}){
  const path='/api/admin/enrollment-mail';
  const authorize=async(q:Request)=>{
    const user=await staff(q,'access.read');
    if(!['access.users','access.roles','access.sessions','access.audit'].every(p=>user.permissions.includes(p)))
      invalid('enrollment_mail_forbidden',403);
    return user;
  };
  const view=async()=>{
    const {config,revision}=await configuration(pool);
    const {usage,day}=await counters(pool,Date.now());
    const {rows:poolCounts}=await pool.query("SELECT pool_id,COUNT(*) AS total FROM enrollment_mail_attempts WHERE environment=:p1 AND day_key=:p2 AND pool_id IS NOT NULL AND state<>'rejected' GROUP BY pool_id",
      [environment(),day]);
    const poolUsage=Object.fromEntries(poolCounts.map(row=>[row.pool_id,Number(row.total)]));
    const accounts=config.accounts.map(({encryptedPassword,secret,...account})=>account);
    return {config:{...config,accounts},revision,environment:environment(),mode:enrollmentMailMode(),usage,poolUsage,timezone:timezone(),
      configured:config.accounts.map(a=>({address:a.address,configured:!!resolveMailPassword(environment(),a)}))};
  };
  app.get(path,wrap(async(q,r)=>{
    await authorize(q);
    return r.set('Cache-Control','no-store').json(await view());
  }));
  app.get(path+'/results/:requestId',wrap(async(q,r)=>{
    const actor=await authorize(q);
    const {rows:[saved]}=await pool.query('SELECT * FROM access_operations WHERE actor_id=:p1 AND operation_id=:p2',
      [actor.id,mailOperationId(q.params.requestId)]);
    return r.set('Cache-Control','no-store').json({state:saved?.result.environment===environment()?'committed':'unconfirmed'});
  }));
  app.put(path,wrap(async(q,r)=>{
    const actor=await authorize(q);
    if(!validMutationOrigin(q))invalid('enrollment_origin_rejected',403);
    const edited=parseConfig(q.body?.config);
    const input=q.body?.credential;
    let credential:{address:string;password:string|null}|undefined;
    if(input!==undefined){
      if(!input||typeof input.address!=='string'||!edited.accounts.some(account=>account.address===input.address)||
        !(input.password===null||typeof input.password==='string'&&input.password.length>0&&input.password.length<=1024))
        invalid('enrollment_mail_invalid',400);
      credential={address:input.address,password:input.password};
    }
    if(credential?.password&&!mailCredentialKeyConfigured())invalid('enrollment_mail_credential_key_missing',422);
    const credentialReceipt=credential&&{address:credential.address,change:credential.password===null?'clear':'replace',
      fingerprint:credential.password===null?null:mailPasswordFingerprint(environment(),credential.address,credential.password)};
    const result=await transact(async c=>{
      const before=await configuration(c,true);
      return mailOperation(c,actor.id,q.body?.requestId,'access.enrollment_mail.configured',credentialReceipt?[q.body?.revision,edited,credentialReceipt]:[q.body?.revision,edited],async()=>{
        if(before.revision!==q.body?.revision)invalid('enrollment_mail_conflict',409);
        const accounts=edited.accounts.map((account):StoredMailAccount=>{
          if(credential?.address===account.address){
            if(credential.password===null)return {...account,secret:''};
            return {...account,secret:'',encryptedPassword:sealMailPassword(environment(),account.address,credential.password)};
          }
          const previous=before.config.accounts.find(item=>item.address===account.address);
          return {...account,secret:previous?.secret??'',encryptedPassword:previous?.encryptedPassword};
        });
        const config=activeEnrollmentMailConfig({...edited,accounts,sticky:before.config.sticky});
        const revision=before.revision+1;
        await c.query('UPDATE enrollment_mail_configuration SET config=:p2,revision=revision+1 WHERE environment=:p1',
          [environment(),config]);
        await c.query(`INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'access.enrollment_mail.configured',:p2)`,
          [actor.id,{environment:environment(),revision,enabled:config.enabled,sticky:config.sticky,accounts:config.accounts.length,
            credentialChange:credentialReceipt&&{address:credentialReceipt.address,action:credentialReceipt.change}}]);
        return {revision};
      });
    });
    return r.json(result);
  }));
  app.post(path+'/reassign',wrap(async(q,r)=>{
    const actor=await authorize(q);
    if(!validMutationOrigin(q))invalid('enrollment_origin_rejected',403);
    const recipient=typeof q.body?.recipient==='string'?q.body.recipient.trim().toLowerCase():'';
    const replacement=q.body?.account,reason=typeof q.body?.reason==='string'?q.body.reason.trim():'';
    if(!validContactEmail(recipient)||!reason||reason.length>500)invalid('enrollment_mail_invalid',400);
    const result=await transact(async c=>{
      const {config}=await configuration(c,true);
      return mailOperation(c,actor.id,q.body?.requestId,'access.enrollment_mail.reassigned',[recipient,replacement,reason],async()=>{
        const current=(await c.query('SELECT account FROM enrollment_mail_bindings WHERE environment=:p1 AND recipient=:p2',
          [environment(),recipient])).rows[0]?.account;
        const members=mailPoolMembers(config);
        if(!current||members.includes(current)&&config.accounts.some(a=>a.address===current&&a.enabled)||
          !members.includes(replacement)||!config.accounts.some(a=>a.address===replacement&&a.enabled))invalid('enrollment_mail_reassign_unavailable',409);
        await c.query('UPDATE enrollment_mail_bindings SET account=:p3 WHERE environment=:p1 AND recipient=:p2',
          [environment(),recipient,replacement]);
        await c.query(`INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'access.enrollment_mail.reassigned',:p2)`,
          [actor.id,{environment:environment(),recipient,previousAccount:current,account:replacement,reason}]);
        return {ok:true};
      });
    });
    return r.json(result);
  }));
  app.put('/api/crm/enrollment/mail/pool',wrap(async(q,r)=>{
    const actor=await staff(q,'crm.operations.manage');
    if(!validMutationOrigin(q))invalid('enrollment_origin_rejected',403);
    const selectedPool=q.body?.pool,sticky=q.body?.sticky;
    if(sticky!==undefined&&typeof sticky!=='boolean')invalid('enrollment_mail_invalid',400);
    await transact(async c=>{
      const {config,revision}=await configuration(c,true);
      if(revision!==q.body?.revision)invalid('enrollment_mail_conflict',409);
      if(!config.pools?.some(p=>p.id===selectedPool))invalid('enrollment_mail_invalid',400);
      const next=activeEnrollmentMailConfig({...config,selectedPool,sticky:sticky??config.sticky});
      await c.query('UPDATE enrollment_mail_configuration SET config=:p2,revision=revision+1 WHERE environment=:p1',
        [environment(),next]);
      await c.query(`INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'access.enrollment_mail.pool_selected',:p2)`,
        [actor.id,{environment:environment(),previousPool:config.selectedPool,pool:selectedPool,previousSticky:config.sticky,sticky:next.sticky}]);
    });
    return r.json({ok:true});
  }));
  app.get('/api/crm/enrollment/mail',wrap(async(q,r)=>{
    await staff(q,'crm.operations.manage');
    const {config,revision}=await configuration(pool);
    const rows=(await pool.query(`SELECT n.event_key AS id,n.subject_id AS recordId,n.kind,n.state,
      n.payload->>'$.subject' AS subject,NULLIF(n.payload->>'$.sender','null') AS sender,
      n.payload->>'$.routeReason' AS routeReason,
      DATE_FORMAT(n.recorded_at,'%Y-%m-%dT%H:%i:%sZ') AS recordedAt
      FROM enrollment_notification_receipts n WHERE n.channel='email' AND n.kind NOT IN ('otp_apply','otp_mine')
      ORDER BY n.recorded_at DESC,n.event_key DESC LIMIT 100`)).rows;
    return r.set('Cache-Control','no-store').json({name:config.name,enabled:config.enabled,sticky:config.sticky,mode:enrollmentMailMode(),rows,revision,selectedPool:config.selectedPool,
      pools:config.pools?.map(({id,name,enabled})=>({id,name,enabled}))});
  }));
}

// The business event and its pending email are inserted in the same transaction.
// Only newly queued records are considered, so historical simulated rows are never replayed.
export function startEnrollmentMail(){
  if(enrollmentMailMode()==='disabled'||enrollmentMailMode()==='smtp'&&process.env.PORTAL_WORKER_ENABLED==='false')return;
  let active=false;
  const tick=async()=>{
    if(active)return;
    active=true;
    try{
      if(!await enrollmentMailEnabled(pool))return;
      const {restoreState}=await import('./accessRecoveryState.ts');
      if((await restoreState())?.required)return;
      const {rows}=await pool.query(`SELECT event_key,payload FROM enrollment_notification_receipts
        WHERE channel='email' AND state='queued' AND payload->>'$.environment'=:p1
        AND COALESCE(CAST(payload->>'$.retryAfter' AS UNSIGNED),0)<=:p2
        ORDER BY recorded_at,event_key LIMIT 40`,[environment(),Date.now()]);
      for(const row of rows){
        const payload=row.payload;
        const {state,account,reason}=await dispatchEnrollmentMail(row.event_key,payload.recipient,payload,{deliveryId:payload.deliveryId});
        const next=state==='waiting'?'queued':state==='rejected'?'failed':state;
        // Delay blocked mail so later recipients can use other accounts.
        await pool.query(`UPDATE enrollment_notification_receipts SET state=:p2,payload=:p3
          WHERE event_key=:p1 AND state='queued'`,[row.event_key,next,
          {...payload,sender:account??null,routeReason:reason,retryAfter:state==='waiting'?Date.now()+15_000:0}]);
      }
    }catch{console.error('Enrollment mail queue could not be processed');}
    finally{active=false;}
  };
  const timer=setInterval(()=>void tick(),3000);
  timer.unref();
}
