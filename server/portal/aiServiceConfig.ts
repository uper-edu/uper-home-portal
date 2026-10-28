import {randomUUID} from 'node:crypto';
const tx=async(work:any)=>(await import('./store.ts')).tx(work);
import {validMutationOrigin} from './accessTransport.ts';
import {modelParameters} from './modelParameters.ts';
export type AiSelection={primary:string;fallback:string};
export const aiModels=['gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna','gpt-4o','deepseek-chat'];
const defaults=():AiSelection=>({primary:process.env.OPENAI_MODEL||'gpt-4o',fallback:'deepseek-chat'});
export function validateSelection(v:any):AiSelection {
 if(!v||!aiModels.includes(v.primary)||!aiModels.includes(v.fallback)||v.primary===v.fallback)throw Object.assign(Error('invalid_selection'),{status:400});
 return {primary:v.primary,fallback:v.fallback};
}
export function providerFor(model:string){const deep=model==='deepseek-chat';return {model,key:deep?process.env.DEEPSEEK_API_KEY:process.env.OPENAI_API_KEY,url:deep?(process.env.DEEPSEEK_API_BASE_URL||'https://api.deepseek.com/chat/completions'):(process.env.OPENAI_API_BASE_URL||'https://api.openai.com/v1/chat/completions')};}
export async function aiState(db?:any){db ||= (await import('./store.ts')).pool;return (await db.query("SELECT value FROM portal_settings WHERE id='ai_service'")).rows[0]?.value||{revision:0,current:defaults(),previous:null,checks:[],history:[]};}
export async function runtimeProviders(){const s=process.env.MYSQL_TRIAL_URL?await aiState():{current:defaults()};return [s.current.primary,s.current.fallback].map(providerFor);}
import {isAiAdministrator} from '../../src/utils/aiServicePolicy.ts';
export {isAiAdministrator};
const fail=(status:number,message:string):never=>{throw Object.assign(Error(message),{status});};
export function activationCheck(s:any,body:any,actor:string,now=Date.now()){
 if(body.revision!==s.revision)fail(409,'conflict');
 const check=s.checks?.find((v:any)=>v.id===body.checkId&&v.actor===actor&&v.revision===s.revision&&v.ok&&v.expiresAt>now);
 if(!check)fail(400,'test_required');
 if(body.restore===true&&JSON.stringify(check.selection)!==JSON.stringify(s.previous))fail(409,'conflict');
 return check;
}

