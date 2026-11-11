import assert from 'node:assert/strict';
import test from 'node:test';

// Import the account initializer with a deliberately unusable database destination.
// Every query is handled by operationContext below; an accidental real query fails.
Object.assign(process.env, {
  APP_ENV:'test', TRIAL_DATASET:'synthetic', PORTAL_DEPLOYMENT:'local', PORTAL_ENV:'dev',
  MYSQL_TRIAL_URL:'mysql://synthetic:unused@localhost/uper_trial_defaults_mock',
  MYSQL_TRIAL_SOCKET:'/private/tmp/uper-defaults-no-database.sock',
  ACCESS_ALLOW_TEST_PASSWORDS:'true', ACCESS_REQUIRE_INITIAL_PASSWORD_CHANGE:'false',
});
const {initializeAccessAccounts} = await import('../server/portal/accessManagement.ts');
const {operationContext} = await import('../server/portal/operationContext.ts');
const {nativePool} = await import('../cloud/mysql/runtime.mjs');
test.after(async () => {await nativePool.end();});

function fixture() {
  const state = {policy:null as any,restore:false,roles:new Map<string,any>(),users:new Map<string,any>(),audits:0};
  const db = {query:async (sql:string,v:any[] = []) => {
    if (sql === "SELECT value FROM access_state WHERE id='restore_review'") return {rows:state.restore?[{value:{required:true}}]:[]};
    if (sql.startsWith('INSERT INTO access_state')) {state.policy ??= JSON.parse(v[0]);}
    else if (sql === "SELECT value FROM access_state WHERE id='policy' FOR UPDATE") return {rows:[{value:state.policy}]};
    else if (sql.startsWith('INSERT INTO access_roles')) {
      if (!state.roles.has(v[0])) state.roles.set(v[0],JSON.parse(v[1]));
    } else if (sql === 'SELECT id FROM crm_users WHERE id=:p1') return {rows:state.users.has(v[0])?[{id:v[0]}]:[]};
    else if (sql.startsWith('INSERT INTO crm_users')) {
      if (!state.users.has(v[0])) state.users.set(v[0],{id:v[0],password_hash:v[1],roles:JSON.parse(v[2]),teams:JSON.parse(v[3]),active:true});
    } else if (sql === "SELECT * FROM crm_users WHERE id='Robert' FOR UPDATE") return {rows:[state.users.get('Robert')]};
    else if (sql.startsWith('UPDATE crm_users SET roles')) state.users.get('Robert').roles = JSON.parse(v[0]);
    else if (sql.startsWith('DELETE FROM crm_sessions')) {}
    else if (sql.startsWith('UPDATE access_state')) state.policy = JSON.parse(v[0]);
    else if (sql.startsWith('INSERT INTO portal_audit')) state.audits++;
    else assert.fail('Unexpected query: ' + sql);
    return {rows:[]};
  }};
  return {state,run:() => operationContext.run(db,initializeAccessAccounts)};
}

test('new account initialization creates the existing nine-account roster with hashed passwords', async () => {
  const f = fixture();
  await f.run();
  assert.equal(f.state.users.size,9);
  assert.equal(f.state.roles.size,6);
  assert.ok(f.state.users.get('Robert').roles.includes('access_admin'));
  assert.ok(f.state.users.get('Suki').roles.includes('finance'));
  for (const user of f.state.users.values()) assert.match(user.password_hash,/^[a-f0-9]{32}:[a-f0-9]{128}$/);
  // Saved permissions and credentials must survive a restart, including deliberate revocations.
  f.state.users.get('Suki').roles = ['sales'];
  f.state.users.get('Robert').roles = ['sales'];
  f.state.users.get('Robert').password_hash = 'saved-password-hash';
  f.state.users.get('Fadhil').active = false;
  f.state.roles.get('sales').grants = {'crm.read':'own'};
  const saved = structuredClone(f.state);
  await f.run();
  assert.deepEqual(f.state,saved);
});

test('restore-review protection prevents all account initialization writes', async () => {
  const f = fixture();
  f.state.restore = true;
  const saved = structuredClone(f.state);
  await f.run();
  assert.deepEqual(f.state,saved);
});
