import analytics from '../../src/data/analyticsEnvironments.json';

type Environment = keyof typeof analytics.environments;
type Candidate = {
  id: string;
  environment: Environment;
  project_id: string;
  source_entry_id: string;
  kind: 'purchase' | 'refund';
  amount: string | number;
  course_id: string;
  created_at: Date;
  purchase_id: string;
};
type Result = {rows: Candidate[]; rowCount: number};
type Client = {query(sql: string, values?: unknown[]): Promise<Result>};
type Transaction = <T>(work: (db: Client) => Promise<T>, options?: {isolation: 'READ COMMITTED'}) => Promise<T>;
export type ResolvePaymentAnalyticsIdentity = (
  db: Client,
  candidate: Readonly<Pick<Candidate, 'environment' | 'project_id' | 'source_entry_id'>>,
) => Promise<{clientId: string; analyticsAllowed: boolean} | null>;

function dispatchConfig(env: NodeJS.ProcessEnv) {
  if (env.PORTAL_GA_DISPATCH_ENABLED !== 'true') return null;
  const environment = env.PORTAL_ENV;
  if (environment !== 'dev' && environment !== 'test' && environment !== 'prod') return null;
  if (env.PORTAL_PACKAGE_ENV && env.PORTAL_PACKAGE_ENV !== environment) return null;
  if (environment === 'prod' && env.PORTAL_PRODUCTION_READY !== 'true') return null;
  const measurementId = analytics.environments[environment].measurementId;
  if (env.PORTAL_GA_MEASUREMENT_ID !== measurementId || !env.PORTAL_GA_API_SECRET?.trim()) return null;
  const start = env.PORTAL_GA_START_AT ?? '';
  const cutoff = new Date(start);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(start) ||
      !Number.isFinite(cutoff.getTime()) || cutoff.toISOString().replace('.000Z', 'Z') !== start.replace('.000Z', 'Z')) return null;
  const endpoint = new URL('https://www.google-analytics.com/mp/collect');
  endpoint.searchParams.set('measurement_id', measurementId);
  endpoint.searchParams.set('api_secret', env.PORTAL_GA_API_SECRET.trim());
  return {environment, cutoff, endpoint};
}

/** Dispatch at most one event. The committed claim is never retried, even after a crash. */
export async function dispatchPaymentAnalytics({
  transaction, resolveIdentity, env = process.env, request = fetch, clock = new Date(),
}: {
  transaction: Transaction;
  resolveIdentity?: ResolvePaymentAnalyticsIdentity;
  env?: NodeJS.ProcessEnv;
  request?: typeof fetch;
  clock?: Date;
}) {
  const config = dispatchConfig(env);
  if (!config || !resolveIdentity || clock < config.cutoff) return;

  const {environment, endpoint} = config;
  const oldest = new Date(Math.max(config.cutoff.getTime(), clock.getTime() - 72 * 60 * 60 * 1000));
  const job = await transaction(async db => {
    await db.query("UPDATE crm_payment_analytics SET dispatch_state='unknown' WHERE environment=:p1 AND dispatch_state='sending' AND attempted_at<=:p2",
      [environment, new Date(clock.getTime() - 60_000)]);
    const {rows: [candidate]} = await db.query(
      `SELECT q.id,q.environment,q.project_id,q.source_entry_id,q.kind,q.amount,q.course_id,q.created_at,p.id AS purchase_id
       FROM crm_payment_analytics q
       JOIN crm_payment_analytics p ON p.environment=q.environment AND p.project_id=q.project_id AND p.sequence_no=0 AND p.kind='purchase'
       WHERE q.environment=:p1 AND q.state='held' AND q.dispatch_state IS NULL AND q.created_at>=:p2 AND q.created_at<=:p3
         AND (q.kind='purchase' OR (p.state='held' AND p.dispatch_state='accepted' AND NOT EXISTS (
           SELECT 1 FROM crm_payment_analytics earlier
           WHERE earlier.environment=q.environment AND earlier.project_id=q.project_id
             AND earlier.sequence_no<q.sequence_no
             AND (earlier.dispatch_state IN ('sending','unknown','rejected')
               OR (earlier.state='held' AND COALESCE(earlier.dispatch_state,'held')<>'accepted'))
         )))
       ORDER BY q.created_at,q.id LIMIT 1 FOR UPDATE OF q,p SKIP LOCKED`,
      [environment, oldest, clock],
    );
    if (!candidate) return;
    // Resolve only through trusted, transaction-local data. Customer fields and the staff browser are not fallbacks.
    const identity = await resolveIdentity(db, candidate);
    const value = Number(candidate.amount);
    if (identity?.analyticsAllowed !== true || !/^\d{1,20}\.\d{1,20}$/.test(identity.clientId) ||
        !Number.isSafeInteger(value) || value <= 0) {
      await db.query("UPDATE crm_payment_analytics SET dispatch_state='blocked' WHERE id=:p1 AND state='held' AND dispatch_state IS NULL", [candidate.id]);
      return;
    }
    const claim = await db.query("UPDATE crm_payment_analytics SET dispatch_state='sending',attempted_at=:p2 WHERE id=:p1 AND state='held' AND dispatch_state IS NULL",
      [candidate.id, clock]);
    if (claim.rowCount !== 1) return;
    return {candidate, clientId: identity.clientId, value};
  }, {isolation: 'READ COMMITTED'});
  if (!job) return;

  const {candidate, clientId, value} = job;
  let state: 'accepted' | 'rejected' | 'unknown';
  try {
    const response = await request(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        client_id: clientId,
        timestamp_micros: candidate.created_at.getTime() * 1000,
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
