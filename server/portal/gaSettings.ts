import analytics from '../../src/data/analyticsEnvironments.json';
import {credentialError, credentialSlot, credentialTarget, integrationCredential, type CredentialClient} from './integrationCredentials.ts';

export type GaSettings = {measurementId:string; dispatchEnabled:boolean; revision:number};
const settingsId=()=>`ga_settings:${credentialSlot('ga','default').environment}`;

export function allowedGaMeasurementId(){
  const environment=credentialSlot('ga','default').environment;
  return analytics.environments[environment as keyof typeof analytics.environments]?.measurementId;
}

export async function gaSettings(db?:CredentialClient):Promise<GaSettings>{
  const legacy={measurementId:process.env.PORTAL_GA_MEASUREMENT_ID||'',dispatchEnabled:process.env.PORTAL_GA_DISPATCH_ENABLED==='true',revision:0};
  if(!db&&!process.env.MYSQL_TRIAL_URL)return legacy;
  const client=db??(await import('./store.ts')).pool;
  const {rows}=await client.query('SELECT value FROM portal_settings WHERE id=:p1',[settingsId()]);
  return rows[0]?.value??legacy;
}

export function gaCredential(settings:GaSettings,db?:CredentialClient){
  return integrationCredential('ga','default',credentialTarget([settings.measurementId]),()=>{
    const key=process.env.PORTAL_GA_API_SECRET?.trim();
    return key&&settings.measurementId===process.env.PORTAL_GA_MEASUREMENT_ID?{key}:undefined;
  },db);
}

// Called with the access policy row locked, matching credential writes.
export async function saveGaSettings(db:CredentialClient,input:unknown){
  const proposed=input as Partial<GaSettings>|null;
  if(!proposed||!Number.isSafeInteger(proposed.revision)||typeof proposed.dispatchEnabled!=='boolean'||
    !allowedGaMeasurementId()||proposed.measurementId!==allowedGaMeasurementId())
    return credentialError(400,'credential_ga_settings_invalid');
  const current=await gaSettings(db);
  if(proposed.revision!==current.revision)return credentialError(409,'credential_conflict');
  const next={measurementId:proposed.measurementId,dispatchEnabled:proposed.dispatchEnabled,revision:current.revision+1};
  if(next.dispatchEnabled&&!(await gaCredential(next,db))?.key)return credentialError(409,'credential_ga_key_required');
  await db.query('INSERT INTO portal_settings(id,value) VALUES(:p1,:p2) ON DUPLICATE KEY UPDATE value=:p2',[settingsId(),next]);
  return next;
}
