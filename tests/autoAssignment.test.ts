import {test} from 'node:test';import assert from 'node:assert/strict';
import {roundRobinNext,assignmentCandidates} from '../server/portal/autoAssignment.ts';
import {DEFAULT_CRM_POLICY_CONFIG as defaults} from '../src/types/crmPolicyConfig.ts';
import {effectivePolicy,mergePolicyConfig} from '../src/utils/crmPolicyConfigValidation.ts';
import {mergePolicyTopic,topicPatch} from '../src/utils/crmPolicyTopics.ts';
import {builtInRoles,projectEmployee} from '../src/utils/accessControl.ts';
test('default off with round robin; other strategies and invalid participant lists rejected',()=>{
 assert.deepEqual(defaults.autoAssignment,{enabled:false,strategy:'round_robin',salesIds:[]});
 for(const strategy of ['weighted','matching','on_duty'])assert.ok(mergePolicyConfig(defaults,{autoAssignment:{enabled:true,strategy,salesIds:['a']}}).errors.autoAssignment);
 for(const salesIds of [[],['a','a'],[null]])assert.ok(mergePolicyConfig(defaults,{autoAssignment:{enabled:true,strategy:'round_robin',salesIds}}).errors.autoAssignment);
});
test('round robin rotates and handles removed or empty participants',()=>{assert.equal(roundRobinNext(['a','b']),'a');assert.equal(roundRobinNext(['a','b'],'a'),'b');assert.equal(roundRobinNext(['a','b'],'b'),'a');assert.equal(roundRobinNext(['b'],'a'),'b');assert.equal(roundRobinNext([]),null)});
test('participant eligibility checks active status and actual assigned-record access',()=>{
 const roles=Object.entries(builtInRoles).map(([id,config])=>({id,config,enabled:true,revision:1}));
 const employee=projectEmployee({id:'a',active:true,roles:['sales'],display_name:'Arif',access_revision:1},roles);
 assert.equal(assignmentCandidates([employee],['a'],{team:'sales'}).length,1);assert.equal(assignmentCandidates([{...employee,active:false}],['a'],{}).length,0);assert.equal(assignmentCandidates([{...employee,permissions:[]}],['a'],{}).length,0);
});
test('assignment topic uses existing concurrency checks and preserves unrelated settings',()=>{
 const current=structuredClone(defaults),base=topicPatch(current,'assignment');const patch={autoAssignment:{enabled:true,strategy:'round_robin',salesIds:['a']}};
 const merged=mergePolicyTopic(current,'assignment',{base,patch});assert.equal(merged.kind,'saved');if(merged.kind==='saved'){assert.deepEqual(merged.value.businessHours,current.businessHours);assert.equal(mergePolicyTopic(merged.value,'assignment',{base,patch:{autoAssignment:{...patch.autoAssignment,salesIds:['b']}}}).kind,'conflict')}
 const effective=effectivePolicy({}, {timezone:'Asia/Jakarta',start:'09:00',end:'20:00',days:[1],hotHours:3,warmHours:24,coldHours:48});assert.equal(effective.autoAssignment.enabled,false);
});
