import {trustError} from '../src/utils/crmTrustLanguage.ts';
import test from'node:test';import assert from'node:assert/strict';import React from'react';import{renderToStaticMarkup}from'react-dom/server';
import{CrmStageEditor}from'../src/components/crm/CrmTrustPanel.tsx';
import{CrmSalesStageReadOnly}from'../src/components/crm/CrmSalesStageReadOnly.tsx';
import{CrmSalesBrief}from'../src/components/crm/CrmSalesBrief.tsx';
import{salesProgressStages}from'../src/utils/crmSalesProgress.ts';
const lead={id:'a',fullName:'Rani Wijaya',currentStage:'progress:proposal',stageRevision:2};
const render=(C:any,p:any={})=>renderToStaticMarkup(React.createElement(C,{lead,lang:'zh',isLight:true,...p}));
test('drawer presents seven explicit choices, identifies the current stage, and requires a different manual choice',()=>{const html=render(CrmStageEditor,{inDrawer:true});assert.equal((html.match(/type="radio"/g)||[]).length,7);assert.doesNotMatch(html,/type="radio"[^>]*checked/);assert.doesNotMatch(html,/当前销售阶段/);assert.match(html,/方案确认中（当前）/);assert.match(html,/disabled=""[^>]*value="progress:proposal"|value="progress:proposal"[^>]*disabled=""/);assert.match(html,/disabled=""[^>]*>保存<|disabled=""[^>]*>\s*保存/);for(const s of salesProgressStages)assert.ok(html.includes(s[4]));});
test('profile stage view contains no stage editor or stage save action',()=>{const html=render(CrmSalesStageReadOnly);assert.match(html,/方案确认中/);assert.doesNotMatch(html,/修改销售阶段|确认更新|type="radio"|<select|保存阶段/);});
test('follow-up summary keeps current stage read-only; the common header owns the update entry',()=>{const permitted=render(CrmSalesBrief,{onStage:()=>{},canEdit:true});assert.doesNotMatch(permitted,/更新阶段/);assert.equal((permitted.match(/销售阶段/g)||[]).length,1);assert.doesNotMatch(render(CrmSalesBrief,{onStage:()=>{},canEdit:false}),/更新阶段/);});
test('prefilled evidence is contextual only, never preselects a new stage or bypasses explicit confirmation',()=>{const html=render(CrmStageEditor,{inDrawer:true,initialBasisId:'new-progress'});assert.doesNotMatch(html,/type="radio"[^>]*checked/);assert.doesNotMatch(html,/重试原保存|已保存/);assert.match(html,/保存/);});

test('known validation failures are specific errors, never presented as an unknown save result',()=>{for(const text of ['请选择阶段实际生效时间或明确未知','请填写完整的阶段生效日期与时间','请明确确认报名已成立','阶段生效时间无效或晚于当前时间']){assert.equal(trustError(text,'zh'),text);assert.doesNotMatch(trustError(text,'zh'),/保存未确认|查询结果/);}});

test('stage editor has no effective-time field or source-time adoption action and uses the fixed save label',()=>{const html=render(CrmStageEditor,{inDrawer:true});assert.doesNotMatch(html,/阶段实际生效时间|阶段生效日期与时间|datetime-local|采用此依据的发生时间|确认更新为/);assert.match(html,/>保存</);});
