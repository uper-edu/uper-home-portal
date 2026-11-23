import {isAiAdministrator} from '../../src/utils/aiServicePolicy.ts';
import {integrationCredential} from './integrationCredentials.ts';
import {hasConfiguredEnrollmentBank,readEnrollmentBank} from './enrollmentBank.ts';
import {smtpTransportOptions,smtpCredentialTarget} from './integrationCredentialTargets.ts';
import {enrollmentOrderEmailPath, portalPublicOrigin, renderEnrollmentEmail} from './enrollmentEmail.ts';
import {createHash,randomUUID} from 'node:crypto';
import nodemailer from 'nodemailer';
import type {Express,Request,Response} from 'express';
import {pool,tx} from './store.ts';
import {validMutationOrigin} from './accessTransport.ts';
import {invalid} from './trustWorkflow.ts';
import {enrollmentSimulation,isLocalEnrollmentRuntime} from './enrollmentSimulation.ts';
import {validContactEmail} from '../../src/utils/contactEmail.ts';
import {activeEnrollmentMailConfig,enrollmentMailPoolLimit,enrollmentSmtpLimit,isMailPoolStrategy,mailPoolDailyLimitMax,mailPoolMembers,mailSecretReferencePattern,mailSmtpEndpoint,mailSmtpHostPattern, type EnrollmentMailConfig, type MailAccount, type MailPoolStrategy} from '../../src/utils/enrollmentMailConfig.ts';
import {mailCredentialKeyConfigured,mailPasswordFingerprint,resolveMailPassword,sealMailPassword,type StoredMailAccount} from './enrollmentMailCredentials.ts';
import {enrollmentMailPreset} from './enrollmentMailPresets.ts';
import {mailPoolQuotaReason,selectMailAccount,type Usage} from './enrollmentMailRouting.ts';
import {enrollmentInterestStillAvailable} from './enrollmentInterestDelivery.ts';
import {smtpRecipientPolicy} from './enrollmentMailRecipientPolicy.ts';
import {isEnrollmentMailMode,matchesEnrollmentMailDelivery,type EnrollmentMailMode,type EnrollmentMailDelivery} from '../../src/utils/enrollmentMailMode.ts';
import {enrollmentServicePolicy} from './enrollmentRuntime.ts';
import type {Employee} from './identity.ts';
import {portalWorkerEnabled} from '../environment.mjs';
import {log} from '../logger.ts';

type Client={query:(sql:string,args?:unknown[])=>Promise<{rows:any[]}>};
type RouteReason='paused'|'invalid_recipient'|'shared_window'|'pool_daily_limit'|'pool_daily_recipient_limit'|'binding_pending'|'bound_account'|'no_capacity'|MailPoolStrategy|'existing'|'interest_no_longer_available';
type State='accepted'|'simulated'|'rejected'|'unknown'|'waiting'|'cancelled';
type Mail={subject:string;text:string;html:string;language:string};
const environment=()=>process.env.PORTAL_ENV||'unconfigured';
const timezone=()=>process.env.PORTAL_ENROLLMENT_MAIL_TIMEZONE||'Asia/Jakarta';
const mailPollStaleMs=120_000;
let mailPollStartedAt:number|undefined;
let mailPollProgressAt:number|undefined;
let mailPollFailed=false;

const transact=<T>(work:(c:Client)=>Promise<T>):Promise<T>=>tx(work,{isolation:'READ COMMITTED'});

const smtpDeployment = () => (environment()==='prod'&&process.env.PORTAL_DEPLOYMENT==='production')||
  environment()==='test'||isLocalEnrollmentRuntime();

// Import the previous deployment setting once, before accepting requests.
function legacyDeliveryMode():EnrollmentMailMode {
  const legacy=process.env.UPER_PORTAL_ENROLLMENT_MAIL_TRANSPORT??process.env.PORTAL_ENROLLMENT_MAIL_TRANSPORT;
  if(legacy==='smtp')return smtpDeployment()&&portalPublicOrigin()?'smtp':'disabled';
  return (legacy==='simulation'||!legacy&&isLocalEnrollmentRuntime())&&enrollmentSimulation()?'simulation':'disabled';
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
  const candidate=row?.config?.delivery;
  const delivery:EnrollmentMailDelivery=isEnrollmentMailMode(candidate?.mode)&&typeof candidate?.generation==='string'
    ?candidate:{mode:'disabled',generation:''};
  return {revision,delivery,storedConfig:row?.config,config:revision===0?preset:enrollmentMailPreset(env,row.config)};
}

