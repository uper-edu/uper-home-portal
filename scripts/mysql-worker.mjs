import dotenv from 'dotenv';
if(process.env.PORTAL_ENV_FILE)dotenv.config({path:process.env.PORTAL_ENV_FILE,override:false,quiet:true});
if(process.env.PORTAL_DEPLOYMENT==='company-trial')throw Error('Company notifications run only inside the leased application; standalone local worker forbidden');
if(process.env.PORTAL_DATABASE_DRIVER!=='mysql'||process.env.TRIAL_DATASET!=='synthetic'||process.env.PLATFORM_MODE!=='local'||process.env.PORTAL_NOTIFICATION_MODE!=='simulation')throw Error('Independent local MySQL simulation worker required');
const {pool,initialize}=await import('../server/portal/store.ts');
const {startWorker,stopWorker}=await import('../server/portal/worker.ts');
await initialize();
const channels=(await pool.query('SELECT * FROM notification_channels')).rows;
if(channels.some(c=>c.config.mode!=='simulation')){await pool.end();throw Error('Local acceptance worker cannot consume real notification channels');}
const timer=startWorker();timer.ref();console.log({mysqlWorkerReady:true,mode:'simulation'});
let stopping=false;
async function shutdown(){if(stopping)return;stopping=true;await stopWorker(timer);await pool.end();process.exit(0);}
process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
