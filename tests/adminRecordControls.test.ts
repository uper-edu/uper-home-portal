import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminRecordHeader} from '../src/components/admin/AdminRecordHeader';
import {AdminRecordSidebar,useAdminRecordSidebarLayout} from '../src/components/admin/AdminRecordWorkspace';
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

test('the shared sidebar layout exposes exactly one list return for each view',()=>{
  const back={label:'返回主列表',href:'/crm?classPage=2'};
  function Workspace({persistent,listOpen,available=true}:{persistent:boolean;listOpen:boolean;available?:boolean}) {
    const layout=useAdminRecordSidebarLayout({id:'sample-records',back,persistent,listOpen,available,lang:'zh',setListOpen:()=>{}});
    return createElement('main',null,
      layout.listNavigation,
      createElement(AdminRecordSidebar,{...layout.sidebar,title:'记录',filters:null,busyLabel:'更新中'}),
      createElement('article',{hidden:layout.listOnly},
        createElement(AdminRecordHeader,{back:layout.headerBack,title:'详情',actions:layout.browseAction})),
    );
  }
  const desktop=renderToStaticMarkup(createElement(Workspace,{persistent:true,listOpen:false}));
  assert.match(desktop,/<aside[^>]*><div class="crm-record-sidebar-heading"><h2[^>]*>记录<\/h2>.*返回主列表.*<\/aside>/);
  assert.equal(desktop.match(/返回主列表/g)?.length,1);
  assert.doesNotMatch(desktop,/查看记录列表|返回详情/);

  const narrowList=renderToStaticMarkup(createElement(Workspace,{persistent:false,listOpen:true}));
  assert.match(narrowList,/<nav[^>]*>.*返回详情.*<\/nav>/);
  assert.match(narrowList,/<article hidden="">/);
  assert.equal(narrowList.match(/返回主列表/g)?.length,1);

  const narrowDetail=renderToStaticMarkup(createElement(Workspace,{persistent:false,listOpen:false}));
  assert.match(narrowDetail,/<aside[^>]* hidden=""/);
  assert.match(narrowDetail,/<article><header[^>]*>.*返回主列表.*查看记录列表.*<\/header>/);

  const unavailable=renderToStaticMarkup(createElement(Workspace,{persistent:true,listOpen:true,available:false}));
  assert.match(unavailable,/<aside[^>]* hidden=""/);
  assert.match(unavailable,/<article><header[^>]*>.*返回主列表.*<\/header>/);
  assert.doesNotMatch(unavailable,/查看记录列表|返回详情/);
});
