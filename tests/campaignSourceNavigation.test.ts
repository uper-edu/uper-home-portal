import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {campaignReviewUrl,campaignReviewReturnUrl,sourceReviewState} from '../src/utils/campaignSourceNavigation.ts';
import {CampaignWorkspaceHeading} from '../src/components/crm/CampaignWorkspaceHeading.tsx';
const filters={search:'Open House',type:'campus_seminar',status:'planning'};
test('source routes preserve catalogue filters, scope the card shortcut and retain an independent detail return URL',()=>{
 const original='https://example.test/crm?tab=campaigns&campaign=camp-old&campaignView=info&campaignSearch=stale&sourceIssue=old#old';
 const target=new URL(campaignReviewUrl(original,filters,'camp-a/b'));
 assert.equal(target.searchParams.get('sourceCampaign'),'camp-a/b');assert.equal(target.searchParams.get('sourceIssue'),'promotions');
 assert.equal(target.searchParams.get('campaignArea'),'sources');assert.equal(target.searchParams.has('campaign'),false);assert.equal(target.hash,'');
 for(const [key,value] of [['campaignSearch','Open House'],['campaignType','campus_seminar'],['campaignStatus','planning']])assert.equal(target.searchParams.get(key),value);
 const back=new URL(campaignReviewReturnUrl(original,filters));assert.equal(back.searchParams.get('campaign'),'camp-old');assert.equal(back.searchParams.get('campaignView'),'info');assert.equal(back.searchParams.has('sourceIssue'),false);
 const global=new URL(campaignReviewUrl(target.href,{search:'',type:'All',status:'All'}));
 for(const key of ['sourceIssue','sourceCampaign','campaignSearch','campaignType','campaignStatus'])assert.equal(global.searchParams.has(key),false,key);
});
test('review presence combines categories without summing unlike units or treating loading/failures as clear',()=>{
 assert.deepEqual(sourceReviewState(null,{available:false,counts:{}},true),{pending:false,loading:true,unavailable:false});
 assert.deepEqual(sourceReviewState(null,{available:true,counts:{}},false),{pending:false,loading:false,unavailable:true});
 assert.deepEqual(sourceReviewState(true,{available:false,counts:{}},false),{pending:true,loading:false,unavailable:true});
 assert.deepEqual(sourceReviewState(false,{available:true,counts:{a:2}},false),{pending:true,loading:false,unavailable:false});
 assert.deepEqual(sourceReviewState(false,{available:true,counts:{}},false),{pending:false,loading:false,unavailable:false});
});
test('heading exposes a manager-only secondary action, contextual return, and truthful availability text without module tabs',()=>{
 const props={reviewing:false,canManage:true,isLight:true,state:{pending:true,loading:false,unavailable:false},onOpen:()=>{},onReturn:()=>{}};
 const render=(patch:any={})=>renderToStaticMarkup(React.createElement(CampaignWorkspaceHeading,{...props,...patch}));
 const html=render();assert.match(html,/<h1[^>]*>Marketing Campaigns<\/h1>/);assert.match(html,/Source review/);assert.match(html,/Items need review/);assert.doesNotMatch(html,/<nav|Unverified sources|Review 2/);
 assert.doesNotMatch(render({canManage:false}),/<button|Source review|campaign-review-dot/);
 const review=render({reviewing:true});assert.match(review,/<h1[^>]*>Source review<\/h1>/);assert.match(review,/<span>Campaigns<\/span>/);assert.doesNotMatch(review,/campaign-source-review-trigger/);
 assert.match(render({state:{pending:false,loading:false,unavailable:true}}),/Status unavailable/);
});
