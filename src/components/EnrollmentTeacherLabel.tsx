import {enrollmentTeacherLabel} from '../utils/enrollmentCatalog';
import type {InterestLanguage} from '../utils/enrollmentInterestCopy';

export function EnrollmentTeacherLabel({teacherType,language,label,asBadge=false}:{
  teacherType?:'local'|'foreign';language:InterestLanguage;label?:string;asBadge?:boolean;
}) {
  const text=label??enrollmentTeacherLabel(teacherType,language);
  if(!text)return null;
  if(teacherType==='foreign')return <span className="enrollment-teacher-foreign">{text}</span>;
  return asBadge?<span className="enrollment-teacher-local">{text}</span>:text;
}
