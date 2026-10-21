import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CrmCampaignMeasures} from '../src/components/crm/CrmCampaignMeasures.tsx';
import {CampaignOverview} from '../src/components/crm/CampaignOverview.tsx';
const a:any={id:'a',stats:{leadsCount:4,assessedCount:3,confirmedAttendanceCount:2,enrolledCount:2,impressions:10}};
const b:any={id:'b',stats:{leadsCount:10,assessedCount:5,confirmedAttendanceCount:1,enrolledCount:1,impressions:20}};
const render=(campaigns:any[],patch:any={})=>renderToStaticMarkup(React.createElement(CampaignOverview,{campaigns,expanded:true,onToggle:()=>{},loading:false,error:false,onRetry:()=>{},isLight:true,...patch}));
test('overview aggregates only the supplied filtered cohort and computes weighted enrollment share',()=>{
 const original=JSON.stringify([a,b]);
 const all=render([a,b]),filtered=render([a]);
 assert.match(all,/Current filtered sources: 2 campaigns/);assert.match(all,/Registered customers<\/h3><strong>14<\/strong>/);assert.match(all,/21\.4%/);
 assert.match(filtered,/Current filtered sources: 1 campaign/);assert.match(filtered,/Registered customers<\/h3><strong>4<\/strong>/);assert.match(filtered,/50\.0%/);
 assert.equal((filtered.match(/<article>/g)||[]).length,6);assert.doesNotMatch(filtered,/More metrics/);assert.equal(JSON.stringify([a,b]),original);
});
test('no matches are valid zeros with no invented conversion; failures and loading never masquerade as zero results',()=>{
 assert.match(render([]),/Current filtered sources: 0 campaigns/);assert.match(render([]),/Not calculable/);
 for(const patch of [{error:true},{loading:true}]){const html=render([a],patch);assert.doesNotMatch(html,/Registered customers|Current filtered sources/);assert.match(html,patch.error?/Campaign metrics unavailable/:/Updating campaign metrics/);}
});
test('collapsed overview exposes a keyboard toggle without rendering hidden metrics',()=>{
 const html=render([a],{expanded:false});assert.match(html,/aria-expanded="false"/);assert.match(html,/Campaign overview · Current results/);assert.doesNotMatch(html,/Registered customers/);
});

test('system source is explicitly counted without changing aggregate customer totals',()=>{
 const html=render([a,{...b,id:'organic',code:'organic'}]);assert.match(html,/Current filtered sources: 1 campaign · 1 system source/);assert.match(html,/Registered customers<\/h3><strong>14<\/strong>/);
});

test('system-source detail omits campaign participation and promotion-open tiles without changing stored measures',()=>{
 const original=JSON.stringify(a);const html=renderToStaticMarkup(React.createElement(CrmCampaignMeasures,{campaigns:[a],lang:'en',isLight:true,detail:true,systemSource:true,scopeLabel:'This system source'}));
 assert.match(html,/This system source/);assert.equal((html.match(/<article>/g)||[]).length,4);assert.doesNotMatch(html,/<h3>Confirmed participation<|<h3>Link opens</);assert.match(html,/Registered customers<\/h3><strong>4<\/strong>/);assert.equal(JSON.stringify(a),original);
});
