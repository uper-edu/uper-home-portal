import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {openTrialDatabase} from '../cloud/mysql/database.mjs';
import {migrate} from '../cloud/mysql/migrate.mjs';
import {verifyPaymentAnalyticsSchema} from '../cloud/mysql/payment-analytics-schema.mjs';
import {dispatchPaymentAnalytics} from '../server/portal/paymentAnalyticsDispatch';
import {queuePaymentAnalytics} from '../server/portal/paymentAnalytics';
import type {PaymentEntry, PaymentProject} from '../src/utils/crmPayments';
import analytics from '../src/data/analyticsEnvironments.json';
import {setupNativeTest} from './helpers/mysql.mjs';
import {disposeNativeTest} from './helpers/disposeNativeTest.mjs';

test('native MySQL preserves the v19 queue and dispatches one purchase and two refunds at most once', {
  skip: !process.env.MYSQL_NATIVE_TEST_ENV,
  timeout: 20_000,
}, async () => {
  const fixture = await setupNativeTest('ga_dispatch');
  const db = await openTrialDatabase(process.env);
  const {tx, pool} = await import('../cloud/mysql/runtime.mjs');
  try {
    const runMigration = () => migrate(db, fixture.name, {initializeSystemDefaults:false});
    // Reconstruct the v19 shape in this disposable schema and verify it before the upgrade.
    await db.query('ALTER TABLE crm_payment_analytics DROP INDEX payment_analytics_dispatch, DROP COLUMN dispatch_state, DROP COLUMN attempted_at');
    await db.query('DELETE FROM trial_schema_versions WHERE version=20');
    const connection = await db.getConnection();
    try {await verifyPaymentAnalyticsSchema(connection, 19);}
    finally {connection.release();}
    await db.query("INSERT INTO access_state(id,value) VALUES('ga_test_sentinel',JSON_OBJECT('synthetic',true))");

    async function addEntry(project: PaymentProject, entries: PaymentEntry[], kind: 'receipt' | 'refund', amount: number) {
      const entry = {id:randomUUID(), projectId:project.id, kind, state:'verified', verifiedAmount:amount} as PaymentEntry;
      await tx(c => queuePaymentAnalytics(c, {entries:[...entries,entry],projects:[project],history:[]},
        project, entry, kind === 'receipt' ? 'receive' : 'refund', 'test'));
      entries.push(entry);
    }
    const project = {id:randomUUID(), expected:1_000_000, priceSnapshot:{courseId:'qa-hsk'}} as PaymentProject;
    const entries: PaymentEntry[] = [];
    await addEntry(project, entries, 'receipt', 300_000);
    await addEntry(project, entries, 'refund', 100_000);

    const read = async (sql: string) => (await db.query(sql))[0];
    const oldRows = () => read('SELECT id,environment,project_id,source_entry_id,kind,sequence_no,amount,course_id,state,created_at FROM crm_payment_analytics ORDER BY id');
    const sentinel = () => read('SELECT * FROM access_state ORDER BY id');
    const snapshot = async () => ({
      rows:await read('SELECT * FROM crm_payment_analytics ORDER BY id'),
      ddl:await read('SHOW CREATE TABLE crm_payment_analytics'),
      markers:await read('SELECT * FROM trial_schema_versions ORDER BY version'),
      sentinel:await sentinel(),
    });
    const before = await oldRows();
    const originalSentinel = await sentinel();
    assert.deepEqual(await runMigration(), {version:20,state:'ready',alreadyApplied:false});
    assert.deepEqual(await oldRows(), before);
    assert.deepEqual(await sentinel(), originalSentinel);
    const upgraded = await snapshot();
    for (let i = 0; i < 2; i++) {
      assert.deepEqual(await runMigration(), {version:20,state:'ready',alreadyApplied:true});
      assert.deepEqual(await snapshot(), upgraded);
    }
    await db.query("UPDATE trial_schema_versions SET state='applying' WHERE version=20");
    assert.deepEqual(await runMigration(), {version:20,state:'ready',alreadyApplied:false});
    const recovered = await snapshot();
    assert.deepEqual({...recovered, markers:upgraded.markers}, upgraded);

    const env = {
      PORTAL_ENV:'test', PORTAL_GA_DISPATCH_ENABLED:'true',
      PORTAL_GA_MEASUREMENT_ID:analytics.environments.test.measurementId,
      PORTAL_GA_API_SECRET:'native-test-fake-secret',
      PORTAL_GA_START_AT:new Date(Date.now()-60_000).toISOString(),
    };
    const identity = {clientId:'1234.5678', analyticsAllowed:true};
    const resolveIdentity = async () => identity;
    const events: {name: string; params: {transaction_id: string; value: number}}[] = [];
    const request: typeof fetch = async (url, options) => {
      assert.equal(new URL(String(url)).searchParams.get('measurement_id'), analytics.environments.test.measurementId);
      assert.equal(new URL(String(url)).searchParams.get('api_secret'), 'native-test-fake-secret');
      const {events: [event]} = JSON.parse(String(options?.body));
      events.push(event);
      return new Response(null, {status:204});
    };
    const run = (options: Partial<Parameters<typeof dispatchPaymentAnalytics>[0]> = {}) =>
      // MySQL creates rows with microseconds, while the worker clock has millisecond precision.
      dispatchPaymentAnalytics({transaction:tx, env, resolveIdentity, request, clock:new Date(Date.now()+1000), ...options});
    assert.equal(await run({env:{...env,PORTAL_GA_DISPATCH_ENABLED:'false'}}), undefined);
    assert.deepEqual(await snapshot(), recovered);

    let releaseIdentity!: () => void;
    let enteredIdentity!: () => void;
    const resolving = new Promise<void>(resolve => {enteredIdentity = resolve;});
    const release = new Promise<void>(resolve => {releaseIdentity = resolve;});
    const purchase = run({resolveIdentity:async () => {
      enteredIdentity();
      await release;
      return identity;
    }});
    try {
      await Promise.race([resolving,purchase.then(() => assert.fail('Purchase did not acquire the row'))]);
      assert.deepEqual(await Promise.all([run(),run(),run()]), [undefined,undefined,undefined]);
      assert.equal(events.length, 0);
    } finally {releaseIdentity();}
    assert.equal(await purchase, 'accepted');
    await addEntry(project, entries, 'refund', 50_000);
    await Promise.all([run(),run(),run()]);
    await run();
    await run();
    assert.deepEqual(events.map(event => [event.name,event.params.value]), [
      ['purchase',1_000_000],['refund',100_000],['refund',50_000],
    ]);
    assert.equal(new Set(events.map(event => event.params.transaction_id)).size,1);
    assert.equal(events.slice(1).reduce((sum, event) => sum + event.params.value, 0),150_000);

    const uncertain = {id:randomUUID(), expected:200_000} as PaymentProject;
    const uncertainEntries: PaymentEntry[] = [];
    await addEntry(uncertain, uncertainEntries, 'receipt', 100_000);
    await addEntry(uncertain, uncertainEntries, 'refund', 40_000);
    await addEntry(uncertain, uncertainEntries, 'refund', 10_000);
    assert.equal(await run(), 'accepted');
    assert.equal(await run({request:async (url, options) => {
      await request(url, options);
      throw Error('mock collector recorded refund but response was lost');
    }}), 'unknown');
    await Promise.all([run(),run()]);
    assert.equal(events.length,5);
    assert.deepEqual((await pool.query('SELECT dispatch_state FROM crm_payment_analytics WHERE project_id=:p1 ORDER BY sequence_no',
      [uncertain.id])).rows.map(item => item.dispatch_state), ['accepted','unknown',null]);

    const interrupted = {id:randomUUID(), expected:100_000} as PaymentProject;
    await addEntry(interrupted, [], 'receipt', 100_000);
    const lostWrite = (work: Parameters<typeof tx>[0], options?: Parameters<typeof tx>[1]) =>
      options ? tx(work,options) : Promise.reject(Error('mock process interrupted before finalization'));
    await assert.rejects(run({transaction:lostWrite}), /interrupted before finalization/);
    assert.equal((await pool.query('SELECT dispatch_state FROM crm_payment_analytics WHERE project_id=:p1',
      [interrupted.id])).rows[0].dispatch_state, 'sending');
    await run({clock:new Date(Date.now()+65_000)});
    await run({clock:new Date(Date.now()+66_000)});
    assert.equal(events.length,6);
    assert.equal((await pool.query('SELECT dispatch_state FROM crm_payment_analytics WHERE project_id=:p1',
      [interrupted.id])).rows[0].dispatch_state, 'unknown');
  } finally {
    await pool.end();
    await db.end();
    await disposeNativeTest(fixture);
  }
});
