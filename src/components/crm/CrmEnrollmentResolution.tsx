import { useEffect,useState } from 'react';
import { enrollmentCopy,enrollmentPost } from '../EnrollmentApplication';
import { AdminField,AdminForm,AdminRequiredNote } from '../AdminForm';
import { AdminFormActions } from '../AdminFormLayout';
import { CrmOperationLayer } from './CrmOperationLayer';
import { CrmDiscardDialog } from './CrmDetailWorkspace';
import { CrmSingleSelect } from './CrmSingleSelect';
import { formatCurrency } from '../../utils/currency';
import type { CrmLanguage } from '../../utils/crmLanguage';
import type { PublicEnrollmentClass } from '../../utils/enrollmentCatalog';

type ServiceOrder={id:string;classId:string;name:string;level:string;format:PublicEnrollmentClass['format'];opened:boolean;canInvite:boolean;received:number;priorityRequested:boolean};
type RefundDetails={
  progress:{expected:number;refunded:number};
  receipts:{reference:string;remaining:number}[];
  installments:{reference:string;receiptReference:string;amount:number;returned:number}[];
};
const staff='/api/crm/enrollment/aftercare';
const finance='/api/crm/enrollment/finance';

export function CrmEnrollmentSupport({lang,isLight}:{lang:CrmLanguage;isLight:boolean}) {
  const t=(zh:string,en:string,id:string)=>enrollmentCopy(lang,[zh,en,id]);
  const [orders,setOrders]=useState<ServiceOrder[]>();
  const [classes,setClasses]=useState<PublicEnrollmentClass[]>([]);
  const [editor,setEditor]=useState<{order:ServiceOrder;mode:'refund'|'invite';requestId:string}>();
  const [targetId,setTargetId]=useState('');
  const [busy,setBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [discard,setDiscard]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const load=async()=>{
    const response=await fetch(staff,{cache:'no-store'});
    if(!response.ok) return;
    setOrders((await response.json()).orders);
    const catalog=await fetch('/api/enrollment/classes',{cache:'no-store'});
    if(catalog.ok) setClasses((await catalog.json()).classes);
  };
  useEffect(()=>{void load().catch(()=>setError(t('售后记录暂时无法读取。','Aftercare records could not be read.','Catatan layanan belum dapat dimuat.')));},[]);
  if(!orders) return null;
  const start=(order:ServiceOrder,mode:'refund'|'invite')=>{
    setEditor({order,mode,requestId:crypto.randomUUID()});setTargetId('');setDirty(false);setError('');setNotice('');
  };
  const close=()=>{if(!busy){if(dirty)setDiscard(true);else setEditor(undefined);}};
  return <section className="crm-course-catalog">
    <h2>{t('报名售后','Enrollment support','Layanan pendaftaran')}</h2>
    {notice&&<p role="status">{notice}</p>}
    {!editor&&error&&<p role="alert">{error}</p>}
    {orders.map(row=><article className="crm-course-catalog" key={row.id}>
      <h3>{row.name} · {row.level}</h3><p>{row.id} · {formatCurrency(row.received,lang)}</p>
      {row.canInvite&&row.priorityRequested&&<p>{t('学员已开启优先安排','Learner enabled priority arrangements','Siswa mengaktifkan pengaturan prioritas')}</p>}
      {row.canInvite&&<button type="button" className="crm-work-button" onClick={()=>start(row,'invite')}>{t('安排转班邀请','Arrange transfer invitation','Atur undangan pindah kelas')}</button>}
      <button type="button" className="crm-work-button" onClick={()=>start(row,'refund')}>{t('受理退款','Accept refund request','Terima permintaan pengembalian')}</button>
    </article>)}
    {editor&&<CrmOperationLayer compose customerContext={false} title={<>{editor.mode==='refund'?t('受理退款','Accept refund request','Terima permintaan pengembalian'):
      t('安排转班邀请','Arrange transfer invitation','Atur undangan pindah kelas')}<AdminRequiredNote inline lang={lang}/></>}
      lang={lang} isLight={isLight} busy={busy} onClose={close}>
      <AdminForm lang={lang} className="crm-editor-compose crm-course-editor" onChange={()=>setDirty(true)} onSubmit={async event=>{
        event.preventDefault();if(busy)return;
        const form=new FormData(event.currentTarget);
        setBusy(true);setError('');
        try{
          await enrollmentPost(staff+'/'+editor.order.id+(editor.mode==='refund'?'/refund':'/invitations'),{
            classId:editor.order.classId,requestId:editor.requestId,
            ...(editor.mode==='refund'?{reason:form.get('reason'),delivered:Number(form.get('delivered')||0),special:form.get('special')==='on'}:{targetClassId:targetId}),
          });
          setEditor(undefined);setDirty(false);
          setNotice(editor.mode==='refund'?t('已受理退款，相关席位已释放。','Refund accepted and the seat released.','Pengembalian diterima dan kursi dilepas.'):
            t('转班邀请已登记。','Transfer invitation recorded.','Undangan pindah kelas dicatat.'));
          await load();
        }catch{setError(t('未能确认操作，请刷新核对订单。','The action could not be confirmed. Refresh to review the order.','Tindakan belum terkonfirmasi. Muat ulang pesanan.'));}
        finally{setBusy(false);}
      }}><div className="crm-editor-scroll">
        <p>{editor.order.name} · {editor.order.id}</p>
        {error&&<p role="alert">{error}</p>}
        {editor.mode==='invite'?<AdminField required>{t('目标班次','Target class','Kelas tujuan')}
          <CrmSingleSelect lang={lang} isLight={isLight} required label={t('目标班次','Target class','Kelas tujuan')} value={targetId}
            options={classes.filter(row=>row.id!==editor.order.classId&&row.level===editor.order.level&&row.format===editor.order.format&&row.availability!=='full')
              .map(row=>({value:row.id,label:row.level+' · '+row.firstLesson.replace('T',' ')+' WIB'}))}
            onChange={value=>{setTargetId(value);setDirty(true);}}/></AdminField>:<>
          <p>{t('正式受理后会结束报名及转班等待，并释放席位。','Accepting this request ends the enrollment and releases any held seat.','Menerima permintaan mengakhiri pendaftaran dan melepaskan kursi.')}</p>
          <AdminField required>{t('学员申请及受理原因','Request and acceptance reason','Alasan permintaan dan penerimaan')}<textarea name="reason" required maxLength={1000}/></AdminField>
          {editor.order.opened&&<>
            <label className="admin-field admin-field--choice"><input type="checkbox" name="special" required/>{t('确认已核实特殊退款原因','Confirm the verified exception','Konfirmasi pengecualian terverifikasi')}</label>
            <AdminField required>{t('已实际交付课次','Sessions already delivered','Pertemuan yang telah diberikan')}<input name="delivered" type="number" min="0" step="1" required/></AdminField>
          </>}
        </>}
      </div><AdminFormActions className="crm-editor-actions"><button type="button" className="crm-work-button" onClick={close}>{t('取消','Cancel','Batal')}</button>
        <button type="submit" className="crm-work-button" data-primary disabled={busy||(editor.mode==='invite'&&!targetId)}>{t('确认保存','Confirm and save','Konfirmasi dan simpan')}</button>
      </AdminFormActions></AdminForm>
    </CrmOperationLayer>}
    {discard&&<CrmDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)} onDiscard={()=>{setEditor(undefined);setDiscard(false);setDirty(false);}}/>}
  </section>;
}

