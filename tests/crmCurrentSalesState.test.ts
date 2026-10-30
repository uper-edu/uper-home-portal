import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {CrmCurrentSalesState} from '../src/components/crm/CrmCurrentSalesState';
import {CrmDetailHeader} from '../src/components/crm/CrmDetailWorkspace';
import {CrmCustomerHistoryWindow} from '../src/components/crm/CrmCustomerHistoryWindow';
import {CrmLeadWorkspace} from '../src/components/crm/CrmLeadWorkspace';
import {CrmSalesBrief} from '../src/components/crm/CrmSalesBrief';
import {CrmNextTaskSummary} from '../src/components/crm/CrmNextTaskSummary';
import {CrmUiProvider} from '../src/components/crm/CrmUiLanguage';
import {salesProgressStages} from '../src/utils/crmSalesProgress';
import {crmUiText} from '../src/utils/crmUiText';
const now=Date.parse('2026-10-29T12:00:00Z');
const lead:any={id:'TEST-current-stage',fullName:'TEST Current Stage',currentStage:'progress:discovery',owner:'sales-a',tier:'Warm',goal:'学习中文',attention:{tasks:[]}};
const show=(value:any=lead,props:any={})=>render(React.createElement(CrmUiProvider,{lang:props.lang||'zh',children:React.createElement(CrmCurrentSalesState,{lead:value,now,...props})}));

