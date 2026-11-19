import assert from 'node:assert/strict';
import test from 'node:test';
import {execFile} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {promisify} from 'node:util';
import {openTrialDatabase} from '../cloud/mysql/database.mjs';
import {migrate} from '../cloud/mysql/migrate.mjs';
import {verifyPaymentAnalyticsSchema} from '../cloud/mysql/payment-analytics-schema.mjs';
import {dispatchPaymentAnalytics} from '../server/portal/paymentAnalyticsDispatch';
import {queuePaymentAnalytics} from '../server/portal/paymentAnalytics';
import type {PaymentEntry, PaymentProject} from '../src/utils/crmPayments';
import analytics from '../src/data/analyticsEnvironments.json';
import {setupNativeTest} from './helpers/mysql.mjs';
import {disposeNativeTest} from './helpers/disposeNativeTest.mjs';

test('native MySQL preserves historical rows and the restart cutoff, and sends each partial refund once', {
  skip: !process.env.MYSQL_NATIVE_TEST_ENV,
  timeout: 30_000,
}, async () => {
  const fixture = await setupNativeTest('ga_dispatch');
  const db = await openTrialDatabase(process.env);
  const {tx, pool} = await import('../cloud/mysql/runtime.mjs');
  try {
    const runMigration = () => migrate(db, fixture.name, {initializeSystemDefaults:false});
    await db.query("INSERT INTO access_state(id,value) VALUES('ga_test_sentinel',JSON_OBJECT('synthetic',true))");

    async function addEntry(project: PaymentProject, entries: PaymentEntry[], kind: 'receipt' | 'refund', amount: number,
      receivedAt = new Date().toISOString()) {
      const entry = {id:randomUUID(), projectId:project.id, kind, state:'verified', verifiedAmount:amount,receivedAt} as PaymentEntry;
      await tx(c => queuePaymentAnalytics(c, {entries:[...entries,entry],projects:[project],history:[]},
        project, entry, kind === 'receipt' ? 'receive' : 'refund', 'test'));
      entries.push(entry);
    }
    const project = {id:randomUUID(), expected:1_000_000, priceSnapshot:{courseId:'qa-hsk'}} as PaymentProject;
    const entries: PaymentEntry[] = [];
    await addEntry(project, entries, 'receipt', 300_000);
    await addEntry(project, entries, 'refund', 100_000);
    // Reconstruct the v19 queue, including rows that never recorded an occurrence time.
    await db.query('ALTER TABLE crm_payment_analytics DROP INDEX payment_analytics_dispatch, DROP COLUMN dispatch_state, DROP COLUMN attempted_at, DROP COLUMN occurred_at');
    await db.query('DELETE FROM trial_schema_versions WHERE version=20');
    const connection = await db.getConnection();
    try {await verifyPaymentAnalyticsSchema(connection, 19);}
    finally {connection.release();}

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
    assert.deepEqual(upgraded.rows.map(row => row.occurred_at), [null,null]);
    // Also exercise a deployment already marked v20 ready but missing the new column.
    await db.query('ALTER TABLE crm_payment_analytics DROP COLUMN occurred_at');
    for (let i = 0; i < 2; i++) {
      assert.deepEqual(await runMigration(), {version:20,state:'ready',alreadyApplied:true});
      assert.deepEqual(await snapshot(), upgraded);
    }
    await db.query("UPDATE trial_schema_versions SET state='applying' WHERE version=20");
    assert.deepEqual(await runMigration(), {version:20,state:'ready',alreadyApplied:false});
    const recovered = await snapshot();
    assert.deepEqual({...recovered, markers:upgraded.markers}, upgraded);

    const env = {
      PORTAL_ENV:'test',
      PORTAL_GA_MEASUREMENT_ID:analytics.environments.test.measurementId,
      PORTAL_GA_API_SECRET:'native-test-fake-secret',
    };
    type Payload = {client_id: string; events: [{name: string; params: {transaction_id: string; value: number; currency: string}}]};
    const payloads: Payload[] = [];
    const events = () => payloads.map(payload => payload.events[0]);
    const request: typeof fetch = async (url, options) => {
      assert.equal(new URL(String(url)).searchParams.get('measurement_id'), analytics.environments.test.measurementId);
      assert.equal(new URL(String(url)).searchParams.get('api_secret'), 'native-test-fake-secret');
      payloads.push(JSON.parse(String(options?.body)));
      return new Response(null, {status:204});
    };
    const run = (options: Partial<Parameters<typeof dispatchPaymentAnalytics>[0]> = {}) =>
      // MySQL creates rows with microseconds, while the worker clock has millisecond precision.
      dispatchPaymentAnalytics({transaction:tx, env, request, clock:new Date(Date.now()+1000), ...options});
    assert.equal(await run({env:{...env,PORTAL_GA_API_SECRET:''}}), undefined);
    assert.deepEqual(await snapshot(), recovered);
    assert.equal(await run(),undefined);
    assert.equal(payloads.length,0);
    const cutoff = async () => (await pool.query('SELECT value FROM portal_settings WHERE id=:p1',
      ['ga_payment_dispatch_start:test'])).rows[0]?.value?.startedAt;
    const firstStart = await cutoff();
    assert.match(firstStart,/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/);
    const startMs = Date.parse(firstStart.replace(' ', 'T') + 'Z');
    const backdatedProject = {...project,id:randomUUID()};
    const backdatedEntries: PaymentEntry[] = [];
    await addEntry(backdatedProject,backdatedEntries,'receipt',300_000,new Date(startMs-86_400_000).toISOString());
    await addEntry(backdatedProject,backdatedEntries,'refund',20_000,new Date(startMs-60_000).toISOString());
    assert.equal(await run(),undefined);
    assert.equal(payloads.length,0);
    const activeProject = {...project,id:randomUUID()};
    const activeEntries: PaymentEntry[] = [];
    const afterStart = () => new Date(Math.max(Date.now(),startMs+1)).toISOString();
    await addEntry(activeProject,activeEntries,'receipt',300_000,afterStart());
    await addEntry(activeProject,activeEntries,'refund',100_000,afterStart());

    let releaseSend!: () => void;
    let enteredSend!: () => void;
    const sending = new Promise<void>(resolve => {enteredSend = resolve;});
    const release = new Promise<void>(resolve => {releaseSend = resolve;});
    const purchase = run({request:async (url, options) => {
      enteredSend();
      await release;
      return request(url,options);
    }});
    try {
      await Promise.race([sending,purchase.then(() => assert.fail('Purchase did not acquire the row'))]);
      assert.deepEqual(await Promise.all([run(),run(),run()]), [undefined,undefined,undefined]);
      assert.equal(payloads.length, 0);
    } finally {releaseSend();}
    assert.equal(await purchase, 'accepted');
    await addEntry(activeProject, activeEntries, 'refund', 50_000, afterStart());
    // A fresh sender process has no in-memory cutoff and uses only this synthetic DB.
    const {stdout} = await promisify(execFile)(process.execPath, ['--import','tsx','--input-type=module','-e', `
      import {pool,tx} from './cloud/mysql/runtime.mjs';
      import {dispatchPaymentAnalytics} from './server/portal/paymentAnalyticsDispatch.ts';
      globalThis.fetch = async () => { throw Error('Network disabled in GA acceptance'); };
      const payloads = [];
      const request = async (_url, options) => {
        payloads.push(JSON.parse(options.body));
        return new Response(null, {status:204});
      };
      try {
        const results = [];
        for (let i = 0; i < 3; i++)
          results.push(await dispatchPaymentAnalytics({transaction:tx,request,clock:new Date(Date.now()+1000)}));
        console.log(JSON.stringify({results,payloads}));
      } finally { await pool.end(); }
    `], {timeout:10_000,env:{
      ...env,
      MYSQL_TRIAL_URL:process.env.MYSQL_TRIAL_URL,
      MYSQL_TRIAL_SOCKET:fixture.socket,
      TRIAL_DATASET:'synthetic',
    }});
    const restarted = JSON.parse(stdout);
    assert.deepEqual(restarted.results, ['accepted','accepted',null]);
    payloads.push(...restarted.payloads);
    assert.equal(await cutoff(),firstStart);
    await Promise.all([run(),run(),run()]);
    assert.deepEqual(events().map(event => [event.name,event.params.value,event.params.currency]), [
      ['purchase',1_000_000,'IDR'],['refund',100_000,'IDR'],['refund',50_000,'IDR'],
    ]);
    assert.equal(new Set(events().map(event => event.params.transaction_id)).size,1);
    assert.equal(new Set(payloads.map(payload => payload.client_id)).size,1);
    assert.equal(events().slice(1).reduce((sum, event) => sum + event.params.value, 0),150_000);
    for (const historical of [project,backdatedProject])
      assert.deepEqual((await pool.query('SELECT dispatch_state FROM crm_payment_analytics WHERE project_id=:p1 ORDER BY sequence_no',
        [historical.id])).rows.map(row => row.dispatch_state), [null,null]);

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
    assert.equal(payloads.length,5);
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
    assert.equal(payloads.length,6);
    assert.equal((await pool.query('SELECT dispatch_state FROM crm_payment_analytics WHERE project_id=:p1',
      [interrupted.id])).rows[0].dispatch_state, 'unknown');
  } finally {
    await pool.end();
    await db.end();
    await disposeNativeTest(fixture);
  }
});
