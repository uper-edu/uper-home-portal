import test from 'node:test';import assert from 'node:assert/strict';import content from '../src/components/crm/marketingPlaybook.json';import{overviewSectionHtml,marketingOverviewSvg}from'../src/utils/marketingOverviewSvg';
test('only overview SVG changes; original Mermaid, caption, citations and complete prose remain byte-identical',()=>{
 const original=content.sections[1].html,rendered=overviewSectionHtml(original);const strip=(s:string)=>s.replace(/<svg[\s\S]*?<\/svg>/,'[diagram]');assert.equal(strip(rendered),strip(original));assert.match(rendered,/查看可编辑的 Mermaid 图表源码/);assert.match(rendered,/上传成功，只证明算法回路中的一个入口初步可用/);
});
test('all eleven original relationships and conditional boundaries remain explicit and accessible',()=>{
 for(const edge of ['A-B','B-C','C-D','D-F','E-F','F-G','G-H','H-A','F-I','A-I','I-A'])assert.ok(marketingOverviewSvg.includes(`data-edge="${edge}"`),edge);
 assert.match(marketingOverviewSvg,/aria-labelledby=/);assert.match(marketingOverviewSvg,/支持且配置正确时/);assert.match(marketingOverviewSvg,/适用的CAPI路线/);assert.match(marketingOverviewSvg,/非已部署配置/);assert.match(marketingOverviewSvg,/人员决策/);assert.match(marketingOverviewSvg,/上传成功 ≠ 匹配成功/);
 assert.throws(()=>overviewSectionHtml('<svg></svg>'),'source boundaries must be checked');
});
