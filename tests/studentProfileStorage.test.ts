import {selectVisitorScope} from '../src/services/visitorScope';
selectVisitorScope('a'.repeat(64));
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getChatAssessmentStatus, getStudentContext, saveStudentContext, clearStudentContext } from '../src/services/studentProfileStorage.ts';
import type { UnifiedStudentContext } from '../src/services/studentProfileStorage.ts';
import type { LeadProfile } from '../src/types/leadSystem.ts';

const partial = { fullName: 'Test', levelState: 'PARTIAL' } as LeadProfile;
const context = (patch: Partial<UnifiedStudentContext> = {}): UnifiedStudentContext => ({
  leadProfile: partial, lastUpdated: '2026-10-12', ...patch,
});

test('existing unfinished profiles resume; completed, known and beginner profiles do not', () => {
  assert.equal(getChatAssessmentStatus(null), 'not_required');
  assert.equal(getChatAssessmentStatus(context()), 'pending');
  for (const levelState of ['ZERO', 'KNOWN'] as const) {
    assert.equal(getChatAssessmentStatus(context({ leadProfile: { ...partial, levelState } })), 'not_required');
  }
  assert.equal(getChatAssessmentStatus(context({ assessment: { completed: true } })), 'completed');
  assert.equal(getChatAssessmentStatus(context({ leadProfile: { ...partial, quizScore: 0 } })), 'completed');
});

test('explicit skip survives reload; voluntary retake overrides a previous result', () => {
  assert.equal(getChatAssessmentStatus(context({ chatAssessmentStatus: 'skipped' })), 'skipped');
  assert.equal(getChatAssessmentStatus(context({ assessment: { completed: true }, chatAssessmentStatus: 'pending' })), 'pending');
});

test('profile-only updates preserve assessment flow and language, and reset clears them', () => {
  const makeStorage = () => {
    const items = new Map<string, string>();
    return { getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
      removeItem: (key: string) => items.delete(key) };
  };
  const original = Object.getOwnPropertyDescriptors(globalThis);
  Object.assign(globalThis, { localStorage: makeStorage(), sessionStorage: makeStorage(), window: { dispatchEvent() {} } });
  try {
    saveStudentContext({ leadProfile: partial, chatAssessmentStatus: 'pending', preferredLanguage: 'zh' });
    assert.equal(getChatAssessmentStatus(getStudentContext()), 'pending');
    saveStudentContext({ chatAssessmentStatus: 'skipped' });
    saveStudentContext({ leadProfile: { ...partial, fullName: 'Updated' } });
    assert.equal(getChatAssessmentStatus(getStudentContext()), 'skipped');
    assert.equal(getStudentContext()?.preferredLanguage, 'zh');
    saveStudentContext({ chatAssessmentStatus: 'completed', assessment: { completed: true, score: 0 } });
    assert.equal(getChatAssessmentStatus(getStudentContext()), 'completed');
    clearStudentContext();
    assert.equal(getStudentContext(), null);
  } finally {
    for (const key of ['window', 'localStorage', 'sessionStorage']) {
      if (original[key]) Object.defineProperty(globalThis, key, original[key]);
      else delete (globalThis as any)[key];
    }
  }
});
