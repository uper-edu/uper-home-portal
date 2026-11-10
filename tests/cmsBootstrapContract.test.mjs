import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import defaults from '../cloud/mysql/system-defaults.json' with {type:'json'};
import legacyCampaigns from '../scripts/lib/cms-bootstrap-legacy-campaigns.json' with {type:'json'};
import evergreenLinks from '../src/data/evergreenPromotionLinks.json' with {type:'json'};
import {systemCampaignDefaults} from '../cloud/mysql/system-campaign-defaults.mjs';
import {loadCmsSeed} from '../cloud/mysql/cms-seed.mjs';
import {promotionIndexEntries} from '../cloud/mysql/promotion-index.mjs';
import {presetPromotionOwner} from '../cloud/mysql/promotion-short-links.mjs';
import {bootstrapRows,bootstrapTables,verifiedBootstrapVersions,verifyBootstrapTables,verifyBootstrapRows,inspectInitializationSql} from '../scripts/lib/cms-bootstrap-contract.mjs';
import {sqlInsert} from '../scripts/cms-bootstrap-apply.mjs';

const at='2026-11-05T00:00:00.000Z',versions=Array.from({length:20},(_,i)=>({version:i+1,state:'ready'}));
const {bundle}=await loadCmsSeed();
const accounts={crm_users:[{id:'fixture',password_hash:'not-a-real-hash'}],access_roles:[{id:'fixture-role'}],access_state:[{id:'fixture-state'}],portal_audit:[{data:'not exported'}]};
const fresh=()=>bootstrapRows({accounts,bundle,versions,at});

