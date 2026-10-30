import test from 'node:test';import assert from 'node:assert/strict';
import{campaignEditBase,campaignEditConflicts}from'../src/utils/campaignEditConflict';
test('743 independent name and budget edits merge, nested leaves exclude counters',()=>{
 const original={name:'old',stats:{budgetCost:null,impressions:1},boundUtm:{defaultLang:'id',defaultHook:'trial_class'}};
 const budget={stats:{budgetCost:100},requestId:'test'};const base=campaignEditBase(original,budget);
 assert.deepEqual(base,{'stats.budgetCost':null});assert.deepEqual(campaignEditConflicts({...original,name:'new',stats:{...original.stats,impressions:8}},budget,base),[]);
 assert.deepEqual(campaignEditConflicts({...original,stats:{budgetCost:200}},budget,base),['stats.budgetCost']);
 const lang={boundUtm:{defaultLang:'zh'}};assert.deepEqual(campaignEditConflicts({...original,boundUtm:{...original.boundUtm,defaultHook:'consultation'}},lang,campaignEditBase(original,lang)),[]);
});
test('743 changed same field conflicts; reviewed baseline permits explicit save; missing base rejected',()=>{
 const fields={name:'mine'},old={name:'old'},latest={name:'theirs'};
 assert.deepEqual(campaignEditConflicts(latest,fields,campaignEditBase(old,fields)),['name']);
 assert.deepEqual(campaignEditConflicts(latest,fields,campaignEditBase(latest,fields)),[]);
 assert.deepEqual(fields,{name:'mine'});assert.deepEqual(campaignEditConflicts(latest,fields,{}),['name']);
});
