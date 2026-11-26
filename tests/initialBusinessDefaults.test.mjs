import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {createPrivateFile} from '../server/privateFile.mjs';
import {grantFixtureReadToOthers} from './helpers/privateFileAcl.mjs';
import mysql from 'mysql2/promise';
import access from '../src/data/system-defaults/access.ts';
import {cmsMediaUrl} from '../cloud/mysql/cms-media-storage.mjs';
import {collectInitialBusinessDefaults,initialDefaultsMarker,readInitialBusinessDefaults,validateInitialBusinessDefaults} from '../cloud/mysql/initial-business-defaults.mjs';
import {migrate} from '../cloud/mysql/migrate.mjs';

const at='2026-11-26 00:00:00.000000';
const mediaId='a'.repeat(64);
const cmsItems=[{_id:'example-news',title:'虚构课程动态',image:cmsMediaUrl(mediaId)}];

function sourceFixture() {
 return {
  access_roles:[{id:'access_admin',config:access.roles.access_admin,enabled:1,revision:2}],
  crm_courses:[{id:'example-course',revision:3,value:{name:'虚构课程',price:100_000}}],
  enrollment_classes:[{id:'example-class',course_id:'example-course',revision:1,state:'open',first_lesson_at:at,
   enrollment_closes_at:at,updated_at:at,data:{courseId:'example-course',teacherId:'example-teacher',templateId:'example-template'}}],
  portal_settings:[
   {id:'faculty:profile:example-teacher',value:{id:'example-teacher',content:{name:'虚构教师'},files:{}}},
   {id:'faculty:rate:example-teacher',value:{revision:1,after:[{amount:12500}]}},
   {id:'faculty:rate-history:example-teacher:0000000000000001',value:{revision:1,after:[{amount:12500}]}},
   {id:'enrollment_template:example-template',value:{id:'example-template',courseId:'example-course'}},
   {id:'enrollment_rules',value:{paymentHours:12}},
   {id:'enrollment_bank',value:{bank:{name:'虚构银行'}}},
   {id:'lark_personal_channel',value:{mode:'real',revision:3,secretRef:'must-not-copy'}},
  ],
  cms_collections:[{name:'news',revision:5,items:cmsItems,items_text:JSON.stringify(cmsItems),updated_at:at}],
  // Export queries only COS metadata and substitutes the local uploader.
  cms_media:[{id:mediaId,mime:'image/webp',content:null,uploaded_by:'system-initialization',created_at:at,legacy_name:null,
   storage_type:'cos',cos_url:cmsMediaUrl(mediaId),object_key:'cms/'+mediaId+'.webp',byte_size:123}],
  trial_campaigns:[{id:'example-campaign',code:'example-campaign',created_at:at,config:{id:'example-campaign',
   code:'example-campaign',promotionLinks:[{id:'test-promotion'}],stats:{clicks:74,leads:18,budgetCost:125}}}],
  notification_rules:[{id:'example.rule',version:3,enabled:1,effective_at:at,config:{event:'example.rule',channels:['inbox']}}],
  notification_channels:[{id:'crm-bot',config:{groupName:'CRM Bot',systemManaged:true,mode:'real',maxPerHour:27,
   signingEnabled:true,secretRef:'must-not-copy',encryptedWebhook:'must-not-copy'}}],
 };
}

async function exportFixture(){
 const fixture=sourceFixture();
 return collectInitialBusinessDefaults({
  query:async sql=>{
   const table=sql.match(/ FROM ([a-z_]+)/)?.[1];
   assert.ok(Object.hasOwn(fixture,table),'export read unexpected table '+table);
   return [structuredClone(fixture[table])];
  },
  execute:async (sql,args)=>{
   assert.match(sql,/FROM enrollment_mail_configuration WHERE environment=/);
   assert.deepEqual(args,['dev']);
   return [[{revision:3,config:{accounts:[{address:'dummy@example.invalid',secret:'must-not-copy',
    encryptedPassword:'must-not-copy'}],delivery:{mode:'real',generation:'must-not-copy'}}}]];
  },
 });
}