test('all seven current stages remain explicit and read-only, without inferring contact permission',()=>{
 for(const [stage,label] of salesProgressStages){const value={...lead,currentStage:stage},before=JSON.stringify(value),html=show(value);assert.ok(html.includes(label));assert.ok(html.includes('当前阶段'));assert.doesNotMatch(html,/<button|<input|<form|允许联系|可以联系|已停止/);assert.equal(JSON.stringify(value),before);}
});
test('identity hold and stopped contact are independent from an enrolled sales stage',()=>{
 const value={...lead,currentStage:'progress:enrolled',identityReview:{pending:true},contactArrangement:{state:'stopped',reason:'原文要求保留'}},before=JSON.stringify(value),html=show(value);
 for(const text of ['已报名','身份待核实','已停止主动联系','原文要求保留','data-stage-tone="enrolled"','data-restriction="identity"','data-restriction="stopped"'])assert.ok(html.includes(text));
 assert.ok(html.indexOf('身份待核实')<html.indexOf('已停止主动联系'));assert.equal(JSON.stringify(value),before);
});
test('legacy contact holds stay explicit and a future task alone never becomes a contact restriction',()=>{
 for(const state of ['waiting','nurture','unexpected'])assert.ok(show({...lead,contactArrangement:{state,reason:'历史安排'}}).includes('原联系安排待核对'));
 assert.ok(!show({...lead,attention:{tasks:[{id:'future',dueAt:'2030-10-29T12:00:00Z'}]}}).includes('约定时间前不主动联系'));
});
test('existing timed restriction shows the actual saved instant; expiry changes only the display',()=>{
 const value={...lead,contactReview:{blockBefore:true,reviewAt:'2026-10-29T13:00:00Z',reason:'客户约定后联系'}},before=JSON.stringify(value);
 const html=show(value);assert.ok(html.includes('约定时间前不主动联系'));assert.match(html,/datetime="2026-10-29T13:00:00Z"/i);assert.doesNotMatch(html,/UTC|WIB|Asia\/Jakarta/);
 assert.ok(!show(value,{now:Date.parse(value.contactReview.reviewAt)}).includes('约定时间前不主动联系'));assert.equal(JSON.stringify(value),before);
 assert.ok(show({...value,contactReview:{...value.contactReview,reviewAt:'invalid'}}).includes('时间待核对'));
});
test('actual contact facts and historical stage events never override current stage',()=>{
 const value={...lead,currentStage:'progress:unreached',connectStatus:'Connected',followUpLogs:[{newStage:'progress:enrolled',connectStatus:'Connected'}]};
 const html=show(value);assert.ok(html.includes('待建立沟通'));assert.doesNotMatch(html,/已报名|需求沟通中/);
});
test('missing or legacy stage is not silently mapped to one of the seven current stages',()=>{
 assert.ok(show({...lead,currentStage:'New'}).includes('阶段待确认'));
 assert.ok(!show({...lead,currentStage:undefined}).includes('需求沟通中'));
});
test('detail status stays in its shared header, separate from existing business actions',()=>{
 const html=render(React.createElement(CrmDetailHeader,{title:'TEST Current Stage',meta:'Sales A',status:React.createElement(CrmCurrentSalesState,{lead}),actions:React.createElement('button',null,'记录进展')}));
 assert.ok(html.indexOf('crm-detail-current-state')<html.indexOf('</header>'));assert.equal((html.match(/<button/g)||[]).length,1);assert.ok(html.includes('需求沟通中'));
});
test('Customer 360 current snapshot is outside its scrolling timeline; historical cards remain independent',()=>{
 const html=render(React.createElement(CrmCustomerHistoryWindow,{lead,ownerName:'Sales A',request:{token:1},lang:'zh',isLight:true,onClose(){}}));
 assert.ok(html.indexOf('crm-operation-current-state')<html.indexOf('crm-operation-content'));assert.ok(html.includes('当前阶段'));assert.ok(html.includes('Sales A'));assert.ok(html.includes('crm-history-bilateral'));assert.doesNotMatch(html,/<form|更新阶段/);
});
test('detail sidebar adds a compact current stage and restrictions without removing selection or owner',()=>{
 const value={...lead,identityReview:{pending:true,canReview:false},contactArrangement:{state:'stopped'}};
 const html=render(React.createElement(CrmLeadWorkspace,{leads:[value],selectedId:value.id,view:'worklist',lang:'zh',timezone:'Asia/Jakarta',isLight:true,employeeId:'manager',employees:[{id:'sales-a',displayName:'Sales A'}],onOpen(){},onReset(){},children:React.createElement('div',null,'DETAIL')}));
 for(const text of ['is-compact','需求沟通中','身份待核实','已停止主动联系','Sales A','aria-current="true"','DETAIL'])assert.ok(html.includes(text));
 assert.equal((html.match(/data-restriction="identity"/g)||[]).length,1);
 assert.equal((html.match(/已停止主动联系<\/span>/g)||[]).length,1);
});
test('Follow-up can omit duplicated stage and stopped notice when a shared header already provides them',()=>{
 const value={...lead,contactArrangement:{state:'stopped',reason:'保留原因'}};
 const html=render(React.createElement(CrmSalesBrief,{lead:value,lang:'zh',showStage:false}));assert.ok(html.includes('学习目标'));assert.ok(html.includes('学习中文'));assert.doesNotMatch(html,/需求沟通中|已停止主动联系/);
 const standalone=render(React.createElement(CrmSalesBrief,{lead:value,lang:'zh'}));assert.ok(standalone.includes('需求沟通中'));assert.ok(standalone.includes('已停止主动联系'));
});
test('fixed labels are translated in three languages while source names and reasons remain unchanged',()=>{
 for(const lang of ['zh','en','id']){
  const html=show({...lead,identityReview:{pending:true},contactArrangement:{state:'stopped',reason:'原文不翻译'}},{lang,ownerName:'Sales A'});
  for(const key of ['当前阶段','当前销售阶段与联系限制','身份待核实']){const text=crmUiText(key,lang);if(lang!=='zh')assert.notEqual(text,key);assert.ok(html.includes(text));}
  assert.ok(html.includes('Sales A'));assert.ok(html.includes('原文不翻译'));
 }
});
test('shared contact notice replaces only an empty-task notice, never an actual task or loading failure',()=>{
 const value={...lead,contactArrangement:{state:'stopped'}};
 const summary=(lead:any)=>render(React.createElement(CrmNextTaskSummary,{lead,lang:'zh',timezone:'Asia/Jakarta',hideContactNotice:true,onOpen(){}}));
 assert.equal(summary(value),'');
 assert.ok(summary({...value,attention:{tasks:[{id:'task',kind:'contact_review',status:'open',dueAt:'2030-10-29T12:00:00Z'}]}}).includes('查看跟进'));
 assert.ok(summary({...value,attention:undefined}).includes('跟进信息暂不可用'));
});
