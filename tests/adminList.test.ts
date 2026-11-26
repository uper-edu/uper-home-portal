import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminListPagination,AdminListState,AdminListTable} from '../src/components/admin/AdminList';

test('shared table gives sorting and numeric alignment only to the specified columns',()=>{
  const html=renderToStaticMarkup(createElement(AdminListTable,{
    label:'班次',headers:['班次',{label:'候补',numeric:true,sort:'descending'}],
    busy:true,children:createElement('tr',null,createElement('td',null,'HSK 1')),
  }));
  assert.match(html,/aria-busy="true"/);
  assert.match(html,/<th scope="col">班次<\/th>/);
  assert.match(html,/<th scope="col" aria-sort="descending" class="crm-list-number">候补<\/th>/);
});

test('shared list distinguishes permissions, errors, empty results and loading',()=>{
  for(const [state,role] of [['loading','status'],['empty','status'],['denied','alert'],['error','alert']] as const){
    for(const lang of ['zh','en','id'] as const){
      const html=renderToStaticMarkup(createElement(AdminListState,{state,lang,onRetry(){}}));
      assert.ok(html.includes('role="'+role+'"'));
      assert.equal(html.includes('<button'),state==='error');
    }
  }
});

test('shared pagination hides single pages and preserves the active boundary',()=>{
  const props={lang:'zh' as const,page:1,pageCount:2,onPageChange(){}};
  const html=renderToStaticMarkup(createElement(AdminListPagination,props));
  assert.match(html,/第 1 页，共 2 页/);
  assert.match(html,/disabled="">上一页/);
  assert.doesNotMatch(html,/disabled="">下一页/);
  assert.equal(renderToStaticMarkup(createElement(AdminListPagination,{...props,pageCount:1})), '');
});
