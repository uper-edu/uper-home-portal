import {test} from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {backfillPreviewSummary} from '../src/utils/assignmentBackfillPresentation.ts';import {CrmBackfillTable} from '../src/components/crm/CrmAssignmentBackfill.tsx';
const rows=[{id:'a',name:'Maya',ownerId:'s1',ownerName:'Arif'},{id:'b',name:'Rina',ownerId:'s2',ownerName:'Budi'}];
test('preview summary removes duplicate totals and counts only actual receiving salespeople',()=>{assert.equal(backfillPreviewSummary({rows,total:2},'zh'),'2位客户 · 轮询 · 2名接收销售');assert.equal(backfillPreviewSummary({rows,total:120},'zh'),'本次2位 / 共120位 · 轮询 · 2名接收销售');for(const lang of ['en','id'] as const){const text=backfillPreviewSummary({rows:[rows[0],{...rows[1],ownerId:'s1'}],total:2},lang);assert.ok(!text.includes('轮询'));assert.ok(text.includes('1'));}});
test('preview and result retain two columns; skipped recipients never appear as actual owners',()=>{
 const preview=renderToStaticMarkup(React.createElement(CrmBackfillTable,{rows,lang:'zh'}));const result=renderToStaticMarkup(React.createElement(CrmBackfillTable,{rows,lang:'zh',result:{entries:[{id:'a',status:'assigned',ownerId:'s1'},{id:'b',status:'skipped'}]}}));
 assert.equal((preview.match(/<th scope=/g)||[]).length,2);assert.equal((result.match(/<th scope=/g)||[]).length,2);assert.ok(preview.includes('预计负责人'));assert.ok(result.includes('分配结果'));assert.ok(result.includes('Arif'));assert.ok(!result.includes('Budi'));assert.ok(result.includes('已跳过'));
 const unknown=renderToStaticMarkup(React.createElement(CrmBackfillTable,{rows,lang:'zh',result:{entries:[]}}));assert.ok(unknown.includes('结果待核对'));assert.ok(!unknown.includes('已跳过'));
});
