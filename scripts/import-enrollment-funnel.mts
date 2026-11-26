import {open} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {loadPortalEnvironment,normalizePortalEnvironment} from '../server/environment.mjs';
import {parseEnrollmentFunnelReport,storeEnrollmentFunnel} from '../server/portal/operationsDashboardEnrollmentFunnel.ts';
import {trafficEnvironment} from '../server/portal/operationsDashboardTraffic.ts';

async function main(){
  const {values}=parseArgs({options:{environment:{type:'string'},file:{type:'string'},apply:{type:'boolean'},help:{type:'boolean'}}});
  if(values.help){
    console.log('Usage: node --import tsx scripts/import-enrollment-funnel.mts --environment <dev|test|prod> --file <aggregate.json> [--apply]');
    console.log('Use the daily JSON output of scripts/analytics/enrollment-funnel.bigquery.sql. Preview is read-only.');
    return;
  }
  const environment=trafficEnvironment(values.environment);
  if(!values.file)throw Error('Specify the aggregate JSON report with --file');
  const file=await open(values.file,'r');
  let input:unknown;
  try{
    const stat=await file.stat();
    if(!stat.isFile()||stat.size>4*1024*1024)throw Error('Funnel report must be a regular JSON file at most 4 MiB');
    input=JSON.parse(await file.readFile('utf8'));
  }finally{await file.close();}
  const days=parseEnrollmentFunnelReport(input,environment);
  if(values.apply){
    const configured=normalizePortalEnvironment(process.env);
    if((configured.PORTAL_ENV||configured.PORTAL_ENV_FILE||configured.PORTAL_ENV_SOURCE==='injected')&&configured.PORTAL_ENV!==environment)
      throw Error('The selected environment differs from the configured UPER environment');
    loadPortalEnvironment({target:environment});
    const {pool,tx}=await import('../server/portal/store.ts');
    try{await tx(db=>storeEnrollmentFunnel(db,environment,days));}
    finally{await pool.end();}
  }
  console.log(JSON.stringify({environment,applied:!!values.apply,from:days[0].date,to:days.at(-1)?.date,coveredDays:days.length,
    landed:days.reduce((total,day)=>total+day.campaigns.reduce((count,row)=>count+row.landed,0),0),
    missingSessionViews:days.reduce((total,day)=>total+day.missingSessionViews,0)}));
}

main().catch(error=>{
  console.error(error instanceof Error?error.message:'GA4 enrollment funnel import failed');
  process.exitCode=1;
});
