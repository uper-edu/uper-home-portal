import {
  enrollmentIntroductionFields,
  enrollmentIntroductionStages,
  type EnrollmentCourseIntroduction,
  type EnrollmentIntroductionContent,
  type EnrollmentIntroductionField,
  type EnrollmentIntroductionStage,
} from '../../src/utils/enrollmentCourseIntroduction.ts';
import {enrollmentLevels} from '../../src/utils/enrollmentCatalog.ts';
import {enrollmentGuideText, type EnrollmentGuideLanguage} from '../../src/utils/enrollmentGuidance.ts';
import {readPublicEnrollmentClasses} from './enrollmentCatalog.ts';

export const chatCourseContentInstruction = `
When the learner asks about UPER course content, add a top-level courseContent object:
{"scope":"level","levels":["HSK 2"],"fields":["audience","outcomes","topics","practice"]}.
Use just the fields that answer the question: audience for suitable learners or prerequisites, outcomes for abilities after the course, topics for the syllabus, textbook, or vocabulary and scenarios taught, and practice for class activities or resources such as recordings or mock questions. For a broad course overview, include all four. Use the level(s) relevant to this question, including short follow-ups, corrections, and comparisons. Use "HSK 4A" or "HSK 4B" for a specific part; "HSK 4" covers both. Don't treat a level mentioned for comparison as a change in the learner's class criteria. If you cannot infer the level, return levels:[] so the server can ask which level.
For a question about the course taught in a specific class already shown or opened, use {"scope":"class","referenceIds":["known class ID"],"fields":[...]}. Only use class IDs supplied as page or recommendation context. The open class can be referenced without an ID; otherwise resolve the reference or ask the learner to clarify in reply. Don't reuse a different learner's classes after a subject change.
The server inserts authoritative course information for the requested fields in the response language. Leave UPER-specific course claims out of reply. You can add brief practical advice in reply when useful. For course content alone use catalogue:null and enrollment:null. If the learner also asks about a real class, schedule, price, or enrollment action, return that separately via enrollment; don't request legacy materials or outcomes there when already covered by courseContent. Never promise outcomes or infer a practice resource. Omit courseContent for unrelated questions or general HSK exam facts.
`;

type CourseLevel = typeof enrollmentLevels[number];
type CourseTarget = {label:string; level:CourseLevel; stage?:EnrollmentIntroductionStage};
type CourseContentRequest = {fields:EnrollmentIntroductionField[]} & (
  {scope:'class'; referenceIds:string[]} | {scope:'level'; levels:string[]}
);
type CourseContentRow = {level:CourseLevel; introduction?:EnrollmentCourseIntroduction};
type QueryClient = Parameters<typeof readPublicEnrollmentClasses>[0];

export function normalizeChatCourseContent(value:unknown):CourseContentRequest|undefined {
  if(!value||typeof value!=='object')return;
  const {scope,fields,levels,referenceIds}=value as Record<string,unknown>;
  if(!Array.isArray(fields))return;
  const selected=enrollmentIntroductionFields.filter(field=>fields.includes(field));
  if(!selected.length)return;
  if(scope==='class')return {scope,fields:selected,referenceIds:strings(referenceIds,/^[a-zA-Z0-9-]{1,64}$/,4)};
  if(scope==='level')return {scope,fields:selected,levels:strings(levels,/^HSK [1-9][AB]?$/,6)};
}

function strings(values:unknown,pattern:RegExp,limit:number) {
  return Array.isArray(values)?[...new Set(values.filter((value):value is string=>typeof value==='string'&&pattern.test(value)))].slice(0,limit):[];
}

function courseTarget(label:string):CourseTarget|undefined {
  const level=enrollmentLevels.find(value=>value===label||
    value==='HSK 4'&&enrollmentIntroductionStages.some(stage=>label===`HSK ${stage}`));
  if(level)return {label,level,stage:enrollmentIntroductionStages.find(stage=>label===`HSK ${stage}`)};
}

