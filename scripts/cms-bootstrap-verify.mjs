import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readEnvironment} from '../server/environment.mjs';
import {openTrialDatabase} from '../cloud/mysql/database.mjs';
import {approvedRemoteDevelopment} from '../cloud/mysql/transport.mjs';
import {splitSql,parseInsert} from './lib/mysql-dump.mjs';
import {mediaDigest} from '../cloud/mysql/cms-media-storage.mjs';

export async function verifyInitializationSql(sqlPath){
 const sql=await fs.readFile(sqlPath,'utf8');const statements=splitSql(sql);
 const tables=new Set();
 // Validate the entire statement list before opening a connection. No dump directives are trusted.
 for(const statement of statements){
  const create=/^CREATE TABLE `([a-z0-9_]+)`\s*\(/.exec(statement);
  if(create){if(tables.has(create[1])||/\bFOREIGN KEY\b|\bREFERENCES\b/i.test(statement))throw Error('Invalid initialization DDL');tables.add(create[1]);continue;}
  const insert=/^INSERT INTO `([a-z0-9_]+)`\s*\(/.exec(statement);
  if(insert){if(!tables.has(insert[1]))throw Error('Unexpected initialization table');parseInsert(statement);continue;}
  if(!['SET NAMES utf8mb4',"SET time_zone = '+00:00'","SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ENGINE_SUBSTITUTION'",'START TRANSACTION','COMMIT'].includes(statement))throw Error('Unexpected initialization SQL statement');
 }
 if(tables.size!==40)throw Error('Incomplete initialization schema');
 const {values}=readEnvironment('dev');if(!approvedRemoteDevelopment(values))throw Error('Approved development target required');
 const db=await openTrialDatabase(values),c=await db.getConnection();
 try{
  // Session-local tables shadow live names on THIS connection only and vanish on disconnect.
  // This executes the real DDL/DML without creating another database or changing live rows.
  for(const statement of statements)await c.query(statement.replace(/^CREATE TABLE /,'CREATE TEMPORARY TABLE '));
  const counts={};for(const table of tables){const [rows]=await c.query('SELECT COUNT(*) AS total FROM `'+table+'`');counts[table]=Number(rows[0].total);}
  const [media]=await c.query('SELECT COUNT(*) AS total FROM cms_media WHERE cos_url IS NULL OR content IS NOT NULL');
  const [versions]=await c.query("SELECT MAX(version) AS version FROM trial_schema_versions WHERE state='ready'");
  if(Number(media[0].total)!==0||versions[0].version!==16||counts.cms_media!==208||counts.cms_collections!==8)throw Error('Initialization data validation failed');
  for(const table of ['crm_sessions','portal_audit','notification_jobs','notification_channels','visitor_sessions','messages','conversations'])if(counts[table]!==0)throw Error('Unexpected runtime or secret records in initialization SQL');
  const result={sqlSha256:mediaDigest(Buffer.from(sql)),temporaryTables:tables.size,counts,schemaVersion:versions[0].version,persistentWrites:0,passed:true};
  await fs.writeFile(path.join(path.dirname(sqlPath),'sql-verification.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify(result));return result;
 }finally{c.destroy();await db.end();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw Error('Usage: cms-bootstrap-verify.mjs PRIVATE_INITIALIZATION_SQL');
 verifyInitializationSql(process.argv[2]).catch(e=>{console.error(JSON.stringify({error:e.code||'SQL_VERIFICATION_FAILED',message:e.code?undefined:e.message}));process.exitCode=1;});
}
