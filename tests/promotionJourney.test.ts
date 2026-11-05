import assert from 'node:assert/strict';
import test from 'node:test';
import { promotionIndexEntries, syncPromotionIndex } from '../cloud/mysql/promotion-index.mjs';
import { sourceKey, promotionAttribution, publicPromotion, resolvePromotion } from '../server/portal/attribution';
import { analyticsContext, createAnalyticsClient } from '../src/utils/analyticsPolicy';
import { campaignPromotionUrl } from '../src/utils/campaignPromotion';
import { instagramBioCampaign, linkHubConsultUrl } from '../src/utils/instagramBioCampaign';
import { lookupPromotion } from '../src/utils/promotionLookup';
import { promotionIdentity, promotionJourneyUrl, websitePromotionUrl, type PublicPromotion } from '../src/utils/promotionNavigation';
import { campaignPromotionResults } from '../src/utils/crmCampaignMetrics';

const origin = 'http://localhost:3000';
const examples = [
  ['bio-ig','instagram','social','social-bio','profile-bio','/link'],
  ['bio-yt','youtube','social','social-bio','channel-description','/link'],
  ['bio-tt','tiktok','social','social-bio','profile-bio','/link'],
  ['hsk-yt-video01','youtube','social','hsk-nov','video-01','/chat'],
  ['hsk-tt-ad-a','tiktok','paid_social','hsk-nov','ad-a','/chat'],
  ['hsk-wa-nov','whatsapp','messaging','hsk-nov','broadcast-nov','/link'],
  ['hsk-tt-ad-home','tiktok','paid_social','hsk-nov','ad-home','/'],
] as const;

test('Chapter six tagged paths keep one promotion ID and apply verified GA fields at landing and chat', () => {
  for (const [id, source, medium, campaignCode, content, landingPath] of examples) {
    const promotion: PublicPromotion = {id, source, medium, campaignId:campaignCode, campaignCode, content, landingPath,
      language:'id', promotionKind:medium==='paid_social'?'paid':'unpaid'};
    const link = {...instagramBioCampaign().promotionLinks![0], ...promotion};
    const landing = new URL(campaignPromotionUrl(link, origin, campaignCode));
    assert.equal(landing.pathname, landingPath);
    assert.deepEqual(Object.fromEntries(landing.searchParams), {p:id,lang:'id',utm_source:source,utm_medium:medium,utm_campaign:campaignCode,utm_content:content});
    const hub = landingPath === '/' ? new URL(promotionJourneyUrl('/link', landing.searchParams, 'homepage_widget'), origin) : landing;
    const chat = hub.pathname === '/link' ? new URL(linkHubConsultUrl(hub.searchParams, 'zh'), origin) : hub;
    for (const page of [landing, hub, chat]) {
      const actual = analyticsContext({href:page.href, promotion});
      assert.deepEqual([actual.campaign_source,actual.campaign_medium,actual.campaign_name,actual.campaign_content], [source,medium,campaignCode,content]);
      assert.equal(actual.promotion_link_id, id);
      assert.equal(actual.page_location, origin + page.pathname);
      assert.equal(page.searchParams.get('p'), id);
    }
    assert.equal(chat.searchParams.get('entry_point'), landingPath === '/chat' ? null : 'linkhub');
  }
});

test('handbook actions share their link context while untagged site and chat paths keep referral semantics', () => {
  const [id,source,medium,campaignCode,content] = examples[1];
  const events: any[] = [];
  const client = createAnalyticsClient({id:'G-TEST', send:(...args) => events.push(args),
    context: () => analyticsContext({href:origin + '/link?p=' + id,
      promotion:{id,source,medium,campaignId:campaignCode,campaignCode,content,landingPath:'/link',language:'id',promotionKind:'unpaid'}})});
  for (const action of ['preview','view','download_click','share']) {
    assert(client.track('link_click',{target:'handbook',entry_point:'linkhub',asset_id:'handbook_2026',handbook_action:action}));
  }
  assert.deepEqual(events.map(event => [event[2].promotion_link_id,event[2].handbook_action]),
    ['preview','view','download_click','share'].map(action => [id,action]));
  const homeChat = promotionJourneyUrl('/chat', new URLSearchParams(), 'homepage_widget');
  const homeHub = promotionJourneyUrl('/link', new URLSearchParams(), 'homepage_widget');
  for (const path of [homeChat, homeHub, '/link', '/chat', linkHubConsultUrl(new URLSearchParams(), 'id')]) {
    const result = analyticsContext({href:origin + path,referrer:'https://www.google.com/search?q=PRIVATE'});
    assert.equal(result.campaign_source, undefined);
    assert.equal(result.page_referrer, 'https://www.google.com/');
    assert.equal(result.source_basis,'untagged');
  }
  assert.equal(analyticsContext({href:origin + homeHub}).source_basis,'untagged');
  assert.equal(analyticsContext({href:origin + '/link?utm_source=youtube&utm_medium=social'}).campaign_source,'youtube');
  assert.equal(analyticsContext({href:origin + '/link?p=bad&p=second&utm_source=forged'}).source_basis,'unverified');
  assert.equal(promotionIdentity(new URLSearchParams('p=valid&p=other')).invalid,true);
});

