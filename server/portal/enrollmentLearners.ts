import { enrollmentLearnerNameKey } from '../../src/utils/enrollmentOrderStatus.ts';

type Client = { query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}> };

function matches(stored: unknown, name: string | undefined) {
  return name === undefined
    ? stored === undefined || stored === null
    : typeof stored === 'string' && enrollmentLearnerNameKey(stored) === enrollmentLearnerNameKey(name);
}

// Callers hold the class lock. Email verifies access; the submitted name distinguishes learners using it.
export async function activeLearnerOrder(c:Client,classId:string,email:string,name?:string) {
  const {rows}=await c.query(`SELECT * FROM enrollment_orders WHERE class_id=:p1 AND email=:p2
    AND state NOT IN ('expired','ended','refunding','refunded') ORDER BY created_at,id`,[classId,email]);
  return name===undefined ? rows[0] : rows.find(row=>matches(row.data?.name,name));
}

export async function learnerWaitlist(c:Client,classId:string,email:string,name?:string) {
  const {rows}=await c.query(`SELECT w.id,COALESCE(w.learner_name,
    NULLIF(l.profile->>'$.fullName',w.email)) AS learner_name
    FROM enrollment_waitlist w LEFT JOIN enrollment_customer_records a ON a.kind='waitlist' AND a.record_id=w.id
    LEFT JOIN portal_leads l ON l.id=a.lead_id
    WHERE w.class_id=:p1 AND w.email=:p2 AND w.state='waiting' ORDER BY w.created_at,w.id`,[classId,email]);
  return rows.find(row=>matches(row.learner_name,name));
}

export async function convertLearnerWaitlist(c:Client,classId:string,email:string,name:string,orderId:string) {
  const entry=await learnerWaitlist(c,classId,email,name);
  if(entry) await c.query("UPDATE enrollment_waitlist SET state='converted',activity_at=UTC_TIMESTAMP(6),order_id=:p1 WHERE id=:p2 AND state='waiting'",[orderId,entry.id]);
}
