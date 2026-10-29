import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {CrmProfileSourceContent,CrmProfileOriginalRecord} from '../src/components/crm/CrmProfileFields';import {CrmUiProvider} from '../src/components/crm/CrmUiLanguage';
const q={eventId:'q',eventType:'questionnaire.submitted',actor:'visitor',recordedAt:'2026-10-29T08:00:00Z',original:'客户提交问卷',payload:{answers:{goal:'工作中文',goals:['工作中文'],city:'Bandung',fullName:'TEST SOURCES',mode:'Online'}}};
const adopted={eventId:'applied',eventType:'profile.fields_updated',actor:'visitor',recordedAt:q.recordedAt,original:q.original,payload:{basisFactIds:['q'],changes:[{field:'goal',after:'工作中文',before:null,applied:true},{field:'goals',after:['工作中文'],before:null,applied:true},{field:'city',after:'Bandung',applied:true}]}};
const render=(child:React.ReactNode,lang='zh')=>renderToStaticMarkup(React.createElement(CrmUiProvider,{lang,children:child}));
test('scoped goal evidence excludes unrelated fields and collapses exact answers from linked questionnaire adoption only',()=>{
 const data=[adopted,q],before=JSON.stringify(data),html=render(React.createElement(CrmProfileSourceContent,{data,field:'goal',fields:['goal','goals']}));
 assert.equal(html.split('工作中文').length-1,1);assert.match(html,/当次已采用/);assert.match(html,/查看完整原始问卷/);assert.doesNotMatch(html,/Bandung|TEST SOURCES|城市|授课方式|完整原文与关联记录/);assert.equal(JSON.stringify(data),before);
 for(const lang of ['en','id'])assert.doesNotMatch(render(React.createElement(CrmProfileSourceContent,{data,field:'goal',fields:['goal','goals']}),lang),/>查看原始问卷</);
});
test('independent source reader retains the questionnaire and unrestricted original text without exposing JSON internals',()=>{
 const html=render(React.createElement(CrmProfileOriginalRecord,{event:q}));for(const text of ['Bandung','TEST SOURCES','工作中文'])assert.ok(html.includes(text));assert.doesNotMatch(html,/eventId|basisFactIds|"answers"/);
 const source={...q,payload:{},original:'TEST 原文：工作需要中文；预算150万。'};
 assert.match(render(React.createElement(CrmProfileOriginalRecord,{event:source})),/工作需要中文；预算150万。/);
});
test('real changed values and non-adoption reasons survive even with a linked original questionnaire',()=>{
 const changed={...adopted,payload:{basisFactIds:['q'],changes:[{field:'goal',before:'旧目标',after:'新目标',applied:true,reason:'客户明确更改'},{field:'goals',observation:['不同目标'],applied:false,reason:'不同来源未覆盖'}]}};
 const html=render(React.createElement(CrmProfileSourceContent,{data:[q,changed],field:'goal',fields:['goal','goals']}));for(const text of ['旧目标','新目标','客户明确更改','不同目标','不同来源未覆盖'])assert.ok(html.includes(text));
});
