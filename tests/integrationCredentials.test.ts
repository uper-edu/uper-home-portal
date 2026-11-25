import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,writeFileSync,rmSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes,randomUUID} from 'node:crypto';
import {openCredential,readCredentialKeyring,sealCredential} from '../server/portal/integrationCredentialCrypto.ts';
import {credentialSlot,credentialSource,credentialTarget,type CredentialClient} from '../server/portal/integrationCredentials.ts';
import {mountIntegrationCredentials} from '../server/portal/integrationCredentialAdmin.ts';
import type {Employee} from '../server/portal/identity.ts';
import {readBootstrapSecrets} from '../server/environment.mjs';
import type {AiSupplier,AiSupplierId} from '../src/utils/aiSupplier.ts';

const keys={old:randomBytes(32).toString('hex'),current:randomBytes(32).toString('hex')};
const mailSlot=credentialSlot('smtp','learner-fixture@example.test','dev');
const target=credentialTarget(['fixture.example.test','465']);

test('credentials use randomized, version- and environment-bound encryption and support rotation',t=>{
  const directory=mkdtempSync(join(tmpdir(),'uper-keyring-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const file=join(directory,'keyring');
  writeFileSync(file,JSON.stringify({environment:'dev',active:'old',keys}),{mode:0o600});
  const original=readCredentialKeyring(file,'dev');
  const value={password:'pretend-secret-for-tests'};
  const first=sealCredential(original,mailSlot,'v1',target,value);
  assert.notEqual(first,sealCredential(original,mailSlot,'v1',target,value));
  assert.deepEqual(openCredential(original,mailSlot,'v1',target,first),value);
  assert.throws(()=>openCredential(original,{...mailSlot,environment:'prod'},'v1',target,first));
  assert.throws(()=>openCredential(original,{...mailSlot,resource:'other@example.test'},'v1',target,first));
  assert.throws(()=>openCredential(original,mailSlot,'v2',target,first));
  assert.throws(()=>openCredential(original,mailSlot,'v1','different target',first));
  const [id,nonce,tag,body]=first.split('.');
  assert.throws(()=>openCredential(original,mailSlot,'v1',target,[id,nonce,tag,(body[0]==='A'?'B':'A')+body.slice(1)].join('.')));
  writeFileSync(file,JSON.stringify({environment:'dev',active:'current',keys}));
  const rotated=readCredentialKeyring(file,'dev');
  const rewritten=sealCredential(rotated,mailSlot,'v1',target,openCredential(rotated,mailSlot,'v1',target,first));
  writeFileSync(file,JSON.stringify({environment:'dev',active:'current',keys:{current:keys.current}}));
  assert.deepEqual(openCredential(readCredentialKeyring(file,'dev'),mailSlot,'v1',target,rewritten),value);
  assert.throws(()=>openCredential(readCredentialKeyring(file,'dev'),mailSlot,'v1',target,first));
  assert.throws(()=>readCredentialKeyring(file,'test'));
  chmodSync(file,0o644);
  assert.throws(()=>readCredentialKeyring(file,'dev'));
});

test('the deployment file accepts only startup secrets and requires private permissions',t=>{
  const directory=mkdtempSync(join(tmpdir(),'uper-bootstrap-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const file=join(directory,'bootstrap');
  writeFileSync(file,'MYSQL_TRIAL_URL=mysql://fixture.invalid/test\n',{mode:0o600});
  assert.equal(readBootstrapSecrets(file).MYSQL_TRIAL_URL,'mysql://fixture.invalid/test');
  writeFileSync(file,'PORTAL_ENV=prod\n');
  assert.throws(()=>readBootstrapSecrets(file),/Unexpected/);
  chmodSync(file,0o644);
  assert.throws(()=>readBootstrapSecrets(file),/private/);
});

const admin:Employee={id:'admin-fixture',active:true,roles:['access_admin'],scope:'all',teams:[],
  permissions:['access.read','access.users','access.roles','access.sessions','access.audit']};
const operator:Employee={id:'operator-fixture',active:true,roles:['operator'],scope:'own',teams:[],permissions:['access.read']};
const staff:Employee={...operator,id:'staff-fixture'};

test('direct credential setup preserves each service’s verification, replacement and revocation rules',{timeout:3000},async t=>{
  const directory=mkdtempSync(join(tmpdir(),'uper-slot-fixture-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const file=join(directory,'keyring');
  writeFileSync(file,JSON.stringify({environment:'dev',active:'current',keys}),{mode:0o600});
  const legacyEnv={PORTAL_ENV:process.env.PORTAL_ENV,PORTAL_CREDENTIAL_KEYRING_FILE:process.env.PORTAL_CREDENTIAL_KEYRING_FILE,
    PORTAL_CREDENTIAL_PROVIDER_CHECKS:process.env.PORTAL_CREDENTIAL_PROVIDER_CHECKS};
  process.env.PORTAL_ENV='dev';
  process.env.PORTAL_CREDENTIAL_KEYRING_FILE=file;
  // The retired switch no longer blocks a system administrator's credential check.
  process.env.PORTAL_CREDENTIAL_PROVIDER_CHECKS='false';
  t.after(()=>{for(const [key,value] of Object.entries(legacyEnv)){
    if(value===undefined)delete process.env[key];else process.env[key]=value;
  }});
  const slots=new Map<string,any>(),receipts=new Map<string,any>(),audit:unknown[]=[];
  let modelSettings:{revision:number;current:{primary:string;fallback:string};checks:{id:string}[];suppliers?:Partial<Record<AiSupplierId,AiSupplier>>}=
    {revision:10,current:{primary:'gpt-6.2-sol',fallback:'deepseek-v4-pro'},checks:[{id:'old-model-check'}]};
  const db:CredentialClient={async query(sql,parameters=[]){
    const slotKey=parameters.slice(0,3).join('/');
    const operationKey=parameters.slice(0,2).join('/');
    let rows:any[]=[];
    if(sql.includes('INSERT INTO integration_credentials')&&!slots.has(slotKey))slots.set(slotKey,structuredClone(parameters[3]));
    if(sql.includes('SELECT state FROM integration_credentials')&&slots.has(slotKey))rows=[{state:structuredClone(slots.get(slotKey))}];
    if(sql.includes('UPDATE integration_credentials'))slots.set(slotKey,structuredClone(parameters[3]));
    if(sql.includes('FROM access_operations')&&receipts.has(operationKey))rows=[receipts.get(operationKey)];
    if(sql.includes('INSERT INTO access_operations'))receipts.set(operationKey,{fingerprint:parameters[3],result:parameters[4]});
    if(sql.includes('INSERT INTO portal_audit'))audit.push(parameters[2]);
    if(sql.startsWith("SELECT value FROM portal_settings WHERE id='ai_service'"))rows=[{value:modelSettings}];
    if(sql.startsWith("INSERT INTO portal_settings(id,value) VALUES('ai_service'"))[modelSettings]=parameters;
    return {rows};
  }};
  const routes=new Map<string,(req:any,res:any)=>void>();
  const fakeApp={get:(path:string,fn:any)=>routes.set('GET '+path,fn),post:(path:string,fn:any)=>routes.set('POST '+path,fn)};
  let checks=0;
  let configuration='target fixture';
  let delayed: Promise<void>|undefined;
  mountIntegrationCredentials(fakeApp as any,{
    pool:db,tx:async fn=>fn(db),authenticate:async q=>(q as any).fixtureActor,
    target:async(_db,slot)=>slot.type==='ai'?{
      id:target,legacy:()=>slot.resource==='minimax'?undefined:{key:'legacy-fixture'},fields:['key'],context:[slot.resource,configuration],validation:'provider',
      validate:async values=>values.key==='verified-fixture'||{kind:'ai_auth_rejected'},
    }:slot.type==='lark-app'?{
      id:target,legacy:()=>({key:'legacy-fixture'}),fields:['key'],context:[configuration],validation:'provider',
      validate:async values=>{await delayed;return values.key==='verified-fixture';},
    }:slot.type==='cos'?{
      id:target,legacy:()=>({secretId:'legacy-fixture',secretKey:'legacy-fixture'}),fields:['secretId','secretKey','token'],
      context:[configuration],validation:'provider',validate:async values=>values.secretKey==='verified-fixture',
    }:slot.type==='ga'||slot.type==='lark-group'?{
      id:target,legacy:()=>slot.type==='ga'?{key:'legacy-fixture'}:{webhook:'legacy-fixture'},
      fields:slot.type==='ga'?['key']:['webhook'],context:[configuration],validation:'manual',
      validate:async values=>(values.key||values.webhook)==='verified-fixture',
    }:{id:target,legacy:()=>({password:'legacy-fixture'}),fields:['password'],context:[configuration],validation:'provider',
      validate:async values=>{checks++;await delayed;return values.password==='verified-fixture'||{kind:'smtp_auth_rejected',replyCode:535};}},
  });
  const prefix='/api/admin/integration-credentials/:kind/:resource';
  function call(actor:Employee|null,method:string,body?:object,operation?:string,origin='http://localhost:3000',kind='smtp',resource=mailSlot.resource){
    return new Promise<{status:number;data:any}>(resolve=>{
      let status=200;
      const handler=routes.get(method+' '+prefix+(operation?'/results/:id':''))!;
      handler({method,body,fixtureActor:actor,params:{kind,resource,id:operation},
        is:()=>true,get:()=> 'localhost:3000',protocol:'http',headers:{origin}},
      {set:()=>{},status:(code:number)=>{status=code;return {json:(data:any)=>resolve({status,data})};},
        json:(data:any)=>resolve({status,data})});
    });
  }
  const change=(actor:Employee|null,action:string,revision:number,fields:object={},requestId=randomUUID())=>
    call(actor,'POST',{action,revision,requestId,...fields});
  const state=()=>slots.get('dev/smtp/'+mailSlot.resource);
  const effective=()=>credentialSource(state(),mailSlot,target,()=>({password:'legacy-fixture'})).value?.password;
  assert.equal((await call(staff,'GET')).status,403);
  assert.equal((await call(admin,'POST',{action:'revoke'},undefined,'https://other.invalid')).status,403);
  // Old delegation metadata must grant neither access nor the ability to write a candidate.
  slots.set('dev/smtp/'+mailSlot.resource,{revision:1,delegates:[operator.id],candidate:{id:'obsolete-version',sealed:'obsolete-test-ciphertext'}});
  assert.equal(routes.has('GET /api/admin/integration-credentials/assigned'),false);
  assert.equal((await call(operator,'GET')).status,403);
  assert.equal((await call(operator,'GET',undefined,randomUUID())).status,403);
  for(const op of ['set','stage','import','verify','activate','revoke']){
    assert.equal((await change(null,op,1)).status,401);
    assert.equal((await change(operator,op,1)).status,403);
  }
  assert.equal((await change(admin,'delegate',1,{employees:[operator.id]})).status,400);
  assert.equal((await call(admin,'GET')).data.source,'legacy');
  assert.equal((await call(admin,'GET')).data.delegates,undefined);
  assert.equal((await call(admin,'GET')).data.candidate,undefined);
  assert.equal(effective(),'legacy-fixture');
  const wrong={values:{password:'wrong-fixture'}};
  const verified={values:{password:'verified-fixture'}};
  for(const op of ['stage','import','verify','activate'])
    assert.equal((await change(admin,op,1,wrong)).status,400);
  const blocked=await change(admin,'set',1,wrong);
  assert.equal(blocked.status,409);
  assert.equal(blocked.data.error,'credential_revoke_current_required');
  assert.equal(effective(),'legacy-fixture');
  assert.equal((await change(admin,'revoke',1)).status,200);
  assert.equal(effective(),undefined);
  assert.equal(state().candidate,undefined);

  const failureId=randomUUID();
  const diagnostic={kind:'smtp_auth_rejected',replyCode:535};
  const failure=await change(admin,'set',2,wrong,failureId);
  assert.equal(failure.data.outcome,'failed');
  assert.deepEqual(failure.data.diagnostic,diagnostic);
  assert.deepEqual((await change(admin,'set',2,wrong,failureId)).data,failure.data);
  assert.deepEqual((await call(admin,'GET',undefined,failureId)).data.diagnostic,diagnostic);
  assert.deepEqual((audit.at(-1) as {diagnostic:unknown}).diagnostic,diagnostic);
  assert.equal(state().active,undefined);
  assert.equal(state().candidate,undefined);
  assert.equal(state().smtpSetup,undefined);
  assert.equal(effective(),undefined);

  let resume!:()=>void;
  delayed=new Promise<void>(resolve=>{resume=resolve;});
  const staleSetup=change(admin,'set',3,verified);
  while(checks!==2)await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await change(admin,'set',3,verified)).status,409);
  assert.equal(state().candidate,undefined);
  assert.doesNotMatch(JSON.stringify(state()),/verified-fixture|sealed/);
  configuration='changed during validation';
  resume();
  assert.equal((await staleSetup).status,409);
  assert.equal(effective(),undefined);

  const setupId=randomUUID();
  const success=await change(admin,'set',3,verified,setupId);
  assert.equal(success.data.outcome,'verified');
  assert.deepEqual((await change(admin,'set',3,verified,setupId)).data,success.data);
  assert.equal((await change(admin,'set',3,wrong,setupId)).status,409);
  assert.equal(checks,3);
  assert.equal(effective(),'verified-fixture');
  assert.equal(state().candidate,undefined);
  assert.equal(state().smtpSetup,undefined);
  const blockedManaged=await change(admin,'set',4,wrong);
  assert.equal(blockedManaged.status,409);
  assert.equal(blockedManaged.data.error,'credential_revoke_current_required');
  assert.equal(effective(),'verified-fixture');
  assert.equal((await change(admin,'revoke',4)).status,200);
  assert.equal(effective(),undefined);
  assert.equal((await call(admin,'GET')).data.source,'revoked');
  assert.equal((await call(operator,'GET')).status,403);
  const aiAction=(actor:Employee,action:string,revision:number,key?:string,resource='openai')=>
    call(actor,'POST',{action,revision,requestId:randomUUID(),...(key?{values:{key}}:{})},undefined,undefined,'ai',resource);
  const aiStatus=(resource:string)=>call(admin,'GET',undefined,undefined,undefined,'ai',resource);
  assert.equal((await aiAction(operator,'revoke',0)).status,403);
  assert.equal((await aiAction(admin,'stage',0,'wrong-fixture')).status,400);
  assert.equal((await aiAction(admin,'set',0,'wrong-fixture')).data.error,'credential_revoke_current_required');
  assert.equal((await aiAction(admin,'revoke',0)).status,200);
  assert.deepEqual(modelSettings.checks,[]);
  assert.equal(modelSettings.revision,11);
  const rejected=await aiAction(admin,'set',1,'wrong-fixture');
  assert.equal(rejected.data.outcome,'failed');
  assert.deepEqual(rejected.data.diagnostic,{kind:'ai_auth_rejected'});
  assert.equal((await aiStatus('openai')).data.source,'revoked');
  assert.equal((await aiStatus('deepseek')).data.source,'legacy');
  assert.equal(modelSettings.revision,11);
  const accepted=await aiAction(admin,'set',2,'verified-fixture');
  assert.equal(accepted.data.outcome,'verified');
  assert.equal((await aiStatus('openai')).data.source,'managed');
  assert.equal((await aiStatus('openai')).data.candidate,undefined);
  assert.equal((await aiStatus('deepseek')).data.source,'legacy');
  assert.equal(modelSettings.revision,12);
  assert.deepEqual(modelSettings.current,{primary:'gpt-6.2-sol',fallback:'deepseek-v4-pro'});
  const unchangedModels={...modelSettings.current};
  modelSettings.suppliers={minimax:{id:'minimax',name:'MiniMax',models:['MiniMax-M3.1-Flash'],enabled:false}};
  assert.equal((await aiAction(admin,'set',0,'wrong-fixture','minimax')).data.outcome,'failed');
  assert.equal(modelSettings.suppliers.minimax!.verified,undefined);
  assert.equal((await aiAction(admin,'set',1,'verified-fixture','minimax')).data.outcome,'verified');
  assert.equal(modelSettings.suppliers.minimax!.verified,true);
  assert.equal(modelSettings.suppliers.minimax!.enabled,false);
  assert.deepEqual(modelSettings.current,unchangedModels);
  modelSettings.suppliers.minimax!.enabled=true;
  modelSettings.current={...unchangedModels,fallback:'MiniMax-M3.1-Flash'};
  const blockedRevoke=await aiAction(admin,'revoke',2,undefined,'minimax');
  assert.equal(blockedRevoke.data.error,'credential_supplier_in_use');
  assert.equal((await aiStatus('minimax')).data.source,'managed');
  modelSettings.current=unchangedModels;
  assert.equal((await aiAction(admin,'revoke',2,undefined,'minimax')).status,200);
  assert.equal(modelSettings.suppliers.minimax!.enabled,false);
  assert.equal(modelSettings.suppliers.minimax!.verified,false);
  assert.equal((await aiStatus('minimax')).data.source,'revoked');
  function integrationAction(kind:string,action:string,revision:number,extra:object={},requestId=randomUUID()){
    return call(admin,'POST',{action,revision,requestId,...extra},undefined,undefined,kind,'default');
  }
  for(const [kind,field] of [['ga','key'],['lark-group','webhook']]){
    const input={values:{[field]:'verified-fixture'}};
    const key='dev/'+kind+'/default';
    slots.set(key,{revision:0,candidate:{id:'retired-candidate'}});
    const status=()=>call(admin,'GET',undefined,undefined,undefined,kind,'default');
    assert.equal((await status()).data.candidate,undefined);
    for(const action of ['import','stage','verify','activate'])
      assert.equal((await integrationAction(kind,action,0,input)).status,400);
    assert.equal((await integrationAction(kind,'set',0,input)).data.error,'credential_manual_confirmation_required');
    assert.equal((await integrationAction(kind,'set',0,{...input,confirmed:true})).data.error,'credential_revoke_current_required');
    assert.equal((await integrationAction(kind,'revoke',0)).status,200);
    assert.equal((await status()).data.source,'revoked');
    assert.equal((await integrationAction(kind,'set',1,{...input,confirmed:true})).data.outcome,'verified');
    assert.equal((await status()).data.source,'managed');
    assert.equal(slots.get(key).candidate,undefined);
  }
  const larkSlot=credentialSlot('lark-app','default');
  const larkState=()=>slots.get('dev/lark-app/default');
  const larkKey=()=>credentialSource(larkState()??{revision:0},larkSlot,target,()=>({key:'legacy-fixture'})).value?.key;
  const firstLark=await integrationAction('lark-app','set',0,{values:{key:'verified-fixture'}});
  assert.equal(firstLark.data.outcome,'verified');
  const prior=larkState().active;
  let finishLark!:()=>void;
  delayed=new Promise<void>(resolve=>{finishLark=resolve;});
  const requestId=randomUUID();
  const failedInput={values:{key:'wrong-fixture'}};
  const replacing=integrationAction('lark-app','set',1,failedInput,requestId);
  while(!larkState().setup)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(larkKey(),'verified-fixture');
  assert.equal((await integrationAction('lark-app','set',1,failedInput)).data.error,'credential_verification_running');
  finishLark();
  const failedReplacement=await replacing;
  assert.equal(failedReplacement.data.outcome,'failed');
  assert.deepEqual(larkState().active,prior);
  assert.equal(larkKey(),'verified-fixture');
  assert.deepEqual((await integrationAction('lark-app','set',1,failedInput,requestId)).data,failedReplacement.data);
  assert.equal((await integrationAction('lark-app','set',2,{values:{key:'verified-fixture'}})).data.outcome,'verified');
  assert.notEqual(larkState().active.id,prior.id);
  assert.equal(larkKey(),'verified-fixture');
  assert.equal(larkState().candidate,undefined);
  const managed = larkState();
  const unexpectedFallback = () => assert.fail('A managed credential must not fall back');
  assert.deepEqual(credentialSource(managed,larkSlot,'different destination',unexpectedFallback),
    {source:'target_changed',value:undefined});
  assert.deepEqual(credentialSource({...managed,active:{...managed.active,sealed:'invalid'}},larkSlot,target,unexpectedFallback),
    {source:'unavailable',value:undefined});
  assert.equal((await integrationAction('lark-app','revoke',3)).status,200);
  assert.deepEqual(credentialSource(larkState(),larkSlot,target,unexpectedFallback),{source:'revoked',value:undefined});
  assert.equal(larkKey(),undefined);
  const cosSlot=credentialSlot('cos','default');
  const cosState=()=>slots.get('dev/cos/default');
  const cosStatus=()=>call(admin,'GET',undefined,undefined,undefined,'cos','default');
  const cosKey=()=>credentialSource(cosState()??{revision:0},cosSlot,target,
    ()=>({secretId:'legacy-fixture',secretKey:'legacy-fixture'})).value?.secretKey;
  const invalidCos={values:{secretId:'cos-fixture-id',secretKey:'wrong-fixture'}};
  assert.equal((await call(staff,'GET',undefined,undefined,undefined,'cos','default')).status,403);
  assert.equal((await integrationAction('cos','stage',0,{values:{secretId:'cos-fixture-id'}})).status,400);
  assert.equal((await integrationAction('cos','stage',0,invalidCos)).status,200);
  const rejectedCos=(await cosStatus()).data.candidate.version;
  assert.equal((await integrationAction('cos','activate',1,{version:rejectedCos})).status,409);
  assert.equal((await integrationAction('cos','verify',1,{version:rejectedCos})).data.outcome,'failed');
  assert.equal(cosKey(),'legacy-fixture');
  const validCos={values:{secretId:'cos-fixture-id',secretKey:'verified-fixture',token:'cos-fixture-token'}};
  assert.equal((await integrationAction('cos','stage',2,validCos)).status,200);
  const selectedCos=(await cosStatus()).data.candidate.version;
  assert.equal((await integrationAction('cos','verify',3,{version:rejectedCos})).status,409);
  assert.equal((await integrationAction('cos','verify',3,{version:selectedCos})).data.outcome,'verified');
  assert.equal(cosKey(),'legacy-fixture');
  assert.equal((await integrationAction('cos','activate',4,{version:selectedCos})).status,200);
  assert.equal((await cosStatus()).data.source,'managed');
  assert.equal(cosKey(),'verified-fixture');
  assert.equal((await integrationAction('cos','revoke',5)).status,200);
  assert.equal((await cosStatus()).data.source,'revoked');
  assert.equal(cosKey(),undefined);
  for(const safe of [JSON.stringify([...slots.values()]),JSON.stringify(audit),JSON.stringify([...receipts.values()]),JSON.stringify(await call(admin,'GET'))])
    assert.doesNotMatch(safe,/wrong-fixture|verified-fixture|legacy-fixture/);
});

test('SMTP uses built-in provider targets and validates TLS for both SMTP port modes',async()=>{
  const {smtpCredentialTarget,smtpTransportOptions,verifySmtpCredential}=await import('../server/portal/integrationCredentialTargets.ts');
  const address='mail-fixture@example.test';
  const lark={address,host:'SMTP.LARKSUITE.COM',port:465};
  const gmail={address,host:'smtp.gmail.com',port:587};
  assert.deepEqual(smtpTransportOptions(lark),{
    host:'smtp.larksuite.com',port:465,secure:true,requireTLS:false,
    tls:{servername:'smtp.larksuite.com',rejectUnauthorized:true,minVersion:'TLSv1.2'},
  });
  assert.deepEqual(smtpTransportOptions(gmail),{
    host:'smtp.gmail.com',port:587,secure:false,requireTLS:true,
    tls:{servername:'smtp.gmail.com',rejectUnauthorized:true,minVersion:'TLSv1.2'},
  });
  assert.equal(smtpTransportOptions({...gmail,port:465})?.secure,true);
  assert.equal(smtpTransportOptions({...lark,port:587})?.requireTLS,true);
  assert.equal(smtpCredentialTarget(lark),smtpCredentialTarget({...lark,host:lark.host.toLowerCase()}));
  assert.notEqual(smtpCredentialTarget(gmail),smtpCredentialTarget({...gmail,port:465}));
  for(const invalid of [{...gmail,host:'smtp.gmail.com.example.test'},{...gmail,host:'127.0.0.1'},{...gmail,port:25}]){
    assert.equal(smtpTransportOptions(invalid),undefined);
    assert.deepEqual(await verifySmtpCredential(invalid,'fixture'),{kind:'smtp_unsupported_target'});
  }
});

test('SMTP diagnostics retain only a fixed category and a numeric authentication reply',async()=>{
  const {smtpVerificationFailure}=await import('../server/portal/integrationCredentialTargets.ts');
  const providerText='example-secret-in-provider-response';
  const error=(code:string,extra:object={})=>({code,response:providerText,message:providerText,...extra});
  assert.deepEqual(smtpVerificationFailure(error('EAUTH',{responseCode:535,command:'AUTH PLAIN'})),
    {kind:'smtp_auth_rejected',replyCode:535});
  assert.deepEqual(smtpVerificationFailure(error('EAUTH',{responseCode:'535 private provider text'})),{kind:'smtp_unknown'});
  assert.deepEqual(smtpVerificationFailure(error('EDNS')),{kind:'smtp_connection'});
  assert.deepEqual(smtpVerificationFailure(error('ETIMEDOUT',{command:'STARTTLS'})),{kind:'smtp_timeout'});
  assert.deepEqual(smtpVerificationFailure(error('ETLS')),{kind:'smtp_tls'});
  assert.deepEqual(smtpVerificationFailure(error('ESOCKET',{message:'self-signed certificate '+providerText})),{kind:'smtp_tls'});
  assert.deepEqual(smtpVerificationFailure(error('ESOCKET',{library:'SSL routines'})),{kind:'smtp_tls'});
  assert.deepEqual(smtpVerificationFailure(error('ESOCKET')),{kind:'smtp_connection'});
  assert.deepEqual(smtpVerificationFailure(error('unrecognized')),{kind:'smtp_unknown'});
});
