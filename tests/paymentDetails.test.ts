import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {CrmPaymentProjectDetail} from '../src/components/crm/CrmPaymentProjectDetail';
import type {PaymentEntry,PaymentLedger,PaymentProject} from '../src/utils/crmPayments';
const at='2026-11-01T10:00:00Z';
const project:PaymentProject={id:'p',course:'HSK 3 agreed course',expected:1000000,createdAt:at,createdBy:'sales',priceSnapshot:{sessions:30,standardPrice:1100000,discountAmount:100000,courseRevision:1},basis:{reason:'Original enrollment confirmation'}};
const entry=(id:string,amount:number,patch:Partial<PaymentEntry>={}):PaymentEntry=>({id,projectId:'p',kind:'receipt',state:'verified',amount,verifiedAmount:amount,reportedAt:at,receivedAt:at,method:'bank_transfer',provider:'BCA',account:'Company account',reference:'TX-'+id,evidence:'Original note '+id,createdAt:at,createdBy:'sales',verifiedAt:at,verifiedBy:'finance',...patch});
const render=(entries:PaymentEntry[],options:any={})=>{const ledger:PaymentLedger={projects:[project],entries,history:[]};return renderToStaticMarkup(React.createElement(CrmPaymentProjectDetail,{project,ledger,leadId:'customer',ownerName:'Sales Owner',people:{finance:'Finance Reviewer',sales:'Sales Recorder'},lang:'zh',verificationOnly:true,onChoose:()=>{},...options}));};
test('partial payment detail preserves the purchased course, agreed pricing, owner, original evidence and previous receipt alongside its remaining balance',()=>{const html=render([entry('first',400000)],{canVerify:true});for(const text of ['HSK 3 agreed course','30','课时','报名确认','Sales Owner','1.100.000','100.000','1.000.000','400.000','600.000','部分收款','支付历史','TX-first','Original note first','Finance Reviewer','Sales Recorder'])assert.ok(html.includes(text),text);assert.equal((html.match(/data-payment-entry=/g)||[]).length,1);assert.match(html,/核验收款/);assert.doesNotMatch(html,/type="submit"|<input|<textarea/);});
test('fully paid detail retains every installment and private image even when no further payment is due',()=>{const html=render([entry('first',400000,{images:[{id:'image-1',name:'Original receipt.png',mime:'image/png',bytes:40,sha256:'hash'}]}),entry('second',600000,{method:'qris',provider:'',reference:'QRIS-2'})]);assert.match(html,/已收齐/);assert.match(html,/剩余应收<\/dt><dd[^>]*>Rp 0/);assert.equal((html.match(/data-payment-entry=/g)||[]).length,2);assert.match(html,/TX-first/);assert.match(html,/QRIS-2/);assert.match(html,/\/api\/crm\/leads\/customer\/payment-images\/image-1/);assert.match(html,/400.000/);assert.match(html,/600.000/);assert.doesNotMatch(html,/核验收款|作废误记/);});
test('unpaid detail is explicit, refunded/voided facts remain visible and another project never appears in this detail',()=>{assert.match(render([]),/暂无付款或退款记录/);const html=render([entry('paid',1000000),entry('refund',100000,{kind:'refund'}),entry('void',50000,{state:'void',reason:'Original void reason'}),entry('foreign',987654,{projectId:'other-project',reference:'FOREIGN-REFERENCE'})]);assert.match(html,/已退款/);assert.match(html,/部分收款/);assert.match(html,/Original void reason/);assert.match(html,/已作废/);assert.doesNotMatch(html,/FOREIGN-REFERENCE|987.654/);assert.equal((html.match(/data-payment-entry=/g)||[]).length,3);});
test('detail without financial authority remains read-only and each fixed detail label is localized',()=>{for(const lang of ['zh','en','id']){const html=render([entry('first',400000)],{lang});assert.ok(html.includes(lang==='zh'?'支付历史':lang==='id'?'Riwayat pembayaran':'Payment history'));assert.doesNotMatch(html,/type="submit"|<input|<textarea/);assert.doesNotMatch(html,/核验收款|Verify payment|Verifikasi pembayaran|Void mistaken entry/);}const ledger:PaymentLedger={projects:[{...project,expected:null,priceSnapshot:undefined}],entries:[],history:[]};const html=render([],{project:ledger.projects[0],ledger});assert.match(html,/未确定/);assert.doesNotMatch(html,/标准价|1.100.000/);});

