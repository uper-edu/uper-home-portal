import test from 'node:test';
import assert from 'node:assert/strict';
import { instagramBioCampaign, INSTAGRAM_BIO_CAMPAIGN, linkHubConsultUrl } from '../src/utils/instagramBioCampaign';
import { campaignPromotionUrl, promotionInput, PROMOTION_EXPERIENCE } from '../src/utils/campaignPromotion';
import { ensureInstagramBioCampaign } from '../server/portal/campaignPresets';
import { firstTouchAttribution } from '../server/portal/attribution';

const at = '2026-11-02T00:00:00Z';
test('one preset campaign has immutable language entries and no invented schedule or spend', () => {
  const c = instagramBioCampaign(at);
  assert.equal(c.id, INSTAGRAM_BIO_CAMPAIGN); assert.equal(c.code, c.id);
  assert.notEqual(c.id, 'organic'); assert.equal(c.type, 'other');
  assert.equal(c.startDate, ''); assert.equal(c.endDate, ''); assert.equal(c.stats.budgetCost, null);
  assert.equal(c.promotionLinks?.length, 3);
  for (const link of c.promotionLinks!) assert.doesNotThrow(() => promotionInput(link));
});
test('distribution links use each current environment origin and open /link before /chat', () => {
  const c = instagramBioCampaign(at);
  for (const origin of ['http://localhost:3000', 'https://home.prototype.uperedu.com', 'https://www.uperedu.com']) {
    for (const link of c.promotionLinks!) {
      const bio = new URL(campaignPromotionUrl(c.code, link, origin));
      assert.equal(bio.origin, origin); assert.equal(bio.pathname, '/link');
      const chat = new URL(linkHubConsultUrl(bio.searchParams, link.language), origin);
      assert.equal(chat.origin, origin); assert.equal(chat.pathname, '/chat');
      for (const key of ['c', 'p', 'utm_source', 'utm_medium', 'utm_campaign', 'lang']) assert.equal(chat.searchParams.get(key), bio.searchParams.get(key));
      assert.equal(chat.searchParams.get('utm_medium'), 'social');
    }
  }
  const old = {id:'p_other', name:'Other', source:'instagram', medium:'paid_social', language:'en' as const, experience:PROMOTION_EXPERIENCE, createdAt:at};
  assert.equal(new URL(campaignPromotionUrl('ordinary', old, 'https://example.test')).pathname, '/chat');
});
test('language switching preserves the original promotion ID and does not repair mismatches', () => {
  const original = new URLSearchParams('c=instagram-bio&p=p_instagram_bio_id&utm_source=instagram&utm_medium=social&utm_campaign=instagram-bio');
  const before = original.toString();
  const next = new URL(linkHubConsultUrl(original, 'zh'), 'https://example.test');
  assert.equal(next.searchParams.get('p'), 'p_instagram_bio_id');
  assert.equal(next.searchParams.get('lang'), 'zh'); assert.equal(original.toString(), before);
  for (const source of ['c=instagram-bio&p=p_foreign', 'c=other&p=p_instagram_bio_id']) {
    const input = new URLSearchParams(source), output = new URL(linkHubConsultUrl(input, 'zh'), 'https://example.test');
    assert.equal(output.searchParams.get('p'), input.get('p')); assert.equal(output.searchParams.get('c'), input.get('c'));
  }
  const plain = new URL(linkHubConsultUrl(new URLSearchParams('redirect=https://other.test&lead=private'), 'zh'), 'https://example.test');
  assert.equal(plain.pathname, '/chat'); assert.equal(plain.searchParams.get('c'), INSTAGRAM_BIO_CAMPAIGN);
  assert.equal(plain.searchParams.get('p'), 'p_instagram_bio_zh');
  assert.equal(plain.searchParams.get('redirect'), null); assert.equal(plain.searchParams.get('lead'), null);
  const lead = {campaignId:'original',campaign:'Original'};
  assert.deepEqual(firstTouchAttribution(lead, {campaignId:INSTAGRAM_BIO_CAMPAIGN}), lead);
});
test('bare dedicated /link supplies Bio attribution in the consultation link; a plain /chat retains the existing organic default', () => {
  for (const lang of ['id','en','zh'] as const) {
    const next = new URL(linkHubConsultUrl(new URLSearchParams(), lang), 'https://example.test');
    assert.equal(next.searchParams.get('utm_source'),'instagram'); assert.equal(next.searchParams.get('utm_medium'),'social');
    assert.equal(next.searchParams.get('p'), 'p_instagram_bio_'+lang);
  }
  assert.deepEqual(firstTouchAttribution({}, {}), {campaign:'organic', campaignId:'organic'});
});
function database(initial?: any, alias?: string) {
  let saved = initial ? structuredClone(initial) : undefined;
  return { read: () => structuredClone(saved), query: async (sql: string, values: any[]) => {
    if (sql.startsWith('SELECT raw_code,campaign_id')) return {rows:alias?[{raw_code:INSTAGRAM_BIO_CAMPAIGN,campaign_id:alias}]:[]};
    if (sql.startsWith('INSERT INTO trial_campaigns')) { assert.match(sql, /ON DUPLICATE KEY UPDATE id=id$/); saved ??= {id:values[0],code:values[0],config:structuredClone(values[1])}; return {rowCount:1}; }
    if (sql.startsWith('SELECT id,code,config')) return {rows:saved?.id===values[0]&&saved?.code===values[0]?[saved]:[]};
    if (sql.startsWith('INSERT INTO campaign_promotion_index')) return {rowCount:1};
    if (sql.startsWith('SELECT campaign_id FROM campaign_promotion_index')) return {rows:[{campaign_id:saved.id}]};
    throw Error('Unexpected write or query');
  }};
}
test('repeated startup inserts once and preserves existing configuration, attribution entries and live counters', async () => {
  const db = database(); await ensureInstagramBioCampaign(db); const first = db.read();
  first.config.stats.impressions = 57; first.config.name = 'Instagram Bio updated';
  const existing = database(first);
  for (let i=0;i<10;i++) await ensureInstagramBioCampaign(existing);
  assert.deepEqual(existing.read(), first);
});
test('a conflicting reserved code or changed immutable promotion is never silently replaced', async () => {
  for (const config of [{name:'Historical'}, {...instagramBioCampaign(at),promotionLinks:[]}, {...instagramBioCampaign(at),code:'other'}]) {
    const initial = {id:INSTAGRAM_BIO_CAMPAIGN,code:INSTAGRAM_BIO_CAMPAIGN,config}, db=database(initial);
    await assert.rejects(ensureInstagramBioCampaign(db), /conflicts/); assert.deepEqual(db.read(), initial);
  }
});
test('an existing verified alias cannot be captured by the preset', async () => {
  const db = database(undefined, 'historical-campaign');
  await assert.rejects(ensureInstagramBioCampaign(db), /verified source alias/);
  assert.equal(db.read(), undefined);
});
