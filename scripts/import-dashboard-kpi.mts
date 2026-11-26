import {open} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {loadPortalEnvironment,normalizePortalEnvironment} from '../server/environment.mjs';
import {parseDashboardKpiImport,storeDashboardKpiPlan} from '../server/portal/operationsDashboardKpi.ts';
import {trafficEnvironment} from '../server/portal/operationsDashboardTraffic.ts';

async function main(){
  const {values}=parseArgs({options:{
    environment:{type:'string'},file:{type:'string'},apply:{type:'boolean'},help:{type:'boolean'},
  }});
  if(values.help){
    console.log('Usage: node --import tsx scripts/import-dashboard-kpi.mts --environment <dev|test|prod> --file <approved-plan.json> [--apply]');
    console.log('Default mode validates and previews the approved monthly plan without database access.');
    return;
  }
  const environment=trafficEnvironment(values.environment);
  if(!values.file)throw Error('Specify the approved plan with --file');
  const file=await open(values.file,'r');
  let input:unknown;
  try{
    const stat=await file.stat();
    if(!stat.isFile()||stat.size>64*1024)throw Error('KPI plan must be a regular JSON file at most 64 KiB');
    input=JSON.parse(await file.readFile('utf8'));
  }finally{await file.close();}
  const plan=parseDashboardKpiImport(input,environment);
  if(values.apply){
    const configured=normalizePortalEnvironment(process.env);
    if((configured.PORTAL_ENV||configured.PORTAL_ENV_FILE||configured.PORTAL_ENV_SOURCE==='injected')&&configured.PORTAL_ENV!==environment)
      throw Error('The selected environment differs from the configured UPER environment');
    loadPortalEnvironment({target:environment});
    const {pool,tx}=await import('../server/portal/store.ts');
    try{await tx(db=>storeDashboardKpiPlan(db,plan));}
    finally{await pool.end();}
  }
  console.log(JSON.stringify({applied:Boolean(values.apply),...plan}));
}

main().catch(error=>{
  console.error(error instanceof SyntaxError?'Invalid KPI plan JSON':error instanceof Error?error.message:'KPI plan import failed');
  process.exitCode=1;
});