test('voided corrected payment retains its verified amount/time, original evidence and separate void actor without contributing to totals',()=>{
 const e=entry('corrected',600000,{state:'void',verifiedAmount:500000,reportedAt:'2026-11-01T09:00:00Z',receivedAt:'2026-11-01T10:00:00Z',reason:'Wrong enrollment'});
 const ledger:PaymentLedger={projects:[project],entries:[e],history:[{id:'v',action:'void',actor:'reviewer',at:'2026-11-02T10:00:00Z',before:{...e,state:'verified'},after:e,reason:e.reason}]};
 const html=render([e],{ledger,people:{sales:'Original Sales',finance:'Original Finance',reviewer:'Void Reviewer'}});
 assert.match(html,/<strong>付款 · Rp 500.000<\/strong>/);assert.doesNotMatch(html,/<strong>付款 · Rp 600.000<\/strong>/);
 assert.match(html,/原登记金额.*?600.000/);assert.match(html,/已作废，不计入汇总/);assert.match(html,/Void Reviewer/);assert.match(html,/Original Finance/);assert.match(html,/剩余应收<\/dt><dd[^>]*>Rp 1.000.000/);
});
test('project state and remaining balance use explicit semantic pairs, paid hides routine receipt action and all history stays available',()=>{
 const partial=render([entry('partial',400000)]);assert.match(partial,/data-tone="info">部分收款/);assert.match(partial,/crm-payment-balance" data-tone="info">Rp 600.000/);
 const paid=render([entry('paid',1000000)],{canVerify:true});assert.match(paid,/data-tone="success">已收齐/);assert.match(paid,/crm-payment-balance" data-tone="success">Rp 0/);assert.doesNotMatch(paid,/>核验收款<\/button>/);assert.match(paid,/登记额外到账/);assert.match(paid,/登记已退款项/);assert.match(paid,/class="crm-payment-more"/);
 const unpaid=render([]);assert.match(unpaid,/data-tone="neutral">未收款/);assert.doesNotMatch(unpaid,/data-tone="danger"/);
 const unknown=render([],{project:{...project,expected:null}});assert.match(unknown,/data-tone="warning">应收未确定/);
 const over=render([entry('over',1100000)]);assert.match(over,/crm-payment-balance" data-tone="warning"/);assert.match(over,/超收/);
});
test('refunds expose the net reconciliation and contract boundary while completed refund facts remain separate from approval',()=>{
 const html=render([entry('paid',1000000),entry('refund',200000,{kind:'refund',accountRole:'refund_destination'})],{canVerify:true});assert.match(html,/净收款/);assert.match(html,/800.000/);assert.match(html,/退款不自动调整约定应收/);assert.match(html,/退款去向与流水/);assert.match(html,/剩余应收<\/dt><dd[^>]*>Rp 200.000/);
});

test('payment detail removes redundant enrollment evidence entry, retains original data and distinguishes the enrollment actor from the current sales owner',()=>{
 const original=JSON.stringify(project);const html=render([]);assert.doesNotMatch(html,/查看报名依据|Original enrollment confirmation/);assert.equal(JSON.stringify(project),original);assert.match(html,/报名经办人/);assert.match(html,/Sales Recorder/);assert.match(html,/销售负责人/);assert.match(html,/Sales Owner/);
 const same=render([],{ownerName:'Sales Recorder'});assert.doesNotMatch(same,/报名经办人/);const none=render([],{ownerName:''});assert.match(none,/未分配/);
});

test('legacy account values keep their original meaning unless the saved record explicitly declares account purpose',()=>{
 const old=render([entry('old',500000)]);assert.match(old,/核实账户与流水（原记录）/);assert.doesNotMatch(old,/公司收款账户与流水|退款去向与流水/);const current=render([entry('new',500000,{accountRole:'company_receiving'})]);assert.match(current,/公司收款账户与流水/);
});
