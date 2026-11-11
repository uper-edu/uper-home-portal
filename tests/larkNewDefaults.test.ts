import assert from 'node:assert/strict';
import test from 'node:test';
import defaults from '../src/data/system-defaults/index.ts';
import {initializeSystemDefaults} from '../cloud/mysql/system-defaults.mjs';
import {systemCampaignDefaults} from '../cloud/mysql/system-campaign-defaults.mjs';
import {planGroupChannelTest, sendGroupChannelTest} from '../server/portal/larkGroupChannelTest';
import {planPersonalChannelTest, sendPersonalChannelTest} from '../server/portal/larkPersonalChannelTest';

function initializationFixture(savedGroups: {id:string; config:any}[] = []) {
  const groups = structuredClone(savedGroups);
  const campaigns = systemCampaignDefaults('2026-11-10T00:00:00.000Z');
  const execute = async (sql:string, values:any[] = []):Promise<any[]> => {
    if (sql.startsWith('SELECT campaign_id FROM campaign_source_reviews')) return [[]];
    if (sql.startsWith('SELECT id,code,config FROM trial_campaigns')) {
      const campaign = campaigns.find(row => row.id === values[0]);
      return [[{id:campaign.id, code:campaign.code, config:campaign}]];
    }
    if (sql.startsWith('SELECT id,config FROM notification_channels')) return [groups];
    if (sql.startsWith("SELECT config FROM notification_rules")) return [[]];
    if (sql.startsWith('SELECT id FROM crm_courses')) return [[]];
    if (sql.startsWith('INSERT INTO notification_channels')) {
      groups.push({id:values[0], config:JSON.parse(values[1])});
      return [];
    }
    if (/^INSERT INTO (trial_campaigns|access_roles|crm_courses|campaign_promotion_index)\(/.test(sql)) return [];
    assert.fail('Unexpected initialization query: ' + sql);
  };
  const db = {
    execute,
    query: async (sql:string) => {
      if (sql === 'SELECT id,code,config FROM trial_campaigns FOR UPDATE')
        return [campaigns.map(config => ({id:config.id, code:config.code, config}))];
      if (sql === 'SELECT p,campaign_id FROM campaign_promotion_index FOR UPDATE') return [[]];
      assert.fail('Unexpected initialization query: ' + sql);
    },
    beginTransaction:async () => {},
    commit:async () => {},
    rollback:async () => {},
  };
  return {db, groups};
}

test('new system group is live and repeated initialization keeps that channel', async () => {
  const {db, groups} = initializationFixture();
  await initializeSystemDefaults(db);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].config.mode, 'live');
  const saved = structuredClone(groups);
  await initializeSystemDefaults(db);
  assert.deepEqual(groups, saved);
});

for (const mode of ['simulation', 'live']) {
  test('initialization preserves existing group ' + mode + ' mode, destination and signing', async () => {
    const saved = [{id:'existing-system', config:{
      groupName:'Lark 群通知', systemManaged:true, mode,
      secretRef:'LARK_EXISTING_GROUP', signingEnabled:true,
      signingSecretRef:'LARK_EXISTING_SIGNING', maxPerHour:57,
    }}];
    const {db, groups} = initializationFixture(saved);
    await initializeSystemDefaults(db);
    await initializeSystemDefaults(db);
    assert.deepEqual(groups, saved);
  });
}

test('new live defaults reach only injected transports and keep their own recipients', async () => {
  const env = {
    PORTAL_ENV:'test', PORTAL_DEPLOYMENT:'company-trial',
    LARK_GROUP_CRM:'https://open.larksuite.com/open-apis/bot/v2/hook/synthetic-default',
    LARK_APP_ID:'cli_fixture', LARK_APP_SECRET:'synthetic-secret',
  };
  const uuid = '64a07b72-8466-44fe-b75d-a1e722237f89';
  const groups:string[] = [];
  const personal:string[] = [];
  const groupPlan = planGroupChannelTest('default-group', {
    ...defaults.crmLarkBot, secretRef:'LARK_GROUP_CRM',
  }, env);
  assert.equal(groupPlan.simulated, false);
  assert.equal(await sendGroupChannelTest(groupPlan, uuid, async destination => {
    groups.push(String(destination));
    return Response.json({code:0});
  }), 'accepted');
  const binding = {appId:'cli_fixture', openId:'ou_fixture', revision:1, updatedAt:''};
  const personalPlan = planPersonalChannelTest(defaults.larkPersonalChannel, binding, env);
  assert.equal(personalPlan.simulated, false);
  assert.equal(await sendPersonalChannelTest(personalPlan, uuid, {send:async (recipient, _message, _uuid, mode) => {
    assert.equal(mode, 'live');
    personal.push(recipient);
    return Response.json({code:0});
  }}), 'accepted');
  assert.deepEqual(groups, [env.LARK_GROUP_CRM]);
  assert.deepEqual(personal, ['ou_fixture']);
});
