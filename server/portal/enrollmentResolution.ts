import type { Express, Request, Response } from 'express';
import type { Employee } from './identity.ts';
import { permittedRecord } from '../../src/utils/accessControl.ts';
import { isCrmManager } from '../../src/utils/crmOutreach.ts';
import { enrollmentClosureReason } from '../../src/utils/enrollmentOrderStatus.ts';
import { lockIdentityRegistry } from './identityConsolidation.ts';
import { createHash, randomUUID } from 'node:crypto';
import { invalid, operation } from './trustWorkflow.ts';
import { allowsEnrollment, reconcileWaitlist, takenSeats } from './enrollmentInterests.ts';
import { canSelectTransfer, enrollmentRefundEstimate } from '../../src/utils/enrollmentAftercare.ts';
import { activeLearnerOrder, convertLearnerWaitlist } from './enrollmentLearners.ts';
import { classOpeningNotices, orderNotice } from './enrollmentNotices.ts';
import { createEnrollmentTransferInvitation } from './enrollmentTransferOffers.ts';
import { readEnrollmentRules, readEnrollmentWorkCalendar } from './enrollmentRules.ts';
import { workingDayDeadline } from '../../src/utils/workCalendar.ts';
import { enrollmentRefundReceiptFunds } from './enrollmentPaymentCredits.ts';

type Client={query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}>};
type Handler=(q:Request,r:Response)=>Promise<unknown>;
type Actor=(q:Request)=>Promise<{id:string}>;
type RefundInstallment={reference:string;receiptReference:string;amount:number;returned:number};
type Context={
  wrap:(fn:Handler)=>(q:Request,r:Response)=>void; post:(path:string,fn:Handler)=>void;
  transact:(work:(c:Client)=>Promise<any>)=>Promise<any>; read:(work:(c:Client)=>Promise<any>)=>Promise<any>; session:(c:Client,q:Request)=>Promise<string>;
  lockOrder:(c:Client,id:string,email?:string)=>Promise<{order:any;cohort:any}>;
  lockClass:(c:Client,id:string)=>Promise<any>; expireSeats:(c:Client,id:string)=>Promise<void>;
  financeActor:Actor; supportActor:(q:Request)=>Promise<Employee>;
};

async function refundLedger(c:Client,id:string) {
  const entry=(await c.query(`SELECT expected,timing,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') AS createdAt
    FROM enrollment_refund_cases WHERE order_id=:p1`,[id])).rows[0];
  if(!entry) return null;
  const installments:RefundInstallment[]=(await c.query(`SELECT p.reference,p.receipt_reference,p.amount,
    (SELECT COALESCE(SUM(b.amount),0) FROM enrollment_refund_returns b WHERE b.refund_reference=p.reference) AS returned
    FROM enrollment_refund_payments p WHERE p.order_id=:p1 ORDER BY p.created_at,p.reference`,[id])).rows.map(row=>({
      reference:String(row.reference),receiptReference:String(row.receipt_reference),amount:Number(row.amount),returned:Number(row.returned),
    }));
  const sent=installments.reduce((sum,row)=>sum+row.amount,0);
  const returned=installments.reduce((sum,row)=>sum+row.returned,0);
  return {installments,progress:{expected:Number(entry.expected),refunded:sent-returned,returned,
    requestedAt:entry.timing?.requestedAt??entry.createdAt,sendBy:entry.timing?.sendBy,timezone:entry.timing?.timezone}};
}

export async function enrollmentAftercareStatus(c:Client,id:string) {
  const invitations=(await c.query(`SELECT i.id,i.target_class_id,
    DATE_FORMAT(i.expires_at,'%Y-%m-%dT%H:%i:%sZ') AS expires_at_iso,
    CASE WHEN i.state='offered'
      AND LEAST(i.expires_at, DATE(e.first_lesson_at + INTERVAL 7 HOUR) - INTERVAL 7 HOUR)<=UTC_TIMESTAMP(6)
      THEN 'expired' ELSE i.state END AS state,e.data
    FROM enrollment_transfer_invitations i JOIN enrollment_classes e ON e.id=i.target_class_id
    WHERE i.order_id=:p1 ORDER BY i.created_at DESC`,[id])).rows.map(row=>({
      id:row.id,targetClassId:row.target_class_id,expiresAt:row.expires_at_iso,
      state:row.state,firstLesson:row.data.firstLesson,schedule:row.data.schedule,
    }));
  const refund=await refundLedger(c,id);
  const transfers=(await c.query('SELECT source_class_id,target_class_id,created_at FROM enrollment_transfers WHERE order_id=:p1 ORDER BY created_at DESC',[id])).rows;
  return { invitations, transferHistory:transfers, refundProgress:refund?.progress??null };
}

