import {systemCampaignDefaults} from './system-campaign-defaults.mjs';
import {syncPromotionIndex} from './promotion-index.mjs';
import defaults from './system-defaults.json' with {type:'json'};
import courseBook from '../../src/data/crmCoursePrices.json' with {type:'json'};
import {LARK_DEFAULT_MAX_PER_HOUR} from '../../src/utils/larkNotificationDefaults.ts';
import {CRM_BOT_CHANNEL} from '../../server/portal/policy.ts';
import {findSystemLarkGroup, SYSTEM_LARK_GROUP_NAME} from '../../server/portal/larkSystemChannels.ts';
import {GROUP_WEBHOOK_ENV_KEY, groupWebhookUsesEnvironment} from '../../server/portal/larkGroupWebhook.ts';
import {notificationGroupIds} from '../../src/utils/notificationGroupTargets.ts';

const parseConfig = value => typeof value === 'string' ? JSON.parse(value) : value;

/** Runs inside the caller's schema lock. Insert missing presets, never reset counters or custom roles. */
export async function initializeSystemDefaults(c){
 const at=new Date().toISOString(),records=systemCampaignDefaults(at);
 await c.beginTransaction();
 try{
  for(const record of records){
   const [aliases]=await c.execute("SELECT campaign_id FROM campaign_source_reviews WHERE LOWER(raw_code)=? AND status='linked'",[record.code]);
   if(aliases.some(a=>a.campaign_id!==record.id))throw Error('System campaign alias conflict: '+record.id);
   await c.execute('INSERT INTO trial_campaigns(id,code,config) VALUES(?,?,?) ON DUPLICATE KEY UPDATE id=id',[record.id,record.code,JSON.stringify(record)]);
   const [rows]=await c.execute('SELECT id,code,config FROM trial_campaigns WHERE id=? OR code=?',[record.id,record.code]);
   const saved=rows[0],config=typeof saved?.config==='string'?JSON.parse(saved.config):saved?.config;
   if(rows.length!==1||saved.id!==record.id||saved.code!==record.code||record.systemManaged&&record.id!=='social-bio'&&!config?.systemManaged||record.presetKey&&config?.presetKey!==record.presetKey)throw Error('System campaign reserved identity conflict: '+record.id);
   if (record.id==='social-bio') {
    const existing=config.promotionLinks ?? [];
    for (const preset of record.promotionLinks) {
     const found=existing.find(link=>link.id===preset.id);
     if(found && Object.keys(preset).some(key=>key!=='createdAt' && found[key]!==preset[key]))
      throw Error('System promotion reserved identity conflict: '+preset.id);
    }
    const missing=record.promotionLinks.filter(preset=>!existing.some(link=>link.id===preset.id));
    if (missing.length || !config.systemManaged) {
     const next={...config,systemManaged:true,promotionLinks:[...existing,...missing],updatedAt:at};
     await c.execute('UPDATE trial_campaigns SET config=? WHERE id=?',[JSON.stringify(next),record.id]);
    }
   }
  }
  await c.execute('INSERT INTO access_roles(id,config) VALUES(?,?) ON DUPLICATE KEY UPDATE id=id',['finance',JSON.stringify(defaults.finance)]);
  const environmentWebhook = groupWebhookUsesEnvironment();
  const larkConfig = {...defaults.crmLarkBot, maxPerHour: LARK_DEFAULT_MAX_PER_HOUR,
   ...(environmentWebhook ? {secretRef: GROUP_WEBHOOK_ENV_KEY} : {})};
  const [existingChannels] = await c.execute('SELECT id,config FROM notification_channels ORDER BY id FOR UPDATE');
  const [daily] = await c.execute("SELECT config FROM notification_rules WHERE id='daily.digest'");
  const dailyConfig = parseConfig(daily[0]?.config);
  const systemGroup = findSystemLarkGroup(
   existingChannels.map(row => ({...row,config:parseConfig(row.config)})),
   Array.isArray(dailyConfig?.channels) ? notificationGroupIds(dailyConfig) : [],
  );
  if (systemGroup) {
   const addWebhookReference = environmentWebhook && !systemGroup.config.secretRef && !systemGroup.config.encryptedWebhook;
   if (!systemGroup.config.systemManaged || systemGroup.config.groupName !== SYSTEM_LARK_GROUP_NAME || addWebhookReference) {
    const config = {...systemGroup.config,groupName:SYSTEM_LARK_GROUP_NAME,systemManaged:true,
     ...(addWebhookReference ? {secretRef: GROUP_WEBHOOK_ENV_KEY} : {})};
    await c.execute('UPDATE notification_channels SET config=? WHERE id=?',[JSON.stringify(config),systemGroup.id]);
   }
  } else {
   await c.execute(
    'INSERT INTO notification_channels(id,config) VALUES(?,?) ON DUPLICATE KEY UPDATE id=id',
    [CRM_BOT_CHANNEL, JSON.stringify(larkConfig)],
   );
  }
  for(const course of courseBook.courses){
   const id='hsk-standard-'+course.id.replace(/^HSK /,'').toLowerCase();
   const [existing]=await c.execute("SELECT id FROM crm_courses WHERE id=? OR JSON_UNQUOTE(JSON_EXTRACT(value,'$.name'))=?",[id,course.id]);
   if(existing.some(r=>r.id===id))continue;
   if(existing.length>1)throw Error('Ambiguous existing standard course: '+course.id);
   if(existing.length)continue; // Older manually seeded IDs retain pricing/history and existing enrollment references.
   const config={name:course.id,sessions:course.sessions,price:course.total,active:true,maxDiscountBps:0,maxDiscountAmount:null};
   const value={...config,presetKey:'hsk_standard_v1',updatedAt:at,history:[{id:'system-initialize-'+id,actor:'system',at,before:null,after:config}]};
   await c.execute('INSERT INTO crm_courses(id,revision,value) VALUES(?,1,?)',[id,JSON.stringify(value)]);
  }
  await syncPromotionIndex(c);
  await c.commit();return {campaigns:records.map(r=>r.id),role:'finance',courses:courseBook.courses.length};
 }catch(e){await c.rollback();throw e;}
}
