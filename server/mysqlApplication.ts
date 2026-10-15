import { configureAccessTransport } from "./portal/accessTransport.ts";
import express from 'express';
import path from 'node:path';
import {mountHskAssets} from './hskAssets.ts';
import {mountPortal} from './portal/runtime.ts';
import {mountChat} from './portal/chat.ts';
import {startWorker,stopWorker} from './portal/worker.ts';
import {pool,tx} from './portal/store.ts';
import {nativePool} from '../cloud/mysql/runtime.mjs';
import {mountSite} from '../cloud/mysql/site.mjs';
import {platform} from './portal/identity.ts';
import {visitor} from './portal/runtime.ts';
import {leadTier,taskDeadline} from './portal/followup.ts';
import {campaignsContext} from '../cloud/mysql/campaign-context.mjs';
import {loadCampaigns,getCurrentCampaigns,saveCampaign,deleteCampaign,trackCampaignImpression,synthesizeCampaignAiAssets} from './campaignStorage.ts';
export async function startMysqlApplication(){
if(process.env.PORTAL_DATABASE_DRIVER!=='mysql')throw Error('Explicit MySQL driver required');
if(process.env.ACCESS_ALLOW_TEST_PASSWORDS==='true'&&(process.env.TRIAL_DATASET!=='synthetic'||process.env.APP_ENV!=='test'))throw Error('Fixed test credentials are forbidden outside isolated synthetic tests');
const activeLocal=process.env.TRIAL_DATASET==='local-crm'&&process.env.PORTAL_LOCAL_CUTOVER==='true';
if(!activeLocal&&process.env.TRIAL_DATASET!=='synthetic')throw Error('Migration-copy databases cannot run the application');
if(process.env.PLATFORM_MODE!=='local')throw Error('Local acceptance only; server deployment requires a separate gate');
const port=Number(process.env.PORT || 4412);
if(!Number.isInteger(port)||port<1024||port>65535||(port===3000&&!activeLocal))throw Error('Independent local MySQL port required; 3000 cutover not authorized');
const faults=process.env.PORTAL_FAULT_TEST==='true';
if(!faults && ['TRIAL_MODEL_STUB','TRIAL_PRIMARY_FAILURE','TRIAL_CONTENT_FAILURE_ONCE','TRIAL_FOLLOWUP_FAILURE_ONCE'].some(k=>process.env[k]==='true'))throw Error('Fault injection requires explicit local test mode');
let modelStub:any;
if(process.env.TRIAL_MODEL_STUB==='true'||process.env.TRIAL_PRIMARY_FAILURE==='true'){
  const stub=express();stub.use(express.json());
  stub.post('/openai',(_q,r)=>{r.setHeader('Content-Type','text/event-stream');r.end('data: '+JSON.stringify({choices:[{delta:{content:'FAILED PRIMARY PARTIAL'}}]})+'\n\n');});
  stub.post('/deepseek',(_q,r)=>r.json({choices:[{message:{content:'TEST DeepSeek response: What schedule works for you?'},finish_reason:'stop'}]}));
  modelStub=stub.listen(4413,'127.0.0.1');
  process.env.OPENAI_API_BASE_URL='http://127.0.0.1:4413/openai';
  if(process.env.TRIAL_MODEL_STUB==='true'){
    process.env.OPENAI_API_KEY='local-model-stub';process.env.DEEPSEEK_API_KEY='local-model-stub';
    process.env.DEEPSEEK_API_BASE_URL='http://127.0.0.1:4413/deepseek';
  }
}
const app=express();configureAccessTransport(app);app.use(express.json({limit:'16mb'}));
let failContent=process.env.TRIAL_CONTENT_FAILURE_ONCE==='true';
app.post(['/api/content','/api/sanity'],(_q,r,next)=>{if(!failContent)return next();failContent=false;r.status(503).json({error:'TEST content storage unavailable'});});
app.use((_q,r,next)=>{r.setHeader('X-Content-Type-Options','nosniff');r.setHeader('Referrer-Policy','same-origin');next();});
let failFollowup=process.env.TRIAL_FOLLOWUP_FAILURE_ONCE==='true';
app.post('/api/crm/leads/:id/logs',(_q,r,next)=>{
  if(!failFollowup)return next();
  failFollowup=false;r.status(503).json({error:'TEST injected unavailable service; retry the same request'});
});
mountHskAssets(app);
app.use('/api',async (_q,_r,next)=>{try{const rows=(await pool.query("SELECT config FROM trial_campaigns ORDER BY created_at DESC")).rows;campaignsContext.run(rows.map(r=>r.config),next);}catch(e){next(e);}});
await mountPortal(app);mountChat(app);
await mountSite(app,{db:nativePool,platform,visitor,portalTx:tx,leadTier,taskDeadline});
const wrap=(fn:any)=>(q:any,r:any)=>Promise.resolve(fn(q,r)).catch((e:any)=>r.status(e.status||503).json({error:e.status&&e.status<500?e.message:'Storage unavailable; operation not saved'}));
app.get(['/api/crm/campaigns','/api/campaigns'],wrap(async(q:any,r:any)=>r.json({success:true,campaigns:q.path.startsWith('/api/crm')?await getCurrentCampaigns(r.locals.crmEmployee):loadCampaigns().map(({stats,...c})=>c)})));
app.get(['/api/crm/campaigns/:idOrCode','/api/campaigns/:idOrCode'],wrap(async(q:any,r:any)=>{const list=q.path.startsWith('/api/crm')?await getCurrentCampaigns(r.locals.crmEmployee):loadCampaigns();const campaign=list.find(c=>[c.id,c.code,c.name,c.nameEn].includes(q.params.idOrCode));if(!campaign)return r.status(404).json({error:'Campaign not found'});const {stats,...publicCampaign}=campaign;r.json({success:true,campaign:q.path.startsWith('/api/crm')?campaign:publicCampaign});}));
app.post('/api/crm/campaigns',wrap(async(q:any,r:any)=>r.json({success:true,campaign:await saveCampaign({...q.body,__actor:r.locals.crmEmployee.id})})));
app.put('/api/crm/campaigns/:id',wrap(async(q:any,r:any)=>r.json({success:true,campaign:await saveCampaign({...q.body,id:q.params.id,__actor:r.locals.crmEmployee.id})})));
app.delete('/api/crm/campaigns/:id',wrap(async(q:any,r:any)=>r.json({success:await deleteCampaign(q.params.id)})));
app.post('/api/crm/campaigns/ai-generate',wrap(async(q:any,r:any)=>{if(typeof q.body.name!=='string'||!q.body.name.trim())return r.status(400).json({error:'Campaign name required'});r.json({success:true,aiAssets:synthesizeCampaignAiAssets(q.body)});}));
app.post(['/api/crm/campaigns/:idOrCode/impression','/api/campaigns/:idOrCode/impression'],wrap(async(q:any,r:any)=>r.json({success:await trackCampaignImpression(q.params.idOrCode)})));
app.use('/api',(_q,r)=>r.status(404).json({error:'API endpoint not found'}));
if(process.env.TRIAL_FRONTEND_DIRECTORY){
  const directory=path.resolve(process.env.TRIAL_FRONTEND_DIRECTORY);
  app.use(express.static(directory));
  app.get('/{*path}',(_q,r)=>r.sendFile('index.html',{root:directory}));
}
app.use((e:any,_q:any,r:any,_next:any)=>r.status(e.status||503).json({error:e.status===413?'Request too large':'Request could not be processed'}));
if(process.env.PORTAL_WORKER_ENABLED==='true'&&!activeLocal){
 if(process.env.PORTAL_NOTIFICATION_MODE!=='simulation')throw Error('This local acceptance requires simulated notifications');
 const channels=(await pool.query("SELECT * FROM notification_channels")).rows;
 if(channels.some(c=>c.config.mode!=='simulation'))throw Error('Live channels must not be consumed by local acceptance workers');
}
const timer=process.env.PORTAL_WORKER_ENABLED==='true'?startWorker():null;
const server=app.listen(port,'127.0.0.1',()=>console.log({mysqlReady:true,port,workerEnabled:!!timer}));
let closing=false;
async function shutdown(){if(closing)return;closing=true;if(timer)await stopWorker(timer);modelStub?.close();server.close(async()=>{await pool.end();process.exit(0);});}
process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
return {app,server};
}
