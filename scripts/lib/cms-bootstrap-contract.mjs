import legacyCampaigns from './cms-bootstrap-legacy-campaigns.json' with {type:'json'};
import courseBook from '../../src/data/crmCoursePrices.json' with {type:'json'};
import {systemCampaignDefaults} from '../../cloud/mysql/system-campaign-defaults.mjs';
import {promotionIndexEntries} from '../../cloud/mysql/promotion-index.mjs';
import {presetPromotionOwner} from '../../cloud/mysql/promotion-short-links.mjs';
import {cmsMediaUrl} from '../../cloud/mysql/cms-media-storage.mjs';
import {splitSql,parseInsert,fingerprint} from './mysql-dump.mjs';

import {paymentAnalyticsSchemaVersion} from '../../cloud/mysql/payment-analytics-schema.mjs';

export const bootstrapSchemaVersion=paymentAnalyticsSchemaVersion;
const legacyTables=[
 'access_handovers','access_operations','access_roles','access_state','ai_attempts','campaign_source_reviews',
 'cms_collections','cms_media','conversations','crm_ai_extractions','crm_courses','crm_engagements','crm_facts',
 'crm_login_limits','crm_operations','crm_payment_images','crm_payment_ledgers','crm_payment_references',
 'crm_sessions','crm_users','followup_tasks','hsk_attempts','identity_candidates','lead_daily_counters','messages',
 'notification_channels','notification_inbox','notification_jobs','notification_migration_holds',
 'notification_rules','outbox','portal_audit','portal_leads','portal_settings','rule_versions','site_submissions',
 'trial_campaigns','trial_members','trial_schema_versions','visitor_sessions',
];
export function bootstrapTables(schemaVersion=bootstrapSchemaVersion){
 if(![16,18,19,20].includes(schemaVersion))throw Error('Unsupported initialization schema version');
 return [...legacyTables,...(schemaVersion>=18?['campaign_promotion_index','campaign_promotion_short_links']:[]),...(schemaVersion>=19?['crm_payment_analytics']:[])].sort();
}
export function verifyBootstrapTables(tables,schemaVersion=bootstrapSchemaVersion){
 if(fingerprint([...tables].sort())!==fingerprint(bootstrapTables(schemaVersion)))throw Error('Initialization table set does not match schema v'+schemaVersion);
}
export function verifiedBootstrapVersions(rows,schemaVersion=bootstrapSchemaVersion){
 bootstrapTables(schemaVersion);
 const versions=rows.map(({version,state})=>({version:Number(version),state})).sort((a,b)=>a.version-b.version);
 if(versions.length!==schemaVersion||versions.some((row,i)=>row.version!==i+1||row.state!=='ready'))throw Error('Initialization migration versions are incomplete or not ready');
 return versions;
}

