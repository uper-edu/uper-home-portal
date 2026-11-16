import {useRef,useState} from 'react';
import {AdminFormFeedback} from '../AdminFormLayout';
import type {CrmLanguage} from '../../utils/crmLanguage';

const operations = {
  receipts: {scope:'finance',kind:'enrollment.receipt'},
  refunds: {scope:'finance',kind:'enrollment.refund.payment'},
  'refund-returns': {scope:'finance',kind:'enrollment.refund.return'},
  invitations: {scope:'aftercare',kind:'enrollment.transfer.invite'},
  refund: {scope:'aftercare',kind:'enrollment.refund.intake'},
} as const;

type Operation = keyof typeof operations;
type OriginalRequest = {operation:Operation;orderId:string;body:Record<string,unknown>&{requestId:string}};
type Outcome = {state:'saved';replyBy?:string}|{state:'rejected';code:string};
type CheckState = 'unknown'|'missing'|'unavailable';

function orderPath(request:OriginalRequest) {
  return '/api/crm/enrollment/'+operations[request.operation].scope+'/'+encodeURIComponent(request.orderId);
}

export function useCrmOrderOperation() {
  const [pending,setPending]=useState<{request:OriginalRequest;state:CheckState}>();
  const [busy,setBusy]=useState(false);
  const inFlight=useRef(false);
  async function run(request:OriginalRequest, mode:'submit'|'check'|'retry'):Promise<Outcome|undefined> {
    if(inFlight.current)return;
    inFlight.current=true;setBusy(true);
    const {operation,body,orderId}=request;
    const checking=mode==='check';
    const base=orderPath(request);
    try{
      const signal=AbortSignal.timeout(15000);
      const response=checking
        ? await fetch(base+'/results/'+operation+'/'+encodeURIComponent(body.requestId),{cache:'no-store',signal})
        : await fetch(base+'/'+operation,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
      if(checking&&!response.ok){
        setPending({request,state:response.status===404?'missing':'unavailable'});
        return;
      }
      if(!response.ok){
        if(mode==='submit'&&response.status>=400&&response.status<500){
          const data=await response.json().catch(()=>null);
          return {state:'rejected',code:data?.error||String(response.status)};
        }
        setPending({request,state:'unknown'});
        return;
      }
      const result=await response.json();
      const kind=operations[operation].kind;
      if(result.operationKind!==kind||
         (checking&&(result.orderId!==orderId||result.requestId!==body.requestId))||
         (!checking&&result.leadId!=='enrollment:'+orderId)){
        setPending({request,state:checking?'unavailable':'unknown'});
        return;
      }
      setPending(undefined);
      return {state:'saved',replyBy:result.replyBy};
    }catch{
      setPending({request,state:checking?'unavailable':'unknown'});
    }finally{inFlight.current=false;setBusy(false);}
  }
  return {
    busy,pending,
    clear:()=>setPending(undefined),
    submit:(operation:Operation,orderId:string,body:OriginalRequest['body'])=>pending?undefined:run({operation,orderId,body},'submit'),
    check:()=>pending&&run(pending.request,'check'),
    retry:()=>pending?.state==='missing'?run(pending.request,'retry'):undefined,
  };
}

export function CrmOrderOperationFeedback({lang,command,onCheck,onRetry}:{
  lang:CrmLanguage;command:ReturnType<typeof useCrmOrderOperation>;onCheck:()=>void;onRetry:()=>void;
}) {
  if(!command.pending)return null;
  const t=(zh:string,en:string,id:string)=>lang==='zh'?zh:lang==='id'?id:en;
  const state=command.pending.state;
  return <div data-admin-stack="">
    <AdminFormFeedback lang={lang} state="unknown">
      {command.busy?t('正在处理原请求…','Processing the original request…','Memproses permintaan awal…'):
        state==='missing'?t('暂未查到原操作，输入已保留。可继续查询或重试原请求。','No result yet. Your input is retained. Check again or retry the original request.','Hasil belum ditemukan. Isian tersimpan. Periksa lagi atau ulangi permintaan awal.'):
        state==='unavailable'?t('暂时无法查询原操作，输入已保留。','The original operation could not be checked. Your input is retained.','Tindakan awal belum dapat diperiksa. Isian tersimpan.'):
        t('操作结果待确认，请先查询。','Check the original result before continuing.','Periksa hasil awal sebelum melanjutkan.')}
    </AdminFormFeedback>
    <div className="crm-work-inline">
      <button type="button" className="crm-work-button" disabled={command.busy} onClick={onCheck}>{t('查询操作结果','Check operation result','Periksa hasil tindakan')}</button>
      {state==='missing'&&<button type="button" className="crm-work-link" disabled={command.busy} onClick={onRetry}>{t('重试原请求','Retry original request','Ulangi permintaan awal')}</button>}
    </div>
  </div>;
}
