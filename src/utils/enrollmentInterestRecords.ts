export const demandLevels = ['HSK 1','HSK 2','HSK 3','HSK 4','unsure','other'] as const;
export const demandPeriods = ['weekday-day','weekday-evening','weekend','mixed','any','other'] as const;
export const demandFormats = ['standard','small','one-on-one','any','other'] as const;

export interface DemandCriteria {
  level: typeof demandLevels[number];
  period: typeof demandPeriods[number];
  format: typeof demandFormats[number];
  notes: string;
  phone: string;
}
export type PrivateLessonRegistration = {
  templateId:string; learnerName:string; learnerKey:string;
  lessons:number; minutes:number; total:number;
  confirmation?:{firstLessonAt:string;teacher:string;schedule:string};
};

type MatchedClass = {id:string;level:string;firstLesson:string};
const waitlistStates = ['waiting','converted','withdrawn','closed'] as const;
export type WaitlistState = typeof waitlistStates[number];
type WaitlistItem = MatchedClass & {
  classId:string; learnerName?:string|null; orderId?:string|null;
  state:WaitlistState; available?:boolean; updatedAt?:string|null;
};
export type DemandItem = {
  id:string; revision:number; state:'active'|'withdrawn'; criteria:DemandCriteria;
  matches:MatchedClass[]; updatedAt?:string|null;
  appointment?:Omit<PrivateLessonRegistration,'learnerKey'>;
};
export type Interests = {waitlist:WaitlistItem[];demands:DemandItem[]};

export function parseEnrollmentInterests(data:unknown):Interests {
  const interests = data as Partial<Interests> | null | undefined;
  const isClass = (row:MatchedClass | null) => typeof row?.id==='string' &&
    typeof row.level==='string' && typeof row.firstLesson==='string';
  const optionalString = (value:unknown) => value==null || typeof value==='string';
  const validAppointment = (row:DemandItem) => {
    const item=row.appointment;
    return item===undefined||!!item&&row.criteria.format==='one-on-one'&&typeof item.templateId==='string'&&typeof item.learnerName==='string'&&
      Number.isSafeInteger(item.lessons)&&item.lessons>0&&Number.isSafeInteger(item.minutes)&&item.minutes>0&&Number.isSafeInteger(item.total)&&item.total>0&&
      (item.confirmation===undefined||!!item.confirmation&&typeof item.confirmation.firstLessonAt==='string'&&Number.isFinite(Date.parse(item.confirmation.firstLessonAt))&&
        typeof item.confirmation.teacher==='string'&&typeof item.confirmation.schedule==='string');
  };
  if (!Array.isArray(interests?.waitlist) || interests.waitlist.some(row =>
    !isClass(row) || typeof row.classId!=='string' || !waitlistStates.includes(row.state) ||
    (row.available!==undefined && typeof row.available!=='boolean') ||
    !optionalString(row.orderId) || !optionalString(row.learnerName) || !optionalString(row.updatedAt)
  ) || !Array.isArray(interests.demands) || interests.demands.some(row =>
    typeof row?.id!=='string' || !['active','withdrawn'].includes(row.state) || !Number.isInteger(row.revision) ||
    !optionalString(row.updatedAt) || !row.criteria || !demandLevels.includes(row.criteria.level) ||
    !demandPeriods.includes(row.criteria.period) || !demandFormats.includes(row.criteria.format) ||
    typeof row.criteria.notes!=='string' || typeof row.criteria.phone!=='string' ||
    !Array.isArray(row.matches) || row.matches.some(match=>!isClass(match)) || !validAppointment(row)
  )) throw Error('Invalid enrollment interests');
  return {waitlist:interests.waitlist,demands:interests.demands};
}
