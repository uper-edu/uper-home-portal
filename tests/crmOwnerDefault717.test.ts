import test from'node:test';import assert from'node:assert/strict';import React from'react';import{renderToStaticMarkup as render}from'react-dom/server';
import{defaultLeadFilters,restoreLeadFilterPreferences}from'../src/utils/crmLeadFilters';import{CrmLeadWorkspace}from'../src/components/crm/CrmLeadWorkspace';
test('717: new Sales and Manager default to all accessible; exact old Sales default migrates once',()=>{
 for(const scope of ['own','all'])assert.equal(defaultLeadFilters(scope).ownership,'all');
 const old={...defaultLeadFilters('own'),ownership:'mine'};assert.equal(restoreLeadFilterPreferences(null,old,'own').ownership,'all');assert.equal(restoreLeadFilterPreferences(null,null,'own').ownership,'all');
});
test('717: versioned manual mine/unassigned/owner preferences survive regardless of legacy default',()=>{
 const legacy={...defaultLeadFilters('own'),ownership:'mine'};
 for(const filters of [{...legacy},{...legacy,ownership:'unassigned'},{...legacy,ownership:'all',owner:'sales-b'}]){
  const before=JSON.stringify(filters),saved={version:3,filters};const restored=restoreLeadFilterPreferences(saved,legacy,'own');assert.equal(restored.ownership,filters.ownership);assert.equal(restored.owner,filters.owner);assert.equal(JSON.stringify(filters),before);
 }
});
test('717: non-default legacy conditions stay intact; resetting restores all without broadening permissions',()=>{
 for(const extra of [{search:'TEST'},{sort:'deadline'},{task:'overdue'}]){const legacy={...defaultLeadFilters('own'),ownership:'mine',...extra},restored=restoreLeadFilterPreferences(null,legacy,'own');assert.equal(restored.ownership,'mine');for(const [k,v]of Object.entries(extra))assert.equal((restored as any)[k],v);}
 assert.equal(defaultLeadFilters('own').ownership,'all');
});
test('717: empty accessible scope differs from filtered empty and failed load; no false no-data success',()=>{
 const view=(props:any)=>render(React.createElement(CrmLeadWorkspace,{leads:[],view:'worklist',lang:'zh',timezone:'Asia/Jakarta',isLight:true,loading:false,employeeId:'TEST',employees:[],onOpen(){},onReset(){},...props}));
 assert.match(view({accessibleCount:0}),/当前没有可访问的客户/);assert.doesNotMatch(view({accessibleCount:0}),/清空筛选/);
 assert.match(view({accessibleCount:2}),/当前筛选条件下没有匹配客户/);assert.match(view({accessibleCount:2}),/清空筛选，查看全部可见客户/);
 const failed=view({accessibleCount:0,loadUnavailable:true});assert.match(failed,/客户列表暂不可用/);assert.doesNotMatch(failed,/当前没有可访问的客户/);
});
