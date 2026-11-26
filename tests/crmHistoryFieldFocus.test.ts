import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {historyFieldCitation} from '../src/utils/crmHistoryFieldFocus';
import {historyInformation} from '../src/utils/crmHistoryInformation';
import {historySalesPoints} from '../src/utils/crmHistorySalesContent';
import {CrmHistorySalesHighlights} from '../src/components/crm/CrmHistorySalesHighlights';

function fixture(){
 const text='我希望用中文开会，课程预算为200万印尼盾。';
 const observations=[{kind:'field',field:'goal',value:'用中文开会',quote:'我希望用中文开会',subject:'customer',temporality:'current',change:'state',decision:'evidence'},{kind:'field',field:'budgetAmount',value:2000000,quote:'课程预算为200万印尼盾',subject:'customer',temporality:'current',change:'state',decision:'apply'}];
 return {id:'message:one',category:'message',original:text,aliases:['original','change'],events:[{eventId:'change',eventType:'profile.fields_updated',payload:{basisFactIds:['ai-fact'],changes:[{field:'budgetAmount',before:null,after:2000000,applied:true}]}}],extractions:[{id:'run',status:'completed',source_type:'customer_message',source_id:'original',input:{text},output:{eventId:'ai-fact',observations}}]} as any;
}

test('field evidence locates its exact saved quote and leaves the full original unchanged',()=>{
 const group=fixture(),before=JSON.stringify(group);
 assert.equal(historyFieldCitation(group,['budgetAmount'],group.extractions,'change')?.quote,'课程预算为200万印尼盾');
 assert.equal(historyFieldCitation(group,['goal'],group.extractions,'original')?.quote,'我希望用中文开会');
 assert.equal(historyFieldCitation(group,['city'],group.extractions,'original'),null);
 assert.equal(historyFieldCitation(group,['budgetAmount'],group.extractions,'another-customer-record'),null);
 assert.equal(JSON.stringify(group),before);
});

test('repeated, missing or mismatched source quotations never produce a guessed highlight',()=>{
 for(const text of ['预算已确定。','课程预算为200万印尼盾；课程预算为200万印尼盾']){
  const group=fixture();group.original=text;group.extractions[0].input.text=text;
  assert.equal(historyFieldCitation(group,['budgetAmount'],group.extractions,'change'),null);
 }
 const group=fixture();group.extractions[0].input.text='另一份原文：'+group.original;
 assert.equal(historyFieldCitation(group,['budgetAmount'],group.extractions,'change'),null);
});

test('amended and original budgets retain separate quotes and use the selected source record',()=>{
 const group=fixture(),text='预算修正为190万印尼盾。';
 group.events.push({eventId:'amended',eventType:'record.amended',original:text,payload:{id:'am-1',text}},{eventId:'am-change',eventType:'profile.fields_updated',payload:{basisFactIds:['am-ai'],changes:[{field:'budgetAmount',before:2000000,after:1900000,applied:true}]}});
 group.extractions.push({id:'am-run',status:'completed',source_type:'sales_amendment',source_id:'am-1',input:{text},output:{eventId:'am-ai',observations:[{kind:'field',field:'budgetAmount',value:1900000,quote:'预算修正为190万印尼盾',subject:'customer',temporality:'current',change:'correction',decision:'apply'}]}});
 const before=JSON.stringify(group);
 assert.equal(historyFieldCitation(group,['budgetAmount'],group.extractions,'am-change')?.scope,'am-1');
 assert.equal(historyFieldCitation(group,['budgetAmount'],group.extractions,'change')?.scope,'main');
 assert.equal(JSON.stringify(group),before);
});

test('only the requested result is emphasized without adding a second evidence control',()=>{
 const group=fixture(),points=historySalesPoints(group,historyInformation(group));
 const normal=renderToStaticMarkup(React.createElement(CrmHistorySalesHighlights,{groupId:group.id,points,onEvidence(){}}));
 const focused=renderToStaticMarkup(React.createElement(CrmHistorySalesHighlights,{groupId:group.id,points,focusedFields:['budgetAmount'],onEvidence(){}}));
 assert.equal((focused.match(/crm-history-field-match/g)||[]).length,1);
 assert.equal((normal.match(/<button/g)||[]).length,(focused.match(/<button/g)||[]).length);
 assert.match(focused,/Rp 2,000,000/);
});
