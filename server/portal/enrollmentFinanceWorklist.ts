import {enrollmentOrderStatus} from '../../src/utils/enrollmentOrderStatus.ts';
import type {EnrollmentFinanceProgress} from '../../src/utils/enrollmentLearnerPayments.ts';
import {enrollmentFinanceEvidence,readEnrollmentLearnerPaymentRows,withEnrollmentReceiptProofLinks} from './enrollmentLearnerPayments.ts';

type Client={query:(sql:string,args?:unknown[])=>Promise<{rows:any[]}>};
type Candidate={
  id:string;class_id:string;state:string;class_state:string;name:string;price:number;received:number;
  level:string;format:string;period:string;firstLessonAt:string;
  data:{firstProofAvailableAt?:string;firstReviewDueAt?:string;learnerReceiptProofLinks?:unknown};
};

export async function readEnrollmentFinanceProgress(c:Client,orders:{
  id:string;state:string;learnerReceiptProofLinks?:unknown;
}[]) {
  const rows=await readEnrollmentLearnerPaymentRows(c,orders.map(order=>order.id));
  return new Map(orders.map(order=>{
    const {transfers}=enrollmentFinanceEvidence(withEnrollmentReceiptProofLinks(rows.get(order.id),order.learnerReceiptProofLinks));
    const pending=transfers.filter(transfer=>transfer.verifiedAmount===undefined);
    const progress:EnrollmentFinanceProgress={
      reported:transfers.length,
      verified:transfers.length-pending.length,
      pending:pending.length,
      reportedTotal:transfers.reduce((sum,transfer)=>sum+(transfer.amount??0),0),
      missingAmounts:transfers.filter(transfer=>transfer.amount===undefined).length,
      nextTransferId:['refunding','refunded'].includes(order.state)?undefined:pending.at(-1)?.id,
    };
    return [order.id,progress] as const;
  }));
}

async function readPendingEnrollmentTransfers(c:Client,search:string) {
  // Canonical roots bound the lookup. The shared evidence matcher resolves legacy aliases and supplements.
  const candidates:Candidate[]=(await c.query(`SELECT o.id,o.class_id,o.state,o.price,o.received,o.data,o.data->>'$.name' AS name,
      e.state AS class_state,e.data->>'$.level' AS level,e.data->>'$.format' AS format,e.data->>'$.period' AS period,
      e.first_lesson_at AS firstLessonAt
    FROM enrollment_orders o JOIN enrollment_classes e ON e.id=o.class_id
    WHERE o.state NOT IN ('refunding','refunded') AND EXISTS (
      SELECT 1 FROM enrollment_proofs p WHERE p.order_id=o.id
        AND COALESCE(p.transfer_details->>'$.transferId',p.id)=p.id
        AND NOT EXISTS (
          SELECT 1 FROM enrollment_receipts r WHERE r.order_id=o.id AND (
            JSON_UNQUOTE(JSON_EXTRACT(o.data,CONCAT('$.learnerReceiptProofLinks.',JSON_QUOTE(r.reference))))=p.id
            OR (r.reference=CAST(p.transfer_details->>'$.reference' AS BINARY)
              AND COALESCE(JSON_CONTAINS_PATH(o.data,'one',CONCAT('$.learnerReceiptProofLinks.',JSON_QUOTE(r.reference))),0)=0)
          )
        )
    ) AND (:p1='' OR LOCATE(:p1,LOWER(CONCAT_WS(' ',o.data->>'$.name',o.id,e.id,e.data->>'$.level',
      REPLACE(e.data->>'$.level',' ',''),e.data->>'$.schedule')))>0)`,[search])).rows;
  const queue=[];
  for(let start=0;start<candidates.length;start+=100){
    const batch=candidates.slice(start,start+100);
    const rows=await readEnrollmentLearnerPaymentRows(c,batch.map(row=>row.id));
    for(const order of batch){
      const {transfers}=enrollmentFinanceEvidence(withEnrollmentReceiptProofLinks(rows.get(order.id),order.data.learnerReceiptProofLinks));
      for(const transfer of transfers){
        if(transfer.verifiedAmount!==undefined)continue;
        const reviewDueAt=transfer.submittedAt===order.data.firstProofAvailableAt?order.data.firstReviewDueAt:undefined;
        queue.push({
          id:order.id,classId:order.class_id,name:order.name,price:Number(order.price),received:Number(order.received),
          level:order.level,format:order.format,period:order.period,firstLessonAt:order.firstLessonAt,
          status:enrollmentOrderStatus(order.state,order.class_state),hasProof:true,proofAt:transfer.submittedAt,reviewDueAt,
          transfer:{id:transfer.id,amount:transfer.amount,proofCount:transfer.proofCount},
        });
      }
    }
  }
  return queue;
}

export async function readEnrollmentFinanceWorklist(c:Client,search:string,page:number,pageSize:number) {
  const queue=await readPendingEnrollmentTransfers(c,search);
  queue.sort((a,b)=>Number(!a.reviewDueAt)-Number(!b.reviewDueAt)||(a.reviewDueAt??'').localeCompare(b.reviewDueAt??'')||
    a.proofAt.localeCompare(b.proofAt)||a.id.localeCompare(b.id)||a.transfer.id.localeCompare(b.transfer.id));
  const actualPage=page>1&&(page-1)*pageSize>=queue.length?1:page;
  return {orders:queue.slice((actualPage-1)*pageSize,actualPage*pageSize).map(({classId,...row})=>row),
    page:actualPage,pageSize,total:queue.length};
}

export async function readEnrollmentFinancePendingSummary(c:Client){
  const pending=await readPendingEnrollmentTransfers(c,'');
  const oldest=pending.reduce<string|null>((date,row)=>!date||row.proofAt<date?row.proofAt:date,null);
  const byClass=new Map<string,number>();
  for(const {classId} of pending)byClass.set(classId,(byClass.get(classId)??0)+1);
  return {pending:pending.length,oldest,submittedAt:pending.map(row=>row.proofAt),pendingByClass:Object.fromEntries(byClass)};
}
