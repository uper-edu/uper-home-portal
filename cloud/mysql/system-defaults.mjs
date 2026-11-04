import {syncPromotionIndex} from './promotion-index.mjs';
import defaults from './system-defaults.json' with {type:'json'};
import courseBook from '../../src/data/crmCoursePrices.json' with {type:'json'};
import {LARK_DEFAULT_MAX_PER_HOUR} from '../../src/utils/larkNotificationDefaults.ts';
import {validWebhook} from '../../server/portal/notificationDelivery.ts';
import {CRM_BOT_CHANNEL} from '../../server/portal/policy.ts';

/** Runs inside the caller's schema lock. Insert missing presets, never reset counters or custom roles. */
export async function initializeSystemDefaults(c){
 const at=new Date().toISOString(),records=JSON.parse(JSON.stringify(defaults.campaigns).replaceAll('SYSTEM_INITIALIZED_AT',at));
 const instagram = records.find(record => record.id === 'instagram-bio');
 records.push({
  ...instagram, id:'social-bio', code:'social-bio', presetKey:'social_bio_v1',
  name:'日常自然推广', nameEn:'Evergreen unpaid promotion', nameId:'Promosi rutin tanpa biaya',
  boundUtm:{...instagram.boundUtm,utm_source:'',utm_medium:'',utm_campaign:'social-bio'},
  promotionLinks:[],
 });
 await c.beginTransaction();
 try{
  for(const record of records){
   const [aliases]=await c.execute("SELECT campaign_id FROM campaign_source_reviews WHERE LOWER(raw_code)=? AND status='linked'",[record.code]);
   if(aliases.some(a=>a.campaign_id!==record.id))throw Error('System campaign alias conflict: '+record.id);
   await c.execute('INSERT INTO trial_campaigns(id,code,config) VALUES(?,?,?) ON DUPLICATE KEY UPDATE id=id',[record.id,record.code,JSON.stringify(record)]);
   const [rows]=await c.execute('SELECT id,code,config FROM trial_campaigns WHERE id=? OR code=?',[record.id,record.code]);
   const saved=rows[0],config=typeof saved?.config==='string'?JSON.parse(saved.config):saved?.config;
   if(rows.length!==1||saved.id!==record.id||saved.code!==record.code||record.systemManaged&&!config?.systemManaged||record.presetKey&&config?.presetKey!==record.presetKey)throw Error('System campaign reserved identity conflict: '+record.id);
  }
  await c.execute('INSERT INTO access_roles(id,config) VALUES(?,?) ON DUPLICATE KEY UPDATE id=id',['finance',JSON.stringify(defaults.finance)]);
  const larkPreset = defaults.crmLarkBot;
  if (validWebhook(process.env[larkPreset.secretRef])) {
   const config = {...larkPreset, maxPerHour: LARK_DEFAULT_MAX_PER_HOUR};
   await c.execute(
    'INSERT INTO notification_channels(id,config) VALUES(?,?) ON DUPLICATE KEY UPDATE id=id',
    [CRM_BOT_CHANNEL, JSON.stringify(config)],
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
