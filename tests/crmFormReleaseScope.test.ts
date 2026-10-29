import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup as render} from 'react-dom/server';
import {AdminField,AdminForm} from '../src/components/AdminForm';
const h=React.createElement;
test('shared CMS/system/CRM fields preserve exact values, validation and explanations',()=>{
 const html=render(h(AdminField,{required:true},'Title',h('input',{defaultValue:'Original title'}),h('small',null,'Original explanation')));
 assert.match(html,/admin-field-control/);assert.match(html,/<input[^>]*required=""/);assert.match(html,/value="Original title"/);assert.match(html,/<small>Original explanation<\/small>/);
 const form=render(h(AdminForm,{lang:'zh'},h('input',{name:'original'})));assert.match(form,/data-admin-form/);assert.match(form,/name="original"/);
});
test('shared grouping preserves original text, required and disabled fields',()=>{
 const html=render(h(AdminForm,{lang:'zh'},h(AdminField,{required:true},'客户原文',h('textarea',{defaultValue:'原文（可选）',disabled:true}),h('small',null,'原说明'))));
 assert.match(html,/data-admin-form=""/);assert.match(html,/class="admin-field"/);assert.match(html,/admin-field-control/);assert.match(html,/required=""/);assert.match(html,/disabled=""/);assert.match(html,/原文（可选）/);assert.match(html,/<small>原说明<\/small>/);
});
test('shared choices retain their own checkbox semantics',()=>{
 const html=render(h(AdminField,null,h('input',{type:'checkbox',defaultChecked:true}),'显示状态'));
 assert.match(html,/admin-field--choice/);assert.doesNotMatch(html,/admin-field-control|required=""/);assert.match(html,/checked=""/);
});
