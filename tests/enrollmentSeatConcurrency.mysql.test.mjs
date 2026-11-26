import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {test} from 'node:test';
import {setupNativeTest} from './helpers/mysql.mjs';
import {disposeNativeTest} from './helpers/disposeNativeTest.mjs';
import {enrollmentSessionCookie,enrollmentVisitorDigest,portalVisitorCookie} from '../server/portal/enrollmentVisitorSession.ts';

test('one final seat, idempotent reservations and cross-class credit from a verified receipt', {
  skip:!process.env.MYSQL_NATIVE_TEST_ENV && 'Requires authorized isolated MySQL',
}, async t => {
  const fixture=await setupNativeTest('last_seat');
  // Connect to the fixture socket before applying the company-test enrollment policy.
  delete process.env.PORTAL_DEPLOYMENT;
  const {pool}=await import('../server/portal/store.ts');
  t.after(async()=>{await pool.end();await disposeNativeTest(fixture);});
  process.env.PORTAL_ENV='test';
  process.env.PORTAL_DEPLOYMENT='company-trial';
  process.env.PORTAL_ENROLLMENT_SERVICE_ENABLED='true';
  process.env.PORTAL_ENROLLMENT_SIMULATION_DATABASE=fixture.name;
  process.env.PORTAL_ENROLLMENT_SIMULATION_MAILBOX=join(tmpdir(),'uper-unused-mailbox-'+fixture.name);
  const host='enrollment.example.invalid';
  const origin='https://'+host;
  process.env.PORTAL_PUBLIC_ORIGIN=origin;
  delete process.env.ACCESS_ALLOWED_ORIGINS;
  const {mountEnrollmentApplication}=await import('../server/portal/enrollmentApplication.ts');

  const deliveries=[];
  t.mock.method(globalThis,'fetch',async (...args)=>{
    deliveries.push(args);
    throw Error('Enrollment concurrency test cannot send to an external service');
  });
  await pool.query('INSERT INTO enrollment_mail_configuration(environment,revision,config) VALUES(:p1,:p2,:p3)',
    ['test',0,{delivery:{mode:'simulation',generation:'last-seat-fixture'}}]);
  await pool.query('INSERT INTO crm_courses(id,revision,value) VALUES(:p1,1,:p2)',
    ['fixture-course',{name:'HSK 1',sessions:24,price:875000,active:true}]);
  const classId='fixture-last-seat';
  const classData={level:'HSK 1',format:'standard',period:'weekend',firstLesson:'2037-01-03T15:00',
    enrollmentCloses:'2037-01-03T00:00',schedule:'Saturday 15:00–16:30 WIB',weeklySchedule:{days:[6],start:'15:00',lessons:2},
    sessions:24,minutes:45,price:875000,capacity:1,minimumPaid:1};
  await pool.query(`INSERT INTO enrollment_classes(id,course_id,revision,state,first_lesson_at,enrollment_closes_at,data,updated_at)
    VALUES(:p1,'fixture-course',1,'published','2037-01-03 08:00:00','2037-01-02 17:00:00',:p2,UTC_TIMESTAMP(6))`,[classId,classData]);

  // Exercise the public application handler with genuine persisted sessions and transactions.
  // There is no HTTP server, real mailbox or worker.
  const routes=new Map();
  const app={get:(path,handler)=>routes.set('GET '+path,handler),post:(path,handler)=>routes.set(path,handler)};
  const unexpected=()=>{throw Error('Unexpected staff or visitor setup call');};
  mountEnrollmentApplication(app,{wrap:handler=>handler,staff:unexpected,visitor:unexpected});
  const route=routes.get('/api/enrollment/applications');
  assert.ok(route);
  async function learner(index) {
    const email=`learner-${index}@example.invalid`;
    const visitor=randomBytes(32).toString('hex');
    const session=randomBytes(32).toString('hex');
    await pool.query(`INSERT INTO enrollment_email_sessions(digest,email,expires_at)
      VALUES(:p1,:p2,TIMESTAMPADD(HOUR,1,UTC_TIMESTAMP(6)))`,[enrollmentVisitorDigest(session,visitor),email]);
    const headers={origin,host,cookie:`${portalVisitorCookie}=${visitor}; ${enrollmentSessionCookie}=v2.${session}`};
    const learnerRequestId=randomUUID();
    const invoke=async(handler,body={},params={})=>{
      let output;
      const res={set:()=>res,json:value=>{output=value;}};
      await handler({body,params,headers,protocol:'https',is:type=>type==='application/json',get:name=>headers[name.toLowerCase()]},res);
      assert.ok(output);
      return output;
    };
    const apply=(targetClass=classId,requestId=learnerRequestId)=>invoke(route,{
      classId:targetClass,requestId,name:'Test Learner '+index,phone:`+628123400000${index}`,priority:false,
    });
    return Object.assign(apply,{invoke,requestId:learnerRequestId});
  }
  const learners=await Promise.all([learner(1),learner(2)]);
  const outcomes=await Promise.allSettled(learners.map(apply=>apply()));
  assert.equal(outcomes.filter(outcome=>outcome.status==='fulfilled').length,1);
  const winner=outcomes.findIndex(outcome=>outcome.status==='fulfilled');
  const order=outcomes[winner].value;
  assert.equal(outcomes[1-winner].reason.status,409);
  assert.equal(outcomes[1-winner].reason.message,'enrollment_class_full');
  assert.equal((await learners[winner]()).id,order.id);
  const {rows:orders}=await pool.query('SELECT id,state,price,received FROM enrollment_orders WHERE class_id=:p1',[classId]);
  assert.deepEqual(orders.map(row=>[row.id,row.state,Number(row.price),Number(row.received)]),
    [[order.id,'awaiting_payment',875000,0]]);
  const {rows:receipts}=await pool.query('SELECT kind,state FROM enrollment_notification_receipts WHERE subject_id=:p1',[order.id]);
  assert.deepEqual(receipts.map(row=>[row.kind,row.state]),[['seat_reserved','simulated']]);
  const winningLearner=learners[winner];
  const otherLearner=learners[1-winner];
  const applicationResult=routes.get('GET /api/enrollment/applications/results/:requestId');
  const originalRequest={requestId:winningLearner.requestId};
  assert.equal((await winningLearner.invoke(applicationResult,{},originalRequest)).order.id,order.id);
  assert.deepEqual(await otherLearner.invoke(applicationResult,{},originalRequest),{state:'unconfirmed'});
  const proofRoot='/api/enrollment/orders/:id/proofs';
  const params={id:order.id};
  const {uploadId}=await winningLearner.invoke(routes.get(proofRoot+'/start'),{},params);
  const readProof=routes.get('GET '+proofRoot+'/:uploadId/result');
  assert.deepEqual(await winningLearner.invoke(readProof,{},{...params,uploadId}),
    {state:'unconfirmed',proofTransport:'binary-v1',uploadActive:true});
  assert.deepEqual(await winningLearner.invoke(readProof,{},{...params,uploadId:randomUUID()}),
    {state:'unconfirmed',proofTransport:'binary-v1',uploadActive:false});
  const encoded=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(8)]).toString('base64');
  const proof={uploadId,encoded,mime:'image/png'};
  const finish=routes.get(proofRoot+'/finish');
  for(const reportedAmount of [undefined,0,1.5,'160000']){
    await assert.rejects(winningLearner.invoke(finish,{...proof,reportedAmount},params),
      /enrollment_invalid_proof_amount/);
  }
  assert.deepEqual(await winningLearner.invoke(readProof,{},{...params,uploadId}),
    {state:'unconfirmed',proofTransport:'binary-v1',uploadActive:true});
  await winningLearner.invoke(finish,{...proof,reportedAmount:160000},params);
  assert.equal((await winningLearner.invoke(readProof,{},{...params,uploadId})).order.status,'proof_review');
  const replay=await winningLearner.invoke(routes.get(proofRoot+'/start'),{previousUploadId:uploadId},params);
  assert.equal(replay.state,'saved');
  assert.equal(replay.order.id,order.id);
  assert.equal(replay.uploadId,undefined);
  await winningLearner.invoke(finish,proof,params);
  const storedProofs=(await pool.query("SELECT transfer_details->>'$.amount' AS amount,transfer_details->>'$.reference' AS reference FROM enrollment_proofs WHERE order_id=:p1",[order.id])).rows;
  assert.deepEqual(storedProofs.map(row=>[Number(row.amount),row.reference]),[[160000,null]]);
  await assert.rejects(otherLearner.invoke(readProof,{},{...params,uploadId}),/enrollment_order_not_found/);

  await pool.query("UPDATE enrollment_orders SET state='expired',received=160000 WHERE id=:p1",[order.id]);
  await pool.query(`INSERT INTO enrollment_receipts(reference,order_id,amount,actor,settled_at,created_at)
    VALUES('verified-fixture-receipt',:p1,160000,'finance-fixture',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))`,[order.id]);
  const nextClass='fixture-next-class';
  await pool.query(`INSERT INTO enrollment_classes(id,course_id,revision,state,first_lesson_at,enrollment_closes_at,data,updated_at)
    SELECT :p1,course_id,1,state,first_lesson_at,enrollment_closes_at,data,UTC_TIMESTAMP(6)
    FROM enrollment_classes WHERE id=:p2`,[nextClass,classId]);
  const fundedRequest=randomUUID();
  const funded=await learners[winner](nextClass,fundedRequest);
  assert.equal(funded.received,160000);
  assert.equal(funded.creditIn,160000);
  assert.equal((await learners[winner](nextClass,fundedRequest)).id,funded.id);
  const {rows:credits}=await pool.query('SELECT source_order_id,target_order_id,amount FROM enrollment_payment_credits');
  assert.deepEqual(credits.map(row=>[row.source_order_id,row.target_order_id,Number(row.amount)]),[[order.id,funded.id,160000]]);
  assert.equal(Number((await pool.query('SELECT received FROM enrollment_orders WHERE id=:p1',[order.id])).rows[0].received),0);
  assert.deepEqual(deliveries,[]);
});
