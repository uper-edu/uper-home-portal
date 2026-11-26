import {
  enrollmentAllowsWeekday, enrollmentDateWeekday, enrollmentScheduleDefaults, isEnrollmentSessionTime, validEnrollmentHolidayDate,
  type EnrollmentClassConfig, type EnrollmentWeeklySchedule,
} from './enrollmentCatalog';

export type EnrollmentClassDraftConfig = Omit<EnrollmentClassConfig,'period'> & {period:EnrollmentClassConfig['period']|''};

export const emptyEnrollmentWeek:EnrollmentWeeklySchedule={days:[],start:'',lessons:1};

export function allowedEnrollmentClassDate(period:string,date:string) {
  return validEnrollmentHolidayDate(date)&&enrollmentAllowsWeekday(period,enrollmentDateWeekday(date));
}

function enrollmentDraftDeadlineMode(config:EnrollmentClassDraftConfig) {
  return config.enrollmentClosesMode??(config.enrollmentCloses?'custom':'automatic');
}

export function updateEnrollmentDraftFirst(config:EnrollmentClassDraftConfig,firstLesson:string,autoFirstDay?:number) {
  const date=firstLesson.split('T')[0];
  const firstDay=allowedEnrollmentClassDate(config.period,date)?enrollmentDateWeekday(date):undefined;
  const weekly=config.weeklySchedule??emptyEnrollmentWeek;
  const days=weekly.days.filter(day=>day!==autoFirstDay||day===firstDay);
  const shouldAdd=firstDay!==undefined&&!days.includes(firstDay);
  if(shouldAdd)days.push(firstDay);
  days.sort((a,b)=>a-b);
  const time=firstLesson.split('T')[1]??'';
  const start=isEnrollmentSessionTime(time)?time:'';
  const weeklySchedule={...weekly,days,start,
    startByDay:weekly.startByDay&&Object.fromEntries(days.map(day=>[day,day===firstDay?start:weekly.startByDay?.[day]??start]))};
  const enrollmentClosesMode=enrollmentDraftDeadlineMode(config);
  const enrollmentCloses=enrollmentClosesMode==='custom'?config.enrollmentCloses:
    (firstDay?enrollmentScheduleDefaults(firstLesson)?.enrollmentCloses:undefined)??'';
  return {
    config:{...config,firstLesson,weeklySchedule,enrollmentClosesMode,enrollmentCloses},
    autoFirstDay:shouldAdd||firstDay===autoFirstDay?firstDay:undefined,
  };
}
