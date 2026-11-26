import {allowedGaMeasurementId,gaSettings,saveGaSettings} from './gaSettings.ts';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import type {Express, Request, Response} from 'express';
import {isAiAdministrator} from '../../src/utils/aiServicePolicy.ts';
import {canReplaceCurrentCredential} from '../../src/utils/integrationCredentialPolicy.ts';
import {validMutationOrigin} from './accessTransport.ts';
import {
  credentialVersionValues, credentialError as fail, credentialKinds, credentialSlot, credentialSource,credentialTarget,
  credentialState, makeCredentialVersion, safeCredentialState, storeCredentialState, usesDirectCredentialSetup, verifiedCandidate,
  type CredentialClient, type CredentialKind, type CredentialValues, type Slot, type CredentialVerificationFailure,
} from './integrationCredentials.ts';
import {
  aiCredentialProviders, aiCredentialTarget, cosCredentialTarget, groupCredentialTarget,
  legacyAiCredential, legacyCosCredential, legacyGaCredential, legacyGroupCredential,
  legacyLarkAppCredential, smtpCredentialTarget, validGroupCredential, verifySmtpCredential,
} from './integrationCredentialTargets.ts';
import {readCredentialKeyring} from './integrationCredentialCrypto.ts';
import {platform, type Employee} from './identity.ts';
import {aiState, aiModels, probeModel, providerFor} from './aiServiceConfig.ts';
import {aiSupplierTemplates,isAiSupplierId} from '../../src/utils/aiSupplier.ts';
import {saveAiSettings, supplierInUse} from './aiSupplierSettings.ts';
import {resolveMailPassword} from './enrollmentMailCredentials.ts';
import {LarkApp} from './larkApp.ts';
import {larkSettings,larkSettingsTarget,larkIdentityLocked,saveLarkSettings} from './larkSettings.ts';
import {cmsMediaConfiguration,verifyCmsStorageCredential} from '../../cloud/mysql/cms-media-storage.mjs';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
type VerificationResult=boolean|CredentialVerificationFailure;
type Target = {
  id: string;
  legacy: () => CredentialValues | undefined;
  fields: readonly string[];
  context: string[];
  validation: 'provider'|'manual';
  legacyMiniMaxInUse?: boolean;
  validate: (values: CredentialValues) => Promise<VerificationResult>;
};

