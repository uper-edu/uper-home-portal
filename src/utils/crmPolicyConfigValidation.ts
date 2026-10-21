import { DEFAULT_CRM_POLICY_CONFIG, type CrmPolicyConfig } from '../types/crmPolicyConfig';
import { workTimeErrors, type PolicyMessage } from './crmPolicyValidation';
export type ConfigErrors = Record<string, PolicyMessage>;
export const durationFields = {
  firstResponseSla: ['hot','warm','cold'],
  noResponseCadence: ['retryInterval'],
  inactivityWatchdog: ['hotInactivity','warmInactivity','coldInactivity'],
  milestones: ['trialReminderBefore','trialFollowUpAfter','assessmentFollowUpAfter'],
  reactivation: ['reactivatedResponse'],
} as const;
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Patch only supplied leaves; arrays replace atomically. Metadata is server owned. */
export function mergePolicyConfig(base: CrmPolicyConfig, patch: unknown): {value: CrmPolicyConfig; errors: ConfigErrors} {
  const errors: ConfigErrors = {};
  const merge = (current: any, supplied: any, shape: any, path: string): any => {
    if (!object(supplied)) { errors[path || 'configuration']='policy_object_invalid'; return current; }
    const result = {...current};
    for (const key of Object.keys(supplied)) {
      if (!path && ['version','updatedAt'].includes(key)) continue;
      const field=path ? path+'.'+key : key;
      if (!Object.hasOwn(shape,key)) { errors[field]='policy_field_unknown'; continue; }
      result[key] = object(shape[key]) ? merge(current?.[key],supplied[key],shape[key],field) : supplied[key];
    }
    return result;
  };
  if (object(patch) && !Object.keys(patch).some(k=>!['version','updatedAt'].includes(k))) errors.configuration='policy_object_invalid';
  const value=merge(base,patch,DEFAULT_CRM_POLICY_CONFIG,'') as CrmPolicyConfig;
  return {value,errors:{...errors,...policyConfigErrors(value)}};
}
export function policyConfigErrors(value: CrmPolicyConfig): ConfigErrors {
  const errors: ConfigErrors={};
  const calendar=value.businessHours;
  for(const [key,code] of Object.entries(workTimeErrors(calendar))) errors['businessHours.'+key]=code;
  if(typeof calendar.timezone!=='string') errors['businessHours.timezone']='policy_timezone_invalid';
  else try { new Intl.DateTimeFormat('en',{timeZone:calendar.timezone}); } catch { errors['businessHours.timezone']='policy_timezone_invalid'; }
  if(!Array.isArray(calendar.workDays)||!calendar.workDays.length||calendar.workDays.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(calendar.workDays).size!==calendar.workDays.length) errors['businessHours.workDays']='policy_days_invalid';
  if(typeof calendar.nextDayGraceTime!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(calendar.nextDayGraceTime)) errors['businessHours.nextDayGraceTime']='policy_clock_invalid';
  for(const [section,fields] of Object.entries(durationFields)) for(const field of fields) {
    const d=(value as any)[section][field];
    if(!object(d)||!['minutes','hours','days'].includes(d.unit)||typeof d.value!=='number'||!Number.isFinite(d.value)||d.value<=0||!Number.isFinite(d.value*({minutes:60000,hours:3600000,days:86400000} as any)[d.unit])) errors[section+'.'+field]='policy_duration_invalid';
  }
  if(!Number.isSafeInteger(value.noResponseCadence.maxRetriesBeforeNurture)||value.noResponseCadence.maxRetriesBeforeNurture<0) errors['noResponseCadence.maxRetriesBeforeNurture']='policy_count_invalid';
  return errors;
}
/** SLA row is authoritative for existing calendar / response settings. */
export function effectivePolicy(configured: any, sla: any): CrmPolicyConfig {
  const result:any={...DEFAULT_CRM_POLICY_CONFIG,...configured};
  for(const key of Object.keys(durationFields)) result[key]={...(DEFAULT_CRM_POLICY_CONFIG as any)[key],...configured?.[key]};
  result.businessHours={timezone:sla.timezone,startTime:sla.start,endTime:sla.end,workDays:sla.days,nextDayGraceTime:sla.nextDayGraceTime||sla.start};
  for(const [name,hours] of Object.entries({hot:sla.hotHours,warm:sla.warmHours,cold:sla.coldHours})) {
    const d=result.firstResponseSla[name];
    const factor=({minutes:1/60,hours:1,days:24} as any)[d?.unit];
    result.firstResponseSla[name]=d&&Number.isFinite(d.value)&&d.value*factor===hours ? d : {value:hours,unit:'hours'};
  }
  return result;
}
export function policySla(current:any, value:CrmPolicyConfig) {
  const hours=(d:any)=>d.value*({minutes:1/60,hours:1,days:24} as any)[d.unit];
  return {...current,timezone:value.businessHours.timezone,start:value.businessHours.startTime,end:value.businessHours.endTime,days:value.businessHours.workDays,nextDayGraceTime:value.businessHours.nextDayGraceTime,hotHours:hours(value.firstResponseSla.hot),warmHours:hours(value.firstResponseSla.warm),coldHours:hours(value.firstResponseSla.cold)};
}
