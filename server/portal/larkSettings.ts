import {credentialError, credentialSlot, credentialTarget, credentialState, credentialVersionValues, makeCredentialVersion, storeCredentialState, type CredentialClient} from './integrationCredentials.ts';

export const larkCallbackPath='/api/crm/lark/callback';
export type LarkSettings={appId:string; tenant:string; callback:string; revision:number};
const settingsId=()=>`lark_application:${credentialSlot('lark-app','default').environment}`;
export const larkSettingsTarget=(settings:LarkSettings)=>credentialTarget([settings.appId,settings.tenant,settings.callback]);

export async function larkSettings(db?:CredentialClient):Promise<LarkSettings>{
  const legacy={appId:process.env.LARK_APP_ID||'',tenant:process.env.LARK_TENANT_KEY||'',callback:process.env.LARK_OAUTH_REDIRECT_URI||'',revision:0};
  if(!process.env.PORTAL_ENV||!db&&!process.env.MYSQL_TRIAL_URL)return legacy;
  const client=db??(await import('./store.ts')).pool;
  const {rows}=await client.query('SELECT value FROM portal_settings WHERE id=:p1',[settingsId()]);
  return rows[0]?.value??legacy;
}

export function larkCallback(callback:string, env=process.env, enforceOrigin=true){
  try {
    const url=new URL(callback);
    if(url.username||url.password||url.search||url.hash||url.pathname!==larkCallbackPath)return;
    if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))return;
    if(enforceOrigin){
      const configured=env.PORTAL_PUBLIC_ORIGIN;
      if(!configured||url.origin!==new URL(configured).origin)return;
      if(url.protocol==='http:'&&env.PORTAL_ENV!=='dev')return;
      if(callback!==url.origin+larkCallbackPath)return;
    }
    return url;
  }catch{return undefined;}
}

export async function larkIdentityLocked(db:CredentialClient){
  const {rows}=await db.query("SELECT value FROM access_state WHERE id='lark_bindings'");
  return Object.values(rows[0]?.value??{}).some((entry:any)=>Boolean(entry?.openId&&!entry.removed));
}

// Call in a transaction holding the access policy lock, shared by credential and binding writes.
export async function saveLarkSettings(db:CredentialClient, input:unknown){
  if(!input||typeof input!=='object')return credentialError(400,'credential_invalid');
  const {appId,tenant,callback,revision}=input as LarkSettings;
  if(typeof appId!=='string'||!/^cli_[A-Za-z0-9_-]{1,100}$/.test(appId)||
     typeof tenant!=='string'||!/^[\w-]{1,191}$/.test(tenant)||typeof callback!=='string'||!larkCallback(callback)||
     !Number.isSafeInteger(revision))return credentialError(400,'credential_lark_settings_invalid');
  const current=await larkSettings(db);
  if(current.revision!==revision)return credentialError(409,'credential_conflict');
  const next={appId,tenant,callback,revision:revision+1};
  const identityChanged=current.appId!==appId||current.tenant!==tenant;
  if(identityChanged&&await larkIdentityLocked(db))return credentialError(409,'credential_lark_identity_locked');
  const slot=credentialSlot('lark-app','default');
  const state=await credentialState(db,slot,true);
  if(identityChanged&&(state.active||!state.managed&&process.env.LARK_APP_SECRET))
    return credentialError(409,'credential_revoke_current_required');
  if(state.setup&&state.setup.until>Date.now()||state.smtpSetup&&state.smtpSetup.until>Date.now())
    return credentialError(409,'credential_verification_running');
  const previousTarget=larkSettingsTarget(current), target=larkSettingsTarget(next);
  if(state.active&&previousTarget!==target){
    if(state.active.target!==previousTarget)return credentialError(409,'credential_conflict');
    const active=makeCredentialVersion(slot,target,credentialVersionValues(slot,state.active));
    await storeCredentialState(db,slot,{...state,revision:state.revision+1,active,candidate:undefined,updatedAt:active.createdAt});
  }
  await db.query('INSERT INTO portal_settings(id,value) VALUES(:p1,:p2) ON DUPLICATE KEY UPDATE value=:p2',[settingsId(),next]);
  return next;
}
