import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
if(!process.env.MYSQL_NATIVE_TEST_ENV){test('outreach transactions require isolated MySQL',{skip:'Set MYSQL_NATIVE_TEST_ENV'},()=>{});}else{
 const {setupNativeTest}=await import('./helpers/mysql.mjs');await setupNativeTest('identity_outreach672');process.env.PLATFORM_MODE='local';
 const {pool}=await import('../server/portal/store.ts');const {mountPortal}=await import('../server/portal/runtime.ts');const {default:express}=await import('express');
 test('MySQL identity queue, concurrent claim, fresh authorization and manager audit without task/contact changes',async t=>{
  const app=express();app.use(express.json());await mountPortal(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;
  t.after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();});
  const session=()=>{let cookie='';return async(path:string,body?:any,method?:string)=>{const r=await fetch(base+path,{method:method||(body===undefined?'GET':'POST'),headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});for(const h of r.headers.getSetCookie())cookie=h.split(';')[0];return {status:r.status,data:await r.json()};};};
  const a=session(),b=session(),m=session();for(const [s,n]of [[a,'Fadhil'],[b,'Wigar'],[m,'Suki']]as const)assert.equal((await s('/api/crm/auth/login',{loginId:n,password:n})).status,200);
  const ids=['normal','pending','peer','false','falsepeer','stopped'].map(x=>'TEST672-'+x+'-'+randomUUID());const [normal,pending,peer,falseId,falsePeer,stopped]=ids;
  for(const id of ids)await pool.query('INSERT INTO portal_leads(id,business_number,profile) VALUES(:p1,:p2,:p3)',[id,id,{id,submittedAt:new Date().toISOString(),fullName:id,email:[pending,peer].includes(id)?'shared@example.invalid':'',whatsapp:'',owner:id===stopped?'Fadhil':null,tier:'Warm-Online',currentStage:'New',...(id===stopped?{contactArrangement:{state:'stopped'}}:{})}]);
  const visitor=randomUUID();await pool.query("INSERT INTO visitor_sessions(id,expires_at) VALUES(:p1,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY))",[visitor]);
  for(const pair of [[pending,peer],[falseId,falsePeer]])await pool.query('INSERT INTO identity_candidates(visitor_id,lead_id,candidate_id) VALUES(:p1,:p2,:p3)',[visitor,...pair]);
  const path=(id:string,suffix='contact-authorization')=>'/api/crm/leads/'+id+'/'+suffix;
  const intent=(action='copy',owner:any=null)=>({requestId:randomUUID(),action,expectedOwner:owner,purpose:'sales_followup',expectedArrangementVersion:0});
  for(const action of ['phone','whatsapp','copy'])assert.equal((await a(path(normal),intent(action))).data.error,'CLAIM_BEFORE_CONTACT');
  assert.equal((await a(path(pending,'claim'),{})).data.error,'IDENTITY_REVIEW_REQUIRED');
  assert.equal((await a(path(peer),intent())).data.error,'CLAIM_BEFORE_CONTACT');
  assert.equal((await a('/api/crm/identity-reviews')).status,403);
  const queue=await m('/api/crm/identity-reviews');assert.equal(queue.status,200);assert.equal(queue.data.reviews.length,1);
  const reverse=await m(path(peer,'identity-comparison')+'?candidateId='+pending);assert.equal(reverse.data.candidateId,pending);
  const claims=await Promise.all([a(path(normal,'claim'),{}),b(path(normal,'claim'),{})]);assert.deepEqual(claims.map(r=>r.status).sort(),[200,409]);const winner=claims[0].status===200?a:b,loser=winner===a?b:a,owner=winner===a?'Fadhil':'Wigar';
  for(const action of ['phone','whatsapp','copy']){
   const body=intent(action,owner);assert.equal((await winner(path(normal),body)).status,200);assert.equal((await winner(path(normal),body)).data.replayed,true);assert.notEqual((await loser(path(normal),intent(action,owner))).status,200);
  }
  assert.equal((await winner(path(normal),intent('copy',null))).data.error,'CONTACT_OWNER_CHANGED');
  assert.equal((await m(path(normal),intent('phone',owner))).status,200);

  assert.equal((await a(path(stopped),intent('phone','Fadhil'))).data.error,'CONTACT_STOPPED');
  const comparison=(await m(path(peer,'identity-comparison')+'?candidateId='+pending)).data;const decision={expectedComparisonRevision:comparison.revision,requestId:randomUUID(),candidateId:pending,decision:'shared',reason:'TEST two people share a mailbox'};
  assert.notEqual((await a(path(peer,'identity-actions'),decision)).status,200);
  assert.equal((await m(path(peer,'identity-actions'),decision)).status,200);
  assert.equal((await m(path(peer,'identity-actions'),decision)).data.replayed,true);
  assert.equal((await m('/api/crm/identity-reviews')).data.reviews.length,0);
  assert.equal((await a(path(pending,'claim'),{})).status,200);
  assert.equal((await b(path(falseId,'claim'),{})).status,200);
  assert.equal((await pool.query("SELECT decision FROM identity_candidates WHERE lead_id=:p1",[falseId])).rows[0].decision,'pending');
  const facts=(await pool.query("SELECT data FROM crm_facts WHERE kind='contact.intent'")).rows;assert.equal(facts.length,4);assert.equal(facts.filter((f:any)=>f.data.assisted).length,1);
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM followup_tasks')).rows[0].n),1);assert.equal((await pool.query('SELECT kind FROM followup_tasks')).rows[0].kind,'consultation');
  assert.equal((await pool.query('SELECT profile FROM portal_leads WHERE id=:p1',[normal])).rows[0].profile.followUpLogs,undefined);
  // Direct transfer demonstrates stale old-owner authorization is rejected.
  await pool.query('UPDATE portal_leads SET profile=JSON_SET(profile,\'$.owner\',:p2) WHERE id=:p1',[normal,owner==='Fadhil'?'Wigar':'Fadhil']);
  assert.notEqual((await winner(path(normal),intent('copy',owner))).status,200);
  // Exercise actual visitor registration, not only pre-seeded candidate rows.
  const reg=async(body:any)=>{const v=session();const r=await v('/api/portal/register',body);assert.equal(r.status,200,JSON.stringify(r.data));return r.data.lead.id;};
  const stamp=randomUUID();
  const emailA=await reg({fullName:'TEST email only A',email:stamp+'a@example.invalid'});
  const emailB=await reg({fullName:'TEST email only B',email:stamp+'b@example.invalid'});
  const phoneA=await reg({fullName:'TEST phone only A',whatsapp:'081234567890'});
  const phoneB=await reg({fullName:'TEST phone only B',whatsapp:'081234567891'});
  for(const id of [emailA,emailB,phoneA,phoneB])assert.equal((await m(path(id,'trust'))).data.identityReview.pending,false);
  const duplicate=await reg({fullName:'TEST same mailbox',email:stamp+'a@example.invalid'});
  assert.equal((await m(path(duplicate,'trust'))).data.identityReview.pending,true);
  assert.equal((await a(path(duplicate,'claim'),{})).data.error,'IDENTITY_REVIEW_REQUIRED');
 });
}
