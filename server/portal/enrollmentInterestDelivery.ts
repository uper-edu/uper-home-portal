import {demandMatches} from '../../src/utils/enrollmentInterests.ts';

type Client={query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}>};
type InterestMail={kind:string;subject_id:string;payload:{classId?:string}};

export async function enrollmentInterestStillAvailable(c:Client,event:string,recipient:string,mail:InterestMail){
  if(mail.kind!=='waitlist_vacancy'&&mail.kind!=='demand_match')return true;
  const [,kind,interestId,legacyClassId,cycle]=event.split(':');
  const classId=mail.payload.classId??legacyClassId;
  if(kind!==mail.kind||interestId!==mail.subject_id||!classId)return false;

  const [cohort]=(await c.query(`SELECT e.data,
    (SELECT COUNT(*) FROM enrollment_orders o WHERE o.class_id=e.id AND o.state NOT IN ('expired','ended','refunding','refunded')
      AND (o.state<>'awaiting_payment' OR o.payment_due_at>=UTC_TIMESTAMP(6) OR o.received>0 OR o.upload_expires_at>=UTC_TIMESTAMP(6)))
    + (SELECT COUNT(*) FROM enrollment_transfer_invitations t WHERE t.target_class_id=e.id AND t.state='offered'
      AND t.expires_at>UTC_TIMESTAMP(6)) AS occupied
    FROM enrollment_classes e JOIN crm_courses course ON course.id=e.course_id
    WHERE e.id=:p1 AND e.state='published' AND JSON_EXTRACT(course.value,'$.active')=true
      AND LEAST(e.enrollment_closes_at,DATE(e.first_lesson_at + INTERVAL 7 HOUR) - INTERVAL 7 HOUR)>UTC_TIMESTAMP(6)`,[classId])).rows;
  if(!cohort||Number(cohort.occupied)>=cohort.data.capacity)return false;

  if(mail.kind==='waitlist_vacancy'){
    return (await c.query(`SELECT w.id FROM enrollment_waitlist w JOIN enrollment_vacancy_cycles v ON v.class_id=w.class_id
      WHERE w.id=:p1 AND w.email=:p2 AND w.class_id=:p3 AND w.state='waiting' AND v.cycle=:p4 AND v.is_full=FALSE`,
      [interestId,recipient,classId,cycle])).rows.length>0;
  }
  const [demand]=(await c.query("SELECT criteria FROM enrollment_demands WHERE id=:p1 AND email=:p2 AND state='active'",[interestId,recipient])).rows;
  return Boolean(demand&&demandMatches(demand.criteria,cohort.data));
}
