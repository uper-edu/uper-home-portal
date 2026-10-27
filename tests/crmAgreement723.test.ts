import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup as render} from 'react-dom/server';
import {priorityAgreements,presentAgreement} from '../src/utils/crmAgreementPresentation';
import {CrmListAgreements} from '../src/components/crm/CrmListAgreements';import {CrmLeadWorkspace} from '../src/components/crm/CrmLeadWorkspace';
const now=Date.parse('2026-10-27T10:00:00Z'),zone='Asia/Jakarta';
const item=(id:string,extra:any={})=>({id,status:'active',action:'TEST 约定 '+id,timezone:zone,...extra});
test('723: overdue > near > future > undated; inactive excluded, stable ties and immutable records',()=>{
 const lead={commitments:[item('undated'),item('future',{at:'2026-11-01T00:00:00Z'}),item('near',{at:'2026-10-28T09:59:59Z'}),item('late',{at:'2026-10-26T00:00:00Z'}),...['cancelled','fulfilled','rescheduled'].map(status=>item(status,{status,at:'2020-01-01T00:00:00Z'}))]};
 const before=JSON.stringify(lead);assert.deepEqual(priorityAgreements(lead,zone,now).map(r=>r.agreement.id),['late','near','future','undated']);assert.equal(JSON.stringify(lead),before);
 assert.deepEqual(priorityAgreements({commitments:[item('b'),item('a')]},zone,now).map(r=>r.agreement.id),['a','b']);
});
test('723: exact timestamps cross boundary without modifying original time; 24h inclusive',()=>{
 const at='2026-10-28T10:00:00Z';assert.equal(presentAgreement(item('a',{at}),zone,now).status,'soon');assert.equal(presentAgreement(item('a',{at}),zone,now-1).status,'scheduled');assert.equal(presentAgreement(item('a',{at}),zone,Date.parse(at)).status,'soon');assert.equal(presentAgreement(item('a',{at}),zone,Date.parse(at)+1).status,'overdue');
});
test('723: date-only is due today in its own timezone, overdue only next day; missing and invalid never invent execution time',()=>{
 const date=item('date',{date:'2026-10-28'});assert.equal(presentAgreement(date,zone,Date.parse('2026-10-27T16:59:59Z')).status,'scheduled');assert.equal(presentAgreement(date,zone,Date.parse('2026-10-27T17:00:00Z')).status,'today');assert.equal(presentAgreement(date,zone,Date.parse('2026-10-28T17:00:00Z')).status,'overdue');
 assert.equal(presentAgreement(item('x'),zone,now).status,'undated');for(const extra of [{date:'2026-02-30'},{at:'2026-10-27T17:00:00'},{at:'bad'},{timezone:'invalid'}])assert.equal(presentAgreement(item('x',extra),zone,now).status,'invalid');
});
test('723: list and follow-up share priority, time, text and semantic tone; detail exposes other agreements, originals stay original',()=>{
 const lead={commitments:[item('later',{date:'2026-10-30'}),item('priority',{at:'2026-10-27T09:00:00Z'}),item('old',{status:'fulfilled'})]};
 for(const lang of ['zh','en','id']){
  const make=(detail:boolean)=>render(React.createElement(CrmListAgreements,{lead,lang,timezone:zone,now,detail,onOpen(){}}));const list=make(false),detail=make(true);
  for(const html of [list,detail]){assert.match(html,/TEST 约定 priority/);assert.match(html,/2026-10-27 16:00:00 · Asia\/Jakarta/);assert.match(html,/data-tone="danger"/);assert.doesNotMatch(html,/TEST 约定 old/);}
  assert.doesNotMatch(list,/TEST 约定 later/);assert.match(detail,/TEST 约定 later/);assert.match(detail,/<details/);
 }
});
test('723: full and compact list both retain agreement component and accessible detail button',()=>{
 const lead:any={id:'t',fullName:'TEST',commitments:[item('a',{date:'2026-10-30'})]};
 for(const children of [undefined,React.createElement('div',null,'TEST detail')]){
  const html=render(React.createElement(CrmLeadWorkspace,{leads:[lead],selectedId:children?'t':undefined,view:'worklist',lang:'zh',timezone:zone,isLight:true,loading:false,employeeId:'TEST',employees:[],onOpen(){},onReset(){},children}));assert.match(html,/aria-label="客户约定：TEST 约定 a"/);assert.match(html,/2026-10-30/);
 }
});

test('723: follow-up highlights active agreement before timelines and recent activity without a second active block',async()=>{
 const {CrmSimpleAttention}=await import('../src/components/crm/CrmSimpleAttention');
 const lead={id:'723',fullName:'TEST',commitments:[item('front',{date:'2026-10-30'})]};
 const html=render(React.createElement(CrmSimpleAttention,{lead,lang:'zh',timezone:zone,isLight:true,now}));
 assert.equal((html.match(/TEST 约定 front/g)||[]).length,1);
 assert.ok(html.indexOf('TEST 约定 front')<html.indexOf('crm-interaction-timelines'));
 assert.doesNotMatch(html,/crm-followup-agreements/);
});

test('723: ordinary agreements show the time without a redundant status, undated shows only its missing-time fact',()=>{
 const make=(v:any)=>render(React.createElement(CrmListAgreements,{lead:{commitments:[v]},lang:'zh',timezone:zone,now,onOpen(){}}));
 const scheduled=make(item('date',{date:'2026-10-30'}));assert.match(scheduled,/2026-10-30/);assert.doesNotMatch(scheduled,/已约定时间|crm-agreement-status/);
 const undated=make(item('unknown'));assert.equal((undated.match(/未约定时间/g)||[]).length,1);assert.doesNotMatch(undated,/已约定时间|crm-agreement-status/);
 const invalid=make(item('bad',{at:'2026-10-27T00:00:00Z',timezone:'invalid'}));assert.equal((invalid.match(/约定时间无效/g)||[]).length,1);
 const late=make(item('late',{date:'2026-10-26'}));assert.match(late,/约定已逾期/);assert.match(late,/2026-10-26/);
});
