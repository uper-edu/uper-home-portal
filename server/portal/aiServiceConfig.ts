import {integrationCredential,type CredentialClient} from './integrationCredentials.ts';
import {aiCredentialProviders,aiCredentialTarget,aiCredentialUrl, legacyAiCredential} from './integrationCredentialTargets.ts';
import {aiModels,initialAiSelection} from '../../src/data/system-defaults/ai.ts';
import {randomUUID} from 'node:crypto';
import {auditLog} from './audit.ts';
const tx=async(work:any)=>(await import('./store.ts')).tx(work);
import {validMutationOrigin} from './accessTransport.ts';
import {acceptedModel,requestAiReply} from './aiProviderRequest.ts';
import {readAiReply} from './chatProviderReply.ts';
import type {AiSupplierId} from '../../src/utils/aiSupplier.ts';
import {managedSupplierForModel, saveAiSettings, selectableAiModels, supplierViews} from './aiSupplierSettings.ts';
import {aiModelSlots,defaultReasoningEffort,effortField,isClaudeModel,reasoningEfforts,sameAiSelection,selectedReasoningEffort,supportsReasoningEffort,type AiSelection,type ReasoningEffort} from '../../src/utils/aiModelSelection.ts';
export {aiModels};
export {acceptedModel};
const defaults=()=>initialAiSelection(process.env.OPENAI_MODEL);
export function validateSelection(v:any,models:readonly string[]=aiModels):AiSelection {
 if(!v||!models.includes(v.primary)||!models.includes(v.fallback)||v.primary===v.fallback)throw Object.assign(Error('invalid_selection'),{status:400});
 const selection:AiSelection={primary:v.primary,fallback:v.fallback};
 for(const role of aiModelSlots){
  const key=effortField[role],effort=v[key];
  if(effort===undefined)continue;
  if(!supportsReasoningEffort(selection[role])||!reasoningEfforts.includes(effort))fail(400,'invalid_reasoning_effort');
  if(effort!==defaultReasoningEffort)selection[key]=effort;
 }
 return selection;
}
export function providerFor(model:string,reasoningEffort?:ReasoningEffort,managedSupplier?:AiSupplierId){
 const deep=model==='deepseek-v4-pro'||model==='deepseek-flash'||model==='deepseek-chat';
 const minimax=model==='MiniMax-M3.1-Flash';
 const minimaxDirect=minimax&&managedSupplier==='minimax';
 const provider=minimaxDirect?'minimax':isClaudeModel(model)?'anthropic':deep?'deepseek':'openai';
 return {
  model,
  provider,
  key:minimax&&!minimaxDirect?(process.env.MINIMAX_API_KEY||process.env.OPENAI_API_KEY):legacyAiCredential(provider)?.key,
  url:minimax&&!minimaxDirect?(process.env.MINIMAX_API_BASE_URL||process.env.OPENAI_API_BASE_URL||'https://api.minimaxi.com/v1/chat/completions').replace(/\/v1\/?$/,'/v1/chat/completions'):aiCredentialUrl(provider),
  ...(supportsReasoningEffort(model)&&reasoningEffort?{reasoningEffort}:{}),
 };
}
export async function aiState(db?:any){db ||= (await import('./store.ts')).pool;return (await db.query("SELECT value FROM portal_settings WHERE id='ai_service'")).rows[0]?.value||{revision:0,current:defaults(),previous:null,checks:[],history:[]};}
export async function configuredAiKey(provider:string,db?:CredentialClient,allowLegacy=true){
 return (await integrationCredential('ai',provider,aiCredentialTarget(provider),()=>allowLegacy?legacyAiCredential(provider):undefined,db))?.key;
}
async function aiSupplierConfiguration(settings:Awaited<ReturnType<typeof aiState>>,db?:CredentialClient) {
 const keys=Object.fromEntries(await Promise.all(aiCredentialProviders.filter(provider=>provider!=='minimax'||settings.suppliers?.minimax).map(async provider=>
  [provider,!!await configuredAiKey(provider,db,!settings.suppliers?.[provider])])));
 const suppliers=supplierViews(settings,keys);
 return {keys,suppliers,models:selectableAiModels(settings,suppliers)};
}
export async function runtimeProviders(db?:CredentialClient){
 const usesDatabase=Boolean(process.env.MYSQL_TRIAL_URL);
 const s=usesDatabase?await aiState(db):{current:defaults()};
 const keys=new Map<string,ReturnType<typeof configuredAiKey>>();
 return Promise.all(aiModelSlots.map(async role=>{
  const model=s.current[role];
  const provider=providerFor(model,s.current[effortField[role]],managedSupplierForModel(s,model));
  const supplier=s.suppliers?.[provider.provider];
  if(supplier&&(!supplier.verified||!supplier.models.includes(provider.model)))return {...provider,key:undefined};
  if(provider.model==='MiniMax-M3.1-Flash'&&provider.provider!=='minimax'&&process.env.MINIMAX_API_KEY){
   return {...provider,key:process.env.MINIMAX_API_KEY};
  }
  let key=keys.get(provider.provider);
  if(!key){
   key=configuredAiKey(provider.provider,usesDatabase?db:undefined,!supplier);
   keys.set(provider.provider,key);
  }
  return {...provider,key:await key};
 }));
}
import {isAiAdministrator} from '../../src/utils/aiServicePolicy.ts';
export {isAiAdministrator};
const fail=(status:number,message:string):never=>{throw Object.assign(Error(message),{status});};
export function activationCheck(s:any,body:any,actor:string,now=Date.now()){
 if(body.revision!==s.revision)fail(409,'conflict');
 const check=s.checks?.find((v:any)=>v.id===body.checkId&&v.actor===actor&&v.revision===s.revision&&v.ok&&v.expiresAt>now);
 if(!check)fail(400,'test_required');
 if(body.restore===true&&(!s.previous||!sameAiSelection(check.selection,s.previous)))fail(409,'conflict');
 return check;
}

