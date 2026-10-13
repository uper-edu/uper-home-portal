import crypto from 'node:crypto';import {promisify} from 'node:util';import type {Express,Request,Response} from 'express';import {pool,tx} from './store.ts';import type {Employee} from './identity.ts';
const scrypt=promisify(crypto.scrypt);const cookie=()=>`uper_crm_session_${process.env.PORT || '3000'}`;
export const accountSeeds=[['Suki',['crm_leader']],['Robert',['crm_leader']],['Fadhil',['sales']],['Zainul',['sales']],['Wigar',['sales']],['Tester',['crm_leader','sales']]] as const;
export async function hashPassword(password:string){const salt=crypto.randomBytes(16).toString('hex');const key=await scrypt(password,salt,64) as Buffer;return salt+':'+key.toString('hex');}
async function matches(password:string,encoded:string){const [salt,key]=encoded.split(':');if(!salt||!key)return false;const actual=await scrypt(password,salt,64) as Buffer;const expected=Buffer.from(key,'hex');return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);}
function employee(row:any):Employee{const leader=row.roles.includes('crm_leader');return {id:row.id,displayName:row.display_name,roles:row.roles,teams:row.teams,active:row.active,permissions:leader?['crm.read','crm.write','crm.assign','crm.export','notifications.manage']:['crm.read','crm.write'],scope:leader?'all':'own'};}
const token=(req:Request)=>(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookie()+'='))?.slice(cookie().length+1);
const digest=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
export async function localEmployee(req:Request){const t=token(req);if(!t||!/^[a-f0-9]{64}$/.test(t))return null;const row=(await pool.query('SELECT u.* FROM crm_sessions s JOIN crm_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',[digest(t)])).rows[0];return row?employee(row):null;}
export async function localDirectory(){return (await pool.query('SELECT * FROM crm_users ORDER BY display_name')).rows.map(employee);}
export async function initializeLocalAccounts(){if(process.env.PLATFORM_MODE!=='local')return;for(const [name,roles] of accountSeeds)await pool.query('INSERT INTO crm_users(id,login_id,display_name,password_hash,roles,teams) VALUES($1,$1,$1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',[name,await hashPassword(name),JSON.stringify(roles),JSON.stringify(roles.includes('crm_leader' as never)?['sales','ops','supervisors']:['sales'])]);}
function setCookie(res:Response,value:string,maxAge:number){res.cookie(cookie(),value,{httpOnly:true,sameSite:'strict',secure:process.env.APP_ENV==='production',path:'/',maxAge});}
export function mountLocalAuth(app:Express,authenticate:(req:Request)=>Promise<Employee|null>){
 const wrap=(fn:(q:Request,r:Response)=>Promise<void>)=>(q:Request,r:Response)=>{fn(q,r).catch(()=>r.status(503).json({error:'Authentication service unavailable'}));};
 app.get('/api/crm/auth/me',wrap(async(q,r)=>{r.setHeader('Cache-Control','no-store');const e=await authenticate(q);if(!e){r.status(401).json({error:'Login required'});return;}r.json({employee:e});}));
 const mutation=(q:Request,r:Response)=>{if(process.env.PLATFORM_MODE!=='local'){r.status(403).json({error:'Local login unavailable'});return false;}if(q.headers.origin!==`${q.protocol}://${q.get('host')}`||!q.is('application/json')){r.status(403).json({error:'Origin or content type rejected'});return false;}return true;};
 app.post('/api/crm/auth/login',wrap(async(q,r)=>{
  if(!mutation(q,r))return;const name=typeof q.body.loginId==='string'?q.body.loginId.trim():'';const password=typeof q.body.password==='string'?q.body.password:'';if(!name||name.length>64||!password||password.length>200){r.status(400).json({error:'Invalid login input'});return;}
  const ip=digest(q.socket.remoteAddress||'unknown'),key=digest(ip+':'+name.toLowerCase());
  const result=await tx(async c=>{
   // Serialize attempts per source IP, so concurrent requests cannot bypass limits.
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['crm-login:'+ip]);
   for(const k of [ip,key])await c.query("INSERT INTO crm_login_limits(key) VALUES($1) ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN crm_login_limits.window_start<now()-interval '15 minutes' THEN 0 ELSE crm_login_limits.failures END,window_start=CASE WHEN crm_login_limits.window_start<now()-interval '15 minutes' THEN now() ELSE crm_login_limits.window_start END",[k]);
   const limits=(await c.query('SELECT key,failures FROM crm_login_limits WHERE key=ANY($1)',[[ip,key]])).rows;
   if(limits.some(v=>v.failures>=(v.key===ip?30:5)))return {status:429};
   const row=(await c.query('SELECT * FROM crm_users WHERE lower(login_id)=lower($1) AND active=true',[name])).rows[0];
   const valid=await matches(password,row?.password_hash||'00000000000000000000000000000000:'+ '0'.repeat(128));
   if(!row||!valid){await c.query('UPDATE crm_login_limits SET failures=failures+1 WHERE key=ANY($1)',[[ip,key]]);return {status:401};}
   const t=crypto.randomBytes(32).toString('hex');await c.query("DELETE FROM crm_sessions WHERE expires_at<=now()");await c.query("INSERT INTO crm_sessions VALUES($1,$2,now()+interval '8 hours')",[digest(t),row.id]);await c.query('UPDATE crm_login_limits SET failures=0 WHERE key=$1',[key]);await c.query("INSERT INTO portal_audit(actor,action,data) VALUES($1,'auth.login','{}')",[row.id]);return {status:200,t,user:employee(row)};
  });
  if(result.status===429){r.setHeader('Retry-After','900');r.status(429).json({error:'Too many failed attempts; retry later'});return;}
  if(result.status===401){r.status(401).json({error:'Invalid login ID or password'});return;}
  setCookie(r,result.t!,8*3600000);r.setHeader('Cache-Control','no-store');r.json({employee:result.user});
 }));
 app.post('/api/crm/auth/logout',wrap(async(q,r)=>{if(!mutation(q,r))return;const t=token(q);if(t)await pool.query('DELETE FROM crm_sessions WHERE token_hash=$1',[digest(t)]);setCookie(r,'',0);r.json({success:true});}));
 app.post('/api/crm/auth/password',wrap(async(q,r)=>{
  if(!mutation(q,r))return;const e=await authenticate(q);if(!e){r.status(401).json({error:'Login required'});return;}const {currentPassword,newPassword}=q.body;if(typeof currentPassword!=='string'||currentPassword.length>200||typeof newPassword!=='string'||newPassword.length<8||newPassword.length>200){r.status(400).json({error:'New password must contain 8–200 characters'});return;}
  const row=(await pool.query('SELECT password_hash FROM crm_users WHERE id=$1',[e.id])).rows[0];if(!await matches(currentPassword,row.password_hash)){r.status(401).json({error:'Current password is incorrect'});return;}const hash=await hashPassword(newPassword);const t=token(q)!;
  await tx(async c=>{const updated=await c.query('UPDATE crm_users SET password_hash=$1 WHERE id=$2 AND password_hash=$3',[hash,e.id,row.password_hash]);if(!updated.rowCount)throw Error('Password changed concurrently');await c.query('DELETE FROM crm_sessions WHERE user_id=$1 AND token_hash<>$2',[e.id,digest(t)]);await c.query("INSERT INTO portal_audit(actor,action,data) VALUES($1,'auth.password_changed','{}')",[e.id]);});r.json({success:true});
 }));
}
