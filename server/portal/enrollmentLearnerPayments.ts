import type {EnrollmentFinanceTransfer,EnrollmentLearnerTransfer} from '../../src/utils/enrollmentLearnerPayments.ts';
import {isEnrollmentProofAmount} from './enrollmentProofTotals.ts';

type Client = {query:(sql:string,args?:unknown[])=>Promise<{rows:any[]}>};
type Proof = {id:string;digest:string;submittedAt:string;details?:{transferId?:string;amount?:number;reference?:string}|null};
type Receipt = {reference:string;amount:number;proofId?:string};
type Transfer = {
  id:string; proofs:string[]; digests:Set<string>; references:Set<string>;
  submittedAt:string; amount?:number; explicitlyGrouped:boolean;
};
type PaymentRows = {proofs:Proof[];receipts:Receipt[]};
const emptyPaymentRows:PaymentRows={proofs:[],receipts:[]};

function transferGroups(proofs:Proof[]) {
  const groups=new Set<Transfer>();
  const aliases=new Map<string,Transfer>();
  for(const proof of proofs){
    const reference=proof.details?.reference;
    const keys=[proof.id,'digest:'+proof.digest];
    if(proof.details?.transferId)keys.push(proof.details.transferId);
    if(reference)keys.push('reference:'+reference);
    const matching=new Set(keys.map(key=>aliases.get(key)).filter(group=>group!==undefined));
    const group=matching.values().next().value??{id:proof.id,proofs:[],digests:new Set<string>(),references:new Set<string>(),
      submittedAt:proof.submittedAt,explicitlyGrouped:false};
    for(const prior of matching){
      if(prior===group)continue;
      group.proofs.push(...prior.proofs);
      for(const digest of prior.digests)group.digests.add(digest);
      for(const priorReference of prior.references)group.references.add(priorReference);
      group.explicitlyGrouped ||= prior.explicitlyGrouped;
      group.amount ??= prior.amount;
      groups.delete(prior);
    }
    group.proofs.push(proof.id);
    group.digests.add(proof.digest);
    if(reference)group.references.add(reference);
    group.explicitlyGrouped ||= !!proof.details?.transferId;
    // Only a new transfer may declare an amount. A supporting file leaves it unchanged.
    if(isEnrollmentProofAmount(proof.details?.amount))group.amount=proof.details.amount;
    groups.add(group);
    for(const id of group.proofs)aliases.set(id,group);
    for(const digest of group.digests)aliases.set('digest:'+digest,group);
    for(const bankReference of group.references)aliases.set('reference:'+bankReference,group);
  }
  return {groups,aliases};
}

export function enrollmentProofGroupId(proofs:Proof[],id:string,digest:string,reference?:string,transferId?:string) {
  const {aliases}=transferGroups(proofs);
  const target=transferId?aliases.get(transferId):undefined;
  const identical=aliases.get('digest:'+digest);
  const sameReference=reference?aliases.get('reference:'+reference):undefined;
  if((transferId&&!target)||(identical&&sameReference&&identical!==sameReference)||
    (target&&((identical&&identical!==target)||(sameReference&&sameReference!==target))))return;
  const existing=target??identical??sameReference;
  if(reference&&existing?.references.size&&!existing.references.has(reference))return;
  return existing?.id??id;
}

export function enrollmentReceiptProofId(proofs:Proof[],id:string,reference:string,receipts:Receipt[]) {
  const {aliases}=transferGroups(proofs);
  const target=aliases.get(id);
  const referenced=aliases.get('reference:'+reference);
  const existing=receipts.find(receipt=>receipt.reference===reference);
  const assigned=existing&&receiptGroup(aliases,existing);
  if(!target||(referenced&&referenced!==target)||
    (assigned&&assigned!==target)||
    receipts.some(receipt=>receipt.reference!==reference&&receiptGroup(aliases,receipt)===target))return;
  return target.id;
}

function receiptGroup(aliases:Map<string,Transfer>,receipt:Receipt) {
  return (receipt.proofId?aliases.get(receipt.proofId):undefined)??aliases.get('reference:'+receipt.reference);
}

function maskReference(reference?:string) {
  return reference?'••••'+(reference.length>4?reference.slice(-4):''):undefined;
}

function reconcileTransfers({proofs,receipts}:PaymentRows) {
  const {groups,aliases}=transferGroups(proofs);
  const matched=new Map<Transfer,number>();
  const unmatchedReferences:string[]=[];
  for(const receipt of receipts){
    const group=receiptGroup(aliases,receipt);
    if(group)matched.set(group,(matched.get(group)??0)+receipt.amount);
    else unmatchedReferences.push(receipt.reference);
  }
  return {groups,matched,unmatchedReferences};
}

function transferSummary(group:Transfer,verifiedAmount?:number):EnrollmentLearnerTransfer {
  return {id:group.id,submittedAt:group.submittedAt,amount:group.amount,
    reference:maskReference(group.references.values().next().value),verifiedAmount,proofCount:group.proofs.length};
}

const recentFirst=(a:EnrollmentLearnerTransfer,b:EnrollmentLearnerTransfer)=>
  b.submittedAt.localeCompare(a.submittedAt)||b.id.localeCompare(a.id);

export function enrollmentFinanceEvidence(rows:PaymentRows) {
  const {groups,matched,unmatchedReferences}=reconcileTransfers(rows);
  const transfers:EnrollmentFinanceTransfer[]=[...groups].map(group=>({
    ...transferSummary(group,matched.get(group)),proofIds:group.proofs,
  })).sort(recentFirst);
  return {transfers,unmatchedReferences};
}

export async function readEnrollmentLearnerPaymentRows(c:Client,ids:string[]) {
  const results=new Map<string,PaymentRows>();
  if(!ids.length)return results;
  const {rows}=await c.query(
    `WITH picked AS (SELECT id FROM JSON_TABLE(:p1,'$[*]' COLUMNS (id VARCHAR(64) PATH '$')) selected)
      SELECT p.order_id AS orderId,p.id,p.digest,
        DATE_FORMAT(p.created_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS submittedAt,CAST(p.transfer_details AS CHAR) AS details,
        NULL AS reference,NULL AS amount
      FROM picked JOIN enrollment_proofs p ON p.order_id=picked.id
      UNION ALL
      SELECT r.order_id,NULL,NULL,NULL,NULL,r.reference,r.amount
      FROM picked JOIN enrollment_receipts r ON r.order_id=picked.id
      ORDER BY submittedAt,id`,[JSON.stringify(ids)]);
  for(const row of rows){
    const result=results.get(row.orderId)??{proofs:[],receipts:[]};
    if(row.id)result.proofs.push({...row,details:row.details?JSON.parse(row.details):null});
    else result.receipts.push({reference:row.reference,amount:Number(row.amount)});
    results.set(row.orderId,result);
  }
  return results;
}

export function withEnrollmentReceiptProofLinks(rows:PaymentRows|undefined,links:unknown):PaymentRows {
  if(!rows)return emptyPaymentRows;
  if(!links||typeof links!=='object')return rows;
  return {...rows,receipts:rows.receipts.map(receipt=>({
    ...receipt,proofId:Object.hasOwn(links,receipt.reference)?(links as Record<string,string>)[receipt.reference]:undefined,
  }))};
}
