export const enrollmentTimeZone='Asia/Jakarta';
export const enrollmentClassTimeZones=[enrollmentTimeZone,'Africa/Lagos'] as const;
export type EnrollmentClassTimeZone=typeof enrollmentClassTimeZones[number];

const classZoneLabels={ 'Asia/Jakarta':'WIB', 'Africa/Lagos':'WAT' } as const;
export const enrollmentClassZoneOffsets={ 'Asia/Jakarta':7, 'Africa/Lagos':1 } as const;

export function isEnrollmentClassTimeZone(value:unknown):value is EnrollmentClassTimeZone {
  return enrollmentClassTimeZones.some(zone=>zone===value);
}

export function enrollmentTimeZoneLabel(zone:EnrollmentClassTimeZone=enrollmentTimeZone){
  return classZoneLabels[zone];
}

/** The supported class markets both use fixed offsets for contemporary schedules. */
export function enrollmentWallClockInstant(value:unknown,zone:EnrollmentClassTimeZone=enrollmentTimeZone):Date|null {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return null;
  const wall=new Date(value+':00Z');
  if(!Number.isFinite(wall.valueOf())||wall.toISOString().slice(0,16)!==value)return null;
  return new Date(wall.valueOf()-enrollmentClassZoneOffsets[zone]*3_600_000);
}

const locales = {zh:'zh-CN',en:'en-GB',id:'id-ID'};
const options = {
  day: {month:'long',day:'numeric'},
  shortDay: {month:'short',day:'numeric'},
  shortDayWithYear: {year:'numeric',month:'short',day:'numeric'},
  time: {hour:'2-digit',minute:'2-digit',hourCycle:'h23'},
  dateTime: {dateStyle:'medium',timeStyle:'short'},
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

const dateFormats = new Map<string, Intl.DateTimeFormat>();

export function enrollmentDateFormatter(language:keyof typeof locales, format:keyof typeof options,timeZone=enrollmentTimeZone as string) {
  const key = `${language}:${format}:${timeZone}`;
  let formatter = dateFormats.get(key);
  if (!formatter) {
    const locale = format==='dateTime' && language!=='zh' ? language : locales[language];
    formatter = new Intl.DateTimeFormat(locale,{...options[format],timeZone});
    dateFormats.set(key,formatter);
  }
  return formatter;
}
