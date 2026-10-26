import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {CrmLeadFilters} from '../src/components/crm/CrmLeadFilters';
import {CrmLeadWorkspace} from '../src/components/crm/CrmLeadWorkspace';
import {defaultLeadFilters} from '../src/utils/crmLeadFilters';
test('refresh retains prior count and actual rows, with non-blocking accessible loading state',()=>{
 const filter=renderToStaticMarkup(React.createElement(CrmLeadFilters,{value:defaultLeadFilters('all'),onChange:()=>{},lang:'zh',scope:'all',owners:[],count:2,loading:true,timezone:'Asia/Jakarta',viewMode:'worklist',onViewMode:()=>{}}));
 assert.match(filter,/匹配 2 位客户/);assert.match(filter,/更新中…/);
 const html=renderToStaticMarkup(React.createElement(CrmLeadWorkspace,{leads:[{id:'maya',fullName:'Maya Putri',tier:'Hot',currentStage:'progress:proposal'}] as any,view:'worklist',lang:'zh',isLight:true,timezone:'Asia/Jakarta',loading:true,employeeId:'sales',employees:[],onOpen:()=>{},onReset:()=>{}}));
 assert.match(html,/aria-busy="true"/);assert.match(html,/Maya Putri/);assert.doesNotMatch(html,/正在加载客户…/);
});
test('query generation retains visible data and stamp; access revocation still clears data',()=>{
 const source=readFileSync(new URL('../src/pages/CrmWorkbench.tsx',import.meta.url),'utf8');
 const begin=source.slice(source.indexOf('if(crmModule!=="leads") return;'),source.indexOf('const current=new CrmPolling'));
 assert.doesNotMatch(begin,/setLeads\(\[\]\)|setLastListRefresh\(""\)/);
 assert.match(source,/if\(code==='unauthorized'\)\{\s*setLeads\(\[\]\)/);
 assert.match(source,/const accessChanged=\(\)=>\{setLeads\(\[\]\)/);
 assert.match(source,/if\(signal.aborted\|\|disposed\)return/);
});
