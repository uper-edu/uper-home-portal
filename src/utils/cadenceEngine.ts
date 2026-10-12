import type { CrmLeadRecord } from '../types/crmLead.ts';
import type { CrmPolicyConfig } from '../types/crmPolicyConfig.ts';
import { DEFAULT_CRM_POLICY_CONFIG, durationToMs } from '../types/crmPolicyConfig.ts';

export interface CadenceResult {
  badgeText: string;
  badgeColor: string;
  statusType: 'first_response' | 'scheduled' | 'retry_due' | 'active' | 'stale_alert' | 'invalid' | 'closed' | 'off_hours';
  isOverdue: boolean;
  suggestedAction: string;
}

/**
 * Checks if a given timestamp is within configured business hours in specified timezone
 */
export function isWithinBusinessHours(
  date: Date,
  config: CrmPolicyConfig = DEFAULT_CRM_POLICY_CONFIG
): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: config.businessHours.timezone || 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(date);
    const hourPart = parts.find(p => p.type === 'hour')?.value || '00';
    const minutePart = parts.find(p => p.type === 'minute')?.value || '00';
    const currentClock = `${hourPart.padStart(2, '0')}:${minutePart.padStart(2, '0')}`;

    // Get Day of week in target timezone (0 = Sunday, 1 = Monday... 6 = Saturday)
    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: config.businessHours.timezone || 'Asia/Jakarta',
      weekday: 'short'
    });
    const weekdayStr = dayFormatter.format(date);
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dayNum = dayMap[weekdayStr] ?? 1;

    // Check if day is working day
    if (!config.businessHours.workDays.includes(dayNum)) {
      return false;
    }

    // Check clock time range (e.g. 09:00 - 20:00)
    return currentClock >= config.businessHours.startTime && currentClock <= config.businessHours.endTime;
  } catch (e) {
    return true; // fallback
  }
}

/**
 * Comprehensive Dynamic Cadence & SLA Engine driven by flexible duration units
 */
