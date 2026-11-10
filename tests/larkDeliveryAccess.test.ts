import assert from 'node:assert/strict';
import test from 'node:test';
import { larkTestGroupDisallowed } from '../server/portal/larkDeliveryAccess.ts';

const trial = {
  PORTAL_DEPLOYMENT: 'company-trial',
  NODE_ENV: 'production',
  LARK_TEST_GROUP: 'CRM_Leads_Update',
};

test('company test allows only its designated group', () => {
  assert.equal(larkTestGroupDisallowed(trial, 'CRM_Leads_Update'), false);
  assert.equal(larkTestGroupDisallowed(trial, 'other-group'), true);
});

test('test group delivery fails closed with an empty channel configuration', () => {
  assert.equal(larkTestGroupDisallowed({ ...trial, LARK_TEST_GROUP: '' }, 'other-group'), true);
  assert.equal(larkTestGroupDisallowed({ ...trial, LARK_TEST_GROUP: '' }, ''), true);
});

test('production group notifications retain existing routing without a test allowlist', () => {
  const env = { PORTAL_DEPLOYMENT: 'production', NODE_ENV: 'production', APP_ENV: 'production' };
  assert.equal(larkTestGroupDisallowed(env, 'live-group'), false);
});
