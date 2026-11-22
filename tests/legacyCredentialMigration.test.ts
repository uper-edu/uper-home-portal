import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {runCredentialMaintenance} from '../scripts/lib/credential-maintenance.mts';
import {sealMailPassword} from '../server/portal/enrollmentMailCredentials.ts';
import {openCredential, readCredentialKeyring, sealCredential} from '../server/portal/integrationCredentialCrypto.ts';
import {credentialVersionValues, credentialSlot, type CredentialClient} from '../server/portal/integrationCredentials.ts';
import {encryptGroupWebhook} from '../server/portal/larkGroupWebhook.ts';
import {migrateLegacyCredentials} from '../server/portal/legacyCredentialMigration.ts';

function maintenanceFixture(t: import('node:test').TestContext, options: Record<string,string> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'uper-maintenance-fixture-'));
  t.after(() => rmSync(directory, {recursive:true, force:true}));
  const file = join(directory, 'keys.json');
  const values = {
    PORTAL_ENV: 'dev', PORTAL_ENV_SOURCE: 'injected', TRIAL_DATASET: 'synthetic', PORTAL_LOCAL_CUTOVER: 'false',
    PORTAL_DEPLOYMENT: 'fixture', PORTAL_CREDENTIAL_KEYRING_FILE: file,
    MYSQL_TRIAL_URL: 'mysql://fixture:fixture@localhost/uper_trial_fixture',
    ...options,
  };
  const original = Object.fromEntries([...Object.keys(values), 'PORTAL_ENV_FILE', 'PORTAL_PACKAGE_ENV', 'PORTAL_BOOTSTRAP_SECRET_FILE']
    .map(key => [key, process.env[key]]));
  delete process.env.PORTAL_ENV_FILE;
  delete process.env.PORTAL_PACKAGE_ENV;
  delete process.env.PORTAL_BOOTSTRAP_SECRET_FILE;
  Object.assign(process.env, values);
  t.after(() => {
    for (const [key,value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  return file;
}

test('rewraps each legacy format with the environment keyring and leaves existing decisions intact', async t => {
  const file = maintenanceFixture(t, {
    PORTAL_ENROLLMENT_MAIL_CREDENTIAL_KEY: randomBytes(32).toString('hex'),
    LARK_WEBHOOK_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    LARK_TEST_SIGNATURE: 'fixture-signature',
  });
  writeFileSync(file, JSON.stringify({environment: 'dev', active: 'current', keys: {current: randomBytes(32).toString('hex')}}), {mode: 0o600});
  const password = 'synthetic-smtp-password';
  const webhook = new URL('12345678-1234-1234-1234-123456789abc', 'https://open.larksuite.com/open-apis/bot/v2/hook/').href;
  const account = (address: string) => ({
    address, host: 'smtp.larksuite.com', port: 465, encryptedPassword: sealMailPassword('dev', address, password),
  });
  const accounts = [account('fixture@example.test'), account('revoked@example.test'),
    {...account('bad@example.test'), encryptedPassword: 'invalid'}];
  const groups = [
    {id: 'fixture-group', config: {encryptedWebhook: encryptGroupWebhook('fixture-group', webhook),
      signingEnabled: true, signingSecretRef: 'LARK_TEST_SIGNATURE'}},
    {id: 'missing-signature', config: {encryptedWebhook: encryptGroupWebhook('missing-signature', webhook), signingEnabled: true}},
  ];
  const revoked = {revision: 1, managed: true};
  const states = new Map<string, any>([['smtp/revoked@example.test', revoked]]);
  const audits: unknown[][] = [];
  let writes = 0;
  const db: CredentialClient = {async query(sql, params = []) {
    const key = params.slice(1, 3).join('/');
    if (sql.includes('FROM enrollment_mail_configuration')) {
      assert.deepEqual(params, ['dev']);
      return {rows: [{revision: 1, config: {accounts}}]};
    }
    if (sql.includes('FROM notification_channels')) return {rows: groups};
    if (sql.includes('FROM access_state')) return {rows: [{value: {}}]};
    if (sql.startsWith('SELECT state FROM integration_credentials')) {
      const state = states.get(key);
      return {rows: state ? [{state}] : []};
    }
    if (sql.startsWith('INSERT INTO integration_credentials')) {
      writes++;
      if (!states.has(key)) states.set(key, params[3]);
      return {rows: []};
    }
    if (sql.startsWith('UPDATE integration_credentials')) {
      writes++;
      states.set(key, params[3]);
      return {rows: []};
    }
    if (sql.startsWith('INSERT INTO portal_audit')) {
      audits.push(params);
      return {rows: []};
    }
    throw Error('Unexpected migration query');
  }};
  let opens=0, closes=0;
  const loadStore=async()=>{
    opens++;
    return {pool:{end:async()=>{closes++;}},tx:async work=>work(db)};
  };
  await assert.rejects(runCredentialMaintenance('migrate', [], loadStore), /Specify --environment/);
  await assert.rejects(runCredentialMaintenance('migrate', ['--environment','test','--apply'], loadStore), /does not match/);
  assert.equal(opens,0);
  const {report: preview, blocked} = await runCredentialMaintenance('migrate', ['--environment','dev'], loadStore);
  assert.equal(preview.mode,'preview');
  assert.equal(blocked,true);
  assert.deepEqual(preview.smtp, {found: 3, eligible: 1, migrated: 0, retainedManaged: 1, retainedInactive: 0, blocked: 1});
  assert.equal(preview.larkGroup.eligible, 1);
  assert.equal(preview.larkGroup.blocked, 1);
  assert.equal(states.size, 1);
  assert.equal(audits.length, 0);
  assert.equal(writes,0);
  const {report: apply} = await runCredentialMaintenance('migrate', ['--environment','dev','--apply'], loadStore);
  assert.equal(apply.mode,'apply');
  assert.equal(apply.smtp.migrated, 1);
  assert.equal(apply.larkGroup.migrated, 1);
  assert.deepEqual(credentialVersionValues(credentialSlot('smtp', 'fixture@example.test'), states.get('smtp/fixture@example.test').active), {password});
  assert.deepEqual(credentialVersionValues(credentialSlot('lark-group', 'fixture-group'), states.get('lark-group/fixture-group').active),
    {webhook, signingKey: 'fixture-signature'});
  assert.equal(states.get('smtp/revoked@example.test'), revoked);
  assert.equal(audits.length, 2);
  assert.equal(JSON.stringify(audits).includes(password), false);
  assert.equal(JSON.stringify(audits).includes(webhook), false);
  const {report:repeat} = await runCredentialMaintenance('migrate', ['--environment','dev','--apply'], loadStore);
  assert.equal(repeat.smtp.migrated + repeat.larkGroup.migrated, 0);
  assert.equal(audits.length, 2);
  assert.equal(writes,4);
  assert.equal(closes,3);
  process.env.TRIAL_DATASET = 'local-crm';
  process.env.PORTAL_LOCAL_CUTOVER = 'true';
  const inactive = await migrateLegacyCredentials(db, 'dev', false);
  assert.equal(inactive.larkGroup.retainedInactive, 2);
  await assert.rejects(migrateLegacyCredentials(db, 'test', true), /environment mismatch/);
});

test('rotation defaults to preview and only rewraps older versions in the environment selected', async t => {
  const file = maintenanceFixture(t);
  const keys = {old:randomBytes(32).toString('hex'), next:randomBytes(32).toString('hex')};
  const configure = (active: keyof typeof keys, retained:Record<string,string>=keys, environment='dev') =>
    writeFileSync(file, JSON.stringify({environment, active, keys:retained}), {mode:0o600});
  configure('old');
  const oldRing=readCredentialKeyring();
  configure('next');
  const nextRing=readCredentialKeyring();
  const slot=credentialSlot('smtp','rotation-fixture');
  const ga=credentialSlot('ga','default');
  const version=(ring, scope, id, value)=>({
    id, target:'fixture-target', createdAt:'2026-01-01T00:00:00.000Z',
    sealed:sealCredential(ring,scope,id,'fixture-target',value),
  });
  const clear={password:'rotation-fixture-password'};
  const candidateClear={password:'rotation-fixture-candidate'};
  const original={revision:6,managed:true,active:version(oldRing,slot,'v1',clear),
    candidate:{...version(oldRing,slot,'v2',candidateClear),receipt:{outcome:'verified',scope:'fixture-scope',at:0}}};
  const alreadyNew={revision:2,managed:true,active:version(nextRing,ga,'v3',{key:'fixture-new'})};
  const states=new Map([
    ['dev/smtp/rotation-fixture',original],
    ['dev/ga/default',alreadyNew],
    ['test/ga/default',{revision:2,managed:true,active:{sealed:'other-environment'}}],
  ]);
  const before=structuredClone(states);
  let opens=0,writes=0;
  const db:CredentialClient={query:async(sql,params=[])=>{
    if(sql.startsWith('SELECT kind,resource,state')){
      assert.deepEqual(params,['dev']);
      return {rows:[...states].filter(([key])=>key.startsWith(params[0]+'/')).map(([key,state])=>{
        const [,kind,resource]=key.split('/');
        return {kind,resource,state};
      })};
    }
    assert.match(sql,/^UPDATE integration_credentials SET state/);
    assert.equal(params[0],'dev');
    states.set(params.slice(0,3).join('/'),params[3]);
    writes++;
    return {rows:[]};
  }};
  const load=async()=>{
    opens++;
    return {pool:{end:async()=>{}},tx:async work=>work(db)};
  };
  await assert.rejects(runCredentialMaintenance('rotate',['--apply'],load),/Specify --environment/);
  await assert.rejects(runCredentialMaintenance('rotate',['--environment','prod','--apply'],load),/does not match/);
  configure('next',keys,'test');
  await assert.rejects(runCredentialMaintenance('rotate',['--environment','dev','--apply'],load),/credential_keyring_environment/);
  assert.equal(opens,0);
  configure('next');
  assert.deepEqual((await runCredentialMaintenance('rotate',['--environment','dev'],load)).report,
    {environment:'dev',mode:'preview',verified:3,pending:2,rewrapped:0});
  assert.deepEqual(states,before);
  assert.equal(writes,0);
  configure('next',{next:keys.next});
  await assert.rejects(runCredentialMaintenance('rotate',['--environment','dev','--apply'],load),/credential_ciphertext_invalid/);
  assert.deepEqual(states,before);
  assert.equal(writes,0);
  configure('next');
  assert.deepEqual((await runCredentialMaintenance('rotate',['--environment','dev','--apply'],load)).report,
    {environment:'dev',mode:'apply',verified:3,pending:2,rewrapped:2});
  assert.equal(writes,1);
  const rotated=states.get('dev/smtp/rotation-fixture');
  assert.deepEqual({...rotated,active:{...rotated.active,sealed:original.active.sealed},
    candidate:{...rotated.candidate,sealed:original.candidate.sealed}},original);
  assert.deepEqual(openCredential(nextRing,slot,'v1',original.active.target,original.active.sealed),clear);
  assert.deepEqual(openCredential(nextRing,slot,'v1',rotated.active.target,rotated.active.sealed),clear);
  assert.deepEqual(openCredential(nextRing,slot,'v2',rotated.candidate.target,rotated.candidate.sealed),candidateClear);
  assert.deepEqual(states.get('test/ga/default'),before.get('test/ga/default'));
  assert.deepEqual(states.get('dev/ga/default'),alreadyNew);
  configure('next',{next:keys.next});
  assert.deepEqual((await runCredentialMaintenance('rotate',['--environment','dev','--apply'],load)).report,
    {environment:'dev',mode:'apply',verified:3,pending:0,rewrapped:0});
  assert.equal(writes,1);
});
