import type {EnrollmentGuideAction} from './enrollmentGuidance';

// Follow-up prompts are plain-text learner utterances, never links or actions.
export function chatFollowupPrompts(value:unknown):string[] {
  if (!Array.isArray(value)) return [];
  const prompts = value.filter((item):item is string=>typeof item==='string')
    .map(item=>item.trim())
    .filter(item=>item.length>0&&item.length<=110&&!/[\r\n<>]|https?:|www\./iu.test(item));
  return [...new Set(prompts)].slice(0,3);
}

function isRecord(value:unknown):value is Record<string,unknown> {
  return !!value&&typeof value==='object'&&!Array.isArray(value);
}

// Recommendations are optional. A malformed attachment must never hide a saved reply.
export function readChatEnrollmentGuide(value:unknown):EnrollmentGuideAction|undefined {
  if(!isRecord(value))return;
  const optionalText=(input:unknown)=>input==null||typeof input==='string';
  const optionalNumber=(input:unknown)=>input==null||Number.isFinite(input);
  if(![value.kind,value.classId,value.level,value.period,value.format,value.requestedLevel].every(optionalText) ||
    (value.replyLanguage!=null&&value.replyLanguage!=='zh'&&value.replyLanguage!=='en'&&value.replyLanguage!=='id'))return;
  for (const items of [value.linkOnlyClassIds,value.detailFields]) {
    if(items!=null&&(!Array.isArray(items)||items.some(item=>typeof item!=='string')))return;
  }
  if(value.rows!=null&&(!Array.isArray(value.rows)||value.rows.some(row=>
    !isRecord(row)||typeof row.id!=='string'||!row.id||typeof row.level!=='string'||
    ![row.firstLesson,row.schedule,row.format,row.period,row.teacherType].every(optionalText)||
    ![row.price,row.standardPrice,row.batchNumber,row.sessions,row.minutes].every(optionalNumber)||
    (row.classSize!=null&&(!isRecord(row.classSize)||!Number.isFinite(row.classSize.maximum)||
      !optionalNumber(row.classSize.usualMinimum))))))return;
  if(value.quotes!=null&&(!Array.isArray(value.quotes)||value.quotes.some(quote=>
    !isRecord(quote)||typeof quote.id!=='string')))return;
  return value as EnrollmentGuideAction;
}