test('extracts only business presets, resetting live delivery settings and historical campaign counters',async()=>{
 const b=await exportFixture();
 assert.equal(b.classes[0].data.teacherId,'example-teacher');
 assert.equal(b.rules[0].enabled,1);
 assert.equal(b.channels[0].config.maxPerHour,27);
 assert.equal(b.channels[0].config.mode,'simulation');
 assert.equal(b.settings.find(row=>row.id==='lark_personal_channel').value.mode,'simulation');
 assert.deepEqual(b.campaigns[0].config.stats,{clicks:0,leads:0,budgetCost:125});
 assert.deepEqual(b.mail.config.delivery,{mode:'disabled'});
 assert.doesNotMatch(JSON.stringify(b),/must-not-copy/);
});

test('requires private plain files and rejects orphaned references and nested credential fields',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'uper-defaults-test-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=join(dir,'approved.json');
 const b=await exportFixture();
 createPrivateFile(file,JSON.stringify(b));
 assert.equal((await readInitialBusinessDefaults(file)).digest,validateInitialBusinessDefaults(b).digest);
 const alias=join(dir,'symlink.json');
 // Creating a symbolic link needs a privilege that Windows accounts may lack; the refusal is still checked where it can exist.
 const linked=await symlink(file,alias).then(()=>true,error=>{if(process.platform==='win32'&&error.code==='EPERM')return false;throw error;});
 if(linked)await assert.rejects(readInitialBusinessDefaults(alias));
 grantFixtureReadToOthers(file);
 await assert.rejects(readInitialBusinessDefaults(file),/private file/);
 const broken=structuredClone(b);
 broken.classes[0].data.teacherId='missing';
 assert.throws(()=>validateInitialBusinessDefaults(broken),/class references/);
 broken.classes[0].data.teacherId='example-teacher';
 broken.cms[0].items_text=JSON.stringify([{apiKey:'unexpected'}]);
 assert.throws(()=>validateInitialBusinessDefaults(broken),/CMS content/);
 broken.cms[0].items_text=JSON.stringify([{image:cmsMediaUrl('b'.repeat(64))}]);
 assert.throws(()=>validateInitialBusinessDefaults(broken),/CMS object reference/);
 assert.throws(()=>validateInitialBusinessDefaults({...b,customers:[]}),/format/);
});

const socket=process.env.MYSQL_NATIVE_TEST_ENV;
const nativeApproved=typeof socket==='string'&&
 /^\/private\/tmp\/(?:uper-initial-defaults-mysql\.[a-zA-Z0-9]+\/mysql\.sock|uper-mysql-native-cleanup\.sock)$/.test(socket);

async function freshDb(t){
 const admin=await mysql.createConnection({user:'root',socketPath:socket});
 const name='uper_trial_native_initial_defaults_'+randomBytes(6).toString('hex');
 await admin.query('CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin',[name]);
 const pool=mysql.createPool({user:'root',socketPath:socket,database:name,dateStrings:true,timezone:'Z'});
 t.after(async()=>{
  try {
   await pool.end();
   await admin.query('DROP DATABASE ??',[name]);
  } finally { await admin.end(); }
 });
 return {pool,name};
}
async function one(db,sql,args=[]){
 const [[row]]=await db.execute(sql,args);
 return row;
}
const fixtureOptions=async()=>({environment:'test',initialBusinessDefaults:validateInitialBusinessDefaults(await exportFixture())});

