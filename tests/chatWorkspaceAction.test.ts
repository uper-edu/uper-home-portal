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
