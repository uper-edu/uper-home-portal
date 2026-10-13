import { crmId } from "../../utils/crmIndonesian";
import {
  sla as responseDeadline,
  calendarSample,
} from "../../utils/workCalendar";
import { crmLocale, crmValue } from "../../utils/crmLanguage";
import React, { useState, useEffect, useMemo } from "react";
import type {
  CrmPolicyConfig,
  TimeUnit,
  TimeDuration,
} from "../../types/crmPolicyConfig.ts";
import {
  DEFAULT_CRM_POLICY_CONFIG,
  durationToMs,
} from "../../types/crmPolicyConfig.ts";
import { isWithinBusinessHours } from "../../utils/cadenceEngine.ts";
import {
  Clock,
  Zap,
  PhoneCall,
  ShieldAlert,
  Target,
  Sparkles,
  Save,
  RotateCcw,
  CheckCircle2,
  Sun,
  Moon,
  Undo2,
  SlidersHorizontal,
  Layers,
  CalendarDays,
  Flame,
  ArrowRight,
  Info,
  Check,
  AlertTriangle,
  Play,
  BookOpen,
} from "lucide-react";
export interface PolicyActionControls {
  isDirty: boolean;
  modifiedCount: number;
  isSaving: boolean;
  isResetting: boolean;
  saveSuccess: boolean;
  save: () => Promise<void>;
  reset: () => Promise<void>;
  discard: () => void;
}
export interface CrmPolicySettingsProps {
  isLight: boolean;
  lang?: "en" | "zh" | "id";
  policyConfig: CrmPolicyConfig;
  onSavePolicy: (updated: CrmPolicyConfig) => Promise<boolean>;
  onResetPolicy: () => Promise<boolean>;
  onNavigateTab?: (tab: "leads" | "docs") => void;
  onNavigateNotifications?: () => void;
  onActionControlsChange?: (controls: PolicyActionControls | null) => void;
}
interface DurationFieldProps {
  isLight: boolean;
  lang: "en" | "zh" | "id";
  titleEn: string;
  titleZh: string;
  descEn: string;
  descZh: string;
  duration: TimeDuration;
  originalDuration?: TimeDuration;
  onChange: (newDuration: TimeDuration) => void;
  accentColor?: string;
  recommendedText?: string;
}
const isDurationEqual = (a?: TimeDuration, b?: TimeDuration) => {
  if (!a || !b) return true;
  return a.value === b.value && a.unit === b.unit;
};
const DurationField: React.FC<DurationFieldProps> = ({
  isLight,
  lang,
  titleEn,
  titleZh,
  descEn,
  descZh,
  duration,
  originalDuration,
  onChange,
  accentColor = "text-primary-600",
  recommendedText,
}) => {
  const isModified =
    originalDuration && !isDurationEqual(duration, originalDuration);
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        isModified
          ? isLight
            ? "bg-amber-50/50 border-amber-300 ring-1 ring-amber-200"
            : "bg-amber-950/20 border-amber-700/60 ring-1 ring-amber-800/40"
          : isLight
            ? "bg-slate-50/70 border-slate-200/80 hover:border-slate-300"
            : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="space-y-0.5">
          <label
            className={`font-semibold text-xs flex items-center gap-1.5 ${isLight ? "text-slate-900" : "text-slate-100"}`}
          >
            <span>{t(titleEn, titleZh)}</span>
            {isModified && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
                {t("Modified", "已修改")}
              </span>
            )}
          </label>
        </div>

        {/* Clean Numerical Indicator (Zero-Pill Discipline) */}
        <div className="text-right shrink-0">
          <span
            className={`text-xs font-mono font-bold tabular-nums ${accentColor}`}
          >
            {duration.value}{" "}
            {duration.unit === "minutes"
              ? t("min", "分钟")
              : duration.unit === "hours"
                ? t("hr", "小时")
                : t("days", "天")}
          </span>
          {recommendedText && (
            <div className="text-[10px] text-slate-400 dark:text-slate-500">
              {recommendedText}
            </div>
          )}
        </div>
      </div>

      <p
        className={`text-[11px] mb-3 leading-relaxed ${isLight ? "text-slate-500" : "text-slate-400"}`}
      >
        {t(descEn, descZh)}
      </p>

      <div className="flex items-center gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-800/60">
        <div className="relative">
          <input
            type="number"
            min="1"
            max="365"
            value={duration.value}
            onChange={(e) =>
              onChange({
                value: Math.max(1, parseInt(e.target.value) || 1),
                unit: duration.unit,
              })
            }
            className={`w-20 h-8 text-xs font-mono rounded-lg px-2.5 border outline-none font-semibold transition-all ${
              isLight
                ? "bg-white border-slate-300 text-slate-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-400"
                : "bg-slate-900 border-slate-700 text-slate-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-400"
            }`}
          />
        </div>

        <select
          value={duration.unit}
          onChange={(e) =>
            onChange({
              value: duration.value,
              unit: e.target.value as TimeUnit,
            })
          }
          className={`h-8 text-xs rounded-lg px-2.5 border outline-none font-medium cursor-pointer transition-all ${
            isLight
              ? "bg-white border-slate-300 text-slate-800 hover:border-slate-400"
              : "bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-600"
          }`}
        >
          <option value="minutes">{t("Minutes", "分钟")}</option>
          <option value="hours">{t("Hours", "小时")}</option>
          <option value="days">{t("Days", "天")}</option>
        </select>

        {isModified && (
          <button
            type="button"
            onClick={() => originalDuration && onChange(originalDuration)}
            title={t("Revert to saved value", "还原为已保存值")}
            className={`h-8 px-2 rounded-lg text-[11px] flex items-center gap-1 border transition-colors cursor-pointer ${isLight ? "text-slate-600 hover:bg-slate-100 border-slate-200" : "text-slate-400 hover:bg-slate-800 border-slate-700"}`}
          >
            <Undo2 className="w-3 h-3" />
            <span className="hidden sm:inline">{t("Revert", "还原")}</span>
          </button>
        )}
      </div>
    </div>
  );
};
export const CrmPolicySettings: React.FC<CrmPolicySettingsProps> = ({
  isLight,
  lang = "zh",
  policyConfig,
  onSavePolicy,
  onResetPolicy,
  onNavigateTab,
  onActionControlsChange,
  onNavigateNotifications,
}) => {
  const [formData, setFormData] = useState<CrmPolicyConfig>(policyConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  const [currentMinutesInDay, setCurrentMinutesInDay] = useState(0);
  const [isCurrentlyWorking, setIsCurrentlyWorking] = useState(true);
  // Active section filter or layout mode
  const [activeCategory, setActiveCategory] = useState<
    | "all"
    | "schedule"
    | "first_response"
    | "retry"
    | "watchdog"
    | "milestone"
    | "reactivation"
    | "notifications"
  >("all");
  const [showCascadeDiagram, setShowCascadeDiagram] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  // SLA Simulator states
  const [simTier, setSimTier] = useState<
    "hot" | "warm" | "cold" | "reactivated"
  >("hot");
  const [simPresetTime, setSimPresetTime] = useState<
    "now" | "fri_night" | "sat_night" | "sun_afternoon" | "mon_morning"
  >("fri_night");
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  useEffect(() => {
    setFormData(policyConfig);
  }, [policyConfig]);
  // Live clock in target timezone
  useEffect(() => {
    const updateLiveClock = () => {
      const now = new Date();
      try {
        const timeStr = new Intl.DateTimeFormat(crmLocale(lang), {
          timeZone: formData.businessHours.timezone || "Asia/Jakarta",
          year: "numeric",
          month: "short",
          day: "numeric",
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(now);
        setCurrentTimeStr(`${timeStr} (${formData.businessHours.timezone})`);
        setIsCurrentlyWorking(isWithinBusinessHours(now, formData));
        // Calculate minutes of day in target timezone (0..1440)
        const parts = new Intl.DateTimeFormat(crmLocale(lang), {
          timeZone: formData.businessHours.timezone || "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).formatToParts(now);
        const h = parseInt(
          parts.find((p) => p.type === "hour")?.value || "0",
          10,
        );
        const m = parseInt(
          parts.find((p) => p.type === "minute")?.value || "0",
          10,
        );
        setCurrentMinutesInDay(h * 60 + m);
      } catch (e) {
        setCurrentTimeStr(now.toLocaleTimeString(crmLocale(lang)));
      }
    };
    updateLiveClock();
    const interval = setInterval(updateLiveClock, 1000);
    return () => clearInterval(interval);
  }, [formData.businessHours, lang]);
  // Dirty State Calculation: Compare formData with policyConfig
  const modifiedFieldsCount = useMemo(() => {
    let count = 0;
    const orig = policyConfig;
    const curr = formData;
    if (curr.businessHours.timezone !== orig.businessHours.timezone) count++;
    if (curr.businessHours.startTime !== orig.businessHours.startTime) count++;
    if (curr.businessHours.endTime !== orig.businessHours.endTime) count++;
    if (
      JSON.stringify(curr.businessHours.workDays.slice().sort()) !==
      JSON.stringify(orig.businessHours.workDays.slice().sort())
    )
      count++;
    if (!isDurationEqual(curr.firstResponseSla.hot, orig.firstResponseSla.hot))
      count++;
    if (
      !isDurationEqual(curr.firstResponseSla.warm, orig.firstResponseSla.warm)
    )
      count++;
    if (
      !isDurationEqual(curr.firstResponseSla.cold, orig.firstResponseSla.cold)
    )
      count++;
    if (
      !isDurationEqual(
        curr.noResponseCadence.retryInterval,
        orig.noResponseCadence.retryInterval,
      )
    )
      count++;
    if (
      curr.noResponseCadence.maxRetriesBeforeNurture !==
      orig.noResponseCadence.maxRetriesBeforeNurture
    )
      count++;
    if (
      !isDurationEqual(
        curr.inactivityWatchdog.hotInactivity,
        orig.inactivityWatchdog.hotInactivity,
      )
    )
      count++;
    if (
      !isDurationEqual(
        curr.inactivityWatchdog.warmInactivity,
        orig.inactivityWatchdog.warmInactivity,
      )
    )
      count++;
    if (
      !isDurationEqual(
        curr.inactivityWatchdog.coldInactivity,
        orig.inactivityWatchdog.coldInactivity,
      )
    )
      count++;
    if (
      !isDurationEqual(
        curr.milestones.trialReminderBefore,
        orig.milestones.trialReminderBefore,
      )
    )
      count++;
    if (
      !isDurationEqual(
        curr.milestones.trialFollowUpAfter,
        orig.milestones.trialFollowUpAfter,
      )
    )
      count++;
    if (
      !isDurationEqual(
        curr.milestones.assessmentFollowUpAfter,
        orig.milestones.assessmentFollowUpAfter,
      )
    )
      count++;
    if (
      !isDurationEqual(
        curr.reactivation.reactivatedResponse,
        orig.reactivation.reactivatedResponse,
      )
    )
      count++;
    return count;
  }, [formData, policyConfig]);
  // Business hours ribbon math (00:00 to 24:00)
  const businessBarInfo = useMemo(() => {
    const parseClock = (clock: string) => {
      const [h, m] = clock.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const startMins = parseClock(formData.businessHours.startTime || "09:00");
    const endMins = parseClock(formData.businessHours.endTime || "20:00");
    const totalDayMins = 24 * 60; // 1440
    const startPct = Math.max(
      0,
      Math.min(100, (startMins / totalDayMins) * 100),
    );
    const widthPct = Math.max(
      0,
      Math.min(100, ((endMins - startMins) / totalDayMins) * 100),
    );
    const nowPct = Math.max(
      0,
      Math.min(100, (currentMinutesInDay / totalDayMins) * 100),
    );
    const dailyHours = ((endMins - startMins) / 60).toFixed(1);
    const weeklyWorkDays = formData.businessHours.workDays.length;
    const weeklyHours = (((endMins - startMins) / 60) * weeklyWorkDays).toFixed(
      0,
    );
    return {
      startMins,
      endMins,
      startPct,
      widthPct,
      nowPct,
      dailyHours,
      weeklyWorkDays,
      weeklyHours,
    };
  }, [formData.businessHours, currentMinutesInDay]);
  // SLA Timeline Simulation Engine
  const simulationResult = useMemo(() => {
    const calendar = {
      timezone: formData.businessHours.timezone,
      days: formData.businessHours.workDays,
      start: formData.businessHours.startTime,
      end: formData.businessHours.endTime,
    };
    const presets: Record<string, [string, string]> = {
      fri_night: ["2026-10-09", "19:30"],
      sat_night: ["2026-10-10", "21:15"],
      sun_afternoon: ["2026-10-11", "14:00"],
      mon_morning: ["2026-10-12", "09:30"],
    };
    const preset = presets[simPresetTime];
    const sampleDate = preset
      ? calendarSample(preset[0], preset[1], calendar.timezone)
      : new Date();
    const format = (date: Date) =>
      new Intl.DateTimeFormat(crmLocale(lang), {
        timeZone: calendar.timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    const sampleLabel = format(sampleDate);
    // 2. Determine target SLA duration in minutes
    let targetDuration: TimeDuration = formData.firstResponseSla.hot;
    let tierTitle = t("Tier 1: Hot (High Intent)", "等级 1：高意向");
    if (simTier === "warm") {
      targetDuration = formData.firstResponseSla.warm;
      tierTitle = t("Tier 2: Warm (Standard Intent)", "等级 2：常规意向");
    } else if (simTier === "cold") {
      targetDuration = formData.firstResponseSla.cold;
      tierTitle = t(
        "Tier 3: Cold / School (Nurture/B2B)",
        "等级 3：低意向／院校合作",
      );
    } else if (simTier === "reactivated") {
      targetDuration = formData.reactivation.reactivatedResponse;
      tierTitle = t("Dormant Reactivation", "沉睡客户重新咨询响应");
    }
    let finalDeadline = "";
    try {
      finalDeadline = format(
        responseDeadline(
          sampleDate,
          durationToMs(targetDuration) / 3600000,
          calendar,
        ),
      );
    } catch {
      finalDeadline = t("Invalid work calendar", "工作日历无效");
    }
    const explanation = t(
      "Natural elapsed hours: start at the next opening if received outside working hours; move the deadline to the next opening if it falls outside working hours. The same calculation is used by the server. Existing task deadlines are retained.",
      "按自然时长计时：非工作时间收到的申请从下次上班开始计时；截止落在非工作时间则顺延到下次上班。与服务端使用同一计算函数，已有任务截止时间保持原值。",
    );
    return {
      sampleLabel,
      tierTitle,
      targetDuration,
      isLeadInWorkingHours: false,
      explanation,
      finalDeadline,
      graceNote: "",
    };
  }, [simTier, simPresetTime, formData, t]);
  // Apply Quick Policy Presets
  const applyPreset = (
    presetType: "standard" | "high_velocity" | "relaxed",
  ) => {
    if (presetType === "standard") {
      setFormData({
        ...DEFAULT_CRM_POLICY_CONFIG,
        updatedAt: new Date().toISOString(),
      });
    } else if (presetType === "high_velocity") {
      setFormData({
        ...formData,
        businessHours: {
          ...formData.businessHours,
          startTime: "08:30",
          endTime: "21:00",
          workDays: [0, 1, 2, 3, 4, 5, 6], // 7 days
        },
        firstResponseSla: {
          hot: { value: 1, unit: "hours" },
          warm: { value: 6, unit: "hours" },
          cold: { value: 24, unit: "hours" },
        },
        noResponseCadence: {
          retryInterval: { value: 2, unit: "hours" },
          maxRetriesBeforeNurture: 4,
        },
        inactivityWatchdog: {
          hotInactivity: { value: 12, unit: "hours" },
          warmInactivity: { value: 24, unit: "hours" },
          coldInactivity: { value: 5, unit: "days" },
        },
        reactivation: {
          reactivatedResponse: { value: 15, unit: "minutes" },
        },
      });
    } else if (presetType === "relaxed") {
      setFormData({
        ...formData,
        businessHours: {
          ...formData.businessHours,
          startTime: "09:30",
          endTime: "18:30",
          workDays: [1, 2, 3, 4, 5], // Mon-Fri
        },
        firstResponseSla: {
          hot: { value: 4, unit: "hours" },
          warm: { value: 36, unit: "hours" },
          cold: { value: 72, unit: "hours" },
        },
        noResponseCadence: {
          retryInterval: { value: 6, unit: "hours" },
          maxRetriesBeforeNurture: 3,
        },
        inactivityWatchdog: {
          hotInactivity: { value: 36, unit: "hours" },
          warmInactivity: { value: 72, unit: "hours" },
          coldInactivity: { value: 10, unit: "days" },
        },
        reactivation: {
          reactivatedResponse: { value: 1, unit: "hours" },
        },
      });
    }
  };
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const ok = await onSavePolicy(formData);
      if (ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } finally {
      setIsSaving(false);
    }
  };
  const handleReset = async () => {
    if (
      !window.confirm(
        t(
          "Reset all SLA & Cadence policies to standard recommended defaults?",
          "是否确认将所有时效与策略恢复为默认值？",
        ),
      )
    ) {
      return;
    }
    setIsResetting(true);
    try {
      const ok = await onResetPolicy();
      if (ok) {
        setFormData(DEFAULT_CRM_POLICY_CONFIG);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } finally {
      setIsResetting(false);
    }
  };
  // Synchronize controls with parent page content sensitive button area in top header
  useEffect(() => {
    if (onActionControlsChange) {
      onActionControlsChange({
        isDirty: modifiedFieldsCount > 0,
        modifiedCount: modifiedFieldsCount,
        isSaving,
        isResetting,
        saveSuccess,
        save: async () => {
          setIsSaving(true);
          setSaveSuccess(false);
          try {
            const ok = await onSavePolicy(formData);
            if (ok) {
              setSaveSuccess(true);
              setTimeout(() => setSaveSuccess(false), 4000);
            }
          } finally {
            setIsSaving(false);
          }
        },
        reset: handleReset,
        discard: () => {
          setFormData(policyConfig);
        },
      });
    }
    return () => {
      if (onActionControlsChange) {
        onActionControlsChange(null);
      }
    };
  }, [
    formData,
    policyConfig,
    isSaving,
    isResetting,
    saveSuccess,
    modifiedFieldsCount,
    onSavePolicy,
    onResetPolicy,
    onActionControlsChange,
  ]);
  const toggleWorkDay = (day: number) => {
    const current = formData.businessHours.workDays || [];
    if (current.includes(day)) {
      if (current.length <= 1) return;
      setFormData({
        ...formData,
        businessHours: {
          ...formData.businessHours,
          workDays: current.filter((d) => d !== day),
        },
      });
    } else {
      setFormData({
        ...formData,
        businessHours: {
          ...formData.businessHours,
          workDays: [...current, day].sort(),
        },
      });
    }
  };
  const weekDayLabels = [
    { num: 1, en: "Mon", zh: "周一" },
    { num: 2, en: "Tue", zh: "周二" },
    { num: 3, en: "Wed", zh: "周三" },
    { num: 4, en: "Thu", zh: "周四" },
    { num: 5, en: "Fri", zh: "周五" },
    { num: 6, en: "Sat", zh: "周六" },
    { num: 0, en: "Sun", zh: "周日" },
  ];
  return (
    <form onSubmit={handleSave} className="space-y-6 w-full mx-auto">
      {/* 1. Header & Live Status Banner */}
      <div
        className={`p-5 rounded-2xl border transition-all ${isLight ? "bg-white border-slate-200/90 shadow-xs" : "bg-slate-900 border-slate-800 shadow-md"}`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400">
                <Clock className="w-5 h-5" />
              </span>
              <div>
                <h2
                  className={`font-bold text-base md:text-lg ${isLight ? "text-slate-900" : "text-white"}`}
                >
                  {t("Sales Operations Settings", "销售运营设置")}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {t(
                      "Configure working hours, response deadlines, follow-up rules and notifications.",
                      "配置工作时间、响应时限、跟进规则与通知。",
                    )}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[11px]">
                    {formData.businessHours.timezone}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>v{formData.version}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Presets & Status */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Policy Presets */}
            <div
              className={`p-1 rounded-xl border flex items-center gap-1 ${isLight ? "bg-slate-100/80 border-slate-200" : "bg-slate-800/80 border-slate-700"}`}
            >
              <span className="text-[11px] px-2 font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
                {t("Presets:", "预设模板:")}
              </span>
              <button
                type="button"
                onClick={() => applyPreset("standard")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${isLight ? "hover:bg-white text-slate-700" : "hover:bg-slate-700 text-slate-200"}`}
                title={t(
                  "Standard Recommended Policy (Hot 3h, Warm 24h, Mon-Sat)",
                  "标准预设模式",
                )}
              >
                {t("Standard", "标准稳健")}
              </button>
              <button
                type="button"
                onClick={() => applyPreset("high_velocity")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${isLight ? "hover:bg-white text-rose-700" : "hover:bg-slate-700 text-rose-300"}`}
                title={t(
                  "High Velocity Campaign Mode (Hot 1h, 7 days open, 08:30-21:00)",
                  "大促敏捷抢单模式",
                )}
              >
                ⚡ {t("Sprint", "冲刺抢单")}
              </button>
              <button
                type="button"
                onClick={() => applyPreset("relaxed")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${isLight ? "hover:bg-white text-indigo-700" : "hover:bg-slate-700 text-indigo-300"}`}
                title={t(
                  "Relaxed / Holiday Nurture Mode (Mon-Fri, Extended SLA)",
                  "节假日宽松护航模式",
                )}
              >
                🌿 {t("Relaxed", "节假宽松")}
              </button>
            </div>

            {/* Current Operational Status Indicator */}
            <div
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                isCurrentlyWorking
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  : "bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-300"
              }`}
            >
              {isCurrentlyWorking ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-semibold font-sans">
                    {t("Active Calling Window", "营业外呼时段")}
                  </span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="font-semibold font-sans">
                    {t("Night Quiet Period", "夜间免打扰时段")}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 24-Hour Visual Business Hours Ribbon */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span
              className={`font-semibold ${isLight ? "text-slate-700" : "text-slate-300"}`}
            >
              {t(
                "24-hour work calendar",
                "24 小时工作日历",
              )}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {businessBarInfo.dailyHours} {t("hrs/day", "小时/天")} ·{" "}
              {businessBarInfo.weeklyWorkDays} {t("days/week", "天/周")} (
              {businessBarInfo.weeklyHours} {t("h", "小时")}{" "}
              {t("total", "工时")})
            </span>
          </div>

          {/* Interactive Timeline Bar */}
          <div className="relative h-6 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700 flex">
            {/* Shaded Off-hours Left */}
            <div
              style={{ width: `${businessBarInfo.startPct}%` }}
              className="h-full bg-indigo-500/10 dark:bg-indigo-950/40 flex items-center justify-start pl-2 text-[10px] text-indigo-500/70 font-mono"
            >
              🌙 00:00
            </div>

            {/* Active Working Window */}
            <div
              style={{ width: `${businessBarInfo.widthPct}%` }}
              className="h-full bg-emerald-500/20 dark:bg-emerald-500/25 border-x border-emerald-500/40 flex items-center justify-between px-2 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300"
            >
              <span>{formData.businessHours.startTime}</span>
              <span className="hidden sm:inline font-sans text-[10px] opacity-80">
                {t("● Active Calling & WhatsApp", "● 正常外呼与建联沟通")}
              </span>
              <span>{formData.businessHours.endTime}</span>
            </div>

            {/* Shaded Off-hours Right */}
            <div
              style={{
                width: `${100 - businessBarInfo.startPct - businessBarInfo.widthPct}%`,
              }}
              className="h-full bg-indigo-500/10 dark:bg-indigo-950/40 flex items-center justify-end pr-2 text-[10px] text-indigo-500/70 font-mono"
            >
              24:00 🌙
            </div>

            {/* Current Real-time Needle */}
            <div
              style={{ left: `${businessBarInfo.nowPct}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 shadow-sm z-10"
              title={`${t("Current Time:", "目标时区当前时间:")} ${currentTimeStr}`}
            >
              <div className="w-2 h-2 rounded-full bg-rose-500 -ml-[3px] -top-1 absolute animate-ping opacity-75"></div>
              <div className="w-2 h-2 rounded-full bg-rose-500 -ml-[3px] -top-1 absolute"></div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 font-mono">
            <span>00:00 {t("Midnight", "午夜")}</span>
            <span className="text-rose-500 font-semibold">
              {t("Current local time:", "当前当地时间:")} {currentTimeStr}
            </span>
            <span>24:00 {t("End of Day", "日终")}</span>
          </div>
        </div>

        {/* Feature Switches Toolbar: Simulator & Cascade Diagram */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSimulator(!showSimulator)}
              className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                showSimulator
                  ? "bg-primary-500/10 border-primary-500/30 text-primary-600 dark:text-primary-400"
                  : isLight
                    ? "bg-slate-100 text-slate-600 border-slate-200"
                    : "bg-slate-800 text-slate-300 border-slate-700"
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>
                {t("Live SLA Timeline Simulator", "SLA 真实时效推演沙盒")}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowCascadeDiagram(!showCascadeDiagram)}
              className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                showCascadeDiagram
                  ? "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400"
                  : isLight
                    ? "bg-slate-100 text-slate-600 border-slate-200"
                    : "bg-slate-800 text-slate-300 border-slate-700"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>
                {t("Logic Cascade Architecture", "SLA 规则决策链架构图")}
              </span>
            </button>

            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab("docs")}
                className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${isLight ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200" : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"}`}
                title={t(
                  "View the Sales Operations chapter in the online guide",
                  "查看在线手册的销售运营章节",
                )}
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                <span>
                  {t("Sales Operations guide", "销售运营指南")}
                </span>
              </button>
            )}
          </div>

          <section
            aria-label={t("Saving and activation", "保存与生效说明")}
            className={`rounded-xl border p-3 space-y-2 text-xs leading-relaxed ${isLight ? "bg-slate-50 border-slate-200 text-slate-600" : "bg-slate-950 border-slate-800 text-slate-300"}`}
          >
            <h3
              className={`font-semibold ${isLight ? "text-slate-800" : "text-slate-100"}`}
            >
              {t("Saving and activation", "保存与生效说明")}
            </h3>
            <p>
              <strong>
                {t("Save Policies / Reset Defaults", "保存策略 / 恢复默认设置")}
                ：
              </strong>{" "}
              {t(
                "Apply only to working hours, response deadlines and follow-up rules. Edits take effect after Save Policies succeeds; existing follow-up deadlines are not recalculated.",
                "仅用于工作时间、响应时限和跟进规则。修改在保存成功后生效；不会重新计算已有跟进任务的截止时间。",
              )}
            </p>
            <p>
              <strong>{t("Notification settings", "通知配置")}：</strong>{" "}
              {t(
                "Save each notification policy and channel in its own section. Save Policies does not save notification edits. Inactive drafts do not send notifications; enabling a policy applies to new events.",
                "通知策略和渠道在各自区域单独保存；顶部“保存策略”不会保存通知修改。停用草稿不发送通知，策略启用后仅应用于新事件。",
              )}
            </p>
            <p
              role="status"
              className={
                modifiedFieldsCount > 0
                  ? "font-medium text-amber-700 dark:text-amber-300"
                  : "text-slate-500 dark:text-slate-400"
              }
            >
              {modifiedFieldsCount > 0
                ? t(
                    `${modifiedFieldsCount} unsaved change${modifiedFieldsCount > 1 ? "s" : ""} to working hours or follow-up rules. Use Save Policies in the top-right toolbar.`,
                    `工作时间或跟进规则有 ${modifiedFieldsCount} 项未保存修改，请使用右上角“保存策略”。`,
                  )
                : t(
                    "No unsaved changes to working hours or follow-up rules.",
                    "工作时间与跟进规则没有待保存修改。",
                  )}
            </p>
          </section>
        </div>
      </div>

      {/* 2. Interactive SLA Timeline Simulator (Tool) */}
      {showSimulator && (
        <div
          className={`p-5 rounded-2xl border transition-all ${isLight ? "bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-white border-blue-200/90 shadow-xs" : "bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border-indigo-900/50"}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-600 text-white shadow-2xs">
                <Play className="w-4 h-4" />
              </span>
              <div>
                <h3
                  className={`font-bold text-sm ${isLight ? "text-slate-900" : "text-white"}`}
                >
                  {t(
                    "Interactive SLA Timeline Simulator",
                    "交互式 SLA 时效推演沙盒",
                  )}
                </h3>
                <p
                  className={`text-xs ${isLight ? "text-slate-600" : "text-slate-400"}`}
                >
                  {t(
                    "Preview natural-hour response deadlines using the same work calendar calculation as the server.",
                    "使用与服务端相同的工作日历计算，预览不同等级的自然时长响应截止时间。",
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-semibold">
                {t("Interactive Sandbox", "实时沙盒推演")}
              </span>
              <button
                type="button"
                onClick={() => setShowSimulator(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer ml-2"
              >
                {t("Close Sandbox", "收起沙盒")}
              </button>
            </div>
          </div>

          {/* Simulator Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Lead Tier Picker */}
            <div>
              <label
                className={`block font-semibold text-xs mb-1.5 ${isLight ? "text-slate-700" : "text-slate-300"}`}
              >
                {t("Simulate Lead Intent Tier:", "模拟进线学员等级:")}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSimTier("hot")}
                  className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-left ${
                    simTier === "hot"
                      ? "bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400 font-bold"
                      : isLight
                        ? "bg-white border-slate-200 text-slate-600"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-1 font-bold text-rose-600">
                    <Flame className="w-3.5 h-3.5" />
                    <span>{t("Hot (Tier 1)", "高意向（等级 1）")}</span>
                  </div>
                  <div className="text-[10px] font-mono opacity-80 mt-0.5">
                    {formData.firstResponseSla.hot.value}{" "}
                    {crmValue(formData.firstResponseSla.hot.unit, lang)}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSimTier("warm")}
                  className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-left ${
                    simTier === "warm"
                      ? "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400 font-bold"
                      : isLight
                        ? "bg-white border-slate-200 text-slate-600"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-1 font-bold text-amber-600">
                    <Zap className="w-3.5 h-3.5" />
                    <span>{t("Warm (Tier 2)", "中意向（等级 2）")}</span>
                  </div>
                  <div className="text-[10px] font-mono opacity-80 mt-0.5">
                    {formData.firstResponseSla.warm.value}{" "}
                    {crmValue(formData.firstResponseSla.warm.unit, lang)}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSimTier("cold")}
                  className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-left ${
                    simTier === "cold"
                      ? "bg-slate-500/10 border-slate-500/40 text-slate-700 dark:text-slate-300 font-bold"
                      : isLight
                        ? "bg-white border-slate-200 text-slate-600"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-1 font-bold text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{t("Cold (Tier 3)", "低意向（等级 3）")}</span>
                  </div>
                  <div className="text-[10px] font-mono opacity-80 mt-0.5">
                    {formData.firstResponseSla.cold.value}{" "}
                    {crmValue(formData.firstResponseSla.cold.unit, lang)}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSimTier("reactivated")}
                  className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-left ${
                    simTier === "reactivated"
                      ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-400 font-bold"
                      : isLight
                        ? "bg-white border-slate-200 text-slate-600"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-1 font-bold text-indigo-600">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t("Reactivation", "重新咨询客户")}</span>
                  </div>
                  <div className="text-[10px] font-mono opacity-80 mt-0.5">
                    {formData.reactivation.reactivatedResponse.value}{" "}
                    {crmValue(
                      formData.reactivation.reactivatedResponse.unit,
                      lang,
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* Ingestion Time Preset */}
            <div>
              <label
                className={`block font-semibold text-xs mb-1.5 ${isLight ? "text-slate-700" : "text-slate-300"}`}
              >
                {t("Simulate Ingestion Timestamp:", "模拟客户提交咨询时间点:")}
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSimPresetTime("fri_night")}
                  className={`p-2 rounded-xl text-xs font-medium border text-left transition-all cursor-pointer ${
                    simPresetTime === "fri_night"
                      ? "bg-primary-500/10 border-primary-500/40 text-primary-700 dark:text-primary-300 font-bold"
                      : isLight
                        ? "bg-white border-slate-200 text-slate-600"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  <div className="font-semibold">
                    {t("Friday 19:30", "周五 19:30")}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {t("30m before 20:00 closing", "临近夜间打烊")}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSimPresetTime("sat_night")}
                  className={`p-2 rounded-xl text-xs font-medium border text-left transition-all cursor-pointer ${
                    simPresetTime === "sat_night"
                      ? "bg-primary-500/10 border-primary-500/40 text-primary-700 dark:text-primary-300 font-bold"
                      : isLight
                        ? "bg-white border-slate-200 text-slate-600"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  <div className="font-semibold">
                    {t("Saturday 21:15", "周六 21:15")}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {t("Weekend night off-hours", "周末夜间免打扰")}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSimPresetTime("sun_afternoon")}
                  className={`p-2 rounded-xl text-xs font-medium border text-left transition-all cursor-pointer ${
                    simPresetTime === "sun_afternoon"
                      ? "bg-primary-500/10 border-primary-500/40 text-primary-700 dark:text-primary-300 font-bold"
                      : isLight
                        ? "bg-white border-slate-200 text-slate-600"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  <div className="font-semibold">
                    {t("Sunday 14:00", "周日 14:00")}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {t("Sunday rest day rollover", "公休日自动顺延")}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSimPresetTime("mon_morning")}
                  className={`p-2 rounded-xl text-xs font-medium border text-left transition-all cursor-pointer ${
                    simPresetTime === "mon_morning"
                      ? "bg-primary-500/10 border-primary-500/40 text-primary-700 dark:text-primary-300 font-bold"
                      : isLight
                        ? "bg-white border-slate-200 text-slate-600"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  <div className="font-semibold">
                    {t("Monday 09:30", "周一 09:30")}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {t("Active peak working hours", "正常工作时间")}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Simulation Output Card */}
          <div
            className={`p-4 rounded-xl border ${isLight ? "bg-white/90 border-slate-200" : "bg-slate-900/90 border-slate-800"}`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-500">
                  {t("Simulation Target Scenario:", "当前推演场景:")}
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{simulationResult.sampleLabel}</span>
                  <span aria-hidden="true">→</span>
                  <span className="text-primary-600 dark:text-primary-400">
                    {simulationResult.tierTitle}
                  </span>
                </div>
              </div>

              {/* Final SLA Deadline Badge */}
              <div className="text-left md:text-right shrink-0">
                <div className="text-[11px] text-slate-400 font-medium">
                  {t("Calculated response deadline:", "计算出的响应截止时间:")}
                </div>
                <div className="text-base font-bold font-mono text-rose-600 dark:text-rose-400">
                  {simulationResult.finalDeadline}
                </div>
              </div>
            </div>

            <div className="pt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span>{simulationResult.explanation}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Logic Cascade Architecture Diagram */}
      {showCascadeDiagram && (
        <div
          className={`p-5 rounded-2xl border transition-all ${isLight ? "bg-white border-slate-200 shadow-xs" : "bg-slate-900 border-slate-800"}`}
        >
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Layers className="w-4 h-4" />
              </span>
              <div>
                <h3
                  className={`font-bold text-sm ${isLight ? "text-slate-900" : "text-white"}`}
                >
                  {t(
                    "Lead Lifecycle & SLA Decision Chain",
                    "线索全生命周期流转与 SLA 规则链架构图",
                  )}
                </h3>
                <p
                  className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}
                >
                  {t(
                    "Standardized automation flow implemented across CRM workbench.",
                    "销售工作台底层所运行的 6 大策略流转逻辑图解。",
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCascadeDiagram(false)}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {t("Close Diagram", "收起图解")}
            </button>
          </div>

          {/* Flowchart Steps */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-xs">
            {/* Step 1 */}
            <div
              className={`p-3 rounded-xl border flex flex-col justify-between ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950 border-slate-800"}`}
            >
              <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                1. {t("Capture & Deduplication", "触点采集与清洗")}
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                {t(
                  "Contact capture and visitor linkage. Matching contact details alone do not establish identity.",
                  "记录联系信息并关联访客；联系方式相同不能单独证明身份。",
                )}
              </p>
              <div className="mt-2 text-[10px] font-mono text-primary-600">
                {t("See the conversations chapter", "参阅聊天与转人工章节")}
              </div>
            </div>

            {/* Step 2 */}
            <div
              className={`p-3 rounded-xl border flex flex-col justify-between ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950 border-slate-800"}`}
            >
              <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                2. {t("R1~R6 Tiering", "R1~R6 意向推演")}
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                {t(
                  "Algorithmic qualification into Hot, Warm, Cold with buying signal weights.",
                  "依据购课意向强弱信号自动分档至 高、中、低意向。",
                )}
              </p>
              <div className="mt-2 text-[10px] font-mono text-amber-600">
                {t("See the customer workspace chapter", "参阅客户工作区章节")}
              </div>
            </div>

            {/* Step 3 */}
            <div
              className={`p-3 rounded-xl border flex flex-col justify-between ${isLight ? "bg-blue-50/70 border-blue-200 text-blue-900" : "bg-blue-950/30 border-blue-800 text-blue-300"}`}
            >
              <div className="font-bold mb-1">
                3. {t("FRT SLA Clock", "首响应倒计时")}
              </div>
              <p className="text-[11px] opacity-80 leading-snug">
                {t(
                  "Configured first-response deadlines; outside-hours requests and deadlines roll forward using the saved work calendar.",
                  "首次响应采用已配置的时限；非工作时间的请求与截止时间按已保存工作日历顺延。",
                )}
              </p>
              <div className="mt-2 text-[10px] font-mono font-bold">
                {formData.firstResponseSla.hot.value}{" "}
                {crmValue(formData.firstResponseSla.hot.unit, lang)} /{" "}
                {formData.firstResponseSla.warm.value}{" "}
                {crmValue(formData.firstResponseSla.warm.unit, lang)}
              </div>
            </div>

            {/* Step 4 */}
            <div
              className={`p-3 rounded-xl border flex flex-col justify-between ${isLight ? "bg-purple-50/70 border-purple-200 text-purple-900" : "bg-purple-950/30 border-purple-800 text-purple-300"}`}
            >
              <div className="font-bold mb-1">
                4. {t("Call Retries & Circuit", "未接止损熔断")}
              </div>
              <p className="text-[11px] opacity-80 leading-snug">
                {t(
                  "Cooling interval between calls; max 3 misses automatically moves lead to cold pool.",
                  "未接通冷却等待 4 小时；累计 3 次未接自动熔断流转至冷池。",
                )}
              </p>
              <div className="mt-2 text-[10px] font-mono font-bold">
                {t("Max", "最多")}
                {formData.noResponseCadence.maxRetriesBeforeNurture}
                {t("Retries", "次重试")}
              </div>
            </div>

            {/* Step 5 */}
            <div
              className={`p-3 rounded-xl border flex flex-col justify-between ${isLight ? "bg-emerald-50/70 border-emerald-200 text-emerald-900" : "bg-emerald-950/30 border-emerald-800 text-emerald-300"}`}
            >
              <div className="font-bold mb-1">
                5. {t("Milestone Cadence", "试听测评里程碑")}
              </div>
              <p className="text-[11px] opacity-80 leading-snug">
                {t(
                  "Trial reminders and post-trial follow-ups use the configured intervals.",
                  "试听前提醒与课后回访采用已配置的时间间隔。",
                )}
              </p>
              <div className="mt-2 text-[10px] font-mono font-bold">
                {t(
                  "−4 h / +4 h / +2 h",
                  "提前 4 小时／延后 4 小时／延后 2 小时",
                )}
              </div>
            </div>

            {/* Step 6 */}
            <div
              className={`p-3 rounded-xl border flex flex-col justify-between ${isLight ? "bg-indigo-50/70 border-indigo-200 text-indigo-900" : "bg-indigo-950/30 border-indigo-800 text-indigo-300"}`}
            >
              <div className="font-bold mb-1">
                6. {t("Reactivation Priority", "沉睡唤醒提速")}
              </div>
              <p className="text-[11px] opacity-80 leading-snug">
                {t(
                  "Re-engaged dormant leads use the configured response deadline.",
                  "沉睡客户重新咨询后，按配置的响应时限安排回访。",
                )}
              </p>
              <div className="mt-2 text-[10px] font-mono font-bold">
                {formData.reactivation.reactivatedResponse.value}{" "}
                {crmValue(formData.reactivation.reactivatedResponse.unit, lang)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Category Filter Buttons */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeCategory === "all"
              ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          {t("All 7 Modules", "全部 7 个模块")}
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("schedule")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeCategory === "schedule"
              ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          {t("1. Business Schedule", "1. 运营时区与工作日历")}
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("first_response")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeCategory === "first_response"
              ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          {t("2. First Response (FRT)", "2. 首响应分级时限")}
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("retry")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeCategory === "retry"
              ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          {t("3. Call Retries", "3. 未接止损与重呼")}
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("watchdog")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeCategory === "watchdog"
              ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          {t("4. Watchdog Alerts", "4. 未联系提醒")}
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("milestone")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeCategory === "milestone"
              ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          {t("5. Milestones", "5. 试听测评里程碑")}
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("reactivation")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeCategory === "reactivation"
              ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          {t("6. Reactivation", "6. 沉睡客户重新咨询")}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveCategory("notifications");
            onNavigateNotifications?.();
          }}
          aria-pressed={activeCategory === "notifications"}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeCategory === "notifications" ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"}`}
        >
          {t(
            "7. Notification settings & delivery audit",
            "7. 通知设置与发送审计",
          )}
        </button>
      </div>

      {/* 5. Main Configuration Grid (Clean Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CARD 1: Business Hours & Operational Timezone */}
        {(activeCategory === "all" || activeCategory === "schedule") && (
          <div
            className={`p-5 rounded-2xl border transition-all ${isLight ? "bg-white border-slate-200/90 shadow-xs" : "bg-slate-900 border-slate-800"}`}
          >
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="p-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Clock className="w-4 h-4" />
              </span>
              <div>
                <h3
                  className={`font-bold text-sm ${isLight ? "text-slate-900" : "text-white"}`}
                >
                  {t(
                    "1. Business Hours & Operational Timezone",
                    "1. 业务服务时间与工作时区",
                  )}
                </h3>
                <p
                  className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}
                >
                  {t(
                    "Defines compliant outreach windows to prevent disturbing Indonesian parents at night.",
                    "确定销售顾问合规外呼的时间范围，防止夜间骚扰印尼学员与家长。",
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Timezone */}
              <div>
                <label
                  className={`block font-semibold text-xs mb-1 ${isLight ? "text-slate-800" : "text-slate-200"}`}
                >
                  {t("Operating Timezone", "运营时区")}
                </label>
                <p
                  className={`text-[11px] mb-1.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}
                >
                  {t(
                    "Timezone for the business clock, SLA deadlines and new lead-number dates. Existing lead numbers stay unchanged.",
                    "用于业务时钟、SLA截止时间和新线索业务编号的日期。已生成的业务编号保持不变。",
                  )}
                </p>
                <select
                  value={formData.businessHours.timezone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      businessHours: {
                        ...formData.businessHours,
                        timezone: e.target.value,
                      },
                    })
                  }
                  className={`w-full text-xs rounded-xl px-3 py-2 border outline-none font-medium ${isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-slate-950 border-slate-800 text-slate-200"}`}
                >
                  <option value="Asia/Jakarta">
                    {t("Jakarta (UTC+7)", "雅加达（UTC+7）")}
                  </option>
                  <option value="Asia/Makassar">
                    {t("Makassar (UTC+8)", "望加锡（UTC+8）")}
                  </option>
                  <option value="Asia/Shanghai">
                    {t("Shanghai (UTC+8)", "上海（UTC+8）")}
                  </option>
                  <option value="Asia/Singapore">
                    {t("Singapore (UTC+8)", "新加坡（UTC+8）")}
                  </option>
                </select>
              </div>

              {/* Start and End Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className={`block font-semibold text-xs mb-1 ${isLight ? "text-slate-800" : "text-slate-200"}`}
                  >
                    {t("Daily Start Time", "每日开始工作时间")}
                  </label>
                  <p
                    className={`text-[10.5px] mb-1 ${isLight ? "text-slate-500" : "text-slate-400"}`}
                  >
                    {t(
                      "Earliest call hour (default: 09:00)",
                      "早晨允许外呼起始点 (缺省 09:00)",
                    )}
                  </p>
                  <input
                    type="time"
                    value={formData.businessHours.startTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        businessHours: {
                          ...formData.businessHours,
                          startTime: e.target.value,
                        },
                      })
                    }
                    className={`w-full max-w-[140px] h-8 text-xs rounded-lg px-2.5 border outline-none font-semibold font-mono ${isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-slate-950 border-slate-800 text-slate-200"}`}
                  />
                </div>

                <div>
                  <label
                    className={`block font-semibold text-xs mb-1 ${isLight ? "text-slate-800" : "text-slate-200"}`}
                  >
                    {t("Daily End Time", "每日停止外呼时间")}
                  </label>
                  <p
                    className={`text-[10.5px] mb-1 ${isLight ? "text-slate-500" : "text-slate-400"}`}
                  >
                    {t(
                      "Latest call hour (default: 20:00)",
                      "夜间停止外呼时间 (缺省 20:00)",
                    )}
                  </p>
                  <input
                    type="time"
                    value={formData.businessHours.endTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        businessHours: {
                          ...formData.businessHours,
                          endTime: e.target.value,
                        },
                      })
                    }
                    className={`w-full max-w-[140px] h-8 text-xs rounded-lg px-2.5 border outline-none font-semibold font-mono ${isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-slate-950 border-slate-800 text-slate-200"}`}
                  />
                </div>
              </div>

              {/* Workdays */}
              <div>
                <label
                  className={`block font-semibold text-xs mb-1 ${isLight ? "text-slate-800" : "text-slate-200"}`}
                >
                  {t("Active Workdays", "团队每周工作日")}
                </label>
                <p
                  className={`text-[11px] mb-2 ${isLight ? "text-slate-500" : "text-slate-400"}`}
                >
                  {t(
                    "Non-selected days are treated as rest days; timers roll over to next working morning.",
                    "未选中的日期视为公休日，SLA 自动顺延至下个工作日早晨。",
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {weekDayLabels.map((day) => {
                    const active = formData.businessHours.workDays.includes(
                      day.num,
                    );
                    return (
                      <button
                        key={day.num}
                        type="button"
                        onClick={() => toggleWorkDay(day.num)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          active
                            ? "bg-primary-600 text-white border-primary-600 shadow-2xs font-bold"
                            : isLight
                              ? "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                              : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                        }`}
                      >
                        {t(day.en, day.zh)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs text-slate-500">
                {t(
                  "Response deadlines use natural elapsed hours. Requests outside working hours start at the next opening, and deadlines outside working hours move to the next opening. The legacy next-day grace value is retained but inactive in this mode.",
                  "响应截止时间按自然时长计算。非工作时间收到的申请从下次上班开始计时；截止落在非工作时间则顺延。旧版次日宽限值保留，但在此模式下不使用。",
                )}
              </p>
            </div>
          </div>
        )}

        {/* CARD 2: First Response SLA (FRT) */}
        {(activeCategory === "all" || activeCategory === "first_response") && (
          <div
            className={`p-5 rounded-2xl border transition-all ${isLight ? "bg-white border-slate-200/90 shadow-xs" : "bg-slate-900 border-slate-800"}`}
          >
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="p-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Zap className="w-4 h-4" />
              </span>
              <div>
                <h3
                  className={`font-bold text-sm ${isLight ? "text-slate-900" : "text-white"}`}
                >
                  {t("2. First Response SLA (FRT)", "2. 新客首次响应时限设定")}
                </h3>
                <p
                  className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}
                >
                  {t(
                    "Mandatory maximum timeframe for consultants to initiate first contact based on lead Tier.",
                    "依据意向评级设定不同的首次破冰倒计时窗口，支持自由选择分钟/小时/天。",
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-3.5">
              <DurationField
                isLight={isLight}
                lang={lang}
                titleEn="Tier 1 (Hot) First Response SLA"
                titleZh="等级 1 (高意向) 首访响应时限"
                descEn="High-priority response deadline. Advisor follow-up, booking and enrollment requests use this duration regardless of lead tier."
                descZh="高优先级响应时限。申请顾问跟进、预约及报名均使用此时限，不受原客户等级限制。"
                duration={formData.firstResponseSla.hot}
                originalDuration={policyConfig.firstResponseSla.hot}
                recommendedText={t("Default: 3 Hours", "默认: 3 小时")}
                accentColor="text-rose-600 dark:text-rose-400 font-bold"
                onChange={(newDuration) =>
                  setFormData({
                    ...formData,
                    firstResponseSla: {
                      ...formData.firstResponseSla,
                      hot: newDuration,
                    },
                  })
                }
              />

              <DurationField
                isLight={isLight}
                lang={lang}
                titleEn="Tier 2 (Warm) First Response SLA"
                titleZh="等级 2 (中意向) 首访响应时限"
                descEn="Standard interest students seeking general consultation or trial placement."
                descZh="常规意向咨询、申请试听学员的首次建联响应窗口。"
                duration={formData.firstResponseSla.warm}
                originalDuration={policyConfig.firstResponseSla.warm}
                recommendedText={t("Default: 24 Hours", "默认: 24 小时")}
                accentColor="text-amber-600 dark:text-amber-400 font-bold"
                onChange={(newDuration) =>
                  setFormData({
                    ...formData,
                    firstResponseSla: {
                      ...formData.firstResponseSla,
                      warm: newDuration,
                    },
                  })
                }
              />

              <DurationField
                isLight={isLight}
                lang={lang}
                titleEn="Tier 3 (Cold / School) SLA"
                titleZh="等级 3 (低意向/院校) 首访响应时限"
                descEn="Inquiries requesting broad brochures, general school inquiries or low initial intent."
                descZh="学校合作或通用材料下载类线索的建联时限。"
                duration={formData.firstResponseSla.cold}
                originalDuration={policyConfig.firstResponseSla.cold}
                recommendedText={t("Default: 48 Hours", "默认: 48 小时")}
                accentColor="text-slate-600 dark:text-slate-400"
                onChange={(newDuration) =>
                  setFormData({
                    ...formData,
                    firstResponseSla: {
                      ...formData.firstResponseSla,
                      cold: newDuration,
                    },
                  })
                }
              />
            </div>
          </div>
        )}

        {/* CARD 3: No-Response & Call Retry Policy */}
        {(activeCategory === "all" || activeCategory === "retry") && (
          <div
            className={`p-5 rounded-2xl border transition-all ${isLight ? "bg-white border-slate-200/90 shadow-xs" : "bg-slate-900 border-slate-800"}`}
          >
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="p-1 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <PhoneCall className="w-4 h-4" />
              </span>
              <div>
                <h3
                  className={`font-bold text-sm ${isLight ? "text-slate-900" : "text-white"}`}
                >
                  {t(
                    "3. No-Response & Call Retry Policy",
                    "3. 未接通防骚扰与止损机制",
                  )}
                </h3>
                <p
                  className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}
                >
                  {t(
                    "Governs cooling-off intervals and automatic nurture transition when calls are not answered.",
                    "规范电话未接通后的重试等待周期与最大呼叫次数，防止引起客户反感。",
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-3.5">
              <DurationField
                isLight={isLight}
                lang={lang}
                titleEn="Retry Interval After Unanswered Call"
                titleZh="未接通后的重试冷却间隔"
                descEn="Time to wait before the system prompts the sales rep to make a second attempt."
                descZh="学员初次电话未接后，建议等待的下一次重呼间隔，避免密集呼叫引起反感。"
                duration={formData.noResponseCadence.retryInterval}
                originalDuration={policyConfig.noResponseCadence.retryInterval}
                recommendedText={t("Default: 4 Hours", "默认: 4 小时")}
                accentColor="text-purple-600 dark:text-purple-400"
                onChange={(newDuration) =>
                  setFormData({
                    ...formData,
                    noResponseCadence: {
                      ...formData.noResponseCadence,
                      retryInterval: newDuration,
                    },
                  })
                }
              />

              <div
                className={`p-4 rounded-xl border transition-all ${
                  formData.noResponseCadence.maxRetriesBeforeNurture !==
                  policyConfig.noResponseCadence.maxRetriesBeforeNurture
                    ? isLight
                      ? "bg-amber-50/50 border-amber-300 ring-1 ring-amber-200"
                      : "bg-amber-950/20 border-amber-700/60"
                    : isLight
                      ? "bg-slate-50/70 border-slate-200/80"
                      : "bg-slate-950/40 border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div>
                    <label
                      className={`block font-semibold text-xs ${isLight ? "text-slate-800" : "text-slate-200"}`}
                    >
                      {t(
                        "Max Retries Before Cold Nurture",
                        "最大允许未接重试次数",
                      )}
                    </label>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {t("Max retries before nurture", "最大重试触达次数")}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                      {formData.noResponseCadence.maxRetriesBeforeNurture}{" "}
                      {t("Touches", "次")}
                    </span>
                    <div className="text-[10px] text-slate-400">
                      {t("Default: 3", "推荐: 3次")}
                    </div>
                  </div>
                </div>

                <p
                  className={`text-[11px] mb-3 leading-relaxed ${isLight ? "text-slate-500" : "text-slate-400"}`}
                >
                  {t(
                    "After this many consecutive unanswered attempts, the lead automatically moves to cold nurture.",
                    "连续达到此未接次数时，系统自动转入冷池培育，停止催促销售，避免被投诉骚扰。",
                  )}
                </p>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-800/60">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.noResponseCadence.maxRetriesBeforeNurture}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        noResponseCadence: {
                          ...formData.noResponseCadence,
                          maxRetriesBeforeNurture:
                            parseInt(e.target.value) || 3,
                        },
                      })
                    }
                    className={`w-20 h-8 text-xs font-mono rounded-lg px-2.5 border outline-none font-semibold ${isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900 border-slate-700 text-slate-200"}`}
                  />
                  <span className="text-xs text-slate-500">
                    {t("Attempts", "次")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CARD 4: Inactivity Watchdog Thresholds */}
        {(activeCategory === "all" || activeCategory === "watchdog") && (
          <div
            className={`p-5 rounded-2xl border transition-all ${isLight ? "bg-white border-slate-200/90 shadow-xs" : "bg-slate-900 border-slate-800"}`}
          >
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="p-1 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="w-4 h-4" />
              </span>
              <div>
                <h3
                  className={`font-bold text-sm ${isLight ? "text-slate-900" : "text-white"}`}
                >
                  {t(
                    "4. Inactivity Watchdog Thresholds",
                    "4. 已联系客户的未联系时长",
                  )}
                </h3>
                <p
                  className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}
                >
                  {t(
                    "Alerts sales reps when an active lead has no scheduled follow-up and exceeds silence threshold.",
                    "当下线索已联系过、但未设定具体下次时间时，超过此阈值即报警提示回访。",
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-3.5">
              <DurationField
                isLight={isLight}
                lang={lang}
                titleEn="Hot Lead Inactivity Alert"
                titleZh="高意向学员防停滞报警阈值"
                descEn="Alert if no follow-up occurs within this duration for Hot leads."
                descZh="高意向客户初访后若未排定下次具体时间，超过该时限未有新跟进则亮起停滞预警。"
                duration={formData.inactivityWatchdog.hotInactivity}
                originalDuration={policyConfig.inactivityWatchdog.hotInactivity}
                recommendedText={t("Default: 24 Hours", "默认: 24 小时")}
                accentColor="text-rose-600 dark:text-rose-400 font-bold"
                onChange={(newDuration) =>
                  setFormData({
                    ...formData,
                    inactivityWatchdog: {
                      ...formData.inactivityWatchdog,
                      hotInactivity: newDuration,
                    },
                  })
                }
              />

              <DurationField
                isLight={isLight}
                lang={lang}
                titleEn="Warm Lead Inactivity Alert"
                titleZh="中意向客户未联系提醒时长"
                descEn="Alert threshold for active intermediate interest leads."
                descZh="常规意向客户初访后若未设定下次跟进时间，最大允许沉默时长。"
                duration={formData.inactivityWatchdog.warmInactivity}
                originalDuration={
                  policyConfig.inactivityWatchdog.warmInactivity
                }
                recommendedText={t("Default: 48 Hours", "默认: 48 小时")}
                accentColor="text-amber-600 dark:text-amber-400"
                onChange={(newDuration) =>
                  setFormData({
                    ...formData,
                    inactivityWatchdog: {
                      ...formData.inactivityWatchdog,
                      warmInactivity: newDuration,
                    },
                  })
                }
              />

              <DurationField
                isLight={isLight}
                lang={lang}
                titleEn="Cold Lead Routine Check Interval"
                titleZh="普通/冷线索定期唤醒检查周期"
                descEn="Interval before reminding the consultant to send regular promotion broadcasts."
                descZh="培育池老客户每隔多久推送一次官方开班简章或奖学金动态。"
                duration={formData.inactivityWatchdog.coldInactivity}
                originalDuration={
                  policyConfig.inactivityWatchdog.coldInactivity
                }
                recommendedText={t("Default: 7 Days", "默认: 7 天")}
                accentColor="text-slate-600 dark:text-slate-400"
                onChange={(newDuration) =>
                  setFormData({
                    ...formData,
                    inactivityWatchdog: {
                      ...formData.inactivityWatchdog,
                      coldInactivity: newDuration,
                    },
                  })
                }
              />
            </div>
          </div>
        )}

        {/* CARD 5: Milestone Cadence & Offsets */}
        {(activeCategory === "all" || activeCategory === "milestone") && (
          <div
            className={`p-5 rounded-2xl border transition-all ${isLight ? "bg-white border-slate-200/90 shadow-xs" : "bg-slate-900 border-slate-800"}`}
          >
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Target className="w-4 h-4" />
              </span>
              <div>
                <h3
                  className={`font-bold text-sm ${isLight ? "text-slate-900" : "text-white"}`}
                >
                  {t(
                    "5. Milestone Cadence & Offsets",
                    "5. 试听与测评里程碑自动提醒",
                  )}
                </h3>
                <p
                  className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}
                >
                  {t(
                    "Automated reminder triggers tied to fixed educational events (trial classes, diagnostic quiz).",
                    "围绕固定教学事件（试听课、智能测试出分）自动倒推的标准化动作节点，单位可选，缺省为小时。",
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-3.5">
              <DurationField
                isLight={isLight}
                lang={lang}
                titleEn="Trial Class Pre-Course Reminder"
                titleZh="试听课开课前提醒提前量"
                descEn="Time before trial start to remind consultant to send Zoom meeting details or campus map."
                descZh="约定试听课开始前几小时，自动提示顾问发送 Zoom 会议号或 PIK 校区导航。"
                duration={formData.milestones.trialReminderBefore}
                originalDuration={policyConfig.milestones.trialReminderBefore}
                recommendedText={t("Default: 4 Hours", "默认: 4 小时")}
                accentColor="text-emerald-600 dark:text-emerald-400"
                onChange={(newDuration) =>
                  setFormData({
                    ...formData,
                    milestones: {
                      ...formData.milestones,
                      trialReminderBefore: newDuration,
                    },
                  })
                }
              />

              <DurationField
                isLight={isLight}
                lang={lang}
                titleEn="Post-Trial Experience Follow-up"
                titleZh="试听课后回访促单时间节点"
                descEn="Time after trial completion to call the student/parents for feedback and close class enrollment."
                descZh="试听结束后几小时内电话回访体验，解答疑问并促成学费预缴。"
                duration={formData.milestones.trialFollowUpAfter}
                originalDuration={policyConfig.milestones.trialFollowUpAfter}
                recommendedText={t("Default: 4 Hours", "默认: 4 小时")}
                accentColor="text-emerald-600 dark:text-emerald-400"
                onChange={(newDuration) =>
                  setFormData({
                    ...formData,
                    milestones: {
                      ...formData.milestones,
                      trialFollowUpAfter: newDuration,
                    },
                  })
                }
              />

              <DurationField
                isLight={isLight}
                lang={lang}
                titleEn="Assessment Result Track Recommendation"
                titleZh="智能测评完成后的推荐定级时效"
                descEn="Time after student finishes test quiz to review score report and advise matched HSK syllabus."
                descZh="学员完成测评后，顾问应在此时限内核对报告并推荐适配课程。"
                duration={formData.milestones.assessmentFollowUpAfter}
                originalDuration={
                  policyConfig.milestones.assessmentFollowUpAfter
                }
                recommendedText={t("Default: 2 Hours", "默认: 2 小时")}
                accentColor="text-emerald-600 dark:text-emerald-400"
                onChange={(newDuration) =>
                  setFormData({
                    ...formData,
                    milestones: {
                      ...formData.milestones,
                      assessmentFollowUpAfter: newDuration,
                    },
                  })
                }
              />
            </div>
          </div>
        )}

        {/* CARD 6: Dormant Lead Re-activation */}
        {(activeCategory === "all" || activeCategory === "reactivation") && (
          <div
            className={`p-5 rounded-2xl border transition-all ${isLight ? "bg-white border-slate-200/90 shadow-xs" : "bg-slate-900 border-slate-800"}`}
          >
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h3
                  className={`font-bold text-sm ${isLight ? "text-slate-900" : "text-white"}`}
                >
                  {t(
                    "6. Dormant Lead Re-activation",
                    "6. 沉睡客户重新咨询响应",
                  )}
                </h3>
                <p
                  className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}
                >
                  {t(
                    "Prioritizes archived leads when they perform new digital interactions (AI chats, quiz retakes).",
                    "休眠老学员突然再次访问提问或重新做题时触发的高优先级响应窗口，缺省为 30 分钟。",
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-3.5">
              <DurationField
                isLight={isLight}
                lang={lang}
                titleEn="Re-activated Dormant Lead SLA"
                titleZh="沉睡客户重新咨询响应时限"
                descEn="Urgent window within which a consultant must respond when an archived lead re-engages."
                descZh="老客户在新周期有了主动意向后，销售必须在多长时间内优先跟进，趁热打铁促成转化。"
                duration={formData.reactivation.reactivatedResponse}
                originalDuration={policyConfig.reactivation.reactivatedResponse}
                recommendedText={t("Default: 30 Minutes", "默认: 30 分钟")}
                accentColor="text-indigo-600 dark:text-indigo-400 font-bold"
                onChange={(newDuration) =>
                  setFormData({
                    ...formData,
                    reactivation: {
                      ...formData.reactivation,
                      reactivatedResponse: newDuration,
                    },
                  })
                }
              />

              <div
                className={`p-4 rounded-xl border text-xs leading-relaxed ${isLight ? "bg-slate-50/80 border-slate-200 text-slate-600" : "bg-slate-950/60 border-slate-800 text-slate-400"}`}
              >
                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-500" />
                  <span>
                    {t(
                      "Reactivation follow-up guidance",
                      "客户重新激活跟进说明",
                    )}
                  </span>
                </div>
                <p>
                  {t(
                    "When a dormant lead makes a new inquiry, review prior conversations and follow-up history, then respond within the configured response window.",
                    "沉睡客户再次咨询时，先查看历史对话与跟进记录，再按此处配置的响应时限进行回访。",
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </form>
  );
};
