import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup as render} from 'react-dom/server';
import {historyAgreementStatus,historyProgressDetails} from '../src/utils/crmProgressDetails';
import {CrmHistoryInformation} from '../src/components/crm/CrmHistoryInformation';
import {CrmUiProvider} from '../src/components/crm/CrmUiLanguage';
import {crmUiText} from '../src/utils/crmUiText';
const log={id:'log-new',requestId:'request-new',summary:'双方约定周五确认周六课程。',commitment:{action:'周五通过WhatsApp确认周六课程',date:'2026-10-30'}};
const lead={commitments:[{id:'agreement',sourceId:'request-new',action:log.commitment.action,date:'2026-10-30',status:'active'}]};
const observation={kind:'agreement',field:'agreement',value:'周五确认周六课程',quote:'双方约定周五确认周六课程',start:0,subject:'customer',temporality:'future',decision:'suggestion',reason:'仅供销售采用，不自动建立客户约定'};
const group:any={id:'log:log-new',category:'sales',log,original:log.summary,events:[],extractions:[{id:'extraction',source_type:'sales_record',source_id:log.id,status:'completed',input:{text:log.summary},output:{observations:[observation]}}]};
test('historical registration retains original text/date while current status uses the saved request identity',()=>{
 const before=JSON.stringify({log,lead});const rows=historyProgressDetails(log,lead,[],'Asia/Jakarta');
 assert.equal(rows.find(r=>r.label==='当次登记的客户约定')?.value,log.commitment.action);assert.equal(rows.find(r=>r.label==='当次约定时间')?.value,'2026-10-30 · 仅日期');assert.equal(rows.find(r=>r.label==='该约定当前状态')?.value,'当前有效');assert.equal(JSON.stringify({log,lead}),before);
});
test('completed/cancelled/rescheduled/withdrawn current states never overwrite historical registration',()=>{
 for(const [state,label] of Object.entries({fulfilled:'已履行',cancelled:'已取消',rescheduled:'已改约',withdrawn:'误记已撤回'})){
 const changed={commitments:[{...lead.commitments[0],status:state,action:'后来的事项',date:'2099-01-01'}]};assert.equal(historyAgreementStatus(log,changed),label);const rows=historyProgressDetails(log,changed,[],'UTC');assert.equal(rows.find(r=>r.label==='当次登记的客户约定')?.value,log.commitment.action);assert.equal(rows.find(r=>r.label==='当次约定时间')?.value,'2026-10-30 · 仅日期');}
});
test('equal text, missing links, multiple candidates and earlier records do not prove adoption',()=>{
 assert.equal(historyAgreementStatus({...log,id:'earlier',requestId:'earlier-request'},lead),'当前状态暂不可用');assert.equal(historyAgreementStatus(log,{commitments:[{...lead.commitments[0],sourceId:'other'}]}),'当前状态暂不可用');assert.equal(historyAgreementStatus(log,{commitments:[...lead.commitments,{...lead.commitments[0],id:'second'}]}),'当前状态暂不可用');assert.equal(historyAgreementStatus(log,{}),'当前状态暂不可用');assert.equal(historyAgreementStatus(log,{commitments:[{...lead.commitments[0],sourceId:log.id}]}),'当前有效');
});
test('AI arrangement summary and its citation are retained only in a closed disclosure, with neutral wording',()=>{
 const before=JSON.stringify(group);const html=render(React.createElement(CrmHistoryInformation,{group}));assert.match(html,/<details[^>]*><summary>原文中的安排描述<\/summary>/);assert.doesNotMatch(html,/<details[^>]*\bopen\b/);assert.match(html,/周五确认周六课程/);assert.match(html,/定位原文/);assert.doesNotMatch(html,/未经销售确认|仅作建议|仅供销售采用|不自动建立客户约定/);assert.equal(JSON.stringify(group),before);
});
test('earlier or multiple descriptions remain independent evidence, without being marked adopted',()=>{
 const g={...group,log:undefined,extractions:[{...group.extractions[0],output:{observations:[observation,{...observation,value:'另一个安排',temporality:'negated'}]}}]};const html=render(React.createElement(CrmHistoryInformation,{group:g}));assert.match(html,/周五确认周六课程/);assert.match(html,/另一个安排/);assert.match(html,/否定表达/);assert.doesNotMatch(html,/当次已采用|当前有效/);
});
test('Chinese/English/Indonesian fixed arrangement labels are translated in rendered evidence',()=>{
 for(const lang of ['zh','en','id']){for(const key of ['原文中的安排描述','原文整理','当次登记的客户约定','当次约定时间','该约定当前状态','当前状态暂不可用','当前有效'])assert.ok(lang==='zh'||crmUiText(key,lang)!==key);const html=render(React.createElement(CrmUiProvider,{lang},React.createElement(CrmHistoryInformation,{group})));assert.match(html,new RegExp(crmUiText('原文中的安排描述',lang)));assert.doesNotMatch(html,/未经销售确认|仅供销售采用/);}
});

test('arrangement locator remains meaningful alongside multiple profile citations, without a zero reference number',()=>{
 const fields=[{...observation,kind:'field',field:'city',value:'Jakarta',quote:'客户住雅加达',decision:'evidence'},{...observation,kind:'field',field:'availability',value:'周六',quote:'周六有时间',decision:'evidence'}];
 const g={...group,extractions:[{...group.extractions[0],output:{observations:[...fields,observation]}}]};const html=render(React.createElement(CrmHistoryInformation,{group:g}));assert.match(html,/客户住雅加达/);assert.match(html,/周六有时间/);assert.match(html,/查看原文中的安排描述的原文依据：/);assert.doesNotMatch(html,/原文依据 0/);
});
