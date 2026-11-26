export const enrollmentTimeZone='Asia/Jakarta';

const locales = {zh:'zh-CN',en:'en-GB',id:'id-ID'};
const options = {
  day: {month:'long',day:'numeric'},
  shortDay: {month:'short',day:'numeric'},
  shortDayWithYear: {year:'numeric',month:'short',day:'numeric'},
  time: {hour:'2-digit',minute:'2-digit',hourCycle:'h23'},
  dateTime: {dateStyle:'medium',timeStyle:'short'},
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

const dateFormats = new Map<string, Intl.DateTimeFormat>();

export function enrollmentDateFormatter(language:keyof typeof locales, format:keyof typeof options) {
  const key = `${language}:${format}`;
  let formatter = dateFormats.get(key);
  if (!formatter) {
    const locale = format==='dateTime' && language!=='zh' ? language : locales[language];
    formatter = new Intl.DateTimeFormat(locale,{...options[format],timeZone:enrollmentTimeZone});
    dateFormats.set(key,formatter);
  }
  return formatter;
}
