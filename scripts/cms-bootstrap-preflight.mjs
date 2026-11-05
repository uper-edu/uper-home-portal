import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import {splitSql,parseInsert,fingerprint} from './lib/mysql-dump.mjs';
import {identityDifferences} from './lib/bootstrap-safety.mjs';

export async function inspectBootstrap({source,credentials,output}){
 const env=dotenv.parse(await fs.readFile(credentials));
 if(env.MYSQL_HOST!=='cn60.monite.cn'||env.MYSQL_DATABASE!=='uper_trial_home'||env.MYSQL_PORT!=='3306')throw Error('Unapproved bootstrap target');
 const dump=await fs.readFile(source,'utf8');
 const statements=splitSql(dump);
 const selected=['crm_users','access_roles','access_state'];
 const accounts=Object.fromEntries(selected.map(name=>[name,[]]));
 for(const sql of statements){const m=/^INSERT INTO `([^`]+)`/i.exec(sql);if(m&&selected.includes(m[1]))accounts[m[1]].push(...parseInsert(sql).rows);}
 if(!accounts.crm_users.length||!accounts.access_roles.length||!accounts.access_state.length)throw Error('Missing identity bootstrap data');
 const bundle=JSON.parse(await fs.readFile(new URL('../cloud/mysql/seeds/cms/v2/bundle.json',import.meta.url)));
 const db=await mysql.createConnection({host:env.MYSQL_HOST,port:Number(env.MYSQL_PORT),user:env.MYSQL_USER,password:env.MYSQL_PASSWORD,database:env.MYSQL_DATABASE,dateStrings:true,supportBigNumbers:true,bigNumberStrings:true});
 try{
  await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  const [tables]=await db.query('SHOW TABLES');
  const snapshot={},ddl={};
  for(const entry of tables){const table=Object.values(entry)[0];if(!/^[a-z0-9_]+$/.test(table))throw Error('Unexpected table name');
   const [schema]=await db.query('SHOW CREATE TABLE `'+table+'`');ddl[table]=schema[0]['Create Table'];
   const [rows]=await db.query('SELECT * FROM `'+table+'`');snapshot[table]=rows;
  }
  await db.commit();
  const discrepancies=identityDifferences(accounts,snapshot);
  for(const [name,items] of Object.entries(bundle.collections)){
   const row=snapshot.cms_collections?.find(x=>x.name===name);
   const current=row?(row.items_text?JSON.parse(row.items_text):typeof row.items==='string'?JSON.parse(row.items):row.items):null;
   if(fingerprint(current)!==fingerprint(items))discrepancies.push({table:'cms_collections',collection:name,reason:'different-content'});
  }
  await fs.mkdir(output,{recursive:true});
  const backup=path.join(output,'before-cos.json');
  await fs.writeFile(backup,JSON.stringify({ddl,snapshot,accounts},null,2),{flag:'wx',mode:0o600});
  const summary={sourceSha256:createHash('sha256').update(dump).digest('hex'),tables:Object.keys(ddl).length,accounts:accounts.crm_users.length,cmsCollections:Object.keys(bundle.collections).length,media:bundle.media.length,discrepancies,backup};
  await fs.writeFile(path.join(output,'preflight.json'),JSON.stringify(summary,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({...summary,backup:path.basename(backup)}));
  if(discrepancies.length)process.exitCode=2;
 }finally{await db.end();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [source,credentials,output]=process.argv.slice(2);if(!source||!credentials||!output)throw Error('Usage: cms-bootstrap-preflight.mjs SOURCE PRIVATE_ENV PRIVATE_OUTPUT');
 inspectBootstrap({source,credentials,output}).catch(e=>{console.error(JSON.stringify({error:e.code||'PREFLIGHT_FAILED',message:e.code?undefined:e.message}));process.exitCode=1;});
}
