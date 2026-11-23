import {AdminDateField} from '../admin/AdminDateField';
import {AdminListPagination} from '../admin/AdminList';
import {paymentWorkspaceLabel} from '../../utils/crmPaymentPresentation';
import {AdminRecordBack} from '../admin/AdminRecordHeader';
import {AdminRecordEntry,AdminRowAction} from '../admin/AdminListControl';
import { CrmListFilters, CrmListSearch, CrmListStatus, CrmListTable, enrollmentListTone } from './CrmList';
import { useEffect, useRef, useState } from 'react';
import { CrmSingleSelect } from './CrmSingleSelect';
import { CrmOperationLayer } from './CrmOperationLayer';
import { CrmDiscardDialog } from './CrmDetailWorkspace';
import { interestOption } from '../../utils/enrollmentInterestCopy';
import {enrollmentCopy} from '../../utils/enrollmentCatalog';
import {enrollmentStatuses} from '../../utils/enrollmentOrderStatus';
import { formatCurrency } from '../../utils/currency';
import type { CrmLanguage } from '../../utils/crmLanguage';
import {CrmOrderOperationFeedback,useCrmOrderOperation} from './CrmOrderOperation';
import { CrmEnrollmentRefund } from './CrmEnrollmentResolution';
import { enrollmentRosterReturnPath } from '../../utils/crmEnrollmentManagement';
import { enrollmentOpportunityReturnPath } from '../../utils/crmEnrollmentOpportunityRoute';
import { formatCrmEventTime,validateLocalInstant,viewerTimeZone } from '../../utils/crmOperatingTime';
import { AdminField,AdminForm,AdminRequiredNote } from '../AdminForm';
import { AdminFormActions,AdminSavedReadError } from '../AdminFormLayout';
import { CrmDisclosure } from './CrmDisclosure';
import { CrmEnrollmentReviewDeadline } from './CrmEnrollmentReviewDeadline';

type Receipt = {reference:string;amount:number;account:string|null;settledAt:string};
type PaymentCredit = {id:string;orderId:string;direction:'in'|'out';reference:string;amount:number;appliedAt:string};
type WorkOrder = { id:string; name:string; price:number; received:number; status:string; level:string; format:string; period:string; firstLessonAt:string; hasProof:boolean; proofAt?:string; reviewDueAt?:string };
type Worklist = { orders:WorkOrder[]; total:number; page:number; pageSize:number };
type FinanceProof = {id:string;mime?:string;submittedAt?:string;transfer?:{amount?:number;reference?:string}|null};
type RecordRow = Omit<WorkOrder,'hasProof'> & { opened: boolean; proofs?:FinanceProof[]; proofId?: string; proofMime?: string; firstReviewDueAt?:string; receipts:Receipt[]; credits:PaymentCredit[] };
const endpoint = '/api/crm/enrollment/finance';

function EnrollmentProof({proof:{id,mime,submittedAt,transfer},lang}:{proof:FinanceProof;lang:CrmLanguage}) {
  const [failed,setFailed]=useState(false);
  const t=(zh:string,en:string,id:string)=>enrollmentCopy(lang,[zh,en,id]);
  const url=endpoint+'/proofs/'+encodeURIComponent(id);
  const image=mime==='image/png'||mime==='image/jpeg';
  return <section className="crm-enrollment-finance-proof">
    <div className="crm-enrollment-finance-proof-heading">
      <h3>{t('转账凭证','Transfer proof','Bukti transfer')}</h3>
      <a className="crm-work-link" href={url}>{t('下载凭证','Download proof','Unduh bukti')}</a>
    </div>
    {submittedAt&&<p className="crm-work-muted">{t('提交时间','Submitted','Waktu pengiriman')} · <time dateTime={submittedAt}>{formatCrmEventTime(submittedAt)}</time></p>}
    {transfer!==undefined&&<dl className="crm-opportunity-summary crm-enrollment-finance-summary">
      <div><dt>{t('学员填报金额（待核实）','Learner-reported amount (unverified)','Nominal dari siswa (belum diverifikasi)')}</dt>
        <dd>{transfer?.amount==null?t('未填写','Not provided','Tidak diisi'):formatCurrency(transfer.amount,lang)}</dd></div>
      <div><dt>{t('学员填报银行流水号','Bank reference from learner','Referensi bank dari siswa')}</dt>
        <dd className="break-all">{transfer?.reference||t('未填写','Not provided','Tidak diisi')}</dd></div>
    </dl>}
    {image&&(failed
      ?<p className="crm-work-muted">{t('图片无法预览，可下载查看。','Image preview is unavailable. Download to view it.','Pratinjau tidak tersedia. Unduh untuk melihat gambar.')}</p>
      :<img className="crm-enrollment-finance-proof-image" src={url+'?preview=image'} loading="lazy"
        alt={t('学员提交的转账凭证','Transfer proof submitted by the learner','Bukti transfer yang dikirim siswa')}
        onError={()=>setFailed(true)}/>)}
  </section>;
}