test('COS-MERGE-07: shared system preset construction is identical to main and returns isolated records',()=>{
 const expected=JSON.parse(JSON.stringify(defaults.campaigns).replaceAll('SYSTEM_INITIALIZED_AT',at));
 const evergreen=expected.find(row=>row.id==='social-bio');
 evergreen.promotionLinks=evergreenLinks.map(link=>({...link,language:'id',promotionKind:'unpaid',experience:'questionnaire_assessment_consultation',createdAt:at}));
 assert.deepEqual(expected.map(row=>row.id),['organic','social-bio']);
 assert.deepEqual(systemCampaignDefaults(at),expected);
 const changed=systemCampaignDefaults(at);changed[0].name='mutation';assert.deepEqual(systemCampaignDefaults(at),expected);
});
test('COS-MERGE-08: initialization includes only source identities, seed CMS and main standard promotions',()=>{
 const rows=fresh();verifyBootstrapRows(rows);
 assert.deepEqual(rows.crm_users,accounts.crm_users);assert.ok(!('portal_audit' in rows));
 assert.equal(rows.cms_media.length,208);assert.ok(rows.cms_media.every(row=>row.content===null&&row.storage_type==='cos'));
 assert.equal(rows.trial_campaigns.length,2);
 const entries=promotionIndexEntries(rows.trial_campaigns);
 assert.equal(entries.size,evergreenLinks.length);
 assert.deepEqual(rows.campaign_promotion_index,[...entries].map(([p,campaign_id])=>({p,campaign_id})));
 assert.ok(rows.campaign_promotion_index.every(row=>presetPromotionOwner(row.p)===row.campaign_id));
 assert.deepEqual(rows.campaign_promotion_short_links,[]);
});
test('COS-MERGE-09: highest version cannot fabricate missing migration markers or hide extra tables',()=>{
 assert.throws(()=>verifiedBootstrapVersions(versions.filter(row=>row.version!==16)),/incomplete/);
 assert.throws(()=>verifiedBootstrapVersions(versions.map(row=>row.version===17?{...row,state:'applying'}:row)),/not ready/);
 assert.throws(()=>verifiedBootstrapVersions([...versions,{version:21,state:'ready'}]),/incomplete/);
 assert.throws(()=>verifyBootstrapTables([...bootstrapTables().filter(x=>x!=='campaign_promotion_index'),'unexpected']),/table set/);
 assert.equal(bootstrapTables().length,43);assert.equal(bootstrapTables(18).length,42);assert.equal(bootstrapTables(16).length,40);
});
test('COS-MERGE-10: missing promotion rows, wrong ownership and runtime data are rejected',()=>{
 const broken=[
  rows=>{rows.campaign_promotion_index.pop();},
  rows=>{rows.campaign_promotion_index[0].campaign_id='other';},
  rows=>{rows.campaign_promotion_short_links.push({p:'unexpected',short_code:'abc234'});},
  rows=>{rows.trial_campaigns.pop();},
  rows=>{rows.portal_audit=[{actor:'fixture'}];},
  rows=>{rows.crm_payment_analytics=[{id:'private-event'}];},
  rows=>{rows.cms_media[0].content=Buffer.from('image');},
 ];
 for(const corrupt of broken){const rows=fresh();corrupt(rows);assert.throws(()=>verifyBootstrapRows(rows));}
});
function sqlPackage(rows,version){
 const tables=bootstrapTables(version);
 // Parser-only fixtures: actual MySQL DDL execution requires separately authorized verification.
 return [...tables.map(name=>'CREATE TABLE `'+name+'` (`fixture` INT);'),...Object.entries(rows).filter(([,items])=>items.length).map(([name,items])=>sqlInsert(name,items,[...new Set(items.flatMap(Object.keys))]))].join('\n');
}
function originalRows(version){
 const rows=fresh();
 rows.trial_schema_versions=versions.slice(0,version);
 rows.trial_campaigns=JSON.parse(JSON.stringify(legacyCampaigns).replaceAll('SYSTEM_INITIALIZED_AT',at))
  .filter(config=>version>=18||config.id!=='social-bio')
  .map(config=>({id:config.id,code:config.code,config}));
 if(version>=18)rows.campaign_promotion_index=[...promotionIndexEntries(rows.trial_campaigns)]
  .map(([p,campaign_id])=>({p,campaign_id}));
 else{
  delete rows.campaign_promotion_index;
  delete rows.campaign_promotion_short_links;
 }
 return rows;
}
test('COS-MERGE-11: v20 SQL serialization round-trip checks explicit versions and derived promotions before connection',()=>{
 const parsed=inspectInitializationSql(sqlPackage(fresh(),20));
 assert.equal(parsed.tables.size,43);assert.equal(parsed.rows.trial_schema_versions.length,20);
 assert.equal(parsed.rows.trial_campaigns.length,2);
 assert.throws(()=>inspectInitializationSql(sqlPackage(fresh(),20)+'\nDELETE FROM crm_users;'),/Unexpected initialization SQL/);
});
test('COS-MERGE-12: historical v16 packages require explicit legacy mode and are not relabelled v18',()=>{
 const sql=sqlPackage(originalRows(16),16);
 assert.throws(()=>inspectInitializationSql(sql),/schema v20/);
 assert.deepEqual(inspectInitializationSql(sql,{schemaVersion:16}).rows.trial_campaigns.map(row=>row.id),['organic','instagram-bio']);
});
test('COS-MERGE-13: initializer binds journals to schema version and never infers ready versions from MAX',async()=>{
 const apply=await fs.readFile(new URL('../scripts/cms-bootstrap-apply.mjs',import.meta.url),'utf8');
 assert.match(apply,/schemaVersion:bootstrapSchemaVersion,accounts:backup.accounts/);
 assert.match(apply,/SELECT version,state FROM trial_schema_versions ORDER BY version/);
 assert.doesNotMatch(apply,/Array.from\(\{length:migration.version\}/);
 const verify=await fs.readFile(new URL('../scripts/cms-bootstrap-verify.mjs',import.meta.url),'utf8');
 assert.match(verify,/inspectInitializationSql\(sql,\{schemaVersion\}\)/);
 assert.match(verify,/verifyCmsMediaSchema\(c\)/);
 assert.doesNotMatch(verify,/MAX\(version\)/);
});

test('original v18 through v20 packages preserve Instagram Bio and require its exact promotion index',()=>{
 for(const version of [18,19,20]){
  const rows=originalRows(version);
  const sql=sqlPackage(rows,version);
  const parsed=inspectInitializationSql(sql,{schemaVersion:version});
  assert.equal(parsed.tables.size,version===18?42:43);
  assert.deepEqual(parsed.rows.trial_campaigns.map(row=>row.id),['organic','instagram-bio','social-bio']);
  if(version<20)assert.throws(()=>inspectInitializationSql(sql),/schema v20|migration versions are incomplete/);
  rows.campaign_promotion_index.find(row=>row.p==='p_instagram_bio_en').campaign_id='social-bio';
  assert.throws(()=>inspectInitializationSql(sqlPackage(rows,version),{schemaVersion:version}),/promotion index mismatch/);
 }
});
test('the previous eight-link package remains verifiable after adding Threads',()=>{
 const rows=originalRows(20);
 rows.trial_campaigns=rows.trial_campaigns.filter(row=>row.id!=='instagram-bio');
 rows.campaign_promotion_index=rows.campaign_promotion_index.filter(row=>row.campaign_id==='social-bio');
 const parsed=inspectInitializationSql(sqlPackage(rows,20));
 assert.equal(parsed.rows.campaign_promotion_index.length,8);
});
