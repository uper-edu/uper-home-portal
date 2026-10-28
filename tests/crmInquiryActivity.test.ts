import test from 'node:test';
import assert from 'node:assert/strict';
import {isFollowupInquiry} from '../src/utils/crmInquiryActivity.ts';
import {attachInteractionTimelines} from '../server/portal/interactionTimeline.ts';
import {leadAnalyticRow,matchesMetricRow} from '../src/utils/crmLeadAnalytics.ts';

test('receipt role is explicit; first registration stays excluded even after later consolidation',()=>{
 assert.equal(isFollowupInquiry({metadata:{customerActivity:'initial_registration'},prior_inquiry:1,prior_questionnaire:1}),false);
 assert.equal(isFollowupInquiry({metadata:{customerActivity:'followup_inquiry'}}),true);
 assert.equal(isFollowupInquiry({metadata:{}}),false);
 assert.equal(isFollowupInquiry({prior_inquiry:1}),true);
 assert.equal(isFollowupInquiry({prior_questionnaire:1}),true);
});
const at='2026-10-27T16:00:00Z';
const receipt=(extra:any={})=>({lead_id:'B',message_id:'m1',message_at:at,original_text:'原始咨询 unchanged',conversation_id:'c1',metadata:{customerActivity:'followup_inquiry'},...extra});
async function project(receipts:any[],engagements:any[]=[],lead:any={id:'A',identitySources:[{id:'B'}]}){
 const calls:any[]=[];
 const db={query:async(sql:string,args:any[])=>{calls.push({sql,args});return {rows:sql.includes('FROM messages m JOIN conversations')?receipts:engagements};}};
 await attachInteractionTimelines(db,[lead]);return {lead,calls};
}
test('read projection follows authorized A/B group and original receipt IDs without changing sales facts',async()=>{
 const {lead,calls}=await project([receipt()]);
 assert.deepEqual(JSON.parse(calls[1].args[0]),['A','B']);
 assert.equal(lead.interactionTimeline.customer.channel,'contact_form');
 assert.equal(lead.interactionTimeline.customer.messageId,'m1');
 assert.equal(lead.interactionTimeline.customer.at,new Date(at).toISOString());
 assert.equal(lead.interactionTimeline.customer.text,'原始咨询 unchanged');
 assert.equal(lead.interactionTimeline.sales,null);assert.equal(lead.interactionTimeline.communication,null);
});
test('initial, unknown history, empty and undated receipts never invent activity',async()=>{
 const {lead}=await project([receipt({metadata:{customerActivity:'initial_registration'}}),receipt({metadata:{}}),receipt({original_text:' '}),receipt({message_at:null})]);
 assert.equal(lead.interactionTimeline.customer,null);
});
test('latest new inquiry participates in rolling-seven-day filtering; same receipt retry does not add customers',async()=>{
 const old={lead_id:'B',kind:'message',id:'old',message_id:'old',original_text:'旧消息',message_at:'2026-10-01T00:00:00Z',data:{conversationId:'c0'}};
 const {lead}=await project([receipt(),receipt()],[old]);
 const row=leadAnalyticRow(lead,Date.parse('2026-10-28T00:00:00Z'));
 assert.equal(matchesMetricRow(row,'recent_customer'),true);
 assert.equal(lead.interactionTimeline.customer.messageId,'m1');
 assert.equal(matchesMetricRow(leadAnalyticRow(lead,Date.parse('2026-11-04T00:00:00Z')),'recent_customer'),false);
});
test('later chat remains latest; inquiry legacy classification does not rely on canonical A registration',async()=>{
 const newer={lead_id:'B',kind:'message',id:'new',message_id:'new',original_text:'后续AI咨询',message_at:'2026-10-28T18:00:00Z',data:{conversationId:'c2'}};
 const {lead}=await project([receipt({metadata:{},prior_inquiry:1})],[newer]);assert.equal(lead.interactionTimeline.customer.messageId,'new');
});
