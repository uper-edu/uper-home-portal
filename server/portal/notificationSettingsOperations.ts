import {createHash,createHmac} from 'node:crypto';
import {invalid,operation} from './trustWorkflow.ts';

type SettingsKind='rule'|'group'|'personal';
type Queryable={query(sql:string,params?:unknown[]):Promise<{rows:any[]}>};
const requestIdPattern=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const operationKind=(kind:SettingsKind)=>'notification.settings.'+kind;

export function notificationGroupSettingsVersion(config:unknown){
  return config?createHash('sha256').update(JSON.stringify(config)).digest('hex'):null;
}

export function checkNotificationSettingsVersion(expected:unknown,current:number|string|null){
  if(expected!==undefined&&expected!==current)invalid('notification_settings_conflict',409);
}

export async function writeNotificationSettings(
  db:Queryable, actor:string, kind:SettingsKind, id:string, input:Record<string,unknown>, apply:()=>Promise<object>,
){
  if(input.requestId===undefined)return apply();
  if(typeof input.requestId!=='string'||!requestIdPattern.test(input.requestId))invalid('notification_settings_invalid');
  const {webhook,...body}=input;
  // Older channel editors may still submit a Webhook directly. The receipt stores no target or secret.
  if(typeof webhook==='string'){
    const key=process.env.ACCESS_OPERATION_KEY||process.env.LARK_WEBHOOK_ENCRYPTION_KEY;
    if(!key)invalid('notification_settings_unavailable',503);
    body.webhookFingerprint=createHmac('sha256',key!).update(webhook).digest('hex');
  }else if(webhook===null)body.webhookCleared=true;
  return operation(db,actor,body,{leadId:id,kind:operationKind(kind)},apply);
}

export async function readNotificationSettingsReceipt(db:Queryable,actor:string,id:string){
  if(!requestIdPattern.test(id))invalid('notification_settings_invalid');
  const result=(await db.query('SELECT result FROM crm_operations WHERE actor=:p1 AND request_id=:p2',[actor,id])).rows[0]?.result;
  if(!['rule','group','personal'].some(kind=>operationKind(kind as SettingsKind)===result?.operationKind))
    invalid('notification_settings_result_missing',404);
  return {success:true};
}
