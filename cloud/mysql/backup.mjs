import fs from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';
import crypto from 'node:crypto';
import {openTrialDatabase,validateTrialDatabase} from './database.mjs';

function cli(env,program,args,stdio){
  const {url,name}=validateTrialDatabase(env);
  const executable=path.join(env.MYSQL_BIN_DIRECTORY,program);
  const connection=env.MYSQL_TRIAL_SOCKET?['--socket='+env.MYSQL_TRIAL_SOCKET]:['--host='+url.hostname,'--port='+(url.port||3306)];
  if(!env.MYSQL_TRIAL_SOCKET&&!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Remote backup requires an explicit verified TLS CLI configuration');
  return new Promise((resolve,reject)=>{
    const child=spawn(executable,['--no-defaults',...connection,'--user='+decodeURIComponent(url.username),...args,name],{env:{...process.env,MYSQL_PWD:decodeURIComponent(url.password)},stdio});
    let error='';child.stderr.on('data',chunk=>{error+=chunk.toString();});
    child.on('error',()=>reject(Error('Unable to launch MySQL backup tool')));
    child.on('exit',code=>code===0?resolve():reject(Error('MySQL backup operation failed: '+error.replaceAll(decodeURIComponent(url.password),'[REDACTED]').slice(0,500))));
  });
}
export async function backup(env,filename){
  const fd=openSync(filename,'wx',0o600);
  try{await cli(env,'mysqldump',['--single-transaction','--no-tablespaces','--set-gtid-purged=OFF','--skip-comments','--hex-blob'],['ignore',fd,'pipe']);}
  finally{closeSync(fd);}
  const bytes=await fs.readFile(filename);
  return {sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
}
export async function restore(env,filename,expectedHash){
  const data=await fs.readFile(filename);
  if(crypto.createHash('sha256').update(data).digest('hex')!==expectedHash)throw Error('Backup checksum mismatch');
  if(/^(?:CREATE DATABASE|USE |GRANT |CREATE USER|ALTER USER)/mi.test(data.toString()))throw Error('Backup may only restore tables in the selected trial database');
  const pool=await openTrialDatabase(env);
  const barrier='access_restore_guard_'+crypto.randomBytes(8).toString('hex');
  try{const [tables]=await pool.query('SHOW TABLES');if(tables.length)throw Error('Restore target must be empty');await pool.query('CREATE TABLE `'+barrier+'`(id INT PRIMARY KEY) ENGINE=InnoDB');}finally{await pool.end();}
  const fd=openSync(filename,'r');
  try{await cli(env,'mysql',[],[fd,'ignore','pipe']);}finally{closeSync(fd);}
  const restored=await openTrialDatabase(env);
  try{
    // Older account backups may predate access_roles. They must receive the same
    // restore gate; absence of the newer table is never permission to reopen.
      const {migrate}=await import('./migrate.mjs');await migrate(restored,validateTrialDatabase(env).name,{allowRestoreGuard:true});
      const c=await restored.getConnection();try{await c.beginTransaction();
        await c.query('DELETE FROM crm_sessions');
        // Legacy backups need the same serialization row, but must never seed
        // default users/roles automatically after review is released.
        await c.execute("INSERT INTO access_state(id,value) VALUES('policy',?) ON DUPLICATE KEY UPDATE value=JSON_SET(access_state.value,'$.initialized',JSON_EXTRACT('true','$'))",[JSON.stringify({initialized:true,restored:true})]);
        await c.execute("INSERT INTO access_state(id,value) VALUES('restore_review',?) ON DUPLICATE KEY UPDATE value=VALUES(value)",[JSON.stringify({required:true,restoreId:crypto.randomUUID(),reviewed:[],reset:[],recoveryAdmins:[],backupSha256:expectedHash})]);
        await c.query("INSERT INTO notification_migration_holds(kind,id,reason) SELECT 'job',id,'security_restore_review' FROM notification_jobs WHERE state IN ('pending','sending','unknown') ON DUPLICATE KEY UPDATE id=notification_migration_holds.id");
        await c.query("INSERT INTO notification_migration_holds(kind,id,reason) SELECT 'event',id,'security_restore_review' FROM outbox WHERE processed_at IS NULL ON DUPLICATE KEY UPDATE id=notification_migration_holds.id");
        await c.query("INSERT INTO notification_migration_holds(kind,id,reason) SELECT 'task',id,'security_restore_review' FROM followup_tasks WHERE status IN ('open','overdue','migration_hold') ON DUPLICATE KEY UPDATE id=notification_migration_holds.id");
        await c.commit();}catch(e){await c.rollback();throw e;}finally{c.release();}
  await restored.query('DROP TABLE `'+barrier+'`');
  }finally{await restored.end();}
}
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
export async function fingerprints(env){
  const pool=await openTrialDatabase(env),output={};
  try{
    const [tables]=await pool.query('SHOW TABLES');
    for(const item of tables){const name=Object.values(item)[0];if(!/^[a-z_]+$/.test(name))throw Error('Unexpected table');
      const [rows]=await pool.query('SELECT * FROM `'+name+'`');
      const values=rows.map(row=>JSON.stringify(canonical(row))).sort();
      output[name]={count:rows.length,sha256:crypto.createHash('sha256').update(values.join('\n')).digest('hex')};
    }
    return output;
  }finally{await pool.end();}
}
