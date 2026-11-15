import assert from 'node:assert/strict';
import test from 'node:test';
import { canSelectTransfer, enrollmentRefundEstimate } from '../src/utils/enrollmentAftercare';

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
