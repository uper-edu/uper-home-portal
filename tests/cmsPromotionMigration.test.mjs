import test from 'node:test';
import assert from 'node:assert/strict';
import {migrate} from '../cloud/mysql/migrate.mjs';
import {bootstrapTables} from '../scripts/lib/cms-bootstrap-contract.mjs';

const cosColumns=()=>Object.entries({content:['mediumblob','YES'],storage_type:['varchar(16)','NO'],cos_url:['varchar(1024)','YES'],object_key:['varchar(255)','YES'],byte_size:['bigint unsigned','YES']}).map(([Field,[Type,Null]])=>({Field,Type,Null}));
function fixture(ready){
 const versions=new Map(ready.map(version=>[version,'ready'])),queries=[],tables=new Set(ready.length?bootstrapTables(ready.includes(18)?18:16):[]);
 let columns=ready.includes(16)?cosColumns():[{Field:'content',Type:'mediumblob',Null:'NO'}];
 let indexes=[{Key_name:'idx_cms_media_storage',Column_name:'storage_type',Seq_in_index:1}];
 const media=[{id:'old-image',content:Buffer.from('legacy image')},{id:'cos-image',content:null,cos_url:'https://example.invalid/unchanged.webp'}];
 const campaigns=ready.length?[{id:'existing',code:'existing',config:{id:'existing',code:'existing',promotionLinks:[{id:'existing_promotion'}]}}]:[];
 const index=ready.includes(17)?[{p:'existing_promotion',campaign_id:'existing'}]:[];
 const shortLinks=ready.includes(18)?[{p:'existing_promotion',short_code:'abc234'}]:[];
 const connection={
  async query(sql,args){
   queries.push(sql);
   if(sql.includes('GET_LOCK('))return [[{acquired:1}]];
   if(sql.includes('RELEASE_LOCK('))return [[{released:1}]];
   if(sql.includes("table_name LIKE 'access_restore_guard_%'"))return [[]];
   if(sql==='SELECT VERSION() AS version')return [[{version:'8.0.45'}]];
   if(sql.includes("table_name<>'trial_schema_versions'"))return [[...tables].filter(x=>x!=='trial_schema_versions').map(table_name=>({table_name}))];
   const select=/^SELECT (?:\*|state) FROM trial_schema_versions WHERE version=(\d+)$/.exec(sql);
   if(select){const version=Number(select[1]);return [versions.has(version)?[{version,state:versions.get(version)}]:[]];}
   const insert=/^INSERT INTO trial_schema_versions\(version,state\) VALUES\((\d+),'applying'\)/.exec(sql);
   if(insert){const version=Number(insert[1]);if(versions.has(version))throw Error('Duplicate migration marker');versions.set(version,'applying');return [{}];}
   const update=/^UPDATE trial_schema_versions SET state='ready'.* WHERE version=(\d+)$/.exec(sql);
   if(update){versions.set(Number(update[1]),'ready');return [{}];}
   if(sql==='SHOW FULL COLUMNS FROM cms_media')return [structuredClone(columns)];
   if(sql==='SHOW INDEX FROM cms_media')return [structuredClone(indexes)];
   if(sql.startsWith('ALTER TABLE cms_media')&&sql.includes('ADD COLUMN cos_url')){
    if(columns.some(row=>row.Field==='cos_url'))throw Error('COS ALTER repeated');columns=cosColumns();return [{}];
   }
   const create=/^CREATE TABLE (?:IF NOT EXISTS )?([a-z_]+)/.exec(sql);
   if(create){tables.add(create[1]);return [{}];}
   if(sql==='SELECT id,code,config FROM trial_campaigns'||sql==='SELECT id,code,config FROM trial_campaigns FOR UPDATE')return [structuredClone(campaigns)];
   if(sql==='SELECT p,campaign_id FROM campaign_promotion_index FOR UPDATE')return [structuredClone(index)];
   if(sql==='SELECT p,short_code FROM campaign_promotion_short_links FOR UPDATE')return [structuredClone(shortLinks)];
   if(sql==='INSERT INTO campaign_promotion_index(p,campaign_id) VALUES(?,?)'){index.push({p:args[0],campaign_id:args[1]});return [{}];}
   if(sql==='INSERT INTO campaign_promotion_short_links(short_code,p) VALUES(?,?)'){shortLinks.push({p:args[1],short_code:args[0]});return [{}];}
   if(sql.includes("LOWER(raw_code)='social-bio'")||sql==='SELECT profile FROM portal_leads'||sql.includes("table_name='notification_inbox'"))return [[]];
   if(sql.startsWith('ALTER TABLE ')||sql.startsWith('DELETE FROM crm_operations ')||sql.startsWith('DELETE FROM crm_facts ')||sql.startsWith('DROP TABLE IF EXISTS lead_read_marks')||sql==='UPDATE followup_tasks SET original_due_at=due_at')return [{}];
   throw Error('Unexpected migration query: '+sql);
  },
  async execute(sql,args){return this.query(sql,args);},
  async beginTransaction(){queries.push('BEGIN');},async commit(){queries.push('COMMIT');},async rollback(){queries.push('ROLLBACK');},release(){queries.push('RELEASE');},
 };
 return {versions,queries,tables,media,campaigns,index,shortLinks,connection,setColumns(value){columns=value;},setIndexes(value){indexes=value;},pool:{async getConnection(){return connection;}}};
}
const run=f=>migrate(f.pool,'uper_trial_mock',{initializeSystemDefaults:false});
const range=n=>Array.from({length:n},(_,i)=>i+1);

