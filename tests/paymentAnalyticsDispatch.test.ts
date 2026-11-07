import test from 'node:test';
import assert from 'node:assert/strict';
import analytics from '../src/data/analyticsEnvironments.json';
import {dispatchPaymentAnalytics} from '../server/portal/paymentAnalyticsDispatch';

const clock = new Date('2026-11-07T18:00:00Z');
const environment = (target: 'dev' | 'test' | 'prod' = 'dev') => ({
  PORTAL_ENV: target,
  PORTAL_GA_DISPATCH_ENABLED: 'true',
  PORTAL_GA_MEASUREMENT_ID: analytics.environments[target].measurementId,
  PORTAL_GA_API_SECRET: 'mock-secret',
  PORTAL_GA_START_AT: '2026-11-07T16:00:00Z',
});
const resolveIdentity = async () => ({clientId: '1234.5678', analyticsAllowed: true});
type Candidate = {
  id: string;
  environment: 'dev' | 'test' | 'prod';
  project_id: string;
  source_entry_id: string;
  kind: 'purchase' | 'refund';
  amount: number;
  course_id: string;
  created_at: Date;
  sequence_no: number;
  state: string;
  dispatch_state?: string;
  attempted_at?: Date;
};
function row(sequence: number, overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'event-' + sequence, environment: 'dev', project_id: 'crm-private-project',
    source_entry_id: 'crm-private-entry-' + sequence, kind: sequence === 0 ? 'purchase' : 'refund',
    amount: [1_000_000, 100_000, 50_000][sequence] ?? 10_000, course_id: 'hsk-1',
    created_at: new Date('2026-11-07T17:00:00Z'), sequence_no: sequence, state: 'held', ...overrides,
  };
}

function fixture(...candidates: Candidate[]) {
  let transactions = Promise.resolve();
  let failFinalize = false;
  let inside = false;
  let queries = 0;
  const calls: {url: URL; payload: any; init?: RequestInit}[] = [];
  const request: typeof fetch = async (url, init) => {
    assert.equal(inside, false, 'the claim must be committed before transport');
    calls.push({url: new URL(String(url)), payload: JSON.parse(String(init?.body)), init});
    return new Response(null, {status: 204});
  };
  const db = {
    async query(sql: string, args: any[] = []) {
      queries++;
      const [key, value] = args;
      const result = (rowCount = 0, rows: any[] = []) => ({rows, rowCount});
      if (sql.startsWith("UPDATE crm_payment_analytics SET dispatch_state='unknown'")) {
        for (const item of candidates) {
          if (item.environment === key && item.dispatch_state === 'sending' && item.attempted_at! <= value) item.dispatch_state = 'unknown';
        }
        return result();
      }
      if (sql.startsWith('SELECT q.id')) {
        assert.match(sql, /FOR UPDATE OF q,p SKIP LOCKED$/);
        assert.match(sql, /p\.state='held' AND p\.dispatch_state='accepted' AND NOT EXISTS/);
        assert.match(sql, /earlier\.dispatch_state IN \('sending','unknown','rejected'\)/);
        const ordered = candidates.slice().sort((a, b) => +a.created_at - +b.created_at || a.id.localeCompare(b.id));
        for (const item of ordered) {
          if (item.environment !== key || item.state !== 'held' || item.dispatch_state || item.created_at < value || item.created_at > args[2]) continue;
          const sameProject = candidates.filter(other => other.environment === key && other.project_id === item.project_id);
          const purchase = sameProject.find(other => other.sequence_no === 0);
          if (!purchase || (item.kind === 'refund' && (purchase.state !== 'held' || purchase.dispatch_state !== 'accepted' ||
              sameProject.some(other => other.sequence_no < item.sequence_no &&
                (['sending', 'unknown', 'rejected'].includes(other.dispatch_state ?? '') ||
                 (other.state === 'held' && other.dispatch_state !== 'accepted')))))) continue;
          return result(1, [{...item, purchase_id: purchase.id}]);
        }
        return result();
      }
      const item = candidates.find(candidate => candidate.id === key);
      if (sql.includes("SET dispatch_state='sending'") && item?.state === 'held' && !item.dispatch_state) {
        item.dispatch_state = 'sending';
        item.attempted_at = value;
        return result(1);
      }
      if (sql.includes("SET dispatch_state='blocked'") && item?.state === 'held' && !item.dispatch_state) {
        item.dispatch_state = 'blocked';
        return result(1);
      }
      if (sql.includes("SET dispatch_state=:p2")) {
        if (item?.dispatch_state !== 'sending') return result();
        if (failFinalize) throw Error('simulated acknowledgement write failure');
        item.dispatch_state = value;
        return result(1);
      }
      throw Error('Unexpected query: ' + sql);
    },
  };
  function transaction<T>(work: (client: typeof db) => Promise<T>) {
    const run = transactions.then(async () => {
      inside = true;
      try { return await work(db); }
      finally { inside = false; }
    });
    transactions = run.then(() => {}, () => {});
    return run;
  }
  const run = (overrides: Partial<Parameters<typeof dispatchPaymentAnalytics>[0]> = {}) =>
    dispatchPaymentAnalytics({transaction, resolveIdentity, env: environment(), request, clock, ...overrides});
  return {run, calls, request, candidates, get queries() {return queries;}, failFinalize() {failFinalize = true;}};
}

