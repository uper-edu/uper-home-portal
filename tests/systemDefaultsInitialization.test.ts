import assert from 'node:assert/strict';
import test from 'node:test';
import {initializeSystemDefaults} from '../cloud/mysql/system-defaults.mjs';

// All records live in memory. No database connection, account or external send is used.
function fixture() {
  let state = {campaigns:new Map<string, any>(), roles:new Map<string, any>(),
    courses:new Map<string, any>(), channels:new Map<string, any>(), index:new Map<string, string>()};
  let snapshot:typeof state;
  const db = {
    beginTransaction:async () => {snapshot = structuredClone(state);},
    commit:async () => {},
    rollback:async () => {state = snapshot;},
    execute:async (sql:string, v:any[] = []):Promise<any[]> => {
      if (sql.startsWith('SELECT campaign_id FROM campaign_source_reviews')) return [[]];
      if (sql.startsWith('INSERT INTO trial_campaigns')) {
        if (!state.campaigns.has(v[0])) state.campaigns.set(v[0], {id:v[0],code:v[1],config:JSON.parse(v[2])});
      } else if (sql.startsWith('SELECT id,code,config FROM trial_campaigns')) {
        return [[...state.campaigns.values()].filter(r => r.id === v[0] || r.code === v[1])];
      } else if (sql.startsWith('UPDATE trial_campaigns SET config')) {
        state.campaigns.get(v[1]).config = JSON.parse(v[0]);
      } else if (sql.startsWith('INSERT INTO access_roles')) {
        if (!state.roles.has(v[0])) state.roles.set(v[0], JSON.parse(v[1]));
      } else if (sql.startsWith('SELECT id,config FROM notification_channels')) {
        return [[...state.channels].map(([id,config]) => ({id,config}))];
      } else if (sql.startsWith('SELECT config FROM notification_rules')) return [[]];
      else if (sql.startsWith('INSERT INTO notification_channels')) {
        if (!state.channels.has(v[0])) state.channels.set(v[0], JSON.parse(v[1]));
      } else if (sql.startsWith('UPDATE notification_channels')) state.channels.set(v[1], JSON.parse(v[0]));
      else if (sql.startsWith('SELECT id FROM crm_courses')) {
        return [[...state.courses].filter(([id,c]) => id === v[0] || c.name === v[1]).map(([id]) => ({id}))];
      } else if (sql.startsWith('INSERT INTO crm_courses')) state.courses.set(v[0], JSON.parse(v[1]));
      else if (sql.startsWith('INSERT INTO campaign_promotion_index')) {
        assert.ok(!state.index.has(v[0]));
        state.index.set(v[0],v[1]);
      } else assert.fail('Unexpected query: ' + sql);
      return [];
    },
    query:async (sql:string):Promise<any[]> => {
      if (sql === 'SELECT id,code,config FROM trial_campaigns FOR UPDATE') return [[...state.campaigns.values()]];
      if (sql === 'SELECT p,campaign_id FROM campaign_promotion_index FOR UPDATE')
        return [[...state.index].map(([p,campaign_id]) => ({p,campaign_id}))];
      assert.fail('Unexpected query: ' + sql);
    },
  };
  return {db, get state() {return state;}};
}

test('fresh defaults create two campaigns, ten indexed links and eight courses; repeat changes nothing', async () => {
  const f = fixture();
  await initializeSystemDefaults(f.db);
  assert.equal(f.state.campaigns.size,2);
  assert.equal(f.state.index.size,10);
  assert.equal(f.state.courses.size,8);
  assert.deepEqual(f.state.roles.get('finance').grants, {'crm.read':'all','crm.payments.verify':'all'});
  const saved = structuredClone(f.state);
  await initializeSystemDefaults(f.db);
  assert.deepEqual(f.state,saved);
});

test('repeat defaults preserve saved prices, publication, discounts, roles, campaign statistics and channel mode', async () => {
  const f = fixture();
  await initializeSystemDefaults(f.db);
  const course = f.state.courses.values().next().value;
  Object.assign(course, {price:123456, active:false, maxDiscountBps:750, maxDiscountAmount:30000});
  f.state.roles.get('finance').grants = {'crm.read':'own'};
  f.state.campaigns.get('social-bio').config.stats.impressions = 137;
  Object.assign(f.state.channels.values().next().value,{mode:'simulation',maxPerHour:53});
  const saved = structuredClone(f.state);
  await initializeSystemDefaults(f.db);
  assert.deepEqual(f.state,saved);
});

test('reserved campaign identity conflict rolls back rather than overwriting existing records', async () => {
  const f = fixture();
  f.state.campaigns.set('custom', {id:'custom',code:'social-bio',config:{id:'custom',code:'social-bio'}});
  const saved = structuredClone(f.state);
  await assert.rejects(initializeSystemDefaults(f.db), /reserved identity conflict/);
  assert.deepEqual(f.state,saved);
});
