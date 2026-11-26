import {enrollmentTimeZone, enrollmentTimeZoneLabel, enrollmentWallClockInstant, isEnrollmentClassTimeZone, type EnrollmentClassTimeZone} from './enrollmentDateFormat';
import type {EnrollmentCourseIntroduction} from './enrollmentCourseIntroduction';

export const enrollmentLevels = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 4A', 'HSK 4B'] as const;
export const enrollmentOpportunityLevels:readonly string[]=enrollmentLevels;
export const enrollmentFormats = ['standard', 'small'] as const;
export const enrollmentPeriods = ['weekday-evening', 'weekend', 'mixed'] as const;
export const enrollmentClassLookupLimit = 40;

export const enrollmentScheduleReviewFields = ['firstLesson', 'days', 'start', 'holidayDates'] as const;
export type EnrollmentScheduleReviewField = typeof enrollmentScheduleReviewFields[number];

export interface EnrollmentClassConfig {
  courseId: string;
  courseName?: string;
  templateId?: string;
  templateRevision?: number;
  /** Assigned by the server on first publication; never reused. */
  batchNumber?: number;
  teacherType?: 'local'|'foreign';
  level: typeof enrollmentLevels[number];
  format: typeof enrollmentFormats[number];
  /** Legacy key for the time slot, such as weekend. */
  period: typeof enrollmentPeriods[number];
  timeZone?: EnrollmentClassTimeZone;
  firstLesson: string;
  enrollmentCloses: string;
  /** Legacy value retained when editing existing records. */
  decisionAt?: string;
  schedule: string;
  weeklySchedule?: EnrollmentWeeklySchedule;
  holidayDates?: string[];
  scheduleReview?: Partial<Record<EnrollmentScheduleReviewField, string>>;
  /** Legacy key for the total number of billable periods. */
  sessions: number;
  minutes: number;
  minimumPaid: number;
  capacity: number;
  price: number;
  standardPrice: number | null;
  learningOutcomes: string;
  material: string;
  resources: string;
  teacher: string;
  teacherId?: string;
}

export interface EnrollmentClassAdmin extends EnrollmentClassConfig {
  id: string;
  revision: number;
  state: 'draft' | 'published' | 'cancelled';
  opened?: boolean;
  canInsert?: boolean;
  canDelete?: boolean;
  hasOrders?: boolean;
}

function enrollmentOpeningDayStart(firstLesson: string,timeZone?:EnrollmentClassTimeZone) {
  return enrollmentInstant(firstLesson,timeZone) && enrollmentInstant(firstLesson.slice(0, 10) + 'T00:00',timeZone);
}

export function isEnrollmentInsertionWindow(cohort: Pick<EnrollmentClassConfig, 'firstLesson'|'timeZone'>, now = Date.now()) {
  const startsOn = enrollmentOpeningDayStart(cohort.firstLesson,cohort.timeZone);
  return startsOn !== null && now >= startsOn.valueOf();
}

export type PublicEnrollmentClass = Omit<EnrollmentClassAdmin,
  'courseId' | 'templateId' | 'templateRevision' | 'revision' | 'state' | 'minimumPaid' | 'capacity' | 'enrollmentCloses' | 'decisionAt' | 'canDelete' | 'hasOrders' | 'holidayDates' | 'scheduleReview'> & {
    introduction?: EnrollmentCourseIntroduction;
    opened?: boolean; availability?: 'full' | 'limited' | 'available';
    classSize?: {maximum:number; usualMinimum?:number};
  };

export function enrollmentClassSizeText(size:PublicEnrollmentClass['classSize'],lang:'zh'|'en'|'id'){
  if(!size)return '';
  const {maximum,usualMinimum}=size;
  const range=usualMinimum&&usualMinimum<maximum?`${usualMinimum}–${maximum}`:'';
  return range
    ? {zh:`${range} 人`,en:`${range} learners`,id:`${range} siswa`}[lang]
    : {zh:`最多 ${maximum} 人`,en:`Up to ${maximum} learners`,id:`Maksimal ${maximum} siswa`}[lang];
}

export function validEnrollmentHolidayDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) > 0 && enrollmentInstant(value + 'T00:00') !== null;
}

export const enrollmentInstant=enrollmentWallClockInstant;