export function bootstrapPromotionRows(at){
 const trial_campaigns=systemCampaignDefaults(at).map(config=>({id:config.id,code:config.code,config}));
 const campaign_promotion_index=[...promotionIndexEntries(trial_campaigns)].map(([p,campaign_id])=>({p,campaign_id}));
 // main uses stable reserved URLs for these presets, not allocated random short codes.
 if(campaign_promotion_index.some(row=>presetPromotionOwner(row.p)!==row.campaign_id))throw Error('Unexpected non-preset initialization promotion');
 return {trial_campaigns,campaign_promotion_index,campaign_promotion_short_links:[]};
}
export function bootstrapRows({accounts,bundle,versions,at}){
 return {
  crm_users:accounts.crm_users,access_roles:accounts.access_roles,access_state:accounts.access_state,
  trial_schema_versions:verifiedBootstrapVersions(versions),
  cms_collections:Object.entries(bundle.collections).map(([name,items])=>({name,items,items_text:JSON.stringify(items),revision:1})),
  cms_media:bundle.media.map(x=>({id:x.id,mime:'image/webp',content:null,uploaded_by:'cms-initialization',storage_type:'cos',cos_url:x.url,object_key:x.objectKey,byte_size:x.bytes})),
  ...bootstrapPromotionRows(at),
  crm_courses:courseBook.courses.map(course=>{const id='hsk-standard-'+course.id.replace(/^HSK /,'').toLowerCase();const config={name:course.id,sessions:course.sessions,price:course.total,active:true,maxDiscountBps:0,maxDiscountAmount:null};return {id,revision:1,value:{...config,presetKey:'hsk_standard_v1',updatedAt:at,history:[{id:'system-initialize-'+id,actor:'system',at,before:null,after:config}]}};}),
 };
}
const json=value=>typeof value==='string'?JSON.parse(value):value;
export function verifyBootstrapRows(rows,schemaVersion=bootstrapSchemaVersion){
 verifiedBootstrapVersions(rows.trial_schema_versions??[],schemaVersion);
 const allowed=new Set(['crm_users','access_roles','access_state','trial_schema_versions','cms_collections','cms_media','trial_campaigns','crm_courses',...(schemaVersion>=18?['campaign_promotion_index','campaign_promotion_short_links']:[])]);
 for(const [table,items] of Object.entries(rows))if(items.length&&!allowed.has(table))throw Error('Unexpected runtime or secret records: '+table);
 for(const table of ['crm_users','access_roles','access_state'])if(!rows[table]?.length)throw Error('Missing identity bootstrap rows: '+table);
 const media=rows.cms_media??[];
 if(media.length!==208||new Set(media.map(row=>row.id)).size!==208||media.some(row=>row.content!==null||row.storage_type!=='cos'||row.cos_url!==cmsMediaUrl(row.id)||row.object_key!=='cms/'+row.id+'.webp'||!Number.isSafeInteger(Number(row.byte_size))||Number(row.byte_size)<=0))throw Error('Invalid COS initialization media');
 const collections=rows.cms_collections??[],counts={admissionsList:1,campaigns:2,news:20,newsPage:7,partners:54,programGallery:9,studentStories:5,trendingPrograms:8};
 if(collections.length!==8||new Set(collections.map(row=>row.name)).size!==8)throw Error('Invalid initialization collections');
 for(const row of collections){
  const items=json(row.items),text=json(row.items_text);
  if(!Array.isArray(items)||items.length!==counts[row.name]||fingerprint(items)!==fingerprint(text))throw Error('Invalid collection content: '+row.name);
 }
 if(rows.crm_courses?.length!==courseBook.courses.length)throw Error('Missing standard courses');
 const campaigns=(rows.trial_campaigns??[]).map(row=>({...row,config:json(row.config)}));
 const at=campaigns.find(row=>row.id==='organic')?.config.createdAt;
 if(typeof at!=='string'||!Number.isFinite(Date.parse(at)))throw Error('Missing initialization timestamp');
 // Keep the original export contract independent of today's system defaults.
 const legacy=JSON.parse(JSON.stringify(legacyCampaigns).replaceAll('SYSTEM_INITIALIZED_AT',at));
 const withoutInstagram=legacy.filter(config=>config.id!=='instagram-bio');
 const accepted=schemaVersion>=18
  ? [systemCampaignDefaults(at),withoutInstagram,legacy]
  : [legacy.filter(config=>config.id!=='social-bio')];
 const sort=items=>[...items].sort((a,b)=>a.id.localeCompare(b.id));
 const actualCampaigns=fingerprint(sort(campaigns.map(({id,code,config})=>({id,code,config}))));
 if(!accepted.some(expected=>actualCampaigns===fingerprint(sort(expected.map(config=>({id:config.id,code:config.code,config}))))))throw Error('System campaign bootstrap differs from standard presets');
 if(schemaVersion>=18){
  const actual=rows.campaign_promotion_index??[],entries=promotionIndexEntries(campaigns);
  if(actual.length!==entries.size||new Set(actual.map(row=>row.p)).size!==entries.size||actual.some(row=>entries.get(row.p)!==row.campaign_id))throw Error('Initialization promotion index mismatch');
  if((rows.campaign_promotion_short_links??[]).length)throw Error('Preset initialization must not contain allocated short links');
 }
}

export function inspectInitializationSql(sql,{schemaVersion=bootstrapSchemaVersion}={}){
 const statements=splitSql(sql),tables=new Set(),rows={};
 for(const statement of statements){
  const create=/^CREATE TABLE `([a-z0-9_]+)`\s*\(/.exec(statement);
  if(create){if(tables.has(create[1])||/\bFOREIGN KEY\b|\bREFERENCES\b/i.test(statement))throw Error('Invalid initialization DDL');tables.add(create[1]);rows[create[1]]=[];continue;}
  const insert=/^INSERT INTO `([a-z0-9_]+)`\s*\(/.exec(statement);
  if(insert){if(!tables.has(insert[1]))throw Error('Unexpected initialization table');rows[insert[1]].push(...parseInsert(statement).rows);continue;}
  if(!['SET NAMES utf8mb4',"SET time_zone = '+00:00'","SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ENGINE_SUBSTITUTION'",'START TRANSACTION','COMMIT'].includes(statement))throw Error('Unexpected initialization SQL statement');
 }
 verifyBootstrapTables(tables,schemaVersion);
 verifyBootstrapRows(rows,schemaVersion);
 return {statements,tables,rows,schemaVersion};
}
