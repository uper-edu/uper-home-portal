import test from 'node:test';import assert from 'node:assert/strict';
import {leadDetailTab,leadDetailUrl} from '../src/utils/crmDetailNavigation.ts';
test('detail URLs encode identity, preserve filters, remove the other module and normalize unsupported tabs',()=>{
 const u=new URL(leadDetailUrl('https://example.test/crm?tab=campaigns&campaign=old&campaignView=info&campaignArea=overview&campaignSearch=November&scope=own#old','TEST/a+b','assessment'));
 assert.equal(u.searchParams.get('lead'),'TEST/a+b');assert.equal(u.searchParams.get('leadView'),'assessment');assert.equal(u.searchParams.get('scope'),'own');assert.equal(u.searchParams.get('campaignSearch'),'November');assert.equal(u.searchParams.has('campaign'),false);assert.equal(u.searchParams.has('campaignArea'),false);assert.equal(u.hash,'');assert.equal(leadDetailTab('missing'),'activities');
 const list=new URL(leadDetailUrl(u.href));assert.equal(list.searchParams.has('lead'),false);assert.equal(list.searchParams.has('leadView'),false);assert.equal(list.searchParams.get('tab'),'leads');
});

test('returning from every detail tab removes the selected customer while retaining list scope, filters and sort',()=>{
 for(const tab of ['activities','profile','assessment','chat'] as const){
  const url=new URL(leadDetailUrl(`https://example.test/crm?tab=leads&lead=TEST%2Fcustomer&leadView=${tab}&workScope=all&ownership=unassigned&search=TEST+Learner&task=today&sort=priority#old`));
  assert.equal(url.searchParams.get('tab'),'leads');assert.equal(url.searchParams.has('lead'),false);assert.equal(url.searchParams.has('leadView'),false);assert.equal(url.hash,'');
  for(const [key,value] of [['workScope','all'],['ownership','unassigned'],['search','TEST Learner'],['task','today'],['sort','priority']])assert.equal(url.searchParams.get(key),value);
 }
});
