import {test} from 'node:test';import assert from 'node:assert/strict';import React from 'react';import{renderToStaticMarkup}from'react-dom/server';import{CrmPolicySettings}from'../src/components/crm/CrmPolicySettings';import{DEFAULT_CRM_POLICY_CONFIG}from'../src/types/crmPolicyConfig';import{operationSections,operationGroups,operationSectionForField}from'../src/components/crm/operationsSections';
test('all operation topics provide three aligned translations and field errors route to the right topic',()=>{
 assert.equal(operationSections.length,12);assert.equal(operationGroups.length,3);for(const s of operationSections){assert.equal(s.title.length,3);for(let i=0;i<3;i++){assert.ok(s.title[i]&&s.purpose[i]);assert.equal(s.steps[i].length,3);}}
 for(const [field,topic]of Object.entries({'businessHours.endTime':'schedule','firstResponseSla.hot':'first_response','noResponseCadence.retryInterval':'retry','inactivityWatchdog.hotInactivity':'watchdog','milestones.trialReminderBefore':'milestone','reactivation.reactivatedResponse':'reactivation','identityReviewManagerOnly':'permissions'}))assert.equal(operationSectionForField(field),topic);
});
test('single topic initial view preserves configuration and keeps notification content outside the policy form',()=>{
 const original=JSON.stringify(DEFAULT_CRM_POLICY_CONFIG);for(const lang of ['en','id','zh'] as const){const html=renderToStaticMarkup(React.createElement(CrmPolicySettings,{lang,isLight:true,policyConfig:DEFAULT_CRM_POLICY_CONFIG,onSavePolicy:async()=>{throw Error('must not write while rendering')},onResetPolicy:async()=>false,notificationContent:React.createElement('input',{'aria-label':'test-notification-draft'})}));assert.ok(html.includes('aria-current="page"'));assert.ok(html.includes('crm-ops-flow'));assert.ok(html.indexOf('test-notification-draft')>html.indexOf('</form>'));assert.equal((html.match(/fieldPath=/g)||[]).length,0);}
 assert.equal(JSON.stringify(DEFAULT_CRM_POLICY_CONFIG),original);
});
test('policy form has one named submit action and no separate command bar or hidden duplicate submit',()=>{const html=renderToStaticMarkup(React.createElement(CrmPolicySettings,{lang:'en',isLight:true,policyConfig:DEFAULT_CRM_POLICY_CONFIG,onSavePolicy:async()=>false,onResetPolicy:async()=>false}));assert.equal((html.match(/type="submit"/g)||[]).length,1);assert.ok(!html.includes("Saves all policy-topic edits"));assert.ok(!html.includes('crm-ops-commandbar'));assert.match(html,/<button type="submit" disabled="">Save<\/button>/);});

test('calendar examples keep calendar information but omit simulator, architecture and guide entries in all languages',()=>{
 for(const lang of ['en','id','zh'] as const){
  const html=renderToStaticMarkup(React.createElement(CrmPolicySettings,{lang,isLight:true,policyConfig:DEFAULT_CRM_POLICY_CONFIG,onSavePolicy:async()=>false,onResetPolicy:async()=>false,onNavigateTab:()=>{throw Error('must not navigate while rendering')}}));
  assert.ok(html.includes('crm-ops-explanation'));assert.ok(html.includes('crm-work-startTime'));
  assert.ok(!html.includes('Live SLA Timeline Simulator'));assert.ok(!html.includes('SLA 真实时效推演沙盒'));
  assert.ok(!html.includes('Logic Cascade Architecture'));assert.ok(!html.includes('SLA 规则决策链架构图'));
  assert.ok(!html.includes('View the Sales Operations chapter'));assert.ok(!html.includes('查看在线手册的销售运营章节'));
  assert.equal((html.match(/type="submit"/g)||[]).length,1);
 }
});
