import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {CrmHistorySearch,CrmSearchHighlight,searchTextParts} from '../src/components/crm/CrmSearchHighlight';import {CrmHistoryOriginal} from '../src/components/crm/CrmHistoryInformation';
test('literal search highlights all matches case-insensitively, preserving text and escaping metacharacters',()=>{
 for(const [text,query,count] of [['TEST test Test','test',3],['中文预算中文','中文',2],['a+b a.b','a+b',1],['<script>','<script>',1],['内容','   ',0]] as const){const parts=searchTextParts(text,query);assert.equal(parts.map(p=>p.text).join(''),text);assert.equal(parts.filter(p=>p.match).length,count);}
 const html=renderToStaticMarkup(React.createElement(CrmHistorySearch.Provider,{value:'<script>',children:React.createElement(CrmSearchHighlight,{text:'<script>'})}));assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
test('original evidence-location highlight remains distinct from keyword highlighting',()=>{
 const html=renderToStaticMarkup(React.createElement(CrmHistorySearch.Provider,{value:'预算',children:React.createElement(CrmHistoryOriginal,{groupId:'g',text:'预算150万；预算已确认',citation:{scope:'main',quote:'预算150万',start:0,end:7} as any})}));
 assert.match(html,/data-citation-highlight/);assert.match(html,/crm-search-match/);assert.doesNotMatch(html,/<mark[^>]*>[^<]*<mark/);
});