export function CrmEnrollmentRefund({id,lang,isLight,onUpdate}:{id:string;lang:CrmLanguage;isLight:boolean;onUpdate:()=>void}) {
  const t=(zh:string,en:string,id:string)=>enrollmentCopy(lang,[zh,en,id]);
  const [details,setDetails]=useState<RefundDetails>();
  const [source,setSource]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
  const [returnEntry,setReturnEntry]=useState<{reference:string;requestId:string}>();
  const base=finance+'/'+id;
  const load=async()=>{
    const response=await fetch(base+'/refund-details',{cache:'no-store'});
    if(response.ok) setDetails(await response.json());
  };
  useEffect(()=>{void load().catch(()=>setError(t('未能加载退款明细。','Refund details could not be loaded.','Rincian belum dapat dimuat.')));},[id]);
  if(!details) return error?<p role="alert">{error}</p>:null;
  const {expected,refunded}=details.progress;
  const payment=details.installments.find(entry=>entry.reference===returnEntry?.reference);
  return <section className="crm-course-catalog">
    <p>{t('累计已原路退款','Total refunded to original payment','Total dikembalikan ke pembayaran asal')} {formatCurrency(refunded,lang)} / {formatCurrency(expected,lang)}</p>
    {!!details.installments.length&&<ul aria-label={t('已登记退款流水','Recorded refunds','Riwayat pengembalian tercatat')}>
      {details.installments.map(entry=><li key={entry.reference}>
        {formatCurrency(entry.amount,lang)} · {entry.reference} · {t('原收款','Original receipt','Penerimaan asal')} {entry.receiptReference}
        {entry.returned>0&&<> · {t('银行已退回','Returned by bank','Dikembalikan oleh bank')} {formatCurrency(entry.returned,lang)}</>}
        {!returnEntry&&entry.amount>entry.returned&&<button type="button" className="crm-work-button" disabled={busy} onClick={()=>{
          setError('');setReturnEntry({reference:entry.reference,requestId:crypto.randomUUID()});
        }}>{t('登记银行退回','Record bank return','Catat pengembalian oleh bank')}</button>}
      </li>)}
    </ul>}
    {error&&<p role="alert">{error}</p>}
    {returnEntry&&payment&&<AdminForm lang={lang} className="crm-form-layout" onSubmit={async event=>{
      event.preventDefault();
      if(busy) return;
      const input=new FormData(event.currentTarget);
      setBusy(true);setError('');
      try{
        await enrollmentPost(base+'/refund-returns',{
          refundReference:payment.reference,reference:input.get('reference'),amount:Number(input.get('amount')),requestId:returnEntry.requestId,
        });
        setReturnEntry(undefined);
        await load();onUpdate();
      }catch(cause){
        const reason=(cause as Error).message;
        setError(reason==='enrollment_duplicate_refund_return'
          ? t('这笔银行退回已登记。','This bank return has already been recorded.','Pengembalian oleh bank ini sudah dicatat.')
          : reason==='enrollment_refund_return_amount_exceeds'
            ? t('退回金额超过这笔退款流水尚可登记的金额。','This return exceeds the remaining amount of the refund payment.','Jumlah melebihi sisa pembayaran pengembalian.')
            : t('未能确认银行退回，请核对原流水后再操作。','The bank return could not be confirmed. Check the original payment before continuing.','Pengembalian oleh bank belum terkonfirmasi. Periksa pembayaran asal sebelum melanjutkan.'));
      }finally{setBusy(false);}
    }}>
      <p>{t('退款流水','Refund payment','Pembayaran pengembalian')} · {payment.reference} · {formatCurrency(payment.amount-payment.returned,lang)}</p>
      <AdminRequiredNote lang={lang}/>
      <AdminField required>{t('银行退回参考号','Bank return reference','Referensi pengembalian oleh bank')}<input name="reference" required maxLength={120}/></AdminField>
      <AdminField required>{t('银行退回金额（Rp）','Bank return amount (Rp)','Jumlah dikembalikan oleh bank (Rp)')}
        <input name="amount" type="number" min="1" max={payment.amount-payment.returned} step="1" required/>
      </AdminField>
      <AdminFormActions>
        <button type="button" className="crm-work-button" disabled={busy} onClick={()=>{setReturnEntry(undefined);setError('');}}>{t('取消','Cancel','Batal')}</button>
        <button type="submit" className="crm-work-button" data-primary disabled={busy}>{t('确认登记退回','Confirm bank return','Konfirmasi pengembalian oleh bank')}</button>
      </AdminFormActions>
    </AdminForm>}
    {refunded<expected&&<div hidden={!!returnEntry}><AdminForm lang={lang} className="crm-form-layout" onSubmit={async event=>{
      event.preventDefault();if(!source||busy)return;
      const form=event.currentTarget as HTMLFormElement;
      const input=new FormData(form);
      setBusy(true);setError('');
      try{
        await enrollmentPost(base+'/refunds',{receiptReference:source,reference:input.get('reference'),amount:Number(input.get('amount')),requestId});
        form.reset();setSource('');setRequestId(crypto.randomUUID());
        await load();onUpdate();
      }catch(cause){
        setError((cause as Error).message==='enrollment_refund_amount_exceeds'?t('金额超过该笔原流水或退款单的可退余额。','The amount exceeds the refundable balance.','Jumlah melebihi saldo pengembalian.'):
          t('未能确认分笔退款，请核对流水。','The refund entry could not be confirmed. Review the bank reference.','Periksa referensi pengembalian.'));
      }finally{setBusy(false);}
    }}>
      <AdminField required>{t('原收款流水','Original receipt','Referensi penerimaan asal')}
        <CrmSingleSelect label={t('原收款流水','Original receipt','Referensi penerimaan asal')} value={source}
          lang={lang} isLight={isLight} required options={details.receipts.filter(row=>row.remaining>0)
            .map(row=>({value:row.reference,label:row.reference+' · '+formatCurrency(row.remaining,lang)}))} onChange={setSource}/>
      </AdminField>
      <AdminField required>{t('退款流水号','Refund bank reference','Referensi bank pengembalian')}<input name="reference" required maxLength={120}/></AdminField>
      <AdminField required>{t('本次退款金额（Rp）','Refund amount (Rp)','Jumlah pengembalian (Rp)')}<input name="amount" type="number" min="1" max={Math.min(expected-refunded,details.receipts.find(row=>row.reference===source)?.remaining??expected-refunded)} required/></AdminField>
      <button type="submit" className="crm-work-button" data-primary disabled={busy||!source}>{t('登记分笔退款','Record refund installment','Catat tahap pengembalian')}</button>
    </AdminForm></div>}
  </section>;
}