function plainMarkdown(value:string) {
  return value.replace(/[\\`*_{}\[\]<>#!|~]/g,'\\$&');
}

function formatCourseContent(target:CourseTarget,row:CourseContentRow,fields:EnrollmentIntroductionField[],lang:EnrollmentGuideLanguage) {
  const t=(zh:string,en:string,id:string)=>enrollmentGuideText(lang,zh,en,id);
  const labels={
    audience:t('适合谁','Who it’s for','Cocok untuk siapa'),
    outcomes:t('学完能做什么','What you’ll learn to do','Kemampuan yang akan dilatih'),
    topics:t('课程学什么','What you’ll study','Materi yang dipelajari'),
    practice:t('怎么学、怎么练','How you’ll practise','Cara belajar dan berlatih'),
  };
  const render=(part:EnrollmentIntroductionContent|undefined)=>fields.flatMap(field=>{
    const lines=part?.[field]?.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    if(!lines?.length)return [];
    const content=lines.length===1?plainMarkdown(lines[0]):lines.map(line=>'- '+plainMarkdown(line)).join('\n');
    return [`#### ${labels[field]}\n\n${content}`];
  });
  const translation=row.introduction?.[lang];
  if(target.stage){
    const stage=translation?.stages?.[target.stage];
    if(!stage)return [];
    const practice=[stage.practice,translation.practice].filter(Boolean).join('\n');
    return render({...translation,...stage,practice});
  }
  return [...render(translation),...enrollmentIntroductionStages.flatMap(stage=>{
    const sections=render(translation?.stages?.[stage]);
    return sections.length?[`### HSK ${stage}`,...sections]:[];
  })];
}

export async function chatCourseContentReply(c:QueryClient,request:CourseContentRequest,lang:EnrollmentGuideLanguage,{
  allowedClassIds=[],openedClassId,
}: {allowedClassIds?:readonly string[];openedClassId?:string}={}) {
  const t=(zh:string,en:string,id:string)=>enrollmentGuideText(lang,zh,en,id);
  const missing=t('这部分课程介绍目前没有可核实的资料。','This part of the course overview is currently unavailable.',
    'Bagian pengantar kursus ini belum tersedia.');
  if(request.scope==='class'){
    const refs=request.referenceIds.length?request.referenceIds:openedClassId?[openedClassId]:[];
    if(!refs.length)return t('你想了解哪个班次？','Which class would you like to know about?','Kelas mana yang ingin Anda ketahui?');
    const ids=refs.filter(id=>id===openedClassId||allowedClassIds.includes(id));
    const rows=ids.length?await readPublicEnrollmentClasses(c,{classIds:ids,includeAvailability:false}):[];
    const parts=ids.flatMap(id=>{
      const row=rows.find(row=>row.id===id);
      if(!row)return [];
      const target=courseTarget(row.level);
      if(!target)return [];
      const body=formatCourseContent(target,{level:target.level,introduction:row.introduction},request.fields,lang);
      return [{label:target.label,body}];
    });
    const unique=[...new Set(parts.map(({label,body})=>[`### ${label}`,...(body.length?body:[missing])].join('\n\n')))];
    return [...unique,...(rows.length<refs.length?[t('有班次目前无法核实。','Some class details could not be verified.',
      'Detail beberapa kelas belum dapat diverifikasi.')]:[])].join('\n\n')||missing;
  }
  if(!request.levels.length)return t('你想了解哪个 HSK 级别的课程？','Which HSK level would you like to know about?',
    'Anda ingin tahu tentang kursus HSK level berapa?');
  const levels=[...new Set(request.levels.map(label=>courseTarget(label)?.level).filter(Boolean))];
  const rows=levels.length?(await c.query(`
    SELECT value->>'$.teaching.level' AS level, JSON_EXTRACT(value,'$.teaching.introduction') AS introduction
    FROM crm_courses
    WHERE JSON_EXTRACT(value,'$.active')=true AND value->>'$.teaching.level' IN (:p1)
  `,[levels])).rows as CourseContentRow[]:[];
  return request.levels.map(label=>{
    const target=courseTarget(label);
    const matches=target?rows.filter(row=>row.level===target.level):[];
    const body=target&&matches.length===1?formatCourseContent(target,matches[0],request.fields,lang):[];
    return [`### ${label}`,...(body.length?body:[missing])].join('\n\n');
  }).join('\n\n');
}
