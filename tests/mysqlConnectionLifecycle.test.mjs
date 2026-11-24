import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {test} from 'node:test';

test('a MySQL session setup failure discards the checked-out connection', async t => {
  const key=Symbol.for('uper.mysqlSetupFailureFixture');
  const failure=new Error('setting session time zone failed');
  let discarded=0;
  globalThis[key]={
    getConnection:async()=>({
      query:async(sql)=>{
        assert.equal(sql,"SET time_zone='+00:00'");
        throw failure;
      },
      destroy:()=>{discarded++;},
      release:()=>assert.fail('Uninitialized session returned to pool'),
    }),
  };
  const hook=registerHooks({
    load(url,context,next) {
      if(url.endsWith('/cloud/mysql/database.mjs'))return {format:'module',shortCircuit:true,
        source:`export const openTrialDatabase=()=>globalThis[Symbol.for('uper.mysqlSetupFailureFixture')];
          export const withLock=()=>{throw Error('Unexpected migration');};`};
      return next(url,context);
    },
  });
  t.after(()=>{hook.deregister();delete globalThis[key];});
  const previous=process.env.MYSQL_TRIAL_URL;
  process.env.MYSQL_TRIAL_URL='mysql://fixture.invalid/fixture';
  t.after(()=>{if(previous===undefined)delete process.env.MYSQL_TRIAL_URL;else process.env.MYSQL_TRIAL_URL=previous;});
  const {connection}=await import('../cloud/mysql/runtime.mjs');
  await assert.rejects(connection(),error=>error===failure);
  assert.equal(discarded,1);
});