export async function initializeEnrollmentMailDelivery(){
  await transact(async c=>{
    const {storedConfig,delivery}=await configuration(c,true);
    if(delivery.generation)return;
    await c.query('UPDATE enrollment_mail_configuration SET config=:p2 WHERE environment=:p1',
      [environment(),{...storedConfig,delivery:{mode:legacyDeliveryMode(),generation:randomUUID()}}]);
  });
}

export async function enrollmentMailDelivery(c:Client=pool){
  return (await enrollmentMailDeliveryState(c)).delivery;
}

export async function enrollmentMailDeliveryState(c:Client){
  const {delivery,revision}=await configuration(c);
  return {delivery,configured:revision>0};
}

export function enrollmentMailbox(mode:EnrollmentMailMode){
  return mode==='simulation'?enrollmentSimulation():null;
}
export async function configuredSmtpAccount(c:Client,address:string,lock=false){
  const {config}=await configuration(c,lock);
  return config.accounts.find(account=>account.address===address);
}
function smtpPassword(account:StoredMailAccount,c?:Client){
  return integrationCredential('smtp',account.address,smtpCredentialTarget(account),()=>{
    const password=resolveMailPassword(environment(),account);
    return password?{password}:undefined;
  },c).then(value=>value?.password);
}

function smtpRuntimeReasons(){
  const reasons:string[]=[];
  if(!smtpDeployment()||!portalPublicOrigin())reasons.push('smtp_origin_required');
  if(!portalWorkerEnabled())reasons.push('mail_worker_required');
  return reasons;
}

async function smtpPoolReasons(c:Client,{config,revision}:Awaited<ReturnType<typeof configuration>>){
  if(!revision||!config.enabled)return ['mail_pool_required'];
  const members=new Set(mailPoolMembers(config));
  for(const account of config.accounts){
    if(account.enabled&&members.has(account.address)&&mailSmtpEndpoint(account)&&await smtpPassword(account,c))return [];
  }
  return ['mail_sender_required'];
}

async function deliveryReadiness(c:Client,saved:Awaited<ReturnType<typeof configuration>>){
  const {mode}=saved.delivery;
  if(mode==='disabled')return ['delivery_disabled'];
  if(mode==='simulation')return enrollmentMailbox(mode)?[]:['simulation_mailbox_required'];
  const reasons=[...smtpRuntimeReasons(),...await smtpPoolReasons(c,saved)];
  if(!reasons.length && mailPollStartedAt!==undefined &&
    (mailPollFailed || Date.now()-(mailPollProgressAt??mailPollStartedAt)>mailPollStaleMs))reasons.push('mail_worker_unhealthy');
  return reasons;
}

export async function enrollmentMailReadiness(c:Client){
  const saved=await configuration(c);
  return {
    mode:saved.delivery.mode,
    smtpReady:async()=>saved.delivery.mode==='smtp'&&!smtpRuntimeReasons().length&&!(await smtpPoolReasons(c,saved)).length,
  };
}
async function counters(c:Client,now:number,recipient=''){
  const {day,month}=timeKeys(now);
  const usage:Record<string,Usage>=Object.create(null);
  const rows=(await c.query(`SELECT account,
    SUM(day_key=:p2) AS daily,COUNT(DISTINCT IF(day_key=:p2 AND is_external,LOWER(TRIM(recipient)),NULL)) AS external,
    COUNT(*) AS monthly,COUNT(DISTINCT IF(day_key=:p2,LOWER(TRIM(recipient)),NULL)) AS recipients,
    MAX(day_key=:p2 AND LOWER(TRIM(recipient))=LOWER(TRIM(:p4))) AS seen
    FROM enrollment_mail_attempts WHERE environment=:p1 AND month_key=:p3 AND state<>'rejected'
    GROUP BY account`,[environment(),day,month,recipient])).rows;
  for(const row of rows)usage[row.account]={daily:Number(row.daily),external:Number(row.external),
    monthly:Number(row.monthly),recipients:Number(row.recipients),seen:!!Number(row.seen)};
  return {usage,day,month};
}
const isExternal=(recipient:string)=>!(process.env.PORTAL_ENROLLMENT_MAIL_INTERNAL_DOMAINS??'')
  .split(',').map(v=>v.trim().toLowerCase()).includes(recipient.split('@').at(-1)??'');
