import './helpers/mockPortalDatabase.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Express, Request, Response } from 'express';
import { mountEnrollmentResolution } from '../server/portal/enrollmentResolution';
import { parseEnrollmentCancellation } from '../src/utils/enrollmentCancellation';

test('cancellation accepts checkboxes, a custom reason, or both', () => {
  assert.deepEqual(parseEnrollmentCancellation({reasons:['budget']}), {reasons:['budget']});
  assert.deepEqual(parseEnrollmentCancellation({note:'  Custom reason  '}), {reasons:[],note:'Custom reason'});
  assert.deepEqual(parseEnrollmentCancellation({reasons:['budget','schedule_conflict'],note:'  More detail  '}),
    {reasons:['schedule_conflict','budget'],note:'More detail'});
  for (const body of [{}, {note:'  '}, {reasons:['unknown']}, {reasons:['budget','budget']},
    {reasons:'budget'}, {note:10}, {reasons:['budget'],note:'x'.repeat(301)}]) {
    assert.equal(parseEnrollmentCancellation(body),null);
  }
});

test('learner cancellation records the feedback once and keeps the payment and ownership checks', async () => {
  type Context = Parameters<typeof mountEnrollmentResolution>[1];
  type Handler = Parameters<Context['post']>[1];
  const routes = new Map<string,Handler>();
  const order = {state:'awaiting_payment',received:0,upload_active:0,data:{closureReason:''}};
  const cohort = {id:'class-1',state:'published',accepting:1,course_active:1,data:{capacity:12}};
  const audit: unknown[] = [];
  let proofExists=false;
  let writes=0;
  const unexpected=async()=>{throw Error('Unexpected operation');};
  const client = {
    async query(sql:string, params?:unknown[]) {
      if(sql.includes('FROM enrollment_proofs'))return {rows:proofExists?[{}]:[]};
      if(sql.startsWith('SELECT target_class_id FROM enrollment_transfer_invitations'))return {rows:[]};
      if(sql.startsWith('SELECT (SELECT COUNT(*) FROM enrollment_orders'))return {rows:[{count:1}]};
      if(sql.startsWith('SELECT is_full,cycle FROM enrollment_vacancy_cycles'))return {rows:[{is_full:0,cycle:0}]};
      writes++;
      if(sql.startsWith('UPDATE enrollment_orders SET state=')) {
        order.state='ended';
        order.data.closureReason='learner_cancelled';
      } else if(sql.includes('INSERT INTO portal_audit')) {
        audit.push(params?.[0]);
      } else if(!sql.startsWith('UPDATE enrollment_transfer_invitations')) {
        throw Error('Unexpected query: '+sql);
      }
      return {rows:[]};
    },
  };
  mountEnrollmentResolution({get:()=>{}} as unknown as Express,{
    wrap:handler=>handler,
    post:(path,handler)=>{routes.set(path,handler);},
    transact:work=>work(client),
    read:unexpected,
    session:async(_client,request)=>String(request.headers['x-enrollment-email']),
    lockOrder:async(_client,id,email)=>{
      assert.equal(id,'order-1');
      if(email!=='learner@example.invalid')throw Object.assign(Error('Missing order'),{status:404});
      return {order,cohort};
    },
    lockClass:unexpected,expireSeats:unexpected,financeActor:unexpected,supportActor:unexpected,
  });
  const cancel=routes.get('/api/enrollment/orders/:id/cancel')!;
  const call=async(body:unknown,email='learner@example.invalid')=>{
    let result:unknown;
    await cancel(
      {params:{id:'order-1'},headers:{'x-enrollment-email':email},body} as Request,
      {json:(data:unknown)=>{result=data;}} as Response,
    );
    return result;
  };

  await assert.rejects(call({reasons:['budget']},'other@example.invalid'),{status:404});
  await assert.rejects(call({}),{message:'enrollment_cancel_reason_invalid',status:400});
  order.upload_active=1;
  await assert.rejects(call({reasons:['budget']}),{message:'enrollment_cancel_not_available',status:409});
  order.upload_active=0;
  proofExists=true;
  await assert.rejects(call({reasons:['budget']}),{message:'enrollment_cancel_not_available',status:409});
  proofExists=false;
  order.received=1;
  await assert.rejects(call({reasons:['budget']}),{message:'enrollment_cancel_not_available',status:409});
  order.received=0;
  assert.equal(writes,0);

  const result={orderId:'order-1',state:'ended',closureReason:'learner_cancelled'};
  assert.deepEqual(await call({reasons:['budget','schedule_conflict'],note:'  Changes at work.  '}),result);
  assert.deepEqual(await call({reasons:['plans_changed']}),result);
  assert.deepEqual(audit,[{
    orderId:'order-1', classId:'class-1', closureReason:'learner_cancelled',
    cancellation:{reasons:['schedule_conflict','budget'],note:'Changes at work.'},
  }]);
  assert.equal(writes,3);
});
