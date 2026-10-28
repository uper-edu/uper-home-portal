// MySQL is the sole runtime. A foreign driver is an error, never a fallback.
export const databaseDriver = process.env.PORTAL_DATABASE_DRIVER || "mysql";
if (databaseDriver !== "mysql") throw Error("Only MySQL is supported");
export {
  connection,
  id,
  initialize,
} from "../../cloud/mysql/runtime.mjs";
import { tx as nativeTransaction, pool as nativePool } from "../../cloud/mysql/runtime.mjs";
import { operationContext } from "./operationContext.ts";
import {event as nativeEvent} from '../../cloud/mysql/runtime.mjs';
/** Pending submissions are not sales leads yet. Old events are never replayed on release. */
export async function event(client:any,type:string,leadId:string|null,payload:any={}){
 if(leadId){
  const {canonicalIdentity}=await import('./identityConsolidation.ts');
  const original=(await client.query('SELECT profile FROM portal_leads WHERE id=:p1',[leadId])).rows[0]?.profile;
  if(original?.identityLifecycle==='pending')return;
  if(original?.identityMergedInto){
   const root=await canonicalIdentity(client,leadId);
   if(!root)return;
   return nativeEvent(client,type,root.id,{...payload,originLeadId:leadId});
  }
 }
 return nativeEvent(client,type,leadId,payload);
}
export const tx = (work: (client: any) => any, options?: {isolation?: 'READ COMMITTED'}) => {
  const client = operationContext.getStore();
  if(client && options?.isolation && client.transactionIsolation!==options.isolation)
    throw Error('Notification planning requires a new READ COMMITTED transaction');
  return client ? work(client) : nativeTransaction(work, options);
};
export const pool = {
  ...nativePool,
  query: (...args: any[]) => {
    const client = operationContext.getStore();
    return client ? client.query(...args) : nativePool.query(args[0],args[1]);
  },
};
export const databaseConfigured = () => !!process.env.MYSQL_TRIAL_URL;