export async function probeModel(model:string,reasoningEffort?:ReasoningEffort,candidateKey?:string,request:typeof fetch=fetch,managedSupplier?:AiSupplierId){
 const p=providerFor(model,reasoningEffort,managedSupplier);
 p.key=candidateKey??(model==='MiniMax-M3.1-Flash'&&p.provider!=='minimax'&&process.env.MINIMAX_API_KEY?process.env.MINIMAX_API_KEY:await configuredAiKey(p.provider));
 if(!p.key)return {model,ok:false,error:'key_missing'};
 let calls=0;const start=Date.now();
 try{
  const messages=[{role:'user',content:'TEST connection check. Return JSON only: {"ok":true}'}];
  const ask=async(stream?:true)=>{
   calls++;
   const response=await requestAiReply(request,p,messages,{tokens:600,temperature:0,stream,json:!stream,quick:true,redirect:'error',signal:AbortSignal.timeout(90000)});
   if(!response.ok)throw Error('provider_http_'+response.status);
   if(stream&&!response.headers.get('content-type')?.includes('text/event-stream'))throw Error('stream_missing');
   try {return await readAiReply(response,()=>{},()=>{},model);}
   catch(error){
    const message=(error as Error).message;
    if(message==='model_mismatch')throw error;
    throw Error(!stream?'invalid_json':message==='Missing provider stream end marker'?'stream_incomplete':'stream_error');
   }
  };
  const checkJson=(content:string)=>{try {if(JSON.parse(content)?.ok===true)return;} catch {} throw Error('invalid_json');};
  const direct=await ask();if(!acceptedModel(model,direct.model||''))throw Error('model_mismatch');checkJson(direct.content);
  const streamed=await ask(true);const actual=streamed.model||'';if(!streamed.content||!acceptedModel(model,actual))throw Error('stream_incomplete');
  if(isClaudeModel(model)||p.provider==='minimax')checkJson(streamed.content);
  const {extractWithAI}=await import('./aiExtraction.ts');const traced:typeof fetch=async(input,init)=>{calls++;return request(input,{...init,redirect:'error'});};const extracted=await extractWithAI('我的课程预算是150万印尼盾。',{},traced,[p]);if(!acceptedModel(model,extracted.model)||!extracted.observations.some((v:any)=>v.field==='budgetAmount'&&v.value===1500000))throw Error('extraction_failed');
  return {model,ok:true,actualModel:actual,calls,durationMs:Date.now()-start};
 }catch(e){const message=(e as Error).message;return {model,ok:false,error:/^(provider_http_\d+|model_mismatch|invalid_json|stream_missing|stream_error|stream_incomplete|extraction_failed)$/.test(message)?message:'test_failed',calls,durationMs:Date.now()-start};}
}
export function mountAiServiceConfig(app:any){
 const guard=async(q:any)=>{const {platform}=await import('./identity.ts');const e=await platform.authenticate(q);if(!e)fail(401,'login_required');if(!isAiAdministrator(e))fail(403,'admin_required');if(q.method!=='GET'&&!validMutationOrigin(q))fail(403,'origin_rejected');return e;};
 const wrap=(f:any)=>(q:any,r:any)=>Promise.resolve(f(q,r)).catch((e:any)=>r.status(e.status||503).json({error:e.status?e.message:'unavailable'}));
 app.get('/api/admin/ai-service',wrap(async(q:any,r:any)=>{await guard(q);const {pool}=await import('./store.ts');const s=await aiState();const attempts=(await pool.query('SELECT a.model,a.error,a.created_at,m.model AS final_model FROM ai_attempts a LEFT JOIN messages m ON m.id=a.message_id ORDER BY a.created_at DESC LIMIT 12')).rows.map((a:any)=>({model:a.model,ok:!a.error,at:a.created_at,fallbackModel:a.error&&a.final_model&&a.final_model!==a.model?a.final_model:null}));const extractions=(await pool.query('SELECT model,status,completed_at FROM crm_ai_extractions WHERE model IS NOT NULL ORDER BY completed_at DESC LIMIT 8')).rows;r.setHeader('Cache-Control','no-store');r.json({...s,...await aiSupplierConfiguration(s,pool),attempts,extractions});}));
 app.post('/api/admin/ai-service/test',wrap(async(q:any,r:any)=>{const e=await guard(q),before=await aiState();if(q.body.revision!==before.revision)fail(409,'conflict');
 const {models}=await aiSupplierConfiguration(before);
 const selection=validateSelection(q.body.selection,models);
 const results=await Promise.all(aiModelSlots.map(async role=>{
  const model=selection[role],effort=selectedReasoningEffort(selection,role);
  const id=managedSupplierForModel(before,model);
  const supplier=id&&before.suppliers[id];
  const managedKey=id ? supplier.verified?await configuredAiKey(id,undefined,false)??'':'' : undefined;
  return probeModel(model,effort,managedKey,fetch,id);
 }));const check={id:randomUUID(),actor:e.id,selection,revision:before.revision,at:new Date().toISOString(),expiresAt:Date.now()+600000,ok:results.every(x=>x.ok),results};await tx(async(c:any)=>{await c.query("SELECT value FROM access_state WHERE id='policy' FOR UPDATE");await guard(q);const s=await aiState(c);if(s.revision!==before.revision)fail(409,'conflict');await saveAiSettings(c,{...s,checks:[check,...(s.checks||[])].slice(0,10)});});r.json(check);}));
 app.post('/api/admin/ai-service/activate',wrap(async(q:any,r:any)=>{await guard(q);if(typeof q.body.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(q.body.requestId))fail(400,'invalid_request');const saved=await tx(async(c:any)=>{await c.query("SELECT value FROM access_state WHERE id='policy' FOR UPDATE");const e=await guard(q),s=await aiState(c);const old=s.history?.find((v:any)=>v.requestId===q.body.requestId&&v.actor===e.id);if(old)return old; const check=activationCheck(s,q.body,e.id);const restore=q.body.restore===true;const record={requestId:q.body.requestId,actor:e.id,revision:s.revision+1,current:check.selection,previous:s.current,at:new Date().toISOString(),restore};await saveAiSettings(c,{...s,...record,checks:[],history:[record,...(s.history||[])].slice(0,30)});await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'ai.configuration',:p2)",[e.id,record]);auditLog(e.id,'ai.configuration',{requestId:q.body.requestId});return record;});r.json(saved);}));
}
