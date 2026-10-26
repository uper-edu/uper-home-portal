import {test} from 'node:test';import assert from 'node:assert/strict';import {setupNativeTest} from './helpers/mysql.mjs';
if(process.env.MYSQL_NATIVE_TEST_ENV){
 await setupNativeTest('changes642');process.env.PLATFORM_MODE='local';
 const {pool}=await import('../server/portal/store');const {hashPassword}=await import('../server/portal/localAuth');const {mountPortal}=await import('../server/portal/runtime');const express=(await import('express')).default;const app=express();app.use(express.json());await mountPortal(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;
 const password='TEST642-synthetic-password';
 async function api(cookie:string,path:string,body?:any){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,Origin:base,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],cache:response.headers.get('cache-control')};}
 await test('642 native MySQL changes: five Sales, exact access boundary, facts-only metadata response',async t=>{
 t.after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();});
 const users=Array.from({length:5},(_,i)=>'test642-sales'+i),cookies:string[]=[];
 for(const user of users){await pool.query("INSERT INTO crm_users(id,login_id,display_name,password_hash,roles,teams) VALUES(:p1,:p1,:p1,:p2,:p3,'[]')",[user,await hashPassword(password),JSON.stringify(['sales'])]);const login=await api('','/api/crm/auth/login',{loginId:user,password});assert.equal(login.status,200);cookies.push(login.cookie!);await pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',['lead-'+user,{id:'lead-'+user,owner:user,fullName:'PRIVATE '+user,currentStage:'New'}]);}
 const check=async()=>Promise.all(cookies.map(cookie=>api(cookie,'/api/crm/lead-changes')));
 const before=await check();for(const row of before){assert.equal(row.status,200);assert.equal(row.cache,'no-store');assert.deepEqual(Object.keys(row.data).sort(),['cursor']);assert.equal(row.data.cursor.length,64);}
 await pool.query('UPDATE portal_leads SET profile=JSON_SET(profile,\'$.currentStage\',\'Contacted\') WHERE id=:p1',['lead-'+users[0]]);
 const stage=await check();assert.notEqual(stage[0].data.cursor,before[0].data.cursor);for(let i=1;i<5;i++)assert.equal(stage[i].data.cursor,before[i].data.cursor,'another Sales private changes must not leak');
 const shared='shared642';await pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',[shared,{id:shared,owner:null,fullName:'TEST shared'}]);await pool.query("INSERT INTO outbox(id,type,lead_id,payload) VALUES('new642','lead.created',:p1,'{}')",[shared]);const newLead=await check();for(let i=0;i<5;i++){assert.notEqual(newLead[i].data.cursor,stage[i].data.cursor);}
 const read=await check();for(let i=0;i<5;i++)assert.equal(read[i].data.cursor,newLead[i].data.cursor);
 const full=await api(cookies[1],'/api/crm/leads?ownership=all&workScope=all&task=all&sort=priority');assert.equal(full.status,200);assert.equal(full.data.changeCursor,read[1].data.cursor,'full list carries authorized pre-read cursor');
 await pool.query('UPDATE portal_leads SET profile=JSON_SET(profile,\'$.owner\',:p1) WHERE id=:p2',[users[0],shared]);const assigned=await check();assert.notEqual(assigned[1].data.cursor,read[1].data.cursor);
 assert.equal((await api('','/api/crm/lead-changes')).status,401);
 });
}
