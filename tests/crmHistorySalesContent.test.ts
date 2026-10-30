import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {historySalesPoints} from '../src/utils/crmHistorySalesContent';
import {CrmHistorySalesHighlights,historyPointSummary} from '../src/components/crm/CrmHistorySalesHighlights';
import {historyInformation} from '../src/utils/crmHistoryInformation';
import {questionnaireSalesRows,questionnaireSalesPreview} from '../src/utils/crmQuestionnaireSalesContent';
import {CrmHistoryQuestionnaireOriginal,historyOriginalId} from '../src/components/crm/CrmHistoryInformation';
import {CrmUiProvider} from '../src/components/crm/CrmUiLanguage';
import {crmUiText} from '../src/utils/crmUiText';

const original='请顾问用WhatsApp联系我。我担心上课时间与工作冲突。现在搬到了万隆。';
const group:any={id:'message:one',category:'message',original,root:{eventType:'customer.message'},events:[],extractions:[]};
const observation=(field:string,extra:any={})=>({kind:'field',field,value:'Bandung',quote:'现在搬到了万隆。',subject:'customer',temporality:'current',change:'state',...extra});
function row(id:string,o:any,extra:any={}){return {id,scope:'main',kind:o.kind,field:o.field,label:({city:'城市',concerns:'主要顾虑',goal:'主要学习目标',goals:'其他学习目标'}as any)[o.field]||o.field,value:o.value,beforeKnown:false,retainedKnown:false,status:o.kind==='signal'?'evidence':'applied',sources:['AI提取'],reasons:[],citations:[{id,scope:'main',quote:o.quote,sourceText:original}],factIds:[],extractionIds:[],superseded:false,aiReferences:[],observation:o,...extra};}

test('saved source-linked requests, concerns and explicit changes are ordered without modifying originals or observations',()=>{
 const items=[row('city',observation('city',{change:'changed'}),{before:'Surabaya',beforeKnown:true}),row('concern',observation('concerns',{value:['上课时间与工作冲突'],quote:'我担心上课时间与工作冲突。'})),row('request',observation('advisor_request',{kind:'signal',value:true,quote:'请顾问用WhatsApp联系我。'}))];
 const before=JSON.stringify({group,items}),points=historySalesPoints(group,items);
 assert.deepEqual(points.map(p=>p.kind),['request','concern','change']);assert.equal(points[2].showBefore,true);assert.equal(points[2].before,'Surabaya');assert.equal(JSON.stringify({group,items}),before);
 const html=render(React.createElement(CrmHistorySalesHighlights,{groupId:group.id,points,onEvidence(){}}));assert.match(html,/请求顾问联系/);assert.match(html,/顾虑与限制/);assert.match(html,/Surabaya/);assert.match(html,/Bandung/);assert.doesNotMatch(html,/当次已采用|采用原因|pending|source_id|已预约|待处理/);
});

test('negated, conditional, historical, uncertain and future expressions keep their qualifiers and never become confirmed outcomes',()=>{
 for(const[temporality,label]of Object.entries({negated:'否定表达',conditional:'条件表达',past:'历史表达',uncertain:'尚不确定',future:'未来表达'})){
  const o=observation('enrollment_request',{kind:'signal',value:true,temporality}),points=historySalesPoints(group,[row('request',o)]);
  assert.equal(points.length,1);assert.ok(historyPointSummary(points[0],'zh').includes(label));assert.equal(points[0].value,'报名请求');assert.doesNotMatch(render(React.createElement(CrmHistorySalesHighlights,{groupId:group.id,points})),/明确请求报名|已报名|已预约|待处理/);
 }
 const sales=row('staff',observation('advisor_request',{kind:'signal',value:true,subject:'sales'}));assert.equal(historySalesPoints(group,[sales]).length,0);
});

