import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup as render} from 'react-dom/server';
import {CrmCustomerProfile} from '../src/components/crm/CrmCustomerDetails';import {CrmContactPreferences,CrmProfileEditor,CrmProfileFields} from '../src/components/crm/CrmProfileFields';
import {CrmAssessmentHistoryContent} from '../src/components/crm/CrmAssessmentHistory';import {CrmAssessmentEvidence} from '../src/components/crm/CrmAssessmentEvidence';
const lead:any={id:'a',fullName:'Rani Pratama',reportedLevel:'Beginner',communicationLanguage:'id',preferredChannel:'WhatsApp',goal:'工作交流',profileFieldMeta:{communicationLanguage:{sourceType:'sales_edit',revision:2,sourceFactIds:['lang-source']},preferredChannel:{sourceType:'ai_customer_text',revision:1,sourceFactIds:['channel-source']}}};
test('contact preferences are basic details with original sources, while learning baseline is in needs without a new editor',()=>{const before=JSON.stringify(lead),html=render(React.createElement(CrmCustomerProfile,{lead,lang:'zh',timezone:'Asia/Jakarta',dynamicProfile:React.createElement(CrmProfileEditor,{lead,timezone:'Asia/Jakarta',isLight:true})}));const basic=html.indexOf('基本资料'),contact=html.indexOf('首选沟通语言'),needs=html.indexOf('客户洞察'),level=html.indexOf('客户自报水平');assert.ok(basic<contact&&contact<needs&&needs<level);assert.equal(html.split('客户自报水平').length-1,1);assert.doesNotMatch(html,/<h4>联系偏好<\/h4>/);assert.match(html,/印尼语/);assert.match(html,/WhatsApp/);assert.match(html,/资料编辑/);assert.match(html,/由AI根据关联原文整理/);assert.doesNotMatch(html,/调整客户自报水平|沟通偏好/);assert.equal(JSON.stringify(lead),before);});
test('missing contact preferences do not create an empty heading; basic picker contains them and needs picker does not',()=>{assert.equal(render(React.createElement(CrmContactPreferences,{lead:{id:'a'}})),'');const props={lead,updates:{},versions:{},onChange(){},isLight:true};const html=render(React.createElement(CrmProfileFields,{...props,scope:'basic'}));assert.match(html,/添加修改字段/);const needs=render(React.createElement(CrmProfileEditor,{lead,timezone:'Asia/Jakarta',isLight:true}));assert.doesNotMatch(needs,/首选沟通语言|首选联系渠道|WhatsApp/);});
const content=(data:any,error=false,current=lead)=>render(React.createElement(CrmAssessmentHistoryContent,{lead:current,data,error,lang:'zh',timezone:'Asia/Jakarta',onRetry(){}}));
test('empty assessment has one clear empty state; self-report stays only in profile and interpretation belongs in system documentation',()=>{const html=content({leadId:'a',attempts:[],current:{}});assert.equal(html.split('尚无测评记录').length-1,1);assert.doesNotMatch(html,/0 条记录|尚无已保存的测评记录/);assert.doesNotMatch(html,/客户自报水平|客户自报与客户级原始依据/);assert.doesNotMatch(html,/测评口径与差异说明/);assert.doesNotMatch(html,/<details[^>]*open=/);});
test('loading and failure never pretend to be an empty saved history',()=>{const loading=content(null),failed=content(null,true);assert.match(loading,/正在加载历次测评记录/);assert.doesNotMatch(loading,/尚无测评记录/);assert.match(failed,/历次记录暂不可用/);assert.doesNotMatch(failed,/尚无测评记录/);});
test('saved attempt, original score, timestamp and result remain in history before optional self-report',()=>{const result:any={score:42,maxScore:100,placement:'HSK 1',attempt:{attemptId:'attempt-1',mode:'full',completedAt:'2026-10-26T11:50:56Z'},sections:{}};const data={leadId:'a',attempts:[{id:'attempt-1',recordedAt:'2026-10-26T11:51:00Z',result}],current:{latestAssessment:result,levelSource:'assessment'}};const before=JSON.stringify(data),html=content(data);assert.match(html,/42\/100/);assert.match(html,/完整测评/);assert.match(html,/历次测评记录/);assert.doesNotMatch(html,/客户自报水平/);assert.equal(JSON.stringify(data),before);});
test('assessment summaries put exact completion with type, conclusion with score, and omit duplicate detail metadata without deleting stored recorded time',()=>{
 const result:any={score:42,maxScore:100,placement:'HSK 1',attempt:{attemptId:'attempt-2',mode:'full',completedAt:'2026-10-26T11:50:56Z'},sections:{}};
 const html=content({leadId:'a',attempts:[{id:'attempt-2',recordedAt:'2026-10-26T12:01:02Z',result}],current:{latestAssessment:result,levelSource:'assessment'}});
 const summary=html.match(/<summary[^>]*>[\s\S]*?<\/summary>/)?.[0]||'';
 assert.doesNotMatch(summary,/<svg|chevron/);assert.match(summary,/<strong>完整测评<\/strong><time/);assert.match(summary,/dateTime="2026-10-26T11:50:56Z"/i);
 assert.match(summary,/依据不完整，无法确定学习起点/);assert.match(summary,/42\/100/);assert.doesNotMatch(summary,/记录时间/);assert.doesNotMatch(html,/记录时间/);
});

