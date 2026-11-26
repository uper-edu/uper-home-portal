import {enrollmentFirstSessionMatches, enrollmentInstant, enrollmentSessionStart, enrollmentWeeklyScheduleText, type EnrollmentClassConfig} from './enrollmentCatalog';

type Schedule = Pick<EnrollmentClassConfig,'firstLesson'|'weeklySchedule'|'sessions'|'minutes'> &
  Partial<Pick<EnrollmentClassConfig,'teacherId'|'teacher'|'timeZone'>>;

/** Date-only preview in the class's calendar. The configured start and deadlines are never rewritten. */
export function previewEnrollmentClassSchedule(config: Schedule, holidayDates: readonly string[]) {
  const {firstLesson,weeklySchedule,sessions,minutes}=config;
  if(!weeklySchedule||!enrollmentWeeklyScheduleText(weeklySchedule,minutes)||
    !enrollmentFirstSessionMatches(firstLesson,weeklySchedule)||
    !Number.isInteger(sessions)||sessions<1||sessions>1000)return null;

  const first=firstLesson.slice(0,10);
  const selected=new Set(holidayDates);
  const weekdays=new Set(weeklySchedule.days);
  const originalDates:string[]=[];
  const meetings:{date:string;periods:number;teacherId?:string;teacher?:string}[]=[];
  const skippedDates:string[]=[];
  const meetingCount=Math.ceil(sessions/weeklySchedule.lessons);
  const cursor=new Date(first+'T00:00:00Z');
  let remaining=sessions;

  while(remaining>0||originalDates.length<meetingCount){
    if(cursor.getUTCFullYear()>9999)return null;
    if(weekdays.has(cursor.getUTCDay()||7)){
      const date=cursor.toISOString().slice(0,10);
      if(originalDates.length<meetingCount)originalDates.push(date);
      if(remaining>0){
        if(selected.has(date))skippedDates.push(date);
        else {
          const periods=Math.min(weeklySchedule.lessons,remaining);
          meetings.push({date,periods,...(config.teacherId?{teacherId:config.teacherId,teacher:config.teacher}:{})});
          remaining-=periods;
        }
      }
    }
    cursor.setUTCDate(cursor.getUTCDate()+1);
  }

  const original=new Set(originalDates);
  const skipped=new Set(skippedDates);
  return {
    originalDates,meetings,skippedDates,
    makeupDates:meetings.filter(({date})=>!original.has(date)).map(({date})=>date),
    unneededDates:holidayDates.filter(date=>!skipped.has(date)),
    originalEnd:originalDates[originalDates.length-1],
    first:meetings[0].date,
    end:meetings[meetings.length-1].date,
  };
}

/** Build the actual occurrence from its date and start in the class's calendar. */
export function enrollmentScheduledMeetingStart(config:Schedule,date:string){
  if(!config.weeklySchedule)return null;
  const day=new Date(date+'T00:00:00Z').getUTCDay()||7;
  return enrollmentInstant(date+'T'+enrollmentSessionStart(config.weeklySchedule,day),config.timeZone);
}
