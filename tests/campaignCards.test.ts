import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CampaignCards,CampaignSidebarSummary} from '../src/components/crm/CampaignCards.tsx';
import {campaignDateRange,campaignEntrySummary,campaignCollectionLabel,campaignLocation,campaignDeliveryLabel,campaignTimeRange,campaignScheduleRange} from '../src/utils/campaignPresentation.ts';
const campaign:any={id:'legacy',code:'cl-original',name:'TEST Original Name',nameEn:'Do not substitute',status:'active',type:'campus_seminar',locationType:'hybrid',startDate:'2026-11-10',endDate:'2026-11-11',city:'Jakarta',stats:{leadsCount:4,assessedCount:2,enrolledCount:0,confirmedAttendanceCount:3},promotionLinks:[{id:'p1'},{id:'p2'}]};
const render=(campaigns:any[],props:any={})=>renderToStaticMarkup(React.createElement(CampaignCards,{campaigns,lang:'en',onOpen:()=>{},...props}));
test('catalogue preserves original identity, type, delivery format, complete dates and independent customer counts',()=>{
 const before=JSON.stringify(campaign),html=render([campaign]);
 for(const value of ['Open campaign: TEST Original Name','Campus Seminar','Delivery format: Hybrid','Hybrid','10–11 Nov 2026','cl-original','2 promotion links'])assert.ok(html.includes(value),value);
 assert.match(html,/Registered customers<\/dt><dd>4/);assert.match(html,/Assessed customers<\/dt><dd>2/);assert.match(html,/Enrollment recorded<\/dt><dd>0/);
 assert.doesNotMatch(html,/saved promotion links|Confirmed participation|Do not substitute|Leads ·|Date not recorded|Location not recorded/);assert.equal(JSON.stringify(campaign),before);
});
test('configuration states separate new setup, retained campaign-only links, saved entries and system attribution',()=>{
 const fresh={...campaign,promotionModel:'multiple',promotionLinks:[]},legacy={...campaign,promotionLinks:[]},organic={...fresh,id:'organic',code:'organic'};
 assert.equal(campaignEntrySummary(fresh as any).kind,'empty');assert.equal(campaignEntrySummary(legacy).kind,'legacy');assert.equal(campaignEntrySummary(organic as any).kind,'system');assert.equal(campaignEntrySummary(campaign).kind,'saved');
 assert.match(render([fresh],{onEdit:()=>{}}),/>Add promotion link</);assert.match(render([fresh]),/>View link setup</);assert.match(render([legacy]),/Legacy campaign link retained/);assert.doesNotMatch(render([legacy]),/No promotion entry saved|>Add promotion link</);
 const html=render([organic],{onEdit:()=>{}});assert.match(html,/System sources/);assert.match(html,/Non-campaign source/);assert.match(html,/View customers/);assert.doesNotMatch(html,/Links &amp; QR|More actions|Materials|Edit information|Other Activity|No promotion entry saved/);
 assert.equal(campaignCollectionLabel([fresh,legacy,organic] as any),'2 campaigns · 1 system source');
});
test('date summaries handle same-day, month/year boundaries and date-only timezones without hiding end dates',()=>{
 assert.equal(campaignDateRange(campaign),'10–11 Nov 2026');
 assert.equal(campaignDateRange({startDate:'2026-11-10',endDate:'2026-11-10'}),'10 Nov 2026');
 assert.equal(campaignDateRange({startDate:'2026-11-30',endDate:'2026-12-02'}),'30 Nov–2 Dec 2026');
 assert.equal(campaignDateRange({startDate:'2026-12-30',endDate:'2027-01-02'}),'30 Dec 2026–2 Jan 2027');
 assert.equal(campaignDateRange({endDate:'2026-11-11'}),'Ends 11 Nov 2026');assert.equal(campaignDateRange({}),'');
 assert.equal(campaignDateRange({startDate:'2026-02-30'}),'Recorded dates need review');
 assert.equal(campaignDateRange({startDate:'2026-11-11',endDate:'2026-11-10'}),'Recorded dates need review');
 assert.match(campaignTimeRange({...campaign,startTime:'10:00',endTime:'16:00'}),/^Start 10:00 · End 16:00 · Asia\/Jakarta$/);
});
test('card schedule attaches times to dates in one row without inventing missing endpoints or daily hours',()=>{
 const c={...campaign,startTime:'10:00',endTime:'16:00'};
 assert.equal(campaignScheduleRange(c),'10 Nov 10:00 → 11 Nov 16:00, 2026 · WIB');
 assert.equal(campaignScheduleRange({...c,endDate:c.startDate}),'10 Nov 2026, 10:00–16:00 · WIB');
 assert.equal(campaignScheduleRange({startDate:'2026-11-10',startTime:'10:00'}),'Starts 10 Nov 2026, 10:00 · WIB');
 assert.equal(campaignScheduleRange({endDate:'2026-11-11',endTime:'16:00'}),'Ends 11 Nov 2026, 16:00 · WIB');
 assert.equal(campaignScheduleRange({...c,startDate:'2026-12-31',endDate:'2027-01-01'}),'31 Dec 2026, 10:00 → 1 Jan 2027, 16:00 · WIB');
 assert.equal(campaignScheduleRange(campaign),'10–11 Nov 2026');assert.equal(campaignScheduleRange({}),'');
 assert.equal(campaignScheduleRange({...c,startTime:''}),'10 Nov 2026 · Time not recorded → 11 Nov 2026, 16:00 · WIB');
 assert.equal(campaignScheduleRange({startTime:'10:00'}),'Starts Date not recorded, 10:00 · WIB');
 assert.equal(campaignScheduleRange({...c,startDate:'2026-02-30'}),'Recorded schedule needs review');
 assert.equal(campaignScheduleRange({...c,endDate:c.startDate,endTime:'09:59'}),'Recorded schedule needs review');
 const html=render([c]);assert.equal((html.match(/class="campaign-card-schedule"/g)||[]).length,1);
 assert.match(html,/10 Nov 10:00 → 11 Nov 16:00, 2026 · WIB/);assert.doesNotMatch(html,/Start 10:00 · End 16:00/);
});
test('optional place/date fields stay absent, delivery is explicit and unknown values are not invented',()=>{
 const c={...campaign,startDate:'',endDate:'',city:'',venue:'',type:'',locationType:''};const html=render([c]);
 assert.doesNotMatch(html,/Date not recorded|Location not recorded|Schedule not set/);assert.match(html,/Type not set/);assert.match(html,/Not set/);
 assert.equal(campaignDeliveryLabel({locationType:'online'}),'Online');assert.equal(campaignDeliveryLabel({locationType:'offline'}),'Onsite');assert.equal(campaignDeliveryLabel({}),'Not set');
 assert.equal(campaignLocation({locationType:'online',venue:'Original venue',city:'Jakarta'}),'');assert.equal(campaignLocation({locationType:'hybrid',venue:'Original venue',city:'Jakarta'}),'Original venue · Jakarta');
});
test('sidebar shares configuration/date meaning, adds compact results and does not repeat IDs or offer marketing controls',()=>{
 const html=renderToStaticMarkup(React.createElement(CampaignSidebarSummary,{campaign,lang:'en',reviewCount:2}));
 for(const value of ['TEST Original Name','2 links','10–11 Nov 2026','Jakarta','Registered 4','Enrolled 0','2 promotion attributions'])assert.ok(html.includes(value),value);
 assert.doesNotMatch(html,/cl-original|Materials|QR|Confirmed participation/);
});
test('only known per-campaign pending review counts are displayed, without inferring an error for other campaigns',()=>{
 const html=render([campaign,{...campaign,id:'other',name:'TEST Other'}],{reviewCounts:{available:true,counts:{legacy:2}},onReview:()=>{}});
 assert.equal((html.match(/promotion attributions need review/g)||[]).length,1);assert.match(html,/>Review 2<\/button>/);assert.doesNotMatch(html,/0 promotion attributions/);
 const navigation=html.match(/<button[^>]*class="campaign-home-open"[^>]*>[\s\S]*?<\/button>/g)||[];
 assert.equal(navigation.length,2);for(const button of navigation)assert.doesNotMatch(button,/campaign-card-review|Review 2/);
 assert.doesNotMatch(render([campaign],{reviewCounts:{available:false,counts:{legacy:2}},onReview:()=>{}}),/>Review 2<\/button>/);
});

