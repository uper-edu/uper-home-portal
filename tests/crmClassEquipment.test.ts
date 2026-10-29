import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {validateClassEquipment,insightValueText,classEquipmentWords} from '../src/utils/crmClassEquipment';
import {aiInsightDefinition} from '../src/utils/crmDimensionCatalog';
import {applyInsightObservation,validateInsightDimension,validateInsightObservation} from '../src/utils/crmCustomerInsights';
import {CrmCustomerInsights} from '../src/components/crm/CrmCustomerInsights';import {CrmUiProvider} from '../src/components/crm/CrmUiLanguage';
const dim=validateInsightDimension({labels:{en:'Learning equipment',id:'Perangkat belajar',zh:'学习设备'},definition:{en:'Equipment',id:'Perangkat',zh:'设备'}},'learning_equipment');
const context=(more:any={})=>({eventId:'e1',sourceId:'s1',sourceType:'sales_record',root:{id:'s1',type:'sales_record'},recordedAt:'2026-10-29T07:00:00Z',occurredAt:null,baseRevision:0,amendment:false,standardEquipment:true,...more});
const observation=(value:any,operation='replace',more:any={})=>({field:dim.key,value,operation,quote:'客户原文',basis:'stated',subject:'customer',temporality:'current',change:'changed',...more});
const apply=(p:any,o:any,c:any=context())=>applyInsightObservation(p,dim,o,c);
test('controlled devices expose multilingual names, version and fixed choices without changing stored definition',()=>{
 const original=JSON.stringify(dim),d=aiInsightDefinition(dim);assert.equal(d.valueType,'enum_list');assert.equal(d.version,2);assert.equal(d.labels.zh,'上课使用设备');assert.equal(JSON.stringify(dim),original);
 for(const lang of ['zh','en','id'])assert.ok(insightValueText(['tablet','phone'],dim.key,lang).length>0);
 for(const v of [['smartphone'],['phone','phone'],['computer_unspecified','laptop'],'tablet',null])assert.throws(()=>validateClassEquipment(v));
 assert.deepEqual(validateClassEquipment(['phone','tablet']),['phone','tablet']);
});
test('multi-select additions/removals preserve unmentioned devices and the previous snapshots',()=>{
 const a=apply({},observation(['phone','laptop']));const b=apply(a.profile,observation(['tablet'],'add'),context({eventId:'e2',baseRevision:1,recordedAt:'2026-10-29T08:00:00Z'}));
 assert.deepEqual(b.value,['phone','laptop','tablet']);const c=apply(b.profile,observation(['phone'],'remove',{temporality:'negated'}),context({eventId:'e3',baseRevision:2,recordedAt:'2026-10-29T09:00:00Z'}));assert.deepEqual(c.value,['laptop','tablet']);assert.deepEqual(a.value,['phone','laptop']);assert.equal(c.profile.aiInsights[dim.key].history.length,3);
});
test('a specific computer replaces only the unspecified computer category, never phones',()=>{
 const a=apply({},observation(['computer_unspecified','phone']));const b=apply(a.profile,observation(['laptop'],'add'),context({eventId:'e2',baseRevision:1,recordedAt:'2026-10-29T08:00:00Z'}));assert.deepEqual(b.value,['phone','laptop']);
});
test('ambiguous use, inference, stale writes and old independent corrections cannot silently change equipment',()=>{
 const a=apply({},observation(['phone']));for(const [o,c]of [[observation(['laptop'],'replace',{basis:'inferred'}),{baseRevision:1}],[observation(['laptop'],'replace',{temporality:'uncertain'}),{baseRevision:1}],[observation(['laptop']),{baseRevision:0}],[observation(['laptop']),{baseRevision:1,amendment:true,root:{type:'sales_record',id:'other'}}],[observation(['phone'],'remove',{change:'state'}),{baseRevision:1}]]){const b=apply(a.profile,o,context({eventId:'e2',recordedAt:'2026-10-29T08:00:00Z',...c}));assert.deepEqual(b.value,['phone']);assert.notEqual(b.decision,'apply');}
});
test('legacy text is readable and retained; incomplete additions do not silently replace it',()=>{
 const a=apply({},observation('之前使用手机','set'),context({standardEquipment:false}));const b=apply(a.profile,observation(['tablet'],'add'),context({eventId:'e2',baseRevision:1,recordedAt:'2026-10-29T08:00:00Z'}));assert.equal(b.decision,'difference');assert.equal(b.value,'之前使用手机');
 const c=apply(b.profile,observation(['tablet','phone']),context({eventId:'e3',baseRevision:1,recordedAt:'2026-10-29T09:00:00Z'}));assert.deepEqual(c.value,['tablet','phone']);assert.equal(c.profile.aiInsights[dim.key].history[0].value,'之前使用手机');assert.throws(()=>apply({},observation('手机','set')));
 assert.throws(()=>validateInsightObservation(observation(['phone'],'execute')));
});
test('history suppresses identical value/quote pairs and labels different summaries; values stay unchanged',()=>{
 const a=apply({},observation('旧使用手机','set',{quote:'旧使用手机'}),context({standardEquipment:false}));const b=apply(a.profile,observation(['tablet'], 'replace',{quote:'现在改用平板电脑上课'}),context({eventId:'e2',baseRevision:1,recordedAt:'2026-10-29T08:00:00Z'}));const before=JSON.stringify(b.profile);
 for(const lang of ['zh','en','id'] as const){const html=renderToStaticMarkup(React.createElement(CrmUiProvider,{lang,children:React.createElement(CrmCustomerInsights,{lead:{id:'TEST',...b.profile},lang})}));assert.ok(html.includes(classEquipmentWords[lang]));assert.equal(html.split('旧使用手机').length-1,1);assert.ok(html.includes('现在改用平板电脑上课'));assert.ok(html.includes(insightValueText(['tablet'],dim.key,lang)));}
 assert.equal(JSON.stringify(b.profile),before);
});
