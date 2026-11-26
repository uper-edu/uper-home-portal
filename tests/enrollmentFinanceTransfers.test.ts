import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import type {Express,Request,Response} from 'express';
import {readEnrollmentFinanceProgress,readEnrollmentFinanceWorklist} from '../server/portal/enrollmentFinanceWorklist.ts';

const orderId='71f63e18-c5aa-4a35-a339-dc03f99a7521';
const manualOrderId='10d20262-5354-4441-b390-0ec0faad8a90';
const firstId='e35f445e-732b-467c-a1e7-061f8e467281';
const extraId='aa2d825a-195f-4b4f-b518-b87c7ae2ece1';
const secondId='6ec91651-42a8-40ed-a079-13e5bde3aa3b';
const firstAt='2026-11-20T00:00:00.000000Z';
const secondAt='2026-11-20T01:00:00.000000Z';
const due='2026-11-21T04:00:00.000000Z';
const proofRow=(id:string,transferId:string,amount:number|undefined,reference:string|undefined,submittedAt:string)=>({
  orderId,id,digest:id,details:JSON.stringify({transferId,amount,reference}),submittedAt,
});
const proofs=[
  proofRow(firstId,firstId,600_000,'BANK-A',firstAt),
  proofRow(secondId,secondId,320_000,undefined,secondAt),
  proofRow(extraId,firstId,undefined,undefined,'2026-11-20T02:00:00.000000Z'),
];

test('finance queue counts transfers, retains unmatched transfers on settled orders and paginates by transfer',async()=>{
  const row={id:orderId,state:'proof_review',received:0,price:920_000,class_state:'published',name:'Mock learner',
    level:'HSK 1',format:'standard',period:'weekend',firstLessonAt:'2026-11-28',
    data:{firstProofAvailableAt:firstAt,firstReviewDueAt:due,learnerReceiptProofLinks:{} as Record<string,string>}};
  let receipts:{orderId:string;reference:string;amount:number}[]=[];
  const client={query:async(sql:string,args?:unknown[])=>{
    if(sql.startsWith('SELECT o.id')){
      assert.deepEqual(args,['mock']);
      assert.match(sql,/o\.state NOT IN \('refunding','refunded'\)/);
      assert.doesNotMatch(sql,/r\.created_at/);
      return {rows:[row]};
    }
    assert.deepEqual(args,[JSON.stringify([orderId])]);
    return {rows:[...proofs,...receipts]};
  }};
  const page1=await readEnrollmentFinanceWorklist(client,'mock',1,1);
  assert.equal(page1.total,2);
  assert.deepEqual(page1.orders.map(({transfer,reviewDueAt})=>({transfer,reviewDueAt})),[
    {transfer:{id:firstId,amount:600_000,proofCount:2},reviewDueAt:due},
  ]);
  assert.equal((await readEnrollmentFinanceWorklist(client,'mock',2,1)).orders[0].transfer.id,secondId);
  receipts=[{orderId,reference:'BANK-A',amount:920_000}];
  Object.assign(row,{state:'paid',received:920_000});
  const next=await readEnrollmentFinanceWorklist(client,'mock',2,1);
  assert.equal(next.page,1);
  assert.equal(next.total,1);
  assert.equal(next.orders[0].status,'paid');
  assert.equal(next.orders[0].transfer.id,secondId);
  assert.equal(next.orders[0].reviewDueAt,undefined);
  receipts.push({orderId,reference:'BANK-B',amount:320_000});
  row.data.learnerReceiptProofLinks['BANK-B']=secondId;
  assert.equal((await readEnrollmentFinanceWorklist(client,'mock',1,25)).total,0);
});

test('order progress counts reported transfer groups, with proofless receipts separate until linked',async()=>{
  const refundedId='fixture-refund';
  const unknownAmount={...proofRow('no-amount','no-amount',undefined,'MISSING-AMOUNT',secondAt),orderId:refundedId};
  const orders=[
    {id:orderId,state:'paid',learnerReceiptProofLinks:{'BANK-A':null}},
    {id:manualOrderId,state:'partial'},
    {id:refundedId,state:'refunded'},
  ];
  const client={query:async(sql:string,args?:unknown[])=>{
    assert.match(sql,/WITH picked AS/);
    assert.deepEqual(args,[JSON.stringify(orders.map(order=>order.id))]);
    return {rows:[...proofs,unknownAmount,{orderId,reference:'BANK-A',amount:920_000},
      {orderId:manualOrderId,reference:'WITHOUT-PROOF',amount:150_000}]};
  }};
  const progress=await readEnrollmentFinanceProgress(client,orders);
  assert.deepEqual(progress.get(orderId),{
    reported:2,verified:0,pending:2,reportedTotal:920_000,missingAmounts:0,nextTransferId:firstId,
  });
  assert.deepEqual(progress.get(manualOrderId),{
    reported:0,verified:0,pending:0,reportedTotal:0,missingAmounts:0,nextTransferId:undefined,
  });
  assert.deepEqual(progress.get(refundedId),{
    reported:1,verified:0,pending:1,reportedTotal:0,missingAmounts:1,nextTransferId:undefined,
  });
  orders[0].learnerReceiptProofLinks={'BANK-A':firstId};
  assert.deepEqual((await readEnrollmentFinanceProgress(client,orders)).get(orderId),{
    reported:2,verified:1,pending:1,reportedTotal:920_000,missingAmounts:0,nextTransferId:secondId,
  });
});

