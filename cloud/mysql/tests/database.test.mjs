import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTrialDatabase, transaction, withLock } from '../database.mjs';

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
