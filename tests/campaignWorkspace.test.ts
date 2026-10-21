import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {campaignTemplate,campaignScheduleError} from '../src/utils/campaignWorkspace.ts';
const facts:any={name:'TEST Campus',nameEn:'',nameId:'',startDate:'',startTime:'',venue:'',city:'',keyTopics:['Original human text']};
test('templates localize scaffolding without translating facts or inventing time, offers and attendance',()=>{
 const en=campaignTemplate(facts,'en'),id=campaignTemplate(facts,'id'),zh=campaignTemplate(facts,'zh');
 assert.notEqual(en.whatsappInvitation,id.whatsappInvitation);assert.notEqual(id.whatsappInvitation,zh.whatsappInvitation);
 for(const d of [en,id,zh]){assert.match(d.whatsappInvitation!,/TEST Campus/);assert.match(d.whatsappInvitation!,/\{\{campaign_link\}\}/);assert.equal(d.posterSubheading,'');assert.equal(d.presentationOutline,'• Original human text');assert.doesNotMatch(JSON.stringify(d),/2026|discount|free|免费|gratis|guarantee/i);}
 assert.equal(campaignScheduleError({startDate:'2026-11-01',endDate:'2026-11-01',startTime:'15:00',endTime:'14:00'}),true);
 assert.equal(campaignScheduleError({startTime:'15:00'}),true);assert.equal(campaignScheduleError({}),false);
});
if(process.env.MYSQL_NATIVE_TEST_ENV){
 const {setupNativeTest}=await import('./helpers/mysql.mjs');await setupNativeTest('campaign_workspace');
 const lease=createServer().listen(0,'127.0.0.1');await new Promise<void>(r=>lease.once('listening',r));const port=(lease.address() as any).port;await new Promise<void>(r=>lease.close(()=>r()));
 Object.assign(process.env,{PORT:String(port),PLATFORM_MODE:'local',APP_URL:`http://127.0.0.1:${port}`});
 const {startMysqlApplication}=await import('../server/mysqlApplication.ts');const {pool}=await import('../server/portal/store.ts');const {server}=await startMysqlApplication();
 if(!server.listening)await new Promise<void>(r=>server.once('listening',r));let cookie='';
 async function req(url:string,body?:any,method=body===undefined?'GET':'POST'){const r=await fetch(process.env.APP_URL+url,{method,headers:{'Content-Type':'application/json',Origin:process.env.APP_URL!,cookie},...(body===undefined?{}:{body:JSON.stringify(body)})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie')!.split(';')[0];return {status:r.status,data:await r.json()};}
 const protectedRows=async()=>{const result:any={};for(const table of ['portal_leads','followup_tasks','notification_jobs','outbox'])result[table]=(await pool.query(`SELECT * FROM ${table} ORDER BY 1`)).rows;return result;};
 await test('independent MySQL campaign workspace HTTP lifecycle',async t=>{
  t.after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();});
  assert.equal((await req('/api/crm/auth/login',{loginId:'Robert',password:'Robert'})).status,200);
  const body={name:'TEST Workspace',type:'campus_seminar',locationType:'offline',savePhase:'basics',requestId:randomUUID(),boundUtm:{defaultHook:'consultation',defaultLang:'id'}};
  let c:any;
  await t.test('minimal create has null budget, empty dates, fixed code, and retry creates one record',async()=>{
   const a=await req('/api/crm/campaigns',body);assert.equal(a.status,200);c=a.data.campaign;assert.equal(c.stats.budgetCost,null);assert.equal(c.startDate,'');assert.equal(c.status,'planning');assert.equal(c.boundUtm.defaultHook,'consultation');
   for(let n=0;n<10;n++)assert.equal((await req('/api/crm/campaigns',body)).data.campaign.code,c.code);
   assert.equal((await pool.query("SELECT * FROM portal_audit WHERE action='campaign.save'")).rows.length,1);
   assert.equal((await req('/api/crm/campaigns',{...body,requestId:randomUUID(),boundUtm:{defaultHook:'bad',defaultLang:'id'}})).status,400);
  });
  const lead={id:'TEST-workspace-lead',fullName:'TEST learner',campaignId:c.code,owner:'Fadhil',tier:'Hot',quizScore:28};
  await pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',[lead.id,lead]);const before=await protectedRows();
  const promotion=(await req('/api/crm/campaigns/'+c.id+'/links',{source:'campus_test',medium:'poster',language:'en',experience:'questionnaire_assessment_consultation',requestId:randomUUID()})).data.link;
  await t.test('partial info and material updates preserve code, UTM, dates, budget, original text and customers',async()=>{
   let r=await req('/api/crm/campaigns/'+c.id,{name:c.name,stats:{budgetCost:0},startDate:'2026-11-01',endDate:'2026-11-01',startTime:'14:00',endTime:'15:00',organizer:'TEST contact',boundUtm:{utm_source:'original-source',utm_medium:'original-medium'},aiAssets:{socialCopy:'Original human note'}},'PUT');assert.equal(r.status,200);c=r.data.campaign;
   r=await req('/api/crm/campaigns/'+c.id,{name:c.name,type:'education_fair',locationType:'hybrid'},'PUT');assert.equal(r.data.campaign.code,c.code);assert.deepEqual(r.data.campaign.boundUtm,c.boundUtm);assert.equal(r.data.campaign.stats.budgetCost,0);
   for(const lang of ['en','id','zh']){const a=await req('/api/crm/campaigns/'+c.id+'/templates',{lang,promotionLinkId:promotion.id});assert.equal(a.status,200);assert.equal(a.data.kind,'template');assert.match(a.data.draft.whatsappInvitation,new RegExp('c='+c.code));
    const saved=await req('/api/crm/campaigns/'+c.id,{name:c.name,aiAssets:{templateDrafts:{[lang]:a.data.draft}}},'PUT');assert.equal(saved.status,200);assert.equal(saved.data.campaign.startTime,'14:00');assert.equal(saved.data.campaign.organizer,'TEST contact');assert.equal(saved.data.campaign.aiAssets.socialCopy,'Original human note');}
   const saved=(await req('/api/crm/campaigns/'+c.id)).data.campaign;assert.deepEqual(Object.keys(saved.aiAssets.templateDrafts).sort(),['en','id','zh']);assert.equal(saved.stats.leadsCount,1);
   const cleared=await req('/api/crm/campaigns/'+c.id,{name:c.name,stats:{budgetCost:null}},'PUT');assert.equal(cleared.data.campaign.stats.budgetCost,null);
   const bad=await req('/api/crm/campaigns/'+c.id,{name:c.name,endTime:'13:00'},'PUT');assert.equal(bad.status,400);assert.equal((await req('/api/crm/campaigns/'+c.id)).data.campaign.endTime,'15:00');
   assert.deepEqual(await protectedRows(),before);
  });
  await t.test('Sales cannot create, edit, or generate templates; read scope is unchanged',async()=>{
   assert.equal((await req('/api/crm/auth/login',{loginId:'Fadhil',password:'Fadhil'})).status,200);
   assert.equal((await req('/api/crm/campaigns', {...body,requestId:randomUUID()})).status,403);
   assert.equal((await req('/api/crm/campaigns/'+c.id,{name:'Unauthorized'},'PUT')).status,403);
   assert.equal((await req('/api/crm/campaigns/'+c.id+'/templates',{lang:'en'})).status,403);
   assert.deepEqual(await protectedRows(),before);
  });
 });
}else test('workspace HTTP acceptance requires explicit independent MySQL',{skip:'Set MYSQL_NATIVE_TEST_ENV'},()=>{});