export function acceptedModel(requested:string,actual:string){return actual===requested||actual.startsWith(requested+'-')||(requested==='deepseek-chat'&&actual==='deepseek-flash');}
export async function probeModel(model:string){
 const p=providerFor(model);if(!p.key)return {model,ok:false,error:'key_missing'};
 let calls=0;const start=Date.now();
 try{
  const ask=async(stream=false)=>{calls++;const r=await fetch(p.url,{method:'POST',headers:{Authorization:'Bearer '+p.key,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'user',content:'TEST connection check. Return JSON only: {"ok":true}'}],...(stream?{stream:true}:{response_format:{type:'json_object'}}),...modelParameters(model,600,0)}),signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('provider_http_'+r.status);return r;};
  const b=await(await ask()).json();if(!acceptedModel(model,String(b.model||'')))throw Error('model_mismatch');if(JSON.parse(b.choices?.[0]?.message?.content||'').ok!==true)throw Error('invalid_json');
  const r=await ask(true);if(!r.headers.get('content-type')?.includes('text/event-stream'))throw Error('stream_missing');let wire='';for await(const chunk of r.body as any)wire+=new TextDecoder().decode(chunk);let text='',actual='';for(const l of wire.split('\n'))if(l.startsWith('data:')&&l.slice(5).trim()!=='[DONE]'){const v=JSON.parse(l.slice(5));if(v.error)throw Error('stream_error');actual=v.model||actual;text+=v.choices?.[0]?.delta?.content||'';}if(!wire.includes('[DONE]')||!text||!acceptedModel(model,actual))throw Error('stream_incomplete');
  const {extractWithAI}=await import('./aiExtraction.ts');const traced:typeof fetch=async(input,init)=>{calls++;return fetch(input,init);};const extracted=await extractWithAI('我的课程预算是150万印尼盾。',{},traced,[p]);if(!acceptedModel(model,extracted.model)||!extracted.observations.some((v:any)=>v.field==='budgetAmount'&&v.value===1500000))throw Error('extraction_failed');
  return {model,ok:true,actualModel:actual,calls,durationMs:Date.now()-start};
 }catch(e){const message=(e as Error).message;return {model,ok:false,error:/^(provider_http_\d+|model_mismatch|invalid_json|stream_missing|stream_error|stream_incomplete|extraction_failed)$/.test(message)?message:'test_failed',calls,durationMs:Date.now()-start};}
}
export function mountAiServiceConfig(app:any){
 const guard=async(q:any)=>{const {platform}=await import('./identity.ts');const e=await platform.authenticate(q);if(!e)fail(401,'login_required');if(!isAiAdministrator(e))fail(403,'admin_required');if(q.method!=='GET'&&!validMutationOrigin(q))fail(403,'origin_rejected');return e;};
 const wrap=(f:any)=>(q:any,r:any)=>Promise.resolve(f(q,r)).catch((e:any)=>r.status(e.status||503).json({error:e.status?e.message:'unavailable'}));
 app.get('/api/admin/ai-service',wrap(async(q:any,r:any)=>{await guard(q);const {pool}=await import('./store.ts');const s=await aiState();const attempts=(await pool.query('SELECT a.model,a.error,a.created_at,m.model AS final_model FROM ai_attempts a LEFT JOIN messages m ON m.id=a.message_id ORDER BY a.created_at DESC LIMIT 12')).rows.map((a:any)=>({model:a.model,ok:!a.error,at:a.created_at,fallbackModel:a.error&&a.final_model&&a.final_model!==a.model?a.final_model:null}));const extractions=(await pool.query('SELECT model,status,completed_at FROM crm_ai_extractions WHERE model IS NOT NULL ORDER BY completed_at DESC LIMIT 8')).rows;r.setHeader('Cache-Control','no-store');r.json({...s,models:aiModels,keys:{openai:!!process.env.OPENAI_API_KEY,deepseek:!!process.env.DEEPSEEK_API_KEY},attempts,extractions});}));
 app.post('/api/admin/ai-service/test',wrap(async(q:any,r:any)=>{const e=await guard(q),selection=validateSelection(q.body.selection),before=await aiState();if(q.body.revision!==before.revision)fail(409,'conflict');const results=await Promise.all([selection.primary,selection.fallback].map(probeModel));const check={id:randomUUID(),actor:e.id,selection,revision:before.revision,at:new Date().toISOString(),expiresAt:Date.now()+600000,ok:results.every(x=>x.ok),results};await tx(async(c:any)=>{await c.query("SELECT value FROM access_state WHERE id='policy' FOR UPDATE");await guard(q);const s=await aiState(c);if(s.revision!==before.revision)fail(409,'conflict');await c.query("INSERT INTO portal_settings(id,value) VALUES('ai_service',:p1) ON DUPLICATE KEY UPDATE value=VALUES(value)",[{...s,checks:[check,...(s.checks||[])].slice(0,10)}]);});r.json(check);}));
 app.post('/api/admin/ai-service/activate',wrap(async(q:any,r:any)=>{await guard(q);if(typeof q.body.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(q.body.requestId))fail(400,'invalid_request');const saved=await tx(async(c:any)=>{await c.query("SELECT value FROM access_state WHERE id='policy' FOR UPDATE");const e=await guard(q),s=await aiState(c);const old=s.history?.find((v:any)=>v.requestId===q.body.requestId&&v.actor===e.id);if(old)return old; const check=activationCheck(s,q.body,e.id);const restore=q.body.restore===true;const record={requestId:q.body.requestId,actor:e.id,revision:s.revision+1,current:check.selection,previous:s.current,at:new Date().toISOString(),restore};await c.query("INSERT INTO portal_settings(id,value) VALUES('ai_service',:p1) ON DUPLICATE KEY UPDATE value=VALUES(value)",[{...record,checks:[],history:[record,...(s.history||[])].slice(0,30)}]);await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'ai.configuration',:p2)",[e.id,record]);return record;});r.json(saved);}));
}
