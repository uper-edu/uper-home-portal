import assert from 'node:assert/strict';
import {test} from 'node:test';
import {normalizeEnrollmentChatSelection} from '../src/utils/enrollmentChatJourney';
import {readEnrollmentConsultation,readChatRecommendation,readEnrollmentPosition} from '../src/utils/chatJourneyNavigation';

test('Enrollment consult carries only public class or supported catalogue filter identifiers', () => {
  assert.deepEqual(normalizeEnrollmentChatSelection({kind:'catalog',level:'2',period:'weekend',format:'small',
    name:'Learner',price:1,order:'personal-order'}),
  {kind:'catalog',level:'2',period:'weekend',format:'small'});
  assert.deepEqual(normalizeEnrollmentChatSelection({kind:'catalog',level:'all',period:'arbitrary',format:'one-on-one'}),
    {kind:'catalog',format:'one-on-one'});
  assert.deepEqual(normalizeEnrollmentChatSelection({kind:'class',classId:'hsk2-qa',price:1}),
    {kind:'class',classId:'hsk2-qa'});
  assert.equal(normalizeEnrollmentChatSelection({kind:'class',classId:'../crm'}),undefined);
});

test('Chat and Enrollment restore only supported relative routes and valid browsing positions', () => {
  const position={scrollY:260,focus:'class' as const,expanded:['material']};
  const enrollmentConsultation={url:'/enrollment/hsk2-qa?lang=zh&level=2',index:2,
    selection:{kind:'class' as const,classId:'hsk2-qa'},position};
  assert.deepEqual(readEnrollmentConsultation({enrollmentConsultation})?.selection,enrollmentConsultation.selection);
  for (const url of ['//other-site.test','/enrollment/help/account','/system','/\\other-site.test']) {
    assert.equal(readEnrollmentConsultation({enrollmentConsultation:{...enrollmentConsultation,url}}),undefined);
  }
  assert.deepEqual(readEnrollmentPosition({enrollmentPosition:position}),position);
  assert.equal(readEnrollmentPosition({enrollmentPosition:{...position,scrollY:NaN}}),undefined);
  const chatRecommendation={url:'/chat?lang=zh',index:1,anchor:{conversationId:'qa',messageId:'reply-1',owner:'test',widget:false}};
  assert.deepEqual(readChatRecommendation({chatRecommendation}),chatRecommendation);
  assert.equal(readChatRecommendation({chatRecommendation:{...chatRecommendation,url:'/crm'}}),undefined);
});
