import {createHash} from 'node:crypto';
import type {PaymentEntry, PaymentLedger, PaymentProject} from '../../src/utils/crmPayments.ts';

function eventId(environment:string, projectId:string, kind:'purchase'|'refund', entryId?:string) {
  return createHash('sha256').update(JSON.stringify([environment, projectId, kind, entryId ?? null])).digest('hex');
}

/** Store a minimal candidate in the same transaction as the verified ledger entry. */
export async function queuePaymentAnalytics(
  db:any, ledger:PaymentLedger, project:PaymentProject, entry:PaymentEntry, action:string,
  environment=process.env.PORTAL_ENV,
) {
  if (!environment || !['dev','test','prod'].includes(environment)) return;
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
      typeof courseId === 'string' && /^[A-Za-z0-9_-]{1,191}$/.test(courseId) ? courseId : 'legacy-course');
    return;
  }

  const purchase = (await db.query(
    'SELECT course_id,state FROM crm_payment_analytics WHERE id=:p1 FOR UPDATE', [purchaseId],
  )).rows[0];
  if (purchase?.state !== 'held') return;
  const sequence = (await db.query(
    'SELECT COALESCE(MAX(sequence_no),0) AS last_sequence FROM crm_payment_analytics WHERE environment=:p1 AND project_id=:p2',
    [environment, project.id],
  )).rows[0];
  await insert(db, eventId(environment, project.id, 'refund', entry.id), environment,
    project.id, entry.id, 'refund', Number(sequence.last_sequence)+1, entry.verifiedAmount, purchase.course_id);
}

async function insert(db:any,id:string,environment:string,projectId:string,entryId:string,
    kind:'purchase'|'refund',sequence:number,amount:number,courseId:string) {
  await db.query(
    'INSERT INTO crm_payment_analytics(id,environment,project_id,source_entry_id,kind,sequence_no,amount,course_id) VALUES(:p1,:p2,:p3,:p4,:p5,:p6,:p7,:p8)',
    [id,environment,projectId,entryId,kind,sequence,amount,courseId],
  );
}