test('MySQL initializes approved presets and keeps later edits even when the original package is reused',{skip:!nativeApproved},async t=>{
 const {pool,name}=await freshDb(t);
 const options=await fixtureOptions();
 await migrate(pool,name,options);
 const [[joined]]=await pool.query(`SELECT enrollment_classes.data AS classData,crm_courses.value AS courseData,portal_settings.value AS teacher
    FROM enrollment_classes JOIN crm_courses ON crm_courses.id=enrollment_classes.course_id
    JOIN portal_settings ON portal_settings.id=CONCAT('faculty:profile:',JSON_UNQUOTE(JSON_EXTRACT(enrollment_classes.data,'$.teacherId')))`);
 assert.equal(joined.classData.templateId,'example-template');
 assert.equal(joined.courseData.name,'虚构课程');
 assert.equal(joined.teacher.content.name,'虚构教师');
 assert.equal((await one(pool,'SELECT revision FROM access_roles WHERE id=?',['access_admin'])).revision.toString(),'2');
 assert.deepEqual(JSON.parse((await one(pool,'SELECT items_text FROM cms_collections WHERE name=?',['news'])).items_text),cmsItems);
 assert.equal((await one(pool,'SELECT cos_url FROM cms_media WHERE id=?',[mediaId])).cos_url,cmsMediaUrl(mediaId));
 assert.equal((await one(pool,'SELECT campaign_id FROM campaign_promotion_index WHERE p=?',['test-promotion'])).campaign_id,'example-campaign');
 assert.equal((await one(pool,'SELECT version FROM notification_rules WHERE id=?',['example.rule'])).version,3);
 assert.equal((await one(pool,'SELECT value FROM portal_settings WHERE id=?',['enrollment_rules'])).value.paymentHours,12);
 const mail=await one(pool,'SELECT config FROM enrollment_mail_configuration WHERE environment=?',['test']);
 assert.equal(mail.config.delivery.mode,'disabled');
 assert.ok(mail.config.delivery.generation);
 assert.equal(await one(pool,'SELECT environment FROM enrollment_mail_configuration WHERE environment=?',['dev']),undefined);
 for(const table of ['portal_leads','crm_users','crm_sessions','enrollment_orders','enrollment_proofs','trial_members',
  'outbox','notification_jobs','portal_audit','integration_credentials']){
  const [[{count}]]=await pool.query('SELECT COUNT(*) AS count FROM ??',[table]);
  assert.equal(count,0,table);
 }
 await pool.execute('UPDATE crm_courses SET revision=4,value=JSON_SET(value,\'$.price\',120000) WHERE id=?',['example-course']);
 await pool.execute('UPDATE notification_channels SET config=JSON_SET(config,\'$.maxPerHour\',31) WHERE id=?',['crm-bot']);
 assert.deepEqual(await migrate(pool,name,options),{initialBusinessDefaults:'already-applied'});
 await assert.rejects(migrate(pool,name,{...options,environment:'dev'}),/target environment mismatch/);
 const changed=await exportFixture();
 changed.courses[0].value.price=90000;
 await assert.rejects(migrate(pool,name,{...options,initialBusinessDefaults:validateInitialBusinessDefaults(changed)}),/empty database/);
 await migrate(pool,name,{environment:'test'});
 assert.equal((await one(pool,'SELECT value FROM crm_courses WHERE id=?',['example-course'])).value.price,120000);
 assert.equal((await one(pool,'SELECT config FROM notification_channels WHERE id=?',['crm-bot'])).config.maxPerHour,31);
 assert.deepEqual(await one(pool,'SELECT config FROM enrollment_mail_configuration WHERE environment=?',['test']),mail);
});

test('MySQL refuses an existing database and rolls back an interrupted private seed before resuming',{skip:!nativeApproved},async t=>{
 const existing=await freshDb(t);
 await existing.pool.query('CREATE TABLE existing_data (n INT)');
 const options=await fixtureOptions();
 await assert.rejects(migrate(existing.pool,existing.name,options),/empty database/);
 assert.equal((await existing.pool.query('SHOW TABLES'))[0].length,1);
 const {pool,name}=await freshDb(t);
 const transientPool={getConnection:async()=>{
  const connection=await pool.getConnection();
  const execute=connection.execute.bind(connection);
  connection.execute=(sql,...params)=>{
   if(sql.startsWith('INSERT INTO crm_courses('))throw Error('interrupted before courses');
   return execute(sql,...params);
  };
  const release=connection.release.bind(connection);
  connection.release=()=>{connection.execute=execute;connection.release=release;release();};
  return connection;
 }};
 await assert.rejects(migrate(transientPool,name,options),/interrupted before courses/);
 assert.equal((await one(pool,'SELECT COUNT(*) AS count FROM access_roles')).count,0);
 assert.equal((await one(pool,'SELECT value FROM portal_settings WHERE id=?',[initialDefaultsMarker])).value.state,'pending');
 await assert.rejects(migrate(pool,name,{environment:'test'}),/original private business defaults/);
 await migrate(pool,name,options);
 assert.equal((await one(pool,'SELECT value FROM portal_settings WHERE id=?',[initialDefaultsMarker])).value.state,'applied');
});