test('dispatch is disabled by default and rejects cross-environment targets before DB or transport', async () => {
  const f = fixture(row(0));
  const productionId = analytics.environments.prod.measurementId;
  for (const overrides of [
    {env: {}},
    {env: {...environment(), PORTAL_GA_DISPATCH_ENABLED: 'false'}},
    {env: {...environment(), PORTAL_GA_API_SECRET: ''}},
    {env: {...environment(), PORTAL_GA_START_AT: '2026-11-08T00:00:00Z'}},
    {env: {...environment(), PORTAL_GA_START_AT: '2026-02-31T00:00:00Z'}},
    {env: {...environment(), PORTAL_PACKAGE_ENV: 'prod'}},
    {env: {...environment(), PORTAL_GA_MEASUREMENT_ID: productionId}},
    {env: {...environment('test'), PORTAL_GA_MEASUREMENT_ID: productionId}},
    {env: {...environment('test'), PORTAL_GA_MEASUREMENT_ID: analytics.environments.dev.measurementId}},
    {env: environment('prod')},
    {resolveIdentity: undefined},
  ]) await f.run(overrides);
  assert.equal(f.queries, 0);
  assert.equal(f.calls.length, 0);
  assert.equal(f.candidates[0].state, 'held');
});

test('both non-production environments use their respective UPER Test streams', async () => {
  for (const target of ['dev', 'test'] as const) {
    const env = environment(target);
    const f = fixture(row(0, {environment: 'prod'}), row(0, {environment: target, id: target}));
    await f.run({env});
    assert.equal(analytics.environments[target].propertyName, 'UPER Test');
    assert.equal(f.calls[0].url.searchParams.get('measurement_id'), analytics.environments[target].measurementId);
    assert.equal(f.candidates[0].state, 'held');
    assert.equal(f.candidates[1].dispatch_state, 'accepted');
  }
});

test('a committed purchase claim wins concurrent ticks and both partial refunds follow it exactly once', async () => {
  const f = fixture(row(2), row(1), row(0));
  let finish!: () => void;
  let started!: () => void;
  const startedSending = new Promise<void>(resolve => {started = resolve;});
  const release = new Promise<void>(resolve => {finish = resolve;});
  const pending = f.run({request: async (url, init) => {
    started();
    await release;
    return f.request(url, init);
  }});
  await startedSending;
  assert.equal(f.candidates[2].dispatch_state, 'sending');
  await Promise.all([f.run(), f.run()]);
  assert.equal(f.calls.length, 0);
  finish();
  assert.equal(await pending, 'accepted');
  await Promise.all([f.run(), f.run()]);
  await f.run();
  await f.run();
  const events = f.calls.map(call => call.payload.events[0]);
  assert.deepEqual(events.map(event => event.name), ['purchase', 'refund', 'refund']);
  assert.deepEqual(events.map(event => event.params.value), [1_000_000, 100_000, 50_000]);
  assert.equal(events.filter(event => event.name === 'refund').reduce((sum, event) => sum + event.params.value, 0), 150_000);
  assert.ok(events.every(event => event.params.transaction_id === 'event-0' && event.params.currency === 'IDR'));
  assert.equal(f.calls[0].init?.redirect, 'error');
  assert.doesNotMatch(JSON.stringify(f.calls.map(call => call.payload)), /crm-private|mock-secret/);
  assert.ok(f.candidates.every(item => item.dispatch_state === 'accepted'));
});

