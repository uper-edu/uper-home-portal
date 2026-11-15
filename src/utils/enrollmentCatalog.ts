export const enrollmentLevels = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4A', 'HSK 4B'] as const;
export const enrollmentFormats = ['standard', 'small'] as const;
export const enrollmentPeriods = ['weekday-evening', 'weekend'] as const;

export interface EnrollmentClassConfig {
  courseId: string;
  level: typeof enrollmentLevels[number];
  format: typeof enrollmentFormats[number];
  period: typeof enrollmentPeriods[number];
  firstLesson: string;
  enrollmentCloses: string;
  decisionAt: string;
  schedule: string;
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

export function isEnrollmentInsertionWindow(cohort: Pick<EnrollmentClassConfig,'firstLesson'|'enrollmentCloses'>, now = Date.now()) {
  const startsOn = new Date(cohort.firstLesson.slice(0,10)+'T00:00:00+07:00').valueOf();
  const closesAt = enrollmentInstant(cohort.enrollmentCloses);
  return closesAt !== null && now >= closesAt.valueOf() && now >= startsOn;
}

export type PublicEnrollmentClass = Omit<EnrollmentClassAdmin,
  'courseId' | 'revision' | 'state' | 'minimumPaid' | 'capacity' | 'enrollmentCloses'> & { opened?: boolean; availability?: 'full' | 'limited' | 'available' };

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
  const { id, level, format, period, firstLesson, decisionAt, schedule, sessions, minutes, price,
    standardPrice, learningOutcomes, material, resources, teacher } = record;
  return { id, level, format, period, firstLesson, decisionAt, schedule, sessions, minutes, price,
    standardPrice, learningOutcomes, material, resources, teacher };
}

function invalidConfig(): never {
  throw Object.assign(Error('enrollment_class_invalid'), { status: 400 });
}

export function validateEnrollmentClass(raw: Record<string, unknown> | null | undefined): EnrollmentClassConfig {
  if (!raw) invalidConfig();
  const input = raw as Record<string, unknown>;
  const string = (key: string, max: number) => {
    const value = input[key];
    if (typeof value !== 'string' || !value.trim() || value.length > max) invalidConfig();
    return (value as string).trim();
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
  const closes = enrollmentInstant(enrollmentCloses);
  const decision = enrollmentInstant(decisionAt);
  const capacity = integer('capacity', 200);
  const minimumPaid = integer('minimumPaid', capacity);
  const price = integer('price', 1_000_000_000);
  const standardPrice = input.standardPrice == null ? null : integer('standardPrice', 1_000_000_000);
  if (!start || !closes || !decision || closes > start || decision > start || (standardPrice !== null && standardPrice <= price)) {
    invalidConfig();
  }
  return {
    courseId,
    level: option('level', enrollmentLevels),
    format: option('format', enrollmentFormats),
    period: option('period', enrollmentPeriods),
    firstLesson, enrollmentCloses, decisionAt,
    schedule: string('schedule', 300), sessions: integer('sessions', 1000), minutes: integer('minutes', 600),
    minimumPaid, capacity, price, standardPrice,
    learningOutcomes: string('learningOutcomes', 2500), material: string('material', 2500),
    resources: string('resources', 2500), teacher: string('teacher', 2500),
  };
}
