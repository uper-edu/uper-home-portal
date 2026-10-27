import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup as render} from 'react-dom/server';
import {historyDisplayInformation,historySharedCitations,historyBusinessReasons,historyQuoteRange} from '../src/utils/crmHistoryInformation';import {CrmHistoryInformation} from '../src/components/crm/CrmHistoryInformation';
const quote='请顾问通过WhatsApp联系我',text='我住在泗水，'+quote;
const citation={id:'q',scope:'main',quote,sourceText:text};
const item=(id:string,extra:any={})=>({id,scope:'main',kind:'field',field:'preferredChannel',label:'首选联系渠道',value:'WhatsApp',before:null,beforeKnown:true,status:'applied',sources:['AI提取'],reasons:[],citations:[citation],factIds:['f'],extractionIds:['job'],superseded:false,aiReferences:[],...extra});
const group=()=>({id:'g',original:text,root:{eventId:'original'},events:[{eventId:'f',payload:{basisFactIds:['original']}}],extractions:[{id:'job',source_type:'customer_message',source_id:'m',status:'completed',input:{text},output:{observations:[]}}]} as any);
const locatorCount=(html:string)=>(html.match(/<span>定位原文<\/span>/g)||[]).length;
test('shared passage has one public locator and explicit references on every related result across adoption states',()=>{
 const g=group(),items=[item('channel'),item('request',{kind:'signal',field:'advisor_request',label:'请求顾问联系',value:true,status:'evidence',observation:{temporality:'current'}})],before=JSON.stringify({g,items});
 const html=render(React.createElement(CrmHistoryInformation,{group:g,items}));assert.equal(locatorCount(html),1);assert.match(html,/共同依据 · 首选联系渠道、请求顾问联系/);assert.equal((html.match(/<article[^>]*aria-describedby="crm-history-original-g%3Amain-shared-0"/g)||[]).length,2);assert.equal((html.match(/aria-label="共同依据 1"/g)||[]).length,2);assert.match(html,/当次已采用/);assert.match(html,/仅保留依据/);assert.deepEqual(historyQuoteRange(text,citation),{start:6,end:6+quote.length});assert.equal(JSON.stringify({g,items}),before);
});
test('independent passages, offsets and amendment scopes never share a reference just because their words match',()=>{
 const a=item('a'),b=item('b',{citations:[{...citation,id:'other',start:99}]});assert.equal(historySharedCitations([a,b]).length,0);
 assert.equal(historySharedCitations([a,item('c',{scope:'am',citations:[{...citation,scope:'am'}]})]).length,0);
 const html=render(React.createElement(CrmHistoryInformation,{group:group(),items:[a,item('city',{field:'city',label:'城市',value:'Surabaya',citations:[{id:'city',scope:'main',quote:'我住在泗水',sourceText:text}]})]}));assert.equal(locatorCount(html),2);assert.doesNotMatch(html,/crm-history-shared-evidence/);
});
test('multiple shared passages each retain one locator and their own associations',()=>{
 const other={id:'other',scope:'main',quote:'我住在泗水',sourceText:text};const items=[item('a'),item('b'),item('c',{citations:[other]}),item('d',{citations:[other]})];
 const html=render(React.createElement(CrmHistoryInformation,{group:group(),items}));assert.equal(locatorCount(html),2);assert.equal((html.match(/class="crm-history-shared-evidence"/g)||[]).length,2);assert.match(html,/aria-label="共同依据 2"/);
});
const goal=(id:string,field:string,value:any,extra:any={})=>item(id,{field,label:field==='goal'?'主要学习目标':'其他学习目标',value,sources:['客户问卷'],citations:[],extractionIds:[],...extra});
test('exact same-source goals combine visually while both original records and all distinct citations remain accessible',()=>{
 const g=group(),primary=goal('a','goal','提升中文能力',{citations:[citation]}),other=goal('b','goals',['提升中文能力'],{citations:[{...citation,id:'b',quote:'我住在泗水'}]}),items=[primary,other],before=JSON.stringify({g,items});
 const display=historyDisplayInformation(g,items);assert.equal(display.length,1);assert.equal(display[0].label,'学习目标');assert.deepEqual(display[0].displayMembers,items);assert.equal(display[0].citations.length,2);
 const html=render(React.createElement(CrmHistoryInformation,{group:g,items}));assert.equal((html.match(/class="crm-history-information-item"/g)||[]).length,1);assert.match(html,/aria-label="主要学习目标、其他学习目标"/);assert.equal(locatorCount(html),2);assert.equal(JSON.stringify({g,items}),before);
});
test('different goals, prior values, provenance, reasons and conflicts retain their distinct visible results',()=>{
 const a=goal('a','goal','提升中文能力'),base=goal('b','goals',['提升中文能力']);
 for(const b of [{...base,value:['提升中文能力','赴华留学']},{...base,before:['赴华留学']},{...base,beforeKnown:false},{...base,status:'difference'},{...base,reasons:['独立理由']},{...base,factIds:['other']}])assert.equal(historyDisplayInformation(group(),[a,b]).length,2);
});
test('matching historical goal transitions retain their real old and new values in the combined row',()=>{
 const items=[goal('a','goal','提升中文能力',{before:'赴华留学'}),goal('b','goals',['提升中文能力'],{before:['赴华留学']})];
 const html=render(React.createElement(CrmHistoryInformation,{group:group(),items}));assert.match(html,/赴华留学/);assert.match(html,/提升中文能力/);assert.match(html,/aria-label="变为"/);
});
test('only the known rule explanation is removed; specific adoption/conflict reasons and original text stay intact',()=>{
 const rule='有原文依据的行为／诉求，不代表已处理或成交',i=item('request',{kind:'signal',status:'evidence',observation:{temporality:'current'},reasons:[rule,'客户明确要求明晚联系']});
 assert.deepEqual(historyBusinessReasons(i),['客户明确要求明晚联系']);const before=JSON.stringify(i),html=render(React.createElement(CrmHistoryInformation,{group:group(),items:[i]}));assert.doesNotMatch(html,new RegExp(rule));assert.match(html,/客户明确要求明晚联系/);assert.equal(JSON.stringify(i),before);
});
