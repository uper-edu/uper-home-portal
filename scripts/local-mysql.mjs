// Optional managed local database startup; never used for a company server.
import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {openTrialDatabase} from '../cloud/mysql/database.mjs';
export async function prepareLocalMysql(env=process.env){
 if(env.PORTAL_DATABASE_DRIVER!=='mysql'||env.TRIAL_DATASET!=='local-crm'||!env.PORTAL_MYSQL_MANAGED_BINARY)return;
 const dir=path.resolve(env.PORTAL_MYSQL_MANAGED_DIRECTORY||'');
 if(!dir.startsWith(path.resolve('.local-backups')+path.sep)||env.MYSQL_TRIAL_SOCKET!=='/private/tmp/uper-crm-mysql-local3000.sock')throw Error('Unexpected local managed MySQL location');
 const ping=async()=>{const pool=await openTrialDatabase(env);try{await pool.query('SELECT 1');}finally{await pool.end();}};
 try{await ping();return;}catch(e){if(!['ENOENT','ECONNREFUSED'].includes(e.code))throw e;}
 const binary=path.resolve(env.PORTAL_MYSQL_MANAGED_BINARY),base=path.dirname(path.dirname(binary));
 if(!binary.startsWith(path.resolve('.local-backups')+path.sep)||!fs.existsSync(path.join(dir,'mysql','mysql.ibd'))&&!fs.existsSync(path.join(dir,'mysql.ibd')))throw Error('Initialized local MySQL required');
 const log=fs.openSync(path.join(path.dirname(dir),'mysql-console.log'),'a',0o600);
 try{const child=spawn(binary,['--basedir='+base,'--datadir='+dir,'--socket='+env.MYSQL_TRIAL_SOCKET,'--skip-networking','--mysqlx=OFF','--secure-file-priv=NULL','--pid-file='+path.join(path.dirname(dir),'mysql.pid'),'--log-error='+path.join(path.dirname(dir),'mysql-server.log')],{detached:true,stdio:['ignore',log,log]});child.unref();}finally{fs.closeSync(log);}
 for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,250));try{await ping();return;}catch(e){if(!['ENOENT','ECONNREFUSED'].includes(e.code))throw e;}}
 throw Error('Local MySQL startup timed out; inspect private server log');
}
