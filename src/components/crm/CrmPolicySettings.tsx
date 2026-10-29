import {CrmFormSection} from './CrmFormLayout';
import {AdminField,AdminRequiredNote,AdminFieldLabel,AdminForm} from '../AdminForm';
import {readSavedPolicy} from '../../utils/crmPolicyTopicClient';
import {policyTopicKeys,isPolicyTopic,topicPatch,topicDirty,topicChangeFields,reconcilePolicyDraft,policyEqual,type PolicyTopicRequest,type PolicyTopic} from '../../utils/crmPolicyTopics';
import {notificationTopicIcons} from "./notificationTopicIcons";
import {Clock3, ShieldCheck, PhoneMissed, Bell, CalendarCheck, Send} from "lucide-react";
import {AdminTopicFrame} from "../AdminTopicFrame";
import {operationSections,operationGroups,operationSectionForField,isNotificationTopic,type OperationSection} from "./operationsSections";
import { policyConfigErrors, type ConfigErrors } from "../../utils/crmPolicyConfigValidation";
import { CrmSelect } from "./CrmSelect";
import { crmId } from "../../utils/crmIndonesian";
import {
  sla as responseDeadline,
  calendarSample,
} from "../../utils/workCalendar";
import { crmLocale, crmValue } from "../../utils/crmLanguage";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { workTimeErrors, policyMessage, policyFieldLabel, PolicySaveError, type WorkTimeField, type WorkTimeErrors } from "../../utils/crmPolicyValidation";
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
  onSavePolicy: (updated: CrmPolicyConfig,context?:PolicyTopicRequest) => Promise<CrmPolicyConfig|boolean>;
  onResetPolicy: () => Promise<boolean>;
  onNavigateTab?: (tab: "leads" | "docs") => void;
  onNavigateNotifications?: () => void;
  notificationContent?: React.ReactNode | ((topic:string,active:boolean)=>React.ReactNode);
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
  fieldPath: string;
  error?: import("../../utils/crmPolicyValidation").PolicyMessage;
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
  fieldPath,
  error,
}) => {
  const isModified =
    originalDuration && !isDurationEqual(duration, originalDuration);
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  return (
    <div data-policy-field={fieldPath}
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
          <AdminField required htmlFor={"policy-duration-"+fieldPath}
            className={`font-semibold text-xs flex items-center gap-1.5 ${isLight ? "text-slate-900" : "text-slate-100"}`}
          >
            <span>{t(titleEn, titleZh)}</span>
            {isModified && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
                {t("Modified", "已修改")}
              </span>
            )}
          </AdminField>
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
        <div className="relative admin-field">
          <input
            type="number" required id={"policy-duration-"+fieldPath}
            min="1"
            max="365"
            value={Number.isFinite(duration.value) ? duration.value : ""}
            aria-label={t(titleEn, titleZh)}
            aria-invalid={!!error}
            aria-describedby={error ? "policy-error-"+fieldPath : undefined}
            onChange={(e) =>
              onChange({
                value: e.target.value === "" ? NaN : Number(e.target.value),
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

        <CrmSelect required label={t(titleEn, titleZh) + " · " + t("Time unit", "时间单位")} value={duration.unit} onChange={(value) =>
            onChange({
              value: duration.value,
              unit: value as TimeUnit,
            })} lang={lang} isLight={isLight} className="w-28">
          <option value="minutes">{t("Minutes", "分钟")}</option>
          <option value="hours">{t("Hours", "小时")}</option>
          <option value="days">{t("Days", "天")}</option>
        </CrmSelect>

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
      {error && <p id={"policy-error-"+fieldPath} role="alert" className="mt-2 text-sm text-red-600">{policyMessage(error, lang)}</p>}
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
  notificationContent,
}) => {
  const [policyDraft,setPolicyDraft]=useState({draft:policyConfig,base:policyConfig});
  const formData=policyDraft.draft,savedPolicy=policyDraft.base;
  const setFormData=useCallback((update:React.SetStateAction<CrmPolicyConfig>)=>setPolicyDraft(state=>({...state,draft:typeof update==='function'?update(state.draft):update})),[]);
  const [isSaving, setIsSaving] = useState(false);
  const [checkingResult,setCheckingResult]=useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<PolicySaveError | null>(null);
  const [showTimeErrors, setShowTimeErrors] = useState(false);
  const [serverTimeErrors, setServerTimeErrors] = useState<WorkTimeErrors>({});
  const [focusField, setFocusField] = useState<WorkTimeField | null>(null);
  const startInput = useRef<HTMLInputElement>(null);
  const endInput = useRef<HTMLInputElement>(null);
  const saveFeedback = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  // Parent callbacks change when its toolbar state updates. Keep control callbacks
  // stable so publishing controls cannot cause a parent/child render loop.
  const actions = useRef({ onSavePolicy, onResetPolicy });
  actions.current = { onSavePolicy, onResetPolicy };
  const configErrors = showTimeErrors ? policyConfigErrors(formData) : {};
  const timeErrors = workTimeErrors(formData.businessHours);
  const fieldErrors = { ...serverTimeErrors, ...(showTimeErrors ? timeErrors : {}) };
  const calendarValid = Object.keys(timeErrors).length === 0;
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  const [currentMinutesInDay, setCurrentMinutesInDay] = useState(0);
  const [isCurrentlyWorking, setIsCurrentlyWorking] = useState(true);
  // Active section filter or layout mode
  const [activeCategory, setActiveCategory] = useState<OperationSection>("schedule");
  const languageIndex = lang === "zh" ? 2 : lang === "id" ? 1 : 0;
  const currentSection = operationSections.find(section=>section.id===activeCategory)!;
  const [showCascadeDiagram, setShowCascadeDiagram] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  // SLA Simulator states
  const [simTier, setSimTier] = useState<
    "hot" | "warm" | "cold" | "reactivated"
  >("hot");
  const [simPresetTime, setSimPresetTime] = useState<
    "now" | "fri_night" | "sat_night" | "sun_afternoon" | "mon_morning"
  >("fri_night");
  const sectionDirty=(section:OperationSection)=>isPolicyTopic(section)&&topicDirty(formData,savedPolicy,section);
  const activeModifiedCount=isPolicyTopic(activeCategory)?topicChangeFields(formData,savedPolicy,activeCategory).length:0;
  const durationLabel = (d: TimeDuration) => `${d.value} ${crmValue(d.unit,lang)}`;
  const displayPolicyValue=(value:any):string=>typeof value==='boolean'?(value?['Yes','Ya','是']:['No','Tidak','否'])[languageIndex]:Array.isArray(value)?value.map(day=>({en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],id:['Min','Sen','Sel','Rab','Kam','Jum','Sab'],zh:['周日','周一','周二','周三','周四','周五','周六']})[lang][day]??String(day)).join(' · '):value&&typeof value==='object'&&'value'in value?durationLabel(value):String(value??'—');
  const ruleSnapshot = activeCategory==='schedule' ? `${formData.businessHours.timezone} · ${formData.businessHours.startTime}–${formData.businessHours.endTime} · ${formData.businessHours.workDays.length} ${['working days','hari kerja','个工作日'][languageIndex]}`
    : activeCategory==='first_response' ? [formData.firstResponseSla.hot,formData.firstResponseSla.warm,formData.firstResponseSla.cold].map((d,i)=>`${({en:["Hot","Warm","Cold"],id:["Minat tinggi","Minat sedang","Pembinaan"],zh:["高意向","中意向","培育"]})[lang][i]}: ${durationLabel(d)}`).join(' · ')
    : activeCategory==='retry' ? `${durationLabel(formData.noResponseCadence.retryInterval)} · ${formData.noResponseCadence.maxRetriesBeforeNurture} ${['attempt threshold','ambang upaya','次尝试阈值'][languageIndex]}`
    : activeCategory==='watchdog' ? [formData.inactivityWatchdog.hotInactivity,formData.inactivityWatchdog.warmInactivity,formData.inactivityWatchdog.coldInactivity].map((d,i)=>`${({en:["Hot","Warm","Cold"],id:["Minat tinggi","Minat sedang","Pembinaan"],zh:["高意向","中意向","培育"]})[lang][i]}: ${durationLabel(d)}`).join(' · ')
    : activeCategory==='milestone' ? [formData.milestones.trialReminderBefore,formData.milestones.trialFollowUpAfter,formData.milestones.assessmentFollowUpAfter].map(durationLabel).join(' / ')
    : activeCategory==='reactivation' ? durationLabel(formData.reactivation.reactivatedResponse) : '';
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  useEffect(() => { setSaveError(null); }, [formData]);
  const receivedPolicy = useRef(JSON.stringify(policyConfig));
  useEffect(() => {
    const next = JSON.stringify(policyConfig);
    if (next === receivedPolicy.current) return;
    receivedPolicy.current = next;
    setPolicyDraft(state=>reconcilePolicyDraft(state.draft,state.base,policyConfig));
  }, [policyConfig]);
  useEffect(() => {
    if (!focusField) return;
    const input = focusField === "startTime" ? startInput.current : endInput.current;
    input?.focus();
    input?.scrollIntoView({ block: "center", behavior: "instant" });
    setFocusField(null);
  }, [focusField]);
  const focusCalendar = useCallback((errors: WorkTimeErrors) => {
    setActiveCategory("schedule");
    setFocusField(errors.startTime ? "startTime" : "endTime");
  }, []);
  const [pendingConfigField, setPendingConfigField] = useState<string | null>(null);
  const focusConfig = useCallback((errors: ConfigErrors) => {
    const field=Object.keys(errors)[0];
    if(field==='businessHours.startTime'||field==='businessHours.endTime') {
      focusCalendar({[field.split('.')[1]]:errors[field]} as WorkTimeErrors);
    } else { setActiveCategory(operationSectionForField(field)); setPendingConfigField(field); }
  },[focusCalendar]);
  useEffect(()=>{
    if(!pendingConfigField)return;
    const element=Array.from(document.querySelectorAll<HTMLElement>('[data-policy-field]')).find(e=>e.dataset.policyField===pendingConfigField);
    const target=element?.matches('input') ? element : element?.querySelector<HTMLElement>('input,button');
    (target||saveFeedback.current)?.focus();
    (target||saveFeedback.current)?.scrollIntoView({block:'center'});
    setPendingConfigField(null);
  },[pendingConfigField,activeCategory]);
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
  const modifiedFieldsCount=useMemo(()=>(Object.keys(policyTopicKeys) as PolicyTopic[]).reduce((sum,topic)=>sum+topicChangeFields(formData,savedPolicy,topic).length,0),[formData,savedPolicy]);
  // Business hours ribbon math (00:00 to 24:00)
  const businessBarInfo = useMemo(() => {
    if (Object.keys(workTimeErrors(formData.businessHours)).length) return null;
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
  const submitPolicy = useCallback(async (replacement?:CrmPolicyConfig) => {
    if(inFlight.current||!isPolicyTopic(activeCategory))return;
    const topic=activeCategory,submitted=replacement||formData;
    setSaveSuccess(false);setSaveError(null);setServerTimeErrors({});setShowTimeErrors(true);
    const invalid=policyConfigErrors({...savedPolicy,...topicPatch(submitted,topic)});
    if(Object.keys(invalid).length){setSaveError(new PolicySaveError('policy_save_rejected',invalid));focusConfig(invalid);return;}
    inFlight.current=true;setIsSaving(true);
    try{
      const result=await actions.current.onSavePolicy(submitted,{topic,base:topicPatch(savedPolicy,topic),patch:topicPatch(submitted,topic)});
      if(!result)throw new PolicySaveError();
      const saved=typeof result==='object'?result:submitted;
      setPolicyDraft(state=>reconcilePolicyDraft(state.draft,state.base,saved,{topic,submitted}));
      setSaveSuccess(true);setTimeout(()=>setSaveSuccess(false),4000);
    }catch(error){
      const failure=error instanceof PolicySaveError?error:new PolicySaveError('policy_topic_unknown');setSaveError(failure);
      setServerTimeErrors({startTime:failure.fields['businessHours.startTime'] as any,endTime:failure.fields['businessHours.endTime'] as any});
      if(Object.keys(failure.fields).length)focusConfig(failure.fields);
      else requestAnimationFrame(()=>{saveFeedback.current?.focus({preventScroll:true});saveFeedback.current?.scrollIntoView({block:'nearest'});});
    }finally{inFlight.current=false;setIsSaving(false);}
  },[formData,savedPolicy,activeCategory,focusConfig]);
  const checkSaveResult=async()=>{
    if(inFlight.current||!isPolicyTopic(activeCategory))return;const topic=activeCategory,submitted=formData;inFlight.current=true;setIsSaving(true);setCheckingResult(true);
    try{const saved=await readSavedPolicy();if(policyEqual(topicPatch(saved,topic),topicPatch(submitted,topic))){setPolicyDraft(state=>reconcilePolicyDraft(state.draft,state.base,saved,{topic,submitted}));setSaveError(null);setSaveSuccess(true);}else setSaveError(new PolicySaveError('policy_topic_unknown',{},saved));}
    catch(error){setSaveError(error instanceof PolicySaveError?error:new PolicySaveError('policy_topic_unknown'));}
    finally{inFlight.current=false;setIsSaving(false);setCheckingResult(false);}
  };
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    void submitPolicy();
  };
  const handleReset=useCallback(async()=>{
    if(inFlight.current||!isPolicyTopic(activeCategory))return;
    if(!window.confirm(['Restore and save defaults for this topic only? Other topic drafts and existing task deadlines stay unchanged.','Pulihkan dan simpan standar hanya untuk topik ini? Draf topik lain dan tenggat tugas tetap.','仅恢复并保存当前主题的默认值？其他主题草稿及已有任务截止时间保持不变。'][languageIndex]))return;
    const reset={...formData,...topicPatch(DEFAULT_CRM_POLICY_CONFIG,activeCategory)};setFormData(reset);setIsResetting(true);try{await submitPolicy(reset);}finally{setIsResetting(false);}
  },[activeCategory,formData,languageIndex,submitPolicy]);
  const discard=useCallback(()=>{
    if(!isPolicyTopic(activeCategory))return;
    setFormData(current=>({...current,...topicPatch(savedPolicy,activeCategory)}));setSaveError(null);setServerTimeErrors({});setShowTimeErrors(false);setSaveSuccess(false);
  },[activeCategory,savedPolicy,setFormData]);
  useEffect(()=>{setSaveError(null);setSaveSuccess(false);setShowTimeErrors(false);},[activeCategory]);
  useEffect(() => {
    onActionControlsChange?.({
      isDirty: modifiedFieldsCount > 0,
      modifiedCount: modifiedFieldsCount,
      isSaving,
      isResetting,
      saveSuccess,
      save: () => submitPolicy(),
      reset: handleReset,
      discard,
    });
  }, [modifiedFieldsCount, isSaving, isResetting, saveSuccess, submitPolicy, handleReset, discard, onActionControlsChange]);
  useEffect(() => () => onActionControlsChange?.(null), [onActionControlsChange]);
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
  const ruleExplanation = (
<details className="crm-ops-explanation"><summary>{["Rule explanation and examples","Penjelasan aturan dan contoh","规则解释与示例"][languageIndex]}</summary>      {['schedule','first_response'].includes(activeCategory)&&<p className="crm-ops-note"><strong>{['Illustrative case','Contoh ilustratif','模拟实例'][languageIndex]} · {simulationResult.tierTitle} · {simulationResult.sampleLabel} ({formData.businessHours.timezone}) → {simulationResult.finalDeadline}. {['Uses the existing calendar calculator; no task is created.','Memakai perhitungan kalender yang ada; tidak membuat tugas.','复用现有日历计算，不创建任务。'][languageIndex]}</strong></p>}
      {['schedule','first_response'].includes(activeCategory)&&<>          <div className="flex items-center gap-2">
            {activeCategory !== 'schedule' && <button
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
            </button>}

            {activeCategory !== 'schedule' && <button
              type="button"
              onClick={() => setShowCascadeDiagram(!showCascadeDiagram)}
              className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                showCascadeDiagram
                  ? "admin-policy-accent"
                  : isLight
                    ? "bg-slate-100 text-slate-600 border-slate-200"
                    : "bg-slate-800 text-slate-300 border-slate-700"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>
                {t("Logic Cascade Architecture", "SLA 规则决策链架构图")}
              </span>
            </button>}

            {activeCategory !== 'schedule' && onNavigateTab && (
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
          </div>      {/* 2. Interactive SLA Timeline Simulator (Tool) */}
      {activeCategory !== 'schedule' && showSimulator && (
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
              <AdminField
                className={`block font-semibold text-xs mb-1.5 ${isLight ? "text-slate-700" : "text-slate-300"}`}
              >
                {t("Simulate Lead Intent Tier:", "模拟进线学员等级:")}
              </AdminField>
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
              <AdminField
                className={`block font-semibold text-xs mb-1.5 ${isLight ? "text-slate-700" : "text-slate-300"}`}
              >
                {t("Simulate Ingestion Timestamp:", "模拟客户提交咨询时间点:")}
              </AdminField>
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
      {activeCategory !== 'schedule' && showCascadeDiagram && (
        <div
          className={`p-5 rounded-2xl border transition-all ${isLight ? "bg-white border-slate-200 shadow-xs" : "bg-slate-900 border-slate-800"}`}
        >
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg admin-policy-accent">
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
              className={`p-3 rounded-xl border flex flex-col justify-between admin-policy-accent`}
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

</>}{activeCategory==='schedule'&&<>        {/* 24-Hour Visual Business Hours Ribbon */}
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
              {businessBarInfo ? <>{businessBarInfo.dailyHours} {t("hrs/day", "小时/天")} ·{" "}
              {businessBarInfo.weeklyWorkDays} {t("days/week", "天/周")} (
              {businessBarInfo.weeklyHours} {t("h", "小时")}{" "}
              {t("total", "工时")})</> : policyMessage("policy_calendar_invalid", lang)}
            </span>
          </div>

          {/* Invalid draft hours have no meaningful work-window preview. */}
          {businessBarInfo && <>
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
          </>}
        </div>

</>}<div className="crm-ops-flow" aria-label={['Rule illustration','Ilustrasi aturan','规则图解'][languageIndex]}>{currentSection.steps[languageIndex].map((step,i)=><React.Fragment key={step}>{i>0&&<b aria-hidden="true">→</b>}<span>{step}</span></React.Fragment>)}</div>
      <p className="crm-ops-note">{isNotificationTopic(activeCategory)?['Use the save controls in each notification section.','Gunakan tombol simpan di tiap bagian notifikasi.','通知在各自区域独立保存。'][languageIndex]:['The diagram explains the process. Save applies only to the current topic; existing task deadlines are retained.','Diagram menjelaskan proses. Simpan hanya menerapkan topik saat ini; tenggat tugas lama tetap.','图解说明处理逻辑。保存仅提交当前主题，已有任务截止时间保持不变。'][languageIndex]}</p></details>
  );
  return (
    <div className="crm-ops-workspace-sample" data-theme={isLight?'light':'dark'}><AdminTopicFrame selection={activeCategory} label={["Configuration topics","Topik konfigurasi","配置主题"][languageIndex]} navigation={
      <nav className="crm-ops-nav" aria-label={['Operations topics','Topik operasional','运营主题'][languageIndex]}>
        <details open><summary>{['Configuration topics','Topik konfigurasi','配置主题'][languageIndex]}</summary><div>
        {operationGroups.map((group,i)=><React.Fragment key={i}><h2>{group[languageIndex]}</h2>{operationSections.filter(section=>section.group===i && !['retry','milestone','reactivation'].includes(section.id) && (i!==2 || notificationContent!=null)).map(section=><button key={section.id} type="button" aria-current={section.id===activeCategory?'page':undefined} disabled={isSaving||isResetting} onClick={()=>{setActiveCategory(section.id);setShowSimulator(false);setShowCascadeDiagram(false);}}>{React.createElement(notificationTopicIcons[section.id as keyof typeof notificationTopicIcons] || ({permissions:ShieldCheck,schedule:Clock3,first_response:PhoneCall,retry:PhoneMissed,watchdog:Bell,milestone:CalendarCheck,reactivation:RotateCcw,notifications:Send} as Record<string,typeof Send>)[section.id] || Send,{size:16,"aria-hidden":true})}{section.title[languageIndex]}{sectionDirty(section.id)&&<span aria-label={["Unsaved changes","Perubahan belum disimpan","有未保存修改"][languageIndex]}> ●</span>}{Object.keys({...configErrors,...saveError?.fields}).filter(field=>operationSectionForField(field)===section.id).length>0&&<span aria-label={["Validation errors","Kesalahan validasi","校验错误"][languageIndex]}> !</span>}</button>)}</React.Fragment>)}
        </div></details><small role="status">{modifiedFieldsCount ? ['Unsaved policy changes','Perubahan kebijakan belum disimpan','有未保存的策略修改'][languageIndex] : ['Policies are up to date','Kebijakan sudah tersimpan','策略无未保存修改'][languageIndex]}</small>
      </nav>}>
      <div className="crm-ops-content"><AdminForm lang={lang} noValidate onSubmit={handleSave} className="crm-form-layout w-full mx-auto">
<AdminRequiredNote lang={lang}/>

{isNotificationTopic(activeCategory)?<header className="admin-topic-notification-heading"><p className="crm-ops-note">{operationGroups[currentSection.group][languageIndex]}</p><h2>{currentSection.title[languageIndex]}</h2><p>{currentSection.purpose[languageIndex]}</p></header>:<header className="admin-edit-header" data-theme={isLight?"light":"dark"}><div className="admin-edit-title"><h2>{currentSection.title[languageIndex]}</h2></div>      <div className="crm-ops-actions"><span role="status">{activeModifiedCount} {['unsaved changes','perubahan belum disimpan','项修改尚未保存'][languageIndex]}</span><button type="submit" disabled={isSaving||isResetting||activeModifiedCount===0}>{checkingResult?['Checking…','Memeriksa…','正在核对…'][languageIndex]:isSaving?['Saving…','Menyimpan…','正在保存…'][languageIndex]:['Save','Simpan','保存'][languageIndex]}</button><details><summary>{['More actions','Tindakan lain','更多操作'][languageIndex]}</summary><div className="admin-save-menu"><button type="button" disabled={isSaving||isResetting} onClick={handleReset}>{['Restore topic defaults','Pulihkan standar topik','恢复本主题默认值'][languageIndex]}</button>{activeModifiedCount>0&&<button type="button" disabled={isSaving||isResetting} onClick={discard}>{['Discard topic edits','Buang perubahan topik','放弃本主题修改'][languageIndex]}</button>}      <details className="crm-ops-tools"><summary>{["Global presets and activation","Preset global dan aktivasi","全局预设与生效说明"][languageIndex]}</summary>
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
                <p
                  className={`font-bold text-base md:text-lg ${isLight ? "text-slate-900" : "text-white"}`}
                >
                  {t("Sales Operations Settings", "销售运营设置")}
                </p>
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
              {!calendarValid ? (
                <span>{policyMessage("policy_calendar_invalid", lang)}</span>
              ) : isCurrentlyWorking ? (
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

        {/* Feature Switches Toolbar: Simulator & Cascade Diagram */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
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
                {["Save / Restore topic defaults","Simpan / Pulihkan standar topik","保存 / 恢复本主题默认值"][languageIndex]}
                ：
              </strong>{" "}
              {['Save applies only to this topic. Other topic drafts stay unsaved and are marked in the left navigation. Global presets prepare drafts in several topics; save each separately. Existing task deadlines stay unchanged.','Simpan hanya menerapkan topik ini. Draf topik lain tetap ditandai di navigasi kiri. Preset global menyiapkan beberapa draf; simpan tiap topik terpisah. Tenggat tugas lama tetap.','保存仅提交当前主题；其他主题草稿保留并在左侧标记。全局预设会准备多个主题草稿，须分别保存。已有任务截止时间不变。'][languageIndex]}
            </p>
            <p>
              <strong>{t("Notification settings", "通知配置")}：</strong>{" "}
              {['Notification policies and channels retain their separate save actions. Inactive drafts do not send; enabling applies to new events.','Kebijakan dan kanal notifikasi tetap memakai tindakan simpan terpisah. Draf nonaktif tidak mengirim; aktivasi berlaku pada peristiwa baru.','通知策略和渠道保留各自保存操作；停用草稿不发送，启用仅应用于新事件。'][languageIndex]}
            </p>
            <p
              role="status"
              className={
                modifiedFieldsCount > 0
                  ? "font-medium text-amber-700 dark:text-amber-300"
                  : "text-slate-500 dark:text-slate-400"
              }
            >
              {lang==='zh'?(modifiedFieldsCount?`有 ${modifiedFieldsCount} 项策略修改尚未保存，请逐个打开左侧标记主题并“保存”。`:'没有待保存的策略修改。'):lang==='id'?(modifiedFieldsCount?`Ada ${modifiedFieldsCount} perubahan kebijakan belum disimpan. Buka tiap topik bertanda dan Simpan terpisah.`:'Tidak ada perubahan kebijakan yang belum disimpan.'):(modifiedFieldsCount?`${modifiedFieldsCount} policy changes are unsaved. Open each marked topic and Save separately.`:'No unsaved policy changes.')}
            </p>
          </section>

        </div>
      </div>

      </details>
</div></details></div><div ref={saveFeedback} tabIndex={-1}>{saveError&&<div role="alert"><p>{policyMessage(saveError.code,lang)}</p>{saveError.code==='policy_topic_unknown'&&<button type="button" disabled={isSaving} onClick={()=>void checkSaveResult()}>{['Check save result','Periksa hasil simpan','查询保存结果'][languageIndex]}</button>}{saveError.currentPolicy&&isPolicyTopic(activeCategory)&&<details className="policy-conflict-review"><summary>{['Compare saved values','Bandingkan nilai tersimpan','核对最新已保存值'][languageIndex]}</summary><dl>{topicChangeFields(formData,saveError.currentPolicy,activeCategory).map(field=>{const read=(value:any)=>field.split('.').reduce((node,key)=>node?.[key],value);return <div key={field}><dt>{policyFieldLabel(field,lang)}</dt><dd>{['Saved','Tersimpan','已保存'][languageIndex]}: {displayPolicyValue(read(saveError.currentPolicy))} · {['Your draft','Draf Anda','你的草稿'][languageIndex]}: {displayPolicyValue(read(formData))}</dd></div>;})}</dl><button type="button" onClick={()=>{const latest=saveError.currentPolicy!;setPolicyDraft(state=>({...state,base:{...state.base,...topicPatch(latest,activeCategory as PolicyTopic)}}));setSaveError(null);}}>{['Keep draft after review','Pertahankan draf setelah ditinjau','核对后保留草稿'][languageIndex]}</button></details>}{Object.entries(saveError.fields).map(([field,code])=><button key={field} type="button" onClick={()=>focusConfig({[field]:code})}>{policyFieldLabel(field,lang)}: {policyMessage(code,lang)}</button>)}</div>}{saveSuccess&&<p role="status">{policyMessage('policy_topic_saved',lang)}</p>}</div></header>}      <header className="crm-ops-summary" hidden={isNotificationTopic(activeCategory)}><p className="crm-ops-note">{operationGroups[currentSection.group][languageIndex]}</p><p>{currentSection.purpose[languageIndex]}</p>{ruleSnapshot&&<p><strong>{["Current draft","Draf saat ini","当前草稿"][languageIndex]}: </strong>{ruleSnapshot}</p>}

</header>


      {activeCategory === "permissions" && <CrmFormSection name="permissions" lang={lang}>
        <h2 className="font-semibold text-lg">{lang==='zh'?'核实与归属权限':lang==='id'?'Izin verifikasi dan kepemilikan':'Review and ownership permissions'}</h2>
        {([
          ['identityReviewManagerOnly', ['Lead identity review is restricted to CRM Managers','Verifikasi identitas Lead hanya oleh CRM Manager','Lead身份核实仅限CRM Manager'], ['Enabled by default. If disabled, Sales still need existing read and write access to both records. This does not grant access to other owners’ leads.','Aktif secara standar. Jika nonaktif, Sales tetap memerlukan izin baca dan tulis yang ada atas kedua catatan, tanpa akses tambahan ke pelanggan orang lain.','默认开启。关闭后，Sales仍须拥有双方记录的现有读写权限，不授予他人客户权限。普通Sales无法写入共享池时，仍由Manager核实。']],
          ['ownerAssignmentManagerOnly', ['Lead Owner assignment is restricted to CRM Managers','Penugasan Owner Lead hanya oleh CRM Manager','Lead分配Owner仅限CRM Manager'], ['Disabled by default. When enabled, only CRM Managers with existing permissions may claim or assign a Lead Owner. When disabled, existing claiming and assignment permissions apply. Identity review remains required before claiming; existing owners are unchanged.','Nonaktif secara standar. Jika aktif, hanya CRM Manager dengan izin yang ada dapat mengklaim atau menugaskan Owner Lead. Jika nonaktif, izin klaim dan penugasan yang ada tetap berlaku. Verifikasi identitas tetap wajib sebelum klaim; Owner yang ada tidak berubah.','默认关闭。开启后，仅具备现有权限的CRM Manager可认领或分配Lead的Owner；关闭时沿用原有认领及分配权限。身份待核实仍须先核实才能认领，已有Owner保持不变。']],
          ['sourceAttributionManagerOnly', ['Unverified source attribution review is restricted to CRM Managers','Verifikasi atribusi sumber hanya oleh CRM Manager','待核实来源归因仅限CRM Manager'], ['Enabled by default. Only unknown campaign codes or promotion link issues with saved leads enter Unverified sources. If disabled, staff still need existing campaign-management and relevant lead-access permissions. Original sources and existing attribution are not changed automatically.','Aktif secara standar. Hanya kode kampanye tidak dikenal atau masalah tautan promosi yang sudah menghasilkan Lead masuk ke Sumber belum diverifikasi. Jika nonaktif, staf tetap memerlukan izin pengelolaan kampanye dan akses Lead terkait. Sumber asli dan atribusi yang ada tidak berubah otomatis.','默认开启。未知活动码或异常推广链接仅在产生Lead后进入待核实来源。关闭后，员工仍须具备现有营销活动管理及相关Lead访问权限；不自动授予权限，不自动改写原始来源或既有归因。']],
        ] as const).map(([key,labels,help])=><AdminField key={key} className="flex items-start gap-3" data-policy-field={key}><input type="checkbox" className="mt-1 accent-teal-700" checked={formData[key]} onChange={e=>setFormData(v=>({...v,[key]:e.target.checked}))}/><span><strong className="block">{labels[lang==='zh'?2:lang==='id'?1:0]}</strong><span className="block text-sm opacity-75 mt-1">{help[lang==='zh'?2:lang==='id'?1:0]}</span></span></AdminField>)}
        <p className="text-sm opacity-75">{lang==='zh'?'使用本主题“保存”后生效；仅配置管理员可修改，变更记录审计，不完成任务或重放通知。':lang==='id'?'Berlaku setelah Simpan topik ini; hanya pengelola konfigurasi dapat mengubah. Perubahan diaudit, tanpa menyelesaikan tugas atau mengirim ulang notifikasi.':'Use Save in this topic to apply. Configuration managers only; changes are audited without completing tasks or replaying notifications.'}</p>
      </CrmFormSection>}
      {/* 5. Main Configuration Grid (Clean Layout) */}
      <div className="crm-form-layout">
        {/* CARD 1: Business Hours & Operational Timezone */}
        {(activeCategory === "schedule") && (
          <CrmFormSection name="schedule" lang={lang} description={<>
                  {t(
                    "Defines compliant outreach windows to prevent disturbing Indonesian parents at night.",
                    "确定销售顾问合规外呼的时间范围，防止夜间骚扰印尼学员与家长。",
                  )}
                </>}>


            <div className="space-y-4">
              {/* Timezone */}
              <div data-policy-field="businessHours.timezone">
                <AdminField required htmlFor="policy-timezone"
                  className={`block font-semibold text-xs mb-1 ${isLight ? "text-slate-800" : "text-slate-200"}`}
                >
                  {t("Operating Timezone", "运营时区")}
                </AdminField>
                <p
                  className={`text-[11px] mb-1.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}
                >
                  {t(
                    "Timezone for the business clock, SLA deadlines and new lead-number dates. Existing lead numbers stay unchanged.",
                    "用于业务时钟、SLA截止时间和新线索业务编号的日期。已生成的业务编号保持不变。",
                  )}
                </p>
                <CrmSelect required controlId="policy-timezone" label={t("Operating Timezone", "运营时区")} value={formData.businessHours.timezone} onChange={(value) =>
                    setFormData({
                      ...formData,
                      businessHours: {
                        ...formData.businessHours,
                        timezone: value,
                      },
                    })} lang={lang} isLight={isLight}>
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
                </CrmSelect>
              </div>

              {/* Start and End Hours */}
              <div className="grid grid-cols-2 gap-3" data-admin-grid="">
                <AdminField as="div">
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
                    id="crm-work-startTime"
                    ref={startInput}
                    aria-label={t("Daily Start Time", "每日开始工作时间")}
                    aria-invalid={!!fieldErrors.startTime}
                    aria-describedby={fieldErrors.startTime ? "crm-work-startTime-error" : undefined}
                    style={{ scrollMarginTop: "12rem", ...(fieldErrors.startTime ? { borderColor: "#dc2626" } : {}) }}
                    type="time" required
                    value={formData.businessHours.startTime}
                    onChange={(e) => {
                      setSaveError(null);
                      setSaveSuccess(false);
                      setServerTimeErrors({});
                      setShowTimeErrors(true);
                      setFormData({
                        ...formData,
                        businessHours: {
                          ...formData.businessHours,
                          startTime: e.target.value,
                        },
                      });
                    }}
                    className={`w-full max-w-[140px] h-8 text-xs rounded-lg px-2.5 border outline-none font-semibold font-mono ${isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-slate-950 border-slate-800 text-slate-200"}`}
                  />
                  {fieldErrors.startTime && <p id="crm-work-startTime-error" className={`mt-1 text-sm ${isLight ? "text-red-700" : "text-red-300"}`}>{policyMessage(fieldErrors.startTime, lang)}</p>}
                </AdminField>

                <AdminField as="div">
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
                    id="crm-work-endTime"
                    ref={endInput}
                    aria-label={t("Daily End Time", "每日停止外呼时间")}
                    aria-invalid={!!fieldErrors.endTime}
                    aria-describedby={fieldErrors.endTime ? "crm-work-endTime-error" : undefined}
                    style={{ scrollMarginTop: "12rem", ...(fieldErrors.endTime ? { borderColor: "#dc2626" } : {}) }}
                    type="time" required
                    value={formData.businessHours.endTime}
                    onChange={(e) => {
                      setSaveError(null);
                      setSaveSuccess(false);
                      setServerTimeErrors({});
                      setShowTimeErrors(true);
                      setFormData({
                        ...formData,
                        businessHours: {
                          ...formData.businessHours,
                          endTime: e.target.value,
                        },
                      });
                    }}
                    className={`w-full max-w-[140px] h-8 text-xs rounded-lg px-2.5 border outline-none font-semibold font-mono ${isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-slate-950 border-slate-800 text-slate-200"}`}
                  />
                  {fieldErrors.endTime && <p id="crm-work-endTime-error" className={`mt-1 text-sm ${isLight ? "text-red-700" : "text-red-300"}`}>{policyMessage(fieldErrors.endTime, lang)}</p>}
                </AdminField>
              </div>

              {/* Workdays */}
              <div data-policy-field="businessHours.workDays">
                <AdminField
                  className={`block font-semibold text-xs mb-1 ${isLight ? "text-slate-800" : "text-slate-200"}`}
                >
                  {t("Active Workdays", "团队每周工作日")}
                </AdminField>
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
          </CrmFormSection>
        )}

        {/* CARD 2: First Response SLA (FRT) */}
        {(activeCategory === "first_response") && (
          <CrmFormSection name="response" lang={lang} description={<>
                  {t(
                    "Mandatory maximum timeframe for consultants to initiate first contact based on lead Tier.",
                    "依据意向评级设定不同的首次破冰倒计时窗口，支持自由选择分钟/小时/天。",
                  )}
                </>}>


            <div className="space-y-3.5">
              <DurationField
                isLight={isLight}
                lang={lang}
                titleEn="Tier 1 (Hot) First Response SLA"
                titleZh="等级 1 (高意向) 首访响应时限"
                descEn="High-priority response deadline. Advisor follow-up, booking and enrollment requests use this duration regardless of lead tier."
                descZh="高优先级响应时限。申请顾问跟进、预约及报名均使用此时限，不受原客户等级限制。"
                fieldPath="firstResponseSla.hot"
                error={configErrors["firstResponseSla.hot"] || saveError?.fields["firstResponseSla.hot"]}
                duration={formData.firstResponseSla.hot}
                originalDuration={savedPolicy.firstResponseSla.hot}
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
                fieldPath="firstResponseSla.warm"
                error={configErrors["firstResponseSla.warm"] || saveError?.fields["firstResponseSla.warm"]}
                duration={formData.firstResponseSla.warm}
                originalDuration={savedPolicy.firstResponseSla.warm}
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
                fieldPath="firstResponseSla.cold"
                error={configErrors["firstResponseSla.cold"] || saveError?.fields["firstResponseSla.cold"]}
                duration={formData.firstResponseSla.cold}
                originalDuration={savedPolicy.firstResponseSla.cold}
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
          </CrmFormSection>
        )}

        {/* CARD 3: No-Response & Call Retry Policy */}
        {(activeCategory === "retry") && (
          <div
            className={`p-5 rounded-2xl border transition-all ${isLight ? "bg-white border-slate-200/90 shadow-xs" : "bg-slate-900 border-slate-800"}`}
          >
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="p-1 rounded-md admin-policy-accent">
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
                descEn="Natural-time gap between real attempts; also used for the final reply window. A next eligible time outside working hours moves to the next opening."
                descZh="真实尝试之间按自然时长计间隔，最后回复窗口使用相同时长；非工作时段的下次有效时间顺延至下次上班。"
                fieldPath="noResponseCadence.retryInterval"
                error={configErrors["noResponseCadence.retryInterval"] || saveError?.fields["noResponseCadence.retryInterval"]}
                duration={formData.noResponseCadence.retryInterval}
                originalDuration={savedPolicy.noResponseCadence.retryInterval}
                recommendedText={t("Default: 4 Hours", "默认: 4 小时")}
                accentColor="admin-policy-value"
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
                  savedPolicy.noResponseCadence.maxRetriesBeforeNurture
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
                    <AdminField
                      className={`block font-semibold text-xs ${isLight ? "text-slate-800" : "text-slate-200"}`}
                    >
                      {t(
                        "Consecutive unanswered threshold",
                        "连续未回复阈值",
                      )}
                    </AdminField>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {t("Consecutive unanswered threshold", "包含首次有效尝试")}
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
                    "Includes the first valid attempt. Retry spacing and a final reply window apply. Zero disables automatic nurture. New sequences snapshot these settings; existing tasks and confirmed groups stay unchanged.",
                    "包含首次有效尝试；须满足重试间隔及最后回复窗口。0关闭自动转培育。新序列保存配置快照，已有任务及人工确认分组不变。",
                  )}
                </p>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-800/60">
                  <input
                    type="number"
                    min="0"
                    data-policy-field="noResponseCadence.maxRetriesBeforeNurture"
                    aria-label={t("Consecutive unanswered threshold", "连续未回复阈值")}
                    aria-invalid={!!configErrors["noResponseCadence.maxRetriesBeforeNurture"]}
                    value={Number.isFinite(formData.noResponseCadence.maxRetriesBeforeNurture) ? formData.noResponseCadence.maxRetriesBeforeNurture : ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        noResponseCadence: {
                          ...formData.noResponseCadence,
                          maxRetriesBeforeNurture:
                            e.target.value === "" ? NaN : Number(e.target.value),
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
        {(activeCategory === "watchdog") && (
          <CrmFormSection name="watchdog" lang={lang} description={<>
                  {t(
                    "Alerts sales reps when an active lead has no scheduled follow-up and exceeds silence threshold.",
                    "当下线索已联系过、但未设定具体下次时间时，超过此阈值即报警提示回访。",
                  )}
                </>}>


            <div className="space-y-3.5">
              <DurationField
                isLight={isLight}
                lang={lang}
                titleEn="Hot Lead Inactivity Alert"
                titleZh="高意向学员防停滞报警阈值"
                descEn="Alert if no follow-up occurs within this duration for Hot leads."
                descZh="高意向客户初访后若未排定下次具体时间，超过该时限未有新跟进则亮起停滞预警。"
                fieldPath="inactivityWatchdog.hotInactivity"
                error={configErrors["inactivityWatchdog.hotInactivity"] || saveError?.fields["inactivityWatchdog.hotInactivity"]}
                duration={formData.inactivityWatchdog.hotInactivity}
                originalDuration={savedPolicy.inactivityWatchdog.hotInactivity}
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
                fieldPath="inactivityWatchdog.warmInactivity"
                error={configErrors["inactivityWatchdog.warmInactivity"] || saveError?.fields["inactivityWatchdog.warmInactivity"]}
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
                fieldPath="inactivityWatchdog.coldInactivity"
                error={configErrors["inactivityWatchdog.coldInactivity"] || saveError?.fields["inactivityWatchdog.coldInactivity"]}
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
          </CrmFormSection>
        )}

        {/* CARD 5: Milestone Cadence & Offsets */}
        {(activeCategory === "milestone") && (
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
                fieldPath="milestones.trialReminderBefore"
                error={configErrors["milestones.trialReminderBefore"] || saveError?.fields["milestones.trialReminderBefore"]}
                duration={formData.milestones.trialReminderBefore}
                originalDuration={savedPolicy.milestones.trialReminderBefore}
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
                fieldPath="milestones.trialFollowUpAfter"
                error={configErrors["milestones.trialFollowUpAfter"] || saveError?.fields["milestones.trialFollowUpAfter"]}
                duration={formData.milestones.trialFollowUpAfter}
                originalDuration={savedPolicy.milestones.trialFollowUpAfter}
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
                fieldPath="milestones.assessmentFollowUpAfter"
                error={configErrors["milestones.assessmentFollowUpAfter"] || saveError?.fields["milestones.assessmentFollowUpAfter"]}
                duration={formData.milestones.assessmentFollowUpAfter}
                originalDuration={
                  savedPolicy.milestones.assessmentFollowUpAfter
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
        {(activeCategory === "reactivation") && (
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
                fieldPath="reactivation.reactivatedResponse"
                error={configErrors["reactivation.reactivatedResponse"] || saveError?.fields["reactivation.reactivatedResponse"]}
                duration={formData.reactivation.reactivatedResponse}
                originalDuration={savedPolicy.reactivation.reactivatedResponse}
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
    {!isNotificationTopic(activeCategory)&&ruleExplanation}</AdminForm><div hidden={!isNotificationTopic(activeCategory)}>{typeof notificationContent==='function'?notificationContent(isNotificationTopic(activeCategory)?activeCategory:'notification-rules',isNotificationTopic(activeCategory)):notificationContent}</div>{isNotificationTopic(activeCategory)&&ruleExplanation}</div></AdminTopicFrame></div>
  );
};
