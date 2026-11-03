import {personalNotificationPreferences,personalNotificationAvailability} from './personalNotificationPreferences.ts';
import {auditLog} from './audit.ts';
import {personalNotificationTypes,normalizePersonalPreferences,personalNotificationRequired} from '../../src/utils/personalNotificationPreferences.ts';
import crypto from 'node:crypto';
import type {Express,Request} from 'express';
import {pool,tx} from './store.ts';
import {platform} from './identity.ts';
import {validMutationOrigin} from './accessTransport.ts';
import {LarkApp,larkBindings} from './larkApp.ts';
const fail=(status:number,message:string):never=>{throw Object.assign(Error(message),{status});};
const hash=(s:string)=>crypto.createHash('sha256').update(s).digest('hex');
const session=(q:Request)=>{const key='uper_crm_session_'+(process.env.PORT||'3000')+'=';const value=(q.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(key))?.slice(key.length);if(!value)fail(401,'Login required');return hash(value!);};
const read=async(c:any,key:string)=>(await c.query('SELECT value FROM portal_settings WHERE id=:p1',[key])).rows[0]?.value;
const write=(c:any,key:string,value:any)=>c.query('INSERT INTO portal_settings(id,value) VALUES(:p1,:p2) ON DUPLICATE KEY UPDATE value=:p2',[key,value]);
const resultLocation=(path:string,kind:string,extra:Record<string,string>)=>{const u=new URL(path,'http://return.invalid');u.searchParams.set('lark',kind);for(const [k,v] of Object.entries(extra))u.searchParams.set(k,v);return u.pathname+u.search+u.hash;};
async function locked(c:any){await c.query("SELECT value FROM access_state WHERE id='policy' FOR UPDATE");}
export function larkSelfConfiguration(env:NodeJS.ProcessEnv=process.env){
 const uri=env.LARK_OAUTH_REDIRECT_URI;let redirect:URL|undefined;
 try{if(uri)redirect=new URL(uri);}catch{}
 const valid=!!redirect&&!redirect.username&&!redirect.password&&!redirect.search&&!redirect.hash&&redirect.pathname==='/api/crm/lark/callback'&&(redirect.protocol==='https:'||(redirect.protocol==='http:'&&['localhost','127.0.0.1'].includes(redirect.hostname)));
 return {ready:!!(valid&&env.LARK_APP_ID&&env.LARK_APP_SECRET&&env.LARK_TENANT_KEY&&env.LARK_BINDING_CONFIRMATIONS_ENABLED==='true'),redirect:valid?redirect:undefined};
}
async function staff(q:Request,mutation=false){const e=await platform.authenticate(q);if(!e||e.active===false)fail(401,'Login required');if(mutation&&!validMutationOrigin(q))fail(403,'access_origin_rejected');return e;}
async function summary(employeeId:string,c:any=pool){const binding=(await larkBindings(c))[employeeId];return {bound:!!binding?.openId&&binding.appId===process.env.LARK_APP_ID,revision:Number(binding?.revision||0),selfServiceReady:larkSelfConfiguration().ready,preferences:await personalNotificationPreferences(c,employeeId)};}
async function flow(q:Request,employeeId:string,c:any,flowId:string){
 if(!/^[a-f0-9]{64}$/.test(flowId))fail(400,'lark_authorization_invalid');
 const value=await read(c,'lark_oauth:'+flowId);
 if(!value||value.employeeId!==employeeId||value.session!==session(q)||value.appId!==process.env.LARK_APP_ID||value.tenant!==process.env.LARK_TENANT_KEY||Date.parse(value.expiresAt)<Date.now())fail(409,'lark_authorization_expired');
 return value;
}
export async function sendLarkBindingNotice(key:string){
 if(process.env.LARK_BINDING_CONFIRMATIONS_ENABLED!=='true')return;
 const notice=await tx(async(c:any)=>{await locked(c);const n=await read(c,key);if(n?.state!=='pending')return null;
 const binding=(await larkBindings(c))[n.employeeId];const user=(await c.query('SELECT * FROM crm_users WHERE id=:p1',[n.employeeId])).rows[0];
 if(!user?.active||binding?.openId!==n.openId||binding?.revision!==n.bindingRevision||binding?.appId!==process.env.LARK_APP_ID){await write(c,key,{...n,state:'cancelled'});return null;}
 await write(c,key,{...n,state:'sending',startedAt:new Date().toISOString()});return n;});
 if(!notice)return;
 let state='unknown';
 try{
 const t=(en:string,id:string,zh:string)=>notice.lang==='zh'?zh:notice.lang==='id'?id:en;
 const client=new LarkApp({...process.env,LARK_PERSONAL_DELIVERY_ENABLED:'true'});
 const r=await client.send(notice.openId,{msg_type:'interactive',card:{config:{wide_screen_mode:true},header:{template:'green',title:{tag:'plain_text',content:t('Lark personal notifications connected','Notifikasi pribadi Lark terhubung','Lark个人通知已绑定')}},elements:[{tag:'div',text:{tag:'plain_text',content:t('Your CRM account has been linked to this Lark account. Personal business notifications can be delivered here when enabled. You can manage the connection from the CRM account menu.','Akun CRM Anda telah terhubung ke akun Lark ini. Notifikasi bisnis pribadi dapat dikirim di sini jika diaktifkan. Kelola koneksi melalui menu akun CRM.','你的CRM账号已绑定此Lark账号。个人业务通知开启后，可通过这里接收。你可以在CRM账号菜单中管理绑定。')}},{tag:'action',actions:[{tag:'button',type:'primary',text:{tag:'plain_text',content:t('Notification settings','Pengaturan notifikasi','通知设置')},url:notice.manageUrl}]}]}},notice.uuid);
 const body=await r.json();state=r.ok&&body.code===0&&body.data?.message_id?'accepted':body.code===0?'unknown':'failed';
 }catch{}
 await tx(async(c:any)=>{await locked(c);const n=await read(c,key);if(n?.state==='sending')await write(c,key,{...n,state,completedAt:new Date().toISOString()});});
}
export async function processLarkBindingConfirmations(){
 if(process.env.LARK_BINDING_CONFIRMATIONS_ENABLED!=='true')return;
 const rows=(await pool.query("SELECT id FROM portal_settings WHERE id LIKE 'lark_notice:%' AND JSON_UNQUOTE(JSON_EXTRACT(value,'$.state'))='pending' ORDER BY id LIMIT 5")).rows;
 for(const row of rows)await sendLarkBindingNotice(row.id);
}
export function mountLarkSelfService(server:Express){
 const wrap=(fn:any)=>(q:any,r:any)=>Promise.resolve(fn(q,r)).catch((e:any)=>r.status(e.status||503).json({error:e.status?e.message:'lark_service_unavailable'}));
 server.get('/api/crm/lark/me',wrap(async(q:any,r:any)=>{const e=await staff(q);r.set('Cache-Control','no-store');const result:any=await summary(e.id);
 if(q.query.flow){try{const f=await flow(q,e.id,pool,String(q.query.flow));if(f.state==='verified')result.candidate={name:f.name,flowId:q.query.flow,revision:f.bindingRevision};if(f.noticeKey){const n=await read(pool,f.noticeKey);result.confirmation=n?.state==='sending'?'unknown':n?.state;}}catch{result.authorizationError='lark_authorization_expired';}}
 r.json({...result,...await personalNotificationAvailability(pool,e)});
 }));
 server.post('/api/crm/lark/preferences',wrap(async(q:any,r:any)=>{
 const e=await staff(q,true),input=q.body;
 const known=personalNotificationTypes.map(t=>t[0]) as string[];
 if(!Number.isInteger(input.revision)||input.revision<0||!['rule','en','id','zh'].includes(input.language)||!Array.isArray(input.disabledTypes)||input.disabledTypes.length>known.length||input.disabledTypes.some((v:any)=>typeof v!=='string'||!known.includes(v))||new Set(input.disabledTypes).size!==input.disabledTypes.length)fail(400,'notification_preferences_invalid');
 if(input.disabledTypes.some((type:string)=>personalNotificationRequired(type)))fail(400,'notification_type_required');
 const requested=normalizePersonalPreferences(input);
 const preferences=await tx(async(c:any)=>{await locked(c);
 const all=(await c.query("SELECT value FROM access_state WHERE id='notification_preferences'")).rows[0]?.value||{};
 const current=normalizePersonalPreferences(all[e.id]);
 if(current.language===requested.language&&JSON.stringify(current.disabledTypes)===JSON.stringify(requested.disabledTypes))return current;
 const availability=await personalNotificationAvailability(c,e);
 const binding=(await larkBindings(c))[e.id];
 if(!binding?.openId||binding.appId!==process.env.LARK_APP_ID)fail(409,'notification_binding_required');
 if(!availability.personalDeliveryEnabled||!availability.visibleTypes.length||!availability.systemTypes.length)fail(409,'notification_preferences_unavailable');
 const changedTypes=[...new Set([...current.disabledTypes,...requested.disabledTypes])].filter(type=>current.disabledTypes.includes(type)!==requested.disabledTypes.includes(type));
 if(changedTypes.some(type=>!availability.visibleTypes.includes(type as any)))fail(403,'notification_type_unrelated');
 if(changedTypes.some(type=>!availability.systemTypes.includes(type as any)))fail(409,'notification_type_unavailable');
 if(current.revision!==input.revision)fail(409,'notification_preferences_conflict');
 const saved={...requested,revision:current.revision+1};all[e.id]=saved;
 await c.query("INSERT INTO access_state(id,value) VALUES('notification_preferences',:p1) ON DUPLICATE KEY UPDATE value=:p1",[JSON.stringify(all)]);
 await c.query('INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)',[e.id,'access.notifications.preferences',{revision:saved.revision,language:saved.language,disabledTypes:saved.disabledTypes}]);auditLog(e.id,'access.notifications.preferences');return saved;
 });r.json({preferences});
 }));
 server.post('/api/crm/lark/authorize',wrap(async(q:any,r:any)=>{const e=await staff(q,true),config=larkSelfConfiguration();if(!config.ready)fail(409,'lark_self_service_not_configured');
 if(`${q.protocol}://${q.get('host')}`!==config.redirect!.origin)fail(403,'access_origin_rejected');
 const nonce=crypto.randomBytes(32).toString('hex'),flowId=hash(nonce),stateKey='lark_oauth:'+flowId;
 const lang=['zh','en','id'].includes(q.body.lang)?q.body.lang:'en';const destination=new URL(typeof q.body.returnTo==='string'?q.body.returnTo:'/crm',config.redirect!.origin);if(destination.origin!==config.redirect!.origin||!['/crm','/cms','/system'].includes(destination.pathname))fail(400,'lark_return_invalid');for(const key of ['lark','flow','reason'])destination.searchParams.delete(key);const returnTo=destination.pathname+destination.search+destination.hash;
 await tx(async(c:any)=>{await locked(c);await c.query("DELETE FROM portal_settings WHERE id LIKE 'lark_oauth:%' AND JSON_UNQUOTE(JSON_EXTRACT(value,'$.expiresAt'))<:p1",[new Date().toISOString()]);const current=await summary(e.id,c);await write(c,stateKey,{employeeId:e.id,session:session(q),appId:process.env.LARK_APP_ID,tenant:process.env.LARK_TENANT_KEY,redirect:config.redirect!.href,returnTo,lang,bindingRevision:current.revision,state:'pending',expiresAt:new Date(Date.now()+5*60000).toISOString()});});
 const url=new URL('https://open.larksuite.com/open-apis/authen/v1/authorize');url.searchParams.set('app_id',process.env.LARK_APP_ID!);url.searchParams.set('redirect_uri',config.redirect!.href);url.searchParams.set('state',nonce);r.json({url:url.href});
 }));
 server.get('/api/crm/lark/callback',async(q:any,r:any)=>{
 r.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer');let f:any,flowId='';
 // SameSite=Strict excludes the CRM cookie on Lark's cross-site callback.
 // Commit a same-origin document before continuing; never weaken the cookie or authenticate from state alone.
 const cookieKey='uper_crm_session_'+(process.env.PORT||'3000')+'=';
 const hasCookie=(q.headers.cookie||'').split(';').some((v:string)=>v.trim().startsWith(cookieKey));
 if(!hasCookie&&q.query.resume!=='1'&&typeof q.query.state==='string'&&/^[a-f0-9]{64}$/.test(q.query.state)&&typeof q.query.code==='string'&&q.query.code.length>0&&q.query.code.length<=4096){
 const target='/api/crm/lark/callback?'+new URLSearchParams({state:q.query.state,code:q.query.code,resume:'1'});
 const nonce=crypto.randomBytes(18).toString('base64');
 const scriptTarget=JSON.stringify(target).replace(/</g,'\\u003c');
 const href=target.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
 r.set('Content-Security-Policy',`default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`);
 return r.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>CRM</title></head><body><a href="${href}">返回CRM · Return to CRM · Kembali ke CRM</a><script nonce="${nonce}">location.replace(${scriptTarget})</script></body></html>`);
 }

 try{const e=await staff(q);if(typeof q.query.state!=='string'||q.query.state.length!==64)fail(400,'lark_authorization_invalid');flowId=hash(q.query.state);const previous=await read(pool,'lark_oauth:'+flowId);if(previous?.employeeId===e.id&&previous.session===session(q))f=previous;
 f=await tx(async(c:any)=>{await locked(c);const value=await flow(q,e.id,c,flowId);if(value.state!=='pending')fail(409,'lark_authorization_consumed');await write(c,'lark_oauth:'+flowId,{...value,state:'exchanging'});return value;});
 if(typeof q.query.code!=='string'||!q.query.code||q.query.code.length>4096)fail(400,'lark_authorization_cancelled');
 const auth=await fetch('https://open.larksuite.com/open-apis/auth/v3/app_access_token/internal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app_id:process.env.LARK_APP_ID,app_secret:process.env.LARK_APP_SECRET}),signal:AbortSignal.timeout(10000)});const ab=await auth.json();if(!auth.ok||ab.code!==0||!ab.app_access_token)fail(502,'lark_authorization_failed');
 const token=await fetch('https://open.larksuite.com/open-apis/authen/v1/access_token',{method:'POST',headers:{Authorization:'Bearer '+ab.app_access_token,'Content-Type':'application/json'},body:JSON.stringify({grant_type:'authorization_code',code:q.query.code}),signal:AbortSignal.timeout(10000)});const tb=await token.json();if(!token.ok||tb.code!==0||!tb.data?.access_token)fail(502,'lark_authorization_failed');
 const response=await fetch('https://open.larksuite.com/open-apis/authen/v1/user_info',{headers:{Authorization:'Bearer '+tb.data.access_token},signal:AbortSignal.timeout(10000)});const info=await response.json();
 if(!response.ok||info.code!==0||!/^ou_[\w-]+$/.test(info.data?.open_id||''))fail(502,'lark_authorization_failed');
 if(info.data.tenant_key!==process.env.LARK_TENANT_KEY)fail(403,'lark_wrong_organization');
 await tx(async(c:any)=>{await locked(c);const current=await flow(q,e.id,c,flowId);if(current.state!=='exchanging')fail(409,'lark_authorization_consumed');await write(c,'lark_oauth:'+flowId,{...current,state:'verified',openId:info.data.open_id,name:String(info.data.name||'Lark').slice(0,191)});});
 r.redirect(303,resultLocation(f.returnTo,'verified',{flow:flowId}));
 }catch(e:any){r.redirect(303,resultLocation(f?.returnTo||'/crm','error',{reason:e.status?e.message:'lark_authorization_failed'}));}
 });
 server.post('/api/crm/lark/bind',wrap(async(q:any,r:any)=>{const e=await staff(q,true);if(!larkSelfConfiguration().ready)fail(409,'lark_self_service_not_configured');let noticeKey='';
 await tx(async(c:any)=>{await locked(c);const f=await flow(q,e.id,c,String(q.body.flowId||''));
 if(f.state==='saved'){const current=(await larkBindings(c))[e.id];if(current?.openId!==f.openId||current?.appId!==f.appId||current?.revision!==f.savedBindingRevision)fail(409,'lark_binding_conflict');noticeKey=f.noticeKey||'';return;}if(f.state!=='verified')fail(409,'lark_authorization_invalid');
 const all=await larkBindings(c),old=all[e.id];if(Number(old?.revision||0)!==f.bindingRevision)fail(409,'lark_binding_conflict');
 if(Object.entries(all).some(([id,b]:any)=>id!==e.id&&b.appId===f.appId&&b.openId===f.openId))fail(409,'lark_identity_already_bound');
 if(old?.openId===f.openId&&old.appId===f.appId){await write(c,'lark_oauth:'+q.body.flowId,{...f,state:'saved',savedBindingRevision:old.revision});return;}
 const binding={appId:f.appId,openId:f.openId,revision:Number(old?.revision||0)+1,updatedAt:new Date().toISOString(),method:'oauth'};all[e.id]=binding;
 await c.query("INSERT INTO access_state(id,value) VALUES('lark_bindings',:p1) ON DUPLICATE KEY UPDATE value=:p1",[JSON.stringify(all)]);
 const preference=await personalNotificationPreferences(c,e.id);
 const uuid=crypto.randomUUID();noticeKey='lark_notice:'+uuid;
 await write(c,noticeKey,{employeeId:e.id,openId:f.openId,bindingRevision:binding.revision,uuid,lang:preference.language==='rule'?f.lang:preference.language,state:'pending',manageUrl:new URL(f.returnTo,f.redirect).origin+new URL(f.returnTo,f.redirect).pathname+'?lark=manage'});
 await write(c,'lark_oauth:'+q.body.flowId,{...f,state:'saved',noticeKey,savedBindingRevision:binding.revision});
 await c.query('INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)',[e.id,'access.lark.self.bind',{revision:binding.revision,method:'oauth'}]);
 auditLog(e.id,'access.lark.self.bind');
 });
 if(noticeKey)await sendLarkBindingNotice(noticeKey);
 const notice=noticeKey?await read(pool,noticeKey):null;r.json({...await summary(e.id),confirmation:notice?.state||'unchanged'});
 }));
 server.post('/api/crm/lark/unbind',wrap(async(q:any,r:any)=>{const e=await staff(q,true);
 if(!Number.isInteger(q.body.revision)||q.body.revision<0)fail(400,'lark_binding_invalid');
 await tx(async(c:any)=>{await locked(c);const all=await larkBindings(c),old=all[e.id];if(!old?.openId)return;if(Number(old.revision)!==q.body.revision)fail(409,'lark_binding_conflict');
 all[e.id]={revision:old.revision+1,removed:true,updatedAt:new Date().toISOString()};await c.query("INSERT INTO access_state(id,value) VALUES('lark_bindings',:p1) ON DUPLICATE KEY UPDATE value=:p1",[JSON.stringify(all)]);
 await c.query('INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)',[e.id,'access.lark.self.unbind',{revision:old.revision+1}]);
 auditLog(e.id,'access.lark.self.unbind');
 });r.json(await summary(e.id));
 }));
}
