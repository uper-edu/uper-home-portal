import assert from 'node:assert/strict';
import test from 'node:test';
import { promotionIndexEntries, syncPromotionIndex } from '../cloud/mysql/promotion-index.mjs';
import { promotionAttribution, publicPromotion, resolvePromotion } from '../server/portal/attribution';
import { analyticsContext, createAnalyticsClient } from '../src/utils/analyticsPolicy';
import { campaignPromotionUrl } from '../src/utils/campaignPromotion';
import { instagramBioCampaign } from '../src/utils/instagramBioCampaign';
import { lookupPromotion, watchPromotionLanguage } from '../src/utils/promotionLookup';
import { promotionEntryUrl, linkHubReturnUrl, promotionIdentity, promotionJourneyUrl, websitePromotionUrl, type PublicPromotion } from '../src/utils/promotionNavigation';
import { enrollmentGuideHref } from '../src/utils/enrollmentGuidance';
import { campaignPromotionResults } from '../src/utils/crmCampaignMetrics';

const origin = 'http://localhost:3000';

test('enrollment consultation leaves the promotion language open until the visitor chooses one', () => {
  const incoming=new URLSearchParams('p=fixture&utm_campaign=mobile&entry_point=linkhub');
  const implicit=new URL(promotionEntryUrl('/chat',incoming,'id'),origin);
  assert.equal(implicit.searchParams.has('lang'),false);
  assert.equal(implicit.searchParams.get('p'),'fixture');
  assert.equal(implicit.searchParams.get('utm_campaign'),'mobile');
  assert.equal(implicit.searchParams.get('entry_point'),'linkhub');
  incoming.set('lang','zh');
  const explicit=new URL(promotionEntryUrl('/chat',incoming,'id'),origin);
  assert.equal(explicit.searchParams.get('lang'),'zh');
  assert.equal(explicit.searchParams.get('entry_point'),'linkhub');
});

test('Link Hub forwards campaign language inference until the learner chooses a language', () => {
  for(const target of ['/enrollment','/chat'] as const){
    const incoming=new URLSearchParams('p=campaign-en&utm_campaign=fixture&order=private');
    const implicit=new URL(promotionEntryUrl(target,incoming,'id','linkhub'),origin);
    assert.equal(implicit.pathname,target);
    assert.deepEqual(Object.fromEntries(implicit.searchParams),{p:'campaign-en',utm_campaign:'fixture',entry_point:'linkhub'});
    incoming.set('lang','zh');
    const explicit=new URL(promotionEntryUrl(target,incoming,'id','linkhub'),origin);
    assert.equal(explicit.searchParams.get('lang'),'zh');
    const untagged=new URL(promotionEntryUrl(target,new URLSearchParams('utm_source=organic'),'en','linkhub'),origin);
    assert.equal(untagged.searchParams.get('lang'),'en');
  }
});

