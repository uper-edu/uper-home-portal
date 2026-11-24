export const enrollmentMailModes = ['disabled','simulation','smtp'] as const;
export type EnrollmentMailMode = typeof enrollmentMailModes[number];
export const isEnrollmentMailMode = (value:unknown):value is EnrollmentMailMode =>
  enrollmentMailModes.some(mode=>mode===value);

export type EnrollmentMailDelivery = {mode:EnrollmentMailMode; generation:string};

export function matchesEnrollmentMailDelivery(value:unknown, delivery:EnrollmentMailDelivery) {
  if(!value || typeof value!=='object' || !delivery.generation) return false;
  const saved=value as Partial<EnrollmentMailDelivery>;
  return saved.mode===delivery.mode && saved.generation===delivery.generation;
}