export function enrollmentScheduleDefaults(firstLesson:string) {
  if(!enrollmentInstant(firstLesson))return null;
  const date=firstLesson.slice(0,10);
  return {enrollmentCloses:date+'T00:00'};
}

export function publicEnrollmentClass(record: EnrollmentClassAdmin): PublicEnrollmentClass {
  const { id, level, courseName, batchNumber, format, period, timeZone, firstLesson, schedule, weeklySchedule, sessions, minutes, teacherType, price,
    standardPrice, learningOutcomes, material, resources, teacher } = record;
  const maximum=record.capacity;
  // The advertised range describes group size. It is independent of the opening threshold.
  const usualMinimum=format==='standard'&&maximum===15?10:format==='small'&&maximum===6?4:undefined;
  const classSize=Number.isSafeInteger(maximum)&&maximum>0?{maximum,usualMinimum}:undefined;
  return { id, level, courseName, batchNumber, format, period, timeZone, firstLesson, schedule, weeklySchedule, sessions, minutes, teacherType, price, classSize,
    standardPrice, learningOutcomes, material, resources, teacher };
}

function invalidConfig(): never {
  throw Object.assign(Error('enrollment_class_invalid'), { status: 400 });
}

export function validateEnrollmentClass(raw: Record<string, unknown> | null | undefined, draft = false): EnrollmentClassConfig {
  if (!raw) invalidConfig();
  const input = raw as Record<string, unknown>;
  const string = (key: string, max: number, { optional = false } = {}) => {
    const value = input[key];
    if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) invalidConfig();
    return value.trim();
  };
  const integer = (key: string, upper: number) => {
    const value = input[key];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > upper) invalidConfig();
    return value as number;
  };
  const option = <T extends string>(key: string, values: readonly T[]) => {
    const value = input[key] as T;
    if (!values.includes(value)) invalidConfig();
    return value;
  };
  const courseId = string('courseId', 100);
  const firstLesson = string('firstLesson', 16);
  const enrollmentCloses = string('enrollmentCloses', 16);
  const timeZone=input.timeZone===undefined?enrollmentTimeZone:input.timeZone;
  if(!isEnrollmentClassTimeZone(timeZone))invalidConfig();
  const start = enrollmentInstant(firstLesson,timeZone);
  const startOfOpeningDay = enrollmentOpeningDayStart(firstLesson,timeZone);
  const closes = enrollmentInstant(enrollmentCloses,timeZone);
  const capacity = integer('capacity', 200);
  const period = option('period', enrollmentPeriods);
  const minimumPaid = integer('minimumPaid', capacity);
  const price = draft && input.price === 0 ? 0 : integer('price', 1_000_000_000);
  const standardPrice = input.standardPrice == null ? null : integer('standardPrice', 1_000_000_000);
  if (!start || !startOfOpeningDay || !closes || (!draft && closes > startOfOpeningDay) || (standardPrice !== null && standardPrice <= price)) {
    invalidConfig();
  }
  if (input.weeklySchedule) {
    const plan=input.weeklySchedule as EnrollmentWeeklySchedule;
    if (!Array.isArray(plan.days) || plan.days.length > 7 ||
      plan.days.some(day=>!Number.isInteger(day)||day<1||day>7) ||
      typeof plan.start!=='string'||(plan.start!==''&&!enrollmentSessionTime.test(plan.start)) ||
      !Number.isInteger(plan.lessons)||plan.lessons<1||plan.lessons>24 ||
      (plan.startByDay!==undefined && (!plan.startByDay||typeof plan.startByDay!=='object'||Array.isArray(plan.startByDay)||
        Object.entries(plan.startByDay).some(([day,time])=>!plan.days.includes(Number(day))||String(Number(day))!==day||
          typeof time!=='string'||(time!==''&&!enrollmentSessionTime.test(time)))))) invalidConfig();
    if (!draft) {
      if (!enrollmentWeeklyScheduleText(plan, Number(input.minutes))) invalidConfig();
      if (!enrollmentTimeSlotMatches(period,plan.days))
        throw Object.assign(Error('enrollment_class_timeslot_mismatch'),{status:400});
      if (!enrollmentFirstSessionMatches(firstLesson,plan))
        throw Object.assign(Error('enrollment_class_schedule_mismatch'),{status:400});
    }
  }
  return {
    courseId,
    level: option('level', enrollmentLevels),
    format: option('format', enrollmentFormats),
    period,
    timeZone, firstLesson, enrollmentCloses,
    schedule: string('schedule', 300, {optional:draft}), sessions: integer('sessions', 1000), minutes: integer('minutes', 600),
    minimumPaid, capacity, price, standardPrice,
    learningOutcomes: input.templateId&&input.learningOutcomes===undefined?'':string('learningOutcomes',2500,{optional:!!input.templateId}),
    material: input.templateId&&input.material===undefined?'':string('material',2500,{optional:!!input.templateId}),
    resources: input.templateId&&input.resources===undefined?'':string('resources',2500,{optional:!!input.templateId}),
    teacher: string('teacher', 2500, { optional: true }),
  };
}

