import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {CrmGroupedFollowup} from '../src/components/crm/CrmGroupedFollowup';
import {CrmFollowupEvent} from '../src/components/crm/CrmFollowupEvent';
const original='客户希望周六晚上学习，我已发送排期，尚未确认。';
function point(changes=true):any{return {id:'i',title:'资料更新、有效沟通',evidenceId:'source-a',origin:{category:'sales',original,extractions:[]},times:[{label:'实际发生于',at:'2026-10-26T11:50:56Z'}],parts:[{kind:'communication',value:{text:original}},...(changes?[{kind:'changes',changes:[{id:'c',value:{id:'change:availability',presentationChange:{before:'周日',after:'周六晚上'}}}]}]:[])]};}
test('short original remains visible above field results without a no-op expander',()=>{const p=point(),before=JSON.stringify(p);const html=render(React.createElement(CrmGroupedFollowup,{point:p,lead:{availability:'周六晚上'},lang:'zh',onEvidence:()=>{}}));assert.equal(html.split(original).length-1,1);assert.doesNotMatch(html,/aria-expanded/);assert.ok(html.indexOf(original)<html.indexOf('crm-grouped-field-changes'));assert.match(html,/查看本次互动的原文与整理依据/);assert.match(html,/当前资料，非当次记录值/);assert.equal(JSON.stringify(p),before);});
test('an interaction without field changes keeps its business text visible',()=>{const html=render(React.createElement(CrmGroupedFollowup,{point:point(false),lead:{},lang:'zh',onEvidence:()=>{}}));assert.match(html,/<p[^>]*>客户希望周六晚上学习，我已发送排期，尚未确认。<\/p>/);assert.ok(html.includes(original));assert.doesNotMatch(html,/aria-expanded|展开原文/);});
test('single known occurrence uses plain time; unknown and multiple-source labels remain explicit',()=>{const output=(times:any[])=>render(React.createElement(CrmFollowupEvent,{title:'资料更新',times,children:'内容'}));assert.doesNotMatch(output([{label:'发生时间',at:'2026-10-26T11:50:56Z'}]),/>实际发生于/);assert.match(output([{label:'发生时间',at:null}]),/实际发生时间未注明/);assert.match(output([{label:'客户消息',at:'2026-10-26T11:50:56Z'},{label:'销售记录',at:'2026-10-26T11:51:56Z'}]),/客户消息：/);});
