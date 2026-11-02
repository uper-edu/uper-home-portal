import {test} from 'node:test';import assert from 'node:assert/strict';
import {paymentAmount,paymentInstant,paymentSummary,emptyPaymentLedger} from '../src/utils/crmPayments.ts';
import {campaignMetrics} from '../src/utils/crmCampaignMetrics.ts';
test('receivables distinguish unknown fee from free enrollment; budget or Paid does not count as a receipt',()=>{
 const l=emptyPaymentLedger(),p={id:'p',course:'HSK 2',expected:null,createdAt:'',createdBy:''};
 assert.equal(paymentSummary(l,p).state,'unpriced');assert.equal(paymentSummary(l,{...p,expected:0}).state,'nocharge');assert.equal(paymentSummary(l,{...p,expected:100}).net,0);
});
test('financial inputs reject rounded floats, scientific notation, negative money and impossible or offset-free dates',()=>{
 for(const v of [-1,0,1.5,'1e6','1,000',true,null])assert.throws(()=>paymentAmount(v));assert.equal(paymentAmount('1500000'),1500000);
 for(const v of ['2020-02-30T12:00:00Z','2020-01-01T12:00','2099-01-01T00:00:00Z'])assert.throws(()=>paymentInstant(v));assert.equal(paymentInstant('2020-01-01T07:00:00+07:00'),'2020-01-01T00:00:00.000Z');
});
test('merged customer collections are attributed once to their actual source, never to every campaign',()=>{
 const l:any={id:'a',campaignId:'first',identitySources:[{id:'b',campaignId:'second'}],verifiedPayments:{sources:[{sourceLeadId:'a',received:100,refunded:20,net:80},{sourceLeadId:'b',received:50,refunded:0,net:50}]}};
 const first=campaignMetrics([l,l],{id:'first'}),second=campaignMetrics([l],{id:'second'});
 assert.equal(first.verifiedNet,80);assert.equal(second.verifiedNet,50);assert.equal(first.verifiedReceived+second.verifiedReceived,150);assert.equal(campaignMetrics([{...l,verifiedPayments:undefined,revenue:999,outcome:'Paid'}],{id:'first'}).verifiedNet,0);
});