export function CrmEnrollmentFinance({actorId,lang,isLight=true,refreshVersion,onRefreshingChange,onDirty,onBusy,onLocation,onQueueChanged}:{
  actorId:string;lang:CrmLanguage;isLight?:boolean;refreshVersion:number;onRefreshingChange:(loading:boolean)=>void;onDirty:(dirty:boolean)=>void;onBusy:(busy:boolean)=>void;
  onLocation:(url:string)=>void;onQueueChanged:()=>void;
}) {
  const t=(zh:string,en:string,id:string)=>enrollmentCopy(lang,[zh,en,id]);
  const params=new URLSearchParams(window.location.search),target=params.get('enrollmentOrder');
  const rosterBack=enrollmentRosterReturnPath(params.get('rosterReturn'),target);
  const returnTo=enrollmentOpportunityReturnPath(params.get('opportunityReturn'));
  const sourceBack=rosterBack??returnTo;
  const [orderId,setOrderId]=useState<string|null>(target);
  const [search,setSearch]=useState('');
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('proof_review');
  const [page,setPage]=useState(1);
  const [list,setList]=useState<Worklist>();
  const [refresh,setRefresh]=useState(0);
  const [loading,setLoading]=useState(true);
  const [denied,setDenied]=useState(false);
  const [error,setError]=useState('');
  const [details,setDetails]=useState<{id:string;row?:RecordRow}>();
  const [detailError,setDetailError]=useState('');
  const [selected,setSelected]=useState<string>();
  const receiptTrigger=useRef<HTMLButtonElement>(null);
  const cancelReceipt=()=>{
    receiptOperation.clear();setSelected(undefined);setDirty(false);setDetailError('');
    requestAnimationFrame(()=>receiptTrigger.current?.focus({preventScroll:true}));
  };
  const [requestId,setRequestId]=useState('');
  const [dirty,setDirty]=useState(false);
  const receiptOperation=useCrmOrderOperation({actorId,orderId});
  const [refundBusy,setRefundBusy]=useState(false);
  const busy=receiptOperation.busy||refundBusy;
  const [savedDetailRead,setSavedDetailRead]=useState<string|null>(null);
  const [savedListRead,setSavedListRead]=useState(false);
  const [discard,setDiscard]=useState<{destination?:string}>();
  useEffect(()=>{onRefreshingChange(loading);return()=>onRefreshingChange(false);},[loading,onRefreshingChange]);
  useEffect(()=>{onDirty(dirty);return ()=>onDirty(false);},[dirty,onDirty]);
  useEffect(()=>{onBusy(busy);return ()=>onBusy(false);},[busy,onBusy]);
  useEffect(()=>{
    const timer=window.setTimeout(()=>{setQuery(search.trim());setPage(1);},200);
    return ()=>window.clearTimeout(timer);
  },[search]);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');
    void fetch(endpoint+'/worklist?'+new URLSearchParams({q:query,status,page:String(page)}),{cache:'no-store',signal:controller.signal})
      .then(async response=>{
        if(controller.signal.aborted)return;
        if(response.status===401||response.status===403){setList(undefined);setDenied(true);setOrderId(null);return;}
        if(!response.ok)throw Error();
        const data:Worklist=await response.json();
        if(!controller.signal.aborted){setList(data);setDenied(false);setSavedListRead(false);}
      }).catch(()=>{
        if(!controller.signal.aborted)setError(t('暂时无法读取课程报名订单。','Enrollment orders could not be loaded.','Pesanan pendaftaran belum dapat dimuat.'));
      }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[query,status,page,refresh,refreshVersion]);
  useEffect(()=>{
    if(!orderId)return;
    const controller=new AbortController();
    setDetailError('');
    void fetch(endpoint+'?order='+encodeURIComponent(orderId),{cache:'no-store',signal:controller.signal})
      .then(async response=>{
        if(controller.signal.aborted)return;
        if([401,403,404].includes(response.status)){
          setDetails(undefined);setSavedDetailRead(null);
          setDetailError(t('此报名订单当前无法查看。','This enrollment order is no longer available.','Pesanan pendaftaran ini tidak dapat dilihat lagi.'));
          return;
        }
        if(!response.ok)throw Error();
        const data: {orders:RecordRow[]}=await response.json();
        if(!controller.signal.aborted){setDetails({id:orderId,row:data.orders.find(row=>row.id===orderId)});setSavedDetailRead(null);}
      }).catch(()=>{
        if(!controller.signal.aborted)setDetailError(t('暂时无法读取核款详情。','Payment details could not be loaded.','Detail verifikasi belum dapat dimuat.'));
      });
    return ()=>controller.abort();
  },[orderId,refresh,refreshVersion]);
  const [reviewFocus,setReviewFocus]=useState(Boolean(target));
  const reviewHeading=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(reviewFocus&&details?.id===orderId&&details?.row){
      reviewHeading.current?.focus();
      setReviewFocus(false);
    }
  },[reviewFocus,details,orderId]);
  const open=(id:string,review=false)=>{
    setReviewFocus(review);
    setDetails(undefined);setDetailError('');setSavedDetailRead(null);setOrderId(id);
  };
  const closeOrder=(destination?:string)=>{
    if(destination){window.location.assign(destination);return;}
    receiptOperation.clear();setOrderId(null);setDetails(undefined);setSelected(undefined);setDirty(false);setDetailError('');setDiscard(undefined);setSavedDetailRead(null);
    const url=new URL(window.location.href);
    if(url.searchParams.has('enrollmentOrder')){
      url.searchParams.delete('enrollmentOrder');url.searchParams.delete('opportunityReturn');url.searchParams.delete('rosterReturn');
      url.searchParams.set('paymentView','enrollment');
      window.history.replaceState(window.history.state,'',url);onLocation(url.href);
    }
  };
  const requestClose=(destination?:string)=>{
    if(busy)return;
    if(dirty)setDiscard({destination});
    else closeOrder(destination);
  };
  const afterWrite=()=>{setDirty(false);setSavedDetailRead(orderId);setSavedListRead(true);setRefresh(value=>value+1);onQueueChanged();};
  const receiptOutcome=async(result:ReturnType<typeof receiptOperation.submit>)=>{
    const outcome=await result;
    if(outcome?.state==='saved'){
      setSelected(undefined);afterWrite();
    }else if(outcome?.state==='rejected'){
      setRequestId(crypto.randomUUID());
      setDetailError(outcome.code==='enrollment_duplicate_receipt'
        ? t('这笔流水已登记。','This bank reference has already been recorded.','Referensi bank sudah dicatat.')
        : outcome.code==='enrollment_receiving_account_required'
          ? t('请填写实际收款账户。','Enter the actual receiving account.','Isi rekening penerima aktual.')
          : t('到账登记被拒绝，请核对输入和订单状态。','Receipt rejected. Check the details and order status.','Penerimaan ditolak. Periksa data dan status pesanan.'));
    }
  };
  const filters=[
    {value:'pending',label:t('待核验及部分到账','Pending and partially paid','Menunggu verifikasi dan dibayar sebagian')},
    {value:'all',label:t('全部核款订单','All payment orders','Semua pesanan pembayaran')},
    {value:'proof_review',label:t('待核验凭证','Proof awaiting review','Bukti menunggu verifikasi')},
    {value:'partial',label:t('部分到账','Partially paid','Dibayar sebagian')},
    {value:'paid',label:t('已足额到账','Fully paid','Lunas')},
    {value:'refund',label:t('退款记录','Refund records','Riwayat pengembalian')},
    {value:'closed',label:t('已关闭订单','Closed orders','Pesanan ditutup')},
  ];
  const className=(row:WorkOrder|RecordRow)=>[row.level,interestOption(lang,row.period),interestOption(lang,row.format)].filter(Boolean).join(' · ');
  const statusLabel=(state:string)=>enrollmentStatuses[state]?enrollmentCopy(lang,enrollmentStatuses[state]):
    state==='recovered'?t('已恢复报名','Enrollment restored','Pendaftaran dipulihkan'):state;
  const row=details?.id===orderId?details?.row:undefined;
  const hasResults=Boolean(list?.orders.length);
  return <section className="crm-finance-workspace" aria-label={paymentWorkspaceLabel('enrollment',lang)}>
    {denied?<p role="alert">{t('你没有报名订单核款权限。','You do not have enrollment payment access.','Anda tidak memiliki akses verifikasi pembayaran.')}</p>:<>
      <CrmListFilters label={t('筛选核款订单','Filter enrollment payments','Filter pembayaran pendaftaran')}>
        <CrmListSearch label={t('搜索报名核款订单','Search enrollment payments','Cari pembayaran pendaftaran')}
          placeholder={t('学员、报名编号或班次','Learner, order number or class','Siswa, nomor pendaftaran, atau kelas')}
          value={search} onChange={setSearch}/>
        <CrmSingleSelect lang={lang} isLight={isLight} label={t('核款队列','Payment queue','Antrean verifikasi')} value={status}
          options={filters} onChange={next=>{setStatus(next);setPage(1);}}/>
      </CrmListFilters>
      {error&&(savedListRead?<AdminSavedReadError lang={lang} busy={loading} onRetry={()=>setRefresh(value=>value+1)}/>:<p role="alert">{error}</p>)}
      {loading&&!list&&<p className="crm-list-meta" role="status">{t('正在加载…','Loading…','Memuat…')}</p>}
      {list&&<p className="crm-list-meta" role="status">{t(`匹配 ${list.total} 笔订单`,`${list.total} matching orders`,`${list.total} pesanan cocok`)}</p>}
      {list&&(hasResults?<CrmListTable label={paymentWorkspaceLabel('enrollment',lang)}
        busy={loading||search.trim()!==query} headers={[t('学员与订单','Learner and order','Siswa dan pesanan'),t('班次','Class','Kelas'),
          {label:t('应收','Amount due','Tagihan'),numeric:true},{label:t('已核实实收','Verified receipts','Penerimaan terverifikasi'),numeric:true},
          {label:t('未收余额','Outstanding','Sisa tagihan'),numeric:true},t('核款状态','Payment status','Status pembayaran'),
          t('凭证与期限','Proof and deadline','Bukti dan tenggat'),t('下一步','Next step','Langkah berikutnya')]}>
        {list.orders.map(order=><tr key={order.id}>
          <td><AdminRecordEntry onClick={()=>open(order.id)}
            aria-label={t('查看核款订单','View payment order','Lihat pesanan pembayaran')+' · '+order.name+' · '+order.id.slice(0,8)}>{order.name}</AdminRecordEntry>
            <small title={order.id}>{t('订单','Order','Pesanan')} · {order.id.slice(0,8)}</small></td>
          <td><strong>{className(order)}</strong><small>{formatCrmEventTime(order.firstLessonAt).slice(0,16)}</small></td>
          <td className="crm-list-number">{formatCurrency(order.price,lang)}</td>
          <td className="crm-list-number">{formatCurrency(order.received,lang)}</td>
          <td className="crm-list-number">{['paid_cancelled','expired','ended','refunding','refunded'].includes(order.status)?
            '—':formatCurrency(Math.max(0,order.price-order.received),lang)}</td>
          <td><CrmListStatus tone={enrollmentListTone(order.status)}>{statusLabel(order.status)}</CrmListStatus>
            {order.hasProof&&order.status==='expired'&&<small>{t('有转账凭证','Transfer proof on file','Bukti transfer tersedia')}</small>}</td>
          <td>{order.proofAt?<time dateTime={order.proofAt}>{t('提交于','Submitted','Dikirim')} · {formatCrmEventTime(order.proofAt).slice(0,16)}</time>:'—'}
            {order.reviewDueAt&&<div className="crm-list-secondary"><CrmEnrollmentReviewDeadline dueAt={order.reviewDueAt} lang={lang} compact/></div>}</td>
          <td>{(['proof_review','partial'].includes(order.status)||order.status==='expired'&&order.hasProof)
            ?<AdminRowAction onClick={()=>open(order.id,true)}>{t('核对到账','Verify payment','Verifikasi pembayaran')}</AdminRowAction>
            :<span className="crm-work-muted">—</span>}</td>
        </tr>)}
      </CrmListTable>:<p className="crm-finance-empty">{t('暂无符合条件的报名订单。','No matching enrollment orders.','Tidak ada pesanan yang cocok.')}</p>)}
      {list&&list.total>list.pageSize&&<AdminListPagination lang={lang} page={list.page}
        pageCount={Math.ceil(list.total/list.pageSize)} busy={loading} onPageChange={setPage}/>}
    </>}
    {orderId&&<CrmOperationLayer title={row?.name??t('报名核款详情','Enrollment payment details','Detail pembayaran pendaftaran')}
      context={row?className(row):undefined} navigation={row&&sourceBack&&<AdminRecordBack target={{
        label:rosterBack?t('返回班次名单','Back to class roster','Kembali ke daftar siswa'):t('返回商机列表','Back to opportunities','Kembali ke daftar peluang'),
        onClick:()=>requestClose(sourceBack),disabled:busy,
      }}/>}
      lang={lang} isLight={isLight} customerContext={false} busy={busy} onClose={()=>requestClose(rosterBack)}>
    <div className="crm-enrollment-finance-detail" onChange={()=>setDirty(true)}>
    {detailError&&(savedDetailRead===orderId?<AdminSavedReadError lang={lang} onRetry={()=>setRefresh(value=>value+1)}/>:<p role="alert">{detailError}</p>)}
    {!details&&!detailError&&<p role="status">{t('正在加载…','Loading…','Memuat…')}</p>}
    {details?.id===orderId&&!row&&<p>{t('该报名订单暂不可核款。','This enrollment order is unavailable for verification.','Pesanan ini belum dapat diverifikasi.')}</p>}
    {row&&<article className="crm-course-catalog">
      <dl className="crm-opportunity-summary crm-enrollment-finance-summary">
        <div><dt>{t('报名编号','Order number','Nomor pendaftaran')}</dt><dd>{row.id}</dd></div>
        <div><dt>{t('核款状态','Payment status','Status pembayaran')}</dt><dd>{statusLabel(row.status)}</dd></div>
        <div><dt>{t('应收','Amount due','Tagihan')}</dt><dd>{formatCurrency(row.price,lang)}</dd></div>
        <div><dt>{t('已核实实收','Verified receipts','Penerimaan terverifikasi')}</dt><dd>{formatCurrency(row.received,lang)}</dd></div>
      </dl>
      {row.opened&&<p className="crm-work-muted">{t('已确认开班','Class confirmed','Kelas dikonfirmasi')}</p>}
      {row.firstReviewDueAt&&<CrmEnrollmentReviewDeadline dueAt={row.firstReviewDueAt} lang={lang}/>}
      {row.proofId&&<div ref={reviewHeading} tabIndex={-1} className="crm-list-review-target">
        {(row.proofs?.length?row.proofs:[{id:row.proofId,mime:row.proofMime}]).map(proof=><EnrollmentProof key={proof.id} proof={proof} lang={lang}/>)}
      </div>}
      {!!row.receipts?.length&&<section className="crm-enrollment-finance-receipts">
        <h3>{t('已核实收款流水','Verified receipt history','Riwayat penerimaan terverifikasi')}</h3>
        <ul className="crm-course-records">{row.receipts.map(receipt=><li key={receipt.reference}>
          <strong>{formatCurrency(receipt.amount,lang)}</strong> · <time dateTime={receipt.settledAt}>{formatCrmEventTime(receipt.settledAt)}</time>
          <p>{t('实际收款账户','Actual receiving account','Rekening penerima aktual')} · {receipt.account??t('未记录','Not recorded','Belum dicatat')}</p>
          <p>{t('银行流水号','Bank reference','Nomor referensi bank')} · {receipt.reference}</p>
        </li>)}</ul>
      </section>}
      {!!row.credits?.length&&<CrmDisclosure heading={t('订单冲抵记录','Order payment credit history','Riwayat penggunaan dana antar pesanan')}>
        <ul className="crm-course-records">{row.credits.map(credit=><li key={credit.id}>
          <strong>{credit.direction==='in'
            ?t('旧单款项冲抵本单','Applied from an earlier order','Dana dari pesanan sebelumnya')
            :t('本单款项冲抵新单','Applied to a new order','Dana digunakan untuk pesanan baru')}</strong>
          {' · '}{formatCurrency(credit.amount,lang)}{' · '}<time dateTime={credit.appliedAt}>{formatCrmEventTime(credit.appliedAt)}</time>
          <p>{t('银行流水号','Bank reference','Nomor referensi bank')} · {credit.reference}</p>
          <a className="crm-work-link" href={'/crm?tab=payments&enrollmentOrder='+encodeURIComponent(credit.orderId)}>
            {t('查看关联订单','View related order','Lihat pesanan terkait')}
          </a>
        </li>)}</ul>
      </CrmDisclosure>}
      {receiptOperation.pending?.restored&&receiptOperation.pending.request.orderId===row.id ?
        <CrmOrderOperationFeedback lang={lang} command={receiptOperation} onCheck={()=>void receiptOutcome(receiptOperation.check())} onRetry={()=>{}}
          onResume={['refunding','refunded'].includes(row.status)?undefined:()=>{
            const originalRequestId=receiptOperation.resume();
            if(!originalRequestId)return;
            setSelected(row.id);setRequestId(originalRequestId);setDetailError('');
          }}/> :
      ['refunding','refunded'].includes(row.status) ? <CrmEnrollmentRefund id={row.id} lang={lang} isLight={isLight} onUpdate={afterWrite} onBusyChange={setRefundBusy} onDraftChange={()=>setDirty(true)}/> :
      selected !== row.id ? <div className="crm-enrollment-finance-actions"><button type="button" ref={receiptTrigger} className="crm-work-button" data-primary disabled={savedDetailRead===orderId} onClick={() => {
        setSelected(row.id);setRequestId(crypto.randomUUID());setDetailError('');setSavedDetailRead(null);
      }}>{t('登记实际到账','Record verified receipt','Catat dana terverifikasi')}</button></div>
      : <AdminForm lang={lang} className="crm-form-layout" onSubmit={async (event:React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (busy||receiptOperation.pending) return;
        const form = new FormData(event.currentTarget);
        const localTime=String(form.get('time'));
        const instant=new Date(localTime);
        try{
          validateLocalInstant(localTime,instant,viewerTimeZone());
        }catch{
          setDetailError(t('请核对实际到账日期和时间。','Check the actual receipt date and time.','Periksa tanggal dan waktu dana diterima.'));
          return;
        }
        setDetailError('');setDirty(true);
        await receiptOutcome(receiptOperation.submit('receipts',row.id,{amount:Number(form.get('amount')),reference:form.get('reference'),
          receivingAccount:form.get('receivingAccount'),transferredAt:instant.toISOString(),requestId}));
      }}>
        <h3 data-admin-form-title>{t('登记实际到账','Record verified receipt','Catat dana terverifikasi')} <AdminRequiredNote lang={lang} inline/></h3>
        <CrmOrderOperationFeedback lang={lang} command={receiptOperation}
          onCheck={()=>void receiptOutcome(receiptOperation.check())} onRetry={()=>void receiptOutcome(receiptOperation.retry())}/>
        <fieldset className="crm-form-layout" style={{border:0,padding:0,margin:0,minWidth:0}} disabled={busy||!!receiptOperation.pending}>
        <AdminField>{t('银行流水号','Bank reference','Nomor referensi bank')}<input name="reference" maxLength={120} required/></AdminField>
        <AdminField>{t('实际收款账户','Actual receiving account','Rekening penerima aktual')}
          <input name="receivingAccount" maxLength={160} required autoComplete="off"/>
          <p>{t('按收款系统中的实际入账账户填写。','Enter the account credited in the payment system.','Isi rekening yang menerima dana di sistem pembayaran.')}</p>
        </AdminField>
        <AdminField>{t('实收金额（Rp）','Verified amount (Rp)','Nominal terverifikasi (Rp)')}<input name="amount" type="number" min="1" step="1" required/></AdminField>
        <AdminDateField name="time" lang={lang} withTime required onChange={()=>setDirty(true)}
          label={t('实际到账时间','Actual receipt time','Waktu dana diterima')}/>
        </fieldset>
        <AdminFormActions>
          <button type="button" className="crm-work-button" disabled={busy} onClick={cancelReceipt}>{t('取消','Cancel','Batal')}</button>
          <button type="submit" className="crm-work-button" data-primary disabled={busy||!!receiptOperation.pending}>{t('保存到账','Save receipt','Simpan penerimaan')}</button>
        </AdminFormActions>
      </AdminForm>}
    </article>}
    </div>
    </CrmOperationLayer>}
    {discard&&<CrmDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(undefined)} onDiscard={()=>closeOrder(discard.destination)}/>}
  </section>;
}
