import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import mysql from 'mysql2/promise';
import {readEnvironment} from '../server/environment.mjs';
import {openTrialDatabase,transaction} from '../cloud/mysql/database.mjs';
import {approvedRemoteDevelopment} from '../cloud/mysql/transport.mjs';
import {migrate} from '../cloud/mysql/migrate.mjs';
import {loadCmsSeed,mapSeedMedia,seedBusinessContent,saveCmsMediaMetadata} from '../cloud/mysql/cms-seed.mjs';
import {fingerprint,withoutForeignKeys} from './lib/mysql-dump.mjs';
import {mediaDigest} from '../cloud/mysql/cms-media-storage.mjs';
import {identityDifferences,cmsChangeState,writePrivateArtifact} from './lib/bootstrap-safety.mjs';

export function sqlInsert(table,rows,columns){
 if(!/^[a-z0-9_]+$/.test(table)||columns.some(x=>!/^\w+$/.test(x)))throw Error('Invalid export identifiers');
 return rows.map(row=>{
  const keys=columns.filter(k=>row[k]!==undefined);
  const values=keys.map(k=>mysql.escape(row[k]!==null&&typeof row[k]==='object'&&!Buffer.isBuffer(row[k])?JSON.stringify(row[k]):row[k]));
  return 'INSERT INTO `'+table+'` ('+keys.map(k=>'`'+k+'`').join(',')+') VALUES ('+values.join(',')+');';
 }).join('\n');
}

