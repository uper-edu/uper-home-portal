import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup as render} from 'react-dom/server';
import {historyInformationBatches,historyFieldCount,historyAmendmentTitle} from '../src/utils/crmHistoryInformation';
import {CrmHistoryInformation,CrmHistoryQuestionnaireOriginal} from '../src/components/crm/CrmHistoryInformation';
import {historyAdditionalSources} from '../src/utils/crmHistorySources';import {CrmHistorySources} from '../src/components/crm/CrmHistorySources';import {buildHistoryTimeline} from '../src/utils/crmHistoryTimeline';
const event=(eventId:string,eventType:string,payload:any={},extra:any={})=>({eventId,eventType,payload,original:'',actor:'visitor',recordedAt:'2026-10-26T10:00:00Z',...extra});
const item=(id:string,extra:any={})=>({id,scope:'main',kind:'field',field:'city',label:'城市',value:'Bandung',before:null,beforeKnown:true,status:'applied',sources:['客户问卷'],reasons:['客户原始答案'],citations:[],factIds:['change'],extractionIds:[],aiReferences:[],...extra});
const source=()=>({id:'g',category:'questionnaire',original:'客户问卷原文',root:event('q','questionnaire.submitted'),events:[event('change','profile.fields_updated',{basisFactIds:['q']})],extractions:[],aliases:['q']} as any);
test('one proven questionnaire source shares state and identical success reasons while retaining all field results',()=>{
 const g=source(),items=[item('city'),item('mode',{field:'mode',label:'授课方式',value:'Online'})],before=JSON.stringify({g,items});
 const html=render(React.createElement(CrmHistoryInformation,{group:g,items}));assert.equal((html.match(/当次已采用/g)||[]).length,1);assert.equal((html.match(/客户问卷/g)||[]).length,1);assert.equal((html.match(/<summary>采用原因/g)||[]).length,1);assert.match(html,/城市/);assert.match(html,/授课方式/);assert.doesNotMatch(html,/未记录|crm-history-information-before/);assert.equal(JSON.stringify({g,items}),before);
});
test('shared source never hides a conflict or an independent adoption reason',()=>{
 const g=source(),items=[item('a'),item('b',{reasons:['另一具体采用原因']}),item('c',{status:'difference',retainedKnown:true,retainedValue:'Jakarta',reasons:['来源矛盾，保留雅加达']})];
 const html=render(React.createElement(CrmHistoryInformation,{group:g,items}));assert.match(html,/另一具体采用原因/);assert.match(html,/来源矛盾，保留雅加达/);assert.match(html,/未采用，保留不同记录/);assert.match(html,/当时保留：/);assert.equal(historyInformationBatches(g,items).length,2);
});
test('equal text and state from independent or unknown sources never become a shared caption',()=>{
 const g=source();g.events.push(event('other','profile.fields_updated',{basisFactIds:['other-q']}));
 for(const next of [item('b',{factIds:['other']}),item('b',{factIds:[]}),item('b',{scope:'am'})])assert.ok(historyInformationBatches(g,[item('a'),next]).every(b=>!b.shared));
});
test('later corrections cannot share the historical adoption caption with current interpretations',()=>{
 const batches=historyInformationBatches(source(),[item('a',{superseded:true}),item('b')]);assert.equal(batches.length,2);assert.ok(batches.every(b=>!b.shared));
});
test('known empty before omits only the empty arrow; zero, real changes, clear and unknown outcomes retain exact meaning',()=>{
 const g=source();
 const show=(extra:any)=>render(React.createElement(CrmHistoryInformation,{group:g,items:[item('a',extra)]}));
 assert.doesNotMatch(show({before:null}),/crm-history-information-before/);
 assert.match(show({field:'budgetAmount',value:1900000,before:1800000}),/Rp1,800,000/);
 assert.match(show({field:'budgetAmount',value:100,before:0}),/crm-history-information-before[^>]*>Rp0/);
 assert.match(show({value:null,before:'Bandung'}),/明确清空/);
 assert.doesNotMatch(show({beforeKnown:false,before:undefined}),/新增|未记录 →/);
 assert.match(show({status:'unknown',beforeKnown:false}),/采用结果未注明/);
});
test('distinct field count differs from write count and amendment title uses only its own actual results',()=>{
 const g=source();g.events=[event('a','profile.fields_updated',{changes:[{field:'city'},{field:'budgetAmount'}]}),event('b','profile.fields_updated',{changes:[{field:'budgetAmount'}]})];
 assert.equal(historyFieldCount(g),2);const a=event('am-fact','record.amended',{id:'am',kind:'correction'});
 assert.deepEqual(historyAmendmentTitle(a,[item('root'),item('fix',{scope:'am',field:'budgetAmount',label:'课程总预算'}),item('fix2',{scope:'am',field:'budgetAmount',label:'课程总预算'})]),{kind:'修正',labels:['课程总预算']});
 assert.deepEqual(historyAmendmentTitle(event('s','record.amended',{id:'s',contactResult:'No Response'}),[]),{kind:'补充',labels:['联系结果']});
});
test('questionnaire evidence is structured, preserves citation and a separate amendment action, never exposes raw JSON',()=>{
 const g=source();g.root.payload={answers:{fullName:'客户原名',city:'Bandung',internalId:'PRIVATE_INTERNAL'}};g.original=JSON.stringify(g.root.payload.answers);const before=JSON.stringify(g);
 const html=render(React.createElement(CrmHistoryQuestionnaireOriginal,{group:g,action:React.createElement('button',{},'补充／修正记录')}));
 assert.match(html,/客户问卷摘要/);assert.match(html,/客户原名/);assert.match(html,/Bandung/);assert.match(html,/crm-history-original-g%3Amain/);assert.match(html,/<button>补充／修正记录<\/button>/);assert.doesNotMatch(html,/<summary>|PRIVATE_INTERNAL|internalId|fullName|查看问卷原始答案/);assert.equal(JSON.stringify(g),before);
});
const message=(id='db',conversationId='conv')=>event('message:'+id,'customer.message',{conversationId},{sourceRecordId:id,original:'请顾问通过WhatsApp联系我'});
const request=(id='r',extra:any={})=>event(id,'task.request_evidence',{action:'handoff',messageId:'request',conversationId:'conv',...extra},{original:'请顾问通过WhatsApp联系我'});
const linked=()=>buildHistoryTimeline([message(),request()],{id:'lead',chatTranscript:[{id:'db',request_id:'request',conversation_id:'conv'}]})[0];
test('an explicitly resolved handoff request adds no duplicate business block but keeps the underlying event and aliases',()=>{
 const g=linked(),before=JSON.stringify(g);assert.equal(g.events.length,2);assert.ok(g.aliases.includes('request'));assert.deepEqual(historyAdditionalSources(g),[]);assert.equal(render(React.createElement(CrmHistorySources,{group:g})), '');assert.equal(JSON.stringify(g),before);
});
test('same text, conversation or time cannot hide an unrelated request without its source link',()=>{
 const g=linked();g.events[1]={...g.events[1],payload:{...g.events[1].payload,messageId:'unrelated'}};
 assert.equal(historyAdditionalSources(g).length,1);
 const groups=buildHistoryTimeline([message(),request('r',{conversationId:'other'})],{id:'lead'});assert.equal(groups.length,2);assert.ok(groups.some(g=>historyAdditionalSources(g).length===1));
});
test('different original, independent request type or specific business reason remains visible',()=>{
 for(const extra of [{payload:{reason:'客户要求今晚联系'}},{original:'请改为明天晚上联系'},{payload:{action:'booking'}}]){
  const g=linked();g.events[1]={...g.events[1],...extra,payload:{...g.events[1].payload,...extra.payload}};
  const items=historyAdditionalSources(g);assert.equal(items.length,1);assert.ok(items[0].reason||items[0].original||items[0].fields.length);
 }
});