async function reserve(event:string,recipient:string,urgent:boolean,excluded:Set<string>,queueKey?:string,expected?:EnrollmentMailDelivery){
  return transact(async c=>{
    const {config,delivery}=await configuration(c,true);
    const [queued]=queueKey?(await c.query(`SELECT kind,subject_id,payload FROM enrollment_notification_receipts
      WHERE event_key=:p1 AND state='queued'`,[queueKey])).rows:[];
    if(queueKey&&(!queued||!matchesEnrollmentMailDelivery(queued.payload?.delivery,delivery)||
      (queued.payload?.delivery?.recipientPolicy??'')!==(delivery.mode==='smtp'?smtpRecipientPolicy:'')))
      return {reason:'paused'} as const;
    if(expected&&!matchesEnrollmentMailDelivery(expected,delivery))return {reason:'paused'} as const;
    if(!config.enabled||delivery.mode==='disabled')return {reason:'paused'} as const;
    const prior=(await c.query(`SELECT state,account,started_ms FROM enrollment_mail_attempts
      WHERE environment=:p1 AND event_key=:p2 AND state<>'rejected' LIMIT 1`,[environment(),event])).rows[0];
    if(prior){
      if(prior.state==='reserved'&&Date.now()-Number(prior.started_ms)<120_000)return {reason:'binding_pending'} as const;
      return {prior:prior.state==='reserved'?'unknown':prior.state,previousAccount:prior.account} as const;
    }
    if(queued&&['waitlist_vacancy','demand_match'].includes(queued.kind)){
      const policy=enrollmentServicePolicy(process.env,delivery.mode);
      if(!policy.servicing||!policy.simulation&&!hasConfiguredEnrollmentBank(await readEnrollmentBank(c)))return {reason:'paused'} as const;
      if(!await enrollmentInterestStillAvailable(c,event,recipient,queued))return {reason:'interest_no_longer_available'} as const;
    }
    const {rows:[clock]}=await c.query('SELECT FLOOR(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(6))*1000) AS now_ms');
    const now=Number(clock.now_ms);
    const {day,month}=timeKeys(now);
    const selected=config.pools?.find(pool=>pool.id===config.selectedPool);
    if(selected&&(selected.dailyLimit!==null||selected.dailyRecipientLimit!==null)){
      const {rows:[used]}=await c.query(`SELECT COUNT(*) AS total,COUNT(DISTINCT LOWER(TRIM(recipient))) AS recipients,
        MAX(LOWER(TRIM(recipient))=LOWER(TRIM(:p4))) AS seen
        FROM enrollment_mail_attempts WHERE environment=:p1 AND day_key=:p2 AND pool_id=:p3 AND state<>'rejected'`,
        [environment(),day,selected.id,recipient]);
      const reason=mailPoolQuotaReason(selected,{total:Number(used.total),recipients:Number(used.recipients),seen:!!Number(used.seen)});
      if(reason)return {reason} as const;
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
    const candidates:StoredMailAccount[]=[];
    for(const account of config.accounts){
      if(!account.enabled||!members.has(account.address)||bound&&bound!==account.address||excluded.has(account.address))continue;
      if(delivery.mode==='simulation'||mailSmtpEndpoint(account)&&await smtpPassword(account,c))candidates.push(account);
    }
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
    return {id,account,delivery,bound,sticky:config.sticky,reason:bound?'bound_account':selected?.strategy??'balanced'} as const;
  });
}

async function deliver(account:StoredMailAccount,id:string,recipient:string,mail:Mail,delivery:EnrollmentMailDelivery,code?:string):Promise<State|'address_rejected'>{
  if(!matchesEnrollmentMailDelivery(delivery,await enrollmentMailDelivery()))return 'rejected';
  const local=enrollmentMailbox(delivery.mode);
  if(local){
    try{
      if(code!==undefined)await local.deliver(id,recipient,code,mail);
      else await local.deliverMessage(id,recipient,mail);
      return 'simulated';
    }catch{return 'unknown';}
  }
  const options=smtpTransportOptions(account);
  if(!options||delivery.mode!=='smtp'||!smtpDeployment())return 'rejected';
  const current=await configuredSmtpAccount(pool,account.address);
  const secret=current?.enabled&&smtpCredentialTarget(current)===smtpCredentialTarget(account)?await smtpPassword(current,pool):undefined;
  if(!secret)return 'rejected';
  try{
    const origin=portalPublicOrigin();
    if(!origin)return 'rejected';
    const site=new URL(origin);
    if((site.protocol!=='https:'&&!(isLocalEnrollmentRuntime()&&site.origin==='http://localhost:3000')))return 'rejected';
    const transport=nodemailer.createTransport({
      ...options,
      auth:{user:account.address,pass:secret},connectionTimeout:10_000,greetingTimeout:10_000,socketTimeout:20_000,
    });
    if(!matchesEnrollmentMailDelivery(delivery,await enrollmentMailDelivery()))return 'rejected';
    const result=await transport.sendMail({from:{name:'UPER Admissions',address:account.address},to:recipient,
      subject:mail.subject,
      text:mail.text.replace(/(^|\s)(?:http:\/\/localhost:3000)?(\/enrollment(?=[/?"\s]|$))/g,(_match,space,link)=>space+origin+link),
      html:mail.html.replace(/(href=["'])(?:http:\/\/localhost:3000)?(\/enrollment(?=[/?'"]))/g,(_match,attribute,link)=>attribute+origin+link),
      disableFileAccess:true,disableUrlAccess:true});
    return result.accepted.length?'accepted':'rejected';
  }catch(error){
    const e=error as {responseCode?:number;command?:string};
    if(e.command==='RCPT TO'&&e.responseCode&&e.responseCode>=500)return 'address_rejected';
    return e.responseCode&&e.responseCode>=400||e.command==='CONN'||e.command==='AUTH'?'rejected':'unknown';
  }
}
const mailDeliveryId=(event:string)=>createHash('sha256').update(event).digest('hex');

export async function reconcileLegacyEnrollmentMail(eventKeys:readonly string[], {preview=false}={}){
  return transact(async c=>{
    if(!preview)await configuration(c,true);
    const result={cancelled:0,replaced:0,preserved:0};
    const decisions:Record<string,string>=Object.create(null);
    const plannedOrders=new Set<string>();
    for(const key of new Set(eventKeys)){
      const [row]=(await c.query(`SELECT kind,subject_id,payload FROM enrollment_notification_receipts
        WHERE event_key=:p1 AND channel='email' AND state='queued'
        AND kind IN ('class_confirmed','payment_and_opening')${preview?'':' FOR UPDATE'}`,
      [key])).rows;
      if(!row){
        decisions[key]='not_eligible';
        continue;
      }
      if(row.payload?.environment!==environment()){
        decisions[key]=row.payload?.environment?'different_environment':'missing_environment';
        result.preserved++;
        continue;
      }
      const [attempt]=(await c.query(`SELECT id FROM enrollment_mail_attempts
        WHERE environment=:p1 AND event_key=:p2 AND state<>'rejected' LIMIT 1`,
      [environment(),key])).rows;
      if(attempt){
        decisions[key]='delivery_attempt_exists';
        result.preserved++;
        continue;
      }
      if(row.kind==='payment_and_opening'){
        const {rows:prior}=await c.query(`SELECT event_key,state,payload->>'$.environment' AS environment
          FROM enrollment_notification_receipts WHERE subject_id=:p1 AND channel='email'
          AND kind='payment_confirmed'`,[row.subject_id]);
        const hasConfirmation=plannedOrders.has(row.subject_id)||prior.some(mail=>mail.state==='accepted'||
          mail.state==='queued'&&mail.environment===environment());
        if(!hasConfirmation&&prior.some(mail=>mail.state!=='simulated')){
          decisions[key]='confirmation_requires_review';
          result.preserved++;
          continue;
        }
        if(!hasConfirmation){
          const canonical='email:payment_confirmed:'+row.subject_id+':';
          const replacement=prior.some(mail=>mail.event_key===canonical)?canonical+'legacy-opening':canonical;
          const {recipient,language,salutation,class:level,format,period,schedule,received}=row.payload;
          const content={recipient,language,salutation,class:level,format,period,schedule,received,
            orderId:row.subject_id,url:enrollmentOrderEmailPath('payment_confirmed',language,row.subject_id)};
          if(!preview)await c.query(`INSERT INTO enrollment_notification_receipts(event_key,channel,kind,subject_id,payload,state,recorded_at)
            VALUES(:p1,'email','payment_confirmed',:p2,:p3,'queued',UTC_TIMESTAMP(6))`,
          [replacement,row.subject_id,
            {...content,...renderEnrollmentEmail('payment_confirmed',content),environment:environment(),delivery:row.payload?.delivery}]);
          plannedOrders.add(row.subject_id);
          decisions[key]='replace';
          result.replaced++;
        }
      }
      decisions[key]??='cancel';
      if(!preview)await c.query("UPDATE enrollment_notification_receipts SET state='cancelled' WHERE event_key=:p1",[key]);
      result.cancelled++;
    }
    return preview?{...result,decisions}:result;
  });
}

export async function dispatchEnrollmentMail(event:string,recipient:string,mail:Mail,{code,deliveryId=mailDeliveryId(event),queueKey,expected}:{
  code?:string;deliveryId?:string;queueKey?:string;expected?:EnrollmentMailDelivery;
}={}):Promise<{state:State;account?:string;reason:RouteReason}>{
  if(!validContactEmail(recipient))return {state:'rejected',reason:'invalid_recipient'};
  const excluded=new Set<string>();
  let lastRejected:string|undefined;
  for(;;){
    const plan=await reserve(event,recipient,code!==undefined,excluded,queueKey,expected);
    if(!('id' in plan)&&'reason' in plan){
      if(plan.reason==='interest_no_longer_available')return {state:'cancelled',reason:plan.reason};
      if(lastRejected)return {state:'rejected',account:lastRejected,reason:plan.reason};
      return {state:'waiting',account:'waitingAccount' in plan?plan.waitingAccount:undefined,reason:plan.reason};
    }
    if('prior' in plan)return {state:plan.prior,account:plan.previousAccount,reason:'existing'};
    const {id,account,delivery,bound,sticky,reason}=plan;
    expected=delivery;
    const outcome=await deliver(account,deliveryId,recipient,mail,delivery,code);
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
      p.dailyLimit!==null&&!integer(p.dailyLimit,1,mailPoolDailyLimitMax)||
      p.dailyRecipientLimit!=null&&!integer(p.dailyRecipientLimit,1,mailPoolDailyLimitMax)||!isMailPoolStrategy(p.strategy))))invalid('enrollment_mail_invalid',400);
  const config:Omit<EnrollmentMailConfig,'sticky'>={name:value.name.trim(),enabled:value.enabled,accounts,members:value.members};
  if(pools!==undefined){
    config.pools=pools.map((p:any)=>({id:p.id,transport:'smtp',name:p.name.trim(),enabled:p.enabled,members:p.members,
      dailyLimit:p.dailyLimit,dailyRecipientLimit:p.dailyRecipientLimit??null,strategy:p.strategy}));
    config.selectedPool=value.selectedPool;
  }
  return config;
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
    staff:(q:Request,permission:string)=>Promise<Pick<Employee,'id'|'roles'|'permissions'>>}){
  const path='/api/admin/enrollment-mail';
  const authorize=async(q:Request)=>{
    const user=await staff(q,'access.read');
    if(!['access.users','access.roles','access.sessions','access.audit'].every(p=>user.permissions.includes(p)))
      invalid('enrollment_mail_forbidden',403);
    return user;
  };
  const view=async()=>{
    const {config,revision,delivery}=await configuration(pool);
    const {usage,day}=await counters(pool,Date.now());
    const {rows:poolCounts}=await pool.query("SELECT pool_id,COUNT(*) AS total,COUNT(DISTINCT LOWER(TRIM(recipient))) AS recipients FROM enrollment_mail_attempts WHERE environment=:p1 AND day_key=:p2 AND pool_id IS NOT NULL AND state<>'rejected' GROUP BY pool_id",
      [environment(),day]);
    const poolUsage=Object.fromEntries(poolCounts.map(row=>[row.pool_id,Number(row.total)]));
    const poolRecipientUsage=Object.fromEntries(poolCounts.map(row=>[row.pool_id,Number(row.recipients)]));
    const accounts=config.accounts.map(({encryptedPassword,secret,...account})=>account);
    return {config:{...config,accounts},revision,environment:environment(),mode:delivery.mode,usage,poolUsage,poolRecipientUsage,timezone:timezone(),
      managedCredentials:!!process.env.PORTAL_CREDENTIAL_KEYRING_FILE,
      configured:await Promise.all(config.accounts.map(async a=>({address:a.address,configured:!!await smtpPassword(a,pool)})))};
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
      if(!isAiAdministrator(actor))invalid('enrollment_mail_forbidden',403);
      if(process.env.PORTAL_CREDENTIAL_KEYRING_FILE)invalid('use_integration_credentials',409);
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
          const previous=before.config.accounts.find(item=>item.address===account.address);
          const sameEndpoint=previous&&smtpCredentialTarget(previous)===smtpCredentialTarget(account);
          if(!mailSmtpEndpoint(account)&&(!sameEndpoint||credential?.address===account.address))
            invalid('enrollment_mail_invalid',400);
          if(credential?.address===account.address){
            if(credential.password===null)return {...account,secret:''};
            return {...account,secret:'',encryptedPassword:sealMailPassword(environment(),account.address,credential.password)};
          }
          return {...account,secret:sameEndpoint?previous.secret:'',encryptedPassword:sameEndpoint?previous.encryptedPassword:undefined};
        });
        const config=activeEnrollmentMailConfig({...edited,accounts,sticky:before.config.sticky});
        const revision=before.revision+1;
        await c.query('UPDATE enrollment_mail_configuration SET config=:p2,revision=revision+1 WHERE environment=:p1',
          [environment(),{...config,delivery:before.delivery}]);
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
    const selectedPool=q.body?.pool,sticky=q.body?.sticky,mode=q.body?.mode;
    if(mode!==undefined){
      if(!isAiAdministrator(actor))invalid('enrollment_mail_forbidden',403);
      if(!isEnrollmentMailMode(mode))invalid('enrollment_mail_invalid',400);
    }
    if(sticky!==undefined&&typeof sticky!=='boolean')invalid('enrollment_mail_invalid',400);
    const saved=await transact(async c=>{
      const {config,revision,delivery}=await configuration(c,true);
      if(revision!==q.body?.revision)invalid('enrollment_mail_conflict',409);
      if(!config.pools?.some(p=>p.id===selectedPool))invalid('enrollment_mail_invalid',400);
      const next=activeEnrollmentMailConfig({...config,selectedPool,sticky:sticky??config.sticky});
      const nextDelivery=mode!==undefined&&mode!==delivery.mode?{mode,generation:randomUUID()}:delivery;
      await c.query('UPDATE enrollment_mail_configuration SET config=:p2,revision=revision+1 WHERE environment=:p1',
        [environment(),{...next,delivery:nextDelivery}]);
      await c.query(`INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'access.enrollment_mail.pool_selected',:p2)`,
        [actor.id,{environment:environment(),previousPool:config.selectedPool,pool:selectedPool,previousSticky:config.sticky,sticky:next.sticky,previousMode:delivery.mode,mode:nextDelivery.mode}]);
      return {selectedPool,sticky:next.sticky,mode:nextDelivery.mode,revision:revision+1};
    });
    return r.json({ok:true,settings:saved});
  }));
  app.get('/api/crm/enrollment/mail',wrap(async(q,r)=>{
    const actor=await staff(q,'crm.operations.manage');
    const saved=await configuration(pool);
    const {config,revision,delivery}=saved;
    const rows=(await pool.query(`SELECT n.event_key AS id,n.subject_id AS recordId,n.kind,n.state,
      n.payload->>'$.subject' AS subject,NULLIF(n.payload->>'$.sender','null') AS sender,
      n.payload->>'$.routeReason' AS routeReason,
      DATE_FORMAT(n.recorded_at,'%Y-%m-%dT%H:%i:%sZ') AS recordedAt
      FROM enrollment_notification_receipts n WHERE n.channel='email' AND n.kind NOT IN ('otp_apply','otp_mine')
      ORDER BY n.recorded_at DESC,n.event_key DESC LIMIT 100`)).rows;
    return r.set('Cache-Control','no-store').json({name:config.name,enabled:config.enabled,sticky:config.sticky,mode:delivery.mode,canEditMode:isAiAdministrator(actor),deliveryReasons:await deliveryReadiness(pool,saved),rows,revision,selectedPool:config.selectedPool,
      pools:config.pools?.map(({id,name,enabled})=>({id,name,enabled}))});
  }));
}

