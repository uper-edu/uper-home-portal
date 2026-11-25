import {stdin} from 'node:process';
import {parseArgs} from 'node:util';
import {loadPortalEnvironment,normalizePortalEnvironment} from '../server/environment.mjs';
import {fetchGaTraffic,storeGaTraffic,trafficEnvironment} from '../server/portal/operationsDashboardTraffic.ts';
import {dashboardDate,dashboardDay} from '../src/utils/crmOperationsDashboard.ts';

async function main(){
  const {values}=parseArgs({options:{
    environment:{type:'string'},from:{type:'string'},to:{type:'string'},apply:{type:'boolean'},help:{type:'boolean'},
  }});
  if(values.help){
    console.log('Pipe a GA4 read-only OAuth access token to stdin.');
    console.log('Usage: node --import tsx scripts/sync-dashboard-traffic.mts --environment <dev|test|prod> [--from YYYY-MM-DD --to YYYY-MM-DD] [--apply]');
    console.log('Defaults to the last 28 complete WIB days. The default mode reads a preview without writing to UPER.');
    return;
  }
  const environment=trafficEnvironment(values.environment);
  const now=Date.now();
  const to=values.to??dashboardDate(now-dashboardDay);
  const from=values.from??dashboardDate(now-28*dashboardDay);
  if(values.apply){
    const configured=normalizePortalEnvironment(process.env);
    if((configured.PORTAL_ENV||configured.PORTAL_ENV_FILE||configured.PORTAL_ENV_SOURCE==='injected')&&configured.PORTAL_ENV!==environment)
      throw Error('The selected environment differs from the configured UPER environment');
  }
  if(stdin.isTTY)throw Error('Pipe the read-only OAuth token to stdin');
  let token='';
  for await(const part of stdin.setEncoding('utf8')){
    token+=part;
    if(token.length>4096)throw Error('Unexpected OAuth token format');
  }
  token=token.trim();
  if(!/^[A-Za-z0-9._~+/-]+=*$/.test(token))throw Error('Unexpected OAuth token format');
  const reports=await fetchGaTraffic(environment,from,to,token,now);
  if(values.apply){
    loadPortalEnvironment({target:environment});
    const {pool,tx}=await import('../server/portal/store.ts');
    try{await tx((db:any)=>storeGaTraffic(db,environment,reports));}
    finally{await pool.end();}
  }
  console.log(JSON.stringify({environment,from,to,applied:!!values.apply,days:reports.length,
    sessions:reports.reduce((sum,day)=>sum+day.sessions,0)}));
}

main().catch(error=>{
  console.error(error instanceof Error?error.message:'GA4 synchronization failed');
  process.exitCode=1;
});
