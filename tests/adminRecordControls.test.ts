import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminRecordHeader} from '../src/components/admin/AdminRecordHeader';
import {AdminRecordEntry,AdminRowAction} from '../src/components/admin/AdminListControl';
import {AdminStatus} from '../src/components/AdminStatus';

test('record header keeps its named return and record title in the same header',()=>{
  const html=renderToStaticMarkup(createElement(AdminRecordHeader,{
    back:{label:'返回班次列表',href:'/crm?tab=enrollment-management&classPage=2'},
    title:createElement('h1',null,'HSK 1'),
  }));
  assert.match(html,/<header[^>]*admin-record-header.*<a class="admin-record-back" href="\/crm\?tab=enrollment-management&amp;classPage=2".*返回班次列表<\/a><h1>HSK 1<\/h1>/);
});

test('record destinations use links and local actions use buttons with native disabled state',()=>{
  const entry=renderToStaticMarkup(createElement(AdminRecordEntry,{href:'/crm?tab=leads&lead=sample'},'Sample'));
  assert.match(entry,/<a [^>]*href="\/crm\?tab=leads&amp;lead=sample"[^>]*class="admin-record-entry"/);
  const action=renderToStaticMarkup(createElement(AdminRowAction,{disabled:true},'核对到账'));
  assert.match(action,/<button disabled="" type="button" class="admin-row-action">核对到账<\/button>/);
});

test('status labels remain passive and retain their explicit semantic tone',()=>{
  const unknown=renderToStaticMarkup(createElement(AdminStatus,{tone:'warning',children:'结果未知'}));
  const failure=renderToStaticMarkup(createElement(AdminStatus,{tone:'danger',children:'明确失败'}));
  assert.match(unknown,/^<span[^>]+data-tone="warning".*结果未知<\/span>$/);
  assert.match(failure,/^<span[^>]+data-tone="danger".*明确失败<\/span>$/);
});