test('the finance routes can locate a proofless order and link existing receipts without recording more money',async()=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const {mountEnrollmentApplication}=await import('../server/portal/enrollmentApplication.ts');
  const {operationContext}=await import('../server/portal/operationContext.ts');
  const previous=process.env;
  process.env={...previous,PORTAL_ENV:'test',PORTAL_DEPLOYMENT:'company-trial',PORTAL_ENROLLMENT_SERVICE_ENABLED:'true'};
  try{
    type Handler=(q:Request,r:Response)=>Promise<unknown>;
    const routes=new Map<string,Handler>();
    const register=(method:string)=>(path:string,handler:Handler)=>routes.set(method+' '+path,handler);
    let scope='all';
    mountEnrollmentApplication({get:register('GET'),post:register('POST')} as unknown as Express,{
      wrap:fn=>fn,staff:async(_q,permission)=>{
        assert.equal(permission,'crm.payments.verify');
        return {id:'fixture-finance',scope,permissions:['crm.read','crm.payments.verify']} as never;
      },visitor:async()=>assert.fail('learner permission was consulted for a finance route'),
    });
    const order={id:orderId,class_id:'fixture-class',class_state:'published',state:'paid',received:920_000,price:920_000,
      payment_due_at:'2026-11-22 00:00:00',data:{name:'Fixture',learnerReceiptProofLinks:{} as Record<string,string|null>}};
    const manualOrder={...order,id:manualOrderId,state:'awaiting_payment',received:0,data:{...order.data,learnerReceiptProofLinks:{}}};
    const receipt={orderId,reference:'BANK-ALREADY-SAVED',amount:920_000};
    const knownReferences=new Set([receipt.reference]);
    const operations=new Map<string,{fingerprint:string;result:unknown}>();
    let writes=0,reads=0,inserted=0;
    const client={transactionIsolation:'READ COMMITTED',query:async(sql:string,args:unknown[]=[])=>{
      reads++;
      if(sql.startsWith('SELECT ranked.*')){
        assert.deepEqual(args,['','all',0,25]);
        return {rows:[{...order,receipt_proof_links:JSON.stringify(order.data.learnerReceiptProofLinks),
          name:order.data.name,has_proof:1,total:1}]};
      }
      if(sql.includes('SELECT o.*,e.state')){
        assert.deepEqual(args,[manualOrderId,1]);
        assert.match(sql,/WHERE \(:p1='' OR o.id=:p1\) AND \(:p2=1 OR/);
        return {rows:[manualOrder]};
      }
      if(sql.includes("id='enrollment_bank'"))return {rows:[]};
      if(sql.startsWith('SELECT order_id, reference')||sql.startsWith('SELECT id,source_order_id'))return {rows:[]};
      if(sql.startsWith('SELECT GET_LOCK'))return {rows:[{locked:1}]};
      if(sql.startsWith('SELECT * FROM crm_operations'))return {rows:operations.has(String(args[1]))?[operations.get(String(args[1]))]:[]};
      if(sql.startsWith('SELECT id,class_id,email FROM enrollment_orders'))return {rows:[args[0]===manualOrderId?manualOrder:order]};
      if(sql.includes('FROM enrollment_classes WHERE id=:p1 FOR UPDATE'))return {rows:[{id:order.class_id,state:'published',data:{minimumPaid:1}}]};
      if(sql.startsWith("UPDATE enrollment_orders SET state='expired'"))return {rows:[]};
      if(sql.includes('FROM enrollment_orders WHERE id=:p1 FOR UPDATE'))return {rows:[args[0]===manualOrderId?manualOrder:order]};
      if(sql.startsWith('WITH picked AS'))return {rows:[...proofs,receipt]};
      if(sql.startsWith('UPDATE enrollment_orders SET data=')){
        assert.equal(args[1],orderId);
        order.data=args[0] as typeof order.data;
        writes++;
        return {rows:[]};
      }
      if(sql.startsWith('INSERT INTO enrollment_receipts')){
        const [reference,id]=args;
        if(knownReferences.has(String(reference)))throw Object.assign(new Error('Duplicate'),{code:'ER_DUP_ENTRY'});
        assert.deepEqual(args.slice(0,4),[id===manualOrderId?'MANUAL-01':'BANK-A',id,100_000,'fixture-finance']);
        knownReferences.add(String(reference));
        inserted++;
        return {rows:[]};
      }
      if(sql.startsWith('SELECT COALESCE(SUM(r.amount-'))return {rows:[{sum:100_000}]};
      if(sql.startsWith('UPDATE enrollment_orders SET received=')){
        const target=args[3]===manualOrderId?manualOrder:order;
        target.received=Number(args[0]);target.state=String(args[1]);target.data=args[2] as typeof target.data;
        return {rows:[]};
      }
      if(sql.startsWith('SELECT COUNT(*) AS count FROM enrollment_orders'))return {rows:[{count:1}]};
      if(sql.startsWith('SELECT opened_at'))return {rows:[{opened_at:'2026-11-22 00:00:00'}]};
      if(sql.startsWith('SELECT * FROM enrollment_orders WHERE'))return {rows:[args[0]===manualOrderId?manualOrder:order]};
      if(sql.startsWith('INSERT INTO crm_operations')){
        operations.set(String(args[1]),{fingerprint:String(args[2]),result:args[3]});
        return {rows:[]};
      }
      assert.fail('Unexpected finance query: '+sql);
    }};
    const id='b19fcc1f-7066-45cf-8fad-b1a551d1f766';
    const invoke=async(method:string,route:string,options:{order?:string;body?:unknown;query?:unknown}={})=>{
      const request={query:options.query??{},params:{id:options.order??orderId},body:options.body,
        headers:{origin:'http://localhost:3000'},protocol:'http',get:(name:string)=>name==='host'?'localhost:3000':undefined,
        is:()=>true} as unknown as Request;
      let value:any;
      const response={set:()=>response,json:(data:unknown)=>{value=data;}} as unknown as Response;
      await operationContext.run(client,()=>routes.get(method+' /api/crm/enrollment/finance'+route)!(request,response));
      return value;
    };
    const lookup=await invoke('GET','',{query:{order:manualOrderId,bankLookup:'1'}});
    assert.equal(lookup.orders[0].status,'awaiting_payment');
    assert.equal(lookup.orders[0].proofs.length,0);
    await assert.rejects(invoke('GET','',{query:{order:'not-an-order',bankLookup:'1'}}),{message:'enrollment_invalid_order_number'});
    const link={existingReference:receipt.reference,proofId:secondId,requestId:id};
    await assert.rejects(invoke('POST','/:id/receipts',{body:{...link,existingReference:'WRONG'}}),{status:409});
    const saved=await invoke('POST','/:id/receipts',{body:link});
    assert.equal(saved.order.received,920_000);
    assert.equal(saved.operationKind,'enrollment.receipt');
    assert.equal(order.data.learnerReceiptProofLinks[receipt.reference],secondId);
    const worklist=await invoke('GET','/worklist',{query:{status:'all'}});
    assert.deepEqual(worklist.orders[0].progress,{
      reported:2,verified:1,pending:1,reportedTotal:920_000,missingAmounts:0,nextTransferId:firstId,
    });
    assert.equal(writes,1);
    assert.equal((await invoke('POST','/:id/receipts',{body:link})).replayed,true);
    assert.equal(writes,1);
    await assert.rejects(invoke('POST','/:id/receipts',{body:{...link,proofId:firstId,requestId:'1e3fcfb4-a538-4f16-bd5f-a4769d49c086'}}),{status:409});
    assert.equal(inserted,0);
    const bankDetails={amount:100_000,receivingAccount:'Fixture bank',transferredAt:'2026-11-21T01:02:00Z'};
    const manual=await invoke('POST','/:id/receipts',{order:manualOrderId,body:{...bankDetails,reference:'MANUAL-01',
      requestId:'41fb17e7-875a-4031-8eb3-4991744cdc92'}});
    assert.equal(manual.order.status,'partial');
    assert.equal(manual.order.received,100_000);
    assert.equal(inserted,1);
    assert.deepEqual(manualOrder.data.learnerReceiptProofLinks,{'MANUAL-01':null});
    const additional={...bankDetails,reference:'BANK-A',proofId:firstId,requestId:'7119a6d3-de0f-47fc-9bf9-d243c5e0ac4d'};
    const paid=await invoke('POST','/:id/receipts',{body:additional});
    assert.equal(paid.order.status,'paid');
    assert.equal(paid.order.received,1_020_000);
    assert.equal(order.data.learnerReceiptProofLinks['BANK-A'],firstId);
    await assert.rejects(invoke('POST','/:id/receipts',{body:{...additional,requestId:'462fae33-2a5e-4d30-8a25-8c2b8bee778d'}}),
      {status:409,message:'enrollment_duplicate_receipt'});
    assert.equal(inserted,2);
    scope='own';
    const before=reads;
    await assert.rejects(invoke('GET','',{query:{order:manualOrderId,bankLookup:'1'}}),{status:403});
    assert.equal(reads,before);
  }finally{process.env=previous;}
});
