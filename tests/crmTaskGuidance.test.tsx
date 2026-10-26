import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import{renderToStaticMarkup}from'react-dom/server';
import{taskOverlapCandidates,taskCompletionGuidance,taskOverlapBasis}from'../src/utils/crmTaskGuidance';
import{CrmTaskOverlap}from'../src/components/crm/CrmTaskOverlap';import{CrmTaskCard}from'../src/components/crm/CrmTaskCard';import{completionForEntry}from'../src/utils/crmSalesInput';import{validateWorkflow}from'../server/portal/salesWorkflow';
const task=(id:string,kind='follow_up',details:any={})=>({id,kind,status:'open',dueAt:'2099-01-01T02:00:00Z',details});
test('overlap hints require exact nonempty provenance, never text similarity or absent values',()=>{
 assert.deepEqual(taskOverlapCandidates([task('a','follow_up',{action:'same'}),task('b','follow_up',{action:'same'})]),[]);
 assert.deepEqual(taskOverlapCandidates([task('a'),task('b')]),[]);
 assert.deepEqual(taskOverlapCandidates([task('a','follow_up',{matterId:' '}),task('b','follow_up',{matterId:' '})]),[]);
 assert.equal(taskOverlapCandidates([task('a','follow_up',{matterId:'m'}),task('b','follow_up',{matterId:'m'})])[0].basis,'same_matter');
 assert.equal(taskOverlapCandidates([task('a','booking',{sourceConversationId:'c',sourceMessageId:'m'}),task('b','enrollment',{sourceConversationId:'c',sourceMessageId:'m'})])[0].basis,'same_source');
 assert.deepEqual(taskOverlapCandidates([task('a','follow_up',{sourceConversationId:'c1',sourceMessageId:'m'}),task('b','follow_up',{sourceConversationId:'c2',sourceMessageId:'m'})]),[]);
});
test('scope hints do not call distinct requests duplicates; filter closed work and keep source records unchanged',()=>{
 const tasks=[task('a','consultation'),task('b','booking'),task('c','enrollment'),{...task('closed','handoff'),status:'completed'}];const before=JSON.stringify(tasks);
 assert.equal(taskOverlapCandidates(tasks).length,2);assert.equal(taskOverlapCandidates(tasks,'b').length,1);assert.equal(JSON.stringify(tasks),before);
 assert.equal(taskOverlapCandidates([task('a','booking'),task('b','booking')])[0].basis,'same_type');
 assert.deepEqual(taskOverlapCandidates([task('a','booking'),task('a','booking')]),[]);
});
test('three languages render advisory guidance without changing customer text, adding completion controls or concealing deadlines',()=>{
 for(const lang of ['en','id','zh'] as const){
  const items=[task('a','consultation',{action:'客户原文 <TEST> Alpha'}),task('b','booking',{action:'Customer original B'})];
  const html=renderToStaticMarkup(<CrmTaskOverlap tasks={items} lang={lang} timezone="Asia/Jakarta"/>);assert.ok(html.includes('客户原文 &lt;TEST&gt; Alpha'));assert.ok(html.includes('Customer original B'));assert.ok(html.includes('2099-01-01'));assert.ok(!html.includes('<input'));assert.ok(!html.includes('<button'));
  for(const kind of ['consultation','handoff','booking','enrollment','contact_review','follow_up'])assert.ok(taskCompletionGuidance({kind},lang).length>30);
  for(const basis of ['same_matter','same_source','contact_scope','same_type'] as const)assert.ok(taskOverlapBasis(basis,lang).length>10);
  const card=renderToStaticMarkup(<CrmTaskCard task={items[0]} lead={{owner:null}} lang={lang} timezone="Asia/Jakarta"/>);assert.ok(card.includes('crm-task-completion-guidance'));assert.ok(card.includes('客户原文'));
 }
 assert.equal(renderToStaticMarkup(<CrmTaskOverlap tasks={[task('one')]} lang="zh" timezone="Asia/Jakarta"/>),'');
});
test('the existing single-task completion guard still rejects widening a task result',()=>{
 assert.deepEqual(completionForEntry('a',['a','b']),['a']);
 assert.throws(()=>validateWorkflow({requestId:'TEST',summary:'Actual outcome',recordKind:'closure',processingTaskId:'a',completeTaskIds:['a','b'],taskOutcome:'complete',disposition:'keep'}),/Invalid task selection/);
});
