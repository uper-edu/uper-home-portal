import crypto from 'node:crypto';
import {companyConfiguration,isCompanyTrial} from '../../server/companyTrial.ts';
import {openTrialDatabase} from './database.mjs';

export function assertCompanyMaintenance(env) {
  if(!isCompanyTrial(env))return false;
  if(env.ACCESS_RECOVERY_MAINTENANCE!=='true' || env.PORTAL_WORKER_ENABLED!=='false')
    throw Error('Company recovery requires explicit maintenance configuration with workers paused');
  companyConfiguration({...env,ACCESS_RECOVERY_MAINTENANCE:'false'});
  return true;
}
const resource=env=>'company-runtime:'+decodeURIComponent(new URL(env.MYSQL_TRIAL_URL).pathname.slice(1));
export const companyRuntimeLock = env => 'uper:'+crypto.createHash('sha256').update(resource(env)).digest('hex').slice(0,58);
export const companyRecoveryResource=(env,fallback)=>isCompanyTrial(env)?resource(env):fallback;

/** A dedicated MySQL session owns the lease for the entire application lifetime. */
export async function acquireCompanyRuntimeLease(db,env,onLost=()=>{}) {
  const c=await db.getConnection(),key=companyRuntimeLock(env);
  let released=false,timer,busy=false;
  try{
    const [rows]=await c.execute('SELECT GET_LOCK(?,0) AS acquired',[key]);
    if(Number(rows[0].acquired)!==1)throw Error('Company application or maintenance already running');
    timer=setInterval(async()=>{
      if(released||busy)return;busy=true;
      try{const [rows]=await c.execute('SELECT IS_USED_LOCK(?)=CONNECTION_ID() AS held',[key]);if(Number(rows[0].held)!==1)throw Error('Lease lost');}
      catch{if(!released){released=true;clearInterval(timer);c.destroy();onLost();}}
      finally{busy=false;}
    },1000);timer.unref();
    return async()=>{if(released)return;released=true;clearInterval(timer);try{await c.execute('SELECT RELEASE_LOCK(?)',[key]);c.release();}catch{c.destroy();}};
  }catch(e){c.destroy();throw e;}
}

/** Locks the real database, not localhost in a potentially different Docker container. */
export async function withCompanyMaintenance(env,input,operation) {
  if(!isCompanyTrial(env))return operation();
  assertCompanyMaintenance(env);
  if(input.servicesStopped!==true)throw Error('Explicit stopped application and workers confirmation required');
  const db=await openTrialDatabase(env);
  let release;
  try{
    release=await acquireCompanyRuntimeLease(db,env,()=>{console.error('Company maintenance lease lost; stopping. Query results before retry.');process.exit(1);});
    // The operation uses its own transaction/session. The lease prevents a normal app from starting.
    return await operation();
  }finally{if(release)await release();await db.end();}
}
