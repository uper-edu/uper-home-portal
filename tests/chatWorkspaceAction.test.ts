import assert from 'node:assert/strict';
import {test} from 'node:test';
import {chatWorkspaceEntry} from '../src/utils/chatWorkspaceAction';
import {parseConsultationReply} from '../server/portal/coursePrices';

test('Consultation replies can request only the supported Chat workspace actions', () => {
  for (const [action, language] of [['assessment', 'zh'], ['assessment_result', 'en'], ['learning_profile', 'id']]) {
    const reply = parseConsultationReply(JSON.stringify({
      reply: 'Open it from Chat.', catalogue: null, enrollment: null, workspaceAction: action, replyLanguage: language,
    }));
    assert.deepEqual(chatWorkspaceEntry(reply.workspaceAction, reply.replyLanguage), {action, language});
  }

  assert.equal(chatWorkspaceEntry('/hsk', 'zh'), undefined);
  assert.equal(chatWorkspaceEntry({action:'assessment'}, 'en'), undefined);
  assert.equal(chatWorkspaceEntry('assessment', 'fr'), undefined);
  assert.equal(chatWorkspaceEntry(undefined, 'id'), undefined);
});

test('assessment navigation copy points directly to the action in each language', async () => {
  const {assessmentWorkspaceReply}=await import('../src/utils/chatWorkspaceAction');
  for(const [language,below] of [['zh','下方按钮'],['en','button below'],['id','tombol di bawah']] as const){
    for(const action of ['assessment','assessment_result'] as const){
      const text=assessmentWorkspaceReply({action,language});
      assert.ok(text?.includes(below));
    }
  }
});

test('a retake replaces the previous class level and drops old class references', async () => {
  const {assessmentEnrollmentSelection,normalizeEnrollmentIntent}=await import('../src/utils/enrollmentGuidance');
  const selection=assessmentEnrollmentSelection(
    {kind:'recommend',level:'HSK 3',referenceIds:['old-class']},
    {level:'HSK 3',requestedLevel:'HSK 3',period:'weekend',format:'standard',days:[6,7]},
    'HSK 1',1,
  );
  const intent=normalizeEnrollmentIntent(selection.value);
  assert.equal(intent?.level,'HSK 1');
  assert.equal(intent?.period,'weekend');
  assert.equal(intent?.format,'standard');
  assert.deepEqual(intent?.days,[6,7]);
  assert.deepEqual(intent?.referenceIds,[]);
  assert.equal(intent?.maxRecommendations,1);
  assert.equal(selection.constraints.requestedLevel,undefined);
});