/** lessons stores the number of periods per scheduled session. */
export type EnrollmentWeeklySchedule={days:number[];start:string;lessons:number;startByDay?:Partial<Record<number,string>>};
export function enrollmentSessionStart(plan:EnrollmentWeeklySchedule,day:number) {
  return plan.startByDay ? plan.startByDay[day]??'' : plan.start;
}
/** Only the weekday category is checked; no evening-hour cutoff is implied. */
export function enrollmentTimeSlotMatches(period:string,days:readonly number[]) {
  if(period==='mixed')return days.some(day=>day>=1&&day<=5)&&days.some(day=>day===6||day===7);
  const allowed=period==='weekend'?[6,7]:period==='weekday-evening'?[1,2,3,4,5]:[];
  return days.length>0&&days.every(day=>allowed.includes(day));
}
/** firstLesson is stored as a date and time in the class calendar. Weekdays use Monday=1. */
export function enrollmentFirstSessionMatches(firstLesson:string,plan:EnrollmentWeeklySchedule) {
  if (!enrollmentInstant(firstLesson)) return false;
  return plan.days.includes(enrollmentDateWeekday(firstLesson))&&firstLesson.slice(11)===enrollmentSessionStart(plan,enrollmentDateWeekday(firstLesson));
}
const enrollmentDateWeekday=(value:string)=>new Date(value.slice(0,10)+'T00:00:00Z').getUTCDay()||7;
export const enrollmentWeekdays=[
  ['周一','Mon','Sen'],['周二','Tue','Sel'],['周三','Wed','Rab'],['周四','Thu','Kam'],
  ['周五','Fri','Jum'],['周六','Sat','Sab'],['周日','Sun','Min'],
] as const;

const enrollmentSessionTime=/^([01]\d|2[0-3]):[0-5]\d$/;

/** Display-ready day and time groups in Jakarta time, with Monday as day 1. */
export function enrollmentWeeklyScheduleGroups(plan:EnrollmentWeeklySchedule|undefined,minutesPerPeriod:number,lang:'zh'|'en'|'id'='zh'){
  if(!plan||!Array.isArray(plan.days)||!plan.days.length||plan.days.some(day=>!Number.isInteger(day)||day<1||day>7)||
    !Number.isInteger(plan.lessons)||plan.lessons<1||plan.lessons>24)return [];
  const index=lang==='zh'?0:lang==='en'?1:2;
  const groups=new Map<string,string[]>();
  for(const day of [...new Set(plan.days)].sort((a,b)=>a-b)){
    const start=enrollmentSessionStart(plan,day);
    if(typeof start!=='string'||!enrollmentSessionTime.test(start))return [];
    const [h,m]=start.split(':').map(Number);
    const end=h*60+m+plan.lessons*minutesPerPeriod;
    if(!Number.isInteger(end)||end>=1440)return [];
    const endTime=[Math.floor(end/60),end%60].map(x=>String(x).padStart(2,'0')).join(':');
    const range=start+'–'+endTime;
    const label=enrollmentWeekdays[day-1][index];
    const names=groups.get(range)??[];
    names.push(lang==='zh'&&!plan.startByDay?label.slice(1):label);
    groups.set(range,names);
  }
  return [...groups].map(([time,names],i)=>({
    days:(lang==='zh'&&i===0?(plan.startByDay?'每':'每周'):'')+names.join(lang==='zh'?'、':', '),time,
  }));
}

