import type {EnrollmentCourseIntroduction} from './enrollmentCourseIntroduction';
import {enrollmentLevels, type EnrollmentClassConfig} from './enrollmentCatalog';

export type EnrollmentTeaching = {
  level: typeof enrollmentLevels[number];
  material: string;
  knowledge: string;
  learningOutcomes: string;
  resources: string;
  minutes: number;
  introduction?: EnrollmentCourseIntroduction;
};
export type EnrollmentTeachingCourse = {
  id: string;
  name: string;
  active: boolean;
  /** Legacy key for the total number of billable periods. */
  sessions: number;
  teaching?: EnrollmentTeaching;
};
export type EnrollmentTemplate = {
  id: string;
  revision: number;
  name: string;
  courseId: string;
  format: 'standard'|'small'|'one-on-one';
  teacherType: 'local'|'foreign';
  minimumPaid: number;
  capacity: number;
  standardUnitPrice: number|null;
  saleUnitPrice: number|null;
};
export const enrollmentTemplateFormats = ['standard','small','one-on-one'] as const;
export const enrollmentTeacherTypes = ['local','foreign'] as const;

const courseLevelRank = (course?: EnrollmentTeachingCourse) => {
  const index = enrollmentLevels.findIndex(level => level === course?.teaching?.level);
  return index < 0 ? enrollmentLevels.length : index;
};

export function compareEnrollmentTeachingCourses(language:string,sort='level') {
  const collator = new Intl.Collator(language,{numeric:true});
  return (a:EnrollmentTeachingCourse,b:EnrollmentTeachingCourse) => {
    const name = collator.compare(a.name,b.name);
    if (sort==='name-asc'||sort==='name-desc') return (sort==='name-desc'?-name:name)||a.id.localeCompare(b.id);
    return courseLevelRank(a)-courseLevelRank(b)||name||a.id.localeCompare(b.id);
  };
}

export function compareEnrollmentTemplates(courses:readonly EnrollmentTeachingCourse[],language:string,sort='course') {
  const ranks = new Map(courses.map(course=>[course.id,courseLevelRank(course)]));
  const rank = (id:string) => ranks.get(id) ?? enrollmentLevels.length;
  const collator = new Intl.Collator(language,{numeric:true});
  return (a:EnrollmentTemplate,b:EnrollmentTemplate) => {
    const name = collator.compare(a.name,b.name);
    if (sort==='name-asc'||sort==='name-desc') return (sort==='name-desc'?-name:name)||a.id.localeCompare(b.id);
    return rank(a.courseId)-rank(b.courseId)||
      enrollmentTemplateFormats.indexOf(a.format)-enrollmentTemplateFormats.indexOf(b.format)||
      enrollmentTeacherTypes.indexOf(a.teacherType)-enrollmentTeacherTypes.indexOf(b.teacherType)||
      name||a.id.localeCompare(b.id);
  };
}

export const templateSize = {
  standard:{typical:'10–15',minimumPaid:10,capacity:15},
  small:{typical:'4–6',minimumPaid:4,capacity:6},
  'one-on-one':{typical:'1',minimumPaid:1,capacity:1},
} as const;

export function defaultEnrollmentCourseName(teaching: Pick<EnrollmentTeaching,'material'|'minutes'> & {level:string}, sessions: string|number, maxLength = 200) {
  const book = teaching.material.trim();
  if (!book || !teaching.level) return '';
  const duration = Number(sessions) > 0 && teaching.minutes > 0 ? ' · '+sessions+' × '+teaching.minutes+' min' : '';
  const prefix = teaching.level+' · ';
  return prefix+book.slice(0, Math.min(140, maxLength-prefix.length-duration.length))+duration;
}

export function enrollmentTemplateQuote(template: Pick<EnrollmentTemplate,'standardUnitPrice'|'saleUnitPrice'>, totalPeriods: number) {
  const {standardUnitPrice, saleUnitPrice} = template;
  if (!standardUnitPrice || !saleUnitPrice) return null;
  return {price:saleUnitPrice*totalPeriods, standardPrice:standardUnitPrice>saleUnitPrice?standardUnitPrice*totalPeriods:null};
}

export function enrollmentTemplateClassFields(template:EnrollmentTemplate, course:EnrollmentTeachingCourse): Partial<EnrollmentClassConfig>|null {
  if (!course.teaching || template.courseId!==course.id || template.format==='one-on-one') return null;
  const {level, minutes}=course.teaching;
  return {
    templateId:template.id, templateRevision:template.revision, teacherType:template.teacherType,
    courseId:course.id, courseName:course.name, level, format:template.format, sessions:course.sessions, minutes,
    minimumPaid:template.minimumPaid, capacity:template.capacity,
    ...(enrollmentTemplateQuote(template,course.sessions)??{price:0,standardPrice:null}),
  };
}
