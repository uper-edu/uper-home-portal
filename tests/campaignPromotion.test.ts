import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {promotionInput,promotionIdPrefix,campaignPromotionPath,campaignPromotionShortUrl,campaignPromotionUrl,PROMOTION_EXPERIENCE} from '../src/utils/campaignPromotion.ts';
import {allocatePromotionShortCode,promotionShortCodePattern} from '../cloud/mysql/promotion-short-links.mjs';
test('promotion configuration validates actual experience, source encoding and canonical link',()=>{
 const v=promotionInput({source:' Instagram ',medium:'paid_social',language:'en',experience:PROMOTION_EXPERIENCE});
 assert.equal(v.source,'instagram');
 assert.equal(promotionIdPrefix(v),'instagram-paid-social');
 assert.equal(promotionIdPrefix(promotionInput({...v,landingPath:'/link',content:'Profile_Bio'})),'instagram-paid-social-profile-bio');
 const u=new URL(campaignPromotionUrl({id:'p_123',...v,createdAt:''},'https://example.test','demo'));
 assert.deepEqual(Object.fromEntries(u.searchParams),{p:'p_123',lang:'en',utm_source:'instagram',utm_medium:'paid_social',utm_campaign:'demo'});
 for(const bad of [{source:'x?x=1'},{medium:'qr'},{language:'xx'},{experience:'trial_class'}])assert.throws(()=>promotionInput({...v,...bad}));
});
test('a short promotion link uses the existing ID and expands to the same tracked same-origin landing page',()=>{
 const link={id:'bio-ig',...promotionInput({source:'instagram',medium:'social',content:'profile-bio',language:'id',landingPath:'/link',experience:PROMOTION_EXPERIENCE}),createdAt:''};
 const origin='https://example.test';
 assert.equal(campaignPromotionShortUrl(link.id,origin),origin+'/s/bio-ig');
 assert.equal(campaignPromotionShortUrl(link.id,origin,'k7m4qx'),origin+'/s/k7m4qx');
 assert.equal(campaignPromotionPath(link,'social-bio'),'/link?p=bio-ig&lang=id&utm_source=instagram&utm_medium=social&utm_campaign=social-bio&utm_content=profile-bio');
 assert.equal(campaignPromotionUrl(link,origin,'social-bio'),origin+campaignPromotionPath(link,'social-bio'));
 assert.match(campaignPromotionPath({...link,landingPath:'//other.example' as any},'social-bio'),/^\/chat\?/);
});
test('short-code allocation retries a collision without overwriting another promotion',async()=>{
 const entries=new Map([['222222','old-p']]);
 let draws=0;
 const code=await allocatePromotionShortCode('new-p',async(code:string,p:string)=>{
  if(entries.has(code))throw Object.assign(Error('Collision'),{code:'ER_DUP_ENTRY'});
  entries.set(code,p);
 },()=>draws++<6?0:1);
 assert.equal(code,'333333');
 assert.deepEqual([...entries],[['222222','old-p'],['333333','new-p']]);
 await assert.rejects(allocatePromotionShortCode('new-p',async()=>{throw Error('Storage error');}),/Storage error/);
});
if(process.env.MYSQL_NATIVE_TEST_ENV){
 const {setupNativeTest}=await import('./helpers/mysql.mjs');const fixture=await setupNativeTest('campaign_promotion');
 const {disposeNativeTest}=await import('./helpers/disposeNativeTest.mjs');
 const lease=createServer().listen(0,'127.0.0.1');await new Promise<void>(r=>lease.once('listening',r));const port=(lease.address() as any).port;await new Promise<void>(r=>lease.close(()=>r()));
 Object.assign(process.env,{PORT:String(port),PLATFORM_MODE:'local',APP_URL:`http://127.0.0.1:${port}`});
 const {startMysqlApplication}=await import('../server/mysqlApplication.ts');const {pool}=await import('../server/portal/store.ts');const {server}=await startMysqlApplication();if(!server.listening)await new Promise<void>(r=>server.once('listening',r));
 let staffCookie='';
 async function req(url:string,body?:any,method=body===undefined?'GET':'POST',cookie=staffCookie){const r=await fetch(process.env.APP_URL+url,{method,headers:{'Content-Type':'application/json',Origin:process.env.APP_URL!,cookie},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]||cookie};}
 await test('independent MySQL multiple promotion entries and first-touch persistence',async t=>{
  t.after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();await disposeNativeTest(fixture);});
  staffCookie=(await req('/api/crm/auth/login',{loginId:'Robert',password:'Robert'})).cookie;
  const body={name:'TEST Multi-channel campaign',savePhase:'basics',requestId:randomUUID()};
  const created=await req('/api/crm/campaigns',body);assert.equal(created.status,200);const c=created.data.campaign;
  assert.match(c.code,/^camp-\d{12}(?:-\d+)?$/);assert.equal(c.locationType,'');assert.deepEqual(c.promotionLinks,[]);
  assert.equal((await req('/api/crm/campaigns',body)).data.campaign.id,c.id);
  const input={source:'instagram',medium:'paid_social',language:'en',experience:PROMOTION_EXPERIENCE,requestId:randomUUID()};
  const first=await req(`/api/crm/campaigns/${c.id}/links`,input);assert.equal(first.status,200);const a=first.data.link;
  assert.match(a.shortCode,promotionShortCodePattern);
  assert.match(a.id,/^instagram-paid-social-\d{12}(?:-\d+)?$/);
  await t.test('retry ten times and concurrent adds preserve every immutable link',async()=>{
   for(let i=0;i<10;i++){
    const link=(await req(`/api/crm/campaigns/${c.id}/links`,input)).data.link;
    assert.equal(link.id,a.id);assert.equal(link.shortCode,a.shortCode);
   }
   assert.equal((await req(`/api/crm/campaigns/${c.id}/links`,{...input,medium:'poster'})).status,409);
   const results=await Promise.all(['id','zh'].map(language=>req(`/api/crm/campaigns/${c.id}/links`,{...input,source:'campus_test',medium:'poster',language,requestId:randomUUID()})));
   assert.ok(results.every(r=>r.status===200));
   const saved=(await req('/api/crm/campaigns/'+c.id)).data.campaign;assert.equal(saved.promotionLinks.length,3);
   assert.equal(new Set(saved.promotionLinks.map(link=>link.shortCode)).size,3);
   await req('/api/crm/campaigns/'+c.id,{name:c.name,promotionLinks:[],promotionModel:'legacy'},'PUT');assert.equal((await req('/api/crm/campaigns/'+c.id)).data.campaign.promotionLinks.length,3);
   assert.equal((await req('/api/crm/campaigns/'+c.id,undefined,'DELETE')).status,409);
  });
  const links=(await req('/api/crm/campaigns/'+c.id)).data.campaign.promotionLinks;
  await t.test('public resolution and registration use each saved entry, not spoofed UTM fields',async()=>{
   for(let i=0;i<links.length;i++){
    const link=links[i];
    const publicLink=await req(`/api/promotion-links/${link.id}`,undefined,'GET','');
    assert.equal(publicLink.data.promotion.campaignId,c.id);
    for(const slug of ['/s/'+link.shortCode]){
     const redirect=await fetch(process.env.APP_URL+slug,{redirect:'manual'});
     assert.equal(redirect.status,302);
     assert.equal(redirect.headers.get('location'),campaignPromotionPath(link,c.code));
    }
    const visitor=(await req('/api/portal/session',undefined,'GET','')).cookie;
    const result=await req('/api/portal/register',{fullName:'TEST Entry '+i,email:`entry${i}@example.invalid`,...(i===0?{}:{campaignId:c.code}),promotionLinkId:link.id,placement:'forged',entryPoint:'forged',hookType:'trial_class'},'POST',visitor);assert.equal(result.status,200);
    const profile=(await pool.query("SELECT profile FROM portal_leads WHERE JSON_UNQUOTE(JSON_EXTRACT(profile,'$.email'))=:p1",[`entry${i}@example.invalid`])).rows[0].profile;
    assert.equal(profile.promotionLinkId,link.id);assert.equal(profile.entryPoint,link.source);assert.equal(profile.placement,link.medium);assert.equal(profile.promotionSnapshot.language,link.language);assert.equal(profile.hookType,'hsk_assessment');
    await req('/api/portal/register',{fullName:'TEST Entry '+i,email:`entry${i}@example.invalid`,campaignId:c.code,promotionLinkId:links[(i+1)%links.length].id},'POST',visitor);
    const again=(await pool.query('SELECT profile FROM portal_leads WHERE id=:p1',[profile.id])).rows[0].profile;assert.deepEqual(again.promotionSnapshot,profile.promotionSnapshot);
   }
   const report=(await req('/api/crm/campaigns/'+c.id)).data.campaign;
   assert.equal(report.stats.leadsCount,3);
   assert.equal(report.promotionResults.reduce((sum,row)=>sum+row.customers,0),3);
  });
  await t.test('unknown p is flagged and legacy campaign input cannot supply a foreign source',async()=>{
   const other=(await req('/api/crm/campaigns',{...body,name:'TEST Other',requestId:randomUUID()})).data.campaign;
   assert.equal((await req(`/api/campaigns/${other.code}/links/${a.id}`,undefined,'GET','')).status,404);
   const visitor=(await req('/api/portal/session',undefined,'GET','')).cookie;
   const registered=await req('/api/portal/register',{fullName:'TEST Mismatch',email:'mismatch@example.invalid',campaignId:other.code,promotionLinkId:'unknown-p',entryPoint:'instagram',placement:'paid_social'},'POST',visitor);assert.equal(registered.status,200);
   const p=(await pool.query("SELECT profile FROM portal_leads WHERE JSON_UNQUOTE(JSON_EXTRACT(profile,'$.email'))='mismatch@example.invalid'")).rows[0].profile;
   assert.equal(p.campaignId,undefined);assert.equal(p.promotionLinkStatus,'unverified');assert.equal(p.rawPromotionLinkId,'unknown-p');assert.equal(p.placement,'unrecorded');assert.equal(p.promotionSnapshot,undefined);
  });
  await t.test('old campaign-only link defaults survive and new materials select an exact entry',async()=>{
   const old=(await req('/api/crm/campaigns',{name:'TEST Legacy',type:'campus_seminar',locationType:'offline',requestId:randomUUID(),boundUtm:{utm_source:'legacy',utm_medium:'flyer',defaultLang:'zh',defaultHook:'consultation'}})).data.campaign;
   const before=structuredClone(old);await req(`/api/crm/campaigns/${old.id}/links`,{...input,requestId:randomUUID()});const after=(await req('/api/crm/campaigns/'+old.id)).data.campaign;assert.equal(after.code,before.code);assert.deepEqual(after.boundUtm,before.boundUtm);
   assert.equal((await req('/api/crm/campaigns/'+c.id+'/templates',{lang:'en'})).status,400);
   const draft=await req('/api/crm/campaigns/'+c.id+'/templates',{lang:'en',promotionLinkId:a.id});assert.equal(draft.status,200);assert.ok(draft.data.draft.whatsappInvitation.includes('/s/'+a.shortCode));
  });
  await t.test('Sales and unauthenticated clients cannot create promotion links',async()=>{
   assert.equal((await req(`/api/crm/campaigns/${c.id}/links`,{...input,requestId:randomUUID()},'POST','')).status,401);
   staffCookie=(await req('/api/crm/auth/login',{loginId:'Fadhil',password:'Fadhil'})).cookie;
   assert.equal((await req(`/api/crm/campaigns/${c.id}/links`,{...input,requestId:randomUUID()})).status,403);
  });
 });
}else test('promotion MySQL acceptance requires independent socket',{skip:'Set MYSQL_NATIVE_TEST_ENV'},()=>{});
