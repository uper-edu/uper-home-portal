import {test} from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {registerHooks} from 'node:module';
const hook=registerHooks({load(url,c,next){return url.endsWith('.css')?{format:'module',source:'export default {}',shortCircuit:true}:next(url,c)}});
const {CrmAutoAssignmentFields}=await import('../src/components/crm/CrmAutoAssignmentFields.tsx');hook.deregister();
for(const lang of ['zh','en','id'] as const)test('strategies visibly listed, unsupported choices disabled '+lang,()=>{
 const html=renderToStaticMarkup(React.createElement(CrmAutoAssignmentFields,{value:{enabled:true,strategy:'round_robin',salesIds:[]},onChange:()=>{},lang}));
 assert.equal((html.match(/type="radio"/g)||[]).length,4);assert.equal((html.match(/disabled=""/g)||[]).length,3);assert.match(html,/checked="" value="round_robin"/);assert.ok(!html.includes('<select'));
});

test('historical backfill is an unchecked transient option, with a separate preview entry',()=>{const html=renderToStaticMarkup(React.createElement(CrmAutoAssignmentFields,{value:{enabled:true,strategy:'round_robin',salesIds:['a']},onChange:()=>{},lang:'zh',showIncludeExisting:true,onPreview:()=>{}}));assert.ok(html.includes('同时分配现有未分配客户'));const input=(html.match(/<input[^>]+>/g)||[]).find(tag=>tag.includes('aria-label="同时分配现有未分配客户"'))!;assert.ok(input);assert.ok(!input.includes('checked='));assert.ok(input.includes('aria-describedby='));assert.ok(html.includes('分配现有未分配客户'));assert.ok(html.includes('保存后先预览'));});
