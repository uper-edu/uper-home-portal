import {test} from 'node:test';import assert from 'node:assert/strict';import React from 'react';import{renderToStaticMarkup}from'react-dom/server';import{CrmPolicySettings}from'../src/components/crm/CrmPolicySettings';import{DEFAULT_CRM_POLICY_CONFIG}from'../src/types/crmPolicyConfig';import{enrollmentSettingSections,operationSections,operationGroups,operationGroupOrder,operationSectionForField}from'../src/components/crm/operationsSections';
test('all operation topics provide three aligned translations and field errors route to the right topic',()=>{
 const firstGroup=operationGroupOrder[0];
 assert.equal(operationGroups[firstGroup][2],'管理与工作时间');
 assert.deepEqual(enrollmentSettingSections.map(section=>section.id),['courses','enrollment-templates','enrollment-classes','enrollment-rules','enrollment-mail']);
 assert.ok(enrollmentSettingSections.every(section=>section.title.length===3&&section.title.every(Boolean)));
 assert.ok(!operationSections.some(section=>enrollmentSettingSections.some(setting=>setting.id===String(section.id))));
 assert.equal(new Set(operationSections.map(section=>section.id)).size,operationSections.length);
 assert.ok(operationSections.some(section=>section.id==='assignment'));
 for(const section of operationSections){
  assert.equal(section.title.length,3);
  const steps=3;
  for(let i=0;i<3;i++){assert.ok(section.title[i]&&section.purpose[i]);assert.equal(section.steps[i].length,steps);}
 }
 for(const [field,topic]of Object.entries({'businessHours.endTime':'schedule','firstResponseSla.hot':'first_response','noResponseCadence.retryInterval':'retry','inactivityWatchdog.hotInactivity':'watchdog','milestones.trialReminderBefore':'milestone','reactivation.reactivatedResponse':'reactivation','identityReviewManagerOnly':'permissions'}))assert.equal(operationSectionForField(field),topic);
});
test('initial view selects the first topic without changing configuration',()=>{
 const original=JSON.stringify(DEFAULT_CRM_POLICY_CONFIG);for(const lang of ['en','id','zh'] as const){const html=renderToStaticMarkup(React.createElement(CrmPolicySettings,{lang,isLight:true,policyConfig:DEFAULT_CRM_POLICY_CONFIG,onSavePolicy:async()=>{throw Error('must not write while rendering')},onResetPolicy:async()=>false,notificationContent:React.createElement('input',{'aria-label':'test-notification-draft'})}));const current=html.match(/<button[^>]*aria-current="page"[^>]*>[\s\S]*?<\/button>/)?.[0];assert.ok(current?.includes(operationSections.find(section=>section.id==='permissions')?.title[lang==='en'?0:lang==='id'?1:2]??''));assert.ok(!html.includes('crm-course-catalog'));assert.ok(html.includes('test-notification-draft'));assert.equal((html.match(/fieldPath=/g)||[]).length,0);}
 assert.equal(JSON.stringify(DEFAULT_CRM_POLICY_CONFIG),original);
});
test('loaded policy settings open directly on the form with one named submit action',()=>{
 const html=renderToStaticMarkup(React.createElement(CrmPolicySettings,{lang:'en',isLight:true,initialTopic:'schedule',policyConfig:DEFAULT_CRM_POLICY_CONFIG,onSavePolicy:async()=>false,onResetPolicy:async()=>false}));
 const directory=html.match(/<nav[^>]+aria-label="Operations topics"[^>]*>(.*?)<\/nav>/s)?.[1];
 assert.ok(directory?.includes('Time zone and work calendar'));
 assert.doesNotMatch(directory,/<(?:details|summary)\b/);
 assert.match(html,/<input[^>]*id="crm-work-startTime"/);
 assert.equal((html.match(/type="submit"/g)||[]).length,1);
 assert.ok(!html.includes('crm-ops-commandbar'));
 assert.match(html,/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Save<\/button>/);
});

test('calendar examples keep calendar information but omit simulator, architecture and guide entries in all languages',()=>{
 for(const lang of ['en','id','zh'] as const){
  const html=renderToStaticMarkup(React.createElement(CrmPolicySettings,{lang,isLight:true,initialTopic:'schedule',policyConfig:DEFAULT_CRM_POLICY_CONFIG,onSavePolicy:async()=>false,onResetPolicy:async()=>false,onNavigateTab:()=>{throw Error('must not navigate while rendering')}}));
  assert.ok(html.includes('crm-ops-explanation'));assert.ok(html.includes('crm-work-startTime'));
  assert.ok(!html.includes('Live SLA Timeline Simulator'));assert.ok(!html.includes('SLA 真实时效推演沙盒'));
  assert.ok(!html.includes('Logic Cascade Architecture'));assert.ok(!html.includes('SLA 规则决策链架构图'));
  assert.ok(!html.includes('View the Sales Operations chapter'));assert.ok(!html.includes('查看在线手册的销售运营章节'));
  assert.equal((html.match(/type="submit"/g)||[]).length,1);
 }
});
