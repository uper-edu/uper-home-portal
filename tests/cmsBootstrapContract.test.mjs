import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import defaults from '../cloud/mysql/system-defaults.json' with {type:'json'};
import evergreenLinks from '../src/data/evergreenPromotionLinks.json' with {type:'json'};
import {systemCampaignDefaults} from '../cloud/mysql/system-campaign-defaults.mjs';
import {loadCmsSeed} from '../cloud/mysql/cms-seed.mjs';
import {promotionIndexEntries} from '../cloud/mysql/promotion-index.mjs';
import {presetPromotionOwner} from '../cloud/mysql/promotion-short-links.mjs';
import {bootstrapRows,bootstrapTables,verifiedBootstrapVersions,verifyBootstrapTables,verifyBootstrapRows,inspectInitializationSql} from '../scripts/lib/cms-bootstrap-contract.mjs';
import {sqlInsert} from '../scripts/cms-bootstrap-apply.mjs';

const at='2026-11-05T00:00:00.000Z',versions=Array.from({length:19},(_,i)=>({version:i+1,state:'ready'}));
const {bundle}=await loadCmsSeed();
const accounts={crm_users:[{id:'fixture',password_hash:'not-a-real-hash'}],access_roles:[{id:'fixture-role'}],access_state:[{id:'fixture-state'}],portal_audit:[{data:'not exported'}]};
const fresh=()=>bootstrapRows({accounts,bundle,versions,at});

test('COS-MERGE-07: shared system preset construction is identical to main and returns isolated records',()=>{
 const expected=JSON.parse(JSON.stringify(defaults.campaigns).replaceAll('SYSTEM_INITIALIZED_AT',at));
 const instagram=expected.find(row=>row.id==='instagram-bio');
 expected.push({...instagram,id:'social-bio',code:'social-bio',presetKey:'social_bio_v1',name:'日常自然推广',nameEn:'Evergreen unpaid promotion',nameId:'Promosi rutin tanpa biaya',boundUtm:{...instagram.boundUtm,utm_source:'',utm_medium:'',utm_campaign:'social-bio'},systemManaged:true,promotionLinks:evergreenLinks.map(link=>({...link,language:'id',promotionKind:'unpaid',experience:'questionnaire_assessment_consultation',createdAt:at}))});
 assert.deepEqual(systemCampaignDefaults(at),expected);
 const changed=systemCampaignDefaults(at);changed[0].name='mutation';assert.deepEqual(systemCampaignDefaults(at),expected);
});
test('COS-MERGE-08: initialization includes only source identities, seed CMS and main standard promotions',()=>{
 const rows=fresh();verifyBootstrapRows(rows);
 assert.deepEqual(rows.crm_users,accounts.crm_users);assert.ok(!('portal_audit' in rows));
 assert.equal(rows.cms_media.length,208);assert.ok(rows.cms_media.every(row=>row.content===null&&row.storage_type==='cos'));
 assert.equal(rows.trial_campaigns.length,3);
 const entries=promotionIndexEntries(rows.trial_campaigns);
 assert.equal(entries.size,3+evergreenLinks.length);
 assert.deepEqual(rows.campaign_promotion_index,[...entries].map(([p,campaign_id])=>({p,campaign_id})));
 assert.ok(rows.campaign_promotion_index.every(row=>presetPromotionOwner(row.p)===row.campaign_id));
 assert.deepEqual(rows.campaign_promotion_short_links,[]);
});
test('COS-MERGE-09: highest version cannot fabricate missing migration markers or hide extra tables',()=>{
 assert.throws(()=>verifiedBootstrapVersions(versions.filter(row=>row.version!==16)),/incomplete/);
 assert.throws(()=>verifiedBootstrapVersions(versions.map(row=>row.version===17?{...row,state:'applying'}:row)),/not ready/);
 assert.throws(()=>verifiedBootstrapVersions([...versions,{version:20,state:'ready'}]),/incomplete/);
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
test('COS-MERGE-11: v19 SQL serialization round-trip checks explicit versions and derived promotions before connection',()=>{
 const parsed=inspectInitializationSql(sqlPackage(fresh(),19));
 assert.equal(parsed.tables.size,43);assert.equal(parsed.rows.trial_schema_versions.length,19);
 assert.equal(parsed.rows.trial_campaigns.length,3);
 assert.throws(()=>inspectInitializationSql(sqlPackage(fresh(),19)+'\nDELETE FROM crm_users;'),/Unexpected initialization SQL/);
});
test('COS-MERGE-12: historical v16 packages require explicit legacy mode and are not relabelled v18',()=>{
 const rows=fresh();rows.trial_schema_versions=versions.slice(0,16);
 rows.trial_campaigns=JSON.parse(JSON.stringify(defaults.campaigns).replaceAll('SYSTEM_INITIALIZED_AT',at)).map(config=>({id:config.id,code:config.code,config}));
 delete rows.campaign_promotion_index;delete rows.campaign_promotion_short_links;
 const sql=sqlPackage(rows,16);
 assert.throws(()=>inspectInitializationSql(sql),/schema v19/);
 assert.equal(inspectInitializationSql(sql,{schemaVersion:16}).schemaVersion,16);
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

test('historical v18 bootstrap remains verifiable with its original table and marker set',()=>{
 const rows=fresh();rows.trial_schema_versions=versions.slice(0,18);
 const sql=sqlPackage(rows,18);
 assert.equal(inspectInitializationSql(sql,{schemaVersion:18}).tables.size,42);
 assert.throws(()=>inspectInitializationSql(sql),/schema v19/);
});
