import {enrollmentClassZoneOffsets} from '../../src/utils/enrollmentDateFormat.ts';

// The alias is supplied by the query source. Both supported zones have fixed offsets for these schedules.
function classOffset(alias:string){
  return `(CASE ${alias}data->>'$.timeZone' WHEN 'Africa/Lagos' THEN ${enrollmentClassZoneOffsets['Africa/Lagos']} ELSE ${enrollmentClassZoneOffsets['Asia/Jakarta']} END)`;
}

export function classFirstLessonLocal(alias=''){
  return `TIMESTAMPADD(HOUR,${classOffset(alias)},${alias}first_lesson_at)`;
}

export function classOpeningMidnight(alias=''){
  return `TIMESTAMPADD(HOUR,-${classOffset(alias)},DATE(${classFirstLessonLocal(alias)}))`;
}
