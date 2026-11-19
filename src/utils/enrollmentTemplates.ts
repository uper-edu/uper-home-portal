import {enrollmentLevels, type EnrollmentClassConfig} from './enrollmentCatalog';

export type EnrollmentTeaching = {
  level: typeof enrollmentLevels[number];
  material: string;
  knowledge: string;
  learningOutcomes: string;
  resources: string;
  minutes: number;
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
  const {level, minutes, learningOutcomes, material, knowledge, resources}=course.teaching;
  return {
    templateId:template.id, templateRevision:template.revision, teacherType:template.teacherType,
    courseId:course.id, courseName:course.name, level, format:template.format, sessions:course.sessions, minutes,
    minimumPaid:template.minimumPaid, capacity:template.capacity,
    learningOutcomes, material:[material,knowledge].filter(Boolean).join('\n'), resources,
    ...(enrollmentTemplateQuote(template,course.sessions)??{price:0,standardPrice:null}),
  };
}
