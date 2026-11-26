import {open} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {loadPortalEnvironment,normalizePortalEnvironment} from '../server/environment.mjs';
import {parseDashboardAdSpend,storeDashboardAdSpend,summarizeDashboardAdSpendImport} from '../server/portal/operationsDashboardAdSpend.ts';
import {trafficEnvironment} from '../server/portal/operationsDashboardTraffic.ts';

async function main(){
  const {values}=parseArgs({options:{
    environment:{type:'string'},file:{type:'string'},apply:{type:'boolean'},help:{type:'boolean'},
  }});
  if(values.help){
    console.log('Usage: node --import tsx scripts/import-dashboard-ad-spend.mts --environment <dev|test|prod> --file <normalized-report.json> [--apply]');
    console.log('Default mode reconciles the file and previews spend without touching the database.');
    return;
  }
  const environment=trafficEnvironment(values.environment);
  if(!values.file)throw Error('Specify the normalized advertising report with --file');
  const file=await open(values.file,'r');
  let input:unknown;
  try{
    const stat=await file.stat();
    if(!stat.isFile()||stat.size>4*1024*1024)throw Error('Advertising report must be a regular JSON file at most 4 MiB');
    input=JSON.parse(await file.readFile('utf8'));
  }finally{await file.close();}
  const report=parseDashboardAdSpend(input,environment);
  const summary=summarizeDashboardAdSpendImport(report);
  if(values.apply){
    const configured=normalizePortalEnvironment(process.env);
    if((configured.PORTAL_ENV||configured.PORTAL_ENV_FILE||configured.PORTAL_ENV_SOURCE==='injected')&&configured.PORTAL_ENV!==environment)
      throw Error('The selected environment differs from the configured UPER environment');
    loadPortalEnvironment({target:environment});
    const {pool,tx}=await import('../server/portal/store.ts');
    try{await tx((db:any)=>storeDashboardAdSpend(db,environment,report));}
    finally{await pool.end();}
  }
  console.log(JSON.stringify({environment,applied:!!values.apply,...summary}));
}

main().catch(error=>{
  console.error(error instanceof Error?error.message:'Advertising report import failed');
  process.exitCode=1;
});
