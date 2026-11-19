import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTrialDatabase, transaction, withLock } from '../database.mjs';

test('Windows local cutover accepts only the explicitly selected loopback database', () => {
  const env={PORTAL_ENV:'dev',APP_ENV:'local',PORTAL_DEPLOYMENT:'local-dev',TRIAL_DATASET:'local-crm',PORTAL_LOCAL_CUTOVER:'true',MYSQL_TRIAL_URL:'mysql://test:strong-password@127.0.0.1:3306/uper_local_crm'};
  assert.equal(validateTrialDatabase(env,'win32').name,'uper_local_crm');
  for(const change of [{PORTAL_ENV:'prod'},{APP_ENV:'production'},{PORTAL_DEPLOYMENT:'production'},{PORTAL_LOCAL_CUTOVER:'false'},{MYSQL_TRIAL_URL:env.MYSQL_TRIAL_URL.replace('127.0.0.1','10.0.0.1')},{MYSQL_TRIAL_URL:env.MYSQL_TRIAL_URL.replace(':3306',':3307')},{MYSQL_TRIAL_URL:env.MYSQL_TRIAL_URL.replace('uper_local_crm','uper_trial_other')},{MYSQL_TRIAL_SOCKET:'/unexpected/socket'}]) {
    assert.throws(()=>validateTrialDatabase({...env,...change},'win32'));
  }
  assert.throws(()=>validateTrialDatabase(env,'darwin'));
  assert.equal(validateTrialDatabase({...env,MYSQL_TRIAL_URL:env.MYSQL_TRIAL_URL.replace('127.0.0.1','localhost'),MYSQL_TRIAL_SOCKET:'/private/tmp/uper-crm-mysql-local3000.sock'},'darwin').name,'uper_local_crm');
});

test('trial database refuses existing local CRM and implicit fallbacks', () => {
  for (const name of ['uper_portal', 'mysql', 'uper_trial_', 'production']) {
    assert.throws(() => validateTrialDatabase({TRIAL_DATASET:'synthetic',MYSQL_TRIAL_URL:`mysql://test:test@localhost/${name}`}));
  }
  assert.throws(() => validateTrialDatabase({DATABASE_URL:'mysql://test:test@localhost/uper_trial_test'}));
  assert.equal(validateTrialDatabase({TRIAL_DATASET:'synthetic',MYSQL_TRIAL_URL:'mysql://test:test@localhost/uper_trial_test'}).name,'uper_trial_test');
  assert.equal(validateTrialDatabase({PORTAL_ENV:'prod',PORTAL_DEPLOYMENT:'production',TRIAL_DATASET:'synthetic',MYSQL_TRIAL_URL:'mysql://Home:password@10.20.0.9:3306/prod_uper_trial_home'}).name,'prod_uper_trial_home');
  assert.throws(() => validateTrialDatabase({PORTAL_ENV:'prod',PORTAL_DEPLOYMENT:'production',TRIAL_DATASET:'synthetic',MYSQL_TRIAL_URL:'mysql://Home:password@10.20.0.9:3306/uper_trial_home'}));
});
test('transaction failure rolls back and always returns its connection', async () => {
  const calls=[];
  const connection={query:async()=>{},beginTransaction:async()=>calls.push('begin'),commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>calls.push('release')};
  await assert.rejects(transaction({getConnection:async()=>connection},async()=>{throw Error('injected failure')}),/injected/);
  assert.deepEqual(calls,['begin','rollback','release']);
});
test('a failed lock release destroys the session instead of leaking a lock into the pool', async () => {
  const calls=[];
  const connection={execute:async sql=>{
    if(sql.includes('GET_LOCK')) return [[{acquired:1}]];
    throw Error('lost connection');
  },destroy:()=>calls.push('destroy'),release:()=>calls.push('release')};
  assert.equal(await withLock({getConnection:async()=>connection},'synthetic-conversation',async()=>42),42);
  assert.deepEqual(calls,['destroy']);
});
test('a busy conversation never enters the protected operation', async () => {
  let entered=false,released=false;
  const connection={execute:async()=>[[{acquired:0}]],release:()=>released=true};
  await assert.rejects(withLock({getConnection:async()=>connection},'same-chat',async()=>entered=true),/busy/);
  assert.equal(entered,false);assert.equal(released,true);
});
