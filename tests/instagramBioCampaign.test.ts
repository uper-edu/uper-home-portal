import test from 'node:test';
import assert from 'node:assert/strict';
import { instagramBioCampaign, INSTAGRAM_BIO_CAMPAIGN, linkHubConsultUrl } from '../src/utils/instagramBioCampaign';
import { campaignPromotionUrl, promotionInput, PROMOTION_EXPERIENCE } from '../src/utils/campaignPromotion';
import { presetPromotionOwner } from '../cloud/mysql/promotion-short-links.mjs';
import { firstTouchAttribution } from '../server/portal/attribution';

const at = '2026-11-02T00:00:00Z';
test('the historical campaign fixture has immutable language entries and no invented schedule or spend', () => {
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
      const bio = new URL(campaignPromotionUrl(link, origin, c.code));
      assert.equal(bio.origin, origin); assert.equal(bio.pathname, '/link');
      const chat = new URL(linkHubConsultUrl(bio.searchParams, link.language), origin);
      assert.equal(chat.origin, origin); assert.equal(chat.pathname, '/chat');
      assert.equal(bio.searchParams.get('p'), link.id);
      assert.equal(bio.searchParams.get('lang'), link.language);
      assert.equal(bio.searchParams.get('utm_campaign'), c.code);
      assert.equal(bio.searchParams.has('c'), false);
      assert.equal(chat.searchParams.get('p'), link.id);
      assert.equal(chat.searchParams.get('lang'), link.language);
    }
  }
  const old = {id:'p_other', name:'Other', source:'instagram', medium:'paid_social', language:'en' as const, experience:PROMOTION_EXPERIENCE, createdAt:at};
  assert.equal(new URL(campaignPromotionUrl(old, 'https://example.test', 'ordinary')).pathname, '/chat');
});
test('language switching preserves the promotion ID and drops retired campaign query parameters', () => {
  const original = new URLSearchParams('c=instagram-bio&p=p_instagram_bio_id&utm_source=instagram&utm_medium=social&utm_campaign=instagram-bio');
  const before = original.toString();
  const next = new URL(linkHubConsultUrl(original, 'zh'), 'https://example.test');
  assert.equal(next.searchParams.get('p'), 'p_instagram_bio_id');
  assert.equal(next.searchParams.get('lang'), 'zh'); assert.equal(original.toString(), before);
  for (const source of ['c=instagram-bio&p=p_foreign', 'c=other&p=p_instagram_bio_id']) {
    const input = new URLSearchParams(source), output = new URL(linkHubConsultUrl(input, 'zh'), 'https://example.test');
    assert.equal(output.searchParams.get('p'), input.get('p')); assert.equal(output.searchParams.get('c'), null);
  }
  const plain = new URL(linkHubConsultUrl(new URLSearchParams('redirect=https://other.test&lead=private'), 'zh'), 'https://example.test');
  assert.equal(plain.pathname, '/chat'); assert.equal(plain.searchParams.get('c'), null);
  assert.equal(plain.searchParams.get('p'), null);
  assert.equal(plain.searchParams.get('redirect'), null); assert.equal(plain.searchParams.get('lead'), null);
  const lead = {campaignId:'original',campaign:'Original'};
  assert.deepEqual(firstTouchAttribution(lead, {campaignId:INSTAGRAM_BIO_CAMPAIGN}), lead);
});
test('bare /link leaves attribution unspecified in the consultation link; a plain /chat retains the existing organic default', () => {
  for (const lang of ['id','en','zh'] as const) {
    const next = new URL(linkHubConsultUrl(new URLSearchParams(), lang), 'https://example.test');
    assert.equal(next.searchParams.get('utm_source'),null); assert.equal(next.searchParams.get('utm_medium'),null);
    assert.equal(next.searchParams.get('p'), null);
  }
  assert.deepEqual(firstTouchAttribution({}, {}), {campaign:'organic', campaignId:'organic'});
});
test('historical Instagram Bio links retain their original routing identity', () => {
  for (const link of instagramBioCampaign(at).promotionLinks!)
    assert.equal(presetPromotionOwner(link.id), INSTAGRAM_BIO_CAMPAIGN);
});
