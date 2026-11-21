import {useEffect,useId,useRef,useState} from 'react';
import {CircleHelp} from 'lucide-react';
import {AdminFormFeedback} from '../AdminFormLayout';
import {AdminEditor} from '../admin/AdminEditor';
import {AdminRowAction} from '../admin/AdminListControl';
import type {CrmLanguage} from '../../utils/crmLanguage';
import {purchaseIntentReviewLabel,type PurchaseIntentSuggestion} from '../../utils/crmPurchaseIntentSuggestion';

export function CrmPurchaseIntentReviewAction({lang,onClick}:{lang:CrmLanguage;onClick:()=>void}){
  return <AdminRowAction className="crm-purchase-intent-entry" onClick={onClick}>
    <CircleHelp size={16} aria-hidden="true"/>{purchaseIntentReviewLabel(lang)}
  </AdminRowAction>;
}

export function CrmPurchaseIntentReview({customer,lang,isLight,suggestion,onClose,onRegister,onDismissed,onOpenConversation}:{
  customer:{id:string;fullName:string};lang:CrmLanguage;isLight:boolean;suggestion:PurchaseIntentSuggestion;
  onClose:()=>void;onRegister:()=>void;onDismissed:()=>void;onOpenConversation:(messageId:string)=>void;
}){
  const t=(zh:string,en:string,id:string)=>lang==='zh'?zh:lang==='id'?id:en;
  const [requestId]=useState(()=>crypto.randomUUID());
  const [state,setState]=useState<'idle'|'busy'|'error'|'stale'|'unknown'>('idle');
  const pending=useRef<AbortController|null>(null);
  useEffect(()=>()=>pending.current?.abort(),[]);
  const evidenceHeading=useId();
  const busy=state==='busy';
  const type=suggestion.format==='standard'?t('标准班','Standard class','Kelas reguler'):
    suggestion.format==='small'?t('小班','Small group','Kelas kecil'):
    suggestion.format==='private'?t('一对一','One-to-one','Kelas privat'):null;
  const values=[
    [t('课程级别','Course level','Level kursus'),suggestion.level],
    [t('班型','Class format','Format kelas'),type],
    [t('可上课时段','Availability','Waktu yang tersedia'),suggestion.availability],
    [t('希望开始时间','Preferred start','Waktu mulai yang diinginkan'),suggestion.startWindow],
  ].filter(([,value])=>value);

  async function dismiss(check=false){
    if(pending.current)return;
    const controller=new AbortController();
    pending.current=controller;
    setState('busy');
    const base='/api/crm/leads/'+encodeURIComponent(customer.id);
    try{
      const response=await fetch(check?base+'/operations/'+requestId:base+'/purchase-intent-dismissal',{
        ...(check?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({requestId,suggestionId:suggestion.id})}),
        signal:AbortSignal.any([controller.signal,AbortSignal.timeout(16000)]),
      });
      if(controller.signal.aborted)return;
      if(response.status>=500){setState('unknown');return;}
      if(!response.ok){
        const error=await response.json().catch(()=>null);
        if(error?.error==='enrollment_purchase_intent_changed'){setState('stale');return;}
        if(check&&response.status===404){setState('error');return;}
        setState('error');return;
      }
      const result=await response.json();
      if(result.leadId!==customer.id||result.operationKind!=='purchase_intent.dismiss'||result.suggestionId!==suggestion.id){
        setState('unknown');return;
      }
      onDismissed();
    }catch{if(!controller.signal.aborted)setState('unknown');}
    finally{pending.current=null;}
  }

  return <AdminEditor variant="drawer" title={purchaseIntentReviewLabel(lang)} lang={lang} light={isLight}
    description={<>{customer.fullName}<div>{t('AI 根据客户对话给出建议。请核对原话后决定是否登记。',
      'AI suggested this based on the conversation. Review the original messages before recording intent.',
      'AI memberikan saran berdasarkan percakapan. Tinjau pesan asli sebelum mencatat minat.')}</div></>}
    onClose={onClose} busy={busy}
    footer={<>
      <button type="button" disabled={busy} onClick={onClose}>{t('关闭','Close','Tutup')}</button>
      {state==='unknown'?<button type="button" onClick={()=>void dismiss(true)}>
        {t('查询处理结果','Check result','Periksa hasil')}</button>:
        <button type="button" disabled={busy||state==='stale'} onClick={()=>void dismiss()}>
          {t('忽略建议','Dismiss suggestion','Abaikan saran')}</button>}
      <button type="button" data-primary disabled={busy||state==='unknown'||state==='stale'} onClick={onRegister}>
        {t('登记购课意向','Record course purchase intent','Catat minat membeli kursus')}</button>
    </>}>
    <div className="crm-purchase-intent-review" data-admin-stack="">
      <p>{suggestion.summary}</p>
      {values.length>0&&<dl className="crm-opportunity-summary">
        {values.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>}
      {!suggestion.level&&<p className="crm-work-muted">{t('级别未确定时，可先记录进展。',
        'If the level is unclear, use Record progress first.','Jika level belum jelas, catat perkembangan terlebih dahulu.')}</p>}
      <section aria-labelledby={evidenceHeading}>
        <h3 id={evidenceHeading}>{t('客户原话','Original customer messages','Pesan asli pelanggan')}</h3>
        <ol className="crm-course-records">{suggestion.evidence.map(item=><li key={item.messageId}><blockquote>{item.quote}</blockquote></li>)}</ol>
        <AdminRowAction disabled={busy} onClick={()=>onOpenConversation(suggestion.evidence[0].messageId)}>
          {t('查看完整对话','View full conversation','Lihat percakapan lengkap')}
        </AdminRowAction>
      </section>
      {state==='stale'&&<AdminFormFeedback state="error" lang={lang}>{t('建议已变化，请关闭后重新查看。',
        'The suggestion has changed. Close this panel to review the latest suggestion.',
        'Saran telah berubah. Tutup panel ini untuk meninjau saran terbaru.')}</AdminFormFeedback>}
      {state==='error'&&<AdminFormFeedback state="error" lang={lang}>{t('未能确认忽略，请核对权限后重试。',
        'Dismissal could not be confirmed. Check your access and try again.',
        'Pengabaian belum terkonfirmasi. Periksa akses Anda dan coba lagi.')}</AdminFormFeedback>}
      {state==='unknown'&&<AdminFormFeedback state="unknown" lang={lang}/>}
    </div>
  </AdminEditor>;
}
