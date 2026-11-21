import {enrollmentFormats, enrollmentPeriods} from './enrollmentCatalog';

export type EnrollmentChatSelection =
  | {kind:'class'; classId:string}
  | {kind:'catalog'; level?:string; period?:string; format?:string};

export function normalizeEnrollmentChatSelection(value: unknown): EnrollmentChatSelection | undefined {
  if (!value || typeof value !== 'object') return;
  const input = value as Record<string, unknown>;
  if (input.kind === 'class' && typeof input.classId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(input.classId))
    return {kind:'class', classId:input.classId};
  if (input.kind !== 'catalog') return;
  const {level, period, format} = input;
  return {
    kind:'catalog',
    ...(typeof level === 'string' && /^[1-4]$/.test(level) && {level}),
    ...(enrollmentPeriods.find(item=>item===period) && {period:period as string}),
    ...([...enrollmentFormats,'one-on-one'].find(item=>item===format) && {format:format as string}),
  };
}
