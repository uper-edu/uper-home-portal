import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {enrollmentLearnerPayment,enrollmentProofGroupId,enrollmentReceiptProofId,readEnrollmentLearnerPaymentRows,withEnrollmentReceiptProofLinks} from '../server/portal/enrollmentLearnerPayments';

const bank={name:'Fixture Bank',accountName:'Fixture',accountNumber:'01234'};
const order={state:'proof_review',price:920_000,received:0,before_due:1,data:{bank}};
const first={id:'first',digest:'image-a',submittedAt:'2027-01-02T00:00:00.000Z',details:{transferId:'first',amount:600_000,reference:'BANK-FIRST'}};
const second={id:'second',digest:'image-b',submittedAt:'2027-01-03T00:00:00.000Z',details:{transferId:'second',amount:320_000,reference:'BANK-SECOND'}};
const verified={reference:'BANK-FIRST',amount:580_000};

test('estimated top-up accounts once for each unverified transfer, then replaces its declaration with actual receipts',()=>{
  const estimate=enrollmentLearnerPayment(order,'published',{proofs:[first],receipts:[]});
  assert.deepEqual(estimate.payment,{balance:320_000,estimated:true,action:'top_up',awaitingVerification:true});
  assert.equal(estimate.transfers[0].amount,600_000);
  assert.equal(estimate.transfers[0].reference,'••••IRST');
  assert.ok(!('digest' in estimate.transfers[0]));
  const partial={...order,state:'partial',received:580_000};
  const cleared=enrollmentLearnerPayment(partial,'published',{proofs:[first],receipts:[verified]});
  assert.deepEqual(cleared.payment,{balance:340_000,estimated:false,action:'top_up',awaitingVerification:false});
  assert.equal(cleared.transfers[0].verifiedAmount,580_000);
  const secondPending=enrollmentLearnerPayment(partial,'published',{proofs:[first,second],receipts:[verified]});
  assert.deepEqual(secondPending.payment,{balance:20_000,estimated:true,action:'top_up',awaitingVerification:true});
  const bothPending=enrollmentLearnerPayment(order,'published',{proofs:[first,second],receipts:[]});
  assert.deepEqual(bothPending.payment,{balance:0,estimated:true,action:'wait',awaitingVerification:true});
});

test('duplicate files, matching references and attached files resolve to the same transfer',()=>{
  assert.equal(enrollmentProofGroupId([first],'repeat',first.digest),'first');
  assert.equal(enrollmentProofGroupId([first],'extra','new-image',first.details.reference),'first');
  assert.equal(enrollmentProofGroupId([first],'extra','new-image',undefined,'first'),'first');
  assert.equal(enrollmentProofGroupId([first],'new','new-image'),'new');
  assert.equal(enrollmentProofGroupId([first,second],'extra',second.digest,undefined,'first'),undefined);
  assert.equal(enrollmentProofGroupId([first],'extra','new-image',undefined,'not-this-order'),undefined);
  const supporting={id:'extra',digest:'extra-image',submittedAt:second.submittedAt,details:{transferId:'first'}};
  const summary=enrollmentLearnerPayment(order,'published',{proofs:[first,supporting],receipts:[]});
  assert.equal(summary.payment.balance,320_000);
  assert.equal(summary.transfers.length,1);
  assert.equal(summary.transfers[0].proofCount,2);
});

test('a finance receipt without a verified link to a declaration makes a top-up unsafe until Finance identifies the transfer',()=>{
  const withoutReference={...first,details:{transferId:'first',amount:600_000}};
  const partial={...order,state:'partial',received:580_000};
  const rows={proofs:[withoutReference,second],receipts:[verified]};
  const waiting=enrollmentLearnerPayment(partial,'published',rows);
  assert.deepEqual(waiting.payment,{balance:null,estimated:false,action:'wait',awaitingVerification:true});
  const link=enrollmentReceiptProofId(rows.proofs,'first',verified.reference,[]);
  assert.equal(link,'first');
  const reconciled=enrollmentLearnerPayment(partial,'published',withEnrollmentReceiptProofLinks(rows,{[verified.reference]:link}));
  assert.equal(reconciled.payment.balance,20_000);
  assert.equal(enrollmentReceiptProofId(rows.proofs,'first',second.details.reference,[]),undefined);
  assert.equal(enrollmentReceiptProofId(rows.proofs,'first','DIFFERENT-RECEIPT',[{...verified,proofId:'first'}]),undefined);
  assert.equal(enrollmentReceiptProofId(rows.proofs,'other-order-proof',verified.reference,[]),undefined);
});

test('eligibility follows the original deadline, published class and valid bank, and counts order credit in received exactly once',()=>{
  const rows={proofs:[first],receipts:[]};
  assert.equal(enrollmentLearnerPayment({...order,before_due:0},'published',rows).payment.action,'wait');
  assert.equal(enrollmentLearnerPayment(order,'cancelled',rows).payment.action,'none');
  for(const state of ['ended','expired','paid','recovered','refunding','refunded'])
    assert.equal(enrollmentLearnerPayment({...order,state},'published',rows).payment.action,'none');
  assert.equal(enrollmentLearnerPayment({...order,data:{}},'published',rows).payment.action,'wait');
  assert.deepEqual(enrollmentLearnerPayment({...order,received:100_000},'published',rows).payment,
    {balance:220_000,estimated:true,action:'top_up',awaitingVerification:true});
  assert.equal(enrollmentLearnerPayment({...order,received:920_000,state:'paid'},'published',rows).payment.balance,0);
  assert.equal(enrollmentLearnerPayment(order,'published').payment.action,'wait');
  const oldProof={...first,details:null};
  assert.equal(enrollmentLearnerPayment(order,'published',{proofs:[oldProof],receipts:[]}).payment.balance,null);
  assert.equal(enrollmentLearnerPayment({...order,state:'partial',data:{},received:580_000},'published',
    {proofs:[first],receipts:[verified]}).payment.action,'support');
});

test('payment metadata is batched by verified order IDs and never queries proof bytes',async()=>{
  const client={query:async(sql:string,args?:unknown[])=>{
    assert.deepEqual(args,[JSON.stringify(['order-a','order-b'])]);
    assert.match(sql,/JOIN enrollment_proofs p ON p.order_id=picked.id/);
    assert.match(sql,/JOIN enrollment_receipts r ON r.order_id=picked.id/);
    assert.doesNotMatch(sql,/p\.proof\b/);
    return {rows:[{orderId:'order-a',id:first.id,digest:first.digest,submittedAt:first.submittedAt,details:JSON.stringify(first.details)},
      {orderId:'order-b',id:null,reference:verified.reference,amount:String(verified.amount)}]};
  }};
  const rows=await readEnrollmentLearnerPaymentRows(client,['order-a','order-b']);
  assert.deepEqual(rows.get('order-a')?.proofs[0].details,first.details);
  assert.deepEqual(rows.get('order-b'),{proofs:[],receipts:[verified]});
});
