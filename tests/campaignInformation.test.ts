// Fixture browser timezone is explicit; cross-zone conversion is tested in crmViewerTime.
process.env.TZ='Asia/Jakarta';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CampaignInformation} from '../src/components/crm/CampaignInformation.tsx';
import {campaignName,campaignTemplate} from '../src/utils/campaignWorkspace.ts';
const c:any={id:'old-id',code:'cl261001120000',name:'Original campaign name',nameEn:'Old English alias',nameId:'Old Indonesian alias',type:'campus_seminar',status:'planning',organizer:'TEST organizer',locationType:'hybrid',startDate:'2026-11-10',endDate:'2026-11-11',startTime:'10:00',endTime:'16:00',city:'Jakarta',venue:'TEST venue',address:'TEST street',onlineLink:'https://meeting.example.invalid/trial',scheduleNotes:'TEST schedule',stats:{budgetCost:0},targetAudience:['TEST audience'],keyTopics:['TEST fact'],speakers:[{name:'TEST Speaker',title:'Instructor',bio:'TEST speaker bio'}],createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-02T00:00:00Z',boundUtm:{utm_source:'old_source',utm_medium:'poster',defaultLang:'id',defaultHook:'consultation'}};
test('information displays all stored business fields, including simultaneous address and online link',()=>{
 const html=renderToStaticMarkup(React.createElement(CampaignInformation,{campaign:c}));
 for(const value of [c.name,c.code,c.organizer,c.startDate,c.endDate,c.startTime,c.endTime,c.city,c.venue,c.address,c.onlineLink,c.scheduleNotes,c.targetAudience[0],c.keyTopics[0],c.speakers[0].name,c.speakers[0].title,c.speakers[0].bio,'Hybrid','Campus Seminar','1 Oct 2026','2 Oct 2026','old_source'])assert.ok(html.includes(value),value);
 assert.match(html,/<dt>Start<\/dt><dd>2026-11-10 · 10:00<\/dd>/);assert.match(html,/<dt>End<\/dt><dd>2026-11-11 · 16:00<\/dd>/);
 assert.doesNotMatch(html,/<dt>(?:Start date|Start time|End date|End time)<\/dt>/);
 assert.match(html,/Planned budget \(IDR\).*?<dd>0<\/dd>/);
 assert.doesNotMatch(html,/Old English alias|Old Indonesian alias/);
});
test('single name is unchanged across interface/template languages without mutating legacy names',()=>{
 const before=JSON.stringify(c);for(const lang of ['en','id','zh'] as const){assert.equal(campaignName(c,lang),c.name);assert.equal(campaignTemplate(c,lang).posterHeading,c.name);}assert.equal(JSON.stringify(c),before);
});
test('unrecorded values stay unknown and unsafe legacy attendance links are not clickable',()=>{
 const html=renderToStaticMarkup(React.createElement(CampaignInformation,{campaign:{...c,onlineLink:'javascript:alert(1)',stats:{budgetCost:null},createdAt:'invalid',updatedAt:''}}));
 assert.doesNotMatch(html,/href="javascript:/);assert.match(html,/Not recorded/);
});

test('combined schedule endpoints preserve partial and missing facts without inventing a date or midnight',()=>{
 for(const [date,time,expected] of [['2026-11-10','','2026-11-10 · Time not recorded'],['','09:30','Date not recorded · 09:30'],['','','Not recorded']]){
  const value={...c,startDate:date,startTime:time,endDate:date,endTime:time};const before=JSON.stringify(value);
  const html=renderToStaticMarkup(React.createElement(CampaignInformation,{campaign:value}));
  for(const label of ['Start','End'])assert.ok(html.includes(`<dt>${label}</dt><dd>${expected}</dd>`));
  assert.equal(JSON.stringify(value),before);assert.doesNotMatch(html,/ · 00:00/);
 }
});