export async function applyBootstrap({backupPath,receiptPath,output,apply=false}){
 const {values:env}=readEnvironment('dev');
 if(!approvedRemoteDevelopment(env))throw Error('Only the explicitly approved development target is supported');
 const backup=JSON.parse(await fs.readFile(backupPath,'utf8'));
 if(identityDifferences(backup.accounts,backup.snapshot).length)throw Error('Source accounts and backed-up identity state differ');
 const {bundle,media,summary}=await loadCmsSeed();
 const receipt=JSON.parse(await fs.readFile(receiptPath,'utf8'));
 const verified=new Map(receipt.resources.map(x=>[x.id,x]));
 if(bundle.media.some(x=>verified.get(x.id)?.url!==x.url||verified.get(x.id)?.bytes!==x.bytes))throw Error('Complete COS verification receipt required');
 const db=await openTrialDatabase(env);
 try{
  const changes=[];
  for(const [name,items] of Object.entries(bundle.collections)){
   const row=backup.snapshot.cms_collections.find(x=>x.name===name);
   const before=row.items_text?JSON.parse(row.items_text):row.items;
   const converted=mapSeedMedia(before,media);
   if(fingerprint(seedBusinessContent(converted))!==fingerprint(seedBusinessContent(items)))throw Error('Seed business content differs: '+name);
   const after=converted.map(item=>JSON.stringify(item)===JSON.stringify(before.find(x=>x._id===item._id))?item:{...item,_cmsVersion:(Number(item._cmsVersion)||0)+1});
   changes.push({name,before,row,after});
  }
  // Fail closed before any schema write if identities or content changed after the backup.
  for(const table of ['crm_users','access_roles','access_state']){
   const [current]=await db.query('SELECT * FROM `'+table+'` ORDER BY id');
   const original=[...backup.snapshot[table]].sort((a,b)=>String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0);
   current.sort((a,b)=>String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0);
   if(fingerprint(current)!==fingerprint(original))throw Error('Identity state changed after backup: '+table);
  }
  for(const change of changes){const [rows]=await db.execute('SELECT items,items_text,revision FROM cms_collections WHERE name=?',[change.name]);
   change.state=cmsChangeState(rows[0],change);
   if(change.state==='conflict')throw Error('CMS changed after backup: '+change.name);
  }
  if(!apply){console.log(JSON.stringify({mode:'preview',...summary,accounts:backup.accounts.crm_users.length,alreadyApplied:changes.every(x=>x.state==='applied'),ready:true}));return;}
  const operationPath=path.join(output,'bootstrap-state.json');
  // Do not bind the journal to the observed pending/applied state: a commit changes that state.
  const stableDigest=fingerprint({accounts:backup.accounts,changes:changes.map(({state,...change})=>change),bundle});
  let operation;
  try{operation=JSON.parse(await fs.readFile(operationPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(operation){if(operation.inputDigest!==stableDigest)throw Error('Bootstrap input differs from the saved operation');}
  else{
   const existing=await fs.readdir(output).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
   if(existing.length)throw Error('Output contains artifacts without a matching operation; choose a new private output directory');
   operation={inputDigest:stableDigest,at:new Date().toISOString()};
   await writePrivateArtifact(operationPath,JSON.stringify(operation,null,2));
  }
  const migration=await migrate(db,'uper_trial_home',{initializeSystemDefaults:false});
  await transaction(db,async c=>{
   for(const change of changes){
    const [rows]=await c.execute('SELECT items,items_text,revision FROM cms_collections WHERE name=? FOR UPDATE',[change.name]);
    change.state=cmsChangeState(rows[0],change);
    if(change.state==='conflict')throw Error('Concurrent CMS modification');
   }
   for(const item of bundle.media)await saveCmsMediaMetadata(c,item);
   for(const change of changes){
    if(change.state==='applied')continue;
    const text=JSON.stringify(change.after);
    await c.execute('UPDATE cms_collections SET items=?,items_text=?,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE name=?',[text,text,change.name]);
   }
  });
  const schema={},columns={};
  const [tables]=await db.query('SHOW TABLES');
  for(const entry of tables){const table=Object.values(entry)[0];if(!/^[a-z0-9_]+$/.test(table))throw Error('Invalid table');
   const [ddl]=await db.query('SHOW CREATE TABLE `'+table+'`');schema[table]=withoutForeignKeys(ddl[0]['Create Table']);
   const [fields]=await db.query('SHOW FULL COLUMNS FROM `'+table+'`');columns[table]=fields.filter(f=>!/(?:VIRTUAL|STORED) GENERATED/.test(f.Extra)).map(f=>f.Field);
  }
  const defaults=JSON.parse(await fs.readFile(new URL('../cloud/mysql/system-defaults.json',import.meta.url)));
  const courseBook=JSON.parse(await fs.readFile(new URL('../src/data/crmCoursePrices.json',import.meta.url)));
  const at=operation.at;
  const records=JSON.parse(JSON.stringify(defaults.campaigns).replaceAll('SYSTEM_INITIALIZED_AT',at));
  const seedRows={...backup.accounts,
   trial_schema_versions:Array.from({length:migration.version},(_,i)=>({version:i+1,state:'ready'})),
   cms_collections:Object.entries(bundle.collections).map(([name,items])=>({name,items,items_text:JSON.stringify(items),revision:1})),
   cms_media:bundle.media.map(x=>({id:x.id,mime:'image/webp',content:null,uploaded_by:'cms-initialization',storage_type:'cos',cos_url:x.url,object_key:x.objectKey,byte_size:x.bytes})),
   trial_campaigns:records.map(config=>({id:config.id,code:config.code,config})),
   crm_courses:courseBook.courses.map(course=>{const id='hsk-standard-'+course.id.replace(/^HSK /,'').toLowerCase();const config={name:course.id,sessions:course.sessions,price:course.total,active:true,maxDiscountBps:0,maxDiscountAmount:null};return {id,revision:1,value:{...config,presetKey:'hsk_standard_v1',updatedAt:at,history:[{id:'system-initialize-'+id,actor:'system',at,before:null,after:config}]}};})
  };
  const parts=['-- Sensitive account bootstrap. Import only into an explicitly selected EMPTY MySQL 8 database.','-- Contains password hashes, not plaintext passwords. Do not commit or publish.','SET NAMES utf8mb4;',"SET time_zone = '+00:00';","SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ENGINE_SUBSTITUTION';"];
  for(const name of Object.keys(schema).sort())parts.push(schema[name]+';');
  parts.push('START TRANSACTION;');
  for(const [name,rows] of Object.entries(seedRows))parts.push(sqlInsert(name,rows,columns[name]));
  parts.push('COMMIT;');const sql=parts.join('\n\n')+'\n';
  if(/\b(?:FOREIGN KEY|REFERENCES|DROP TABLE|TRUNCATE|CREATE DATABASE|USE\s+`)/i.test(sql))throw Error('Unsafe initialization SQL');
  await fs.mkdir(output,{recursive:true});
  const sqlPath=path.join(output,'uper-production-initialization.sql'),sqlSha256=mediaDigest(Buffer.from(sql));
  await writePrivateArtifact(sqlPath,sql);
  await writePrivateArtifact(path.join(output,'SHA256SUMS'),sqlSha256+'  '+path.basename(sqlPath)+'\n');
  const manifest={schemaVersion:migration.version,tables:Object.keys(schema).length,accounts:seedRows.crm_users.length,cms:summary,seedRows:Object.fromEntries(Object.entries(seedRows).map(([name,rows])=>[name,rows.length])),sqlSha256,excluded:['sessions','audit','conversation history','pending notifications','notification credentials'],updatedCollections:changes.map(x=>x.name)};
  await writePrivateArtifact(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
  console.log(JSON.stringify({applied:true,...manifest,sqlPath}));
 }finally{await db.end();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,backupPath,receiptPath,output]=process.argv.slice(2);
 if(!['preview','apply'].includes(mode)||!output)throw Error('Usage: cms-bootstrap-apply.mjs preview|apply BACKUP RECEIPT PRIVATE_OUTPUT');
 applyBootstrap({backupPath,receiptPath,output,apply:mode==='apply'}).catch(e=>{console.error(JSON.stringify({error:e.code||'BOOTSTRAP_FAILED',message:e.code?undefined:e.message}));process.exitCode=1;});
}
