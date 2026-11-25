export const enrollmentCancellationReasons = [
  'schedule_conflict',
  'budget',
  'different_class',
  'payment_difficulty',
  'plans_changed',
] as const;

export type EnrollmentCancellationReason = typeof enrollmentCancellationReasons[number];
export const enrollmentCancellationNoteLimit = 300;

export function parseEnrollmentCancellation(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const { reasons = [], note = '' } = body as Record<string, unknown>;
  if (!Array.isArray(reasons) || reasons.length > enrollmentCancellationReasons.length ||
      typeof note !== 'string' || note.length > enrollmentCancellationNoteLimit) return null;

  const selected = enrollmentCancellationReasons.filter(reason => reasons.includes(reason));
  if (selected.length !== reasons.length) return null;
  const trimmedNote = note.trim();
  if (!selected.length && !trimmedNote) return null;
  return { reasons: selected, ...(trimmedNote ? { note: trimmedNote } : {}) };
}
