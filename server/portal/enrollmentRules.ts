import type { Express, Request, Response } from 'express';
import { validMutationOrigin } from './accessTransport.ts';
import { invalid, operation } from './trustWorkflow.ts';

type Client = { query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}> };
type Handler = (q:Request,r:Response)=>Promise<unknown>;
const defaults = { paymentHours:24, replyHours:48, revision:0 };
const path = '/api/crm/enrollment/rules';
const scope = {leadId:'enrollment-rules',kind:'enrollment.rules.save'};

export async function readEnrollmentRules(c:Client) {
  const stored=(await c.query("SELECT value FROM portal_settings WHERE id='enrollment_rules'")).rows[0]?.value as typeof defaults|undefined;
  return stored??defaults;
}

export function mountEnrollmentRules(app:Express,{wrap,transact,authorize}:{
  wrap:(fn:Handler)=>(q:Request,r:Response)=>void;
  transact:(work:(c:Client)=>Promise<any>)=>Promise<any>;
  authorize:(q:Request)=>Promise<{id:string}>;
}) {
  app.get(path,wrap(async(q,r)=>{
    await authorize(q);
    r.set('Cache-Control','no-store').json(await transact(readEnrollmentRules));
  }));
  app.post(path,wrap(async(q,r)=>{
    const actor=await authorize(q);
    if(!validMutationOrigin(q)) invalid('enrollment_origin_rejected',403);
    const {paymentHours,replyHours,revision}=q.body??{};
    const maximumHours=Math.floor((Date.UTC(9999,11,31,23,59,59)-Date.now())/3_600_000);
    if(![paymentHours,replyHours].every(value=>Number.isSafeInteger(value)&&value>=1&&value<=maximumHours)||
        !Number.isSafeInteger(revision)||revision<0) invalid('enrollment_rules_invalid');
    const result=await transact(c=>operation(c,actor.id,q.body,{...scope,authorize:()=>authorize(q)},async()=>{
      await c.query("INSERT INTO portal_settings(id,value) VALUES('enrollment_rules',:p1) ON DUPLICATE KEY UPDATE id=id",[defaults]);
      const current=(await c.query("SELECT value FROM portal_settings WHERE id='enrollment_rules' FOR UPDATE")).rows[0].value;
      if(current.paymentHours===paymentHours&&current.replyHours===replyHours) return {rules:current};
      if(current.revision!==revision) invalid('enrollment_rules_conflict',409);
      const rules={paymentHours,replyHours,revision:revision+1};
      await c.query("UPDATE portal_settings SET value=:p1 WHERE id='enrollment_rules'",[rules]);
      await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'enrollment.rules.save',:p2)",[actor.id,{before:current,after:rules}]);
      return {rules};
    }));
    r.set('Cache-Control','no-store').json(result);
  }));
  app.get(path+'/results/:requestId',wrap(async(q,r)=>{
    const actor=await authorize(q);
    const result=await transact(async c=>(await c.query('SELECT result FROM crm_operations WHERE actor=:p1 AND request_id=:p2',
      [actor.id,q.params.requestId])).rows[0]?.result);
    if(result?.operationKind!==scope.kind) invalid('enrollment_result_missing',404);
    r.set('Cache-Control','no-store').json(result);
  }));
}
