import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {EnrollmentPayment} from '../src/components/EnrollmentPayment';
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

test('paused payment hides the original deadline and renders the remaining time after resume',t=>{
  const oldDeadline='2027-01-04T10:00:00.000Z';
  let now=Date.parse(oldDeadline)-2*paymentMinuteMs;
  t.mock.method(Date,'now',()=>now);
  const render=(deadline:string,paymentPaused=false)=>renderToStaticMarkup(createElement(EnrollmentPayment,{
    order:{id:'order',classId:'class',status:'awaiting_payment',restored:false,price:920000,received:0,deadline,paymentPaused},
    language:'zh',status:'待付款',canUpload:false,busy:false,proofTransfer:{amount:'',reference:''},
    setFile(){},onProofTransferChange(){},upload(){},
  }));

  assert.match(render(oldDeadline),/剩余 2 分钟/);
  for(const moment of [now,Date.parse(oldDeadline)+paymentMinuteMs]){
    now=moment;
    const paused=render(oldDeadline,true);
    assert.match(paused,/付款已暂停/);
    assert.doesNotMatch(paused,/enrollment-payment-deadline|<time\b|付款时间已到|剩余 \d+ 分钟/);
  }
  assert.match(render(oldDeadline),/付款时间已到/);

  const resumedDeadline=new Date(now+2*paymentMinuteMs).toISOString();
  const resumed=render(resumedDeadline);
  assert.ok(resumed.includes(`dateTime="${resumedDeadline}"`));
  assert.match(resumed,/剩余 2 分钟/);
  assert.doesNotMatch(resumed,/付款时间已到/);
});