test('public resolver, save verification and legacy alias share the indexed owner', async () => {
  const config = instagramBioCampaign();
  const link = config.promotionLinks![0];
  const row = {id:config.id, code:config.code, config};
  const db = {query:async (sql: string, values: string[]) => {
    if (sql.includes('campaign_promotion_index')) return {rows: values[0] === link.id ? [{campaign_id:row.id}] : []};
    if (sql.includes('campaign_source_reviews')) return {rows: values[0] === sourceKey('legacy-alias') ? [{campaign_id:row.id}] : []};
    return {rows:values[0] === row.id ? [row] : []};
  }};
  const verified = await resolvePromotion(db, '', link.id);
  assert.equal(publicPromotion(verified!).campaignCode, config.code);
  assert.equal((await resolvePromotion(db, config.code, link.id))?.link.id, link.id);
  assert.equal((await resolvePromotion(db, 'legacy-alias', link.id))?.link.id, link.id);
  assert.equal(await resolvePromotion(db, 'other', link.id), null);
  const saved = await promotionAttribution(db, {}, {promotionLinkId:link.id,utmCampaign:'forged'});
  assert.equal(saved.campaignId, config.code);
  assert.equal(saved.promotionLinkStatus, 'verified');
  assert.deepEqual(await promotionAttribution(db, saved, {promotionLinkId:'different'}), {});
  assert.equal((await promotionAttribution(db, {}, {promotionLinkId:'bad'})).campaignSourceStatus, 'pending');
  assert.equal((await promotionAttribution(db, {}, {utmCampaign:config.code})).campaignId, config.code);
});

test('invalid p retains original promotion parameters without assigning a campaign', async () => {
  const db = {query: async () => { throw Error('Malformed p should not query the index'); }};
  const unknown = await promotionAttribution(db, {}, {
    promotionLinkId: '',
    promotionParameters: [{key:'p',value:''},{key:'p',value:'different'},{key:'utm_source',value:'instagram'},{key:'email',value:'private@example.invalid'}],
    utmCampaign: 'sample-campaign',
  });
  assert.equal(unknown.promotionException, 'invalid_p');
  assert.equal(unknown.promotionLinkStatus, 'unverified');
  assert.equal(unknown.campaignId, undefined);
  assert.equal(unknown.rawPromotionLinkId, '');
  assert.deepEqual(unknown.rawPromotionParameters, [
    {key:'p',value:''}, {key:'p',value:'different'}, {key:'utm_source',value:'instagram'},
  ]);
});

test('index migration rejects duplicate IDs and is idempotent on replay', async () => {
  const config = instagramBioCampaign();
  const campaign = {id:config.id,code:config.code,config};
  assert.throws(() => promotionIndexEntries([campaign,campaign]), /Duplicate promotion/);
  const inserted = new Map<string,string>();
  const db = {
    query: async (sql: string) => sql.includes('trial_campaigns') ? [[campaign]] : [[...inserted].map(([p,campaign_id])=>({p,campaign_id}))],
    execute: async (_sql: string, [p,id]: [string,string]) => {
      assert(!inserted.has(p));
      inserted.set(p,id);
    }
  };
  await syncPromotionIndex(db);
  await syncPromotionIndex(db);
  assert.deepEqual(inserted,promotionIndexEntries([campaign]));
  inserted.set(config.promotionLinks![0].id,'wrong');
  await assert.rejects(() => syncPromotionIndex(db), /ownership mismatch/);
});

