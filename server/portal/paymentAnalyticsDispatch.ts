import {gaCredential,gaSettings} from './gaSettings.ts';
import {legacyGaCredential} from './integrationCredentialTargets.ts';
import {createHash} from 'node:crypto';
import analytics from '../../src/data/analyticsEnvironments.json';

type Environment = keyof typeof analytics.environments;
type Candidate = {
  id: string;
  kind: 'purchase' | 'refund';
  amount: string | number;
  course_id: string;
  created_at: Date;
  occurred_at: Date;
  project_id: string;
  purchase_id: string;
};
type Client = {query(sql: string, values?: unknown[]): Promise<{rows: any[]; rowCount: number}>};
type Transaction = <T>(work: (db: Client) => Promise<T>, options?: {isolation: 'READ COMMITTED'}) => Promise<T>;

function dispatchConfig(env: NodeJS.ProcessEnv, secret: string | undefined): {environment: Environment; endpoint: URL} | null {
  const environment = env.PORTAL_ENV;
  if (environment !== 'dev' && environment !== 'test' && environment !== 'prod') return null;
  if (env.PORTAL_PACKAGE_ENV && env.PORTAL_PACKAGE_ENV !== environment) return null;
  if (environment === 'prod' && env.PORTAL_PRODUCTION_READY !== 'true') return null;
  const measurementId = analytics.environments[environment].measurementId;
  if (env.PORTAL_GA_MEASUREMENT_ID !== measurementId || !secret) return null;
  const endpoint = new URL('https://www.google-analytics.com/mp/collect');
  endpoint.searchParams.set('measurement_id', measurementId);
  endpoint.searchParams.set('api_secret', secret);
  return {environment, endpoint};
}

async function dispatchCutoff(db: Client, environment: Environment) {
  const id = 'ga_payment_dispatch_start:' + environment;
  const read = async () => (await db.query('SELECT value FROM portal_settings WHERE id=:p1', [id])).rows[0];
  let row = await read();
  if (!row) {
    await db.query(
      "INSERT INTO portal_settings(id,value) VALUES(:p1,JSON_OBJECT('startedAt',DATE_FORMAT(UTC_TIMESTAMP(6),'%Y-%m-%d %H:%i:%s.%f'))) ON DUPLICATE KEY UPDATE id=id",
      [id],
    );
    row = await read();
  }
  const startedAt = row?.value?.startedAt;
  return typeof startedAt === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/.test(startedAt) ? startedAt : null;
}

// GA4 requires a client_id. Scope it to this purchase and its refunds.
function transactionClientId(environment: Environment, purchaseId: string) {
  const digest = createHash('sha256').update(JSON.stringify(['crm-payment', environment, purchaseId])).digest();
  return `${digest.readUInt32BE(0) + 1}.${digest.readUInt32BE(4) + 1}`;
}

