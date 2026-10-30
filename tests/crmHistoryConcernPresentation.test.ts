import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {historyInformation} from '../src/utils/crmHistoryInformation';
import {historySalesPoints} from '../src/utils/crmHistorySalesContent';
import {historyPointValue,historyPointSummary,CrmHistorySalesHighlights} from '../src/components/crm/CrmHistorySalesHighlights';
import {CrmUiProvider} from '../src/components/crm/CrmUiLanguage';

function fixture(text:string,observations:any[]){
 const group:any={id:'log:test-concern',category:'sales',original:text,log:{id:'test-concern',summary:text},events:[],extractions:[{id:'test-job',source_type:'sales_record',source_id:'test-concern',status:'completed',input:{text},output:{observations:observations.map(o=>({kind:'field',field:'concerns',subject:'customer',temporality:'current',change:'state',decision:'evidence',...o,start:text.indexOf(o.quote)}))}}]};
 return {group,points:historySalesPoints(group,historyInformation(group))};
}
const html=(group:any,points:any[],lang:any='zh')=>render(React.createElement(CrmUiProvider,{lang},React.createElement(CrmHistorySalesHighlights,{groupId:group.id,points,onEvidence(){}})));

test('positive concerns remain a concise list and are not rewritten as new quotations',()=>{
 const {group,points}=fixture('担心预算和上课时间。',[{value:['预算','上课时间'],quote:'担心预算和上课时间。',operation:'add'}]);
 assert.equal(historyPointValue(points[0],'zh'),'预算、上课时间');assert.match(html(group,points),/顾虑与限制/);assert.equal(points[0].kind,'concern');
});

test('negative concern and enrollment statements retain their actual negation in the visible values and collapsed headline',()=>{
 const text='客户不担心学费，仍担心排课冲突；现在不考虑报名。';
 const {group,points}=fixture(text,[{value:['学费'],quote:'客户不担心学费',temporality:'negated'},{value:['排课冲突'],quote:'仍担心排课冲突'},{kind:'signal',field:'enrollment_interest',value:true,quote:'现在不考虑报名。',temporality:'negated'}]);
 assert.equal(historyPointValue(points.find(p=>p.field==='enrollment_interest')!,'zh'),'现在不考虑报名。');
 assert.equal(historyPointValue(points.find(p=>p.kind==='concern'&&p.qualifiers.includes('否定表达'))!,'zh'),'客户不担心学费');
 assert.equal(historyPointValue(points.find(p=>p.kind==='concern'&&!p.qualifiers.length)!,'zh'),'排课冲突');
 assert.match(historyPointSummary(points[0],'zh'),/现在不考虑报名/);assert.doesNotMatch(html(group,points),/明确请求报名|已报名|待处理/);
});

test('conditional concerns and trial requests show the exact conditions instead of a bare budget or positive request label',()=>{
 const text='如果公司不能报销，我才担心预算；只有周末还有名额时，我才考虑预约试听。';
 const {group,points}=fixture(text,[{value:['预算'],quote:'如果公司不能报销，我才担心预算',temporality:'conditional'},{kind:'signal',field:'trial_request',value:true,quote:'只有周末还有名额时，我才考虑预约试听。',temporality:'conditional'}]);
 for(const point of points)assert.ok(historyPointValue(point,'zh').includes(point.kind==='request'?'只有周末还有名额':'如果公司不能报销'));
 const out=html(group,points);assert.match(out,/条件表达/);assert.match(out,/只有周末还有名额/);assert.match(out,/如果公司不能报销/);assert.doesNotMatch(out,/>试听请求<|已预约/);
});

test('withdrawal quotes identify the withdrawn concern while an independent remaining concern is preserved',()=>{
 const text='客户已撤回学费顾虑，排课冲突仍需沟通。';
 const {group,points}=fixture(text,[{value:['学费'],appliedValue:['排课冲突'],quote:'客户已撤回学费顾虑',operation:'remove',change:'changed',temporality:'negated',decision:'apply'},{value:['排课冲突'],quote:'排课冲突仍需沟通。',operation:'add'}]);
 assert.equal(historyPointValue(points[0],'zh'),'客户已撤回学费顾虑');assert.equal(historyPointValue(points[1],'zh'),'排课冲突');assert.match(html(group,points),/撤回说明/);
});

test('conditional or uncertain withdrawal keeps both limitations rather than becoming an unconditional withdrawal',()=>{
 for(const[temporality,label]of [['conditional','条件表达'],['uncertain','尚不确定']]){
  const {points}=fixture('如果排期解决，再撤回排课顾虑。',[{value:['排课冲突'],quote:'如果排期解决，再撤回排课顾虑。',operation:'remove',change:'changed',temporality}]);
  assert.ok(points[0].qualifiers.includes('撤回说明'));assert.ok(points[0].qualifiers.includes(label));assert.match(historyPointValue(points[0],'zh'),/如果排期解决/);
 }
});

test('three-language UI preserves the exact Chinese source and all record data remains immutable',()=>{
 const text='如果公司不能报销，我才担心预算。';const {group,points}=fixture(text,[{value:['预算'],quote:text,temporality:'conditional'}]);const before=JSON.stringify({group,points});
 for(const lang of ['zh','en','id'])assert.ok(html(group,points,lang).includes(text));assert.equal(JSON.stringify({group,points}),before);
});

test('a valid citation cannot pull an unrelated quote into the visible condition text',()=>{
 const text='如果公司不能报销，我才担心预算。';const {group}=fixture(text,[{value:['预算'],quote:text,temporality:'conditional'}]);const items=historyInformation(group);
 items[0].citations.push({id:'foreign',scope:'main',quote:'另一个客户的私有内容',sourceText:'另一个客户的私有内容'});
 const before=JSON.stringify(items),points=historySalesPoints(group,items);assert.equal(points[0].citations.length,1);assert.equal(historyPointValue(points[0],'zh'),text);assert.doesNotMatch(html(group,points),/另一个客户/);assert.equal(JSON.stringify(items),before);
});

test('annotations follow the main information in both summary and expanded content while negation stays in the main wording',()=>{
 const text='如果公司不能报销，我才担心预算。';const {group,points}=fixture(text,[{value:['预算'],quote:text,temporality:'conditional'}]);
 const summary=historyPointSummary(points[0],'zh'),out=html(group,points);
 assert.ok(summary.indexOf(text)<summary.indexOf('条件表达'));assert.ok(out.indexOf(text)<out.indexOf('条件表达'));
 const negative=fixture('现在不考虑报名。',[{kind:'signal',field:'enrollment_interest',value:true,quote:'现在不考虑报名。',temporality:'negated'}]);
 assert.ok(historyPointSummary(negative.points[0],'zh').startsWith('现在不考虑报名。'));assert.ok(html(negative.group,negative.points).indexOf('现在不考虑报名。')<html(negative.group,negative.points).indexOf('否定表达'));
});

test('profile differences are secondary annotations and negated goal wording stays self-contained',()=>{
 const text='客户暂不把申请奖学金作为学习目标。';const {group,points}=fixture(text,[{field:'goal',value:'申请奖学金',quote:text,temporality:'negated',decision:'difference'}]);
 const summary=historyPointSummary(points[0],'zh'),out=html(group,points);
 assert.ok(summary.includes(text));assert.ok(summary.indexOf(text)<summary.indexOf('与资料不同'));assert.ok(out.indexOf(text)<out.indexOf('与资料不同'));
});
