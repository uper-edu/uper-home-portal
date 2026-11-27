import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
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
  const login={
    user:decodeURIComponent(url.username),
    password:decodeURIComponent(url.password),
  };
  const clientDir=await mkdtemp(join(tmpdir(),'uper-rollback-client-'));
  let db;
  t.after(async()=>{
    try{
      await db?.end();
      await disposeNativeTest(fixture);
    }finally{
      await rm(clientDir,{recursive:true,force:true});
    }
  });
  const clientFile=join(clientDir,'client.cnf');
  await writeFile(clientFile,`[client]\nuser=${login.user}\npassword=${login.password}\n`,{mode:0o600});
  db=await mysql.createConnection({socketPath:fixture.socket,database:fixture.name,...login});

  const [schema,delivery,seed,rollback]=await Promise.all(paths.map(name=>readFile(new URL('../sql/'+name,import.meta.url),'utf8')));
  const mysqlCli=process.env.MYSQL_BIN_DIRECTORY?join(process.env.MYSQL_BIN_DIRECTORY,'mysql'):'mysql';
  const initialization='SET @uper_expected_database='+mysql.escape(fixture.name)+
    ", @uper_rollback_confirm='v20-to-v18', @uper_environment='test', @uper_group_mode='simulation', "+
    "@uper_personal_mode='simulation', @uper_mail_mode='disabled'";
  async function run(script, expectedFailure) {
    const routine=script.match(/CREATE PROCEDURE (uper_[a-z0-9_]+)\(\)/)?.[1];
    assert.ok(routine);
    // Match the runbook: a fresh UTF-8 batch client consumes the complete SQL
    // file, including DELIMITER, and stops at the first error.
    const result=spawnSync(mysqlCli,[
      '--defaults-file='+clientFile,'--no-login-paths','--protocol=SOCKET','--socket='+fixture.socket,
      '--batch','--default-character-set=utf8mb4','--init-command='+initialization,fixture.name,
    ],{input:script,encoding:'utf8',timeout:20_000,env:{PATH:process.env.PATH}});
    if(result.error)throw result.error;
    if(!expectedFailure){
      assert.equal(result.status,0,result.stderr);
      return;
    }
    assert.notEqual(result.status,0);
    assert.match(result.stderr,expectedFailure);
    // Fixture-only cleanup of the procedure this client just installed.
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
  delete campaign.systemManaged;
  campaign.updatedAt=null;
  await db.query("INSERT INTO trial_campaigns(id,code,config) VALUES('social-bio','social-bio',?) ON DUPLICATE KEY UPDATE config=?",
    [JSON.stringify(campaign),JSON.stringify(campaign)]);
  // A pre-existing index is deliberately not owned by this upgrade.
  await db.query("INSERT INTO campaign_promotion_index(p,campaign_id) VALUES('enroll-ig','social-bio') ON DUPLICATE KEY UPDATE campaign_id='social-bio'");
  const original=await snapshot();
  await db.query('CREATE TABLE integration_credentials (preexisting INT) ENGINE=InnoDB');
  await run(rollback,/Upgrade origin unavailable/);
  assert.deepEqual(await present(),['integration_credentials']);
  assert.deepEqual(await snapshot(),original);
  await db.query('DROP TABLE integration_credentials');

  await run(schema.replace('    SET v_i=v_i+1;', "    IF v_i=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test interrupted CREATE'; END IF;\n    SET v_i=v_i+1;"),
    /test interrupted CREATE/);
  assert.deepEqual(await present(),['crm_payment_analytics']);
  const partialAudits=await audits();
  await db.query('CREATE TABLE integration_credentials (unowned INT) ENGINE=InnoDB');
  await run(rollback,/Target table is not owned by this upgrade/);
  assert.deepEqual(await present(),['crm_payment_analytics','integration_credentials']);
  assert.deepEqual(await audits(),partialAudits);
  await db.query('DROP TABLE integration_credentials');
  await run(rollback);
  assert.deepEqual(await present(),[]);
  assert.deepEqual(await versions(),[]);
  assert.deepEqual(await snapshot(),original);
  t.diagnostic('Both untracked and mid-upgrade same-name empty tables were preserved');

  const upgrade=async()=>{await run(schema);await run(delivery);await run(seed);};
  await upgrade();
  const upgraded=await snapshot();
  const upgradedAudits=await audits();
  const runId=upgradedAudits.filter(({action})=>action==='release.v18v20.begin').at(-1).data.run;
  const [owned]=await db.query('SELECT table_name AS name FROM information_schema.tables WHERE table_schema=DATABASE() AND BINARY table_comment=?',
    ['uper-v18v20:'+runId]);
  assert.deepEqual(owned.map(({name})=>name).sort(),[...targetTables].sort());
  assert.deepEqual((await versions()).map(row=>row.state),['ready','ready']);
  await upgrade();
  assert.deepEqual(await snapshot(),upgraded);
  assert.deepEqual(await audits(),upgradedAudits);

  t.diagnostic('Upgrade created 28 owned tables, marked v19/v20 ready, and reran without changing data or audit');

  await db.query(`INSERT INTO enrollment_orders(id,class_id,email,request_id,fingerprint,state,price,payment_due_at,created_at,data)
    VALUES('fixture-order','fixture-class','learner@example.invalid','fixture-request',REPEAT('a',64),'awaiting_payment',920000,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),JSON_OBJECT())`);
  await run(rollback,/hold business data/);
  assert.deepEqual(await snapshot(),upgraded);
  assert.deepEqual(await audits(),upgradedAudits);
  const [orders]=await db.query('SELECT id,price FROM enrollment_orders');
  assert.deepEqual(orders,[{id:'fixture-order',price:920000}]);
  await db.query("DELETE FROM enrollment_orders WHERE id='fixture-order'");

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
  t.diagnostic('Order, changes to mail and Lark configuration, and a downstream short link all blocked rollback');

  const stopBeforeDrop=rollback.replace('  IF v_drop IS NOT NULL THEN',
    "  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test interrupted before DROP';\n  IF v_drop IS NOT NULL THEN");
  await run(stopBeforeDrop,/test interrupted before DROP/);
  assert.deepEqual(await snapshot(),original);
  assert.deepEqual((await versions()).map(row=>row.state),['rolling_back','rolling_back']);
  assert.equal((await present()).length,targetTables.length);
  await run(schema,/Expected clean v18 baseline/);
  await db.query("UPDATE notification_channels SET config=JSON_SET(config,'$.mode','simulation') WHERE id='rollback-test-group'");
  await run(rollback,/does not match its original configuration/);
  assert.equal((await present()).length,targetTables.length);
  await db.query("UPDATE notification_channels SET config=JSON_SET(config,'$.mode','live') WHERE id='rollback-test-group'");

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
  t.diagnostic('Original values, nulls and missing fields restored. Both DDL interruption points resumed; repeat changed zero rows and audits');
});
