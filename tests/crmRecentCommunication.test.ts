import{test}from'node:test';import assert from'node:assert/strict';import React from'react';import{renderToStaticMarkup}from'react-dom/server';import{CrmFollowupContext,CrmContactRestriction}from'../src/components/crm/CrmFollowupContext';import{CrmNoResponseSummary}from'../src/components/crm/CrmNoResponseSummary';
const langs=['zh','en','id'];const render=(Component:any,lead:any,lang='zh')=>renderToStaticMarkup(React.createElement(Component,{lead,lang,timezone:'Asia/Jakarta',tasks:[]}));
test('ordinary review is a task, not a restriction or another empty status card',()=>{
 const lead={id:'empty',contactArrangement:{state:'active'},contactReview:{reviewAt:'2099-09-01T05:00:00Z',reason:'Do not duplicate this task',blockBefore:false}};
 for(const lang of langs){const html=render(CrmFollowupContext,lead,lang);assert.doesNotMatch(html,/Do not duplicate|2099-09|crm-recent-no-response|crm-contact-restriction|crm-recent-row/);assert.equal(render(CrmContactRestriction,lead,lang),'');assert.match(html,/crm-recent-empty/);}
});
test('explicit future restriction and stopped contact retain their own reason; expired agreement disappears only by existing clock rule',()=>{
 const lead={contactArrangement:{state:'active'},contactReview:{reviewAt:'2099-09-01T05:00:00Z',reason:'Original agreed restriction',blockBefore:true}};
 for(const lang of langs){assert.match(render(CrmContactRestriction,lead,lang),/Original agreed restriction|2099-09-01/);const stopped=render(CrmContactRestriction,{...lead,contactArrangement:{state:'stopped',reason:'Customer asked to stop'}},lang);assert.match(stopped,/Customer asked to stop/);assert.doesNotMatch(stopped,/Original agreed restriction|2099-09/);}
 assert.equal(render(CrmContactRestriction,{...lead,contactReview:{...lead.contactReview,reviewAt:'2020-01-01T00:00:00Z'}}),'');
 assert.match(render(CrmContactRestriction,{contactArrangement:{state:'waiting',reason:'Legacy reason'}}),/Legacy reason/);
});
test('latest unanswered attempt precedes earlier connected note; same connected record is never repeated and original text stays unchanged',()=>{
 const connected={id:'a',connectStatus:'Connected',channel:'WhatsApp',staffName:'Robert',timestamp:'2026-10-21T02:00:00Z',summary:'原始已回复正文'},attempt={id:'b',connectStatus:'No Response',channel:'WhatsApp',staffName:'Fadhil',timestamp:'2026-10-22T02:00:00Z',summary:'Original unanswered note'};
 const lead={id:'record',followUpLogs:[connected,attempt]},before=JSON.stringify(lead);
 for(const lang of langs){const html=render(CrmFollowupContext,lead,lang);assert.ok(html.indexOf(attempt.summary)<html.indexOf(connected.summary));assert.equal(html.split(connected.summary).length-1,1);assert.equal(render(CrmFollowupContext,{...lead,followUpLogs:[connected]},lang).split(connected.summary).length-1,1);}
 assert.equal(JSON.stringify(lead),before);
});
test('unanswered sequence hides empty or cleared states while retaining counts and exceptions in an expandable summary',()=>{
 for(const lang of langs){assert.equal(render(CrmNoResponseSummary,{},lang),'');assert.equal(render(CrmNoResponseSummary,{noResponseSequence:{count:0,status:'replied'}},lang),'');assert.match(render(CrmNoResponseSummary,{noResponseSequence:{count:2,status:'counting',policy:{threshold:3}}},lang),/2 \/ 3/);assert.match(render(CrmNoResponseSummary,{noResponseSequence:{count:0,status:'counting',lastOutcome:'wrong_number'}},lang),/<details/);assert.match(render(CrmNoResponseSummary,{noResponseSequence:{count:0,status:'replied',needsGroupReview:true}},lang),/<details/);}
});
