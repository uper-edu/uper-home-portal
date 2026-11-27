import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {verifyStartupDatabase} from '../cloud/mysql/startup-database.mjs';
import spec from '../cloud/mysql/startup-schema.json' with {type:'json'};
import {collections} from '../cloud/mysql/content-query.mjs';
import notificationDefaults from '../src/data/system-defaults/notifications.ts';
import evergreenLinks from '../src/data/evergreenPromotionLinks.json' with {type:'json'};
import {defaultRules} from '../server/portal/policy.ts';
import {systemCampaignDefaults} from '../cloud/mysql/system-campaign-defaults.mjs';
import {SYSTEM_LARK_GROUP_NAME} from '../server/portal/larkSystemChannels.ts';
import {canonicalCampaignPromotionId} from '../src/utils/threadsPromotion.ts';

function fixture(){
  const tables=[...spec.baseline,...Object.keys(spec.tables)].map(name=>({name,engine:'InnoDB'}));
  const columns=[],indexes=[];
  for(const [tbl,{columns:cs,indexes:ix}] of Object.entries(spec.tables)){
    for(const [col,[typ,nullable,def,coll]] of Object.entries(cs))columns.push({tbl,col,typ,nullable,def,coll});
    for(const [idx,[nu,cols]] of Object.entries(ix))indexes.push({tbl,idx,nu,cols,prefixes:0});
  }
  const versions=Array.from({length:20},(_,i)=>({version:i+1,state:'ready'}));
  const settings={organic:1,sla:1,accounts:1,teamless:1,systemGroup:1,lark:1,mail:1};
  const names=collections.map(name=>({name}));
  const rules=notificationDefaults.rules.map(rule=>({id:rule.event}));
  const presets=evergreenLinks.map(link=>({p:link.id}));
  const calls=[];
  const db={async query(sql){
    calls.push(sql);
    assert.match(sql,/^(SELECT|SHOW)\s/);assert.doesNotMatch(sql,/\b(?:INSERT|DELETE|UPDATE|ALTER|DROP|REPLACE)\b/i);
    if(sql.startsWith('SELECT DATABASE'))return [[{db:'mock',version:'8.0.45'}]];
    if(sql.includes('information_schema.tables'))return [tables];
    if(sql.includes('information_schema.columns'))return [columns];
    if(sql.includes('information_schema.statistics'))return [indexes];
    if(sql.includes('FROM trial_schema_versions'))return [versions];
    if(sql==='SHOW FULL COLUMNS FROM cms_media')return [[['content','mediumblob','YES'],['storage_type','varchar(16)','NO'],['cos_url','varchar(1024)','YES'],['object_key','varchar(255)','YES'],['byte_size','bigint unsigned','YES']].map(([Field,Type,Null])=>({Field,Type,Null}))];
    if(sql==='SHOW INDEX FROM cms_media')return [[{Key_name:'idx_cms_media_storage',Column_name:'storage_type',Seq_in_index:1}]];
    if(sql.startsWith('SHOW CREATE TABLE'))return [[{'Create Table':'CREATE TABLE fixture (...) ENGINE=InnoDB'}]];
    if(sql==='SHOW FULL COLUMNS FROM crm_payment_analytics')return [columns.filter(r=>r.tbl==='crm_payment_analytics').map(r=>({Field:r.col,Type:r.typ,Null:r.nullable,Default:r.def}))];
    if(sql==='SHOW INDEX FROM crm_payment_analytics')return [indexes.filter(r=>r.tbl==='crm_payment_analytics').flatMap(r=>r.cols.split(',').map((col,i)=>({Key_name:r.idx,Column_name:col,Non_unique:r.nu,Seq_in_index:i+1})))];
    if(sql==='SELECT name FROM cms_collections')return [names];
    if(sql==='SELECT id FROM notification_rules')return [rules];
    if(sql.startsWith('SELECT p FROM campaign_promotion_index'))return [presets];
    if(sql.includes("id='lark_personal_channel'"))return [[settings]];
    throw Error('Unexpected startup statement: '+sql);
  }};
  return {check:()=>verifyStartupDatabase(db,'mock',{PORTAL_ENV:'test',PLATFORM_MODE:'local'}),tables,columns,indexes,versions,settings,names,rules,presets,calls};
}
test('ready and repeated startup perform only reads, including when external delivery has been configured',async()=>{
  const f=fixture();await f.check();const n=f.calls.length;await f.check();assert.equal(f.calls.length,2*n);
});
test('refuse missing, partial, offline, drifted and unprepared databases without attempting repairs',async()=>{
  for(const [mutate,reason] of [
    [f=>f.tables.pop(),/table /],[f=>f.tables.push({name:'access_restore_guard_x'}),/interrupted restore/],
    [f=>f.versions[18].state='applying',/schema versions/],[f=>f.versions.unshift({version:0,state:'offline_copy'}),/schema versions/],
    [f=>f.columns.find(r=>r.col==='occurred_at').nullable='NO',/occurred_at/],
    [f=>f.indexes.find(r=>r.idx==='mail_pool_daily').cols='environment,pool_id,day_key',/mail_pool_daily/],
    [f=>f.settings.accounts=0,/accounts/],[f=>f.settings.mail=0,/mail/],[f=>f.settings.lark=0,/lark/],[f=>f.settings.systemGroup=0,/systemGroup/],[f=>f.names.pop(),/CMS collection/],
    [f=>f.rules.splice(f.rules.findIndex(r=>r.id==='lead.assigned'),1),/notification rule lead\.assigned/],
    [f=>f.presets.splice(f.presets.findIndex(r=>r.p==='enroll-ig'),1),/promotion preset enroll-ig/],
  ]){const f=fixture();mutate(f);await assert.rejects(f.check,reason);}
});
test('manual DDL includes every original table definition and incremental column/index, and no business DML',async()=>{
  const mysql=new URL('../cloud/mysql/',import.meta.url);
  const read=async(url)=>(await readFile(url,'utf8')).replaceAll('\r\n','\n');
  const script=await read(new URL('../sql/v20261126182423_portal_v18_to_v20.sql',import.meta.url));
  const readTables=sql=>new Map([...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\n\s*\) (ENGINE=[^;]+);/g)].map(m=>[m[1],{engine:m[3],lines:m[2].trim().split(/\n/).map(l=>l.trim().replace(/,$/,''))}]));
  const names=(await readdir(mysql)).filter(n=>/^schema-(?:enrollment-|credentials-|v19\.sql$|v20\.sql$)/.test(n));
  const source=(await Promise.all(names.map(n=>read(new URL(n,mysql))))).join('\n');
  const expected=readTables(source);
  const ddl=[...script.matchAll(/^  '(CREATE TABLE [\s\S]*?\n  \) ENGINE=[^']+)'(?=[,)])/gm)]
    .map(match=>match[1].replace("CREATE TABLE ","CREATE TABLE IF NOT EXISTS ").replaceAll("''","'")+';').join('\n');
  const actual=readTables(ddl);
  for(const m of source.matchAll(/ALTER TABLE (\w+)\s+([^;]+);/g))for(const add of m[2].split(/,\s*(?=ADD )/))expected.get(m[1]).lines.push(add.replace(/^ADD (?:COLUMN )?/,''));
  expected.get('crm_payment_analytics').lines.push('occurred_at DATETIME(6) NULL');
  assert.deepEqual([...actual.keys()].sort(),Object.keys(spec.tables).sort());assert.deepEqual(actual.size,28);
  for(const [table,shape] of expected){assert.deepEqual(actual.get(table).lines.sort(),shape.lines.sort(),table);assert.equal(actual.get(table).engine,shape.engine);}
  assert.doesNotMatch(script,/\b(?:DROP TABLE|TRUNCATE|FOREIGN KEY|REFERENCES|DELETE FROM|UPDATE\s+\w+\s+SET)\b/i);
  assert.deepEqual([...script.matchAll(/INSERT INTO (\w+)/gi)].map(m=>m[1]),
    ['portal_audit','trial_schema_versions','trial_schema_versions','portal_audit']);
  assert.ok(script.indexOf("'release.v18v20.begin',JSON_OBJECT")<script.indexOf('EXECUTE uper_upgrade_ddl'));
  assert.match(script,/CONCAT\('uper-v18v20:',v_run\)/);
  assert.match(script,/_utf8mb4' COMMENT=' COLLATE utf8mb4_bin/);
  assert.match(script,/CONVERT\(QUOTE\(v_marker\) USING utf8mb4\) COLLATE utf8mb4_bin/);
  assert.match(script,/Version or target tables have no tracked upgrade origin/);
  const declared=script.match(/DECLARE v_names JSON DEFAULT JSON_ARRAY[(]([^;]*?)[)];/)[1];
  assert.deepEqual(JSON.parse('['+declared.replaceAll("'",'"')+']'),[...actual.keys()]);
});
test('manual seed SQL carries exactly the system presets that startup used to insert, in ASCII, without rewriting business data',async()=>{
  const script=(await readFile(new URL('../sql/v20261126192807_system_default_seeds.sql',import.meta.url),'utf8')).replaceAll('\r\n','\n');
  assert.doesNotMatch(script,/[^\x00-\x7F]/,'client charset must not affect seeded text');
  const parse=text=>JSON.parse(text.replaceAll('<DOT>','·'));
  const rule=parse(script.match(/'(\{"calendarMode"[^']*\})'/)[1]);
  assert.deepEqual(rule,defaultRules.find(item=>item.event==='lead.assigned'));
  const presets=[...script.matchAll(/'(\{"id":"[^']*\})'/g)].map(match=>parse(match[1]));
  const expected=systemCampaignDefaults('at').find(record=>record.id==='social-bio').promotionLinks.map(({createdAt,...link})=>link);
  // The historical seed precedes the manually executed Threads ID cutover.
  assert.deepEqual(presets.map(link=>({...link,id:canonicalCampaignPromotionId('social-bio',link.id)})),expected);
  const groupName=script.match(/CONCAT\('(Lark )',CONVERT\(0x([0-9A-F]+) USING utf8mb4\)\)/);
  assert.equal(groupName[1]+Buffer.from(groupName[2],'hex').toString('utf8'),SYSTEM_LARK_GROUP_NAME);
  assert.doesNotMatch(script,/\b(?:DROP TABLE|TRUNCATE|FOREIGN KEY|REFERENCES|DELETE FROM|ALTER TABLE|CREATE TABLE)\b/i);
  assert.deepEqual([...script.matchAll(/INSERT INTO (\w+)/gi)].map(m=>m[1]),['notification_rules','campaign_promotion_index','portal_audit']);
  assert.deepEqual([...script.matchAll(/UPDATE\s+(\w+)\s+SET/gi)].map(m=>m[1]),['notification_channels','trial_campaigns']);
});
test('rollback requires the tracked table marker and exact seed mail hash before any data rollback or DROP',async()=>{
  const script=(await readFile(new URL('../sql/v20261127101113_rollback_v20_to_v18.sql',import.meta.url),'utf8')).replaceAll('\r\n','\n');
  assert.doesNotMatch(script,/[^\x00-\x7F]/);
  const tableList=script.match(/DECLARE v_tables JSON DEFAULT JSON_ARRAY[(]([^;]*?)[)];/)[1];
  assert.deepEqual(JSON.parse('['+tableList.replaceAll("'",'"')+']').sort(),Object.keys(spec.tables).sort());
  const code=script.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
  assert.match(code,/@uper_rollback_confirm<>BINARY 'v20-to-v18'/);
  assert.match(code,/table_type<>'BASE TABLE' OR engine<>'InnoDB' OR BINARY table_comment<>BINARY v_marker/);
  assert.match(code,/revision=0\s+AND SHA2\(CAST\(config AS CHAR CHARACTER SET utf8mb4\),256\)=JSON_UNQUOTE\(JSON_EXTRACT\(v_delivery,'\$\.mailHash'\)\)/);
  assert.match(code,/SELECT EXISTS\(SELECT 1 FROM \`/);
  assert.ok(code.indexOf('hold business data; stop')<code.indexOf('START TRANSACTION'));
  assert.ok(code.indexOf("'release.v18v20.reverting',JSON_OBJECT")<code.indexOf("CONCAT('DROP TABLE"));
  assert.ok(code.indexOf("CONCAT('DROP TABLE")<code.indexOf("DELETE FROM trial_schema_versions"));
  assert.deepEqual([...code.matchAll(/\bDROP TABLE\b[^;]*/g)].map(m=>m[0]),["DROP TABLE ',v_drop)"]);
  assert.doesNotMatch(code,/\b(?:TRUNCATE|FOREIGN KEY|REFERENCES|ALTER TABLE|CREATE TABLE)\b/i);
  assert.deepEqual([...code.matchAll(/DELETE FROM (\w+)/gi)].map(m=>m[1]),
    ['notification_rules','campaign_promotion_index','portal_settings','trial_schema_versions']);
  assert.deepEqual([...code.matchAll(/UPDATE\s+(\w+)\s+SET/gi)].map(m=>m[1]),
    ['trial_campaigns','notification_channels','notification_channels','portal_settings','trial_schema_versions']);
  assert.deepEqual([...code.matchAll(/INSERT INTO (\w+)/gi)].map(m=>m[1]),['portal_audit','portal_audit']);
});

test('upgrade and rollback share the journal and preserve legacy values and references across retries',async()=>{
  const load=name=>readFile(new URL('../sql/'+name,import.meta.url),'utf8');
  const [ddl,delivery,seed,rollback]=await Promise.all([
    load('v20261126182423_portal_v18_to_v20.sql'),
    load('v20261126182717_reviewed_delivery_state.sql'),
    load('v20261126192807_system_default_seeds.sql'),
    load('v20261127101113_rollback_v20_to_v18.sql'),
  ]);
  for(const script of [ddl,delivery,seed,rollback]){
    assert.match(script,/GET_LOCK\(v_lock,0\)/);
    assert.match(script,/CONCAT\('uper-db-release:',LEFT\(SHA2\(DATABASE\(\),256\),40\)\)/);
    assert.match(script,/IF v_locked THEN DO RELEASE_LOCK\(v_lock\); END IF;\s+RESIGNAL/);
  }
  assert.match(delivery,/'personal',v_personal_change,'channels',v_channels/);
  assert.match(seed,/'group',v_channel_change,'campaign',v_campaign_change,'indexes',v_new_indexes/);
  assert.ok(delivery.indexOf('UPDATE notification_channels SET')<delivery.indexOf("'release.v18v20.delivery',\n"));
  assert.ok(seed.indexOf('UPDATE trial_campaigns SET')<seed.indexOf("'release.v18v20.seed',\n"));
  const presenceChecks=[...rollback.matchAll(/JSON_UNQUOTE\(JSON_EXTRACT\(v_(?:patch|group),'\$\.(had[A-Z]\w+)'\)\) IN \('1','true'\)/g)];
  assert.deepEqual(presenceChecks.map(match=>match[1]),
    ['hadLinks','hadManaged','hadUpdatedAt','hadManaged','hadMode','hadRevision']);
  assert.match(rollback,/Social-bio campaign does not match its original configuration/);
  assert.match(rollback,/System Lark group changed after rollback began/);
  assert.match(rollback,/Personal Lark configuration does not match its original value/);
  assert.match(rollback,/Older upgrade SQL was mixed into this run/);
  assert.match(rollback,/EXISTS\(SELECT 1 FROM notification_jobs WHERE rule_id='lead.assigned'\)/);
  assert.match(rollback,/EXISTS\(SELECT 1 FROM campaign_promotion_short_links WHERE p=v_key\)/);
  assert.match(rollback,/EXISTS\(SELECT 1 FROM portal_leads WHERE profile->>'\$\.promotionLinkId'=v_key/);
  assert.match(rollback,/UPDATE trial_schema_versions SET state='rolling_back'[\s\S]*?release\.v18v20\.reverting[\s\S]*?COMMIT;[\s\S]*?CONCAT\('DROP TABLE ',v_drop\)/);
  assert.match(rollback,/DELETE FROM trial_schema_versions WHERE version IN \(19,20\);\s+INSERT INTO portal_audit[\s\S]*?release\.v18v20\.reverted[\s\S]*?COMMIT;/);
});
