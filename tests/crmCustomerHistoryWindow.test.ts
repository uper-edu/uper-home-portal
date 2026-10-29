import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {historyOrigin} from '../src/utils/crmHistoryOrigin';import {CrmCustomerHistoryWindow} from '../src/components/crm/CrmCustomerHistoryWindow';import {CrmHistoryAccess} from '../src/components/crm/CrmHistoryAccess';import {CrmProfileEditor} from '../src/components/crm/CrmProfileFields';import {CrmUiProvider} from '../src/components/crm/CrmUiLanguage';
const render=(node:React.ReactNode,lang='zh')=>renderToStaticMarkup(React.createElement(CrmUiProvider,{lang,children:node}));
test('lanes use explicit direct source and recorded authors; sales text and preferences never masquerade as customer messages',()=>{
 for(const category of ['message','questionnaire','assessment'])assert.equal(historyOrigin({category,root:{actor:'system'}}).lane,'customer');
 const sales=historyOrigin({category:'sales',log:{staffName:'Robert',channel:'WhatsApp',summary:'客户通过网站提交'},root:{actor:'Robert'}});assert.deepEqual(sales,{lane:'staff',author:'Robert',format:'销售记录',channel:'WhatsApp'});
 assert.equal(historyOrigin({category:'message',root:{actor:'visitor',payload:{preferredChannel:'WhatsApp'}}}).channel,'网站AI咨询');
 assert.equal(historyOrigin({category:'profile',root:{actor:'ai',payload:{sourceType:'ai_sales_text'}}}).lane,'system');
 assert.equal(historyOrigin({category:'ownership',root:{actor:'Robert'}}).lane,'staff');
});
test('profile source entries open the shared viewer without activating inline fetching or field editing',()=>{
 const lead={id:'TEST-history',goal:'工作',profileFieldMeta:{goal:{sourceType:'questionnaire',sourceFactIds:['source-a']}}};
 const html=render(React.createElement(CrmHistoryAccess.Provider,{value:()=>{},children:React.createElement(CrmProfileEditor,{lead,onSaved(){}})}));
 assert.match(html,/data-evidence-behavior="open"/);assert.doesNotMatch(html,/调整主要学习目标|aria-expanded="false"[^>]*>.*查看学习目标/s);
});
test('shared history window is read-only, names its customer and keeps tri-language labels without new forms',()=>{
 for(const lang of ['zh','en','id']){const html=render(React.createElement(CrmCustomerHistoryWindow,{lead:{id:'TEST-history',fullName:'TEST ONLY',simpleRevision:1},request:{token:1},lang,isLight:true,timezone:'Asia/Jakarta',onClose(){},onOpen(){}}),lang);assert.match(html,/TEST ONLY/);assert.match(html,/crm-operation-history/);assert.match(html,/crm-history-bilateral/);assert.doesNotMatch(html,/<form|补充／修正记录|crm-record-amendment/);if(lang!=='zh')assert.doesNotMatch(html,/>客户全景<|>客户提供<|>员工记录</);}
});