export function enrollmentWeeklyScheduleText(plan:EnrollmentWeeklySchedule|undefined,minutesPerPeriod:number,lang:'zh'|'en'|'id'='zh',timeZone?:EnrollmentClassTimeZone){
  const groups=enrollmentWeeklyScheduleGroups(plan,minutesPerPeriod,lang);
  return groups.length?groups.map(({days,time})=>days+' '+time).join(lang==='zh'?'；':' / ')+' '+enrollmentTimeZoneLabel(timeZone):'';
}

export function enrollmentScheduleLabel(row:Partial<Pick<PublicEnrollmentClass,'weeklySchedule'|'minutes'|'schedule'|'timeZone'>>|undefined,language:'zh'|'en'|'id') {
  if (!row) return '';
  const localized = row.minutes === undefined ? '' : enrollmentWeeklyScheduleText(row.weeklySchedule,row.minutes,language,row.timeZone);
  return localized || row.schedule || '';
}

/** One title contract for the catalog, CRM, applications and order details. */
export type EnrollmentClassIdentity = {level?:string;format?:string;period?:string;batchNumber?:number};
export function enrollmentClassTitle(row:EnrollmentClassIdentity,language:'zh'|'en'|'id') {
  const labels={
    zh:{standard:'标准班',small:'小班',weekend:'周末班','weekday-evening':'工作日晚班',mixed:'工作日与周末'},
    en:{standard:'Standard Class',small:'Small Group',weekend:'Weekend','weekday-evening':'Weekday Evening',mixed:'Weekday & Weekend'},
    id:{standard:'Kelas Standar',small:'Kelas Kecil',weekend:'Akhir Pekan','weekday-evening':'Malam Hari Kerja',mixed:'Hari Kerja & Akhir Pekan'},
  }[language] as Record<string,string>;
  const batch=row.batchNumber&&Number.isSafeInteger(row.batchNumber)&&row.batchNumber>0
    ? {zh:`第 ${row.batchNumber} 期`,en:`Batch ${row.batchNumber}`,id:`Angkatan ${row.batchNumber}`}[language]:'';
  return [row.level,row.format&&labels[row.format],row.period&&labels[row.period],batch].filter(Boolean).join(' · ');
}
export function enrollmentTeacherLabel(type:'local'|'foreign'|undefined,language:'zh'|'en'|'id') {
  if(!type)return '';
  return {zh:{local:'本土教师',foreign:'中国外教'},en:{local:'Indonesian Teacher',foreign:'Teacher from China'},id:{local:'Pengajar Lokal',foreign:'Pengajar dari Tiongkok'}}[language][type];
}

export function enrollmentPrivateLessonTitle(level:string,language:'zh'|'en'|'id') {
  return enrollmentCopy(language,[
    `${level.replace(/^HSK (?=\d)/,'HSK')} · 一对一 · 定制时间`,
    `${level} · One-to-one · Custom schedule`,
    `${level} · Kelas privat · Jadwal fleksibel`,
  ]);
}

export function enrollmentFixedLessonDuration(lessons:number,minutes:number,language:'zh'|'en'|'id') {
  return enrollmentCopy(language,[
    `${lessons} 节 · 每节 ${minutes} 分钟`,
    `${lessons} lessons · ${minutes} min each`,
    `${lessons} sesi · ${minutes} menit per sesi`,
  ]);
}

