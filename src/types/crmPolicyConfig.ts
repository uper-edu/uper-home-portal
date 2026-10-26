export type TimeUnit = 'minutes' | 'hours' | 'days';

export interface TimeDuration {
  value: number;
  unit: TimeUnit;
}

export function durationToMs(duration: TimeDuration): number {
  if (!duration || typeof duration.value !== 'number') return 0;
  switch (duration.unit) {
    case 'minutes':
      return duration.value * 60 * 1000;
    case 'hours':
      return duration.value * 60 * 60 * 1000;
    case 'days':
      return duration.value * 24 * 60 * 60 * 1000;
    default:
      return duration.value * 60 * 60 * 1000;
  }
}

export function resolveDuration(raw: any, defaultValue: number, defaultUnit: TimeUnit): TimeDuration {
  if (raw && typeof raw === 'object' && typeof raw.value === 'number') {
    return {
      value: raw.value,
      unit: raw.unit === 'minutes' || raw.unit === 'hours' || raw.unit === 'days' ? raw.unit : defaultUnit
    };
  }
  if (typeof raw === 'number') {
    return { value: raw, unit: defaultUnit };
  }
  return { value: defaultValue, unit: defaultUnit };
}

export interface BusinessHoursPolicy {
  timezone: string; // e.g. 'Asia/Jakarta'
  startTime: string; // e.g. '09:00'
  endTime: string; // e.g. '20:00'
  workDays: number[]; // 0: Sun, 1: Mon, ... 6: Sat. e.g. [1, 2, 3, 4, 5, 6]
  nextDayGraceTime: string; // e.g. '10:00' for off-hours submitted leads
}

export interface FirstResponseSlaPolicy {
  hot: TimeDuration; // default: 3 hours
  warm: TimeDuration; // default: 24 hours
  cold: TimeDuration; // default: 48 hours
}

export interface NoResponseCadencePolicy {
  retryInterval: TimeDuration; // default: 4 hours
  maxRetriesBeforeNurture: number; // default: 3 attempts
}

export interface InactivityWatchdogPolicy {
  hotInactivity: TimeDuration; // default: 24 hours
  warmInactivity: TimeDuration; // default: 48 hours
  coldInactivity: TimeDuration; // default: 7 days
}

export interface MilestoneCadencePolicy {
  trialReminderBefore: TimeDuration; // default: 4 hours
  trialFollowUpAfter: TimeDuration; // default: 4 hours
  assessmentFollowUpAfter: TimeDuration; // default: 2 hours
}

export interface ReactivationPolicy {
  reactivatedResponse: TimeDuration; // default: 30 minutes
}

export interface CrmPolicyConfig {
  identityReviewManagerOnly: boolean;
  ownerAssignmentManagerOnly: boolean;
  sourceAttributionManagerOnly: boolean;
  version: string;
  updatedAt: string;
  businessHours: BusinessHoursPolicy;
  firstResponseSla: FirstResponseSlaPolicy;
  noResponseCadence: NoResponseCadencePolicy;
  inactivityWatchdog: InactivityWatchdogPolicy;
  milestones: MilestoneCadencePolicy;
  reactivation: ReactivationPolicy;
}

export const DEFAULT_CRM_POLICY_CONFIG: CrmPolicyConfig = {
  identityReviewManagerOnly: true,
  ownerAssignmentManagerOnly: false,
  sourceAttributionManagerOnly: true,
  version: '2.0',
  updatedAt: new Date().toISOString(),
  businessHours: {
    timezone: 'Asia/Jakarta',
    startTime: '09:00',
    endTime: '20:00',
    workDays: [1, 2, 3, 4, 5, 6], // Monday through Saturday
    nextDayGraceTime: '10:00'
  },
  firstResponseSla: {
    hot: { value: 3, unit: 'hours' },
    warm: { value: 24, unit: 'hours' },
    cold: { value: 48, unit: 'hours' }
  },
  noResponseCadence: {
    retryInterval: { value: 4, unit: 'hours' },
    maxRetriesBeforeNurture: 3
  },
  inactivityWatchdog: {
    hotInactivity: { value: 24, unit: 'hours' },
    warmInactivity: { value: 48, unit: 'hours' },
    coldInactivity: { value: 7, unit: 'days' }
  },
  milestones: {
    trialReminderBefore: { value: 4, unit: 'hours' },
    trialFollowUpAfter: { value: 4, unit: 'hours' },
    assessmentFollowUpAfter: { value: 2, unit: 'hours' }
  },
  reactivation: {
    reactivatedResponse: { value: 30, unit: 'minutes' }
  }
};
