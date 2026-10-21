import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergePolicyConfig,policyConfigErrors} from '../src/utils/crmPolicyConfigValidation';
import {DEFAULT_CRM_POLICY_CONFIG as defaults} from '../src/types/crmPolicyConfig';

test('policy patches retain other sections, nested leaves, metadata and do not mutate the saved object',()=>{
 const before=structuredClone(defaults);
 const {value,errors}=mergePolicyConfig(before,{firstResponseSla:{hot:{value:5}},milestones:{trialReminderBefore:{unit:'minutes'}},updatedAt:'forged'});
 assert.deepEqual(errors,{}); assert.equal(value.firstResponseSla.hot.value,5); assert.equal(value.firstResponseSla.hot.unit,'hours');
 assert.deepEqual(value.firstResponseSla.warm,before.firstResponseSla.warm);assert.deepEqual(value.noResponseCadence,before.noResponseCadence);assert.equal(value.updatedAt,before.updatedAt);assert.deepEqual(before,defaults);
});
test('all policy sections reject invalid structure, units, values and calendar; zero count and tier order are not new business constraints',()=>{
 const invalid=[null,[],{}, {milestones:null},{milestones:{trialReminderBefore:{value:-4}}},{reactivation:{reactivatedResponse:{value:0}}},{inactivityWatchdog:{coldInactivity:{unit:'weeks'}}},{noResponseCadence:{retryInterval:{value:'4'}}},{noResponseCadence:{maxRetriesBeforeNurture:-1}},{noResponseCadence:{maxRetriesBeforeNurture:1.5}},{businessHours:{timezone:'invalid/timezone'}},{businessHours:{workDays:[1,1]}},{businessHours:{workDays:[]}},{businessHours:{nextDayGraceTime:'99:99'}},{businessHours:{startTime:'22:00',endTime:'20:00'}},{badField:true}];
 for(const patch of invalid)assert.ok(Object.keys(mergePolicyConfig(defaults,patch).errors).length,JSON.stringify(patch));
 for(const value of [NaN,Infinity,-Infinity,Number.MAX_VALUE])assert.ok(Object.keys(mergePolicyConfig(defaults,{milestones:{assessmentFollowUpAfter:{value,unit:'days'}}}).errors).length);
 assert.deepEqual(mergePolicyConfig(defaults,{noResponseCadence:{maxRetriesBeforeNurture:0},firstResponseSla:{hot:{value:48},warm:{value:24},cold:{value:4}}}).errors,{});
 assert.deepEqual(policyConfigErrors(defaults),{});
});
