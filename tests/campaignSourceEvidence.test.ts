import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {campaignSourceEvidence} from '../server/portal/campaignSourceEvidence.ts';
import {CampaignSourceEvidence} from '../src/components/crm/CampaignSourceEvidence.tsx';
test('source evidence distinguishes original lead metadata from saved URL parameters and excludes unrelated entries/secrets',()=>{
 const profile={campaignId:'TEST-unknown',rawPromotionLinkId:'bad-p',promotionLinkStatus:'unverified',entryPoint:'unverified_source'};
 const evidence=campaignSourceEvidence(profile,[{id:'matching',source:'standalone_chat',updated_at:'2026-10-20T12:00:00Z',attribution:{page:'/chat?c=TEST-unknown&p=bad-p&utm_source=instagram&utm_medium=paid_social&utm_content=poster_A&utm_content=poster_B&token=PRIVATE_TEST_SECRET&email=private@example.invalid'}},{id:'unrelated',attribution:{page:'/chat?c=other&utm_source=unrelated'}},{id:'no-url',attribution:{campaign:'TEST-unknown'}}], 'test-UNKNOWN');
 assert.equal(evidence.leadField,'campaignId');assert.equal(evidence.entries.length,1);assert.equal(evidence.entries[0].path,'/chat');assert.equal(evidence.entries[0].lastActivityAt,'2026-10-20T12:00:00Z');assert.deepEqual(evidence.entries[0].parameters.filter(p=>p.key==='utm_content').map(p=>p.value),['poster_A','poster_B']);
 const html=renderToStaticMarkup(React.createElement(CampaignSourceEvidence,{source:{rawCode:'TEST-unknown',leads:[{id:'lead',name:'原名 TEST',rawCode:'TEST-unknown',evidence}]}}));
 assert.match(html,/instagram/);assert.match(html,/utm_source/);assert.match(html,/原名 TEST/);assert.doesNotMatch(JSON.stringify(evidence)+html,/PRIVATE_TEST_SECRET|private@example/);assert.doesNotMatch(JSON.stringify(evidence),/unrelated/);
});
test('missing or truncated URL data is not reconstructed; unsafe entries are excluded',()=>{
 const missing=campaignSourceEvidence({campaign:'old code'},[],'old code');assert.equal(missing.entries.length,0);assert.equal(missing.leadField,'campaign');
 const evidence=campaignSourceEvidence({},[{id:'truncated',attribution:{page:'/chat?c=x&utm_source='+ 'a'.repeat(300)}},{id:'bad',attribution:{page:'javascript:alert(1)?c=x'}}],'x');assert.equal(evidence.entries.length,1);assert.equal(evidence.entries[0].possiblyTruncated,true);
 const html=renderToStaticMarkup(React.createElement(CampaignSourceEvidence,{source:{rawCode:'old code',leads:[{id:'lead',name:'TEST',rawCode:'old code',evidence:missing}]}}));assert.match(html,/No matching conversation entry URL/);assert.match(html,/Not recorded/);assert.doesNotMatch(html,/href=/);
});
