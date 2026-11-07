import type {PaymentImage} from './crmPaymentMethods';
/** Amounts are whole Indonesian rupiah; never infer receivables from a learning budget. */
export type PaymentEntry = {id:string;projectId:string;kind:'receipt'|'refund';amount:number;reportedAt:string;method:string;methodName?:string;provider?:string;images?:PaymentImage[];verificationImages?:PaymentImage[];evidence:string;reference:string;account:string;accountRole?:'company_receiving'|'refund_destination';state:'pending'|'verified'|'rejected'|'void';createdAt:string;createdBy:string;verifiedAmount?:number;receivedAt?:string;verifiedBy?:string;verifiedAt?:string;verificationEvidence?:string;reason?:string};
export type PaymentProject = {id:string;course:string;sourceLeadId?:string;priceSnapshot?:any;enrollmentFactId?:string;basis?:any;expected:number|null;createdAt:string;createdBy:string;
 termination?: {effectiveAt:string;reason:string;actor:string;recordedAt:string};
 settlement?: {amount:number;basis:string;actor:string;recordedAt:string};
};
export type PaymentLedger = {projects:PaymentProject[];entries:PaymentEntry[];history:Array<{id:string;action:string;actor:string;at:string;before:unknown;after:unknown;reason?:string}>};
export const emptyPaymentLedger=():PaymentLedger=>({projects:[],entries:[],history:[]});
export function paymentSummary(ledger:PaymentLedger,project:PaymentProject){
 const entries=ledger.entries.filter(e=>e.projectId===project.id),verified=entries.filter(e=>e.state==='verified');
 const received=verified.filter(e=>e.kind==='receipt').reduce((n,e)=>n+e.verifiedAmount!,0),refunded=verified.filter(e=>e.kind==='refund').reduce((n,e)=>n+e.verifiedAmount!,0),net=received-refunded;
 const balance=project.termination && project.settlement ? project.settlement.amount-net : null;
 const settlement=!project.termination ? null : balance===null ? {state:'pending' as const,due:null,refund:null}
  : {state:balance>0 ? 'collect' as const : balance<0 ? 'refund' as const : 'settled' as const,due:Math.max(0,balance),refund:Math.max(0,-balance)};
 return {settlement,received,refunded,net,pending:entries.filter(e=>e.state==='pending').length,remaining:settlement?settlement.due:project.expected===null?null:Math.max(0,project.expected-net),overpaid:settlement||project.expected===null?0:Math.max(0,net-project.expected),state:settlement?'terminated':project.expected===null?'unpriced':project.expected===0?'nocharge':net<=0?'unpaid':net<project.expected?'partial':'paid'};
}
export const paymentAmount=(v:unknown,zero=false):number=>{
 if((typeof v!=='number'&&typeof v!=='string')||!/^\d{1,13}$/.test(String(v)))throw Object.assign(Error('payment_amount_invalid'),{status:400});
 const n=Number(v);if(!Number.isSafeInteger(n)||n>(10**12)||n<(zero?0:1))throw Object.assign(Error('payment_amount_invalid'),{status:400});return n;
};
export const paymentInstant=(v:unknown):string=>{
 if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(Z|[+-]\d\d:\d\d)$/.test(v)||!Number.isFinite(Date.parse(v))||Date.parse(v)>Date.now()+60000)throw Object.assign(Error('payment_time_invalid'),{status:400});if(new Date(v.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)!==v.slice(0,10))throw Object.assign(Error('payment_time_invalid'),{status:400});return new Date(v).toISOString();
};
