import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import dotenv from 'dotenv';
import {openTrialDatabase,transaction} from './database.mjs';
import {withCompanyMaintenance} from './company-maintenance.mjs';
export const legacyDelayRule='TEST-handoff-delay';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
async function snapshot(db){const [rules]=await db.query('SELECT * FROM notification_rules WHERE id=? FOR UPDATE',[legacyDelayRule]);const [jobs]=await db.query("SELECT id,state FROM notification_jobs WHERE rule_id=? AND state IN ('pending','sending','failed','unknown') ORDER BY id FOR UPDATE",[legacyDelayRule]);const rule=rules[0]||null;if(rule&&(rule.config.event!=='handoff.requested'||rule.config.timing!=='delay'||rule.config.delayMinutes!==60))throw Error('Legacy rule no longer matches the reviewed 60-minute test policy');return{rule,jobs};}
function check(env,input){if(env.PORTAL_WORKER_ENABLED!=='false'||input.servicesStopped!==true)throw Error('Stop the application and workers before policy maintenance');if(env.TRIAL_DATASET!=='synthetic'&&env.TRIAL_DATASET!=='local-crm')throw Error('Unknown dataset');}
export async function previewRetirement(env,input={}){check(env,input);return withCompanyMaintenance(env,input,async()=>{const db=await openTrialDatabase(env);try{return await transaction(db,async c=>{const state=await snapshot(c);return {ruleId:legacyDelayRule,exists:!!state.rule,enabled:!!state.rule?.enabled,version:state.rule?.version||null,jobs:state.jobs,confirmation:digest({database:new URL(env.MYSQL_TRIAL_URL).pathname,state})};});}finally{await db.end();}});}
export async function retireLegacyTestPolicy(env,input){check(env,input);if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500)throw Error('Maintenance reason required');return withCompanyMaintenance(env,input,async()=>{const db=await openTrialDatabase(env);try{return await transaction(db,async c=>{
 const state=await snapshot(c),confirmation=digest({database:new URL(env.MYSQL_TRIAL_URL).pathname,state});if(input.confirmation!==confirmation)throw Error('Policy changed; preview again');if(state.jobs.some(j=>j.state==='sending'))throw Error('In-flight notification found; query result before retry');
 let changed=false,version=state.rule?.version||null;
 if(state.rule?.enabled){version=Number(version)+1;await c.execute('UPDATE notification_rules SET enabled=false,version=?,effective_at=UTC_TIMESTAMP(6) WHERE id=?',[version,legacyDelayRule]);await c.execute('INSERT INTO rule_versions(id,version,config) VALUES(?,?,?)',[legacyDelayRule,version,JSON.stringify(state.rule.config)]);changed=true;}
 let holdsAdded=0;for(const job of state.jobs){const [result]=await c.execute("INSERT IGNORE INTO notification_migration_holds(kind,id,reason) VALUES('job',?,'retired_test_policy')",[job.id]);holdsAdded+=result.affectedRows;}
 const result={ruleId:legacyDelayRule,exists:!!state.rule,enabled:false,version,changed,holdsAdded,heldJobs:state.jobs.map(j=>j.id),historicalStatesPreserved:true};
 if(changed||holdsAdded)await c.execute("INSERT INTO portal_audit(actor,action,data) VALUES('offline-policy-maintenance','notification.test_policy.retired',?)",[JSON.stringify({...result,reason:input.reason.trim()})]);return result;
 });}finally{await db.end();}});}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];if(!args.includes('--env'))throw Error('Explicit private environment required');const file=value('--env'),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.mode&0o077||(process.getuid&&stat.uid!==process.getuid()))throw Error('Owned private 0600 environment required');const env=dotenv.parse(await fs.readFile(file)),input={servicesStopped:args.includes('--services-stopped')};
 if(args.includes('--preview'))console.log(JSON.stringify(await previewRetirement(env,input)));
 else if(args.includes('--apply'))console.log(JSON.stringify(await retireLegacyTestPolicy(env,{...input,confirmation:value('--confirm'),reason:value('--reason')})));
 else throw Error('Select --preview or --apply');
}
