import fs from 'fs';
import path from 'path';
import type { CrmPolicyConfig } from '../src/types/crmPolicyConfig.ts';
import { DEFAULT_CRM_POLICY_CONFIG, resolveDuration } from '../src/types/crmPolicyConfig.ts';

const DB_DIR = path.join(process.cwd(), 'data');
const POLICY_FILE = path.join(DB_DIR, 'sla_policy_config.json');

// Ensure database directory and file exist
function ensurePolicyFile(): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(POLICY_FILE)) {
    fs.writeFileSync(POLICY_FILE, JSON.stringify(DEFAULT_CRM_POLICY_CONFIG, null, 2), 'utf-8');
  }
}

let policyCache: CrmPolicyConfig | null = null;

function normalizeConfig(parsed: any): CrmPolicyConfig {
  return {
    version: '2.0',
    updatedAt: parsed.updatedAt || new Date().toISOString(),
    businessHours: {
      timezone: parsed.businessHours?.timezone || DEFAULT_CRM_POLICY_CONFIG.businessHours.timezone,
      startTime: parsed.businessHours?.startTime || DEFAULT_CRM_POLICY_CONFIG.businessHours.startTime,
      endTime: parsed.businessHours?.endTime || DEFAULT_CRM_POLICY_CONFIG.businessHours.endTime,
      workDays: Array.isArray(parsed.businessHours?.workDays) ? parsed.businessHours.workDays : DEFAULT_CRM_POLICY_CONFIG.businessHours.workDays,
      nextDayGraceTime: parsed.businessHours?.nextDayGraceTime || DEFAULT_CRM_POLICY_CONFIG.businessHours.nextDayGraceTime
    },
    firstResponseSla: {
      hot: resolveDuration(parsed.firstResponseSla?.hot ?? parsed.firstResponseSla?.hotMinutes, 3, 'hours'),
      warm: resolveDuration(parsed.firstResponseSla?.warm ?? parsed.firstResponseSla?.warmHours, 24, 'hours'),
      cold: resolveDuration(parsed.firstResponseSla?.cold ?? parsed.firstResponseSla?.coldHours, 48, 'hours')
    },
    noResponseCadence: {
      retryInterval: resolveDuration(parsed.noResponseCadence?.retryInterval ?? parsed.noResponseCadence?.retryIntervalHours, 4, 'hours'),
      maxRetriesBeforeNurture: typeof parsed.noResponseCadence?.maxRetriesBeforeNurture === 'number'
        ? parsed.noResponseCadence.maxRetriesBeforeNurture
        : 3
    },
    inactivityWatchdog: {
      hotInactivity: resolveDuration(parsed.inactivityWatchdog?.hotInactivity ?? parsed.inactivityWatchdog?.hotInactivityHours, 24, 'hours'),
      warmInactivity: resolveDuration(parsed.inactivityWatchdog?.warmInactivity ?? parsed.inactivityWatchdog?.warmInactivityHours, 48, 'hours'),
      coldInactivity: resolveDuration(parsed.inactivityWatchdog?.coldInactivity ?? parsed.inactivityWatchdog?.coldInactivityDays, 7, 'days')
    },
    milestones: {
      trialReminderBefore: resolveDuration(parsed.milestones?.trialReminderBefore ?? parsed.milestones?.trialReminderHoursBefore, 4, 'hours'),
      trialFollowUpAfter: resolveDuration(parsed.milestones?.trialFollowUpAfter ?? parsed.milestones?.trialFollowUpHoursAfter, 4, 'hours'),
      assessmentFollowUpAfter: resolveDuration(parsed.milestones?.assessmentFollowUpAfter ?? parsed.milestones?.assessmentFollowUpHoursAfter, 2, 'hours')
    },
    reactivation: {
      reactivatedResponse: resolveDuration(parsed.reactivation?.reactivatedResponse ?? parsed.reactivation?.reactivatedResponseMinutes, 30, 'minutes')
    }
  };
}

export function getPolicyConfig(): CrmPolicyConfig {
  if (policyCache !== null) {
    return policyCache;
  }

  ensurePolicyFile();
  try {
    const raw = fs.readFileSync(POLICY_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    policyCache = normalizeConfig(parsed);
    return policyCache;
  } catch (err) {
    console.error('[POLICY STORAGE] Failed to read config, falling back to defaults:', err);
    policyCache = { ...DEFAULT_CRM_POLICY_CONFIG };
    return policyCache;
  }
}

export function savePolicyConfig(newConfig: Partial<CrmPolicyConfig>): CrmPolicyConfig {
  ensurePolicyFile();
  const current = getPolicyConfig();
  const mergedRaw = {
    ...current,
    ...newConfig,
    updatedAt: new Date().toISOString(),
    businessHours: { ...current.businessHours, ...(newConfig.businessHours || {}) },
    firstResponseSla: { ...current.firstResponseSla, ...(newConfig.firstResponseSla || {}) },
    noResponseCadence: { ...current.noResponseCadence, ...(newConfig.noResponseCadence || {}) },
    inactivityWatchdog: { ...current.inactivityWatchdog, ...(newConfig.inactivityWatchdog || {}) },
    milestones: { ...current.milestones, ...(newConfig.milestones || {}) },
    reactivation: { ...current.reactivation, ...(newConfig.reactivation || {}) }
  };

  policyCache = normalizeConfig(mergedRaw);
  fs.writeFileSync(POLICY_FILE, JSON.stringify(policyCache, null, 2), 'utf-8');
  console.log('[POLICY STORAGE] Saved updated SLA & Cadence policy config with duration units.');
  return policyCache;
}

export function resetPolicyConfig(): CrmPolicyConfig {
  ensurePolicyFile();
  policyCache = {
    ...DEFAULT_CRM_POLICY_CONFIG,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(POLICY_FILE, JSON.stringify(policyCache, null, 2), 'utf-8');
  console.log('[POLICY STORAGE] Reset SLA & Cadence policy config to new v2 defaults.');
  return policyCache;
}
