import test from 'node:test';import assert from 'node:assert/strict';
import {identityComparisonFieldPresent as has,identityComparisonFields} from '../src/utils/crmIdentityComparison.ts';
test('empty records have no common evidence despite localized fallback labels',()=>{
 const side={profile:{communicationLanguage:'unknown',reportedLevel:'Not sure'},tasks:[]};
 for(const field of identityComparisonFields)assert.equal(has(side,field),false,field);
});
test('concrete zero scores and beginner reports are evidence; absent tasks and partial composites are not',()=>{
 assert.equal(has({profile:{quizScore:0}},'assessment'),true);
 assert.equal(has({profile:{reportedLevel:'Beginner'}},'assessment'),true);
 assert.equal(has({profile:{levelSource:'trial'}},'assessment'),false);
 assert.equal(has({profile:{city:'Jakarta'}},'location'),false);
 assert.equal(has({profile:{city:'Jakarta',mode:'Online'}},'location'),true);
 assert.equal(has({profile:{},tasks:[{status:'completed'}]},'tasks'),false);
 assert.equal(has({profile:{},tasks:[{status:'open'}]},'tasks'),true);
 assert.equal(has({profile:{communicationLanguage:'id'}},'language'),true);
 assert.equal(has({profile:{goals:['',' '] }},'goals'),false);
});
