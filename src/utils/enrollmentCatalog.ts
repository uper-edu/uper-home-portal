export const enrollmentLevels = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 4A', 'HSK 4B'] as const;
export const enrollmentOpportunityLevels:readonly string[]=enrollmentLevels;
export const enrollmentFormats = ['standard', 'small'] as const;
export const enrollmentPeriods = ['weekday-evening', 'weekend'] as const;

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
  firstLesson: string;
  enrollmentCloses: string;
  decisionAt: string;
  schedule: string;
  weeklySchedule?: EnrollmentWeeklySchedule;
  holidayDates?: string[];
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
  canDelete?: boolean;
}

function enrollmentOpeningDayStart(firstLesson: string) {
  return enrollmentInstant(firstLesson) && enrollmentInstant(firstLesson.slice(0, 10) + 'T00:00');
}

export function isEnrollmentInsertionWindow(cohort: Pick<EnrollmentClassConfig, 'firstLesson'>, now = Date.now()) {
  const startsOn = enrollmentOpeningDayStart(cohort.firstLesson);
  return startsOn !== null && now >= startsOn.valueOf();
}

export type PublicEnrollmentClass = Omit<EnrollmentClassAdmin,
  'courseId' | 'templateId' | 'templateRevision' | 'revision' | 'state' | 'minimumPaid' | 'capacity' | 'enrollmentCloses' | 'canDelete' | 'holidayDates'> & { opened?: boolean; availability?: 'full' | 'limited' | 'available' };