test('Link hub return carries promotion evidence and language without leaking destination state', () => {
  const landing = new URLSearchParams('p=bio-ig&utm_source=instagram&utm_medium=social&utm_campaign=social-bio&utm_content=profile&utm_id=qa&lang=zh');
  const enrollment = new URL(promotionEntryUrl('/enrollment',landing,'zh','linkhub'),origin);
  const chat = new URL(promotionEntryUrl('/chat',landing,'zh','linkhub'),origin);
  assert.equal(chat.search,enrollment.search);
  const guided = new URL(enrollmentGuideHref({kind:'class',classId:'class-1',level:'HSK 1'},'zh','ai_chat',chat.searchParams),origin);
  assert.equal(guided.searchParams.get('enrollment_via'),'ai_chat');
  guided.searchParams.set('order','private-order');
  for (const page of [enrollment,chat,guided]) {
    const back = new URL(linkHubReturnUrl(page.searchParams,'zh')!,origin);
    assert.equal(back.pathname,'/link');
    assert.deepEqual(Object.fromEntries(back.searchParams),{...Object.fromEntries(landing),lang:'zh',entry_point:'linkhub'});
  }
  assert.equal(linkHubReturnUrl(new URLSearchParams('p=bio-ig&entry_point=direct'),'zh'),undefined);
  assert.equal(linkHubReturnUrl(new URLSearchParams('entry_point=linkhub'),'id'),'/link?lang=id&entry_point=linkhub');
  assert.equal(linkHubReturnUrl(new URLSearchParams('p=bio-ig&entry_point=linkhub'),'id'),'/link?p=bio-ig&entry_point=linkhub');
  assert.equal(linkHubReturnUrl(new URLSearchParams('p=bio-ig&lang=zh&entry_point=linkhub'),'id'),'/link?lang=zh&p=bio-ig&entry_point=linkhub');
});

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
    const chat = hub.pathname === '/link' ? new URL(promotionEntryUrl('/chat',hub.searchParams, 'zh','linkhub'), origin) : hub;
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
  for (const path of [homeChat, homeHub, '/link', '/chat', promotionEntryUrl('/chat',new URLSearchParams(),'id','linkhub')]) {
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

test('public resolver and save verification rely on the indexed promotion owner', async () => {
  const config = instagramBioCampaign();
  const link = config.promotionLinks![0];
  const row = {id:config.id, code:config.code, config};
  const db = {query:async (sql: string, values: string[]) => {
    if (sql.includes('campaign_promotion_index')) return {rows: values[0] === link.id ? [{campaign_id:row.id}] : []};
    return {rows:values[0] === row.id ? [row] : []};
  }};
  const verified = await resolvePromotion(db, link.id);
  assert.equal(publicPromotion(verified!).campaignCode, config.code);
  const saved = await promotionAttribution(db, {}, {promotionLinkId:link.id,utmCampaign:'forged',campaignId:'ignored-old-code'});
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

test('one browser lookup is shared and conflicting promotion IDs never hit the network', async t => {
  let calls = 0;
  t.mock.method(globalThis,'fetch',async () => {
    calls++;
    return Response.json({promotion:{id:'lookup-fixture',campaignId:'c',campaignCode:'c',source:'youtube',medium:'social',language:'zh',landingPath:'/link',promotionKind:'unpaid'}});
  });
  const params = new URLSearchParams('p=lookup-fixture');
  const first = lookupPromotion(params);
  assert.equal(first,lookupPromotion(params));
  assert.equal((await first)?.state,'verified');
  assert.equal((await lookupPromotion(new URLSearchParams('p=lookup-fixture&c=one&cid=two')))?.state,'verified');
  assert.deepEqual(lookupPromotion(new URLSearchParams('p=lookup-fixture&p=foreign')),{state:'unverified'});
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

test('an incomplete promotion response is retriable and cannot supply a campaign language',async t=>{
  let now=0;
  t.mock.method(performance,'now',()=>now);
  const promotion={id:'incomplete-promo-fixture',campaignId:'fixture',campaignCode:'campaign',
    source:'youtube',medium:'social',promotionKind:'unpaid',landingPath:'/link',language:'id'};
  let payload:unknown;
  const request=t.mock.method(globalThis,'fetch',async()=>Response.json({promotion:payload}));
  const params=new URLSearchParams('p='+promotion.id);
  for(const fields of [{source:undefined},{medium:null},{campaignCode:12},{campaignId:''},{promotionKind:undefined}]){
    payload={...promotion,...fields};
    assert.deepEqual(await lookupPromotion(params),{state:'unavailable'});
    now+=3000;
  }
  payload=promotion;
  assert.deepEqual(await lookupPromotion(params),{state:'verified',promotion});
  assert.equal(request.mock.callCount(),6);
});

test('an online language watcher shares one slower retry after the analytics deadline', async t => {
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');});
  const attempts:{signal:AbortSignal;finish:(result:Response)=>void}[]=[];
  t.mock.method(globalThis,'fetch',(_url:string,{signal}: {signal:AbortSignal})=>new Promise<Response>(finish=>attempts.push({signal,finish})));
  const promotion={id:'slow-online-language',campaignId:'c',campaignCode:'c',source:'youtube',medium:'social',
    language:'en',landingPath:'/link',promotionKind:'unpaid'};
  const params=new URLSearchParams('p='+promotion.id);
  const early=lookupPromotion(params);
  let movedPageCalls=0;
  const stopPrevious=watchPromotionLanguage(params,()=>{movedPageCalls++;});
  const result=new Promise<string>(resolve=>watchPromotionLanguage(params,resolve));
  assert.deepEqual(await early,{state:'unavailable'});
  assert.equal(attempts[0].signal.aborted,true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(attempts.length,2);
  assert.deepEqual(lookupPromotion(params),{state:'unavailable'});
  stopPrevious?.();
  attempts[0].finish(Response.json({error:'old request'},{status:503}));
  attempts[1].finish(Response.json({promotion}));
  assert.equal(await result,'en');
  assert.equal(movedPageCalls,0);
  assert.deepEqual(lookupPromotion(params),{state:'verified',promotion});
});

test('temporary promotion failures can recover on a later lookup without duplicating concurrent requests', async t => {
  let now = 0;
  t.mock.method(performance,'now',()=>now);
  const promotion={id:'recover-lookup-fixture',campaignId:'c',campaignCode:'c',source:'youtube',medium:'social',
    language:'id',landingPath:'/link',promotionKind:'unpaid'};
  const request=t.mock.method(globalThis,'fetch',async()=>Response.json({error:'temporary'},{status:503}));
  const params=new URLSearchParams('p=recover-lookup-fixture');
  assert.deepEqual(await lookupPromotion(params),{state:'unavailable'});
  now=2999;
  assert.deepEqual(lookupPromotion(params),{state:'unavailable'});
  assert.equal(request.mock.calls.length,1);
  now=3000;
  request.mock.mockImplementation(async()=>Response.json({promotion}));
  const next=lookupPromotion(params);
  assert.equal(lookupPromotion(params),next);
  assert.deepEqual(await next,{state:'verified',promotion});
  assert.deepEqual(lookupPromotion(params),{state:'verified',promotion});
  assert.equal(request.mock.calls.length,2);
});

test('promotion language recovers once when reconnection arrives before the failed lookup settles', async t=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  const page=new EventTarget();
  Object.defineProperty(globalThis,'window',{configurable:true,value:page});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');});
  const promotion={id:'watch-lookup-fixture',campaignId:'c',campaignCode:'c',source:'youtube',medium:'social',
    language:'zh',landingPath:'/link',promotionKind:'unpaid'};
  let finish!: (response:Response)=>void;
  const request=t.mock.method(globalThis,'fetch',()=>new Promise<Response>(resolve=>{finish=resolve;}));
  const langs:string[]=[];
  const params=new URLSearchParams('p='+promotion.id);
  const stop=watchPromotionLanguage(params,language=>langs.push(language));
  page.dispatchEvent(new Event('online'));
  page.dispatchEvent(new Event('online'));
  assert.equal(request.mock.callCount(),1);
  request.mock.mockImplementation(async()=>Response.json({promotion}));
  finish(Response.json({error:'temporary'},{status:503}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(langs,['zh']);
  page.dispatchEvent(new Event('online'));
  assert.equal(request.mock.callCount(),2);
  stop?.();
});

test('offline promotion routes share one lookup after reconnect and retain the resolved language',async t=>{
  const page=new EventTarget();
  const network={onLine:false};
  for(const [key,value] of [['window',page],['navigator',network]] as const){
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(()=>{if(previous)Object.defineProperty(globalThis,key,previous);else Reflect.deleteProperty(globalThis,key);});
  }
  const request=t.mock.method(globalThis,'fetch',async(url:string)=>Response.json({promotion:{
    id:url.split('/').at(-1),campaignId:'c',campaignCode:'c',source:'youtube',medium:'social',language:'id',landingPath:'/link',promotionKind:'unpaid',
  }}));
  const params=new URLSearchParams('p=offline-watch-promo');
  const analyticsParams=new URLSearchParams('p=offline-analytics-promo');
  const languages:string[]=[];
  const oldRoute=watchPromotionLanguage(params,()=>languages.push('stale'));
  const currentRoute=watchPromotionLanguage(params,lang=>languages.push(lang));
  assert.deepEqual(lookupPromotion(analyticsParams),{state:'unavailable'});
  assert.deepEqual(lookupPromotion(params),{state:'unavailable'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(request.mock.callCount(),0);
  oldRoute?.();
  network.onLine=true;
  page.dispatchEvent(new Event('online'));
  page.dispatchEvent(new Event('online'));
  const analytics=lookupPromotion(analyticsParams);
  assert.equal(lookupPromotion(analyticsParams),analytics);
  assert.equal((await analytics)?.state,'verified');
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(languages,['id']);
  assert.equal(request.mock.callCount(),2);
  assert.equal((await lookupPromotion(params))?.state,'verified');
  network.onLine=false;
  assert.equal((await lookupPromotion(params))?.state,'verified');
  assert.equal(request.mock.callCount(),2);
  currentRoute?.();
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
