import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup as render} from 'react-dom/server';import {AdminField,AdminFieldLabel,AdminRequiredNote,adminFieldName,firstMissingAdminField,adminFieldValidationMessage} from '../src/components/AdminForm';import {CrmSingleSelect} from '../src/components/crm/CrmSingleSelect';
const h=React.createElement;
test('required label has a star, an associated native control and programmatic required state',()=>{const html=render(h(AdminField,null,'姓名（必填）',h('input',{required:true,defaultValue:'Maya'})));assert.match(html,/姓名<span[^>]*aria-hidden="true"> \*<\/span>/);assert.match(html,/required=""/);assert.match(html,/aria-required="true"/);assert.match(html,/value="Maya"/);const id=html.match(/<input[^>]*id="([^"]+)"/)![1];assert.ok(html.includes('for="'+id+'"'));});
test('optional suffixes are removed, explicit conditional false wins, values remain verbatim',()=>{const html=render(h(AdminField,{required:false},'邮箱（可选）',h('input',{defaultValue:'值（可选）'})));assert.doesNotMatch(html,/admin-required-star|aria-required|required=""/);assert.match(html,/value="值（可选）"/);assert.equal(adminFieldName('活动名称 *'),'活动名称');assert.equal(adminFieldName('Link name · optional'),'Link name');});
test('CMS sibling label is associated without changing its existing container',()=>{const html=render(h(AdminField,{as:'div'},h('label',null,'标题'),h('input',{required:true})));assert.match(html,/^<div class="admin-field">/);assert.match(html,/<label for=/);assert.match(html,/admin-required-star/);});
test('required custom select inherits field semantics and reports an empty selection',()=>{const html=render(h(AdminField,{required:true},h('span',null,'来源'),h(CrmSingleSelect,{label:'来源',value:'',options:[],onChange:()=>{},lang:'zh',isLight:true})));assert.match(html,/role="combobox"/);assert.match(html,/aria-required="true"/);assert.match(html,/data-admin-has-value="false"/);});
test('preflight rejects empty native and custom fields, ignores disabled and hidden fields',()=>{const control=(more:any={})=>({matches:()=>false,readOnly:false,getClientRects:()=>[{}],getAttribute:()=>null,checkValidity:()=>true,dataset:{},...more});const valid=control();const emptyCombo=control({getAttribute:()=> 'combobox',dataset:{adminHasValue:'false'}});const hidden=control({getClientRects:()=>[],checkValidity:()=>false});const disabled=control({matches:()=>true,checkValidity:()=>false});const root=(items:any[])=>({querySelectorAll:()=>items}) as any;assert.equal(firstMissingAdminField(root([valid,hidden,disabled,emptyCombo])),emptyCombo);const empty=control({checkValidity:()=>false});assert.equal(firstMissingAdminField(root([empty])),empty);assert.equal(firstMissingAdminField(root([valid,hidden,disabled])),undefined);});
test('required note explains the asterisk and labels do not duplicate it',()=>{assert.match(render(h(AdminRequiredNote,{lang:'zh'})),/必填/);assert.doesNotMatch(render(h(AdminRequiredNote,{lang:'zh'})),/<p/);const html=render(h(AdminFieldLabel,{required:true},'字段 *'));assert.equal((html.match(/admin-required-star/g)||[]).length,1);});

test('an authentication heading owns its required note, with no external portal or marker',()=>{
 const html=render(h('h1',null,h('span',null,'CRM 登录'),h(AdminRequiredNote,{lang:'zh',inline:true})));
 assert.match(html,/<h1><span>CRM 登录<\/span><span class="admin-required-note"/);
 assert.doesNotMatch(html,/admin-required-note-sr|hidden=""/);
 assert.equal((html.match(/class="admin-required-note"/g)||[]).length,1);
});

test('existing shared label is normalized once rather than appending duplicate stars',()=>{const html=render(h(AdminField,null,h(AdminFieldLabel,null,'活动名称 *'),h('input',{required:true})));assert.equal((html.match(/admin-required-star/g)||[]).length,1);});

function invalidField(validity:Partial<ValidityState>,more:any={}){
 return {getAttribute:()=>null,labels:[{textContent:'新密码 *'}],validity:{valueMissing:false,tooShort:false,tooLong:false,...validity},minLength:12,maxLength:200,...more} as unknown as HTMLInputElement;
}
test('missing values alone use the required-field prompt in all interface languages',()=>{
 const field=invalidField({valueMissing:true});
 assert.equal(adminFieldValidationMessage(field,'zh'),'请填写必填项：新密码');
 assert.equal(adminFieldValidationMessage(field,'en'),'Complete the required field: 新密码');
 assert.equal(adminFieldValidationMessage(field,'id'),'Lengkapi kolom wajib: 新密码');
});
test('nonempty short passwords report the actual minimum, not a missing field',()=>{
 const field=invalidField({tooShort:true});
 assert.equal(adminFieldValidationMessage(field,'zh'),'新密码：至少输入 12 个字符');
 assert.equal(adminFieldValidationMessage(field,'en'),'新密码: Enter at least 12 characters');
 assert.equal(adminFieldValidationMessage(field,'id'),'新密码: Masukkan minimal 12 karakter');
});
test('overlong fields report the configured maximum in all interface languages',()=>{
 const field=invalidField({tooLong:true});
 assert.equal(adminFieldValidationMessage(field,'zh'),'新密码：最多输入 200 个字符');
 assert.equal(adminFieldValidationMessage(field,'en'),'新密码: Enter no more than 200 characters');
 assert.equal(adminFieldValidationMessage(field,'id'),'新密码: Masukkan maksimal 200 karakter');
});
test('other invalid values are not misreported as empty required fields',()=>{
 for(const validity of [{typeMismatch:true},{patternMismatch:true},{rangeOverflow:true},{rangeUnderflow:true},{stepMismatch:true},{badInput:true},{customError:true}]){
  const field=invalidField(validity);
  assert.equal(adminFieldValidationMessage(field,'zh'),'请检查填写内容：新密码');
  assert.equal(adminFieldValidationMessage(field,'en'),'Check the value for: 新密码');
  assert.equal(adminFieldValidationMessage(field,'id'),'Periksa isian: 新密码');
 }
});
test('empty required custom selects keep the missing-selection prompt',()=>{
 const field=invalidField({}, {getAttribute:(name:string)=>name==='role'?'combobox':name==='aria-label'?'来源 *':null,dataset:{adminHasValue:'false'}});
 assert.equal(adminFieldValidationMessage(field,'zh'),'请填写必填项：来源');
});
test('preflight still rejects nonempty invalid fields and permits valid fields',()=>{
 const short=invalidField({tooShort:true},{matches:()=>false,readOnly:false,getClientRects:()=>[{}],checkValidity:()=>false});
 const valid=invalidField({valid:true},{matches:()=>false,readOnly:false,getClientRects:()=>[{}],checkValidity:()=>true});
 const root=(fields:any[])=>({querySelectorAll:()=>fields}) as any;
 assert.equal(firstMissingAdminField(root([valid,short])),short);
 assert.equal(firstMissingAdminField(root([valid])),undefined);
});
