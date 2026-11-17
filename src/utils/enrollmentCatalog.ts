export const enrollmentLevels = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4A', 'HSK 4B'] as const;
export const enrollmentOpportunityLevels:readonly string[]=[...enrollmentLevels,'HSK 4'].sort();
export const enrollmentFormats = ['standard', 'small'] as const;
export const enrollmentPeriods = ['weekday-evening', 'weekend'] as const;

export interface EnrollmentClassConfig {
  courseId: string;
  courseName?: string;
  templateId?: string;
  templateRevision?: number;
  teacherType?: 'local'|'foreign';
  level: typeof enrollmentLevels[number];
  format: typeof enrollmentFormats[number];
  /** Legacy key for the time slot, such as weekend. */
  period: typeof enrollmentPeriods[number];
  firstLesson: string;
  enrollmentCloses: string;
  decisionAt: string;
  schedule: string;
  weeklySchedule?: EnrollmentWeeklySchedule;
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
}

export interface EnrollmentClassAdmin extends EnrollmentClassConfig {
  id: string;
  revision: number;
  state: 'draft' | 'published' | 'cancelled';
  opened?: boolean;
  canInsert?: boolean;
}

function enrollmentOpeningDayStart(firstLesson: string) {
  return enrollmentInstant(firstLesson) && enrollmentInstant(firstLesson.slice(0, 10) + 'T00:00');
}

export function isEnrollmentInsertionWindow(cohort: Pick<EnrollmentClassConfig, 'firstLesson'>, now = Date.now()) {
  const startsOn = enrollmentOpeningDayStart(cohort.firstLesson);
  return startsOn !== null && now >= startsOn.valueOf();
}

export type PublicEnrollmentClass = Omit<EnrollmentClassAdmin,
  'courseId' | 'templateId' | 'templateRevision' | 'revision' | 'state' | 'minimumPaid' | 'capacity' | 'enrollmentCloses'> & { opened?: boolean; availability?: 'full' | 'limited' | 'available' };

export function enrollmentInstant(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value + ':00+07:00');
  if (!Number.isFinite(date.valueOf())) return null;
  const jakarta = new Date(date.valueOf() + 7 * 3600000).toISOString().slice(0, 16);
  return jakarta === value ? date : null;
}

export function enrollmentScheduleDefaults(firstLesson:string) {
  if(!enrollmentInstant(firstLesson))return null;
  const date=firstLesson.slice(0,10);
  const decisionDay=new Date(Date.parse(date+'T00:00:00Z')-2*86_400_000).toISOString().slice(0,10);
  return {enrollmentCloses:date+'T00:00',decisionAt:decisionDay+'T17:00'};
}

export function enrollmentOpeningNotice(
  decisionAt:string|undefined,language:'zh'|'en'|'id',now=Date.now(),
) {
  const decision=enrollmentInstant(decisionAt);
  if(!decision)return '';
  if(now>=decision.valueOf())return {zh:'开班结果待确认',en:'Class opening still to be confirmed',id:'Pembukaan kelas masih menunggu konfirmasi'}[language];
  const date=new Intl.DateTimeFormat({zh:'zh-CN',en:'en-GB',id:'id-ID'}[language],{
    month:'long',day:'numeric',timeZone:'Asia/Jakarta',
  }).format(decision);
  return {zh:`预计 ${date} 通知开班结果`,en:`Opening update expected ${date}`,id:`Kabar pembukaan diperkirakan ${date}`}[language];
}

export function publicEnrollmentClass(record: EnrollmentClassAdmin): PublicEnrollmentClass {
  const { id, level, courseName, format, period, firstLesson, decisionAt, schedule, weeklySchedule, sessions, minutes, teacherType, price,
    standardPrice, learningOutcomes, material, resources, teacher } = record;
  return { id, level, courseName, format, period, firstLesson, decisionAt, schedule, weeklySchedule, sessions, minutes, teacherType, price,
    standardPrice, learningOutcomes, material, resources, teacher };
}

function invalidConfig(): never {
  throw Object.assign(Error('enrollment_class_invalid'), { status: 400 });
}

