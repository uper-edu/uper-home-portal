import {isSalesProgressStage} from './crmSalesProgress';
import {progressContactTime} from './crmProgressDraft';
import {confirmCrmOperation} from './crmOperationResult';
/** These controls are client-only; /logs never receives a stage command. */
export function progressStageError(value:any,current:string,timezone:string){
 if(!value?.enabled)return '';
 if(!isSalesProgressStage(value.stage)||value.stage===current)return '请选择不同于当前阶段的新阶段';
 if(value.stage==='progress:enrolled'&&value.enrollmentConfirmed!==true)return '请明确确认报名已成立';
 return '';
}
export function progressStageBody(value:any,receipt:any,base:any,timezone:string,requestId:string){
 const error=progressStageError(value,base.stage,timezone);if(error)throw Error(error);
 if(!receipt?.lead?.id||!receipt.logId||!receipt.lead.followUpLogs?.some((l:any)=>l.id===receipt.logId))throw Error('本次进展的保存结果尚未确认，不能更新阶段');
 return {requestId,newStage:value.stage,expectedStage:base.stage,expectedStageRevision:base.revision,reason:'',basisRefs:[{type:'sales_record',id:receipt.logId}],effectiveTimeMode:'now',effectiveAt:null,...(value.stage==='progress:enrolled'?{enrollmentScope:'course'}:{}),enrollmentConfirmed:value.stage==='progress:enrolled'&&value.enrollmentConfirmed===true};
}
/** A stage failure never retries the already-saved progress. Unknown writes require a read query. */
export async function submitProgressStage(leadId:string,body:any,request:typeof fetch=fetch,query=false){
 try{
  const response=await request(`/api/crm/leads/${leadId}/${query?'operations/'+body.requestId:'stage'}`,query?{signal:AbortSignal.timeout(20000)}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const data=await response.json();
  if(!response.ok){if(query&&response.status===404)return {state:'not_found',error:'尚未找到阶段保存结果，可以重试原阶段请求'};return {state:response.status>=500?'unknown':response.status===409?'conflict':'failed',error:data.error||'阶段未保存'};}
  confirmCrmOperation(data,leadId,'stage');if(data.lead?.id!==leadId||data.lead.currentStage!==body.newStage)throw Error('Stage result mismatch');
  return {state:'saved',data};
 }catch{return {state:'unknown',error:'阶段保存结果尚未确认，请查询结果，进展不会重复提交'};}
}
