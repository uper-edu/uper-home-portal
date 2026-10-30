import test from'node:test';import assert from'node:assert/strict';import{identityReviewedDetail}from'../src/utils/crmIdentityDetail';
test('canonical detail replaces source number, owner, task and source-only context',()=>{
 const source={id:'B',businessNumber:'B-number',owner:null,identityLifecycle:'pending',sourceOnly:'B',attention:{tasks:[{id:'B-task'}]}};
 const response={lead:{id:'A',fullName:'A-name',owner:'sales',currentStage:'progress:unreached'},tasks:[]};
 const result=identityReviewedDetail(source,'B',response,'sales');assert.equal(result.id,'A');assert.equal(result.businessNumber,undefined);assert.equal(result.sourceOnly,undefined);assert.equal(result.identityLifecycle,undefined);assert.deepEqual(result.attention,{isMine:true,tasks:[]});assert.equal(source.businessNumber,'B-number');
});
test('late identity response does not replace another selected customer; per-customer drafts stay isolated',()=>{
 const current={id:'C'},drafts={A:{summary:'A draft'},B:{summary:'B draft'}};assert.equal(identityReviewedDetail(current,'B',{lead:{id:'A'}},'sales'),current);assert.deepEqual(drafts,{A:{summary:'A draft'},B:{summary:'B draft'}});
});