export function validEnrollmentHolidayDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) > 0 && enrollmentInstant(value + 'T00:00') !== null;
}

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
  const { id, level, courseName, batchNumber, format, period, firstLesson, decisionAt, schedule, weeklySchedule, sessions, minutes, teacherType, price,
    standardPrice, learningOutcomes, material, resources, teacher } = record;
  return { id, level, courseName, batchNumber, format, period, firstLesson, decisionAt, schedule, weeklySchedule, sessions, minutes, teacherType, price,
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
  const period = option('period', enrollmentPeriods);
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
    if (!enrollmentTimeSlotMatches(period,plan.days))
      throw Object.assign(Error('enrollment_class_timeslot_mismatch'),{status:400});
    if (!enrollmentFirstSessionMatches(firstLesson,plan))
      throw Object.assign(Error('enrollment_class_schedule_mismatch'),{status:400});
  }
  return {
    courseId,
    level: option('level', enrollmentLevels),
    format: option('format', enrollmentFormats),
    period,
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
/** Only the weekday category is checked; no evening-hour cutoff is implied. */
export function enrollmentTimeSlotMatches(period:string,days:readonly number[]) {
  const allowed=period==='weekend'?[6,7]:period==='weekday-evening'?[1,2,3,4,5]:[];
  return days.length>0&&days.every(day=>allowed.includes(day));
}
/** firstLesson is stored as a local WIB date and time. Weekdays use Monday=1. */
export function enrollmentFirstSessionMatches(firstLesson:string,plan:EnrollmentWeeklySchedule) {
  if (!enrollmentInstant(firstLesson)) return false;
  return plan.days.includes(enrollmentDateWeekday(firstLesson))&&firstLesson.slice(11)===plan.start;
}
const enrollmentDateWeekday=(value:string)=>new Date(value.slice(0,10)+'T00:00:00Z').getUTCDay()||7;
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

/** One title contract for the catalog, CRM, applications and order details. */
export type EnrollmentClassIdentity = {level?:string;format?:string;period?:string;batchNumber?:number};
export function enrollmentClassTitle(row:EnrollmentClassIdentity,language:'zh'|'en'|'id') {
  const labels={
    zh:{standard:'标准班',small:'小班',weekend:'周末班','weekday-evening':'工作日晚班'},
    en:{standard:'Standard Class',small:'Small Group',weekend:'Weekend','weekday-evening':'Weekday Evening'},
    id:{standard:'Kelas Standar',small:'Kelas Kecil',weekend:'Akhir Pekan','weekday-evening':'Malam Hari Kerja'},
  }[language] as Record<string,string>;
  const batch=row.batchNumber&&Number.isSafeInteger(row.batchNumber)&&row.batchNumber>0
    ? {zh:`第 ${row.batchNumber} 期`,en:`Batch ${row.batchNumber}`,id:`Angkatan ${row.batchNumber}`}[language]:'';
  return [row.level,row.format&&labels[row.format],row.period&&labels[row.period],batch].filter(Boolean).join(' · ');
}
export function enrollmentTeacherLabel(type:'local'|'foreign'|undefined,language:'zh'|'en'|'id') {
  if(!type)return '';
  return {zh:{local:'本土教师',foreign:'外教'},en:{local:'Indonesian Teacher',foreign:'Foreign Teacher'},id:{local:'Pengajar Lokal',foreign:'Pengajar Asing'}}[language][type];
}

/** Seed empty recurring fields from the first session without replacing an existing schedule. */
export function enrollmentAutofillStart<T extends {firstLesson:string;weeklySchedule?:EnrollmentWeeklySchedule;minutes:number; schedule:string}>(config:T,firstLesson:string):T {
  const next={...config,firstLesson};
  const weekly=config.weeklySchedule;
  if(enrollmentInstant(firstLesson)&&(!weekly?.days.length||!weekly.start)){
    next.weeklySchedule={
      days:weekly?.days.length?weekly.days:[enrollmentDateWeekday(firstLesson)],
      start:weekly?.start||firstLesson.slice(11),
      lessons:weekly?.lessons??1,
    };
    next.schedule=enrollmentWeeklyScheduleText(next.weeklySchedule,config.minutes);
  }
  return next;
}
export function enrollmentScheduleErrors(config:Partial<Omit<EnrollmentClassConfig,'period'>> & {period?:string},language:'zh'|'en'|'id') {
  const errors:Record<string,string>={};
  const t=(zh:string,en:string,id:string)=>({zh,en,id})[language];
  const plan=config.weeklySchedule??{days:[],start:'',lessons:1};
  const first=enrollmentInstant(config.firstLesson),decision=enrollmentInstant(config.decisionAt),closes=enrollmentInstant(config.enrollmentCloses);
  if(!config.period)errors.period=t('请选择时段。','Select a time slot.','Pilih waktu kelas.');
  if(!first)errors.firstLesson=t('请填写完整的首次上课日期和时间。','Enter the full first session date and time.','Isi tanggal dan waktu pertemuan pertama.');
  if(!decision)errors.decisionAt=t('请填写预计通知开班结果的日期和时间。','Enter the expected decision date and time.','Isi tanggal dan waktu perkiraan keputusan.');
  else if(first&&decision>first)errors.decisionAt=t('通知时间不能晚于首次上课时间。','The decision cannot be later than the first session.','Waktu keputusan tidak boleh setelah pertemuan pertama.');
  if(!closes)errors.enrollmentCloses=t('请填写自助报名截止日期和时间。','Enter the self-service enrollment deadline.','Isi batas waktu pendaftaran mandiri.');
  else if(first&&closes>enrollmentInstant(config.firstLesson!.slice(0,10)+'T00:00')!)errors.enrollmentCloses=t('自助报名最晚须在开课当天 00:00 截止。','Self-service enrollment must close by 00:00 on the first session day.','Pendaftaran mandiri harus ditutup paling lambat pukul 00.00 pada hari pertama kelas.');
  if(config.templateId||plan){
    if(!plan?.days.length)errors.days=t('请至少选择一个每周上课日。','Select at least one weekly class day.','Pilih minimal satu hari kelas setiap minggu.');
    else if(config.period&&!enrollmentTimeSlotMatches(config.period,plan.days))errors.days=config.period==='weekend'
      ?t('周末班只能选择周六、周日。','Weekend classes must use Saturday or Sunday.','Kelas akhir pekan harus pada Sabtu atau Minggu.')
      :t('工作日晚班只能选择周一至周五。','Weekday evening classes must use Monday to Friday.','Kelas malam hari kerja harus pada Senin hingga Jumat.');
    else if(first&&!plan.days.includes(enrollmentDateWeekday(config.firstLesson!))){
      const weekday=enrollmentWeekdays[enrollmentDateWeekday(config.firstLesson!)-1];
      errors.days=t(`首次上课是${weekday[0]}，但每周上课日未包含这一天。`,`The first session is on ${weekday[1]}, which is missing from the weekly class days.`,`Pertemuan pertama jatuh pada ${weekday[2]}, yang belum tercantum dalam jadwal mingguan.`);
    }
    if(!plan?.start)errors.start=t('请填写每次开始时间。','Enter the session start time.','Isi waktu mulai setiap pertemuan.');
    else if(first&&plan.start!==config.firstLesson!.slice(11))errors.start=t(`每次开始时间为 ${plan.start}，须与首次上课的 ${config.firstLesson!.slice(11)} 一致。`,`Session start time ${plan.start} must match the first session at ${config.firstLesson!.slice(11)}.`,`Waktu mulai ${plan.start} harus sama dengan pertemuan pertama pukul ${config.firstLesson!.slice(11)}.`);
    if(!Number.isInteger(plan?.lessons)||!plan||plan.lessons<1||plan.lessons>24)errors.lessons=t('每次上课节数须为 1–24 的整数。','Periods per session must be an integer from 1 to 24.','Jumlah jam pelajaran per pertemuan harus bilangan bulat 1–24.');
    if(plan?.start&&plan.days.length&&!errors.lessons&&!enrollmentWeeklyScheduleText(plan,config.minutes??45))errors.start=t('请检查开始时间和节数，上课结束时间须早于次日 00:00。','Check the start time and periods: the session must end before midnight.','Periksa waktu mulai dan jumlah jam pelajaran: kelas harus selesai sebelum tengah malam.');
  }
  return errors;
}
