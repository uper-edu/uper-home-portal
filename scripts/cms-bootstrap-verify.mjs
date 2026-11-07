import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readEnvironment} from '../server/environment.mjs';
import {openTrialDatabase} from '../cloud/mysql/database.mjs';
import {approvedRemoteDevelopment} from '../cloud/mysql/transport.mjs';
import {verifyPaymentAnalyticsSchema} from '../cloud/mysql/payment-analytics-schema.mjs';
import {verifyCmsMediaSchema} from '../cloud/mysql/cms-media-schema.mjs';
import {mediaDigest} from '../cloud/mysql/cms-media-storage.mjs';
import {bootstrapSchemaVersion,inspectInitializationSql,verifyBootstrapRows} from './lib/cms-bootstrap-contract.mjs';

export async function verifyInitializationSql(sqlPath,{schemaVersion=bootstrapSchemaVersion}={}){
 const sql=await fs.readFile(sqlPath,'utf8');
 // Validate the complete versioned package before opening any database connection.
 const {statements,tables}=inspectInitializationSql(sql,{schemaVersion});
 const {values}=readEnvironment('dev');if(!approvedRemoteDevelopment(values))throw Error('Approved development target required');
 const db=await openTrialDatabase(values),c=await db.getConnection();
 try{
  // Session-local tables shadow live names on THIS connection only and vanish on disconnect.
  for(const statement of statements)await c.query(statement.replace(/^CREATE TABLE /,'CREATE TEMPORARY TABLE '));
  await verifyCmsMediaSchema(c);
  const counts={},rows={};
  for(const table of tables){const [items]=await c.query('SELECT * FROM `'+table+'`');rows[table]=items;counts[table]=items.length;}
  verifyBootstrapRows(rows,schemaVersion);
  if(schemaVersion>=19)await verifyPaymentAnalyticsSchema(c,schemaVersion);
  if(schemaVersion>=18){
   for(const [table,required] of [['campaign_promotion_index',['p','campaign_id']],['campaign_promotion_short_links',['p','short_code']]]){
    const [columns]=await c.query('SHOW FULL COLUMNS FROM `'+table+'`');
    if(required.some(name=>!columns.some(column=>column.Field===name)))throw Error('Missing promotion schema column');
   }
  }
  const result={sqlSha256:mediaDigest(Buffer.from(sql)),temporaryTables:tables.size,counts,schemaVersion,persistentWrites:0,passed:true};
  await fs.writeFile(path.join(path.dirname(sqlPath),'sql-verification.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify(result));return result;
 }finally{c.destroy();await db.end();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [sqlPath,option]=process.argv.slice(2);
 const legacyVersions={'--legacy-v16':16,'--legacy-v18':18,'--legacy-v19':19};
 if(!sqlPath||option&&!Object.hasOwn(legacyVersions,option)||process.argv.length>4)throw Error('Usage: cms-bootstrap-verify.mjs PRIVATE_INITIALIZATION_SQL [--legacy-v16|--legacy-v18|--legacy-v19]');
 verifyInitializationSql(sqlPath,{schemaVersion:legacyVersions[option]??bootstrapSchemaVersion}).catch(e=>{console.error(JSON.stringify({error:e.code||'SQL_VERIFICATION_FAILED',message:e.code?undefined:e.message}));process.exitCode=1;});
}
