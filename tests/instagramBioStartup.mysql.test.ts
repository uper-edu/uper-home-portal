import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import test from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {openTrialDatabase} from '../cloud/mysql/database.mjs';
import {migrate} from '../cloud/mysql/migrate.mjs';
import {campaignPromotionPath} from '../src/utils/campaignPromotion';
import {instagramBioCampaign} from '../src/utils/instagramBioCampaign';
import {setupNativeTest} from './helpers/mysql.mjs';
import {disposeNativeTest} from './helpers/disposeNativeTest.mjs';

test('fresh installs and process restarts retire the Instagram Bio seed and preserve historical attribution', {
  skip: !process.env.MYSQL_NATIVE_TEST_ENV,
}, async () => {
  const fixture = await setupNativeTest('instagram_bio_startup', {initializeSystemDefaults:true});
  const db = await openTrialDatabase(process.env);
  const campaign = instagramBioCampaign('2026-11-02T00:00:00.000Z');
  campaign.stats.impressions = 17;
  const links = campaign.promotionLinks!;
  const origin = createServer().listen(0, '127.0.0.1');
  await once(origin, 'listening');
  const address = origin.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>(resolve => origin.close(() => resolve()));
  const base = 'http://127.0.0.1:' + port;

  async function withApplication(check: () => Promise<void>) {
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
      "import {startMysqlApplication} from './server/mysqlApplication.ts'; await startMysqlApplication();"], {
      env: {...process.env, PORT:String(port), PLATFORM_MODE:'local', APP_URL:base, PORTAL_WORKER_ENABLED:'false'},
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const closed = once(child, 'close');
    let logs = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { logs += String(chunk); });
    try {
      for (let attempt = 0; attempt < 100 && child.exitCode === null && !logs.includes('app.ready'); attempt++) {
        await delay(100);
      }
      assert.match(logs, /app\.ready/, logs);
      await check();
    } finally {
      child.kill('SIGTERM');
      await closed;
    }
  }

  const read = async (sql: string) => (await db.query(sql))[0];
  const historicalRows = () => Promise.all([
    read("SELECT * FROM trial_campaigns WHERE id='instagram-bio'"),
    read("SELECT * FROM campaign_promotion_index WHERE campaign_id='instagram-bio' ORDER BY p"),
    read("SELECT * FROM portal_leads WHERE id='historical-instagram-lead'"),
    read("SELECT * FROM campaign_source_reviews WHERE id='historical-instagram-source'"),
  ]);
  try {
    assert.deepEqual(await read("SELECT id FROM trial_campaigns ORDER BY id"), [{id:'organic'}, {id:'social-bio'}]);
    for (let startup = 0; startup < 2; startup++) {
      await withApplication(async () => {
        assert.deepEqual(await read("SELECT id FROM trial_campaigns ORDER BY id"), [{id:'organic'}, {id:'social-bio'}]);
        assert.equal((await fetch(base + '/s/' + links[0].id, {redirect:'manual'})).status, 404);
      });
    }

    await db.execute('INSERT INTO trial_campaigns(id,code,config) VALUES(?,?,?)',
      [campaign.id, campaign.code, JSON.stringify(campaign)]);
    await db.execute('INSERT INTO portal_leads(id,business_number,profile) VALUES(?,?,?)',
      ['historical-instagram-lead', 'TEST-IG-001', JSON.stringify({
        campaignId:campaign.id, promotionLinkId:links[0].id, promotionSnapshot:links[0],
      })]);
    await db.execute('INSERT INTO campaign_source_reviews(id,raw_code,status,campaign_id,config) VALUES(?,?,?,?,?)',
      ['historical-instagram-source', 'old-instagram-alias', 'linked', campaign.id, '{}']);
    await migrate(db, fixture.name);
    const before = await historicalRows();
    assert.deepEqual(before.map(rows => rows.length), [1, 3, 1, 1]);
    await withApplication(async () => {
      for (const link of links) {
        const response = await fetch(base + '/s/' + link.id, {redirect:'manual'});
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), campaignPromotionPath(link, campaign.code));
        const verified = await fetch(base + '/api/promotion-links/' + link.id);
        assert.equal((await verified.json()).promotion.campaignId, campaign.id);
      }
      assert.deepEqual(await historicalRows(), before);
      const wrong = {...campaign, id:'wrong-owner', code:'wrong-owner', promotionLinks:[links[0]]};
      await db.execute('INSERT INTO trial_campaigns(id,code,config) VALUES(?,?,?)',
        [wrong.id, wrong.code, JSON.stringify(wrong)]);
      await db.execute('UPDATE campaign_promotion_index SET campaign_id=? WHERE p=?', [wrong.id, links[0].id]);
      assert.equal((await fetch(base + '/s/' + links[0].id, {redirect:'manual'})).status, 404);
    });
  } finally {
    await db.end();
    await disposeNativeTest(fixture);
  }
});
