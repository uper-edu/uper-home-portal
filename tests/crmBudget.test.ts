import test from 'node:test';import assert from 'node:assert/strict';
import {profileFields,validateProfileUpdates,applyProfileFields,dynamicProfileHints} from '../src/utils/crmDynamicProfile';
import {supportsCourseBudget} from '../src/utils/crmBudget';
import {budgetPresentation} from '../src/utils/crmLeadPresentation';
import {validateExtraction,extractionDecision,extractionInstruction,EXTRACTION_VERSION} from '../src/utils/crmExtractionContract';
const observation=(quote:string,value:any)=>({kind:'field',field:'budgetAmount',value,quote,subject:'customer',temporality:'current',change:'state'} as any);
const context={sourceType:'sales_edit',sourceFactId:'source',actor:'Robert',recordedAt:'2026-10-26T12:00:00Z',occurredAt:null,adopt:true};
test('budget is one optional amount, with no currency/period/range fields or default zero',()=>{
 assert.deepEqual(Object.keys(profileFields).filter(k=>k.startsWith('budget')),['budgetAmount']);assert.equal(budgetPresentation({}),null);assert.equal(budgetPresentation({budgetAmount:null}),null);assert.match(budgetPresentation({budgetAmount:0})!.value,/Rp0/);
 for(const field of ['budgetMin','budgetMax','budgetCurrency','budgetPeriod'])assert.throws(()=>validateProfileUpdates({[field]:1}));
 for(const value of [-1,NaN,Infinity,'1500000',{},[]])assert.throws(()=>validateProfileUpdates({budgetAmount:value}));
 assert.deepEqual(validateProfileUpdates({budgetAmount:null}),{budgetAmount:null});
});
test('ordinary stated budgets work in Chinese and source-language notation, without inventing scope fields',()=>{
 for(const [quote,value] of [['预算150万印尼盾',1500000],['我的预算是一百八十万印尼盾',1800000],['Anggaran saya Rp1.500.000',1500000],['Budget saya 1,5 juta',1500000],['预算为0印尼盾',0]] as const){
 assert.equal(supportsCourseBudget(value,quote),true,quote);const observations=validateExtraction({observations:[observation(quote,value)]},quote);assert.equal(extractionDecision(observations[0],{}, {},'2026-10-26T12:00:00Z',quote).decision,'apply');
 }
 assert.match(EXTRACTION_VERSION,/course-budget/);assert.match(extractionInstruction,/budgetAmount/);assert.doesNotMatch(extractionInstruction,/budgetMin|budgetMax|budgetCurrency|budgetPeriod/);
});
test('unsupported monetary claims remain evidence rather than invented totals or chosen bounds',()=>{
 for(const [quote,value] of [['每月预算150万',1500000],['预算100万到150万',1500000],['预算100-150万',1000000],['预算150美元',150],['课程学费150万',1500000],['预算150万印尼盾',1800000]] as const){assert.equal(supportsCourseBudget(value,quote),false,quote);assert.equal(extractionDecision(observation(quote,value),{}, {},'2026-10-26T12:00:00Z',quote).decision,'evidence');}
});
test('manual single-amount save keeps old value, source and concurrency while leaving business state untouched',()=>{
 const original={id:'maya',tier:'Hot',owner:'Robert',currentStage:'progress:proposal',commitments:[{id:'a'}]},before=JSON.stringify(original);
 const first=applyProfileFields(original,{budgetAmount:1500000},{budgetAmount:0},context);
 const next=applyProfileFields(first.profile,{budgetAmount:1800000},{budgetAmount:1},{...context,sourceFactId:'second'});
 assert.equal(next.profile.budgetAmount,1800000);assert.equal(next.changes[0].before,1500000);assert.equal(next.changes[0].adoption,'explicit_sales_edit');assert.throws(()=>applyProfileFields(next.profile,{budgetAmount:2000000},{budgetAmount:1},context));
 for(const key of ['tier','owner','currentStage','commitments'])assert.deepEqual((next.profile as any)[key],(original as any)[key]);assert.equal(JSON.stringify(original),before);assert.ok(!dynamicProfileHints(next.profile).some(h=>h.id==='budget-unit'));
});