export function validateEnrollmentClass(raw: Record<string, unknown> | null | undefined, unpublishedTemplate = false): EnrollmentClassConfig {
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
  const decisionAt = string('decisionAt', 16);
  const start = enrollmentInstant(firstLesson);
  const startOfOpeningDay = enrollmentOpeningDayStart(firstLesson);
  const closes = enrollmentInstant(enrollmentCloses);
  const decision = enrollmentInstant(decisionAt);
  const capacity = integer('capacity', 200);
  const minimumPaid = integer('minimumPaid', capacity);
  const price = unpublishedTemplate && input.price === 0 ? 0 : integer('price', 1_000_000_000);
  const standardPrice = input.standardPrice == null ? null : integer('standardPrice', 1_000_000_000);
  if (!start || !startOfOpeningDay || !closes || !decision || closes > startOfOpeningDay ||
      decision > start || (standardPrice !== null && standardPrice <= price)) {
    invalidConfig();
  }
  if (input.weeklySchedule) {
    const plan=input.weeklySchedule as EnrollmentWeeklySchedule;
    if (!enrollmentWeeklyScheduleText(plan, Number(input.minutes))) invalidConfig();
    if (!enrollmentFirstSessionMatches(firstLesson,plan))
      throw Object.assign(Error('enrollment_class_schedule_mismatch'),{status:400});
  }
  return {
    courseId,
    level: option('level', enrollmentLevels),
    format: option('format', enrollmentFormats),
    period: option('period', enrollmentPeriods),
    firstLesson, enrollmentCloses, decisionAt,
    schedule: string('schedule', 300), sessions: integer('sessions', 1000), minutes: integer('minutes', 600),
    minimumPaid, capacity, price, standardPrice,
    learningOutcomes: input.templateId && input.learningOutcomes === '' ? '' : string('learningOutcomes', 2500), material: string('material', 2500),
    resources: input.templateId && input.resources === '' ? '' : string('resources', 2500),
    teacher: string('teacher', 2500, { optional: true }),
  };
}

/** lessons stores the number of periods per scheduled session. */
export type EnrollmentWeeklySchedule={days:number[];start:string;lessons:number};
/** firstLesson is stored as a local WIB date and time. Weekdays use Monday=1. */
export function enrollmentFirstSessionMatches(firstLesson:string,plan:EnrollmentWeeklySchedule) {
  if (!enrollmentInstant(firstLesson)) return false;
  const weekday=new Date(firstLesson.slice(0,10)+'T00:00:00Z').getUTCDay()||7;
  return plan.days.includes(weekday)&&firstLesson.slice(11)===plan.start;
}
export const enrollmentWeekdays=[
  ['周一','Mon','Sen'],['周二','Tue','Sel'],['周三','Wed','Rab'],['周四','Thu','Kam'],
  ['周五','Fri','Jum'],['周六','Sat','Sab'],['周日','Sun','Min'],
] as const;

/** In local Jakarta time, with Monday as day 1. */
export function enrollmentWeeklyScheduleText(plan:EnrollmentWeeklySchedule|undefined,minutesPerPeriod:number,lang:'zh'|'en'|'id'='zh'){
  if(!plan||!Array.isArray(plan.days)||!plan.days.length||plan.days.some(day=>!Number.isInteger(day)||day<1||day>7)||
    typeof plan.start!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(plan.start)||!Number.isInteger(plan.lessons)||plan.lessons<1||plan.lessons>24)return '';
  const [h,m]=plan.start.split(':').map(Number);
  const periodsPerSession=plan.lessons;
  const end=h*60+m+periodsPerSession*minutesPerPeriod;
  if(!Number.isInteger(end)||end>=1440)return '';
  const endTime=[Math.floor(end/60),end%60].map(x=>String(x).padStart(2,'0')).join(':');
  const index=lang==='zh'?0:lang==='en'?1:2;
  const days=[...new Set(plan.days)].sort((a,b)=>a-b).map(day=>lang==='zh'?enrollmentWeekdays[day-1][index].slice(1):enrollmentWeekdays[day-1][index]).join(lang==='zh'?'、':', ');
  return (lang==='zh'?'每周':'')+days+' '+plan.start+'–'+endTime+' WIB';
}
