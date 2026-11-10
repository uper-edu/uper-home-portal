import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../cloud/mysql/system-defaults.json';
import {organicCampaignRecord} from '../src/utils/organicCampaign';
import {builtInRoles} from '../src/utils/accessControl';

test('new installations seed organic and evergreen campaigns and the finance role', () => {
  assert.deepEqual(data.campaigns.map(row => row.id), ['organic', 'social-bio']);
  assert.deepEqual(data.campaigns[0], organicCampaignRecord('SYSTEM_INITIALIZED_AT'));
  assert.equal(data.campaigns[1].systemManaged, true);
  assert.deepEqual(data.finance, builtInRoles.finance);
});