// The business event and its pending email are inserted in the same transaction.
// Only newly queued records are considered, so historical simulated rows are never replayed.
export function startEnrollmentMail(){
  mailPollStartedAt=Date.now();
  const recordProgress=()=>{
    if(mailPollProgressAt===undefined || mailPollFailed)log.info('enrollment.mail.poll_ready');
    mailPollProgressAt=Date.now();
    mailPollFailed=false;
  };
  let active=false;
  const tick=async()=>{
    if(active)return;
    active=true;
    try{
      const {config,delivery}=await configuration(pool);
      if(!config.enabled||delivery.mode==='disabled'||
        delivery.mode==='simulation'&&!enrollmentServicePolicy(process.env,delivery.mode).maintenance||
        delivery.mode==='smtp'&&!portalWorkerEnabled()){recordProgress();return;}
      const {restoreState}=await import('./accessRecoveryState.ts');
      if((await restoreState())?.required){recordProgress();return;}
      const {rows}=await pool.query(`SELECT event_key,payload FROM enrollment_notification_receipts
        WHERE channel='email' AND state='queued' AND payload->>'$.environment'=:p1
        AND payload->>'$.delivery.generation'=:p3 AND payload->>'$.delivery.mode'=:p4
        AND COALESCE(payload->>'$.delivery.recipientPolicy','')=:p5
        AND COALESCE(CAST(payload->>'$.retryAfter' AS UNSIGNED),0)<=:p2
        ORDER BY recorded_at,event_key LIMIT 40`,[environment(),Date.now(),delivery.generation,delivery.mode,delivery.mode==='smtp'?smtpRecipientPolicy:'']);
      recordProgress();
      for(const row of rows){
        const payload=row.payload;
        const {state,account,reason}=await dispatchEnrollmentMail(row.event_key,payload.recipient,payload,{deliveryId:payload.deliveryId,queueKey:row.event_key,expected:delivery});
        const next=state==='waiting'?'queued':state==='rejected'?'failed':state;
        // Delay blocked mail so later recipients can use other accounts.
        await pool.query(`UPDATE enrollment_notification_receipts SET state=:p2,payload=:p3
          WHERE event_key=:p1 AND state='queued'`,[row.event_key,next,
          {...payload,sender:account??null,routeReason:reason,retryAfter:state==='waiting'?Date.now()+15_000:0}]);
        recordProgress();
      }
    }catch{
      if(!mailPollFailed)log.error('enrollment.mail.poll_failed');
      mailPollFailed=true;
    }
    finally{active=false;}
  };
  const timer=setInterval(()=>void tick(),3000);
  timer.unref();
}
