import {test} from 'node:test';import assert from 'node:assert/strict';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {RefreshCw} from 'lucide-react';import {CrmPageAction} from '../src/components/crm/CrmPageAction';
test('refresh timestamp is an accessible tooltip, while unrelated page actions retain existing markup',()=>{
 const html=renderToStaticMarkup(createElement(CrmPageAction,{label:'刷新数据',icon:RefreshCw,iconOnly:true,description:'上次刷新 2026-10-26 04:00:00'}));
 assert.match(html,/aria-describedby=/);assert.match(html,/role="tooltip"/);assert.match(html,/上次刷新/);assert.match(html,/aria-label="刷新数据"/);
 const plain=renderToStaticMarkup(createElement(CrmPageAction,{label:'新增',icon:RefreshCw}));assert.doesNotMatch(plain,/role="tooltip"|crm-page-action-hint/);
});
