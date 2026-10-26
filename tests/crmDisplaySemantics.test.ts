import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {projectBuyingEvidence,worklistSignal,visibleIntentEvidence,signalCategory,actualSignalValues} from '../src/utils/crmBuyingEvidence';
import {CrmBuyingEvidence} from '../src/components/crm/CrmBuyingEvidence';
import {CrmSalesProgressHistory} from '../src/components/crm/CrmSalesProgressHistory';
import {crmStageValue} from '../src/utils/crmLanguage';
const at='2026-10-25T10:00:00Z';
test('unsupported historical label does not become current intent and original is retained',()=>{
 const lead:any={buyingSignals:['Asked price','Assessment Done'],tier:'Hot',currentStage:'progress:discovery'};
 const before=JSON.stringify(lead);lead.buyingEvidence=projectBuyingEvidence([],lead);
 assert.equal(lead.buyingEvidence.length,2);assert.equal(worklistSignal(lead),null);assert.deepEqual(visibleIntentEvidence(lead),[]);
 const html=renderToStaticMarkup(React.createElement(CrmBuyingEvidence,{lead,lang:'zh'}));
 assert.doesNotMatch(html,/Assessment Done|询问学费|历史标签/);delete lead.buyingEvidence;assert.equal(JSON.stringify(lead),before);
});
test('questionnaire topic is labelled separately and supported request takes priority',()=>{
 const q={id:'q',kind:'questionnaire.submitted',created_at:at,data:{answers:{buyingSignal:'Asked price'}}};
 const lead:any={buyingEvidence:projectBuyingEvidence([q],{})};
 assert.equal(signalCategory(worklistSignal(lead)!.evidence,'zh'),'问卷关注');
 lead.buyingEvidence=projectBuyingEvidence([q,{id:'s',kind:'followup.recorded',data:{summary:'客户询问周六排期',occurredAt:at,buyingSignalDetected:'Asked schedule',result:{logId:'l'}}}],{});
 assert.equal(signalCategory(worklistSignal(lead)!.evidence,'zh'),'诉求／意向');assert.equal(worklistSignal(lead)!.evidence.value,'Asked schedule');assert.equal(worklistSignal(lead)!.more,0);
});
test('completed assessment cannot render as current intent even if an old sales label contains it',()=>{
 const lead={buyingEvidence:[{id:'old',kind:'sales',value:'Assessment Done',original:'完成测试',at},{id:'new',kind:'chat',value:'Assessment interest',original:'我想测评',at}]};
 assert.deepEqual(visibleIntentEvidence(lead).map(v=>v.value),['Assessment interest']);
 const html=renderToStaticMarkup(React.createElement(CrmBuyingEvidence,{lead,lang:'zh'}));
 assert.match(html,/客户诉求与意向/);assert.match(html,/测评意向/);assert.doesNotMatch(html,/完成测试|Assessment Done/);
});
test('display exclusion does not change existing signal filtering or business fields',()=>{
 const lead={buyingEvidence:[{id:'old',kind:'sales',value:'custom historical',at}],tier:'Hot',currentStage:'progress:enrolled'};const before=JSON.stringify(lead);
 assert.deepEqual(actualSignalValues(lead),['custom historical']);assert.equal(worklistSignal(lead),null);assert.equal(JSON.stringify(lead),before);
});
test('stage history keeps decisions and evidence without another mixed event list',()=>{
 const context={history:[{id:'h',before:'progress:discovery',after:'progress:proposal',reason:'客户确认具体方案',occurredAt:at,recordedAt:at,actor:'销售',basis:[{type:'sales_record',id:'l',label:'销售记录',text:'客户希望确认周六班',occurredAt:at,timeBasis:'staff_reported'}]}],milestones:[{id:'m',title:'重复事件'}],current:{stage:'progress:proposal'}};
 const before=JSON.stringify(context),html=renderToStaticMarkup(React.createElement(CrmSalesProgressHistory,{context,lang:'zh'}));
 assert.match(html,/需求沟通中.*方案确认中/);assert.match(html,/客户希望确认周六班/);assert.doesNotMatch(html,/事件记录与陈述|重复事件/);assert.equal(JSON.stringify(context),before);
});
test('legacy stage is an unresolved current state, never mapped to a new stage',()=>{
 assert.equal(crmStageValue('Assessment Done','zh'),'阶段待确认（原：测评完成）');assert.equal(crmStageValue('progress:proposal','zh'),'方案确认中');
});

import {guideLessons} from '../src/components/crm/CrmGuideLearning';
import {guideSections} from '../src/components/crm/CrmGuideContent';
test('final published guide keeps specific fact/intent/stage guidance after legacy adapters',()=>{
 const lesson=guideLessons['buying-evidence-sources'];
 assert.match(lesson.answer[2],/真实测评完成/);assert.match(lesson.caption[2],/问卷关注/);assert.match(lesson.example[2],/完成测评是里程碑/);
 assert.equal(lesson.nodes.length,4);assert.match(guideLessons.classification.answer[2],/仅首次登记/);
 const text=guideSections.find(s=>s.key==='buying-evidence-sources')!.body.map(r=>r[2]).join('\n');
 assert.match(text,/不再重复展示混合事件列表/);assert.match(text,/无依据历史标签不进入/);assert.doesNotMatch(text,/另建任务|自动.*升档/);
});