/** Seed empty recurring fields from the first session without replacing an existing schedule. */
export function enrollmentAutofillStart<T extends {firstLesson:string;weeklySchedule?:EnrollmentWeeklySchedule;minutes:number; schedule:string;timeZone?:EnrollmentClassTimeZone}>(config:T,firstLesson:string):T {
  const next={...config,firstLesson};
  const weekly=config.weeklySchedule;
  if(enrollmentInstant(firstLesson)&&!weekly?.startByDay&&(!weekly?.days.length||!weekly.start)){
    next.weeklySchedule={
      days:weekly?.days.length?weekly.days:[enrollmentDateWeekday(firstLesson)],
      start:weekly?.start||firstLesson.slice(11),
      lessons:weekly?.lessons??1,
    };
    next.schedule=enrollmentWeeklyScheduleText(next.weeklySchedule,config.minutes,'zh',config.timeZone);
  }
  return next;
}
export function enrollmentScheduleErrors(config:Partial<Omit<EnrollmentClassConfig,'period'>> & {period?:string},language:'zh'|'en'|'id') {
  const errors:Record<string,string>={};
  const t=(zh:string,en:string,id:string)=>({zh,en,id})[language];
  const plan=config.weeklySchedule??{days:[],start:'',lessons:1};
  const first=enrollmentInstant(config.firstLesson,config.timeZone),closes=enrollmentInstant(config.enrollmentCloses,config.timeZone);
  if(!config.period)errors.period=t('请选择时段。','Select a time slot.','Pilih waktu kelas.');
  if(!first)errors.firstLesson=t('请填写完整的首次上课日期和时间。','Enter the full first session date and time.','Isi tanggal dan waktu pertemuan pertama.');
  if(!closes)errors.enrollmentCloses=t('请填写自助报名截止日期和时间。','Enter the self-service enrollment deadline.','Isi batas waktu pendaftaran mandiri.');
  else if(first&&closes>enrollmentOpeningDayStart(config.firstLesson!,config.timeZone)!)errors.enrollmentCloses=t('自助报名最晚须在开课当天 00:00 截止。','Self-service enrollment must close by 00:00 on the first session day.','Pendaftaran mandiri harus ditutup paling lambat pukul 00.00 pada hari pertama kelas.');
  if(config.templateId||plan){
    if(!plan?.days.length)errors.days=t('请至少选择一个每周上课日。','Select at least one weekly class day.','Pilih minimal satu hari kelas setiap minggu.');
    else if(config.period&&!enrollmentTimeSlotMatches(config.period,plan.days))errors.days=config.period==='mixed'
      ?t('工作日与周末班须同时选择工作日和周末的上课日。','Select at least one weekday and one weekend day.','Pilih minimal satu hari kerja dan satu hari akhir pekan.')
      :config.period==='weekend'
      ?t('周末班只能选择周六、周日。','Weekend classes must use Saturday or Sunday.','Kelas akhir pekan harus pada Sabtu atau Minggu.')
      :t('工作日晚班只能选择周一至周五。','Weekday evening classes must use Monday to Friday.','Kelas malam hari kerja harus pada Senin hingga Jumat.');
    else if(first&&!plan.days.includes(enrollmentDateWeekday(config.firstLesson!))){
      const weekday=enrollmentWeekdays[enrollmentDateWeekday(config.firstLesson!)-1];
      errors.days=t(`首次上课是${weekday[0]}，但每周上课日未包含这一天。`,`The first session is on ${weekday[1]}, which is missing from the weekly class days.`,`Pertemuan pertama jatuh pada ${weekday[2]}, yang belum tercantum dalam jadwal mingguan.`);
    }
    const firstDay=first?enrollmentDateWeekday(config.firstLesson!):0;
    const firstDayStart=enrollmentSessionStart(plan,firstDay);
    if(plan.startByDay?plan.days.some(day=>!enrollmentSessionStart(plan,day)):!plan.start)
      errors.start=t('请填写每个上课日的开始时间。','Enter a start time for each class day.','Isi waktu mulai untuk setiap hari kelas.');
    else if(first&&plan.days.includes(firstDay)&&firstDayStart!==config.firstLesson!.slice(11))
      errors.start=t(`当天课表为 ${firstDayStart}，须与首次上课的 ${config.firstLesson!.slice(11)} 一致。`,`The scheduled time ${firstDayStart} must match the first session at ${config.firstLesson!.slice(11)}.`,`Jadwal pukul ${firstDayStart} harus sama dengan pertemuan pertama pukul ${config.firstLesson!.slice(11)}.`);
    if(!Number.isInteger(plan?.lessons)||!plan||plan.lessons<1||plan.lessons>24)errors.lessons=t('每次上课节数须为 1–24 的整数。','Periods per session must be an integer from 1 to 24.','Jumlah jam pelajaran per pertemuan harus bilangan bulat 1–24.');
    if(!errors.start&&plan.days.length&&!errors.lessons&&!enrollmentWeeklyScheduleText(plan,config.minutes??45))errors.start=t('请检查开始时间和节数，上课结束时间须早于次日 00:00。','Check the start time and periods: the session must end before midnight.','Periksa waktu mulai dan jumlah jam pelajaran: kelas harus selesai sebelum tengah malam.');
  }
  return errors;
}

export function enrollmentCopy(language: 'zh' | 'en' | 'id', text: readonly [string, string, string]) {
  return text[language === 'zh' ? 0 : language === 'id' ? 2 : 1];
}
