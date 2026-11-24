import assert from 'node:assert/strict';
import test from 'node:test';
import { canSelectTransfer, enrollmentRefundEstimate } from '../src/utils/enrollmentAftercare';
import { allowsEnrollmentProof, enrollmentClosureReason, enrollmentLearnerNameKey, enrollmentOrderStatus, enrollmentOrderTone } from '../src/utils/enrollmentOrderStatus';

test('a transfer requires a cancelled source class and verified full payment',()=>{
  assert.equal(canSelectTransfer({state:'paid',received:575000,price:575000},{state:'cancelled'}),true);
  assert.equal(canSelectTransfer({state:'partial',received:500000,price:575000},{state:'cancelled'}),false);
  assert.equal(canSelectTransfer({state:'paid',received:575000,price:575000},{state:'published'}),false);
});

test('refund arithmetic applies delivered classes and never exceeds available receipts',()=>{
  const order = {price:575000,received:575000,refunded:0,transferred:0,sessions:23,delivered:3};
  assert.equal(enrollmentRefundEstimate(order),500000);
  assert.equal(enrollmentRefundEstimate({...order,received:120000,delivered:0}),120000);
  assert.equal(enrollmentRefundEstimate({...order,refunded:520000}),0);
  assert.equal(enrollmentRefundEstimate({...order,refunded:30000,transferred:20000}),450000);
});

test('paid in a cancelled class retains payment without confirming admission',()=>{
  assert.equal(enrollmentOrderStatus('paid','cancelled'),'paid_cancelled');
  assert.equal(enrollmentOrderStatus('recovered','cancelled'),'paid_cancelled');
  assert.equal(enrollmentOrderStatus('partial','cancelled'),'partial');
  assert.equal(enrollmentOrderStatus('refunded','cancelled'),'refunded');
  assert.equal(enrollmentOrderStatus('paid','published'),'paid');
});

test('enrollment status colors distinguish next actions, progress and completed records',()=>{
  assert.equal(enrollmentOrderTone('awaiting_payment'),'pending');
  assert.equal(enrollmentOrderTone('awaiting_payment',{classCancelled:true}),'progress');
  assert.equal(enrollmentOrderTone('proof_review'),'progress');
  assert.equal(enrollmentOrderTone('partial',{needsAction:true}),'pending');
  assert.equal(enrollmentOrderTone('partial'),'progress');
  assert.equal(enrollmentOrderTone('paid'),'confirmed');
  assert.equal(enrollmentOrderTone('paid_cancelled',{needsAction:true}),'pending');
  assert.equal(enrollmentOrderTone('refunding'),'progress');
  for(const state of ['expired','ended','refunded'])assert.equal(enrollmentOrderTone(state),'full');
  assert.equal(enrollmentOrderTone('ended',{restored:true}),'confirmed');
});

test('learner name identity normalizes spelling presentation without collapsing siblings',()=>{
  assert.equal(enrollmentLearnerNameKey(' Maya　 Putri '),enrollmentLearnerNameKey('ＭＡＹＡ Putri'));
  assert.notEqual(enrollmentLearnerNameKey('Maya Putri'),enrollmentLearnerNameKey('Nina Putri'));
});

test('learner cancellation and timeout stay closed with distinct reasons and permit supplemental proof',()=>{
  assert.equal(enrollmentClosureReason('ended','learner_cancelled'),'learner_cancelled');
  assert.equal(enrollmentClosureReason('expired'),'payment_timeout');
  assert.equal(enrollmentClosureReason('ended'),'staff_ended');
  assert.equal(enrollmentClosureReason('recovered'),undefined);
  assert.equal(allowsEnrollmentProof('ended','learner_cancelled'),true);
  assert.equal(allowsEnrollmentProof('expired'),true);
  assert.equal(allowsEnrollmentProof('ended'),false);
  assert.equal(allowsEnrollmentProof('refunding','learner_cancelled'),false);
});