test('unlinked, ambiguous, protected, superseded or malformed evidence stays out of sales highlights',()=>{
 const base=row('a',observation('city'));
 for(const extra of [{scope:'another-record'},{citations:[{...base.citations[0],sourceText:'另一个客户原文'}]},{superseded:true},{kind:'protected_field',field:'email'},{kind:'field',field:'email'},{status:'unknown'},{observation:{...base.observation,temporality:'unrecognized'}}])assert.equal(historySalesPoints(group,[{...base,...extra}]).length,0);
 const repeated={...group,original:'同句。同句。'},ambiguous=row('r',observation('city',{quote:'同句。'}),{citations:[{id:'r',scope:'main',quote:'同句。',sourceText:repeated.original}]});assert.equal(historySalesPoints(repeated,[ambiguous]).length,0);
 assert.equal(historySalesPoints(group,[row('false',observation('trial_request',{kind:'signal',value:false}))]).length,0);
 assert.equal(historySalesPoints({...group,category:'assessment'},[base]).length,0);
});

test('same-record correction replaces only its highlight, all historical evidence remains intact',()=>{
 const g={...group,events:[{eventId:'fix',eventType:'record.amended',payload:{id:'am',kind:'correction'},original:'课程总预算是190万。'}]};
 const old=row('old',observation('budgetAmount',{value:1800000}),{superseded:true});
 const fix=row('fix',observation('budgetAmount',{value:1900000}),{scope:'am'});
 assert.deepEqual(historySalesPoints(g,[old,fix]),[]);assert.equal(old.value,1800000);assert.equal(fix.value,1900000);
});

test('list additions and removals show this statement rather than accumulated profile values',()=>{
 const o=observation('concerns',{value:['排课冲突'],operation:'add'}),item=row('add',o,{value:['预算','排课冲突']});const point=historySalesPoints(group,[item])[0];assert.deepEqual(point.value,['排课冲突']);assert.ok(point.qualifiers.includes('本次补充'));
 const removal=historySalesPoints(group,[row('remove',{...o,operation:'remove',temporality:'negated'},{value:['预算']})])[0];assert.deepEqual(removal.value,['排课冲突']);assert.ok(removal.qualifiers.includes('撤回说明'));assert.equal(removal.showBefore,false);
});

test('later supplements are labeled as supplements and AI references never stand in for a different manual value',()=>{
 const text='客户首选印尼语。',g={...group,events:[{eventId:'a',eventType:'record.amended',payload:{id:'supplement',kind:'supplement'},original:text}]};
 const item=row('a',observation('communicationLanguage',{value:'id',quote:text}),{scope:'supplement',citations:[{id:'a',scope:'supplement',quote:text,sourceText:text}]});
 const points=historySalesPoints(g,[item]);assert.equal(points.length,1);assert.ok(points[0].qualifiers.includes('后续补充'));
 const manual={...item,scope:'main',manualSourceId:'log',aiReferences:[{value:'en',reason:'解释不同'}]};assert.equal(historySalesPoints(group,[manual]).length,0);
});

test('same-quote weak/strong requests deduplicate only the view; independent or opposite statements remain',()=>{
 const interest=row('i',observation('trial_interest',{kind:'signal',value:true})),request=row('r',observation('trial_request',{kind:'signal',value:true}));assert.deepEqual(historySalesPoints(group,[interest,request]).map(p=>p.field),['trial_request']);
 const opposite={...interest,observation:{...interest.observation,temporality:'negated'}};assert.equal(historySalesPoints(group,[opposite,request]).length,2);
 const independent=row('other',observation('trial_interest',{kind:'signal',value:true,quote:'请顾问用WhatsApp联系我。'}));assert.equal(historySalesPoints(group,[independent,request]).length,2);
 assert.equal(interest.field,'trial_interest');
});

test('identical goal dimensions combine their exact values and preserve both original citations',()=>{
 const items=[row('a',observation('goal',{value:'提升中文能力'})),row('b',observation('goals',{value:['提升中文能力','赴华留学']}))];
 const before=JSON.stringify(items),points=historySalesPoints(group,items);assert.equal(points.length,1);assert.equal(points[0].label,'学习目标');assert.deepEqual(points[0].value,['提升中文能力','赴华留学']);assert.equal(JSON.stringify(items),before);
 const conflict={...items[1],status:'difference'};assert.equal(historySalesPoints(group,[items[0],conflict]).length,2);
});