test('unknown, rejected and interrupted sends are never automatically replayed', async () => {
  for (const [response, expected] of [[503, 'unknown'], [400, 'rejected'], [null, 'unknown']] as const) {
    const f = fixture(row(0), row(1));
    let attempts = 0;
    assert.equal(await f.run({request: async () => {
      attempts++;
      if (response === null) throw Error('simulated lost response');
      return new Response(null, {status: response});
    }}), expected);
    await f.run();
    assert.equal(attempts, 1);
    assert.equal(f.calls.length, 0);
    assert.deepEqual(f.candidates.map(item => item.dispatch_state), [expected, undefined]);
  }
  const f = fixture(row(0), row(1));
  f.failFinalize();
  await assert.rejects(f.run(), /acknowledgement write failure/);
  assert.deepEqual(f.candidates.map(item => item.dispatch_state), ['sending', undefined]);
  await f.run({clock: new Date(clock.getTime() + 61_000)});
  await f.run({clock: new Date(clock.getTime() + 62_000)});
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.candidates.map(item => item.dispatch_state), ['unknown', undefined]);

  const refund = fixture(row(0, {dispatch_state: 'accepted'}), row(1), row(2));
  await refund.run({request: async (url, init) => {
    await refund.request(url, init);
    throw Error('collector received refund, response lost');
  }});
  refund.candidates[1].state = 'cancelled';
  await refund.run();
  assert.equal(refund.calls.length, 1);
  assert.deepEqual(refund.candidates.map(item => item.dispatch_state), ['accepted', 'unknown', undefined]);
});

test('a late response cannot overwrite an outcome already marked unknown', async () => {
  const f = fixture(row(0), row(1));
  const result = await f.run({request: async (url, init) => {
    const response = await f.request(url, init);
    await f.run({clock: new Date(clock.getTime() + 61_000)});
    return response;
  }});
  assert.equal(result, 'unknown');
  assert.equal(f.candidates[0].dispatch_state, 'unknown');
  assert.equal(f.calls.length, 1);
});

test('denied or invalid identity, history, cancelled candidates and orphan refunds stay outside transport', async () => {
  const f = fixture(row(0), row(1));
  await f.run({resolveIdentity: async () => ({clientId: '1234.5678', analyticsAllowed: false})});
  await f.run();
  assert.deepEqual(f.candidates.map(item => item.dispatch_state), ['blocked', undefined]);
  assert.equal(f.calls.length, 0);
  const invalid = fixture(row(0));
  await invalid.run({resolveIdentity: async () => ({clientId: 'private@example.invalid', analyticsAllowed: true})});
  assert.equal(invalid.candidates[0].dispatch_state, 'blocked');
  assert.equal(invalid.calls.length, 0);
  const historic = fixture(row(0, {created_at: new Date('2026-11-07T15:00:00Z')}), row(1));
  await historic.run();
  assert.equal(historic.calls.length, 0);
  await historic.run({clock: new Date('2026-11-12T18:00:00Z'), env: {...environment(), PORTAL_GA_START_AT: '2026-11-07T10:00:00Z'}});
  assert.equal(historic.calls.length, 0);
  const cancelled = fixture(row(0, {state: 'cancelled'}), row(1));
  await cancelled.run();
  assert.equal(cancelled.calls.length, 0);
  const orphan = fixture(row(1));
  await orphan.run();
  assert.equal(orphan.calls.length, 0);
  const afterVoid = fixture(row(0, {dispatch_state: 'accepted'}), row(1, {state: 'cancelled'}), row(2));
  await afterVoid.run();
  assert.equal(afterVoid.calls[0].payload.events[0].params.value, 50_000);
});
