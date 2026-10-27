import test from 'node:test';import assert from 'node:assert/strict';
import {hasInapplicableExamPlan,hasHskQuestionnaireGoal} from '../src/utils/crmQuestionnaire';
import {isCityRefinement} from '../src/utils/crmFieldValues';
import {extractionDecision} from '../src/utils/crmExtractionContract';
import {applyProfileFields} from '../src/utils/crmDynamicProfile';
test('hidden/default exam plan is inapplicable without an explicitly selected HSK goal',()=>{
 assert.equal(hasInapplicableExamPlan({goal:'Improve my Mandarin skills',hskExamPlan:'Within 6 months'}),true);
 assert.equal(hasInapplicableExamPlan({goal:'Improve my Mandarin skills'}),false);
 assert.equal(hasInapplicableExamPlan({goal:'Prepare for HSK certification'}),false);
 assert.equal(hasInapplicableExamPlan({goals:['Improve my Mandarin skills','Prepare for HSK certification'],hskExamPlan:'Within 3 months'}),false);
 assert.equal(hasHskQuestionnaireGoal(null,'Prepare for HSK certification'),false);
});
const o:any={kind:'field',field:'city',value:'Bandung',quote:'我住万隆',subject:'customer',temporality:'current',change:'state'};
const current={city:'Other',tier:'Warm-Online',profileFieldMeta:{city:{revision:1,sourceType:'questionnaire',effectiveAt:'2026-10-26T01:00:00Z',sourceFactIds:['original']}}};
test('Other is refined with concrete later city and original evidence retained in a change',()=>{
 assert.equal(isCityRefinement('Other','Bandung'),true);assert.equal(isCityRefinement('其他地区','万隆'),true);
 const decision=extractionDecision(o,current,{city:1},'2026-10-26T02:00:00Z','我住万隆');assert.equal(decision.decision,'apply');
 const r=applyProfileFields(current,{city:'Bandung'},{city:1},{sourceType:'ai_customer_text',sourceFactId:'new-message-fact',actor:'ai',occurredAt:'2026-10-26T02:00:00Z',recordedAt:'2026-10-26T02:00:01Z'});
 assert.equal(r.profile.city,'Bandung');assert.equal(r.changes[0].before,'Other');assert.equal(r.profile.tier,current.tier);assert.deepEqual(current.profileFieldMeta.city.sourceFactIds,['original']);
});
test('refinement never bypasses concurrency, time, subject or certainty',()=>{
 assert.equal(extractionDecision(o,current,{city:0},'2026-10-26T02:00:00Z').decision,'difference');
 for(const time of [null,'2026-10-25T02:00:00Z'])assert.equal(extractionDecision(o,current,{city:1},time).decision,'difference');
 for(const temporality of ['negated','future','uncertain'])assert.equal(extractionDecision({...o,temporality},current,{city:1},'2026-10-26T02:00:00Z').decision,'evidence');
 assert.equal(extractionDecision({...o,subject:'sales'},current,{city:1},'2026-10-26T02:00:00Z').decision,'evidence');
 assert.equal(extractionDecision(o,{...current,city:'Jakarta'},{city:1},'2026-10-26T02:00:00Z').decision,'difference');
 assert.equal(extractionDecision({...o,value:'Jakarta'},current,{city:1},'2026-10-26T02:00:00Z').decision,'difference');
 assert.equal(isCityRefinement('Other','Other'),false);assert.equal(isCityRefinement('Other','Unknown'),false);
});
