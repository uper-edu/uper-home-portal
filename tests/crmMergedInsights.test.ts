import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {learningGoalEntries} from '../src/utils/crmProfileEvidence';
import {CrmProfileSourceContent} from '../src/components/crm/CrmProfileFields';
import {CrmCustomerProfile} from '../src/components/crm/CrmCustomerDetails';import {CrmProfileEditor} from '../src/components/crm/CrmProfileFields';import {CrmUiProvider} from '../src/components/crm/CrmUiLanguage';import {applyInsightObservation,validateInsightDimension} from '../src/utils/crmCustomerInsights';
const dimension=validateInsightDimension({labels:{zh:'报销条件',en:'Reimbursement conditions',id:'Ketentuan penggantian biaya'},definition:{zh:'报销条件说明',en:'Reimbursement terms',id:'Ketentuan penggantian'}},'reimbursement_conditions');
const base={id:'TEST-merged',fullName:'TEST',goal:'为了工作沟通',budgetAmount:0,reportedLevel:'HSK 2',city:'Jakarta',owner:'sales-a',currentStage:'progress:discovery'};
const lead=applyInsightObservation(base,dimension,{field:dimension.key,value:'HR审批后可报销',quote:'HR审批后可报销',basis:'stated',operation:'set',subject:'customer',temporality:'current',change:'state'},{eventId:'ai',sourceId:'original',sourceType:'sales_record',root:{id:'original',type:'sales_record'},recordedAt:'2026-10-29T07:00:00Z',occurredAt:null,baseRevision:0,amendment:false}).profile;
const render=(p:any=lead,disabled=false,lang='zh')=>renderToStaticMarkup(React.createElement(CrmUiProvider,{lang,children:React.createElement(CrmCustomerProfile,{lead:p,lang,timezone:'Asia/Jakarta',dynamicProfile:React.createElement(CrmProfileEditor,{lead:p,disabled,timezone:'Asia/Jakarta',onSaved(){}})})}));
test('one customer-insights chapter groups preset and dynamic evidence, leaves identity and business state separate',()=>{
 const before=JSON.stringify(lead),html=render();assert.equal((html.match(/<h3[^>]*>客户洞察<\/h3>/g)||[]).length,1);assert.match(html,/<h4>学习需求与偏好<\/h4>/);assert.match(html,/<h4>学习条件与决策背景<\/h4>/);for(const text of ['为了工作沟通','HR审批后可报销','客户自报水平','Rp0','原文依据'])assert.ok(html.includes(text));assert.doesNotMatch(html,/学习背景与需求|调整主要学习目标|调整课程总预算/);assert.equal(JSON.stringify(lead),before);
});
test('controlled correction is inside collapsed More actions, with unchanged read-only capability behavior',()=>{
 const html=render();assert.match(html,/<details class="crm-insights-more"/);assert.doesNotMatch(html,/<details class="crm-insights-more"[^>]*open/);assert.ok(html.indexOf('更多操作')<html.indexOf('人工纠正学习需求'));assert.doesNotMatch(render(lead,true),/更多操作|人工纠正学习需求/);
});
test('empty groups are omitted and fixed labels localize without translating saved original text',()=>{
 assert.doesNotMatch(render({...base,goal:undefined,budgetAmount:undefined,reportedLevel:undefined}),/学习需求与偏好|学习条件与决策背景|暂无当前洞察/);
 for(const lang of ['en','id']){const html=render(lead,false,lang);assert.doesNotMatch(html,/>客户洞察<|>学习需求与偏好<|>学习条件与决策背景<|>人工纠正学习需求</);assert.match(html,/为了工作沟通/);assert.match(html,/HR审批后可报销/);}
});

test('withdrawn or empty insights leave current profile, without mutating retained evidence or history',()=>{
 const insight=Object.values(lead.aiInsights)[0] as any;
 const withdrawn={...insight,status:'withdrawn',current:{...insight.current,status:'withdrawn',reason:'TEST 撤回原因',quote:'TEST 原文不再有效'}};
 const profile={...lead,aiInsights:{[dimension.key]:withdrawn}};
 const before=JSON.stringify(profile),html=render(profile);
 assert.doesNotMatch(html,/学习条件与决策背景|已撤回的洞察|HR审批后可报销|TEST 撤回原因/);
 assert.match(html,/学习需求与偏好/);assert.equal(JSON.stringify(profile),before);
 assert.equal(profile.aiInsights[dimension.key].current.quote,'TEST 原文不再有效');
 assert.equal(profile.aiInsights[dimension.key].history.length,insight.history.length);
 for(const value of ['',[],['  ']])assert.doesNotMatch(render({...lead,aiInsights:{[dimension.key]:{...insight,value}}}),/学习条件与决策背景/);
 assert.match(render({...lead,aiInsights:{[dimension.key]:{...insight,status:'tentative'}}}),/报销条件/);
});

test('multi-value learning goals deduplicate only identical saved strings and retain original-field links',()=>{
 const p={...base,goal:'提升中文能力',goals:['提升中文能力','职场交流','职场交流','提高中文能力'],profileFieldMeta:{goal:{sourceType:'questionnaire',sourceFactIds:['original-a']},goals:{sourceType:'ai_sales_text',sourceFactIds:['original-b']}}};
 const before=JSON.stringify(p),entries=learningGoalEntries(p);
 assert.deepEqual(entries,[{value:'提升中文能力',fields:['goal','goals']},{value:'职场交流',fields:['goals']},{value:'提高中文能力',fields:['goals']}]);
 const html=render(p);assert.match(html,/<dt>学习目标<\/dt>/);assert.doesNotMatch(html,/>主要学习目标<|>其他学习目标</);
 assert.equal((html.match(/class="crm-learning-goal-entry"/g)||[]).length,3);assert.match(html,/查看学习目标的原始依据/);assert.equal(JSON.stringify(p),before);
 for(const lang of ['en','id'])assert.doesNotMatch(render(p,false,lang),/>学习目标</);
});
test('unioned source viewer retains both fields, old changes, original wording and adoption reasons',()=>{
 const data=[{eventId:'a',leadId:'TEST',actor:'visitor',sourceChannel:'questionnaire',payload:{answers:{goal:'提升中文能力',goals:['提升中文能力','职场交流']}},original:'原始问卷'},
 {eventId:'b',leadId:'TEST',actor:'sales',payload:{changes:[{field:'goals',before:['原目标'],after:['提升中文能力','职场交流'],applied:true,reason:'客户明确增加工作目标'}]},original:'工作中需要中文'}];
 const html=renderToStaticMarkup(React.createElement(CrmUiProvider,{lang:'zh',children:React.createElement(CrmProfileSourceContent,{data,field:'goal',fields:['goal','goals']})}));
 for(const value of ['职场交流','原目标','客户明确增加工作目标','查看完整原始问卷','查看完整原始记录'])assert.ok(html.includes(value),value);
});
