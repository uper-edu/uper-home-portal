import test from 'node:test';
import assert from 'node:assert/strict';

process.env.PORT = '8080';
process.env.TRIAL_DATASET = 'synthetic';
process.env.MYSQL_TRIAL_URL = 'mysql://gate:gate@127.0.0.1:3306/uper_trial_gate_test';
const {pool} = await import('../server/portal/store.ts');
const {passwordChangeGate} = await import('../server/portal/localAuth.ts');

pool.query = async (sql: string) => {
  if (sql.includes('FROM crm_sessions')) return {rows: [{id: 'Monite', login_id: 'Monite', active: true, roles: [], teams: []}]};
  if (sql.includes('FROM access_roles')) return {rows: []};
  if (sql.includes('FROM access_state') && sql.includes('restore_review')) return {rows: []};
  if (sql.includes('FROM access_state')) return {rows: [{value: {required: true}}]};
  throw Error('Unexpected query: ' + sql);
};

function call(path: string) {
  return new Promise<any>(resolve => {
    const req = {method: 'GET', path, headers: {cookie: 'uper_crm_session_8080=' + 'a'.repeat(64)}};
    const res = {
      status(code: number) { this.statusCode = code; return this; },
      json(body: any) { resolve({status: this.statusCode, body}); },
    };
    passwordChangeGate(req, res, () => resolve({status: 200}));
  });
}

test('temporary password gate does not block public visitor APIs', async () => {
  assert.equal((await call('/portal/session')).status, 200);
});

test('temporary password gate still blocks CRM APIs', async () => {
  const result = await call('/crm/leads');
  assert.equal(result.status, 403);
  assert.equal(result.body.error, 'password_change_required');
});
