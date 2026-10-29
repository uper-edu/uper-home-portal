/** Explicit correction only. Source text is immutable; unrelated agreements never change. */
export function agreementCorrectionCandidates(lead:any,log:any){
 return (lead.commitments||[]).filter((v:any)=>log&&[log.id,log.requestId].filter(Boolean).includes(v.sourceId));
}
export function withdrawMistakenAgreements(lead:any,log:any,body:any,amendment:any){
 const ids=body.withdrawCommitmentIds;
 if(ids===undefined||Array.isArray(ids)&&ids.length===0)return lead.commitments||[];
 const fail=(message:string,status=400):never=>{throw Object.assign(Error(message),{status});};
 if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length||body.kind!=='correction'||!body.reason?.trim())fail('请选择误记约定并填写修正原因');
 if(body.expectedCommitmentRevision!==(lead.simpleRevision||0))fail('客户约定已有变化，请刷新核对后再修正',409);
 const candidates=agreementCorrectionCandidates(lead,log);
 for(const id of ids){const v=candidates.find((v:any)=>v.id===id);if(!v||v.status!=='active'||v.updatedAt||v.updatedBy)fail('所选约定已变化或不属于原记录，请刷新核对',409);}
 return (lead.commitments||[]).map((v:any)=>ids.includes(v.id)?{...v,status:'withdrawn',updatedAt:amendment.recordedAt,updatedBy:amendment.actor,reason:amendment.reason,withdrawalAmendmentId:amendment.id}:v);
}
