import {pendingEnrollmentProofTotals} from './enrollmentProofTotals.ts';

type Client = {query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}>};
const DAY=86_400_000;
const WIB=7*3_600_000;
const isoDate=(time:number)=>new Date(time).toISOString().slice(0,10);
const mysqlTime=(time:number)=>new Date(time).toISOString().slice(0,19).replace('T',' ');

export function enrollmentWeekOf(weekStart:string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null;
  const start=Date.parse(weekStart+'T00:00:00Z');
  if (!Number.isFinite(start)||isoDate(start)!==weekStart||new Date(start).getUTCDay()!==1) return null;
  return {weekStart,endDate:isoDate(start+7*DAY),from:mysqlTime(start-WIB),until:mysqlTime(start+7*DAY-WIB)};
}
export function latestDueEnrollmentWeek(now:Date) {
  const jakarta=now.getTime()+WIB;
  const date=new Date(jakarta);
  const monday=Math.floor(jakarta/DAY)*DAY-((date.getUTCDay()+6)%7)*DAY;
  const thisSaturday=monday+5*DAY+8*3_600_000;
  return isoDate(monday-(jakarta>=thisSaturday?7:14)*DAY);
}

export async function enrollmentWeekTotals(c:Client,week:NonNullable<ReturnType<typeof enrollmentWeekOf>>) {
  const movements=(await c.query(`SELECT
    (SELECT COUNT(DISTINCT subject_id) FROM enrollment_notification_receipts WHERE channel='email'
      AND kind IN ('payment_confirmed','payment_and_opening') AND recorded_at>=:p1 AND recorded_at<:p2) AS enrolled,
    (SELECT COUNT(*) FROM enrollment_class_openings WHERE opened_at>=:p1 AND opened_at<:p2) AS opened,
    (SELECT COALESCE(SUM(amount),0) FROM enrollment_receipts WHERE created_at>=:p1 AND created_at<:p2) AS received,
    (SELECT COALESCE(SUM(amount),0) FROM enrollment_refund_payments WHERE created_at>=:p1 AND created_at<:p2) AS refunded`,
  [week.from,week.until])).rows[0];
  // Reconstruct at the exclusive WIB cutoff. Receipts or refunds recorded later do not alter the prior week.
  const totals=(await c.query(`SELECT COALESCE(SUM(due>=:p1 AND has_proof=0 AND verified=0 AND cancelled=0),0) AS waiting FROM (
      SELECT o.payment_due_at AS due,
        EXISTS(SELECT 1 FROM enrollment_proofs p WHERE p.order_id=o.id AND p.created_at<:p1) AS has_proof,
        COALESCE((SELECT SUM(r.amount) FROM enrollment_receipts r WHERE r.order_id=o.id AND r.created_at<:p1),0)
          +COALESCE((SELECT SUM(a.amount) FROM enrollment_payment_credits a WHERE a.target_order_id=o.id AND a.created_at<:p1),0) AS verified,
        EXISTS(SELECT 1 FROM portal_audit a WHERE a.action='enrollment.class.cancel'
          AND a.data->>'$.classId'=o.class_id AND a.created_at<:p1) AS cancelled
      FROM enrollment_orders o WHERE o.created_at<:p1 AND NOT EXISTS
        (SELECT 1 FROM enrollment_refund_cases f WHERE f.order_id=o.id AND f.created_at<:p1)
        AND NOT EXISTS (SELECT 1 FROM portal_audit a WHERE a.action='enrollment.order.end'
          AND a.data->>'$.orderId'=o.id AND a.created_at<:p1)
    ) AS as_of_cutoff`,[week.until])).rows[0];
  const {pending,pendingAmount,pendingUnknownCount}=await pendingEnrollmentProofTotals(c,week.until);
  return {enrolled:Number(movements.enrolled),opened:Number(movements.opened),received:Number(movements.received),
    refunded:Number(movements.refunded),waiting:Number(totals.waiting),pending,pendingAmount,pendingUnknownCount};
}
