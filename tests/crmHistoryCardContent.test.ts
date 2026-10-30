import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {buildHistoryTimeline,historyBusinessTitle} from '../src/utils/crmHistoryTimeline';
import {historyOrigin} from '../src/utils/crmHistoryOrigin';
import {historyRecordCorrections,historyHasSeparateRecordingTime,historyCardDetailRows} from '../src/utils/crmHistoryCardContent';
import {CrmHistoryRecordCorrections} from '../src/components/crm/CrmHistoryRecordCorrections';
import {CrmHistoryQuestionnaireOriginal} from '../src/components/crm/CrmHistoryInformation';
import {CrmUiProvider} from '../src/components/crm/CrmUiLanguage';
import {crmUiText} from '../src/utils/crmUiText';
const group:any={id:'log:one',category:'sales',original:'预算180万',events:[{eventId:'amend',eventType:'record.amended',payload:{id:'am',kind:'correction'},original:'预算修正为190万'}],extractions:[]};
const item=(id:string,extra:any={})=>({id,scope:'am',kind:'field',field:'budgetAmount',label:'课程总预算',value:1900000,before:1800000,beforeKnown:true,status:'applied',superseded:false,sources:[],reasons:[],citations:[],factIds:[],extractionIds:[],aiReferences:[],...extra});

test('stage transitions have a distinct business category and preserve identity, history and title in all languages',()=>{
 const event={eventId:'stage',eventType:'stage.changed',actor:'Robert',recordedAt:'2026-10-29T09:00:00Z',payload:{before:'progress:unreached',after:'progress:engaged'},original:'客户已回复'};
 const before=JSON.stringify(event),g=buildHistoryTimeline([event],{id:'lead'})[0];
 assert.equal(g.category,'stage');assert.equal(historyOrigin(g).format,'销售阶段');assert.equal(historyOrigin(g).lane,'staff');
 for(const lang of ['zh','en','id'])assert.ok(historyBusinessTitle(g,lang).startsWith(crmUiText('销售阶段：',lang)));
 assert.equal(g.events[0],event);assert.equal(JSON.stringify(event),before);
});

test('one source caption preserves the supplied staff name and never invents a system author',()=>{
 assert.equal(historyOrigin({category:'profile',root:{payload:{staffName:'Robert Hui'},actor:'Robert'}}).author,'Robert Hui');
 assert.equal(historyOrigin({category:'profile',root:{}}).author,'记录者未注明');
 assert.equal(historyOrigin({category:'profile',root:{actor:'system'}}).author,'系统');
 assert.equal(historyOrigin({category:'profile',root:{actor:'ai'}}).author,'AI整理');
});

test('correction highlight selects only exact, adopted, unsuperseded record corrections, never current profile',()=>{
 const items=[item('old',{scope:'main',value:1800000,superseded:true}),item('current'),item('rejected',{status:'difference',value:2000000}),item('unknown',{status:'unknown',value:2100000}),item('protected',{kind:'protected_field',field:'email'}),item('other',{scope:'different-record',value:2200000})];
 const before=JSON.stringify({group,items});assert.deepEqual(historyRecordCorrections({...group,currentProfile:{budgetAmount:999999}},items).map(i=>i.id),['current']);assert.equal(JSON.stringify({group,items}),before);
 assert.deepEqual(historyRecordCorrections({...group,events:[]},items),[]);
 assert.deepEqual(historyRecordCorrections({...group,events:[{...group.events[0],payload:{id:'am',kind:'supplement'}}]},items),[]);
 assert.deepEqual(historyRecordCorrections(group,[item('superseded',{superseded:true})]),[]);
 assert.deepEqual(historyRecordCorrections(group,[item('missing-value',{value:undefined})]),[]);
});

test('ambiguous correction values are not guessed, equal values render once, zero and explicit clearing survive',()=>{
 assert.deepEqual(historyRecordCorrections(group,[item('a'),item('b',{value:2000000})]),[]);
 assert.equal(historyRecordCorrections(group,[item('a'),item('b')]).length,1);
 for(const value of [0,null])assert.equal(historyRecordCorrections(group,[item('a',{value})])[0].value,value);
});

test('correction heading is scoped to this record, original history remains immutable and three-language labels render',()=>{
 for(const lang of ['zh','en','id']){
  const html=render(React.createElement(CrmUiProvider,{lang},React.createElement(CrmHistoryRecordCorrections,{group,items:[item('a')],onEvidence(){}})));
  assert.ok(html.includes(crmUiText('本条记录修正后',lang)));assert.ok(html.includes(crmUiText('查看修正依据',lang)));assert.match(html,/Rp1[,.]900[,.]000/);assert.doesNotMatch(html,/Rp1,800,000|当前预算|current budget/);
 }
 assert.equal(group.original,'预算180万');assert.equal(group.events[0].original,'预算修正为190万');
});

test('only truly separate recording instants show secondary time; unknown occurrence never borrows recording time',()=>{
 const at='2026-10-29T09:00:00Z';
 assert.equal(historyHasSeparateRecordingTime({...group,displayAt:at,recordedAt:'2026-10-29T16:00:00+07:00'}),false);
 assert.equal(historyHasSeparateRecordingTime({...group,displayAt:at,recordedAt:'2026-10-29T09:01:00Z'}),true);
 assert.equal(historyHasSeparateRecordingTime({...group,displayAt:null,recordedAt:at}),true);
 assert.equal(historyHasSeparateRecordingTime({...group,displayAt:at,recordedAt:null}),false);
});

test('questionnaire removes duplicate times only in window presentation, preserving all answers and default evidence views',()=>{
 const g={id:'q',root:{payload:{answers:{fullName:'TEST客户',city:'Bandung',goal:'HSK'},submittedAt:'2026-10-29T09:00:00Z'},recordedAt:'2026-10-29T09:01:00Z'}};
 const before=JSON.stringify(g),html=render(React.createElement(CrmHistoryQuestionnaireOriginal,{group:g,showTimes:false}));
 assert.match(html,/TEST客户/);assert.match(html,/Bandung/);assert.match(html,/HSK/);assert.doesNotMatch(html,/<time/);
 const original=render(React.createElement(CrmHistoryQuestionnaireOriginal,{group:g}));assert.equal((original.match(/<time /g)||[]).length,2);assert.equal(JSON.stringify(g),before);
});

test('historical contact and first requirement captions never alter the recorded values or current agreement status',()=>{
 const rows=[{label:'实际联系结果',value:'已接通／已回复'},{label:'首次联系要求',value:'当次已完成'},{label:'主动联系安排',value:'已停止主动联系'},{label:'该约定当前状态',value:'已取消'}],before=JSON.stringify(rows),view=historyCardDetailRows(rows);
 assert.deepEqual(view.map(v=>v.label),['当时记录的联系结果','当时首次联系要求','当次主动联系安排','该约定当前状态']);assert.deepEqual(view.map(v=>v.value),rows.map(v=>v.value));assert.equal(JSON.stringify(rows),before);
});

test('every new fixed caption has English and Indonesian translations',()=>{
 for(const key of ['本条记录修正后','查看修正依据','本条记录修正后的联系结果：','当时记录的联系结果','当时首次联系要求','当次销售阶段变更','当次主动联系安排','原文（修正前）','当时撤回的洞察','修正历史与处理详情','记录与处理详情','卡片时间：','系统录入时间'])for(const lang of ['en','id'])assert.notEqual(crmUiText(key,lang),key);
});