async function targetFor(db: CredentialClient, slot: Slot, lock=false): Promise<Target> {
  const id = slot.resource;
  switch (slot.type) {
    case 'ai': {
      if (!aiCredentialProviders.some(provider=>provider===id)) return fail(404,'credential_not_found');
      const settings=await aiState(db);
      const {current,suppliers}=settings;
      const managedId=isAiSupplierId(id)?id:undefined;
      const supplier=managedId&&suppliers?.[managedId];
      const model = [current.primary, current.fallback, ...aiModels].find(value => providerFor(value).provider === id);
      if(!managedId&&!model)return fail(404,'credential_not_found');
      const models=managedId?aiSupplierTemplates[managedId].models:[model!];
      return {id: aiCredentialTarget(id), legacy: () => supplier?undefined:legacyAiCredential(id), fields: ['key'], context: [id,...models],
        legacyMiniMaxInUse:id==='minimax'&&!supplier&&supplierInUse(settings,'minimax'),
        validation: 'provider', validate: async values => {
          const deadline=AbortSignal.timeout(130_000);
          const request:typeof fetch=(input,init)=>fetch(input,{...init,signal:init?.signal?AbortSignal.any([deadline,init.signal]):deadline});
          const checks=await Promise.all(models.map(model=>probeModel(model,undefined,values.key,request,managedId)));
          const check=checks.find(result=>!result.ok);
          if(!check)return true;
          if(check.error==='provider_http_401'||check.error==='provider_http_403')return {kind:'ai_auth_rejected'};
          if(check.error==='provider_http_429')return {kind:'ai_rate_limited'};
          if(check.error&&/^(model_mismatch|invalid_json|stream_missing|stream_error|stream_incomplete|extraction_failed)$/.test(check.error))
            return {kind:'ai_response_invalid'};
          return {kind:'ai_check_failed'};
        }};
    }
    case 'smtp': {
      const {configuredSmtpAccount}=await import('./enrollmentMail.ts');
      const account = await configuredSmtpAccount(db as Parameters<typeof configuredSmtpAccount>[0],id,lock);
      if (!account) return fail(404,'credential_not_found');
      return {id:smtpCredentialTarget(account), legacy:() => {
        const password = resolveMailPassword(slot.environment,account);
        return password ? {password} : undefined;
      }, fields:['password'], context:[account.address,account.host,String(account.port)], validation:'provider',
      validate:values => verifySmtpCredential(account,values.password)};
    }
    case 'lark-group': {
      const config = (await db.query(`SELECT config FROM notification_channels WHERE id=:p1${lock?' FOR UPDATE':''}`,[id])).rows[0]?.config;
      if (!config || config.deleted) return fail(404,'credential_not_found');
      const signing = config.signingEnabled ?? !!config.signingSecretRef;
      return {id:groupCredentialTarget(config), legacy:() => legacyGroupCredential(id,config),
        fields:signing?['webhook','signingKey']:['webhook'],context:[config.groupName||id],validation:'manual',
        validate:async values => validGroupCredential(values,signing)};
    }
    case 'lark-app': {
      if (id !== 'default') return fail(404,'credential_not_found');
      const settings=await larkSettings(db);
      return {id:larkSettingsTarget(settings),legacy:legacyLarkAppCredential,fields:['key'],
        context:[settings.appId,settings.tenant,settings.callback],
        validation:'provider', validate:async values => {
          const {larkSelfConfiguration}=await import('./larkSelfService.ts');
          const env={...process.env,LARK_APP_ID:settings.appId,LARK_TENANT_KEY:settings.tenant,LARK_OAUTH_REDIRECT_URI:settings.callback};
          if(!larkSelfConfiguration(env,values.key).ready)return false;
          return Boolean(await new LarkApp(env,undefined,async () => ({appId:settings.appId,key:values.key})).token());
        }};
    }
    case 'ga': {
      if(slot.resource!=='default')return fail(404,'credential_not_found');
      const settings=await gaSettings(db);
      return {id:credentialTarget([settings.measurementId]),fields:['key'],
        legacy:()=>settings.measurementId===process.env.PORTAL_GA_MEASUREMENT_ID?legacyGaCredential():undefined,
        context:[settings.measurementId],validation:'manual',
        validate:async()=>Boolean(settings.measurementId&&settings.measurementId===allowedGaMeasurementId())};
    }
    case 'cos': {
      if (id !== 'default') return fail(404,'credential_not_found');
      const {bucket,region,prefix} = cmsMediaConfiguration();
      return {id:cosCredentialTarget(),legacy:legacyCosCredential,fields:['secretId','secretKey','token'],
        context:[bucket,region,prefix],validation:'provider',validate:values=>verifyCmsStorageCredential(values)};
    }
  }
}

function parseValues(fields: readonly string[], input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail(400,'credential_invalid');
  const values: CredentialValues = Object.create(null);
  for (const field of fields) {
    const value = (input as Record<string,unknown>)[field];
    if (field==='token' && (value===undefined || value==='')) continue;
    if (typeof value!=='string' || !value.trim() || value.length>4096 || /[\x00-\x1f\x7f]/.test(value))
      return fail(400,'credential_invalid');
    values[field] = value;
  }
  return values;
}

function keyringReady() { try { readCredentialKeyring();return true; } catch { return false; } }

