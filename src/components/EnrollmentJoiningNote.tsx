import type {EnrollmentClassTimeZone} from '../utils/enrollmentDateFormat';
import {EnrollmentJourneyLink} from './EnrollmentJourneyLink';
import {enrollmentInstant} from '../utils/enrollmentCatalog';
import {interestText, type InterestLanguage} from '../utils/enrollmentInterestCopy';
import {enrollmentSupportPath} from '../utils/enrollmentSupportNavigation';

export function EnrollmentJoiningNote({firstLesson,timeZone,now,language}:{
  firstLesson?:string;timeZone?:EnrollmentClassTimeZone;now:number;language:InterestLanguage;
}) {
  const lessonTime=enrollmentInstant(firstLesson,timeZone);
  if(!lessonTime||now<lessonTime.valueOf())return null;
  return <p>{interestText(language,[
    '已到原定首课时间。','The scheduled first lesson time has arrived.','Waktu sesi pertama yang dijadwalkan sudah tiba.',
  ])}{' '}<EnrollmentJourneyLink className="enrollment-quiet" stepEntry="enrollment-joining-help" to={enrollmentSupportPath('advisor',language)}>{interestText(language,[
    '联系销售确认上课安排','Contact our team to confirm how to join','Hubungi tim kami untuk memastikan cara bergabung',
  ])}</EnrollmentJourneyLink></p>;
}