test('COS-MERGE-01: main v17/v18 without v16 gains COS without changing promotions or media',async()=>{
 const f=fixture([...range(15),17,18]),before=structuredClone({media:f.media,campaigns:f.campaigns,index:f.index,shortLinks:f.shortLinks});
 assert.equal((await run(f)).version,18);assert.equal(f.versions.get(16),'ready');
 assert.deepEqual(structuredClone({media:f.media,campaigns:f.campaigns,index:f.index,shortLinks:f.shortLinks}),before);
 assert.ok(f.queries.indexOf('SHOW FULL COLUMNS FROM cms_media')<f.queries.indexOf('SELECT state FROM trial_schema_versions WHERE version=17'));
 const changes=f.queries.filter(sql=>sql.startsWith('ALTER TABLE cms_media')).length;
 assert.equal((await run(f)).alreadyApplied,true);
 assert.equal(f.queries.filter(sql=>sql.startsWith('ALTER TABLE cms_media')).length,changes);
 assert.equal(f.queries.filter(sql=>sql==='SELECT p,short_code FROM campaign_promotion_short_links FOR UPDATE').length,2);
});
test('COS-MERGE-02: existing COS v16 runs main promotion migrations and keeps assigned short codes on rerun',async()=>{
 const f=fixture(range(16)),before=structuredClone(f.media);
 assert.equal((await run(f)).version,18);assert.deepEqual(structuredClone(f.media),before);
 assert.equal(f.index.length,1);assert.equal(f.shortLinks.length,1);
 const saved=structuredClone(f.shortLinks);await run(f);assert.deepEqual(f.shortLinks,saved);
 assert.ok(!f.queries.some(sql=>sql.startsWith('ALTER TABLE cms_media')));
});
test('COS-MERGE-03: empty schema executes all 18 real migration stages in order',async()=>{
 const f=fixture([]);assert.equal((await run(f)).version,18);
 assert.deepEqual([...f.versions.keys()],range(18));assert.ok([...f.versions.values()].every(state=>state==='ready'));
 assert.deepEqual([...f.tables].sort(),bootstrapTables());
 const before=f.queries.filter(sql=>/^CREATE TABLE|^ALTER TABLE/.test(sql)).length;
 await run(f);
 assert.equal(f.queries.filter(sql=>/^CREATE TABLE|^ALTER TABLE/.test(sql)).length,before+1);
});
test('COS-MERGE-04: a ready marker cannot hide missing COS columns, even when v18 is ready',async()=>{
 const f=fixture(range(18));f.setColumns(cosColumns().filter(row=>row.Field!=='cos_url'));
 await assert.rejects(run(f),/CMS COS schema mismatch: cos_url/);
 assert.ok(!f.queries.includes('SELECT state FROM trial_schema_versions WHERE version=17'));
 assert.ok(!f.queries.some(sql=>sql.startsWith('ALTER TABLE')));
});
test('COS-MERGE-16: ready COS schemas reject wrong types, nullability and missing or mismatched indexes',async()=>{
 for(const patch of [{Type:'blob'},{Null:'NO'}]){
  const f=fixture(range(18));f.setColumns(cosColumns().map(row=>row.Field==='content'?{...row,...patch}:row));
  await assert.rejects(run(f),/CMS COS schema mismatch: content/);
 }
 for(const indexes of [[],[{Key_name:'idx_cms_media_storage',Column_name:'cos_url',Seq_in_index:1}],[{Key_name:'idx_cms_media_storage',Column_name:'storage_type',Seq_in_index:2}]]){
  const f=fixture(range(18));f.setIndexes(indexes);await assert.rejects(run(f),/CMS COS storage index missing/);
 }
});
test('COS-MERGE-05: incomplete COS migration remains blocked, never marked ready by promotion stages',async()=>{
 const f=fixture(range(18));f.versions.set(16,'applying');
 await assert.rejects(run(f),/Incomplete CMS COS media migration/);
 assert.equal(f.versions.get(16),'applying');assert.ok(!f.queries.includes('SELECT state FROM trial_schema_versions WHERE version=17'));
});
test('COS-MERGE-06: main ownership and short-code corruption checks still fail closed',async()=>{
 const f=fixture(range(18));f.index[0].campaign_id='wrong';
 await assert.rejects(run(f),/Promotion index ownership mismatch/);
 f.index[0].campaign_id='existing';f.shortLinks[0].short_code='bad';
 await assert.rejects(run(f),/Invalid promotion short-link mapping/);
});