test('promotion results use verified source and assign refunds to their original source lead', () => {
  const campaign = instagramBioCampaign(), [first, second] = campaign.promotionLinks!;
  const lead = {id:'lead-a',campaignId:campaign.id,promotionLinkStatus:'verified',promotionLinkId:first.id,
    identitySources:[{id:'lead-b',campaignId:campaign.id,promotionLinkStatus:'verified',promotionLinkId:second.id}],
    verifiedPayments:{sources:[{sourceLeadId:'lead-b',received:100,refunded:25,net:75}]}};
  const rows = campaignPromotionResults([lead,lead,{id:'bad',campaignId:campaign.id,promotionLinkStatus:'unverified',rawPromotionLinkId:first.id}],campaign);
  assert.deepEqual(rows.filter(row=>row.customers||row.received).map(row=>[row.key,row.customers,row.received,row.refunded,row.net]),
    [[first.id,1,0,0,0],[second.id,0,100,25,75],[':unverified',1,0,0,0]]);
});

test('campaign results separate manual confirmations from system attribution', () => {
  const campaign = instagramBioCampaign();
  const [link] = campaign.promotionLinks!;
  const profile = {promotionLinkStatus:'unverified', campaignSourceStatus:'pending', rawPromotionLinkId:'unknown'};
  const rows = campaignPromotionResults([
    {id:'system',campaignId:campaign.code,promotionLinkStatus:'verified',promotionLinkId:link.id},
    {...profile,id:'manual-link',promotionReview:{status:'linked',campaignId:campaign.id,linkId:link.id}},
    {...profile,id:'manual-campaign',promotionReview:{status:'linked',campaignId:campaign.id,linkId:null}},
    {...profile,id:'pending'},
  ],campaign);
  assert.deepEqual(rows.filter(row => row.customers).map(row => [row.key,row.attribution,row.customers]), [
    [link.id,'system',1], [':manual:'+link.id,'manual',1], [':manual-campaign','manual',1],
  ]);
});

test('one browser lookup is shared and explicit conflicting parameters never hit the network', async t => {
  let calls = 0;
  t.mock.method(globalThis,'fetch',async () => {
    calls++;
    return Response.json({promotion:{id:'lookup-fixture',campaignId:'c',campaignCode:'c',source:'youtube',medium:'social',language:'zh',landingPath:'/link',promotionKind:'unpaid'}});
  });
  const params = new URLSearchParams('p=lookup-fixture');
  const first = lookupPromotion(params);
  assert.equal(first,lookupPromotion(params));
  assert.equal((await first)?.state,'verified');
  assert.deepEqual(lookupPromotion(new URLSearchParams('p=lookup-fixture&c=one&cid=two')),{state:'unverified'});
  assert.equal(calls,1);
});

test('a delayed promotion response cannot replace the timed-out context', async t => {
  let finish!: (response: Response) => void;
  let signal: AbortSignal | null | undefined;
  t.mock.method(globalThis, 'fetch', (_input: unknown, init: RequestInit) => {
    signal = init.signal;
    return new Promise<Response>(resolve => { finish = resolve; });
  });
  const params = new URLSearchParams('p=timeout-fixture');
  const result = await lookupPromotion(params);
  assert.deepEqual(result, { state: 'unavailable' });
  assert.equal(signal?.aborted, true);
  finish(Response.json({promotion:{id:'timeout-fixture',campaignId:'c',campaignCode:'c',source:'youtube',
    medium:'social',language:'zh',landingPath:'/link',promotionKind:'unpaid'}}));
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.deepEqual(await lookupPromotion(params), result);
});

test('website presets preserve external attribution and give bare website entries distinct promotion IDs', () => {
  assert.equal(websitePromotionUrl('/link', new URLSearchParams(), 'website'), '/link?p=home-link&entry_point=website');
  assert.equal(websitePromotionUrl('/chat', new URLSearchParams(), 'homepage_widget'), '/chat?p=home-chat&entry_point=homepage_widget');
  assert.equal(websitePromotionUrl('/chat', new URLSearchParams('p=bio-ig'), 'website'), '/chat?p=bio-ig&entry_point=website');
  assert.equal(websitePromotionUrl('/chat', new URLSearchParams('utm_source=google'), 'website'), '/chat?utm_source=google&entry_point=website');
  const result = analyticsContext({href:origin + '/chat?p=home-chat', promotion:{id:'home-chat',campaignId:'social-bio',
    campaignCode:'social-bio',source:'website',medium:'internal',promotionKind:'unpaid',landingPath:'/chat',language:'id'}});
  assert.equal(result.promotion_link_id,'home-chat');
  assert.equal(result.campaign_source,undefined);
  assert.equal(result.campaign_name,undefined);
});
