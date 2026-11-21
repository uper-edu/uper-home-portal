import type { Express,Request,Response } from 'express';
import { enrollmentBankFields,enrollmentBankPlaceholder,type EnrollmentBank } from '../../src/utils/enrollmentBank.ts';
export {hasConfiguredEnrollmentBank} from '../../src/utils/enrollmentBank.ts';
import { validMutationOrigin } from './accessTransport.ts';
import { invalid,operation } from './trustWorkflow.ts';

type Client={query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}>};
type Handler=(q:Request,r:Response)=>Promise<unknown>;
const defaults={bank:enrollmentBankPlaceholder,revision:0};
const path='/api/crm/enrollment/bank';
const scope={leadId:'enrollment-bank',kind:'enrollment.bank.save'};
const fields=Object.keys(enrollmentBankFields) as (keyof EnrollmentBank)[];

function parseBank(input:unknown):EnrollmentBank|null {
  if(!input||typeof input!=='object')return null;
  const values=input as Record<string,unknown>;
  const entries=fields.map(key=>[key,typeof values[key]==='string'?(values[key] as string).trim():null] as const);
  if(entries.some(([key,value])=>!value||value.length>enrollmentBankFields[key]||/[\x00-\x1f\x7f]/u.test(value)))return null;
  return Object.fromEntries(entries) as EnrollmentBank;
}

export async function readEnrollmentBank(c:Client):Promise<{bank:EnrollmentBank;revision:number}> {
  const row=(await c.query("SELECT value FROM portal_settings WHERE id='enrollment_bank'")).rows[0];
  if(!row)return defaults;
  const bank=parseBank(row.value?.bank);
  if(!bank||!Number.isSafeInteger(row.value?.revision)||row.value.revision<0)invalid('enrollment_bank_unavailable',503);
  return {bank,revision:row.value.revision};
}

export function mountEnrollmentBank(app:Express,{wrap,transact,authorize}:{
  wrap:(fn:Handler)=>(q:Request,r:Response)=>void;
  transact:(fn:(c:Client)=>Promise<unknown>)=>Promise<unknown>;
  authorize:(q:Request)=>Promise<{id:string}>;
}) {
  app.get(path,wrap(async(q,r)=>{
    await authorize(q);
    r.set('Cache-Control','no-store').json(await transact(readEnrollmentBank));
  }));
  app.post(path,wrap(async(q,r)=>{
    if(!validMutationOrigin(q))invalid('enrollment_origin_rejected',403);
    const actor=await authorize(q);
    const bank=parseBank(q.body?.bank);
    const revision=q.body?.revision;
    if(!bank||!Number.isSafeInteger(revision)||revision<0)invalid('enrollment_bank_invalid');
    const result=await transact(c=>operation(c,actor.id,q.body,{...scope,authorize:()=>authorize(q)},async()=>{
      await c.query("INSERT INTO portal_settings(id,value) VALUES('enrollment_bank',:p1) ON DUPLICATE KEY UPDATE id=id",[defaults]);
      const current=(await c.query("SELECT value FROM portal_settings WHERE id='enrollment_bank' FOR UPDATE")).rows[0].value;
      const changed=fields.filter(key=>bank[key]!==current.bank?.[key]);
      if(!changed.length)return {settings:{bank,revision:current.revision}};
      if(current.revision!==revision)invalid('enrollment_bank_conflict',409);
      const settings={bank,revision:revision+1};
      await c.query("UPDATE portal_settings SET value=:p1 WHERE id='enrollment_bank'",[settings]);
      await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'enrollment.bank.save',:p2)",
        [actor.id,{revision:settings.revision,changed}]);
      return {settings};
    }));
    r.set('Cache-Control','no-store').json(result);
  }));
  app.get(path+'/results/:requestId',wrap(async(q,r)=>{
    const actor=await authorize(q);
    const result=await transact(async c=>(await c.query('SELECT result FROM crm_operations WHERE actor=:p1 AND request_id=:p2',
      [actor.id,q.params.requestId])).rows[0]?.result) as {operationKind?:string}|undefined;
    if(result?.operationKind!==scope.kind)invalid('enrollment_result_missing',404);
    r.set('Cache-Control','no-store').json(result);
  }));
}
