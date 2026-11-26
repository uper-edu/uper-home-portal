export const enrollmentCancellationReasons = [
  'schedule_conflict',
  'budget',
  'different_class',
  'payment_difficulty',
  'plans_changed',
] as const;

export const enrollmentWithdrawalReasons = ['schedule_conflict','budget','different_class','plans_changed','already_arranged'] as const;
export type EnrollmentCancellationReason = typeof enrollmentCancellationReasons[number] | typeof enrollmentWithdrawalReasons[number];
export const enrollmentCancellationNoteLimit = 300;

export function parseEnrollmentCancellation(
  body: unknown,
  allowed: readonly EnrollmentCancellationReason[] = enrollmentCancellationReasons,
) {
  if (!body || typeof body !== 'object') return null;
  const { reasons = [], note = '' } = body as Record<string, unknown>;
  if (!Array.isArray(reasons) || reasons.length > allowed.length ||
      typeof note !== 'string' || note.length > enrollmentCancellationNoteLimit) return null;

  const selected = allowed.filter(reason => reasons.includes(reason));
  if (selected.length !== reasons.length) return null;
  const trimmedNote = note.trim();
  if (!selected.length && !trimmedNote) return null;
  return { reasons: selected, ...(trimmedNote ? { note: trimmedNote } : {}) };
}

export type EnrollmentCancellationFeedback = NonNullable<ReturnType<typeof parseEnrollmentCancellation>>;
