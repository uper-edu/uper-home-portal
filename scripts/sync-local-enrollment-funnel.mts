import {execFile} from 'node:child_process';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {parseArgs,promisify} from 'node:util';
import {validateTrialDatabase,withLock} from '../cloud/mysql/database.mjs';
import {loadPortalEnvironment} from '../server/environment.mjs';
import {isLocalEnrollmentRuntime} from '../server/portal/enrollmentSimulation.ts';
import {parseEnrollmentFunnelReport} from '../server/portal/operationsDashboardEnrollmentFunnel.ts';
import {syncTestEnrollmentFunnel,testEnrollmentFunnelBigQuery} from '../server/portal/operationsDashboardEnrollmentFunnelSync.ts';

const {values}=parseArgs({options:{
  gcloud:{type:'string'},python:{type:'string'},'schedule-state':{type:'string'},latest:{type:'boolean'},preview:{type:'boolean'},
}});
const wib=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta',dateStyle:'short',timeStyle:'short'});
const execute=promisify(execFile);

async function main(){
  const {gcloud,python,'schedule-state':state}=values;
  if(!gcloud||!python||![gcloud,python,...(state?[state]:[])].every(isAbsolute)) throw Error('Use absolute local tool and schedule paths');
  let slot:string|undefined;
  if(state){
    const [day,time]=wib.format(new Date()).split(' ');
    const lastSlot=['12:05','14:05','16:05','18:05','20:05','22:05'].findLast(value=>value<=time);
    if(!lastSlot)return;
    slot=day+' '+lastSlot;
    if((await readFile(state,'utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error;})).trim()===slot)return;
    await writeFile(state+'.next',slot+'\n',{mode:0o600});
    await rename(state+'.next',state);
  }

  loadPortalEnvironment({target:'dev'});
  if(!isLocalEnrollmentRuntime()||validateTrialDatabase(process.env).name!=='uper_local_crm'||
    process.env.PORT!=='3000')
    throw Error('BigQuery import requires the active local 3000 database');
  let auth;
  try{
    auth=await execute(gcloud,['auth','print-access-token','--quiet'],{env:{HOME:process.env.HOME,PATH:process.env.PATH,CLOUDSDK_PYTHON:python},timeout:20_000});
  }catch{throw Error('Local Google Cloud authorization unavailable');}
  const token=auth.stdout.trim();
  if(!token)throw Error('Local Google Cloud authorization unavailable');
  const query=await readFile(new URL('./analytics/enrollment-funnel.bigquery.sql',import.meta.url),'utf8');
  const api=testEnrollmentFunnelBigQuery(token,query,fetch,'dev');
  const {nativePool}=await import('../cloud/mysql/runtime.mjs');
  const {initialize,pool,tx}=await import('../server/portal/store.ts');
  try{
    await initialize();
    let report:ReturnType<typeof parseEnrollmentFunnelReport>=[];
    const result=await withLock(nativePool,'ga-enrollment-funnel:uper_local_crm',()=>syncTestEnrollmentFunnel({db:pool,transaction:tx},{
      tableRevision:api.tableRevision,
      async readReport(from,to){
        const raw=await api.readReport(from,to);
        report=parseEnrollmentFunnelReport(raw,'dev');
        return raw;
      },
    },{environment:'dev',latestOnly:values.latest,preview:values.preview}));
    console.log(JSON.stringify({environment:'dev',stream:'UPER Local',atWib:wib.format(new Date()),slot,...result,
      days:report.map(day=>({date:day.date,missingSessionViews:day.missingSessionViews,
        ...Object.fromEntries((['landed','viewedClass','started','reserved','savedProof'] as const)
          .map(step=>[step,day.campaigns.reduce((sum,campaign)=>sum+campaign[step],0)]))}))}));
  }finally{await nativePool.end();}
}

main().catch(error=>{
  const message=error?.message;
  console.error(typeof message==='string'&&/^(Use absolute|Local Google Cloud|BigQuery |Invalid GA4 |Resource is busy)/.test(message)
    ?message:'Local BigQuery sync failed');
  process.exitCode=1;
});