test('assessment omits customer-level source section without changing the saved original text',()=>{const raw='客户原始测评说明 <原文>';const current={...lead,quizResultSummary:raw};const html=content({leadId:'a',attempts:[],current:{}},false,current);assert.doesNotMatch(html,/客户自报水平|客户自报与客户级原始依据/);assert.doesNotMatch(html,/客户级原始依据|客户原始测评说明/);assert.equal(current.quizResultSummary,raw);assert.equal(current.reportedLevel,'Beginner');});

test('removing generic help preserves substantial same-type differences, cross-type cautions and per-attempt review notices',async()=>{
 const {newHskAttempt,gradeHskAttempt}=await import('../src/data/hskAssessment');
 const {getVersionQuestions}=await import('../src/data/hskAssessmentVersions');
 const attempt=(mode:'full'|'express',correct:boolean,index:number)=>{const a=newHskAttempt(mode,'00000000-0000-4000-8000-'+String(index).padStart(12,'0'));for(const q of getVersionQuestions(mode,a.examVersion,a.scoringVersion))a.answers[q.id]=q.options.find(o=>o.isCorrect===correct)!.id;a.completedAt=a.startedAt;return gradeHskAttempt(a,'zh');};
 const low=attempt('full',false,1),high=attempt('full',true,2),quick=attempt('express',true,3);
 const data={leadId:'a',attempts:[{id:low.attempt.attemptId,recordedAt:'2026-10-26T12:00:00Z',result:low},{id:high.attempt.attemptId,recordedAt:'2026-10-25T12:00:00Z',result:high}],current:{latestAssessment:low,levelSource:'assessment'}};
 const before=JSON.stringify(data),html=content(data);assert.match(html,/测评结果存在明显差异/);assert.match(html,/记录差异明显/);assert.doesNotMatch(html,/测评口径与差异说明/);assert.equal(JSON.stringify(data),before);
 const cross=content({...data,attempts:[data.attempts[0],{id:quick.attempt.attemptId,recordedAt:'2026-10-25T12:00:00Z',result:quick}]});assert.match(cross,/依据类型不同 · 请核实结论/);
 const incomplete={...quick,unansweredCount:1,screeningPlacement:{...quick.screeningPlacement,needsReview:true,reason:'incomplete'}};
 const review=content({...data,attempts:[{id:quick.attempt.attemptId,result:incomplete}],current:{latestAssessment:incomplete,levelSource:'assessment'}});assert.match(review,/存在未作答题/);assert.doesNotMatch(review,/测评口径与差异说明/);
});

test('system documentation retains interpretation and difference rules after the customer help panel is removed',async()=>{
 const {guideSections}=await import('../src/components/crm/CrmGuideContent');
 const section=guideSections.find(row=>row.key==='assessment');assert.ok(section);
 const text=section.body.map(row=>row[2]).join('\n');
 for(const expected of ['当前结论','最高分','平均分','30个百分点','两级','快速','完整','客户页不再展示独立说明区块'])assert.ok(text.includes(expected),expected);
});
