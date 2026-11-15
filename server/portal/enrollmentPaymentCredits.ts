import {randomUUID} from 'node:crypto';
import {enrollmentLearnerNameKey} from '../../src/utils/enrollmentOrderStatus.ts';
import {normalizeContactPhone} from './trustWorkflow.ts';
import {lockIdentityRegistry} from './identityConsolidation.ts';
import {classOpeningNotices,orderNotice} from './enrollmentNotices.ts';

type Client={query:(sql:string,args?:unknown[])=>Promise<{rows:any[]}>};
type LockedOrder={order:any;cohort:any};
type LockOrder=(c:Client,id:string)=>Promise<LockedOrder>;
const payable=['awaiting_payment','proof_review','partial'];

/** Serialize cross-class enrollment writes before they acquire a class row lock. */
export async function lockEnrollmentFunds(c:Client) {
  await c.query('SELECT GET_LOCK(:p1,5)',['enrollment-payment-credits-v1']);
}

export async function updateEnrollmentPayment(c:Client,{order,cohort}:LockedOrder,received:number,state:string,data=order.data) {
  await c.query('UPDATE enrollment_orders SET received=:p1,state=:p2,data=:p3,activity_at=UTC_TIMESTAMP(6) WHERE id=:p4',[received,state,data,order.id]);
  const paid=cohort.state==='cancelled'?0:Number((await c.query("SELECT COUNT(*) AS count FROM enrollment_orders WHERE class_id=:p1 AND state IN ('paid','recovered')",[cohort.id])).rows[0].count);
  const openedBefore=(await c.query('SELECT opened_at FROM enrollment_class_openings WHERE class_id=:p1',[cohort.id])).rows[0];
  const newlyPaid=cohort.state==='published'&&['paid','recovered'].includes(state)&&!['paid','recovered'].includes(order.state);
  if(cohort.state==='published'&&paid>=cohort.data.minimumPaid&&!openedBefore){
    await c.query('INSERT INTO enrollment_class_openings(class_id,opened_at) VALUES(:p1,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE class_id=class_id',[cohort.id]);
  }
  const opened=Boolean(openedBefore||cohort.state==='published'&&paid>=cohort.data.minimumPaid);
  if(newlyPaid)await orderNotice(c,opened?'payment_and_opening':'payment_confirmed',order.id,undefined,{received});
  if(opened&&!openedBefore)await classOpeningNotices(c,cohort,newlyPaid?order.id:undefined);
  return {paidCount:paid,opened};
}

/** Each order owns only its unallocated bank funds and allocations received from other orders. */
export async function enrollmentRefundReceiptFunds(c:Client,id:string) {
  return (await c.query(`SELECT r.reference,r.receiving_account AS account,
      r.amount-(SELECT COALESCE(SUM(a.amount),0) FROM enrollment_payment_credits a WHERE a.receipt_reference=r.reference) AS amount
    FROM enrollment_receipts r WHERE r.order_id=:p1
    UNION ALL SELECT r.reference,r.receiving_account AS account,SUM(a.amount) AS amount
      FROM enrollment_payment_credits a JOIN enrollment_receipts r ON r.reference=a.receipt_reference
      WHERE a.target_order_id=:p1 GROUP BY r.reference,r.receiving_account ORDER BY reference`,[id])).rows;
}

