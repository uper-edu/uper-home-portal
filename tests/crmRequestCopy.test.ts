import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CrmBuyingEvidence} from '../src/components/crm/CrmBuyingEvidence.tsx';
import {CrmConversationTimeline} from '../src/components/crm/CrmConversationTimeline.tsx';

test('request evidence describes receipt, independent of historical task operation',()=>{
 for(const operation of ['created','supplemented','recorded']){
  const lead:any={id:'copy-only',buyingEvidence:[{id:'request',kind:'chat',value:'Advisor requested',at:'2026-10-26T02:00:00Z',original:'请顾问联系我',taskId:'first',taskOperation:operation,messageId:'request',conversationId:'chat'}]};
  const before=JSON.stringify(lead);
  const html=renderToStaticMarkup(React.createElement(CrmBuyingEvidence,{lead,lang:'zh',timezone:'Asia/Jakarta',onSource:()=>{},onTask:()=>{}}));
  assert.match(html,/顾问联系请求已记录/);
  assert.match(html,/请顾问联系我/);
  assert.match(html,/查看原始消息/);
  assert.doesNotMatch(html,/已创建任务|已补充已有任务/);
  assert.equal(JSON.stringify(lead),before);
 }
});

test('new request without task does not claim a missing task or a customer response',()=>{
 const messages:any=[{id:'receipt',conversation_id:'chat',role:'system',content:'原始确认消息',timestamp:'2026-10-26T02:00:00Z',metadata:{followupAction:'handoff',taskOperation:'recorded',taskId:null}}];
 const html=renderToStaticMarkup(React.createElement(CrmConversationTimeline,{lead:{id:'copy-only'} as any,messages,conversations:[],tasks:[],lang:'zh',timezone:'Asia/Jakarta',isLight:true,onOpenTask:()=>{}}));
 assert.match(html,/顾问联系请求已记录/);
 assert.match(html,/原始确认消息/);
 assert.match(html,/不代表已回应客户/);
 assert.doesNotMatch(html,/关联任务暂不可用|已创建跟进任务|已补充到现有任务/);
});
