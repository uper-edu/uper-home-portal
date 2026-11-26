import contract from './startup-schema.json' with {type:'json'};
import {collections} from './content-query.mjs';
import {verifyCmsMediaSchema} from './cms-media-schema.mjs';
import {verifyPaymentAnalyticsSchema} from './payment-analytics-schema.mjs';
import notificationDefaults from '../../src/data/system-defaults/notifications.ts';
import evergreenLinks from '../../src/data/evergreenPromotionLinks.json' with {type:'json'};

function requireReady(condition, detail){
  if(!condition)throw Error(`Database not ready: ${detail}. Stop; review and apply manual SQL before startup.`);
}

// A ready version marker alone is not evidence of the target schema. All queries here must be read-only.
export async function verifyStartupDatabase(db,name,env){
  const rows=async(sql,params=[]) => (await db.query(sql,params))[0];
  const [server]=await rows('SELECT DATABASE() AS db, VERSION() AS version');
  requireReady(server.db===name && /^8\./.test(server.version) && !/MariaDB/i.test(server.version),'wrong database or unsupported MySQL version');
  const tables=new Map((await rows('SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.tables WHERE table_schema=DATABASE()')).map(t=>[t.name,t.engine]));
  requireReady(![...tables.keys()].some(t=>t.startsWith('access_restore_guard_')),'interrupted restore');
  for(const t of [...contract.baseline,...Object.keys(contract.tables)])requireReady(tables.get(t)==='InnoDB',`missing or incompatible table ${t}`);
  const versions=await rows('SELECT version,state FROM trial_schema_versions ORDER BY version');
  requireReady(versions.length===20 && versions.every((v,i)=>Number(v.version)===i+1 && v.state==='ready'),'expected clean schema versions 1–20 (no offline copy, partial or newer version)');
  const columns=new Map((await rows(`SELECT table_name AS tbl,column_name AS col,LOWER(column_type) AS typ,is_nullable AS nullable,
    LOWER(column_default) AS def,collation_name AS coll FROM information_schema.columns WHERE table_schema=DATABASE()`)).map(r=>[r.tbl+'.'+r.col,r]));
  const indexes=new Map((await rows(`SELECT table_name AS tbl,index_name AS idx,MAX(non_unique) AS nu,COUNT(sub_part) AS prefixes,
    GROUP_CONCAT(column_name ORDER BY seq_in_index) AS cols FROM information_schema.statistics WHERE table_schema=DATABASE() GROUP BY table_name,index_name`)).map(r=>[r.tbl+'.'+r.idx,r]));
  for(const [table,spec] of Object.entries(contract.tables)){
    for(const [col,[type,nullable,defaultValue,collation]] of Object.entries(spec.columns)){
      const actual=columns.get(table+'.'+col);
      requireReady(actual && actual.typ===type && actual.nullable===nullable && actual.def===defaultValue && (!collation||actual.coll===collation),`${table}.${col}`);
    }
    for(const [index,[nu,cols]] of Object.entries(spec.indexes)){
      const actual=indexes.get(table+'.'+index);
      requireReady(actual && Number(actual.nu)===nu && actual.cols===cols && !Number(actual.prefixes),`${table} index ${index}`);
    }
  }
  await verifyCmsMediaSchema(db);
  await verifyPaymentAnalyticsSchema(db);
  const collectionNames=new Set((await rows('SELECT name FROM cms_collections')).map(r=>r.name));
  for(const collection of collections)requireReady(collectionNames.has(collection),`CMS collection ${collection}`);
  // System presets were inserted by earlier releases during startup; now only their presence is verified.
  const ruleIds=new Set((await rows('SELECT id FROM notification_rules')).map(r=>r.id));
  for(const {event} of notificationDefaults.rules)requireReady(ruleIds.has(event),`notification rule ${event}`);
  const presetIds=new Set((await rows("SELECT p FROM campaign_promotion_index WHERE campaign_id='social-bio'")).map(r=>r.p));
  for(const {id} of evergreenLinks)requireReady(presetIds.has(id),`promotion preset ${id}`);
  const [settings]=await rows(`SELECT
    EXISTS(SELECT 1 FROM trial_campaigns WHERE id='organic' AND code='organic' AND config->>'$.systemManaged'='true') AS organic,
    EXISTS(SELECT 1 FROM portal_settings WHERE id='sla' AND JSON_TYPE(value)='OBJECT' AND JSON_CONTAINS_PATH(value,'all','$.hotHours','$.warmHours','$.coldHours')) AS sla,
    EXISTS(SELECT 1 FROM access_state WHERE id='policy' AND value->>'$.initialized'='true') AS accounts,
    EXISTS(SELECT 1 FROM access_state WHERE id='teamless') AS teamless,
    EXISTS(SELECT 1 FROM notification_channels WHERE COALESCE(config->>'$.deleted','false')<>'true' AND (id='lark-group-default' OR COALESCE(config->>'$.systemManaged','false')='true')) AS systemGroup,
    EXISTS(SELECT 1 FROM portal_settings WHERE id='lark_personal_channel' AND value->>'$.mode' IN ('live','simulation') AND CAST(value->>'$.revision' AS UNSIGNED)>0) AS lark,
    EXISTS(SELECT 1 FROM enrollment_mail_configuration WHERE environment=? AND config->>'$.delivery.mode' IN ('disabled','simulation','smtp') AND CHAR_LENGTH(config->>'$.delivery.generation')>0) AS mail`,[env.PORTAL_ENV||'unconfigured']);
  for(const key of ['organic','sla','teamless','systemGroup','lark','mail',...(env.PLATFORM_MODE==='local'?['accounts']:[])])requireReady(Number(settings[key])===1,`unprepared ${key} setting`);
}