async function sameLearnerOrders(c:Client,order:any,level:string) {
  // Never infer sibling identity from a shared family email or telephone alone.
  if(typeof order.data?.name!=='string'||!order.data.name.trim()||!normalizeContactPhone(order.data.phone))return [];
  await lockIdentityRegistry(c);
  const rows=(await c.query(`SELECT o.id,o.created_at,o.data,o.state,o.price,o.received,b.state AS class_state
    FROM enrollment_customer_records root
    JOIN portal_leads original ON original.id=root.lead_id
    JOIN portal_leads canonical ON canonical.id=COALESCE(NULLIF(original.profile->>'$.identityMergedInto','null'),original.id)
    JOIN portal_leads member ON COALESCE(NULLIF(member.profile->>'$.identityMergedInto','null'),member.id)=canonical.id
    JOIN enrollment_customer_records related ON related.lead_id=member.id AND related.kind='order'
    JOIN enrollment_orders o ON o.id=related.record_id JOIN enrollment_classes b ON b.id=o.class_id
    WHERE root.kind='order' AND root.record_id=:p1 AND o.email=:p2 AND b.data->>'$.level'=:p3
      AND COALESCE(canonical.profile->>'$.identityLifecycle','')<>'pending'
      AND COALESCE(member.profile->>'$.identityLifecycle','')<>'pending'
      AND COALESCE(original.profile->>'$.identityLifecycle','')<>'pending'
      AND (o.state='expired' OR (b.state='published' AND o.state IN ('awaiting_payment','proof_review','partial')
        AND o.received<o.price AND (o.state<>'awaiting_payment' OR o.payment_due_at>=UTC_TIMESTAMP(6))))
    ORDER BY o.created_at,o.id`,[order.id,order.email,level])).rows;
  return rows.filter(row=>typeof row.data?.name==='string'&&enrollmentLearnerNameKey(row.data.name)===enrollmentLearnerNameKey(order.data.name)
    &&normalizeContactPhone(row.data.phone)===normalizeContactPhone(order.data.phone));
}

export async function applyEnrollmentPaymentCredits(c:Client,current:LockedOrder,lockOrder:LockOrder) {
  const {order,cohort}=current;
  const sources=order.state==='expired';
  if(!sources&&!payable.includes(order.state))return;
  const related=await sameLearnerOrders(c,order,cohort.data.level);
  if(!related.some(row=>row.id===order.id))return;
  const expired=related.filter(row=>row.state==='expired'&&Number(row.received)>0&&(sources?row.id===order.id:row.created_at<order.created_at));
  for(const prior of expired){
    const candidates=related.filter(row=>payable.includes(row.state)&&row.created_at>prior.created_at);
    if(candidates.length!==1||(!sources&&candidates[0].id!==order.id))continue;
    const source=sources?current:await lockOrder(c,prior.id);
    const target=await lockOrder(c,candidates[0].id);
    if(source.order.state!=='expired'||target.cohort.state!=='published'||!payable.includes(target.order.state))continue;
    let balance=Math.min(Number(source.order.received),Number(target.order.price)-Number(target.order.received));
    if(balance<=0)continue;
    const credits=(await c.query(`SELECT r.reference,r.amount-(SELECT COALESCE(SUM(a.amount),0) FROM enrollment_payment_credits a
      WHERE a.receipt_reference=r.reference) AS available FROM enrollment_receipts r WHERE r.order_id=:p1
      ORDER BY r.settled_at,r.reference`,[source.order.id])).rows;
    let applied=0;
    for(const receipt of credits){
      const amount=Math.min(balance,Number(receipt.available));
      if(amount<=0)continue;
      await c.query(`INSERT INTO enrollment_payment_credits(id,receipt_reference,source_order_id,target_order_id,amount,created_at)
        VALUES(:p1,:p2,:p3,:p4,:p5,UTC_TIMESTAMP(6))`,[randomUUID(),receipt.reference,source.order.id,target.order.id,amount]);
      applied+=amount;balance-=amount;
    }
    if(!applied)continue;
    const fromData={...source.order.data,creditOut:Number(source.order.data.creditOut??0)+applied};
    await c.query('UPDATE enrollment_orders SET received=received-:p1,data=:p2,activity_at=UTC_TIMESTAMP(6) WHERE id=:p3',[applied,fromData,source.order.id]);
    const toData={...target.order.data,creditIn:Number(target.order.data.creditIn??0)+applied};
    const received=Number(target.order.received)+applied;
    await updateEnrollmentPayment(c,target,received,received>=target.order.price?'paid':'partial',toData);
  }
}