/** Dispatch at most one event. The committed claim is never retried, even after a crash. */
export async function dispatchPaymentAnalytics({
  transaction, env = process.env, request = fetch, clock = new Date(),
}: {
  transaction: Transaction;
  env?: NodeJS.ProcessEnv;
  request?: typeof fetch;
  clock?: Date;
}) {
  const settings=env===process.env?await gaSettings():undefined;
  if(settings&&!settings.dispatchEnabled)return;
  const secret=settings?(await gaCredential(settings))?.key:legacyGaCredential(env)?.key;
  const config=dispatchConfig(settings?{...env,PORTAL_GA_MEASUREMENT_ID:settings.measurementId}:env,secret);
  if (!config) return;

  const {environment, endpoint} = config;
  const oldest = new Date(clock.getTime() - 72 * 60 * 60 * 1000);
  const job = await transaction(async db => {
    const cutoff = await dispatchCutoff(db, environment);
    if (!cutoff) return;
    await db.query("UPDATE crm_payment_analytics SET dispatch_state='unknown' WHERE environment=:p1 AND dispatch_state='sending' AND attempted_at<=:p2",
      [environment, new Date(clock.getTime() - 60_000)]);
    const {rows} = await db.query(
      `SELECT q.id,q.kind,q.amount,q.course_id,q.created_at,p.id AS purchase_id,q.occurred_at,q.project_id
       FROM crm_payment_analytics q
       JOIN crm_payment_analytics p ON p.environment=q.environment AND p.project_id=q.project_id AND p.sequence_no=0 AND p.kind='purchase'
       WHERE q.environment=:p1 AND q.state='held' AND q.dispatch_state IS NULL AND q.created_at>=:p2 AND q.created_at<=:p3
         AND q.created_at>:p4 AND q.occurred_at>:p4 AND q.occurred_at<=:p3
         AND (q.project_id NOT LIKE 'enrollment:%' OR q.occurred_at>=:p2)
         AND (q.kind='purchase' OR (p.state='held' AND p.dispatch_state='accepted' AND NOT EXISTS (
           SELECT 1 FROM crm_payment_analytics earlier
           WHERE earlier.environment=q.environment AND earlier.project_id=q.project_id
             AND earlier.sequence_no<q.sequence_no
             AND earlier.created_at>:p4 AND earlier.occurred_at>:p4
             AND (earlier.dispatch_state IN ('sending','unknown','rejected')
               OR (earlier.state='held' AND COALESCE(earlier.dispatch_state,'held')<>'accepted'))
         )))
         -- Once a returned payment has already been reported, hold later refunds for this order.
         AND (q.kind='purchase' OR q.project_id NOT LIKE 'enrollment:%' OR NOT EXISTS (
           SELECT 1 FROM crm_payment_analytics sent
           JOIN enrollment_refund_payments payment ON sent.source_entry_id=LEFT(SHA2(payment.reference,256),36)
           WHERE sent.environment=q.environment AND sent.project_id=q.project_id
             AND payment.order_id=SUBSTRING(q.project_id,12)
             AND sent.kind='refund' AND sent.dispatch_state='accepted'
             AND sent.amount>payment.amount-(SELECT COALESCE(SUM(bank_return.amount),0)
               FROM enrollment_refund_returns bank_return WHERE bank_return.refund_reference=payment.reference)
         ))
       ORDER BY q.created_at,q.id LIMIT 1 FOR UPDATE OF q,p SKIP LOCKED`,
      [environment, oldest, clock, cutoff],
    );
    const candidate = rows[0] as Candidate | undefined;
    if (!candidate) return;
    const value = Number(candidate.amount);
    if (!Number.isSafeInteger(value) || value <= 0) {
      await db.query("UPDATE crm_payment_analytics SET dispatch_state='blocked' WHERE id=:p1 AND state='held' AND dispatch_state IS NULL", [candidate.id]);
      return;
    }
    const claim = await db.query("UPDATE crm_payment_analytics SET dispatch_state='sending',attempted_at=:p2 WHERE id=:p1 AND state='held' AND dispatch_state IS NULL",
      [candidate.id, clock]);
    if (claim.rowCount !== 1) return;
    return {candidate, value};
  }, {isolation: 'READ COMMITTED'});
  if (!job) return;

  const {candidate, value} = job;
  let state: 'accepted' | 'rejected' | 'unknown';
  try {
    const response = await request(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        client_id: transactionClientId(environment,candidate.purchase_id),
        timestamp_micros: (candidate.project_id.startsWith('enrollment:') ? candidate.occurred_at : candidate.created_at).getTime() * 1000,
        events: [{
          name: candidate.kind,
          params: {
            transaction_id: candidate.purchase_id,
            currency: 'IDR',
            value,
            ...(candidate.kind === 'purchase' ? {items: [{item_id: candidate.course_id, price: value, quantity: 1}]} : {}),
          },
        }],
      }),
    });
    state = response.ok ? 'accepted' : response.status >= 400 && response.status < 500 ? 'rejected' : 'unknown';
  } catch {
    // Transport errors may contain the request URL (including its secret). Persist only the outcome.
    state = 'unknown';
  }
  const result = await transaction(db => db.query("UPDATE crm_payment_analytics SET dispatch_state=:p2 WHERE id=:p1 AND dispatch_state='sending'",
    [candidate.id, state]));
  return result.rowCount === 1 ? state : 'unknown';
}
