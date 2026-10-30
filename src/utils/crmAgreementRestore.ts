/** Restore only the latest explicit fulfilment; never infer agreement identity from prose. */
export function fulfilledAgreementRecord(lead:any,id:string){
 const agreement=(lead.commitments||[]).find((v:any)=>v.id===id);
 const changes=(lead.followUpLogs||[]).filter((l:any)=>l.commitmentChange?.id===id);
 const last=changes.at(-1);
 return agreement?.status==='fulfilled'&&last?.commitmentChange.status==='fulfilled'&&!last.commitment?{agreement,log:last}:null;
}
export function agreementRestoreIsPast(agreement:any,clock:Date){
 if(agreement.at)return Date.parse(agreement.at)<=clock.getTime();
 if(agreement.date){const today=new Intl.DateTimeFormat('en-CA',{timeZone:agreement.timezone||'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(clock);return agreement.date<=today;}
 return false;
}
