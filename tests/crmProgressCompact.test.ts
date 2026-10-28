import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {CrmProgressSection} from '../src/components/crm/CrmProgressSection';
import {CrmSingleSelect} from '../src/components/crm/CrmSingleSelect';
import {CrmSimpleWorkflow} from '../src/components/crm/CrmSimpleWorkflow';
import {agreementChoice} from '../src/utils/crmProgressDetails';
test('original wording and time distinguish similar agreements without inventing unknown or date-only times',()=>{
 const base={id:'same-wording',action:'原始事项：电话核对课程 <保留原文>'},before=JSON.stringify(base);
 const exact=agreementChoice({...base,at:'2026-10-30T01:15:40Z'},'zh','America/Vancouver');
 assert.equal(exact.label,base.action);assert.match(exact.description,/10-29 18:15/);
 const date=agreementChoice({...base,date:'2026-10-30'},'zh','America/Vancouver');assert.match(date.description,/10-30 · 仅日期$/);assert.doesNotMatch(date.description,/:/);
 assert.equal(agreementChoice(base,'zh').description,'未约定时间');
 assert.equal(agreementChoice(base,'en').description,'No time agreed');assert.equal(agreementChoice(base,'id').description,'Waktu belum disepakati');
 assert.equal(JSON.stringify(base),before);
});
test('selected agreement keeps its full original content and time in one accessible control',()=>{
 const option={value:'a',label:'完整原约定'.repeat(45),description:'2099-11-08 · 仅日期'};
 const h=render(React.createElement(CrmSingleSelect,{label:'已有约定',value:'a',options:[option],lang:'zh',isLight:true,onChange:()=>{}}));
 assert.ok(h.includes(option.label));assert.ok(h.includes(option.description));assert.match(h,/class="crm-choice-title"/);assert.match(h,/class="crm-choice-description"/);assert.match(h,/aria-description=/);
 const ordinary=render(React.createElement(CrmSingleSelect,{label:'普通选项',value:'a',options:[{value:'a',label:'普通值'}],lang:'zh',isLight:true,onChange:()=>{}}));assert.doesNotMatch(ordinary,/class="crm-choice-detail"|class="crm-choice-description"/);
});
test('clear is a peer header action, never a nested button or a body row, with stable space in all languages',()=>{
 for(const lang of ['zh','en','id']){
  const props={id:'section',title:'客户约定',open:true,summary:'拟调整',onToggle:()=>{},onClear:()=>{},lang,children:React.createElement('input',{'aria-label':'保留字段'})};
  const dirty=render(React.createElement(CrmProgressSection,{...props,changed:true})),clean=render(React.createElement(CrmProgressSection,{...props,changed:false}));
  const heading=dirty.slice(0,dirty.indexOf('<fieldset'));
  assert.equal((heading.match(/<button/g)||[]).length,2);assert.match(heading,/<\/button><button/);assert.doesNotMatch(dirty.slice(dirty.indexOf('<fieldset')),/crm-progress-section-clear/);
  for(const h of [clean,dirty])assert.match(h,/crm-progress-section-clear-space" aria-hidden="true"/);
  assert.doesNotMatch(dirty,/crm-progress-section-tools/);
 }
});
test('progress opens with four text rows and shows selected original agreement only once, with no duplicate block',()=>{
 const agreement={id:'a',action:'TEST 唯一原约定内容',date:'2099-11-08',status:'active'};
 const h=render(React.createElement(CrmSimpleWorkflow,{lead:{id:'l',commitments:[agreement]},lang:'zh',isLight:true,timezone:'America/Vancouver',initialDraft:{simple:{summary:'TEST',agreementIntent:'update',commitmentChange:{id:'a',status:'fulfilled'}},sections:{agreement:true}}}));
 assert.match(h,/rows="4"/);assert.equal((h.match(/class="crm-choice-title">TEST 唯一原约定内容/g)||[]).length,1);
 assert.match(h,/2099-11-08 · 仅日期/);assert.doesNotMatch(h,/crm-simple-agreement-original/);
});