const classId = (value:unknown) => typeof value==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(value);
const reference = (value:unknown) => typeof value==='string' && value.trim() && value.length<=120 ? value.trim().toUpperCase() : null;
const mayDecideRefund=(actor:Employee)=>Boolean(isCrmManager(actor)&&permittedRecord(actor,{},'crm.read')&&permittedRecord(actor,{},'crm.followup'));
const endable = ['awaiting_payment','proof_review','partial','paid','recovered'];
function sameClass(actual:string, expected:unknown) {
  if(actual!==expected) invalid('enrollment_aftercare_conflict',409);
}

export function mountEnrollmentResolution(app:Express,ctx:Context) {
  const {wrap,post,transact,read,session,lockOrder,lockClass,expireSeats,financeActor,supportActor}=ctx;
  const learner='/api/enrollment/orders/:id';
  const staff='/api/crm/enrollment/aftercare';
  async function target(c:Client,source:any,order:any,to:string,invitationId?:string) {
    if (!canSelectTransfer(order,source)||source.id===to) invalid('enrollment_transfer_unavailable',409);
    const next=await lockClass(c,to);
    await expireSeats(c,to);
    const ownHold=invitationId && (await c.query("SELECT id FROM enrollment_transfer_invitations WHERE id=:p1 AND state='offered' AND expires_at>UTC_TIMESTAMP(6)",[invitationId])).rows[0];
    if(invitationId&&!ownHold) invalid('enrollment_invitation_expired',409);
    if (!allowsEnrollment(next)||next.data.level!==source.data.level||next.data.format!==source.data.format||
        await takenSeats(c,to)-(ownHold?1:0)>=next.data.capacity) invalid('enrollment_transfer_unavailable',409);
    if(await activeLearnerOrder(c,to,order.email,order.data.name)) invalid('enrollment_already_has_seat',409);
    return next;
  }
  async function releaseInvites(c:Client,orderId:string,keep?:string) {
    const {rows}=await c.query("SELECT target_class_id FROM enrollment_transfer_invitations WHERE order_id=:p1 AND state='offered' AND id<>:p2",[orderId,keep||'']);
    await c.query("UPDATE enrollment_transfer_invitations SET state='released' WHERE order_id=:p1 AND state='offered' AND id<>:p2",[orderId,keep||'']);
    for(const id of [...new Set(rows.map(row=>String(row.target_class_id)))].sort()) {
      const affected=await lockClass(c,id);
      await expireSeats(c,id);
      await reconcileWaitlist(c,affected,await takenSeats(c,id));
    }
  }

  async function manager(q:Request) {
    const actor=await supportActor(q);
    if(!mayDecideRefund(actor))invalid('enrollment_support_forbidden',403);
    return actor;
  }
  async function authorizeInvitation(c:Client,actor:Employee,id:string,protect=false) {
    if(mayDecideRefund(actor))return;
    if(protect)await lockIdentityRegistry(c);
    const customer=(await c.query(`SELECT canonical.profile FROM enrollment_customer_records r
      JOIN portal_leads l ON l.id=r.lead_id
      JOIN portal_leads canonical ON canonical.id=COALESCE(NULLIF(l.profile->>'$.identityMergedInto','null'),l.id)
      WHERE r.kind='order' AND r.record_id=:p1`+(protect?' FOR SHARE':''),[id])).rows[0]?.profile;
    if(!customer||customer.owner!==actor.id||customer.identityLifecycle==='pending'||
      !permittedRecord(actor,customer,'crm.read')||!permittedRecord(actor,customer,'crm.followup'))
      invalid('enrollment_support_forbidden',403);
  }

  post(learner+'/cancel',async(q,r)=>{
    const id=String(q.params.id);
    const result=await transact(async c=>{
      const {order,cohort}=await lockOrder(c,id,await session(c,q));
      if(enrollmentClosureReason(order.state,order.data?.closureReason)==='learner_cancelled')
        return {orderId:id,state:'ended',closureReason:'learner_cancelled'};
      if(order.state!=='awaiting_payment'||Number(order.received)!==0||Number(order.upload_active)||
        (await c.query('SELECT 1 FROM enrollment_proofs WHERE order_id=:p1 LIMIT 1',[id])).rows.length)
        invalid('enrollment_cancel_not_available',409);
      await c.query(`UPDATE enrollment_orders SET state='ended',data=JSON_SET(data,'$.closureReason','learner_cancelled'),
        activity_at=UTC_TIMESTAMP(6),upload_id=NULL,upload_expires_at=NULL WHERE id=:p1`,[id]);
      await releaseInvites(c,id);
      await reconcileWaitlist(c,cohort,await takenSeats(c,cohort.id));
      await c.query("INSERT INTO portal_audit(actor,action,data) VALUES('learner','enrollment.order.cancel',:p1)",
        [{orderId:id,classId:cohort.id,closureReason:'learner_cancelled'}]);
      return {orderId:id,state:'ended',closureReason:'learner_cancelled'};
    });
    r.json(result);
  });

  app.get(staff,wrap(async (q,r)=>{
    const actor=await supportActor(q);
    const all=mayDecideRefund(actor);
    const orders=await read(async c=>(await c.query(`SELECT o.id,o.class_id,o.received,o.price,o.state,o.data,e.state AS class_state,e.data AS class_data,
      EXISTS(SELECT 1 FROM enrollment_class_openings g WHERE g.class_id=e.id) AS opened,canonical.profile
      FROM enrollment_orders o JOIN enrollment_classes e ON e.id=o.class_id
      LEFT JOIN enrollment_customer_records link ON link.kind='order' AND link.record_id=o.id
      LEFT JOIN portal_leads existing ON existing.id=link.lead_id
      LEFT JOIN portal_leads canonical ON canonical.id=COALESCE(NULLIF(existing.profile->>'$.identityMergedInto','null'),existing.id)
      WHERE (:p1=1 AND (o.state IN ('awaiting_payment','proof_review','partial','paid','recovered')
        OR (o.received>0 AND o.state IN ('expired','ended'))))
        OR (canonical.profile->>'$.owner'=:p2 AND e.state='cancelled' AND o.state IN ('paid','recovered') AND o.received>=o.price)
      ORDER BY o.created_at DESC LIMIT 100`,[Number(all),actor.id])).rows.flatMap(o=>{
      const canInvite=canSelectTransfer(o,{state:o.class_state});
      if(!all&&(!canInvite||o.profile?.identityLifecycle==='pending'||!permittedRecord(actor,o.profile,'crm.read')||
        !permittedRecord(actor,o.profile,'crm.followup')))return [];
      return [{id:o.id,classId:o.class_id,name:o.data.name,received:Number(o.received),opened:Number(o.opened)===1,
        level:o.class_data.level,format:o.class_data.format,canInvite,
        priorityRequested:o.data.priority===true,canEnd:all&&endable.includes(o.state),canRefund:all&&Number(o.received)>0,ended:o.state==='ended'}];
    }));
    r.set('Cache-Control','no-store').json({orders});
  }));
  app.get('/api/crm/enrollment/finance/:id/refund-details',wrap(async(q,r)=>{
    await financeActor(q);
    const id=String(q.params.id);
    const data=await read(async c=>{
      const ledger=await refundLedger(c,id);
      if(!ledger) invalid('enrollment_refund_unavailable',404);
      const receipts=(await enrollmentRefundReceiptFunds(c,id)).filter(row=>Number(row.amount)>0).map(row=>({
          reference:row.reference,
          account:row.account,
          remaining:Number(row.amount)-effectiveRefundForReceipt(ledger.installments,row.reference),
        }));
      return {...ledger,receipts};
    });
    r.set('Cache-Control','no-store').json(data);
  }));

  post(learner+'/priority',async(q,r)=>{
    const id=String(q.params.id);
    const result=await transact(async c=>{
      const email=await session(c,q);
      const {order,cohort}=await lockOrder(c,id,email);
      sameClass(cohort.id,q.body?.classId);
      if(!canSelectTransfer(order,cohort)) invalid('enrollment_priority_unavailable',409);
      if(order.data.priority!==true){
        await c.query("UPDATE enrollment_orders SET data=JSON_SET(data,'$.priority',CAST('true' AS JSON)),activity_at=UTC_TIMESTAMP(6) WHERE id=:p1",[id]);
        await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'enrollment.priority.enable',:p2)",
          ['learner:'+createHash('sha256').update(email).digest('hex'),{orderId:id,classId:cohort.id}]);
      }
      return {priorityRequested:true};
    });
    r.json(result);
  });

  post(staff+'/:id/invitations',async(q,r)=>{
    const actor=await supportActor(q);
    const id=String(q.params.id);
    const to=q.body?.targetClassId;
    if(!classId(to)) invalid('enrollment_invalid_transfer');
    const result=await transact(async c=>{
      const {order,cohort}=await lockOrder(c,id);
      return operation(c,actor.id,q.body,{leadId:'enrollment:'+id,kind:'enrollment.transfer.invite',authorize:async()=>authorizeInvitation(c,await supportActor(q),id)},async()=>{
        sameClass(cohort.id,q.body.classId);
        const existing=(await c.query(`SELECT i.id FROM enrollment_transfer_invitations i JOIN enrollment_classes e ON e.id=i.target_class_id
          WHERE i.order_id=:p1 AND i.state='offered'
            AND LEAST(i.expires_at, DATE(e.first_lesson_at + INTERVAL 7 HOUR) - INTERVAL 7 HOUR)>UTC_TIMESTAMP(6)
          FOR UPDATE OF i`,[id])).rows[0];
        if(existing) invalid('enrollment_active_invitation',409);
        const next=await target(c,cohort,order,to);
        await authorizeInvitation(c,actor,id,true);
        const invitation=await createEnrollmentTransferInvitation(c,id,cohort.id,next,actor.id);
        if(!invitation) invalid('enrollment_transfer_unavailable',409);
        return invitation;
      });
    });
    r.json(result);
  });

  post(learner+'/transfer',async(q,r)=>{
    const id=String(q.params.id);
    const {targetClassId,invitationId,decision}=q.body || {};
    if(!classId(targetClassId)||!['accept','decline'].includes(decision)||
      (invitationId!==undefined&&(typeof invitationId!=='string'||!/^[a-f0-9-]{36}$/.test(invitationId)))||
      (decision==='decline'&&!invitationId)) invalid('enrollment_invalid_transfer');
    const result=await transact(async c=>{
      const email=await session(c,q);
      const actor='learner:'+createHash('sha256').update(email).digest('hex');
      return operation(c,actor,q.body,{leadId:'enrollment:'+id,kind:'enrollment.transfer.respond'},async()=>{
        const {order,cohort}=await lockOrder(c,id,email);
        sameClass(cohort.id,q.body.classId);
        if (!canSelectTransfer(order,cohort)) invalid('enrollment_transfer_unavailable',409);
        if(invitationId){
          const invite=(await c.query(`SELECT i.id FROM enrollment_transfer_invitations i JOIN enrollment_classes e ON e.id=i.target_class_id
            WHERE i.id=:p1 AND i.order_id=:p2 AND i.source_class_id=:p3 AND i.target_class_id=:p4 AND i.state='offered'
              AND LEAST(i.expires_at, DATE(e.first_lesson_at + INTERVAL 7 HOUR) - INTERVAL 7 HOUR)>UTC_TIMESTAMP(6)
            FOR UPDATE OF i`,[invitationId,id,cohort.id,targetClassId])).rows[0];
          if(!invite) invalid('enrollment_invitation_expired',409);
        }
        if(decision==='decline'){
          const next=await lockClass(c,targetClassId);
          await c.query("UPDATE enrollment_transfer_invitations SET state='declined' WHERE id=:p1",[invitationId]);
          await c.query('UPDATE enrollment_orders SET activity_at=UTC_TIMESTAMP(6) WHERE id=:p1',[id]);
          await expireSeats(c,next.id);
          await reconcileWaitlist(c,next,await takenSeats(c,next.id));
          return { classId:cohort.id,decision };
        }
        const next=await target(c,cohort,order,targetClassId,invitationId);
        if(invitationId) await c.query("UPDATE enrollment_transfer_invitations SET state='accepted' WHERE id=:p1",[invitationId]);
        await releaseInvites(c,id,invitationId);
        await c.query('UPDATE enrollment_orders SET class_id=:p1,activity_at=UTC_TIMESTAMP(6) WHERE id=:p2',[next.id,id]);
        await convertLearnerWaitlist(c,next.id,email,order.data.name,id);
        await c.query(`INSERT INTO enrollment_transfers(id,order_id,source_class_id,target_class_id,invitation_id,created_at)
          VALUES(:p1,:p2,:p3,:p4,:p5,UTC_TIMESTAMP(6))`,[randomUUID(),id,cohort.id,next.id,invitationId??null]);
        const paid=(await c.query("SELECT COUNT(*) AS count FROM enrollment_orders WHERE class_id=:p1 AND state IN ('paid','recovered')",[next.id])).rows[0].count;
        if(Number(paid)>=next.data.minimumPaid){
          const opened=(await c.query('SELECT class_id FROM enrollment_class_openings WHERE class_id=:p1',[next.id])).rows[0];
          await c.query('INSERT INTO enrollment_class_openings(class_id,opened_at) VALUES(:p1,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE class_id=class_id',[next.id]);
          if(!opened) await classOpeningNotices(c,next);
        }
        await reconcileWaitlist(c,next,await takenSeats(c,next.id));
        return {classId:next.id,decision};
      });
    });
    r.json(result);
  });

  post(staff+'/:id/end',async(q,r)=>{
    const actor=await manager(q);
    const id=String(q.params.id);
    const reason=q.body?.reason;
    if(typeof reason!=='string'||!reason.trim()||reason.length>1000) invalid('enrollment_end_reason_required');
    const result=await transact(c=>operation(c,actor.id,q.body,{leadId:'enrollment:'+id,kind:'enrollment.order.end',authorize:()=>manager(q)},async()=>{
      const {order,cohort}=await lockOrder(c,id);
      sameClass(cohort.id,q.body.classId);
      if(!endable.includes(order.state)) invalid('enrollment_end_unavailable',409);
      await c.query("UPDATE enrollment_orders SET state='ended',activity_at=UTC_TIMESTAMP(6),upload_id=NULL,upload_expires_at=NULL WHERE id=:p1",[id]);
      await releaseInvites(c,id);
      await reconcileWaitlist(c,cohort,await takenSeats(c,cohort.id));
      await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'enrollment.order.end',:p2)",
        [actor.id,{orderId:id,classId:cohort.id,previousState:order.state,reason:reason.trim()}]);
      return {orderId:id,state:'ended'};
    }));
    r.json(result);
  });

  post(staff+'/:id/refund',async(q,r)=>{
    const actor=await manager(q);
    const id=String(q.params.id);
    const {reason,delivered,special,requestedAt}=q.body || {};
    if(typeof reason!=='string'||!reason.trim()||reason.length>1000||!Number.isSafeInteger(delivered)||delivered<0||typeof special!=='boolean') invalid('enrollment_invalid_refund');
    const clock=new Date();
    const requested=requestedAt===undefined?clock:typeof requestedAt==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(requestedAt)?new Date(requestedAt):null;
    if(!requested||!Number.isFinite(requested.getTime())||requested>clock)invalid('enrollment_invalid_refund_request_time');
    const result=await transact(c=>operation(c,actor.id,q.body,{leadId:'enrollment:'+id,kind:'enrollment.refund.intake',authorize:()=>manager(q)},async()=>{
      const {order,cohort}=await lockOrder(c,id);
      sameClass(cohort.id,q.body.classId);
      const opened=(await c.query('SELECT class_id FROM enrollment_class_openings WHERE class_id=:p1',[cohort.id])).rows[0];
      if (opened && !special) invalid('enrollment_refund_special_required',409);
      if (Number(order.received)<=0||['refunded','refunding'].includes(order.state)||delivered>cohort.data.sessions||(!opened&&delivered>0))
        invalid('enrollment_refund_unavailable',409);
      const expected=enrollmentRefundEstimate({price:order.price,received:Number(order.received),refunded:0,transferred:0,sessions:cohort.data.sessions,delivered});
      const rules=await readEnrollmentRules(c);
      const calendar=await readEnrollmentWorkCalendar(c);
      const sendBy=workingDayDeadline(requested,rules.refundBusinessDays,calendar);
      const timing={requestedAt:requested.toISOString(),sendBy,timezone:calendar.timezone};
      await c.query(`INSERT INTO enrollment_refund_cases(order_id,class_id,actor,reason,delivered_sessions,expected,timing,created_at)
        VALUES(:p1,:p2,:p3,:p4,:p5,:p6,:p7,UTC_TIMESTAMP(6))`,[id,cohort.id,actor.id,reason.trim(),delivered,expected,timing]);
      await c.query('UPDATE enrollment_orders SET state=:p1,activity_at=UTC_TIMESTAMP(6),upload_id=NULL,upload_expires_at=NULL WHERE id=:p2',[expected>0?'refunding':'refunded',id]);
      await releaseInvites(c,id);
      await reconcileWaitlist(c,cohort,await takenSeats(c,cohort.id));
      await orderNotice(c,'refund_accepted',id,undefined,{expected,sendBy:expected>0?sendBy:undefined});
      return {orderId:id,expected,sendBy};
    }));
    r.json(result);
  });

  post('/api/crm/enrollment/finance/:id/refunds',async(q,r)=>{
    const actor=await financeActor(q);
    const id=String(q.params.id);
    const original=reference(q.body?.receiptReference);
    const returned=reference(q.body?.reference);
    const amount=q.body?.amount;
    if(!original||!returned||original===returned||!Number.isSafeInteger(amount)||amount<1||amount>1_000_000_000) invalid('enrollment_invalid_refund');
    const result=await transact(c=>operation(c,actor.id,q.body,{leadId:'enrollment:'+id,kind:'enrollment.refund.payment',authorize:()=>financeActor(q)},async()=>{
      const {order}=await lockOrder(c,id);
      const ledger=await refundLedger(c,id);
      if(!ledger || order.state!=='refunding') invalid('enrollment_refund_unavailable',409);
      const initial=(await enrollmentRefundReceiptFunds(c,id)).find(row=>row.reference===original&&Number(row.amount)>0);
      if(!initial) invalid('enrollment_refund_wrong_receipt',409);
      const {expected,refunded}=ledger.progress;
      if(ledger.installments.some(row=>row.reference===returned)) invalid('enrollment_duplicate_refund',409);
      const cumulative=refunded+amount;
      if(cumulative>expected||effectiveRefundForReceipt(ledger.installments,original)+amount>Number(initial.amount))
        invalid('enrollment_refund_amount_exceeds',409);
      try{
        await c.query(`INSERT INTO enrollment_refund_payments(reference,receipt_reference,order_id,amount,actor,created_at)
          VALUES(:p1,:p2,:p3,:p4,:p5,UTC_TIMESTAMP(6))`,[returned,original,id,amount,actor.id]);
      }catch(error:any){if(error.code==='ER_DUP_ENTRY') invalid('enrollment_duplicate_refund',409);throw error;}
      if(cumulative===expected) await c.query("UPDATE enrollment_orders SET state='refunded',activity_at=UTC_TIMESTAMP(6) WHERE id=:p1",[id]);
      await orderNotice(c,'refund_recorded',id,'payment-'+createHash('sha256').update(returned).digest('hex'),{installment:amount,refunded:cumulative,expected});
      return {orderId:id,refunded:cumulative,expected};
    }));
    r.json(result);
  });

  post('/api/crm/enrollment/finance/:id/refund-returns',async(q,r)=>{
    const actor=await financeActor(q);
    const id=String(q.params.id);
    const refundReference=reference(q.body?.refundReference);
    const bankReturn=reference(q.body?.reference);
    const amount=q.body?.amount;
    if(!refundReference||!bankReturn||refundReference===bankReturn||!Number.isSafeInteger(amount)||amount<1||amount>1_000_000_000)
      invalid('enrollment_invalid_refund_return');
    const result=await transact(c=>operation(c,actor.id,q.body,{leadId:'enrollment:'+id,kind:'enrollment.refund.return',authorize:()=>financeActor(q)},async()=>{
      const {order}=await lockOrder(c,id);
      const ledger=await refundLedger(c,id);
      if(!ledger||!['refunding','refunded'].includes(order.state)) invalid('enrollment_refund_unavailable',409);
      if((await c.query('SELECT reference FROM enrollment_refund_returns WHERE reference=:p1',[bankReturn])).rows[0])
        invalid('enrollment_duplicate_refund_return',409);
      const payment=ledger.installments.find(row=>row.reference===refundReference);
      if(!payment) invalid('enrollment_refund_wrong_payment',409);
      if(amount>payment.amount-payment.returned) invalid('enrollment_refund_return_amount_exceeds',409);
      try{
        await c.query(`INSERT INTO enrollment_refund_returns(reference,refund_reference,amount,actor,created_at)
          VALUES(:p1,:p2,:p3,:p4,UTC_TIMESTAMP(6))`,[bankReturn,refundReference,amount,actor.id]);
      }catch(error:any){if(error.code==='ER_DUP_ENTRY') invalid('enrollment_duplicate_refund_return',409);throw error;}
      await c.query("UPDATE enrollment_orders SET state='refunding',activity_at=UTC_TIMESTAMP(6) WHERE id=:p1",[id]);
      return {orderId:id,refunded:ledger.progress.refunded-amount,expected:ledger.progress.expected};
    }));
    r.json(result);
  });
}

function effectiveRefundForReceipt(installments:RefundInstallment[],reference:string) {
  return installments.reduce((sum,row)=>row.receiptReference===reference?sum+row.amount-row.returned:sum,0);
}
