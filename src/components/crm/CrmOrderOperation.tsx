import {useEffect,useRef,useState} from 'react';
import {AdminFormFeedback} from '../AdminFormLayout';
import type {CrmLanguage} from '../../utils/crmLanguage';

const operations = {
  receipts: {scope:'finance',kind:'enrollment.receipt'},
  refunds: {scope:'finance',kind:'enrollment.refund.payment'},
  'refund-returns': {scope:'finance',kind:'enrollment.refund.return'},
  invitations: {scope:'aftercare',kind:'enrollment.transfer.invite'},
  refund: {scope:'aftercare',kind:'enrollment.refund.intake'},
  end: {scope:'aftercare',kind:'enrollment.order.end'},
} as const;

type Operation = keyof typeof operations;
type OriginalRequest = {operation:Operation;orderId:string;body:Record<string,unknown>&{requestId:string}};
type Outcome = {state:'saved';replyBy?:string}|{state:'rejected';code:string};
type CheckState = 'unknown'|'missing'|'unavailable';

function orderPath(request:OriginalRequest) {
  return '/api/crm/enrollment/'+operations[request.operation].scope+'/'+encodeURIComponent(request.orderId);
}

export function useCrmOrderOperation(receipt?:{actorId:string;orderId:string|null}) {
  const storageKey=receipt?.orderId?'uper:receipt-pending:'+receipt.actorId+':'+receipt.orderId:undefined;
  const [pending,setPending]=useState<{request:OriginalRequest;state:CheckState;restored?:boolean}>();
  const [busy,setBusy]=useState(false);
  const inFlight=useRef(false);
  const restoredRequest=useRef<string|undefined>(undefined);
  useEffect(()=>{
    setPending(undefined);
    restoredRequest.current=undefined;
    if(!storageKey||!receipt?.orderId)return;
    try{
      const saved=JSON.parse(sessionStorage.getItem(storageKey)??'null') as {requestId:string;expiresAt:number}|null;
      if(!saved)return;
      if(!Number.isFinite(saved.expiresAt)||saved.expiresAt<=Date.now()||
        !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(saved.requestId)){
        sessionStorage.removeItem(storageKey);
        return;
      }
      setPending({
        request:{operation:'receipts',orderId:receipt.orderId,body:{requestId:saved.requestId}},
        state:'unknown',restored:true,
      });
    }catch{/* This browser can still check the result while the form stays open. */}
  },[storageKey,receipt?.orderId]);
  const remember=(requestId?:string)=>{
    if(!storageKey)return;
    try{
      if(requestId)sessionStorage.setItem(storageKey,JSON.stringify({requestId,expiresAt:Date.now()+24*60*60*1000}));
      else sessionStorage.removeItem(storageKey);
    }catch{/* This browser can still check the result while the form stays open. */}
  };
  async function run(request:OriginalRequest, mode:'submit'|'check'|'retry',restored=false):Promise<Outcome|undefined> {
    if(inFlight.current)return;
    inFlight.current=true;setBusy(true);
    const {operation,body,orderId}=request;
    const checking=mode==='check';
    const base=orderPath(request);
    if(!checking)remember(body.requestId);
    try{
      const signal=AbortSignal.timeout(15000);
      const response=checking
        ? await fetch(base+'/results/'+operation+'/'+encodeURIComponent(body.requestId),{cache:'no-store',signal})
        : await fetch(base+'/'+operation,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
      if(checking&&!response.ok){
        setPending({request,state:response.status===404?'missing':'unavailable',restored});
        return;
      }
      if(!response.ok){
        if(mode==='submit'&&response.status>=400&&response.status<500&&
          !(storageKey&&([408,425,429].includes(response.status)||
            (response.status===409&&body.requestId===restoredRequest.current)))){
          const data=await response.json().catch(()=>null);
          remember();
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
        setPending({request,state:checking?'unavailable':'unknown',restored});
        return;
      }
      setPending(undefined);
      remember();
      return {state:'saved',replyBy:result.replyBy};
    }catch{
      setPending({request,state:checking?'unavailable':'unknown',restored});
    }finally{inFlight.current=false;setBusy(false);}
  }
  return {
    busy,pending,
    clear:()=>setPending(undefined),
    submit:(operation:Operation,orderId:string,body:OriginalRequest['body'])=>pending?undefined:run({operation,orderId,body},'submit'),
    check:()=>pending&&run(pending.request,'check',pending.restored),
    retry:()=>pending?.state==='missing'&&!pending.restored?run(pending.request,'retry'):undefined,
    resume(){
      if(inFlight.current||!pending?.restored||pending.state!=='missing')return;
      restoredRequest.current=pending.request.body.requestId;
      setPending(undefined);
      return restoredRequest.current;
    },
  };
}

export function CrmOrderOperationFeedback({lang,command,onCheck,onRetry,onResume}:{
  lang:CrmLanguage;command:ReturnType<typeof useCrmOrderOperation>;onCheck:()=>void;onRetry:()=>void;onResume?:()=>void;
}) {
  if(!command.pending)return null;
  const t=(zh:string,en:string,id:string)=>lang==='zh'?zh:lang==='id'?id:en;
  const state=command.pending.state;
  return <div data-admin-stack="">
    <AdminFormFeedback lang={lang} state="unknown">
      {command.busy?t('正在处理原请求…','Processing the original request…','Memproses permintaan awal…'):
        command.pending.restored?(state==='missing'
          ? t('暂未查到结果。可重新填写同一笔到账资料。','No result yet. You can re-enter the same receipt details.','Hasil belum ditemukan. Anda dapat mengisi ulang data penerimaan yang sama.')
          : t('已恢复待确认的操作。请查询原结果。','The pending operation was restored. Check the original result.','Tindakan tertunda dipulihkan. Periksa hasil awal.')):
        state==='missing'?t('暂未查到原操作，输入已保留。可继续查询或重试原请求。','No result yet. Your input is retained. Check again or retry the original request.','Hasil belum ditemukan. Isian tersimpan. Periksa lagi atau ulangi permintaan awal.'):
        state==='unavailable'?t('暂时无法查询原操作，输入已保留。','The original operation could not be checked. Your input is retained.','Tindakan awal belum dapat diperiksa. Isian tersimpan.'):
        t('操作结果待确认，请先查询。','Check the original result before continuing.','Periksa hasil awal sebelum melanjutkan.')}
    </AdminFormFeedback>
    <div className="crm-work-inline">
      <button type="button" className="crm-work-button" disabled={command.busy} onClick={onCheck}>{t('查询操作结果','Check operation result','Periksa hasil tindakan')}</button>
      {state==='missing'&&!command.pending.restored&&<button type="button" className="crm-work-link" disabled={command.busy} onClick={onRetry}>{t('重试原请求','Retry original request','Ulangi permintaan awal')}</button>}
      {state==='missing'&&command.pending.restored&&onResume&&<button type="button" className="crm-work-link" disabled={command.busy} onClick={onResume}>{t('重新填写到账资料','Re-enter receipt details','Isi ulang data penerimaan')}</button>}
    </div>
  </div>;
}
