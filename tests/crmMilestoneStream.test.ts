import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {attachFactMilestones,establishedFactMilestones} from '../server/portal/factMilestones';
import {groupFactMilestones} from '../src/utils/crmFactMilestones';import {CrmListMilestones} from '../src/components/crm/CrmListMilestones';
import {groupFollowupInteractions} from '../src/utils/crmFollowupGrouping';import {CrmGroupedFollowup} from '../src/components/crm/CrmGroupedFollowup';import {CrmSalesBrief} from '../src/components/crm/CrmSalesBrief';
const at='2026-10-25T10:00:00Z',receipt='2026-10-25T11:00:00Z';
const attempt=(id:string,lead_id='a',time:any=at)=>({id,lead_id,created_at:receipt,result:{score:id==='one'?30:0,maxScore:30,attempt:{mode:'express',completedAt:time}}});
test('batch authorized reads and detail projector share exact milestone identity/count/time; display cache repair does not change business state',async()=>{
 const attempts=[attempt('one','a','2026-10-25T09:00:00Z'),attempt('two'),attempt('foreign','b')],facts=[{id:'en',lead_id:'a',kind:'stage.changed',created_at:receipt,data:{schema:2,after:'progress:enrolled',enrollmentConfirmed:true,effectiveAt:null}}],calls:any[]=[];
 const db={async query(sql:string,args:any[]){calls.push([sql,args]);assert.ok(sql.startsWith('SELECT'));assert.deepEqual(JSON.parse(args[0]),['a']);return {rows:sql.includes('hsk_attempts')?attempts:facts};}};
 const lead:any={id:'a',tier:'Hot',currentStage:'progress:paused',commitments:[{id:'x'}],followUpLogs:[]};
 await attachFactMilestones(db,[lead]);assert.equal(calls.length,2);const expected=groupFactMilestones(establishedFactMilestones(attempts.filter(a=>a.lead_id==='a'),facts));
 assert.deepEqual(lead.factMilestoneSummary.map((g:any)=>[g.key,g.count,g.latest.id,g.latest.occurredAt]),expected.map(g=>[g.key,g.count,g.latest.id,g.latest.occurredAt]));
 assert.equal(lead.latestAssessment.score,0);assert.equal(lead.tier,'Hot');assert.equal(lead.currentStage,'progress:paused');assert.deepEqual(lead.commitments,[{id:'x'}]);assert.ok(!JSON.stringify(lead).includes('foreign'));
});
test('empty authorization scope never queries; unconfirmed old stages and AI statements never establish milestones',async()=>{await attachFactMilestones({query(){throw Error('unexpected read')}},[]);assert.deepEqual(establishedFactMilestones([],[{kind:'sales.stage_observed',data:{stage:'Enrolled'}},{kind:'stage.changed',data:{schema:2,after:'progress:enrolled',enrollmentConfirmed:false}}]),[]);});
test('list summary distinguishes enrollment records from test count, keeps unknown time and accessible evidence navigation',()=>{
 const groups=groupFactMilestones(establishedFactMilestones([attempt('one','a',null),attempt('two')],[]));const html=renderToStaticMarkup(React.createElement(CrmListMilestones,{lead:{factMilestoneSummary:groups},onOpen:()=>{}}));assert.match(html,/快速测评/);assert.match(html,/2次/);assert.ok(!html.replace(/title="[^"]*"/g,'').includes('含未知时间'));assert.match(html,/含1条时间未知/);assert.match(html,/aria-label="查看快速测评的历次记录和依据/);assert.doesNotMatch(html,/30\/30|评分|Hot/);
});
const event=(id:string,type:string,payload:any={},extra:any={})=>({eventId:id,leadId:'a',eventType:type,payload,occurredAt:at,recordedAt:receipt,sourceRecordId:id,original:'',...extra});
const points=(id='m',time:any=at)=>[{id:'msg'+id,kind:'message',value:{id,content:'客户原文：询问学费，希望试听'},times:[{label:'实际发生',at:time}]},{id:'hint'+id,kind:'hint',value:{id:'text-signal:price_inquiry',kind:'evidence',text:'询问价格 · 客户原文',evidenceIds:[id]},times:[{label:'实际发生',at:time}]}];
test('same original and actual time group once, preserving quote and source without repeated signal quotes',()=>{
 const events=[event('message','customer.message',{}, {sourceRecordId:'m',original:'客户原文：询问学费，希望试听'})],p=points(),before=JSON.stringify({p,events});const grouped=groupFollowupInteractions(p,{id:'a'},events,[]);
 assert.equal(grouped.length,1);assert.equal(grouped[0].title,'询问价格');assert.equal(grouped[0].parts.length,2);
 const html=renderToStaticMarkup(React.createElement(CrmGroupedFollowup,{point:grouped[0],lead:{id:'a'},lang:'zh',onEvidence:()=>{}}));assert.equal((html.match(/客户原文：询问学费，希望试听/g)||[]).length,1);assert.match(html,/查看本次互动的原文与整理依据/);assert.equal(JSON.stringify({p,events}),before);
});
test('same text/different original, different times and multiple-basis conflicts remain independent',()=>{
 const events=[event('e1','customer.message',{}, {sourceRecordId:'m',original:'相同'}),event('e2','customer.message',{}, {sourceRecordId:'n',original:'相同'})];
 assert.equal(groupFollowupInteractions([...points('m'),...points('n')],{id:'a'},events,[]).length,2);
 const p=points();p[1].times[0].at='2026-10-25T10:01:00Z';assert.equal(groupFollowupInteractions(p,{id:'a'},events,[]).length,2);
 const conflict={...points()[1],value:{kind:'difference',evidenceIds:['m','n']}};assert.equal(groupFollowupInteractions([points()[0],conflict],{id:'a'},events,[]).length,2);
});
test('unknown actual time can group by exact source but is never replaced with record time; correction keeps independent display',()=>{
 const events=[event('m','customer.message',{}, {sourceRecordId:'m',original:'原文',occurredAt:null})];const g=groupFollowupInteractions(points('m',null),{id:'a'},events,[]);assert.equal(g.length,1);assert.equal(g[0].times[0].at,null);
 const p=points('amend');const rows=[{id:'r',source_type:'sales_amendment',source_id:'amend',input:{sourceRoot:{type:'customer_message',id:'m'}}}];assert.equal(groupFollowupInteractions(p,{id:'a'},events,rows).length,2);
});
test('empty customer needs use one empty state, never six repeated placeholders',()=>{const html=renderToStaticMarkup(React.createElement(CrmSalesBrief,{lead:{id:'a',currentStage:'progress:discovery'},lang:'zh'}));assert.match(html,/暂无记录/);assert.doesNotMatch(html,/<dd>未记录/);});

test('follow-up stage precedes established milestones, separate from the learning needs summary',()=>{
 const html=renderToStaticMarkup(React.createElement(CrmSalesBrief,{lead:{id:'a',currentStage:'progress:discovery'},lang:'zh',milestones:React.createElement('div',null,'ESTABLISHED_EVENT')}));
 assert.ok(html.indexOf('crm-sales-stage-focus')<html.indexOf('ESTABLISHED_EVENT'));assert.ok(html.indexOf('ESTABLISHED_EVENT')<html.indexOf('学习目标'));
});
