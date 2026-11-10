import assert from 'node:assert/strict';
import test from 'node:test';
import { larkTestDeliveryRestriction } from '../server/portal/larkDeliveryAccess.ts';

const trial = {
  PORTAL_DEPLOYMENT: 'company-trial',
  NODE_ENV: 'production',
  LARK_TEST_GROUP: 'CRM_Leads_Update',
  LARK_TEST_PERSONAL_EMPLOYEE_IDS: 'staff-a, staff-b',
};

test('test group and allowed employee can both send with the same configuration', () => {
  assert.equal(larkTestDeliveryRestriction(trial, 'CRM_Leads_Update', null), undefined);
  assert.equal(larkTestDeliveryRestriction(trial, 'personal:staff-a', 'staff-a'), undefined);
  assert.equal(larkTestDeliveryRestriction(trial, 'personal:staff-b', 'staff-b'), undefined);
});

test('restricted delivery rejects other groups, unlisted employees and an empty personal list', () => {
  assert.equal(larkTestDeliveryRestriction(trial, 'staff-a', null), 'group');
  assert.equal(larkTestDeliveryRestriction(trial, 'personal:CRM_Leads_Update', 'CRM_Leads_Update'), 'personal');
  assert.equal(larkTestDeliveryRestriction(trial, 'personal:staff-a-extra', 'staff-a-extra'), 'personal');
  assert.equal(larkTestDeliveryRestriction({ ...trial, LARK_TEST_PERSONAL_EMPLOYEE_IDS: '' }, 'personal:staff-a', 'staff-a'), 'personal');
  assert.equal(larkTestDeliveryRestriction(trial, 'personal:', ''), 'personal');
});

test('production notifications retain existing routing without test allowlists', () => {
  const env = { PORTAL_DEPLOYMENT: 'production', NODE_ENV: 'production', APP_ENV: 'production' };
  assert.equal(larkTestDeliveryRestriction(env, 'live-group', null), undefined);
  assert.equal(larkTestDeliveryRestriction(env, 'personal:staff-c', 'staff-c'), undefined);
});
