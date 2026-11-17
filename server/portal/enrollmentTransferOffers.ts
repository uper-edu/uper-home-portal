import { randomUUID } from 'node:crypto';
import { canSelectTransfer } from '../../src/utils/enrollmentAftercare.ts';
import { allowsEnrollment, expireSeats, reconcileWaitlist, takenSeats } from './enrollmentInterests.ts';
import { activeLearnerOrder } from './enrollmentLearners.ts';
import { orderNotice } from './enrollmentNotices.ts';
import { readEnrollmentRules } from './enrollmentRules.ts';

type Client={query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}>};
type Cohort=Parameters<typeof reconcileWaitlist>[1];
type Context={
  transact:(work:(c:Client)=>Promise<any>)=>Promise<any>;
  lockOrder:(c:Client,id:string)=>Promise<{order:any;cohort:Cohort}>;
  lockClass:(c:Client,id:string)=>Promise<Cohort>;
};

// Both callers hold the original order and target class locks before reserving a seat.
export async function createEnrollmentTransferInvitation(c:Client,orderId:string,sourceClassId:string,target:Cohort,actor:string) {
  const invitationId=randomUUID();
  const {replyHours}=await readEnrollmentRules(c);
  await c.query(`INSERT INTO enrollment_transfer_invitations
    (id,order_id,source_class_id,target_class_id,actor,state,expires_at,created_at)
    SELECT :p1,:p2,:p3,e.id,:p4,'offered',LEAST(TIMESTAMPADD(HOUR,:p6,UTC_TIMESTAMP(6)), e.enrollment_closes_at,
      DATE(e.first_lesson_at + INTERVAL 7 HOUR) - INTERVAL 7 HOUR),UTC_TIMESTAMP(6)
    FROM enrollment_classes e WHERE e.id=:p5 AND LEAST(e.enrollment_closes_at, DATE(e.first_lesson_at + INTERVAL 7 HOUR) - INTERVAL 7 HOUR)>UTC_TIMESTAMP(6)`,
  [invitationId,orderId,sourceClassId,actor,target.id,replyHours]);
  const expiry=(await c.query("SELECT DATE_FORMAT(expires_at,'%Y-%m-%dT%H:%i:%sZ') AS replyBy FROM enrollment_transfer_invitations WHERE id=:p1",[invitationId])).rows[0];
  if(!expiry) return null;
  await reconcileWaitlist(c,target,await takenSeats(c,target.id));
  await orderNotice(c,'transfer_invitation',orderId,invitationId,{
    targetClass:target.data.level,targetFormat:target.data.format,targetPeriod:target.data.period,
    targetFirstLesson:target.data.firstLesson,targetSchedule:target.data.schedule,replyBy:expiry.replyBy,
  });
  return {invitationId,replyBy:expiry.replyBy};
}

export async function markPriorityTransfersOnCancellation(c:Client,classId:string) {
  // Use the preference recorded at cancellation. A later learner opt-in still follows the staff-assisted workflow.
  await c.query(`UPDATE enrollment_orders SET data=JSON_SET(data,'$.autoTransferSource',:p1)
    WHERE class_id=:p1 AND data->>'$.priority'='true'
      AND state IN ('awaiting_payment','proof_review','partial','paid','recovered','expired')`,[classId]);
}

export function startEnrollmentPriorityTransferSimulation({transact,lockOrder,lockClass}:Context) {
  let busy=false;
  const tick=async()=>{
    if(busy) return;
    busy=true;
    try{
      const candidates=await transact(async c=>(await c.query(`SELECT o.id FROM enrollment_orders o
        JOIN enrollment_classes e ON e.id=o.class_id
        WHERE e.state='cancelled' AND o.state IN ('paid','recovered') AND o.received>=o.price
          AND o.data->>'$.autoTransferSource'=o.class_id
          AND NOT EXISTS (SELECT 1 FROM enrollment_transfer_invitations i
            WHERE i.order_id=o.id AND i.source_class_id=o.class_id)
        ORDER BY o.created_at,o.id`)).rows);
      for(const {id} of candidates) await transact(async c=>{
        const {order,cohort}=await lockOrder(c,id);
        if(!canSelectTransfer(order,cohort)||order.data.autoTransferSource!==cohort.id) return;
        const previous=(await c.query(`SELECT id FROM enrollment_transfer_invitations
          WHERE order_id=:p1 AND (source_class_id=:p2 OR (state='offered' AND expires_at>UTC_TIMESTAMP(6))) LIMIT 1`,[id,cohort.id])).rows[0];
        // Once an invitation exists, an expired or rejected invitation must not reserve another seat automatically.
        if(previous) return;
        const options=(await c.query(`SELECT id FROM enrollment_classes
          WHERE state='published' AND LEAST(enrollment_closes_at, DATE(first_lesson_at + INTERVAL 7 HOUR) - INTERVAL 7 HOUR)>UTC_TIMESTAMP(6)
            AND data->>'$.level'=:p1 AND data->>'$.format'=:p2 ORDER BY first_lesson_at,id`,
        [cohort.data.level,cohort.data.format])).rows;
        for(const option of options){
          const target=await lockClass(c,option.id);
          if(!allowsEnrollment(target)||target.data.level!==cohort.data.level||target.data.format!==cohort.data.format) continue;
          await expireSeats(c,target.id);
          if(await takenSeats(c,target.id)>=target.data.capacity||await activeLearnerOrder(c,target.id,order.email,order.data.name)) continue;
          if(await createEnrollmentTransferInvitation(c,id,cohort.id,target,'system:enrollment')) return;
        }
      });
    }catch{
      console.error('Enrollment priority transfer simulation could not reconcile invitations');
    }finally{
      busy=false;
    }
  };
  const timer=setInterval(()=>void tick(),10_000);
  timer.unref();
}
