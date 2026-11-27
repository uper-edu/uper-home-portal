import {createSign} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {withLock} from '../mysql/database.mjs';
import {loadPortalEnvironment} from '../../server/environment.mjs';
import {syncTestEnrollmentFunnel,testEnrollmentFunnelBigQuery,testFunnelProject} from '../../server/portal/operationsDashboardEnrollmentFunnelSync.ts';

const tokenUrl='https://oauth2.googleapis.com/token';

async function bigQueryToken(){
  const chunks=[];
  let bytes=0;
  for await(const chunk of process.stdin){
    bytes+=chunk.length;
    if(bytes>65_536)throw Error('BigQuery credential is too large');
    chunks.push(chunk);
  }
  let key;
  try{key=JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch{throw Error('Expected the private BigQuery service account JSON on stdin');}
  if(key.type!=='service_account'||key.project_id!==testFunnelProject||key.token_uri!==tokenUrl||
    key.client_email!=='uper-enrollment-funnel@'+testFunnelProject+'.iam.gserviceaccount.com'||
    typeof key.private_key!=='string'||typeof key.private_key_id!=='string')
    throw Error('Expected the designated UPER Test service account');

  const now=Math.floor(Date.now()/1000);
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const claims=encode({iss:key.client_email,aud:tokenUrl,scope:'https://www.googleapis.com/auth/bigquery',iat:now,exp:now+600});
  const signed=encode({alg:'RS256',typ:'JWT',kid:key.private_key_id})+'.'+claims;
  const assertion=signed+'.'+createSign('RSA-SHA256').update(signed).sign(key.private_key,'base64url');
  const response=await fetch(tokenUrl,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15_000),
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  if(!response.ok)throw Error('BigQuery service account authentication failed (HTTP '+response.status+')');
  const token=(await response.json()).access_token;
  if(typeof token!=='string'||!token)throw Error('Google did not issue a BigQuery access token');
  return token;
}

async function main(){
  const {values}=parseArgs({options:{database:{type:'string'},preview:{type:'boolean'}}});
  loadPortalEnvironment();
  const target=values.database;
  if(process.env.PORTAL_ENV!=='test'||process.env.PORTAL_DEPLOYMENT!=='company-trial'||
    typeof target!=='string'||!/^uper_trial_home_[a-z0-9_]+$/.test(target)||
    new URL(process.env.MYSQL_TRIAL_URL).pathname!=='/'+target)
    throw Error('BigQuery sync requires the designated company test database');
  const sql=await readFile(new URL('./enrollment-funnel.bigquery.sql',import.meta.url),'utf8');
  const token=await bigQueryToken();
  const {nativePool}=await import('../mysql/runtime.mjs');
  const {initialize,pool,tx}=await import('../../server/portal/store.ts');
  try{
    await initialize();
    const synced=await withLock(nativePool,'ga-enrollment-funnel:'+target,()=>syncTestEnrollmentFunnel(
      {db:pool,transaction:tx},testEnrollmentFunnelBigQuery(token,sql),{preview:values.preview}));
    console.log(JSON.stringify(synced));
  }finally{
    await nativePool.end();
  }
}

main().catch(error=>{
  const message=error?.message;
  console.error(typeof message==='string'&&/^(Expected |Google did not issue |BigQuery |Invalid GA4 |Resource is busy)/.test(message)
    ? message:'Company test BigQuery sync failed');
  process.exitCode=1;
});
