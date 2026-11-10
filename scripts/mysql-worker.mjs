// Source-tree worker needs the same TypeScript resolver as the local application.
import {register} from 'tsx/esm/api';
register();
import {loadPortalEnvironment} from '../server/environment.mjs';
loadPortalEnvironment();
// TypeScript modules load only after register(); keep this import dynamic like the ones below.
const {log}=await import('../server/logger.ts');
// Same crash-with-clean-log semantics as the application process.
process.on('uncaughtException',(e)=>{log.error('process.uncaught_exception',{error:e});setImmediate(()=>process.exit(1));});
process.on('unhandledRejection',(e)=>{log.error('process.unhandled_rejection',{error:e});setImmediate(()=>process.exit(1));});
if(process.env.PORTAL_DEPLOYMENT==='company-trial')throw Error('Company notifications run only inside the leased application; standalone local worker forbidden');
if(process.env.PORTAL_DATABASE_DRIVER!=='mysql'||process.env.TRIAL_DATASET!=='synthetic'||process.env.PLATFORM_MODE!=='local'||process.env.PORTAL_DEPLOYMENT==='production')throw Error('Independent local MySQL simulation worker required');
const {pool,initialize}=await import('../server/portal/store.ts');
const {startWorker,stopWorker}=await import('../server/portal/worker.ts');
await initialize();
const channels=(await pool.query('SELECT * FROM notification_channels')).rows;
if(channels.some(c=>!c.config.deleted&&c.config.mode!=='simulation')){await pool.end();throw Error('Local acceptance worker cannot consume real notification channels');}
const timer=startWorker();timer.ref();log.info('worker.ready',{mysqlWorkerReady:true,mode:'simulation'});
let stopping=false;
async function shutdown(){if(stopping)return;stopping=true;await stopWorker(timer);await pool.end();process.exit(0);}
process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
