import test from 'node:test';
import assert from 'node:assert/strict';
import {restorePolicyDefaults} from '../src/utils/crmPolicyReset.ts';
import {DEFAULT_CRM_POLICY_CONFIG} from '../src/types/crmPolicyConfig.ts';
import {policyMessage} from '../src/utils/crmPolicyValidation.ts';
const response=(v:any,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
function mock(steps:Array<()=>Response|Promise<Response>>) {const calls:Array<{url:any,options:any}>=[];const request=(async(url:any,options:any)=>{calls.push({url,options});const next=steps.shift();if(!next)throw Error('Unexpected request');return next();}) as typeof fetch;return {request,calls};}
test('#678 restore uses the existing save endpoint, verifies persisted defaults and makes one write only',async()=>{
 const saved={...structuredClone(DEFAULT_CRM_POLICY_CONFIG),updatedAt:'2026-10-21T12:00:00Z'};
 const m=mock([()=>response({success:true}),()=>response(saved)]);
 assert.deepEqual(await restorePolicyDefaults(m.request),saved);
 assert.deepEqual(m.calls.map(c=>[c.url,c.options.method||'GET']),[['/api/crm/policy-config','POST'],['/api/crm/policy-config','GET']]);
 assert.deepEqual(JSON.parse(m.calls[0].options.body),DEFAULT_CRM_POLICY_CONFIG);
});
test('#678 lost save response is reconciled by reading, never repeated automatically',async()=>{
 const m=mock([()=>{throw Error('TEST timeout after commit');},()=>response(DEFAULT_CRM_POLICY_CONFIG)]);
 await restorePolicyDefaults(m.request);assert.equal(m.calls.length,2);
});
test('#678 access rejection, unavailable read-back and concurrent non-default save cannot report restoration success',async()=>{
 for(const status of [401,403,400]){const m=mock([()=>response({},status)]);await assert.rejects(restorePolicyDefaults(m.request),(e:any)=>['policy_save_login','policy_save_forbidden','policy_save_rejected'].includes(e.code));assert.equal(m.calls.length,1);}
 const unreadable=mock([()=>response({success:true}),()=>response({},503)]);await assert.rejects(restorePolicyDefaults(unreadable.request),(e:any)=>e.code==='policy_reset_unknown');
 const changed=structuredClone(DEFAULT_CRM_POLICY_CONFIG);changed.firstResponseSla.hot.value=8;
 const concurrent=mock([()=>response({success:true}),()=>response(changed)]);await assert.rejects(restorePolicyDefaults(concurrent.request),(e:any)=>e.code==='policy_reset_not_applied');
 for(const lang of ['en','id','zh'] as const)for(const code of ['policy_reset_unknown','policy_reset_not_applied'] as const)assert.ok(policyMessage(code,lang));
});