test('planned budget is distinct from customer measures, preserves zero and does not invent a missing amount',()=>{
 const zero=render([{...campaign,stats:{...campaign.stats,budgetCost:0}}]);
 assert.match(zero,/Planned budget<\/span><span>IDR 0<\/span>/);
 const missing=render([{...campaign,stats:{...campaign.stats,budgetCost:null}}]);
 assert.match(missing,/Planned budget<\/span><span>Not recorded<\/span>/);assert.doesNotMatch(missing,/IDR 0/);
 const positive=render([{...campaign,stats:{...campaign.stats,budgetCost:1500000}}]);assert.match(positive,/IDR 1,500,000/);
 assert.equal((positive.match(/<dt>/g)||[]).length,3);
});

test('organizer and optional attendance link preserve entered facts without adding a link for missing or unsafe addresses',()=>{
 const original={...campaign,organizer:'TEST original organiser',onlineLink:'https://meeting.example.invalid/room?event=one'};const before=JSON.stringify(original);
 const html=render([original]);assert.match(html,/Organizer: TEST original organiser/);assert.match(html,/href="https:\/\/meeting.example.invalid\/room\?event=one" target="_blank" rel="noopener noreferrer"/);
 assert.match(html,/Online attendance link for TEST Original Name/);
 const opener=html.match(/<button[^>]*class="campaign-home-open"[^>]*>[\s\S]*?<\/button>/)?.[0];assert.ok(opener);assert.doesNotMatch(opener,/<a /);assert.equal(JSON.stringify(original),before);
 for(const onlineLink of ['',undefined,'javascript:alert(1)'])assert.doesNotMatch(render([{...campaign,organizer:'',onlineLink}]),/campaign-card-attendance|Organizer:/);
 assert.doesNotMatch(render([{...original,id:'organic',code:'organic'}]),/campaign-card-attendance|Organizer:/);
});
