export const enrollmentRuleDefaults = {
  paymentHours:24,
  replyHours:48,
  firstReviewBusinessDays:1,
  refundBusinessDays:3,
  emailCodeMinutes:10,
  emailResendSeconds:60,
  emailAttemptLimit:5,
  emailLockMinutes:10,
  emailSessionHours:7*24,
};

export type EnrollmentRuleField = keyof typeof enrollmentRuleDefaults;
export type EnrollmentRules = typeof enrollmentRuleDefaults & {revision:number};
export const enrollmentRuleFields = Object.keys(enrollmentRuleDefaults) as EnrollmentRuleField[];
export const enrollmentBusinessDayLimit=30;

export const enrollmentEmailRuleLimits = {
  emailCodeMinutes:60,
  emailResendSeconds:3600,
  emailAttemptLimit:10,
  emailLockMinutes:1440,
  emailSessionHours:168,
};
export const enrollmentEmailRuleFields = Object.keys(enrollmentEmailRuleLimits) as (keyof typeof enrollmentEmailRuleLimits)[];