test('shared exact quotes have one locate action; independently quoted facts keep their own actions',()=>{
 const items=[row('a',observation('city')),row('b',observation('goal',{value:'留学'}))],points=historySalesPoints(group,items);
 const html=render(React.createElement(CrmHistorySalesHighlights,{groupId:group.id,points,onEvidence(){}}));assert.equal((html.match(/<button/g)||[]).length,1);assert.ok(html.includes(historyOriginalId(group.id,'main')));
 const second=row('c',observation('concerns',{value:['时间冲突'],quote:'我担心上课时间与工作冲突。'}));assert.equal((render(React.createElement(CrmHistorySalesHighlights,{groupId:group.id,points:historySalesPoints(group,[...items,second]),onEvidence(){}})).match(/<button/g)||[]).length,2);
});

test('questionnaire prioritizes meaningful learning answers, combines exact goal duplicates and keeps identity in the complete original',()=>{
 const g:any={id:'questionnaire',category:'questionnaire',root:{payload:{answers:{fullName:'TEST客户',email:'test@example.invalid',whatsapp:'+12025550123',goal:'提升中文能力',goals:['提升中文能力','提升中文能力','赴华留学'],city:'Other',reportedLevel:'HSK 3',mode:'Online',campaignName:'TEST活动',entryPoint:'chat'}}}};
 const before=JSON.stringify(g),rows=questionnaireSalesRows(g);assert.deepEqual(rows[0].values,['提升中文能力','赴华留学']);assert.deepEqual(rows.map(r=>r.key),['goals','reportedLevel','mode']);assert.doesNotMatch(questionnaireSalesPreview(g,'zh'),/Other|客户姓名|test@example|TEST活动/);
 const html=render(React.createElement(CrmHistoryQuestionnaireOriginal,{group:g,salesSummary:true,showTimes:false}));const main=html.split('<details')[0];assert.match(main,/学习目标/);assert.doesNotMatch(main,/WhatsApp|test@example|TEST活动|Other/);assert.match(html,/<details[^>]*><summary>查看完整原始问卷/);assert.match(html,/test@example.invalid/);assert.match(html,/TEST活动/);assert.equal(JSON.stringify(g),before);
 const focused=render(React.createElement(CrmHistoryQuestionnaireOriginal,{group:g,salesSummary:true,fields:['email']}));assert.match(focused,/<details[^>]* open/);assert.match(focused,/crm-history-field-match/);
});

test('missing questionnaire needs are not called no needs, and original-only records do not generate invented highlights',()=>{
 const g={id:'q',root:{payload:{answers:{fullName:'TEST'}}}};assert.equal(questionnaireSalesRows(g).length,0);assert.match(render(React.createElement(CrmHistoryQuestionnaireOriginal,{group:g,salesSummary:true})),/暂未记录学习需求/);assert.deepEqual(historySalesPoints(group,[]),[]);
});

test('three-language business captions and qualifiers render, preserving customer words exactly',()=>{
 const points=historySalesPoints(group,[row('r',observation('trial_request',{kind:'signal',value:true,temporality:'conditional'})),row('c',observation('concerns',{value:['客户原文不翻译']}))]);
 const labels=['诉求与意向','顾虑与限制','本次变化','本次提及','本条记录重点','历史表达','未来表达','条件表达','尚不确定','否定表达','撤回说明','与资料不同','本次补充','后续补充','修正说明','问卷中的学习需求','查看完整原始问卷','试听请求'];
 for(const lang of ['zh','en','id']){const html=render(React.createElement(CrmUiProvider,{lang},React.createElement(CrmHistorySalesHighlights,{groupId:group.id,points,onEvidence(){}})));assert.match(html,/客户原文不翻译/);assert.ok(html.includes(crmUiText('条件表达',lang)));for(const label of labels)if(lang!=='zh')assert.notEqual(crmUiText(label,lang),label);}
});

test('actual persisted extraction shape produces safe source-linked highlights without any AI execution',()=>{
 const g={...group,extractions:[{id:'job',source_type:'customer_message',source_id:'one',status:'completed',input:{text:original},output:{observations:[{...observation('advisor_request',{kind:'signal',value:true,quote:'请顾问用WhatsApp联系我。'}),decision:'evidence'}]}}]};
 const points=historySalesPoints(g,historyInformation(g));assert.equal(points.length,1);assert.equal(points[0].value,'请求顾问联系');
});
