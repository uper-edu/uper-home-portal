import {createHash} from 'node:crypto';
import type {PaymentEntry, PaymentLedger, PaymentProject} from '../../src/utils/crmPayments.ts';

function eventId(environment:string, projectId:string, kind:'purchase'|'refund', entryId?:string) {
  return createHash('sha256').update(JSON.stringify([environment, projectId, kind, entryId ?? null])).digest('hex');
}

function paymentEnvironment(environment=process.env.PORTAL_ENV) {
  return environment==='dev'||environment==='test'||environment==='prod' ? environment : undefined;
}

type EnrollmentPaymentEvent = {orderId:string; courseId:string; amount:number; occurredAt:Date};

function refundSourceId(reference:string) {
  return createHash('sha256').update(reference).digest('hex').slice(0,36);
}

/** The caller holds the enrollment order lock for all finance writes. */
export async function queueEnrollmentPurchase(db:any, event:EnrollmentPaymentEvent) {
  const environment = paymentEnvironment();
  if (!environment) return;
  const {orderId, courseId, amount, occurredAt} = event;
  const projectId = 'enrollment:'+orderId;
  const id = eventId(environment, projectId, 'purchase');
  const existing = (await db.query('SELECT id FROM crm_payment_analytics WHERE id=:p1 FOR UPDATE', [id])).rows[0];
  if (existing) return;
  await insert(db,id,environment,projectId,orderId,'purchase',0,amount,occurredAt,courseId);
}

export async function queueEnrollmentRefund(db:any, event:EnrollmentPaymentEvent & {reference:string}) {
  const environment = paymentEnvironment();
  if (!environment) return;
  const {orderId, courseId, amount, occurredAt, reference} = event;
  const projectId = 'enrollment:'+orderId;
  const sourceId = refundSourceId(reference);
  const sequence = await nextRefundSequence(db,environment,projectId);
  // A new refund on an older order is recorded, but the dispatcher requires an accepted purchase.
  await insert(db,eventId(environment,projectId,'refund',sourceId),environment,projectId,
    sourceId,'refund',sequence,amount,occurredAt,courseId);
}

export async function adjustPendingEnrollmentRefund(db:any, orderId:string, reference:string, netAmount:number) {
  const environment = paymentEnvironment();
  if (!environment) return;
  const projectId = 'enrollment:'+orderId;
  const purchaseId = eventId(environment,projectId,'purchase');
  // The dispatcher claims refunds under the same purchase lock.
  await db.query('SELECT id FROM crm_payment_analytics WHERE id=:p1 FOR UPDATE',[purchaseId]);
  const id = eventId(environment,projectId,'refund',refundSourceId(reference));
  await db.query(`UPDATE crm_payment_analytics SET amount=:p2,state=:p3
    WHERE id=:p1 AND state='held' AND dispatch_state IS NULL`,[id,netAmount,netAmount===0?'cancelled':'held']);
}

/** Store a minimal candidate in the same transaction as the verified ledger entry. */
export async function queuePaymentAnalytics(
  db:any, ledger:PaymentLedger, project:PaymentProject, entry:PaymentEntry, action:string,
  environment=process.env.PORTAL_ENV,
) {
  if (!environment || !paymentEnvironment(environment)) return;
  const purchaseId = eventId(environment, project.id, 'purchase');
  if (action === 'void') {
    if (entry.kind === 'refund') {
      const id = eventId(environment, project.id, 'refund', entry.id);
      await db.query("UPDATE crm_payment_analytics SET state='cancelled' WHERE id=:p1 AND state='held'", [id]);
    } else if (!ledger.entries.some(e => e.projectId === project.id && e.kind === 'receipt' && e.state === 'verified')) {
      await db.query("UPDATE crm_payment_analytics SET state='cancelled' WHERE environment=:p1 AND project_id=:p2 AND state='held'", [environment, project.id]);
    }
    return;
  }
  if (entry.state !== 'verified' || !entry.verifiedAmount) return;

  if (entry.kind === 'receipt') {
    if (project.expected === null || project.expected <= 0 ||
        ledger.entries.some(e => e.id !== entry.id && e.projectId === project.id &&
          e.kind === 'receipt' && e.verifiedAmount !== undefined)) return;
    if (project.termination && (!entry.receivedAt ||
        Date.parse(entry.receivedAt) >= Date.parse(project.termination.effectiveAt))) return;
    const courseId = project.priceSnapshot?.courseId;
    await insert(db, purchaseId, environment, project.id, entry.id, 'purchase', 0, project.expected,
      entry.receivedAt,
      typeof courseId === 'string' && /^[A-Za-z0-9_-]{1,191}$/.test(courseId) ? courseId : 'legacy-course');
    return;
  }

  const purchase = (await db.query(
    'SELECT course_id,state FROM crm_payment_analytics WHERE id=:p1 FOR UPDATE', [purchaseId],
  )).rows[0];
  if (purchase?.state !== 'held') return;
  const sequence = await nextRefundSequence(db,environment,project.id);
  await insert(db, eventId(environment, project.id, 'refund', entry.id), environment,
    project.id, entry.id, 'refund', sequence, entry.verifiedAmount,
    entry.receivedAt, purchase.course_id);
}

async function nextRefundSequence(db:any,environment:string,projectId:string) {
  const row = (await db.query(
    'SELECT COALESCE(MAX(sequence_no),0) AS last_sequence FROM crm_payment_analytics WHERE environment=:p1 AND project_id=:p2',
    [environment, projectId],
  )).rows[0];
  return Number(row.last_sequence)+1;
}

async function insert(db:any,id:string,environment:string,projectId:string,entryId:string,
    kind:'purchase'|'refund',sequence:number,amount:number,receivedAt:string|Date|undefined,courseId:string) {
  const occurredAt = receivedAt ? new Date(receivedAt) : null;
  await db.query(
    'INSERT INTO crm_payment_analytics(id,environment,project_id,source_entry_id,kind,sequence_no,amount,course_id,occurred_at) VALUES(:p1,:p2,:p3,:p4,:p5,:p6,:p7,:p8,:p9)',
    [id,environment,projectId,entryId,kind,sequence,amount,courseId,occurredAt && Number.isFinite(+occurredAt) ? occurredAt : null],
  );
}
