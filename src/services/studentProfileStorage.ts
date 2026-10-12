import type { LeadProfile } from '../types/leadSystem';

export interface UnifiedAssessmentData {
  completed: boolean;
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
  chatAssessmentStatus?: 'pending' | 'skipped' | 'completed' | 'not_required';
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
 * Provides backwards-compatibility fallbacks to existing session/local storage keys.
 */
export function getStudentContext(): UnifiedStudentContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as UnifiedStudentContext;
      }
    }

    // Fallback: Check if lead profile exists under legacy keys
    let legacyLead: LeadProfile | null = null;
    const legacyLeadRaw = localStorage.getItem('uper_lead_profile') || sessionStorage.getItem('uper_pending_lead');
    if (legacyLeadRaw) {
      try {
        legacyLead = JSON.parse(legacyLeadRaw);
      } catch (_) {}
    }

    if (legacyLead) {
      const fallbackContext: UnifiedStudentContext = {
        leadProfile: legacyLead,
        assessment: legacyLead.quizScore !== undefined ? {
          completed: true,
          score: legacyLead.quizScore,
          total: legacyLead.totalQuestions || 15,
          levelConfirmed: legacyLead.levelConfirmed,
          summary: legacyLead.quizResultSummary,
          breakdown: legacyLead.quizBreakdown,
          completedAt: legacyLead.submittedAt || new Date().toISOString()
        } : null,
        lastUpdated: new Date().toISOString()
      };
      // Persist into unified storage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackContext));
      return fallbackContext;
    }
  } catch (err) {
    console.warn('[StudentProfileStorage] Failed to read student context:', err);
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

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Also update legacy keys for maximum backwards compatibility
    if (updated.leadProfile) {
      try {
        localStorage.setItem('uper_lead_profile', JSON.stringify(updated.leadProfile));
        sessionStorage.setItem('uper_lead_submitted', 'true');
      } catch (_) {}
    }

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
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('uper_lead_profile');
    sessionStorage.removeItem('uper_lead_submitted');
    sessionStorage.removeItem('uper_pending_lead');
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
    if (event.key === STORAGE_KEY || event.key === 'uper_lead_profile') {
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
