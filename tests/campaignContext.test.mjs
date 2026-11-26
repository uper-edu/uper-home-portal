import assert from 'node:assert/strict';
import test from 'node:test';
import {campaignContextMiddleware, campaignsContext} from '../cloud/mysql/campaign-context.mjs';

test('public enrollment and Chat reads proceed without loading campaign rows', async () => {
  let queries = 0;
  const middleware = campaignContextMiddleware({query: async () => {
    queries++;
    throw new Error('Campaign storage unavailable');
  }});
  for (const path of ['/enrollment/classes', '/enrollment/availability', '/portal/session']) {
    for (const method of ['GET', 'HEAD']) {
      let calls = 0;
      await middleware({method, path}, null, error => {
        calls++;
        assert.equal(error, undefined);
        assert.equal(campaignsContext.getStore(), undefined);
      });
      assert.equal(calls, 1);
    }
  }
  assert.equal(queries, 0);
});

test('campaign readers and writes retain the request-scoped campaign list', async () => {
  let queries = 0;
  const campaign = {id:'fixture-campaign', code:'fixture-source'};
  const middleware = campaignContextMiddleware({query: async sql => {
    queries++;
    assert.equal(sql, 'SELECT config FROM trial_campaigns ORDER BY created_at DESC');
    return {rows:[{config:campaign}]};
  }});
  const requests = [
    {method:'GET', path:'/campaigns'},
    {method:'GET', path:'/crm/campaigns/fixture-source'},
    {method:'POST', path:'/crm/leads/fixture/attendance'},
    {method:'POST', path:'/portal/conversations'},
    {method:'POST', path:'/enrollment/classes'},
  ];
  for (const request of requests) {
    const downstream = await new Promise((resolve, reject) => {
      middleware(request, null, error => {
        if (error) reject(error);
        else resolve(Promise.resolve().then(() => campaignsContext.getStore()));
      });
    });
    assert.deepEqual(downstream, [campaign]);
  }
  assert.equal(queries, requests.length);
  assert.equal(campaignsContext.getStore(), undefined);
});
