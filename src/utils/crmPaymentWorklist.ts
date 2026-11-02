import {isPaymentMethod} from './crmPaymentMethods';
import {permittedRecord,type AccessEmployee} from './accessControl';
import {paymentSummary,type PaymentEntry,type PaymentLedger} from './crmPayments';
export type PaymentListFilters={state:'outstanding'|'unpaid'|'partial'|'paid'|'unpriced'|'nocharge'|'pending'|'verified'|'rejected'|'void'|'all';kind:'all'|'receipt'|'refund';search:string;page:number};
export type PaymentListRow={leadId:string;projectId:string;customer:string;course:string;expected:number|null;received:number;refunded:number;remaining:number|null;overpaid:number;pending:number;pendingReceipts:number;state:ReturnType<typeof paymentSummary>['state'];enrolledAt:string;ownerId:string;owner:string};
const fail=(message:string,status=400):never=>{throw Object.assign(Error(message),{status});};
export function canVerifyPayments(actor:AccessEmployee){return actor.active!==false&&actor.permissions.includes('crm.read')&&actor.permissions.includes('crm.payments.verify');}
export function paymentListFilters(raw:any={}):PaymentListFilters{
 const state=raw.state??'outstanding',kind=raw.kind??'all',search=raw.search??'',page=raw.page??'1';
 if(!['outstanding','unpaid','partial','paid','unpriced','nocharge','pending','verified','rejected','void','all'].includes(state)||!['all','receipt','refund'].includes(kind)||typeof search!=='string'||search.length>120||!['string','number'].includes(typeof page)||!/^\d{1,6}$/.test(String(page))||Number(page)<1)fail('payment_filters_invalid');
 return {state,kind,search:search.trim(),page:Number(page)};
}
/** One row per enrollment, including enrollments with no reported payment. Never expose bank details or infer receipts from a stage. */
export function paymentWorklist(actor:AccessEmployee,profiles:any[],ledgers:Array<{lead_id:string;value:PaymentLedger&{transferredTo?:string}}>,people:Array<{id:string;displayName?:string}>,filters:PaymentListFilters){
 if(!canVerifyPayments(actor))fail('payment_forbidden',403);
 const byId=new Map(profiles.map(p=>[p.id,p])),groups=new Map<string,PaymentLedger[]>();
 for(const row of ledgers){if(row.value.transferredTo)continue;let profile=byId.get(row.lead_id);const seen=new Set<string>();while(profile?.identityMergedInto){if(seen.has(profile.id)){profile=undefined;break;}seen.add(profile.id);profile=byId.get(profile.identityMergedInto);}
  if(!profile||!permittedRecord(actor,profile,'crm.read')||!permittedRecord(actor,profile,'crm.payments.verify'))continue;
  groups.set(profile.id,[...(groups.get(profile.id)||[]),row.value]);
 }
 const result:PaymentListRow[]=[];
 for(const [leadId,values]of groups){const p=byId.get(leadId)!,projects=new Map(values.flatMap(v=>v.projects).map(v=>[v.id,v])),entries=new Map(values.flatMap(v=>v.entries).map(v=>[v.id,v])),ledger={projects:[...projects.values()],entries:[...entries.values()],history:[]};
  const owner=people.find(e=>e.id===p.owner)?.displayName||p.owner||'';
  for(const project of projects.values()){
   const summary=paymentSummary(ledger,project),payments=ledger.entries.filter(e=>e.projectId===project.id),matching=payments.filter(e=>filters.kind==='all'||e.kind===filters.kind);
   if(filters.kind!=='all'&&!matching.length)continue;
   if(filters.state==='outstanding'){if(!summary.pending&&(summary.state==='paid'||summary.state==='nocharge'))continue;}
   else if(['pending','verified','rejected','void'].includes(filters.state)){if(!matching.some(e=>e.state===filters.state))continue;}
   else if(filters.state!=='all'&&summary.state!==filters.state)continue;
   if(filters.search&&![p.fullName||'',p.id,project.course,owner].join(' ').toLocaleLowerCase().includes(filters.search.toLocaleLowerCase()))continue;
   result.push({leadId,projectId:project.id,customer:p.fullName||p.id,course:project.course,expected:project.expected,received:summary.received,refunded:summary.refunded,remaining:summary.remaining,overpaid:summary.overpaid,pending:summary.pending,pendingReceipts:payments.filter(e=>e.kind==='receipt'&&e.state==='pending').length,state:summary.state,enrolledAt:project.createdAt,ownerId:p.owner||'',owner});
  }
 }
 result.sort((a,b)=>b.enrolledAt.localeCompare(a.enrolledAt)||a.leadId.localeCompare(b.leadId)||a.projectId.localeCompare(b.projectId));
 const pageSize=25,total=result.length,page=Math.min(filters.page,Math.max(1,Math.ceil(total/pageSize)));
 return {rows:result.slice((page-1)*pageSize,page*pageSize),total,page,pageSize};
}
export const paymentVerificationForm=(entry:PaymentEntry)=>({action:'verify',entryId:entry.id,amount:String(entry.amount),time:'',method:isPaymentMethod(entry.method)?entry.method:'other',methodName:entry.methodName||(!isPaymentMethod(entry.method)?entry.method:''),provider:entry.provider||'',account:entry.account,reference:entry.reference,evidence:'',images:[]});
export const paymentReceiptForm=(projectId:string)=>({action:'receive',projectId,amount:'',time:'',method:'',methodName:'',provider:'',account:'',reference:'',evidence:'',images:[]});
export const paymentRefundForm=(projectId:string)=>({...paymentReceiptForm(projectId),action:'refund'});
export function paymentListNextAction(row:Pick<PaymentListRow,'pendingReceipts'|'pending'|'remaining'|'state'>){
 return row.pendingReceipts>0?'review_receipt':row.pending>0?'review_refund':row.state==='paid'||row.state==='nocharge'?null:'receive';
}
/** Select only the requested kind in the freshly authorized project, never another customer's record. */
export function paymentNextReview(ledger:PaymentLedger,projectId:string,kind:'receipt'|'refund'){
 return ledger.entries.filter(e=>e.projectId===projectId&&e.kind===kind&&e.state==='pending').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))[0];
}

export function assertPaymentReceipt(result:any,leadId:string,command:any,expectedEntryId?:string,expectedProjectId?:string){
 const direct=command?.action==='receive'||command?.action==='refund',target=command?.entryId||(direct?undefined:command?.projectId);
 if(result?.leadId!==leadId||result?.operationKind!=='payment.command'||typeof result.targetId!=='string'||!Number.isInteger(result.revision)||result.revision<1||command?.action&&result.action!==command.action||target&&result.targetId!==target||direct&&result.projectId!==command.projectId)throw Error('payment_result_unconfirmed');
 if(expectedEntryId&&result.targetId!==expectedEntryId||expectedProjectId&&result.projectId!==expectedProjectId)throw Object.assign(Error('payment_result_other_entry'),{entryId:result.targetId,projectId:result.projectId});
 return result;
}
