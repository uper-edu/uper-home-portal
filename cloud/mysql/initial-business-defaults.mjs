import {createHash,randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import {open} from 'node:fs/promises';
import {validateRole} from '../../src/utils/accessControl.ts';
import {cmsSeedNames} from './cms-seed.mjs';
import {cmsMediaUrl,trustedCmsMediaUrl} from './cms-media-storage.mjs';
import {promotionIndexEntries} from './promotion-index.mjs';

export const initialDefaultsMarker='initial_business_defaults_v1';
const safeId=/^[a-zA-Z0-9_.:-]{1,191}$/;
const settingId=/^(?:enrollment_(?:bank|rules|catalog_replaced|template:[a-z0-9-]+|batch:[a-f0-9]{64})|sla|lark_personal_channel|faculty:(?:profile|rate|photo|cv):[a-z0-9-]+|faculty:rate-history:[a-z0-9-]+:\d{16})$/;
const privateProperty=/^(?:password(?:hash)?|encrypted.*|secret(?:id|key|ref)?|(?:api|access|refresh|lark|cos|smtp)(?:key|token|secret)|webhook(?:url)?|signatureKey)$/i;

const tables={
 roles:['access_roles','id,config,enabled,revision','id'],
 courses:['crm_courses','id,revision,value','id'],
 classes:['enrollment_classes','id,course_id,revision,state,first_lesson_at,enrollment_closes_at,data,updated_at','id'],
 settings:['portal_settings','id,value','id'],
 cms:['cms_collections','name,revision,items,updated_at,items_text','name'],
 media:['cms_media','id,mime,content,uploaded_by,created_at,legacy_name,storage_type,cos_url,object_key,byte_size','id'],
 campaigns:['trial_campaigns','id,code,config,created_at','id'],
 rules:['notification_rules','id,version,config,enabled,effective_at','id'],
 channels:['notification_channels','id,config','id'],
};

function assertPreset(condition,message){
 if(!condition)throw Error('Invalid initial business defaults: '+message);
}
function containsCredential(value){
 if(!value||typeof value!=='object')return false;
 return Object.entries(value).some(([key,v])=>(privateProperty.test(key)&&v!==''&&v!=null)||containsCredential(v));
}
function withoutFields(config,fields){
 const result={...config};
 for(const field of fields)delete result[field];
 return result;
}
const queryFields=fields=>fields.split(',').map(x=>'\`'+x+'\`').join(',');

function safeNotificationChannel(config){
 return {...withoutFields(config,['secretRef','encryptedWebhook','webhook','webhookUrl','signatureKey','signingSecret']),
  mode:'simulation',signingEnabled:false};
}
function safeMail(config){
 const basic=withoutFields(config,['delivery','accounts']);
 const accounts=(config.accounts??[]).map(account=>({
  ...withoutFields(account,['secret','secretRef','encryptedPassword','password','credentialFingerprint','credentialGeneration']),secret:'',
 }));
 return {...basic,accounts,delivery:{mode:'disabled'}};
}
function resetCampaignStats(config){
 return {...config,stats:Object.fromEntries(Object.entries(config.stats??{}).map(([k,v])=>[k,k==='budgetCost'?v:typeof v==='number'?0:null]))};
}

export async function collectInitialBusinessDefaults(c){
 const result={version:1};
 for(const [key,[table,fields,id]] of Object.entries(tables)){
  const projection=key==='media'?fields.replace('content','NULL AS content').replace('uploaded_by',"'system-initialization' AS uploaded_by").replace('legacy_name','NULL AS legacy_name'):fields;
  const condition=key==='settings'?" WHERE id IN('enrollment_bank','enrollment_rules','enrollment_catalog_replaced','sla','lark_personal_channel') OR id LIKE 'faculty:%' OR LEFT(id,20)='enrollment_template:' OR LEFT(id,17)='enrollment_batch:'":'';
  const [rows]=await c.query('SELECT '+projection+' FROM '+table+condition+' ORDER BY '+id);
  result[key]=rows;
 }
 result.settings=result.settings.filter(row=>settingId.test(row.id)).map(row=>row.id==='lark_personal_channel'
  ?{...row,value:{mode:'simulation',revision:1}}:row);
 result.channels=result.channels.map(row=>({...row,config:safeNotificationChannel(row.config)}));
 result.campaigns=result.campaigns.map(row=>({...row,config:resetCampaignStats(row.config)}));
 const [[mail]]=await c.execute('SELECT revision,config FROM enrollment_mail_configuration WHERE environment=?',['dev']);
 result.mail=mail?{revision:Math.max(1,mail.revision),config:safeMail(mail.config)}:null;
 validateInitialBusinessDefaults(result);
 return result;
}

export function validateInitialBusinessDefaults(bundle){
 assertPreset(bundle?.version===1&&Object.keys(bundle).every(key=>key==='version'||key==='mail'||Object.hasOwn(tables,key)),'format');
 for(const [name,[,columns,id]] of Object.entries(tables)){
  const rows=bundle[name],keys=columns.split(',');
  assertPreset(Array.isArray(rows)&&rows.length<=5000,name);
  assertPreset(rows.every(row=>row&&Object.keys(row).length===keys.length&&keys.every(key=>Object.hasOwn(row,key))&&safeId.test(row[id])),name+' row');
  assertPreset(new Set(rows.map(row=>row[id])).size===rows.length,name+' duplicate');
 }
 const courses=new Set(bundle.courses.map(row=>row.id));
 const settings=new Map(bundle.settings.map(row=>[row.id,row.value]));
 for(const row of bundle.roles)validateRole(row.config);
 assertPreset(bundle.roles.some(row=>row.id==='access_admin'&&row.enabled&&['read','users','roles','sessions','audit']
   .every(key=>row.config.grants['access.'+key]==='all')),'administrator definition');
 assertPreset(bundle.settings.every(row=>settingId.test(row.id)),'setting key');
 assertPreset(bundle.classes.every(row=>courses.has(row.course_id)&&row.data?.courseId===row.course_id&&
  (!row.data.teacherId||settings.has('faculty:profile:'+row.data.teacherId))&&
  (!row.data.templateId||settings.has('enrollment_template:'+row.data.templateId))),'class references');
 for(const [id,value] of settings){
  if(id.startsWith('enrollment_template:'))assertPreset(courses.has(value.courseId),'template course');
  if(id.startsWith('faculty:profile:')){
   const facultyId=id.split(':')[2];
   assertPreset(value.id===facultyId&&Object.keys(value.files??{}).every(kind=>['photo','cv'].includes(kind)&&
    settings.has('faculty:'+kind+':'+facultyId)),'faculty attachments');
  }else if(id.startsWith('faculty:'))assertPreset(settings.has('faculty:profile:'+id.split(':')[2]),'faculty owner');
 }
 assertPreset(settings.get('lark_personal_channel')?.mode==='simulation','personal delivery mode');
 assertPreset(bundle.channels.every(row=>row.config?.mode==='simulation'&&row.config.signingEnabled===false),'group delivery mode');
 assertPreset(bundle.mail===null||Object.keys(bundle.mail??{}).sort().join(',')==='config,revision'&&
  Number.isSafeInteger(bundle.mail.revision)&&bundle.mail.revision>0&&bundle.mail.config.delivery?.mode==='disabled','mail delivery mode');
 const mediaIds=new Set(bundle.media.map(row=>row.id));
 for(const row of bundle.media)assertPreset(row.storage_type==='cos'&&row.content===null&&row.legacy_name===null&&
  row.uploaded_by==='system-initialization'&&row.cos_url===cmsMediaUrl(row.id)&&row.object_key==='cms/'+row.id+'.webp','CMS media');
 for(const {name,items,items_text} of bundle.cms){
  assertPreset(cmsSeedNames.includes(name)&&Array.isArray(items)&&
    (items_text===null||typeof items_text==='string'),'CMS collection');
  const preciseItems=items_text===null?items:JSON.parse(items_text);
  assertPreset(Array.isArray(preciseItems)&&!containsCredential(preciseItems),'CMS content');
  for(const content of [items,preciseItems]){
   const text=JSON.stringify(content);
   for(const match of text.matchAll(/\/images\/uploads\/([a-f0-9]{64})\.webp/g))assertPreset(mediaIds.has(match[1]),'CMS image reference');
   for(const [url] of text.matchAll(/https:\/\/[^"\s]+\.myqcloud\.com\/cms\/[^"\s]+/g))
    assertPreset(trustedCmsMediaUrl(url)&&mediaIds.has(url.slice(-69,-5)),'CMS object reference');
  }
 }
 promotionIndexEntries(bundle.campaigns);
 assertPreset(!containsCredential(bundle),'unexpected credential field');
 return {bundle,digest:createHash('sha256').update(JSON.stringify(bundle)).digest('hex')};
}
export async function readInitialBusinessDefaults(file){
 const input=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const stat=await input.stat();
  assertPreset(stat.isFile()&&(stat.mode&0o077)===0&&stat.size<=64*1024*1024,'private file (0600, at most 64 MiB)');
  return validateInitialBusinessDefaults(JSON.parse(await input.readFile('utf8')));
 }finally{await input.close();}
}

export async function insertInitialBusinessDefaults(c,{bundle,digest},environment){
 assertPreset(['dev','test','prod'].includes(environment),'target environment');
 for(const [name,[table,columns]] of Object.entries(tables)){
  const keys=columns.split(',');
  for(const row of bundle[name]){
   const params=keys.map(key=>row[key]!==null&&typeof row[key]==='object'?JSON.stringify(row[key]):row[key]);
   await c.execute('INSERT INTO '+table+'('+queryFields(columns)+') VALUES('+keys.map(()=>'?').join(',')+')',params);
  }
 }
 if(bundle.mail){
  const config={...bundle.mail.config,delivery:{mode:'disabled',generation:randomUUID()}};
  await c.execute('INSERT INTO enrollment_mail_configuration(environment,revision,config) VALUES(?,?,?)',
    [environment,bundle.mail.revision,JSON.stringify(config)]);
 }
 const [result]=await c.execute('UPDATE portal_settings SET value=? WHERE id=?',
  [JSON.stringify({digest,environment,state:'applied'}),initialDefaultsMarker]);
 if(result.affectedRows!==1)throw Error('Missing initial business defaults marker');
}
