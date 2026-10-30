import {crmUiText} from './crmUiText';
/** Original logs are immutable. Only explicitly linked corrections change the effective contact view. */
export const contactCorrectionOptions = [
 ['', '联系结果不变，仅补充／修正说明'], ['Connected', '已接通／客户已回复'], ['No Response', '已拨打／已发送，尚未回复'], ['Wrong Number', '联系方式无效'], ['Not Occurred', '本次联系未实际发生（误登）'], ['Duplicate', '重复登记（不重复计数）'],
] as const;
export function effectiveSalesRecords(lead: any): any[] {
 return (lead.followUpLogs || []).map((original: any) => {
  const amendments=(lead.recordAmendments || []).filter((a:any)=>a.targetLogId===original.id);
  let value=original;
  for(const a of amendments)if(a.kind==='correction'&&a.contactResult){
   const excluded=['Not Occurred','Duplicate'].includes(a.contactResult);
   value={...value,contactExcluded:excluded,connectStatus:excluded?value.connectStatus:a.contactResult,contactDirection:a.contactResult!=='Connected'&&original.contactDirection==='customer'?'unknown':original.contactDirection,contactCorrectionId:a.id};
  }
  return amendments.length?{...value,amendments}:value;
 });
}
export function effectiveContactRecords(lead:any){return effectiveSalesRecords(lead).filter((l:any)=>!l.contactExcluded);}
export function linkedAmendments(lead:any,factId:string){return (lead.recordAmendments||[]).filter((a:any)=>a.targetFactId===factId);}
/** The Customer 360 entry is limited to staff sales records, never customer originals or business facts. */
export function canAmendSalesRecord(record:any,canFollowUp:boolean){return Boolean(canFollowUp&&record?.eventType==='followup.recorded'&&record.eventId);}
export function amendmentSaveNotice(result:any,lang:any){
 const ui=(s:string)=>crmUiText(s,lang);
 const status:Record<string,string>={restored:'原首次联系任务已恢复至当前负责人，原期限不变；未重发旧通知。',satisfied:'首次联系仍满足要求。',needs_review:'原首次要求需管理者核对；未新增任务。'};
 return ui('补充／修正已保存。')+(status[result.firstRequirementStatus]?' '+ui(status[result.firstRequirementStatus]):'');
}
export function firstRequirementBasis(lead:any){
 return effectiveContactRecords(lead).filter((l:any)=>
  (l.recordKind==='contact'||!['closure','internal'].includes(l.recordKind))&&['Connected','No Response','Wrong Number'].includes(l.connectStatus)||
  ['closure','internal'].includes(l.recordKind)&&typeof l.exceptionReason==='string'&&!!l.exceptionReason.trim()
 ).sort((a:any,b:any)=>(Date.parse(a.at||a.timestamp)||Infinity)-(Date.parse(b.at||b.timestamp)||Infinity))[0]||null;
}
export function firstBasisOutcome(log:any){return !log?null:['closure','internal'].includes(log.recordKind)?'exception':({Connected:'connected','No Response':'attempted','Wrong Number':'invalid_contact'}as any)[log.connectStatus]||null;}
