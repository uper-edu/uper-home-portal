import {visitorKey, visitorScope} from './visitorScope';
import type { HskResult } from '../data/hskAssessment';
import type { LeadProfile } from '../types/leadSystem';

export interface UnifiedAssessmentData {
  completed: boolean;
  result?: HskResult;
  maxScore?: number;
  questionCount?: number;
  saveStatus?: "local" | "saved" | "legacy_unverified";
  score?: number;
  total?: number;
  levelConfirmed?: string;
  summary?: string;
  breakdown?: {
    hsk1Correct?: number;
    hsk1Total?: number;
    hsk2Correct?: number;
    hsk2Total?: number;
    hsk3Correct?: number;
    hsk3Total?: number;
  };
  completedAt?: string;
}

export interface UnifiedStudentContext {
  leadProfile?: LeadProfile | null;
  assessment?: UnifiedAssessmentData | null;
  chatAssessmentStatus?: 'pending' | 'paused' | 'skipped' | 'completed' | 'not_required';
  preferredLanguage?: 'en' | 'id' | 'zh';
  lastUpdated: string;
}

// Migrate existing profiles without requiring another questionnaire submission.
export function getChatAssessmentStatus(context: UnifiedStudentContext | null): NonNullable<UnifiedStudentContext['chatAssessmentStatus']> {
  if (!context?.leadProfile) return 'not_required';
  if (context.chatAssessmentStatus) return context.chatAssessmentStatus;
  if (context.assessment?.completed || typeof context.leadProfile.quizScore === 'number') return 'completed';
  return context.leadProfile.levelState === 'PARTIAL' ? 'pending' : 'not_required';
}

const STORAGE_KEY = 'uper_unified_student_context';
const UPDATE_EVENT = 'uper_student_context_updated';

/**
 * Retrieve the currently unified student profile and diagnostic assessment context.
 * Reads only the current verified visitor; unscoped legacy records remain untouched.
 */
export function getStudentContext(): UnifiedStudentContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(visitorKey(STORAGE_KEY));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if(parsed.assessment?.completed && !parsed.assessment.result) parsed.assessment.saveStatus="legacy_unverified";
        return parsed as UnifiedStudentContext;
      }
    }

    // Unscoped legacy records remain stored, but cannot establish ownership.

  } catch (err) {
    // Unverified identity and inaccessible storage both fail closed.
  }

  return null;
}

/**
 * Persist or patch the unified student context across all UPER chat surfaces and tabs.
 */
export function saveStudentContext(patch: Partial<UnifiedStudentContext>): UnifiedStudentContext {
  if (typeof window === 'undefined') {
    return {
      lastUpdated: new Date().toISOString(),
      ...patch
    };
  }

  try {
    const current = getStudentContext() || {
      leadProfile: null,
      assessment: null,
      lastUpdated: new Date().toISOString()
    };

    const updated: UnifiedStudentContext = {
      leadProfile: patch.leadProfile !== undefined ? patch.leadProfile : current.leadProfile,
      assessment: patch.assessment !== undefined ? patch.assessment : current.assessment,
      chatAssessmentStatus: patch.chatAssessmentStatus ?? current.chatAssessmentStatus,
      preferredLanguage: patch.preferredLanguage ?? current.preferredLanguage,
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(visitorKey(STORAGE_KEY), JSON.stringify(updated));

    // Dispatch custom event for real-time in-app synchronization
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: updated }));

    return updated;
  } catch (err) {
    console.error('[StudentProfileStorage] Failed to save student context:', err);
    return {
      lastUpdated: new Date().toISOString(),
      ...patch
    };
  }
}

/**
 * Clear the unified student context (e.g. during reset).
 */
export function clearStudentContext(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(visitorKey(STORAGE_KEY));



    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: null }));
  } catch (err) {
    console.warn('[StudentProfileStorage] Failed to clear student context:', err);
  }
}

/**
 * Subscribe to student context updates in real-time across components and window tabs.
 */
export function subscribeStudentContext(callback: (context: UnifiedStudentContext | null) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (event: Event) => {
    const customEvt = event as CustomEvent<UnifiedStudentContext | null>;
    callback(customEvt.detail !== undefined ? customEvt.detail : getStudentContext());
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (visitorScope() && event.key === visitorKey(STORAGE_KEY)) {
      callback(getStudentContext());
    }
  };

  window.addEventListener(UPDATE_EVENT, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener(UPDATE_EVENT, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}