export function evaluateLeadCadence(
  lead: CrmLeadRecord,
  config: CrmPolicyConfig = DEFAULT_CRM_POLICY_CONFIG,
  lang: 'en' | 'zh' = 'zh',
  nowMs: number = Date.now()
): CadenceResult {
  const t = (en: string, zh: string) => (lang === 'zh' ? zh : en);

  // 1. Closed or Archived
  if (lead.currentStage === 'Enrolled' || lead.currentStage === 'Lost' || lead.tier === 'Cold-Nurture') {
    if (lead.currentStage === 'Enrolled') {
      return {
        badgeText: t('Enrolled', '已报名'),
        badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-300 font-bold',
        statusType: 'closed',
        isOverdue: false,
        suggestedAction: t('Enroll in LMS & ship books', '录入学员系统并寄送教材')
      };
    }
    return {
      badgeText: t('Archived', '已归档/培育'),
      badgeColor: 'text-slate-500 bg-slate-100 border-slate-200',
      statusType: 'closed',
      isOverdue: false,
      suggestedAction: t('Keep in monthly newsletter list', '归入每月动态推送名单')
    };
  }

  // 2. Wrong Number / Invalid Phone
  if (lead.connectStatus === 'Wrong Number') {
    return {
      badgeText: t('Invalid Phone', '🚫 无效号码'),
      badgeColor: 'text-rose-600 bg-rose-50 border-rose-200 font-medium',
      statusType: 'invalid',
      isOverdue: false,
      suggestedAction: t('Verify email or search Instagram', '尝试通过邮件或社交账号核实')
    };
  }

  // 3. Max Unanswered Retries reached
  const touchCount = lead.touchCount || 0;
  if (lead.connectStatus === 'No Response' && touchCount >= config.noResponseCadence.maxRetriesBeforeNurture) {
    return {
      badgeText: t(`No reply (${touchCount} calls)`, `已呼${touchCount}次未通`),
      badgeColor: 'text-slate-600 bg-slate-100 border-slate-300 font-medium',
      statusType: 'stale_alert',
      isOverdue: false,
      suggestedAction: t('Stop calling; move to nurture broadcast', '暂停呼叫；转入被动内容培育')
    };
  }

  // 4. Initial First Response Phase (Touch = 0, not yet contacted)
  if (touchCount === 0 && (lead.currentStage === 'New' || !lead.lastContactedAt)) {
    const isNowWorking = isWithinBusinessHours(new Date(nowMs), config);

    // Calculate SLA window based on Tier & flexible durations
    let slaDurationMs = durationToMs(config.firstResponseSla.cold || { value: 48, unit: 'hours' });
    if (lead.tier === 'Hot') {
      slaDurationMs = durationToMs(config.firstResponseSla.hot || { value: 3, unit: 'hours' });
    } else if (lead.tier === 'Warm-Offline' || lead.tier === 'Warm-Online') {
      slaDurationMs = durationToMs(config.firstResponseSla.warm || { value: 24, unit: 'hours' });
    }

    const submittedMs = new Date(lead.submittedAt).getTime();
    const targetDueMs = submittedMs + slaDurationMs;
    const diffMs = targetDueMs - nowMs;

    if (!isNowWorking) {
      return {
        badgeText: t(`Off-hours (${config.businessHours.nextDayGraceTime} Due)`, `🌙 夜间 (次日${config.businessHours.nextDayGraceTime}待办)`),
        badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200 font-medium',
        statusType: 'off_hours',
        isOverdue: false,
        suggestedAction: t('Schedule WhatsApp greeting for 09:00 AM', '预约次日早晨 09:00 WhatsApp 破冰')
      };
    }

    if (diffMs < 0) {
      const hoursOver = Math.max(1, Math.abs(Math.round(diffMs / (1000 * 60 * 60))));
      return {
        badgeText: t(`FRT Overdue (${hoursOver}h)`, `🔴 首响超期 (${hoursOver}h)`),
        badgeColor: 'text-rose-700 bg-rose-50 border-rose-300 font-bold animate-pulse',
        statusType: 'first_response',
        isOverdue: true,
        suggestedAction: t('Urgent: Initiate WhatsApp break-in now', '紧急：立即发起 WhatsApp 破冰')
      };
    }

    const minutesLeft = Math.round(diffMs / (1000 * 60));
    if (minutesLeft < 60) {
      return {
        badgeText: t(`FRT ${minutesLeft}m`, `⚡ 首响 ${minutesLeft}m`),
        badgeColor: minutesLeft <= 30 
          ? 'text-amber-800 bg-amber-50 border-amber-300 font-bold' 
          : 'text-emerald-700 bg-emerald-50 border-emerald-300 font-semibold',
        statusType: 'first_response',
        isOverdue: false,
        suggestedAction: t('Send personalized WhatsApp greeting', '发送首条个性化 WhatsApp 问候')
      };
    }

    const hoursLeft = Math.round(diffMs / (1000 * 60 * 60));
    return {
      badgeText: t(`FRT ${hoursLeft}h`, `⚡ 首响 ${hoursLeft}h`),
      badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-300 font-semibold',
      statusType: 'first_response',
      isOverdue: false,
      suggestedAction: t('First contact via WhatsApp & qualify', 'WhatsApp 初步建联与意向核实')
    };
  }

  // 5. Unanswered Call Follow-up Cadence (touchCount > 0, status is No Response)
  if (lead.connectStatus === 'No Response' && touchCount < config.noResponseCadence.maxRetriesBeforeNurture) {
    const lastMs = new Date(lead.lastContactedAt || lead.updatedAt).getTime();
    const retryIntervalMs = durationToMs(config.noResponseCadence.retryInterval || { value: 4, unit: 'hours' });
    const retryDueMs = lastMs + retryIntervalMs;
    const diffMs = retryDueMs - nowMs;

    if (diffMs <= 0) {
      return {
        badgeText: t(`Retry Call (${touchCount + 1}nd)`, `📞 待重呼 (第${touchCount + 1}次)`),
        badgeColor: 'text-amber-800 bg-amber-50 border-amber-300 font-bold',
        statusType: 'retry_due',
        isOverdue: true,
        suggestedAction: t('Retry phone call or send WhatsApp follow-up', '二次致电或补发 WhatsApp 文字提醒')
      };
    }

    const hoursWait = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
    return {
      badgeText: t(`Cooling (${hoursWait}h)`, `⏳ 呼叫未通 (冷却${hoursWait}h)`),
      badgeColor: 'text-slate-600 bg-slate-100 border-slate-300',
      statusType: 'scheduled',
      isOverdue: false,
      suggestedAction: t('Wait for cooling interval before next call', '等待重试间隔后再行呼叫')
    };
  }

  // 6. Milestone & Scheduled Next Follow-up (When lead.nextFollowUpAt is explicitly set)
  if (lead.nextFollowUpAt) {
    const scheduledMs = new Date(lead.nextFollowUpAt).getTime();
    const diffMs = scheduledMs - nowMs;

    if (diffMs < 0) {
      const hoursOver = Math.max(1, Math.abs(Math.round(diffMs / (1000 * 60 * 60))));
      return {
        badgeText: t(`Overdue (${hoursOver}h)`, `🔴 待办超期 (${hoursOver}h)`),
        badgeColor: 'text-rose-700 bg-rose-50 border-rose-300 font-bold animate-pulse',
        statusType: 'scheduled',
        isOverdue: true,
        suggestedAction: lead.nextAction || t('Fulfill scheduled promise to client', '兑现对客户的预约承诺')
      };
    }

    // Due within 6 hours
    if (diffMs <= 6 * 60 * 60 * 1000) {
      const hoursLeft = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
      return {
        badgeText: t(`Due Today (${hoursLeft}h)`, `🟡 今日待办 (${hoursLeft}h)`),
        badgeColor: 'text-amber-800 bg-amber-50 border-amber-300 font-bold',
        statusType: 'scheduled',
        isOverdue: false,
        suggestedAction: lead.nextAction || t('Execute scheduled action today', '今日按时执行待办任务')
      };
    }

    // Future scheduled date
    const dateObj = new Date(lead.nextFollowUpAt);
    const dateStr = `${dateObj.getMonth() + 1}-${dateObj.getDate()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
    return {
      badgeText: `📅 ${dateStr}`,
      badgeColor: 'text-blue-700 bg-blue-50 border-blue-200 font-medium',
      statusType: 'scheduled',
      isOverdue: false,
      suggestedAction: lead.nextAction || t('Follow up at agreed appointment', '于预约时段准时回访')
    };
  }

  // 7. Active Lead Inactivity Watchdog (Contacted, but no specific date set)
  const lastContactMs = new Date(lead.lastContactedAt || lead.stageUpdatedAt || lead.updatedAt).getTime();
  const hoursInactive = Math.max(0, (nowMs - lastContactMs) / (1000 * 60 * 60));

  let maxAllowedInactivityMs = durationToMs(config.inactivityWatchdog.warmInactivity || { value: 48, unit: 'hours' });
  if (lead.tier === 'Hot') {
    maxAllowedInactivityMs = durationToMs(config.inactivityWatchdog.hotInactivity || { value: 24, unit: 'hours' });
  } else if (lead.tier === 'School') {
    maxAllowedInactivityMs = durationToMs(config.inactivityWatchdog.coldInactivity || { value: 7, unit: 'days' });
  }

  const maxAllowedHours = maxAllowedInactivityMs / (1000 * 60 * 60);

  if (hoursInactive >= maxAllowedHours) {
    const daysStale = Math.max(1, Math.round(hoursInactive / 24));
    return {
      badgeText: t(`Stale (${daysStale}d)`, `⚠️ 需跟进 (已停${daysStale}天)`),
      badgeColor: 'text-amber-800 bg-amber-50 border-amber-300 font-bold',
      statusType: 'stale_alert',
      isOverdue: true,
      suggestedAction: t('Reconnect: Check student progress or send syllabus', '重回联络：跟进学习进度或推送新班简章')
    };
  }

  // Healthy active follow-up within threshold
  return {
    badgeText: t('Active', '✓ 推进中'),
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-300 font-medium',
    statusType: 'active',
    isOverdue: false,
    suggestedAction: lead.nextAction || t('Follow up recent inquiries & interest', '跟进最新课程疑问')
  };
}
