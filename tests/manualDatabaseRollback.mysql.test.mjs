import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import mysql from 'mysql2/promise';
import spec from '../cloud/mysql/startup-schema.json' with {type:'json'};
import {systemCampaignDefaults} from '../cloud/mysql/system-campaign-defaults.mjs';
import {disposeNativeTest} from './helpers/disposeNativeTest.mjs';
import {setupNativeTest} from './helpers/mysql.mjs';

const paths=[
  'v20261126182423_portal_v18_to_v20.sql',
  'v20261126182717_reviewed_delivery_state.sql',
  'v20261126192807_system_default_seeds.sql',
  'v20261127101113_rollback_v20_to_v18.sql',
];

test('tracked MySQL rollback protects existing data and resumes from both sides of the DROP', {
  skip:!process.env.MYSQL_NATIVE_TEST_ENV && 'Requires authorized isolated MySQL for destructive rollback verification',
}, async t=>{
  // The shared fixture refuses any socket other than the independent cleanup socket.
  const fixture=await setupNativeTest('manual_rollback');
  const url=new URL(process.env.MYSQL_TRIAL_URL);
  assert.equal(url.pathname,'/'+fixture.name);
  const db=await mysql.createConnection({socketPath:fixture.socket,database:fixture.name,
    user:decodeURIComponent(url.username),password:decodeURIComponent(url.password)});
  t.after(async()=>{await db.end();await disposeNativeTest(fixture);});

  const [schema,delivery,seed,rollback]=await Promise.all(paths.map(name=>readFile(new URL('../sql/'+name,import.meta.url),'utf8')));
  async function run(script, expectedFailure) {
    const routine=script.match(/CREATE PROCEDURE (uper_[a-z0-9_]+)\(\)/)?.[1];
    assert.ok(routine);
    const definition=script.slice(script.indexOf('CREATE PROCEDURE'),script.indexOf('END$$')+3);
    await db.query(definition);
    const call=()=>db.query('CALL '+routine+'()');
    if(expectedFailure)await assert.rejects(call,expectedFailure);
    else await call();
    // Fixture-only cleanup of the procedure this call just installed.
    await db.query('DROP PROCEDURE '+routine);
  }
  const targetTables=Object.keys(spec.tables);
  const present=async()=>{
    const [rows]=await db.query('SELECT table_name AS name FROM information_schema.tables WHERE table_schema=DATABASE() ORDER BY table_name');
    return rows.map(({name})=>name).filter(name=>targetTables.includes(name));
  };
  const versions=async()=> (await db.query('SELECT version,state FROM trial_schema_versions WHERE version>18 ORDER BY version'))[0];
  const audits=async()=> (await db.query("SELECT action,data FROM portal_audit WHERE action LIKE 'release.v18v20.%' ORDER BY id"))[0];
  const snapshot=async()=>{
    const queries=[
      'SELECT id,value FROM portal_settings ORDER BY id',
      'SELECT id,config FROM notification_channels ORDER BY id',
      'SELECT id,version,config,enabled FROM notification_rules ORDER BY id',
      'SELECT id,config FROM trial_campaigns ORDER BY id',
      'SELECT p,campaign_id FROM campaign_promotion_index ORDER BY p',
      'SELECT p,short_code FROM campaign_promotion_short_links ORDER BY p',
    ];
    const result=[];
    for(const sql of queries)result.push((await db.query(sql))[0]);
    return result;
  };

  // Derive the v18 fixture from the shared schema fixture, never from production data.
  assert.equal((await present()).length,targetTables.length);
  await db.query('DROP TABLE '+targetTables.map(name=>mysql.escapeId(name)).join(','));
  await db.query('DELETE FROM trial_schema_versions WHERE version IN (19,20)');
  await db.query("INSERT INTO portal_settings(id,value) VALUES('lark_personal_channel',?) ON DUPLICATE KEY UPDATE value=?",
    ['{"revision":0,"mode":null,"legacy":true}','{"revision":0,"mode":null,"legacy":true}']);
  await db.query("INSERT INTO notification_channels(id,config) VALUES('rollback-test-group',?)",
    [JSON.stringify({groupName:'CRM Bot',systemManaged:false,mode:'live',opaqueFixture:'keep'})]);
  const campaign=systemCampaignDefaults('2020-01-01T00:00:00.000Z').find(row=>row.id==='social-bio');
  campaign.promotionLinks=campaign.promotionLinks.filter(({id})=>!id.startsWith('enroll-'));
  campaign.updatedAt=null;
  await db.query("INSERT INTO trial_campaigns(id,code,config) VALUES('social-bio','social-bio',?) ON DUPLICATE KEY UPDATE config=?",
    [JSON.stringify(campaign),JSON.stringify(campaign)]);
  // A pre-existing index is deliberately not owned by this upgrade.
  await db.query("INSERT INTO campaign_promotion_index(p,campaign_id) VALUES('enroll-ig','social-bio') ON DUPLICATE KEY UPDATE campaign_id='social-bio'");
  await db.query('SET @uper_expected_database=?, @uper_rollback_confirm=?, @uper_environment=?, @uper_group_mode=?, @uper_personal_mode=?, @uper_mail_mode=?',
    [fixture.name,'v20-to-v18','test','simulation','simulation','disabled']);

  const original=await snapshot();
  await db.query('CREATE TABLE integration_credentials (preexisting INT) ENGINE=InnoDB');
  await run(rollback,/Upgrade origin unavailable/);
  assert.deepEqual(await present(),['integration_credentials']);
  assert.deepEqual(await snapshot(),original);
  await db.query('DROP TABLE integration_credentials');

  await run(schema.replace('    SET v_i=v_i+1;', "    IF v_i=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test interrupted CREATE'; END IF;\n    SET v_i=v_i+1;"),
    /test interrupted CREATE/);
  assert.deepEqual(await present(),['crm_payment_analytics']);
  await run(rollback);
  assert.deepEqual(await present(),[]);
  assert.deepEqual(await versions(),[]);
  assert.deepEqual(await snapshot(),original);

  const upgrade=async()=>{await run(schema);await run(delivery);await run(seed);};
  await upgrade();
  const upgraded=await snapshot();
  const upgradedAudits=await audits();
  await upgrade();
  assert.deepEqual(await snapshot(),upgraded);
  assert.deepEqual(await audits(),upgradedAudits);

  await db.query("INSERT INTO integration_credentials(environment,kind,resource,state) VALUES('test','fixture','fixture',JSON_OBJECT())");
  await run(rollback,/hold business data/);
  assert.deepEqual(await snapshot(),upgraded);
  assert.deepEqual(await audits(),upgradedAudits);
  await db.query('DELETE FROM integration_credentials');

  const [[{config:mail}]]=await db.query("SELECT config FROM enrollment_mail_configuration WHERE environment='test'");
  await db.query("UPDATE enrollment_mail_configuration SET config=JSON_SET(config,'$.delivery.generation','untracked')");
  await run(rollback,/mail configuration changed/);
  await db.query("UPDATE enrollment_mail_configuration SET config=? WHERE environment='test'",[JSON.stringify(mail)]);
  const [[{value:personal}]]=await db.query("SELECT value FROM portal_settings WHERE id='lark_personal_channel'");
  await db.query("UPDATE portal_settings SET value=JSON_SET(value,'$.mode','live') WHERE id='lark_personal_channel'");
  const edited=await snapshot();
  await run(rollback,/Personal Lark configuration changed/);
  assert.deepEqual(await snapshot(),edited);
  assert.deepEqual(await audits(),upgradedAudits);
  await db.query("UPDATE portal_settings SET value=? WHERE id='lark_personal_channel'",[JSON.stringify(personal)]);
  await db.query("INSERT INTO campaign_promotion_short_links(short_code,p) VALUES('abcd12','enroll-tt')");
  await run(rollback,/has links or customer attribution/);
  assert.equal((await db.query("SELECT p FROM campaign_promotion_short_links WHERE p='enroll-tt'"))[0].length,1);
  await db.query("DELETE FROM campaign_promotion_short_links WHERE p='enroll-tt'");

  const stopBeforeDrop=rollback.replace('  IF v_drop IS NOT NULL THEN',
    "  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test interrupted before DROP';\n  IF v_drop IS NOT NULL THEN");
  await run(stopBeforeDrop,/test interrupted before DROP/);
  assert.deepEqual(await snapshot(),original);
  assert.deepEqual((await versions()).map(row=>row.state),['rolling_back','rolling_back']);
  assert.equal((await present()).length,targetTables.length);
  await run(schema,/Expected clean v18 baseline/);

  const stopAfterDrop=rollback.replace('  DELETE FROM trial_schema_versions',
    "  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test interrupted after DROP';\n  DELETE FROM trial_schema_versions");
  await run(stopAfterDrop,/test interrupted after DROP/);
  assert.deepEqual(await present(),[]);
  assert.deepEqual(await snapshot(),original);
  await run(rollback);
  assert.deepEqual(await versions(),[]);
  const finished=await audits();
  await run(rollback);
  assert.deepEqual(await audits(),finished);
  assert.deepEqual(await snapshot(),original);
  assert.equal(finished.filter(({action})=>action==='release.v18v20.reverting').length,2);
  assert.equal(finished.filter(({action})=>action==='release.v18v20.reverted').length,2);
});
