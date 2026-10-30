import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {buildHistoryTimeline,historyAssessment} from '../src/utils/crmHistoryTimeline';
import {historyAssessmentCounts,historyOwnerNames,historyResultKind,historyResultReasons,historyResultRows} from '../src/utils/crmHistoryResultContent';
import {CrmHistoryResultCard,CrmHistoryResultHeadline,CrmHistoryResultPreview} from '../src/components/crm/CrmHistoryResultCard';
import {CrmHistorySources} from '../src/components/crm/CrmHistorySources';
import {CrmUiProvider} from '../src/components/crm/CrmUiLanguage';
import {crmUiText} from '../src/utils/crmUiText';
const group=(type:string,payload:any,original='')=>buildHistoryTimeline([{eventId:'event',eventType:type,actor:'Robert',payload,original,recordedAt:'2026-10-29T16:00:00Z'}],{id:'test'})[0];
const markup=(element:React.ReactNode,lang:any='zh')=>render(React.createElement(CrmUiProvider,{lang,children:element}));

test('profile change uses only its own root, preserves zero and clear, distinguishes absent from empty old values',()=>{
 const g=group('profile.fields_updated',{changes:[{field:'budgetAmount',before:2000000,after:0,applied:true},{field:'city',before:null,after:'Bandung',applied:true},{field:'goal',after:[],applied:true},{field:'internalRequestId',before:'secret-before',after:'secret-after',applied:true}]},'客户确认新预算与目标');
 g.events.push({eventId:'another',eventType:'profile.fields_updated',payload:{changes:[{field:'city',before:'Bandung',after:'Jakarta',applied:true}]}});
 const before=JSON.stringify(g),rows=historyResultRows(g);
 assert.equal(rows.length,3);assert.equal(rows[0].value,0);assert.equal(rows[0].showBefore,true);
 assert.equal(rows[1].note,'本次新增');assert.equal(rows[1].showBefore,false);assert.equal(rows[2].note,'原值未记录');
 const html=markup(React.createElement(CrmHistoryResultCard,{group:g}));assert.ok(!html.includes('Jakarta'));assert.ok(!html.includes('secret-after'));assert.ok(html.includes('明确清空'));assert.equal(JSON.stringify(g),before);
});
test('unadopted or unknown observations never pretend a before-to-after transition',()=>{
 const g=group('profile.fields_updated',{changes:[{field:'city',before:'Jakarta',observation:'Bandung',applied:false},{field:'goal',before:'work',after:'study'}]});
 const rows=historyResultRows(g);assert.equal(rows[0].value,'Bandung');assert.equal(rows[0].showBefore,false);assert.equal(rows[0].note,'未采用，保留不同记录');assert.equal(rows[1].showBefore,false);
 const html=markup(React.createElement(CrmHistoryResultCard,{group:g}));assert.ok(!html.includes('→'));assert.ok(html.indexOf('Bandung')<html.indexOf('未采用，保留不同记录'));
});
test('legacy manual saved fields use explicit historical before only and hide unknown keys',()=>{
 const g=group('profile.changed',{before:{city:'Bandung'},changes:{city:'Jakarta',communicationLanguage:'id',internalKey:'never-display'}});
 const rows=historyResultRows(g);assert.equal(rows.length,2);assert.equal(rows[0].showBefore,true);assert.equal(rows[1].note,'原值未记录');
});
test('assessment zero remains zero; no saved denominator or placement is invented',()=>{
 const g=group('assessment.submitted',{result:{score:0,questionCount:30,correctCount:0,unansweredCount:-1,internalId:'paper-secret'}});
 assert.equal(historyResultKind(g),'assessment');assert.ok(historyAssessment(g).detail.includes('0 分（满分未知）'));
 assert.deepEqual(historyAssessmentCounts(g).map(c=>c.value),[30,0]);
 const html=markup(React.createElement(CrmHistoryResultCard,{group:g}));assert.ok(html.includes('依据不完整'));assert.ok(!html.includes('paper-secret'));assert.ok(!html.includes('JSON'));
});
test('assessment conclusions reuse exact saved grading evidence without modifying or regrading it',()=>{
 const g=group('assessment.submitted',{result:{score:62,maxScore:100,attempt:{mode:'full'},thresholds:[{level:'HSK 1',reached:true},{level:'HSK 2',reached:false},{level:'HSK 3',reached:false}]}});
 const before=JSON.stringify(g);assert.ok(historyAssessment(g).conclusion.includes('达到本卷 HSK 1 设定标准'));
 const html=markup(React.createElement(CrmHistoryResultCard,{group:g}));assert.equal((html.match(/62\/100/g)||[]).length,1);assert.equal(JSON.stringify(g),before);
});
test('missing assessment and JSON originals use the established saved-result parser only',()=>{
 const missing=group('assessment.submitted',{});assert.equal(historyAssessmentCounts(missing).length,0);assert.ok(historyAssessment(missing).detail.includes('本条未附完整结果'));
 const json=group('assessment.submitted',{},JSON.stringify({score:3,maxScore:15}));assert.ok(historyAssessment(json).detail.includes('3/15'));
});
test('stage transition shows historical labels, one explanation and keeps shared state colors',()=>{
 const g=group('stage.changed',{before:'progress:discovery',after:'progress:registration',reason:'客户确认报名安排'},'客户确认报名安排');
 assert.deepEqual(historyResultReasons(g),['客户确认报名安排']);
 const html=markup(React.createElement(CrmHistoryResultCard,{group:g}));assert.equal((html.match(/客户确认报名安排/g)||[]).length,1);assert.ok(html.includes('data-stage-tone="registration"'));assert.ok(html.includes('→'));
 const missing=group('stage.changed',{after:'progress:registration'});assert.ok(markup(React.createElement(CrmHistoryResultHeadline,{group:missing})).includes('原阶段未记录'));
});
test('owner names are saved snapshots, unassigned is distinct from missing, ids do not leak',()=>{
 const g=group('owner.changed',{before:null,after:'user-7',afterName:'Wigar',reason:'自己认领'});
 assert.deepEqual(historyOwnerNames(g).map(x=>x.text),['未分配','Wigar']);
 const html=markup(React.createElement(CrmHistoryResultCard,{group:g}));assert.ok(html.includes('Wigar'));assert.ok(!html.includes('user-7'));assert.equal((html.match(/自己认领/g)||[]).length,1);
 const missing=group('owner.changed',{after:'3b3360fa-dd2c-40ac-b21f-8c12ba7358c8',afterName:'3b3360fa-dd2c-40ac-b21f-8c12ba7358c8'});
 assert.deepEqual(historyOwnerNames(missing).map(x=>x.text),['原负责人姓名未记录','新负责人姓名未记录']);
 const readable=group('owner.changed',{beforeName:'Robert',before:'Robert',afterName:'Wigar',after:'Wigar'});assert.equal(historyOwnerNames(readable)[0].text,'Robert');
});
test('represented root reason is not repeated but independent linked reasons remain accessible',()=>{
 const g=group('stage.changed',{before:'progress:discovery',after:'progress:registration',reason:'root-reason'},'root-reason');
 g.events.push({eventId:'linked',eventType:'fact.corrected',payload:{reason:'independent-reason'},original:'independent-original'});
 const html=markup(React.createElement(CrmHistorySources,{group:g,disabled:true,representedRoot:true}));assert.ok(!html.includes('root-reason'));assert.ok(html.includes('independent-reason'));assert.ok(html.includes('independent-original'));
 const legacy=markup(React.createElement(CrmHistorySources,{group:g,disabled:true}));assert.ok(legacy.includes('root-reason'));
});
test('each of the three UI languages translates labels while preserving staff names and original reasons',()=>{
 const g=group('owner.changed',{before:null,after:'staff',afterName:'Wigar',reason:'原文理由不翻译'});
 for(const lang of ['zh','en','id']){
  const html=markup(React.createElement(CrmHistoryResultCard,{group:g}),lang);assert.ok(html.includes('Wigar'));assert.ok(html.includes('原文理由不翻译'));assert.ok(html.includes(crmUiText('变更依据',lang)));
  const profile=group('profile.fields_updated',{changes:[{field:'city',before:'Jakarta',observation:'Bandung',applied:false}]});
  const preview=markup(React.createElement(CrmHistoryResultHeadline,{group:profile}),lang);assert.ok(preview.includes(crmUiText('未采用，保留不同记录',lang)));assert.ok(preview.indexOf('Bandung')<preview.indexOf(crmUiText('未采用，保留不同记录',lang)));
  assert.ok(markup(React.createElement(CrmHistoryResultPreview,{group:group('assessment.submitted',{result:{score:0,maxScore:30}})}),lang).length>0);
 }
});
