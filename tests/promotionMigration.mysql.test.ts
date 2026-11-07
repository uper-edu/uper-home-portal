import assert from 'node:assert/strict';
import test from 'node:test';
import { openTrialDatabase } from '../cloud/mysql/database.mjs';
import { migrate } from '../cloud/mysql/migrate.mjs';
import { setupNativeTest } from './helpers/mysql.mjs';
import { disposeNativeTest } from './helpers/disposeNativeTest.mjs';
import { instagramBioCampaign } from '../src/utils/instagramBioCampaign';

test('promotion migration preflight, interrupted backfill and re-upgrade preserve campaign data', {
  skip: !process.env.MYSQL_NATIVE_TEST_ENV,
}, async () => {
  const fixture = await setupNativeTest('promotion_migration');
  const db = await openTrialDatabase(process.env);
  try {
    const campaign = instagramBioCampaign();
    const other = { ...campaign, id:'other', code:'other' };
    await db.query('DROP TABLE campaign_promotion_index');
    await db.query('DELETE FROM trial_schema_versions WHERE version=17');
    // The fixture already applied the real COS v16 migration; keep its schema and marker.
    const [cosVersion] = await db.query("SELECT state FROM trial_schema_versions WHERE version=16");
    assert.equal(cosVersion[0]?.state,'ready');
    const [mediaColumns] = await db.query('SHOW COLUMNS FROM cms_media');
    assert.ok(mediaColumns.some((column: any)=>column.Field==='cos_url'));
    for (const config of [campaign, other]) {
      await db.execute('INSERT INTO trial_campaigns(id,code,config) VALUES(?,?,?)',
        [config.id,config.code,JSON.stringify(config)]);
    }
    const run = () => migrate(db, fixture.name, {initializeSystemDefaults:false});
    await assert.rejects(run, /Duplicate promotion link ID/);
    const count = async (sql: string) => Number((await db.query(sql))[0][0].n);
    assert.equal(await count('SELECT COUNT(*) n FROM trial_schema_versions WHERE version=17'), 0);
    assert.equal(await count("SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='campaign_promotion_index'"), 0);
    await db.execute('UPDATE trial_campaigns SET config=? WHERE id=?',[JSON.stringify({...other,promotionLinks:[]}),other.id]);
    const snapshot = async () => JSON.stringify((await db.query('SELECT id,config FROM trial_campaigns ORDER BY id'))[0]);
    const before = await snapshot();
    assert.equal((await run()).version,19);
    assert.equal(await count('SELECT COUNT(*) n FROM campaign_promotion_index'),3);
    assert.equal(await count('SELECT COUNT(*) n FROM campaign_promotion_short_links'),0);
    assert.equal(await snapshot(), before);
    assert.equal(await count("SELECT COUNT(*) n FROM trial_schema_versions WHERE version=16 AND state='ready'"),1);
    assert.equal((await run()).alreadyApplied,true);

    // A reverted v15 writer can append a link in the original JSON.
    const extra = {...campaign.promotionLinks![0],id:'legacy_after_rollback'};
    await db.execute('UPDATE trial_campaigns SET config=? WHERE id=?',[JSON.stringify({...other,promotionLinks:[extra]}),other.id]);
    await run();
    assert.equal(await count('SELECT COUNT(*) n FROM campaign_promotion_index'),4);
    const shortCodes=async()=>(await db.query('SELECT p,short_code FROM campaign_promotion_short_links ORDER BY p'))[0];
    const mappings=await shortCodes();
    assert.equal(mappings.length,1);
    assert.equal(mappings[0].p,extra.id);
    assert.match(mappings[0].short_code,/^[a-z2-9]{6}$/);

    await db.query("UPDATE trial_schema_versions SET state='applying' WHERE version=17");
    await db.query("UPDATE campaign_promotion_index SET campaign_id='other' WHERE p='p_instagram_bio_en'");
    await assert.rejects(run,/ownership mismatch/);
    assert.equal(await count("SELECT COUNT(*) n FROM trial_schema_versions WHERE version=17 AND state='applying'"),1);
    await db.query("UPDATE campaign_promotion_index SET campaign_id='instagram-bio' WHERE p='p_instagram_bio_en'");
    await run();
    assert.equal(await count("SELECT COUNT(*) n FROM trial_schema_versions WHERE version=17 AND state='ready'"),1);
    assert.equal(await count('SELECT COUNT(*) n FROM campaign_promotion_index'),4);
    assert.deepEqual(await shortCodes(),mappings);
  } finally {
    await db.end();
    await disposeNativeTest(fixture);
  }
});
