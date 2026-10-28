import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CrmSimpleWorkflow} from '../src/components/crm/CrmSimpleWorkflow';
import {initialProgressRecord,progressSaveSummary} from '../src/utils/crmProgressRecord';
import {patchContactDetails,clearProgressSection,progressSectionState} from '../src/utils/crmProgressSections';
import {prepareProgressDraft} from '../src/utils/crmProgressDraft';
const lead={id:'TEST-SECTION',currentStage:'progress:proposal',contactArrangement:{state:'stopped',version:1},commitments:[{id:'saved',action:'原有约定',status:'active'}]};
const render=(draft?:any,sections?:any,canUpdateStage=true,lang='zh')=>renderToStaticMarkup(React.createElement(CrmSimpleWorkflow,{lead,lang,isLight:true,timezone:'America/Vancouver',canUpdateStage,initialDraft:draft?{simple:draft,sections}:undefined}));
test('four peer sections follow contact → agreement → stage → arrangement, without a stage activation checkbox',()=>{
  const h=render(),names=['实际联系','客户约定','销售阶段','联系安排'];let position=0;
  for(const name of names){const i=h.indexOf('class="crm-progress-section" aria-label="'+name+'"');assert.ok(i>position,name);position=i;}
  assert.equal((h.match(/class="crm-progress-section-panel" hidden=""/g)||[]).length,4);
  assert.doesNotMatch(h,/其他操作|同时更新销售阶段/);assert.match(h,/保持当前阶段/);
});
test('view-only opens preserve pure-note semantics; first contact edit activates conditional requirements',()=>{
  const d=initialProgressRecord(lead);assert.equal(d.recordKind,'internal');assert.equal(progressSectionState(d,lead,'zh','America/Vancouver').changed.contact,false);
  const opened=render({...d,summary:'TEST 仅查看'}, {contact:true,agreement:true,stage:true,arrangement:true});assert.doesNotMatch(opened,/<button type="submit" disabled/);
  const partial=patchContactDetails(d,'channel','WhatsApp');assert.equal(partial.recordKind,'contact');assert.equal(progressSectionState(partial,lead,'zh','America/Vancouver').incomplete.contact,true);
  assert.equal(progressSectionState(partial,lead,'zh','America/Vancouver').summary.contact,'WhatsApp');
  assert.match(render(partial,{contact:false}),/待补全/);
});
test('save receipt separates confirmed section outcomes from a pending stage update',()=>{
  const receipt={contactRecorded:true,agreementChange:'created',stageUpdated:true,contactPlanChange:'restored'};
  assert.equal(progressSaveSummary(receipt),'进展已保存；实际联系已登记；客户约定已新增；销售阶段已更新；已恢复主动联系。');
  assert.match(progressSaveSummary({...receipt,stageUpdated:false,stageUpdatePending:true}),/销售阶段未更新/);
  for(const lang of ['en','id'])assert.doesNotMatch(progressSaveSummary(receipt,lang),/undefined|进展/);
});
test('collapsed edits remain visible in summaries and serialized; presentation state never enters commands',()=>{
  const d={...initialProgressRecord(lead),summary:'TEST 全文',recordKind:'contact',channel:'WhatsApp',connectStatus:'No Response',contactDirection:'sales',occurrenceMode:'unknown',contactState:'active',agreementIntent:'new',commitmentAction:'核对课程安排',agreementTiming:'date',commitmentDate:'2099-10-29',stageUpdate:{enabled:true,stage:'progress:discovery'}};
  const html=render(d,{contact:false,agreement:false,stage:false,arrangement:false});
  for(const text of ['WhatsApp','未接通／未回复','核对课程安排','方案确认中 → 需求沟通中','拟恢复'])assert.ok(html.includes(text),text);
  const body=prepareProgressDraft(d,'America/Vancouver');assert.equal(body.recordKind,'contact');assert.equal(body.channel,'WhatsApp');assert.equal(body.contactState,'active');assert.equal(body.commitment?.action,'核对课程安排');assert.equal(body.stageUpdate,undefined);
});
test('clearing a section removes only its unsaved command and retains saved agreements and other drafts',()=>{
  const d={...initialProgressRecord(lead),summary:'TEST 原文',recordKind:'contact',channel:'WhatsApp',connectStatus:'Connected',contactDirection:'customer',occurrenceMode:'now',contactState:'active',agreementIntent:'update',commitmentChange:{id:'saved',status:'fulfilled',reason:'客户已确认'},stageUpdate:{enabled:true,stage:'progress:discovery'}};
  const original=JSON.stringify(d),cleared=clearProgressSection(d,'contact');const body=prepareProgressDraft(cleared,'America/Vancouver');assert.equal(body.recordKind,'internal');assert.equal(body.channel,undefined);assert.equal(body.contactState,'active');assert.equal(body.commitmentChange.id,'saved');
  const agreement=prepareProgressDraft(clearProgressSection(d,'agreement'),'America/Vancouver');assert.equal(agreement.commitmentChange,undefined);assert.equal(agreement.contactState,'active');assert.equal(lead.commitments[0].action,'原有约定');
  assert.equal(clearProgressSection(d,'stage').stageUpdate.enabled,false);assert.equal(clearProgressSection(d,'arrangement').contactState,'');assert.equal(JSON.stringify(d),original);
});
test('enrollment confirmation remains conditional; no-stage permission removes the entire stage group',()=>{
  const d={...initialProgressRecord(lead),summary:'TEST',stageUpdate:{enabled:true,stage:'progress:enrolled',enrollmentConfirmed:false}};
  assert.equal(progressSectionState(d,lead,'zh','America/Vancouver').incomplete.stage,true);assert.match(render(d,{stage:false}),/待补全/);
  assert.match(render(d,{stage:true}),/确认正式课程报名已成立/);assert.doesNotMatch(render(undefined,undefined,false),/class="crm-progress-section" aria-label="销售阶段"/);
});
test('three-language sections share the same shell, explicit clear controls and summaries',()=>{
  const d={...initialProgressRecord(lead),summary:'TEST',contactState:'active'};
  for(const [lang,clear] of [['zh','清除本次修改'],['en','Clear these changes'],['id','Hapus perubahan ini']]){
    const h=render(d,{arrangement:true},true,lang);assert.equal((h.match(/class="crm-progress-section"/g)||[]).length,4);assert.ok(h.includes(clear));assert.doesNotMatch(h,/undefined/);
  }
});
