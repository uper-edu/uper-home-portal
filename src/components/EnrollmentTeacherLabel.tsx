import {enrollmentTeacherLabel} from '../utils/enrollmentCatalog';
import type {InterestLanguage} from '../utils/enrollmentInterestCopy';

export function EnrollmentTeacherLabel({teacherType,language,label}:{
  teacherType?:'local'|'foreign';language:InterestLanguage;label?:string;
}) {
  const text=label??enrollmentTeacherLabel(teacherType,language);
  return teacherType==='foreign'?<span className="enrollment-teacher-foreign">{text}</span>:text;
}
