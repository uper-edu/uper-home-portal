type Client={query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}>};
type Proof={
  orderId:string;digest:string;details:{amount?:number;reference?:string}|null;
  verified:number|string;matched:number|string;
};

export function isEnrollmentProofAmount(amount:unknown):amount is number {
  return typeof amount==='number'&&Number.isSafeInteger(amount)&&amount>=1&&amount<=1_000_000_000;
}

export function proofTransferDetails(amount:unknown,reference:unknown) {
  if(amount!==undefined&&!isEnrollmentProofAmount(amount))throw Error('Invalid declared amount');
  if(reference!==undefined&&typeof reference!=='string')throw Error('Invalid declared reference');
  const bankReference=typeof reference==='string'?reference.trim().toUpperCase():undefined;
  if(bankReference&&bankReference.length>120)throw Error('Invalid declared reference');
  return amount===undefined&&!bankReference?null:{amount,reference:bankReference||undefined};
}

/** Rows arrive in submission order. The most recent supplied details for matching proofs apply at the cutoff. */
export function summarizeEnrollmentProofs(proofs:Proof[]) {
  const orders=new Map<string,Map<string,Proof>>();
  for(const proof of proofs){
    const images=orders.get(proof.orderId)??new Map<string,Proof>();
    orders.set(proof.orderId,images);
    const prior=images.get(proof.digest);
    if(!prior)images.set(proof.digest,proof);
    else if(proof.details)images.set(proof.digest,{
      ...proof,details:{...prior.details,...proof.details},
      matched:proof.details.reference?proof.matched:prior.matched,
    });
  }
  const referenceOwners=new Map<string,Set<string>>();
  for(const [orderId,images] of orders)for(const proof of images.values()){
    const reference=proof.details?.reference;
    if(!reference)continue;
    const owners=referenceOwners.get(reference)??new Set();
    owners.add(orderId);
    referenceOwners.set(reference,owners);
  }
  let pending=0,pendingParticipants=0,pendingUnknownCount=0,knownAmount=0,knownCount=0;
  for(const images of orders.values()){
    const transfers=new Map<string,Proof>();
    for(const proof of images.values()){
      const reference=proof.details?.reference;
      const key=reference?'reference:'+reference:'image:'+proof.digest;
      const prior=transfers.get(key);
      if(!prior||proof.details?.amount!==undefined)transfers.set(key,proof);
    }
    let counted=false;
    for(const proof of transfers.values()){
      const amount=proof.details?.amount;
      const matched=Number(proof.matched);
      const reference=proof.details?.reference;
      const exact=reference?referenceOwners.get(reference)?.size===1:Number(proof.verified)===0;
      if(matched>0&&(amount===undefined||matched>=amount))continue;
      pending++;
      counted=true;
      if(amount===undefined||!exact)pendingUnknownCount++;
      else {
        knownCount++;
        knownAmount+=amount-matched;
      }
    }
    if(counted)pendingParticipants++;
  }
  return {pending,pendingParticipants,pendingUnknownCount,pendingAmount:knownCount||!pending?knownAmount:null};
}

export async function pendingEnrollmentProofTotals(c:Client,cutoff:string,classId?:string) {
  const rows=(await c.query(`SELECT o.id AS orderId,p.digest,p.transfer_details AS details,verified.amount AS verified,
      COALESCE(r.amount,0) AS matched
    FROM enrollment_orders o JOIN enrollment_proofs p ON p.order_id=o.id AND p.created_at<:p1
    JOIN LATERAL (SELECT COALESCE(SUM(s.amount),0) AS amount FROM enrollment_receipts s
      WHERE s.order_id=o.id AND s.created_at<:p1) verified ON verified.amount+
      COALESCE((SELECT SUM(a.amount) FROM enrollment_payment_credits a WHERE a.target_order_id=o.id AND a.created_at<:p1),0)<o.price
    LEFT JOIN enrollment_receipts r ON r.order_id=o.id AND r.created_at<:p1
      AND r.reference=CAST(p.transfer_details->>'$.reference' AS BINARY)
    WHERE COALESCE(p.transfer_details->>'$.transferId',p.id)=p.id
    AND o.created_at<:p1 AND (:p2 IS NULL OR o.class_id=:p2) AND NOT EXISTS
      (SELECT 1 FROM enrollment_refund_cases f WHERE f.order_id=o.id AND f.created_at<:p1)
      AND NOT EXISTS (SELECT 1 FROM portal_audit a WHERE a.action='enrollment.order.end'
        AND a.data->>'$.orderId'=o.id AND a.created_at<:p1)
    ORDER BY p.created_at,p.id`,[cutoff,classId??null])).rows;
  return summarizeEnrollmentProofs(rows);
}
