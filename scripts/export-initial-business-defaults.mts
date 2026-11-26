import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve,sep} from 'node:path';
import {parseArgs} from 'node:util';
import {readEnvironment} from '../server/environment.mjs';
import {openTrialDatabase} from '../cloud/mysql/database.mjs';
import {collectInitialBusinessDefaults} from '../cloud/mysql/initial-business-defaults.mjs';

async function main(){
 const {values}=parseArgs({options:{out:{type:'string'},help:{type:'boolean'}}});
 if(values.help){
  console.log('Usage: node --import tsx scripts/export-initial-business-defaults.mts --out data/system-defaults/business-defaults.v1.json');
  return;
 }
 const directory=resolve('data/system-defaults');
 const output=values.out?resolve(values.out):'';
 if(!output.startsWith(directory+sep)||dirname(output)!==directory)throw Error('Choose an unused file inside data/system-defaults');
 const {values:env}=readEnvironment('dev');
 if(env.PORTAL_ENV!=='dev'||env.TRIAL_DATASET!=='local-crm'||env.PORTAL_LOCAL_CUTOVER!=='true'||
  new URL(env.MYSQL_TRIAL_URL).pathname!=='/uper_local_crm')throw Error('The source must be the local 3000 CRM database');
 const pool=await openTrialDatabase(env);
 try{
  const c=await pool.getConnection();
  try{
   await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
   await c.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
   const bundle=await collectInitialBusinessDefaults(c);
   await c.commit();
   await mkdir(directory,{recursive:true,mode:0o700});
   const json=JSON.stringify(bundle)+'\n';
   await writeFile(output,json,{flag:'wx',mode:0o600});
   const counts=Object.fromEntries(Object.entries(bundle).filter(([,rows])=>Array.isArray(rows)).map(([key,rows])=>[key,rows.length]));
   console.log(JSON.stringify({sha256:createHash('sha256').update(json).digest('hex'),...counts,mail:bundle.mail!==null}));
  }finally{c.release();}
 }finally{await pool.end();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
