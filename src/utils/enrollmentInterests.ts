import {validContactPhone} from './contactPhone';

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

export function enrollmentPhone(input: unknown): string | null {
  return typeof input === 'string' && validContactPhone(input) ? input.trim() : null;
}

export function enrollmentInsertionPhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const phone = input.trim();
  const digits = phone.replace(/\D/g,'').length;
  return /^\+?[0-9 ()-]{7,26}$/.test(phone) && digits >= 7 && digits <= 15 ? phone : null;
}

export function parseDemand(input: Record<string,unknown>): DemandCriteria | null {
  const {level,period,format,notes} = input;
  const phone = enrollmentPhone(input.phone);
  const allowed = (values: readonly string[], value: unknown) => typeof value === 'string' && values.includes(value);
  if (!phone || !allowed(demandLevels,level) || !allowed(demandPeriods,period) || !allowed(demandFormats,format) ||
      typeof notes !== 'string' || notes.length > 1000 || ([level,period,format].includes('other') && !notes.trim())) return null;
  return { level: level as DemandCriteria['level'], period: period as DemandCriteria['period'],
    format: format as DemandCriteria['format'], notes: notes.trim(), phone };
}

export function demandMatches(demand: DemandCriteria, cohort: {level:string;period:string;format:string}): boolean {
  if (demand.level === 'unsure' || [demand.level,demand.period,demand.format].includes('other')) return false;
  return (demand.level === cohort.level || (demand.level === 'HSK 4' && ['HSK 4A','HSK 4B'].includes(cohort.level))) &&
    (demand.period === 'any' || demand.period === cohort.period) &&
    (demand.format === 'any' || demand.format === cohort.format);
}
