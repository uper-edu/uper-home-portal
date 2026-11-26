import assert from 'node:assert/strict';
import test from 'node:test';
import {nextPaymentClockDelay,paymentMinuteMs} from '../src/utils/enrollmentPaymentClock';

test('payment updates at the next displayed minute and at the exact cutoff',()=>{
  const now=Date.parse('2027-01-04T09:57:59.500Z');
  const deadline=Date.parse('2027-01-04T10:00:00Z');
  assert.equal(nextPaymentClockDelay(now,deadline,NaN),500);
  assert.equal(nextPaymentClockDelay(now+500,deadline,NaN),paymentMinuteMs);
  assert.equal(nextPaymentClockDelay(deadline-123,deadline,NaN),123);
  assert.equal(nextPaymentClockDelay(deadline,deadline,NaN),undefined);
});

test('first lesson can refresh independently of a payment cutoff or partial balance',()=>{
  const now=100_000;
  assert.equal(nextPaymentClockDelay(now,now+60_500,now+300),300);
  assert.equal(nextPaymentClockDelay(now,NaN,now+300),300);
  assert.equal(nextPaymentClockDelay(now,NaN,now),undefined);
  assert.equal(nextPaymentClockDelay(now,NaN,now+3_000_000_000),2_147_483_647);
});
