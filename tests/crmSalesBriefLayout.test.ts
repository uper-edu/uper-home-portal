import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {CrmSalesBrief} from '../src/components/crm/CrmSalesBrief';
const lead={id:'a',currentStage:'progress:proposal',goal:'准备汉语水平考试',mode:'Online',city:'Jakarta',availability:'周六晚',preferredStart:'2026年11月',budgetAmount:1800000,profileFieldMeta:{goal:{sourceType:'questionnaire',sourceFactIds:['q']}}};
const render=(value:any=lead)=>renderToStaticMarkup(React.createElement(CrmSalesBrief,{lead:value,lang:'zh',onProfile(){},onEvidence(){},milestones:React.createElement('section',{'aria-label':'事实里程碑'},'EVENT')}));
test('stage, milestones and one goal remain in order; complete needs are not repeated',()=>{const before=JSON.stringify(lead),html=render();assert.ok(html.indexOf('销售阶段')<html.indexOf('EVENT'));assert.ok(html.indexOf('EVENT')<html.indexOf('学习目标'));assert.match(html,/准备汉语水平考试/);assert.match(html,/查看学习需求/);assert.match(html,/查看主要目标的原文依据/);assert.doesNotMatch(html,/Jakarta|周六晚|2026年11月|1,800,000|线上直播|预算信息依据/);assert.equal(JSON.stringify(lead),before);});
test('missing goal is one neutral state with a needs link, not inferred from other fields',()=>{const html=render({...lead,goal:undefined});assert.match(html,/暂无记录/);assert.match(html,/查看学习需求/);assert.doesNotMatch(html,/准备汉语水平考试|预算|没有顾虑/);});
test('long original goal stays complete in DOM and tooltip, without changing the value',()=>{const goal='客户希望学习工作交流、商务邮件和跨部门会议表达。'.repeat(20),html=render({...lead,goal});assert.ok(html.includes(goal));assert.ok(html.includes('title="'+goal+'"'));assert.equal(lead.goal,'准备汉语水平考试');});
test('stage is read-only and stop-contact warning survives removal of full needs',()=>{const html=render({...lead,contactArrangement:{state:'stopped',reason:'客户要求不再主动联系'}});assert.match(html,/已停止主动联系/);assert.match(html,/客户要求不再主动联系/);assert.doesNotMatch(html,/更新阶段/);});

import {CrmProfileEditor} from '../src/components/crm/CrmProfileFields';
test('complete needs and source actions remain in Profile after removal from Follow-up',()=>{
 const p={...lead,concerns:['担心时间冲突'],communicationLanguage:'id',preferredChannel:'WhatsApp'};
 const html=renderToStaticMarkup(React.createElement(CrmProfileEditor,{lead:p,timezone:'Asia/Jakarta',isLight:true}));
 for(const value of ['学习背景与需求','周六晚','2026年11月','1,800,000','担心时间冲突','调整学习需求'])assert.ok(html.includes(value),value);
});