export function mountIntegrationCredentials(app: Express, {
  pool, tx, authenticate=platform.authenticate, target=targetFor,
}: {
  pool:CredentialClient;
  tx:<T>(work:(db:CredentialClient)=>Promise<T>)=>Promise<T>;
  authenticate?:(q:Request)=>Promise<Employee|null>;
  target?:typeof targetFor;
}) {
  const path='/api/admin/integration-credentials';
  const route=(work:(q:Request,r:Response)=>Promise<unknown>)=>(q:Request,r:Response)=>{
    r.set('Cache-Control','no-store');
    // Provider errors can contain the target URL or credential. Only expose local diagnostic codes.
    void work(q,r).catch(error => {
      const code = error instanceof Error && /^credential_[a-z_]+$/.test(error.message) ? error.message : 'credential_unavailable';
      r.status(code==='credential_unavailable'?503:error.status||503).json({error:code});
    });
  };
  const requireAdministrator=async(q:Request)=>{
    if (q.method!=='GET' && !validMutationOrigin(q)) return fail(403,'credential_origin_rejected');
    const user=await authenticate(q);
    if (!user || user.active===false || user.passwordChangeRequired) return fail(401,'credential_login_required');
    if (!isAiAdministrator(user)) return fail(403,'credential_forbidden');
    return user;
  };
  const slotFor=(q:Request)=>{
    const kind=String(q.params.kind) as CredentialKind, id=String(q.params.resource);
    if (!credentialKinds.includes(kind) || !id || id.length>254 || /[\x00-\x20\x7f]/.test(id)) return fail(404,'credential_not_found');
    return credentialSlot(kind,id);
  };
  app.get(path,route(async(q,r)=>{
    await requireAdministrator(q);
    r.json({environment:credentialSlot('ga','default').environment,keyringReady:keyringReady(),
      bootstrap:{database:!!process.env.MYSQL_TRIAL_URL},
      gaEnabled:(await gaSettings(pool)).dispatchEnabled});
  }));
  const gaPath=path+'/ga-settings';
  app.get(gaPath,route(async(q,r)=>{
    await requireAdministrator(q);
    r.json({settings:await gaSettings(pool),allowedMeasurementId:allowedGaMeasurementId()});
  }));
  app.post(gaPath,route(async(q,r)=>{
    const actor=await requireAdministrator(q);
    const settings=await tx(async db=>{
      await db.query("SELECT value FROM access_state WHERE id='policy' FOR UPDATE");
      if((await requireAdministrator(q)).id!==actor.id)return fail(403,'credential_forbidden');
      const next=await saveGaSettings(db,q.body?.settings);
      await db.query('INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)',
        [actor.id,'access.integration.ga_settings',next]);
      return next;
    });
    r.json({settings,allowedMeasurementId:allowedGaMeasurementId()});
  }));
  const settingsPath=path+'/lark-settings';
  const settingsResult=async(db:CredentialClient,actor:string,id:string)=>
    (await db.query('SELECT fingerprint,result FROM access_operations WHERE actor_id=:p1 AND operation_id=:p2',[actor,'lark-settings:'+id])).rows[0];
  app.get(settingsPath,route(async(q,r)=>{
    await requireAdministrator(q);
    const settings=await larkSettings(pool);
    const groups=(await pool.query('SELECT id,config FROM notification_channels ORDER BY id')).rows
      .filter(row=>!row.config.deleted).map(({id,config})=>({id,name:config.groupName||id,mode:config.mode,
        signing:config.signingEnabled??Boolean(config.signingSecretRef)}));
    r.json({settings,locked:await larkIdentityLocked(pool),groups});
  }));
  app.get(settingsPath+'/results/:id',route(async(q,r)=>{
    const actor=await requireAdministrator(q),id=String(q.params.id);
    if(!uuid.test(id))return fail(400,'credential_invalid');
    const receipt=await settingsResult(pool,actor.id,id);
    r.json(receipt?{state:'committed',settings:receipt.result}:{state:'unconfirmed'});
  }));
  app.post(settingsPath,route(async(q,r)=>{
    const actor=await requireAdministrator(q),{requestId,settings}=q.body??{};
    if(typeof requestId!=='string'||!uuid.test(requestId))return fail(400,'credential_invalid');
    const fingerprint=credentialTarget([JSON.stringify(settings)??'']);
    const updated=await tx(async db=>{
      await db.query("SELECT value FROM access_state WHERE id='policy' FOR UPDATE");
      if((await requireAdministrator(q)).id!==actor.id)return fail(403,'credential_forbidden');
      const previous=await settingsResult(db,actor.id,requestId);
      if(previous){
        if(previous.fingerprint!==fingerprint)return fail(409,'credential_conflict');
        return previous.result;
      }
      const result=await saveLarkSettings(db,settings);
      await db.query('INSERT INTO access_operations(actor_id,operation_id,action,fingerprint,result) VALUES(:p1,:p2,:p3,:p4,:p5)',
        [actor.id,'lark-settings:'+requestId,'access.integration.lark_settings',fingerprint,result]);
      await db.query('INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)',
        [actor.id,'access.integration.lark_settings',{revision:result.revision}]);
      return result;
    });
    r.json({settings:updated});
  }));
  const item=path+'/:kind/:resource';
  app.get(item,route(async(q,r)=>{
    await requireAdministrator(q);
    const slot=slotFor(q),state=await credentialState(pool,slot);
    const destination=await target(pool,slot);
    r.json({...safeCredentialState(state,!usesDirectCredentialSetup(slot.type)),source:credentialSource(state,slot,destination.id,destination.legacy).source,
      keyringReady:keyringReady(),
      context:destination.context,fields:destination.fields,validation:destination.validation});
  }));
  app.get(item+'/results/:id',route(async(q,r)=>{
    const employee=await requireAdministrator(q),slot=slotFor(q);
    if (!uuid.test(String(q.params.id))) return fail(400,'credential_invalid');
    const {rows}=await pool.query('SELECT result FROM access_operations WHERE actor_id=:p1 AND operation_id=:p2',
      [employee.id,'integration:'+q.params.id]);
    const result=rows[0]?.result;
    r.json(result?.slot===JSON.stringify(slot)?{state:'committed',revision:result.revision,outcome:result.outcome,diagnostic:result.diagnostic}:{state:'unconfirmed'});
  }));
  app.post(item,route(async(q,r)=>{
    const employee=await requireAdministrator(q),slot=slotFor(q);
    const {action, revision, requestId}=q.body??{};
    const directSetup=usesDirectCredentialSetup(slot.type);
    const canReplace=canReplaceCurrentCredential(slot.type);
    const actions=directSetup?['set','revoke']:['stage','import','verify','activate','revoke'];
    if (!actions.includes(action) || !Number.isSafeInteger(revision) ||
      typeof requestId!=='string' || !uuid.test(requestId)) return fail(400,'credential_invalid');
    const opId='integration:'+requestId;
    const setupId=action==='set'?randomUUID():undefined;
    let fingerprint=createHash('sha256').update(JSON.stringify([slot,action,revision,q.body.version,q.body.confirmed])).digest('hex');
    if(action==='stage'||action==='set'){
      if(!keyringReady())return fail(422,'credential_keyring_unavailable');
      const keyring=readCredentialKeyring();
      fingerprint=createHmac('sha256',keyring.keys.get(keyring.active)!).update(fingerprint).update(JSON.stringify(q.body.values??null)).digest('hex');
    }
    const run=async(db:CredentialClient,verification?:VerificationResult,expectedTarget?:string)=>{
      await db.query("SELECT value FROM access_state WHERE id='policy' FOR UPDATE");
      const current=await requireAdministrator(q);
      if(current.id!==employee.id)return fail(403,'credential_forbidden');
      const state=await credentialState(db,slot,true);
      const {rows}=await db.query('SELECT fingerprint,result FROM access_operations WHERE actor_id=:p1 AND operation_id=:p2',[current.id,opId]);
      if (rows[0]) {
        if(rows[0].fingerprint!==fingerprint) return fail(409,'credential_conflict');
        return rows[0].result;
      }
      if(state.revision!==revision)return fail(409,'credential_conflict');
      const destination=await target(db,slot,true);
      const aiSettings=slot.type==='ai'&&(action==='revoke'||action==='set'&&verification===true)?await aiState(db):undefined;
      const supplierId=isAiSupplierId(slot.resource)?slot.resource:undefined;
      const supplier=supplierId&&aiSettings?.suppliers?.[supplierId];
      if(action==='revoke'&&supplier&&supplierId&&supplierInUse(aiSettings,supplierId))
        return fail(409,'credential_supplier_in_use');
      if(action==='set'&&destination.legacyMiniMaxInUse)return fail(409,'credential_minimax_legacy_in_use');
      if(action==='set'&&!canReplace&&(state.active||!state.managed&&destination.legacy()))
        return fail(409,'credential_revoke_current_required');
      const next={...state,revision:revision+1,updatedAt:new Date().toISOString()};
      if(action==='set'){
        if((state.setup??state.smtpSetup)?.id!==setupId||credentialTarget([destination.id,...destination.context])!==expectedTarget)
          return fail(409,'credential_conflict');
        if(verification===true){
          next.managed=true;
          next.active=makeCredentialVersion(slot,destination.id,parseValues(destination.fields,q.body.values));
        }else if(canReplace)next.updatedAt=state.updatedAt;
        delete next.setup;
        delete next.smtpSetup;
      }else if(action==='stage'||action==='import'){
        if(!keyringReady())return fail(503,'credential_keyring_unavailable');
        if(action==='import'&&state.managed)return fail(403,'credential_forbidden');
        const values=parseValues(destination.fields,action==='import'?destination.legacy():q.body.values);
        if(slot.type==='lark-group'&&!validGroupCredential(values,destination.fields.includes('signingKey')))
          return fail(400,'credential_invalid');
        next.candidate=makeCredentialVersion(slot,destination.id,values);
      }else if(action==='verify'){
        const candidate=state.candidate;
        if(!candidate||candidate.id!==q.body.version||candidate.target!==destination.id||credentialTarget(destination.context)!==expectedTarget||candidate.validation?.requestId!==requestId)
          return fail(409,'credential_conflict');
        next.candidate={...candidate,receipt:{at:Date.now(),scope:expectedTarget!,outcome:verification===true?'verified':'failed',
          diagnostic:typeof verification==='object'?verification:undefined}};
        delete next.candidate.validation;
      }else if(action==='activate'){
        const candidate=verifiedCandidate(state,destination.id);
        if(candidate.id!==q.body.version||candidate.receipt?.scope!==credentialTarget(destination.context))return fail(409,'credential_conflict');
        credentialVersionValues(slot,candidate);
        next.managed=true;
        next.active=candidate;
        delete next.candidate;
      }else{
        next.managed=true;
        delete next.active;
        delete next.candidate;
        delete next.setup;
        delete next.smtpSetup;
      }
      await storeCredentialState(db,slot,next);
      if(aiSettings){
        // A test performed with an earlier credential cannot authorize a model change.
        const verified=action==='set';
        // Keep the stored enabled value compatible with a rollback to the previous release.
        const nextSupplier=supplierId&&(verified?{id:supplierId,name:supplier?.name??aiSupplierTemplates[supplierId].name,
          models:[...aiSupplierTemplates[supplierId].models],verified:true,enabled:true}:supplier&&{...supplier,verified:false,enabled:false});
        await saveAiSettings(db,{...aiSettings,revision:aiSettings.revision+1,checks:[],
          ...(supplierId&&nextSupplier?{suppliers:{...aiSettings.suppliers,[supplierId]:nextSupplier}}:{})});
      }
      const result={slot:JSON.stringify(slot),revision:next.revision,
        outcome:action==='set'?verification===true?'verified':'failed':next.candidate?.receipt?.outcome,
        diagnostic:action==='set'&&typeof verification==='object'?verification:next.candidate?.receipt?.diagnostic};
      await db.query('INSERT INTO access_operations(actor_id,operation_id,action,fingerprint,result) VALUES(:p1,:p2,:p3,:p4,:p5)',
        [current.id,opId,'access.integration.'+action,fingerprint,result]);
      await db.query('INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)',[current.id,'access.integration.'+action,
        {environment:slot.environment,kind:slot.type,resource:slot.resource,revision:next.revision,requestId,outcome:result.outcome,diagnostic:result.diagnostic}]);
      return result;
    };
    let verification:VerificationResult|undefined,expectedTarget:string|undefined;
    if(action==='verify'||action==='set'){
      const work=await tx(async(db:CredentialClient)=>{
        await db.query("SELECT value FROM access_state WHERE id='policy' FOR UPDATE");
        const current=await requireAdministrator(q);
        if(current.id!==employee.id)return fail(403,'credential_forbidden');
        const state=await credentialState(db,slot,true);
        const previous=(await db.query('SELECT fingerprint,result FROM access_operations WHERE actor_id=:p1 AND operation_id=:p2',[employee.id,opId])).rows[0];
        if(previous){
          if(previous.fingerprint!==fingerprint)return fail(409,'credential_conflict');
          return {previous};
        }
        const destination=await target(db,slot,true);
        if(state.revision!==revision)return fail(409,'credential_conflict');
        if(action==='set'&&destination.legacyMiniMaxInUse)return fail(409,'credential_minimax_legacy_in_use');
        if(destination.validation==='manual'&&q.body.confirmed!==true)return fail(403,'credential_manual_confirmation_required');
        if(setupId){
          if(!canReplace&&(state.active||!state.managed&&destination.legacy()))return fail(409,'credential_revoke_current_required');
          const setupTarget=credentialTarget([destination.id,...destination.context]);
          const previousSetup=state.setup??state.smtpSetup;
          if(previousSetup?.target===setupTarget&&previousSetup.until>Date.now())return fail(409,'credential_verification_running');
          const values=parseValues(destination.fields,q.body.values);
          await storeCredentialState(db,slot,{...state,candidate:undefined,smtpSetup:undefined,setup:{id:setupId,target:setupTarget,until:Date.now()+180_000}});
          return {target:destination,values};
        }
        const candidate=state.candidate;
        if(!candidate||candidate.id!==q.body.version||candidate.target!==destination.id)return fail(409,'credential_conflict');
        if(candidate.validation&&candidate.validation.until>Date.now())return fail(409,'credential_verification_running');
        const values=credentialVersionValues(slot,candidate);
        await storeCredentialState(db,slot,{...state,candidate:{...candidate,receipt:undefined,
          validation:{requestId,until:Date.now()+180_000}}});
        return {target:destination,values};
      });
      if(work.previous)return r.json({revision:work.previous.result.revision,outcome:work.previous.result.outcome,diagnostic:work.previous.result.diagnostic});
      expectedTarget=credentialTarget(action==='set'?[work.target.id,...work.target.context]:work.target.context);
      try { verification=await work.target.validate(work.values); }
      catch { verification=slot.type==='smtp'?{kind:'smtp_unknown'}:slot.type==='ai'?{kind:'ai_check_failed'}:false; }
    }
    const result=await tx((db:CredentialClient)=>run(db,verification,expectedTarget));
    r.json({revision:result.revision,outcome:result.outcome,diagnostic:result.diagnostic});
  }));
}
