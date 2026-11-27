import {enrollmentPaymentPath} from '../../utils/financeNavigation';
import {AdminDateField} from '../admin/AdminDateField';
import {AdminListPagination} from '../admin/AdminList';
import {paymentWorkspaceLabel} from '../../utils/crmPaymentPresentation';
import {AdminRecordBack} from '../admin/AdminRecordHeader';
import {AdminRecordEntry,AdminRowAction} from '../admin/AdminListControl';
import {AdminPageAction} from '../admin/AdminPageAction';
import {Landmark} from 'lucide-react';
import { CrmListFilters, CrmListSearch, CrmListStatus, CrmListTable, enrollmentListTone } from './CrmList';
import { lazy, Suspense, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AdminSingleSelect } from '../admin/AdminSingleSelect';
import { CrmOperationLayer } from './CrmOperationLayer';
import { AdminDiscardDialog } from '../admin/AdminDiscardDialog';
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
import {enrollmentReceivingAccountMaxLength,type EnrollmentReceivingAccount} from '../../utils/enrollmentBank';
import { AdminFormFeedback,AdminFormSection,AdminFormSummary,AdminSavedReadError } from '../AdminFormLayout';
import { AdminDisclosure } from '../admin/AdminDisclosure';
import { CrmEnrollmentReviewDeadline } from './CrmEnrollmentReviewDeadline';
import type {EnrollmentFinanceProgress,EnrollmentFinanceTransfer} from '../../utils/enrollmentLearnerPayments';

type Receipt = {reference:string;amount:number;account:string|null;settledAt:string};
type PaymentCredit = {id:string;orderId:string;direction:'in'|'out';reference:string;amount:number;appliedAt:string};
type WorkOrder = { id:string; name:string; price:number; received:number; status:string; level:string; format:string; period:string; firstLessonAt:string; hasProof:boolean; proofAt?:string; reviewDueAt?:string;
  transfer?:{id:string;amount?:number;proofCount:number};progress?:EnrollmentFinanceProgress };
type Worklist = { orders:WorkOrder[]; total:number; page:number; pageSize:number };
type FinanceProof = {id:string;mime?:string;submittedAt?:string;transfer?:{amount?:number;reference?:string}|null};
type RecordRow = Omit<WorkOrder,'hasProof'> & { opened: boolean; proofs?:FinanceProof[]; proofId?: string; proofMime?: string; receipts:Receipt[]; credits:PaymentCredit[];
  receivingAccounts?:EnrollmentReceivingAccount[];learnerTransfers?:EnrollmentFinanceTransfer[];unmatchedReferences?:string[] };
const endpoint = '/api/crm/enrollment/finance';
const PdfPreview = lazy(() => import('../PdfPreview'));

function EnrollmentProofPreview({url,mime,lang}:{url:string;mime?:string;lang:CrmLanguage}) {
  const [imageFailed,setImageFailed]=useState(false);
  const t=(zh:string,en:string,id:string)=>enrollmentCopy(lang,[zh,en,id]);
  if(mime==='application/pdf'){
    const loading=t('正在加载凭证…','Loading proof…','Memuat bukti…');
    return <Suspense fallback={<p className="crm-work-muted" role="status">{loading}</p>}>
      <PdfPreview inline url={url} label={t('学员提交的转账凭证 PDF','Transfer proof PDF from the learner','PDF bukti transfer dari siswa')}
        loadingText={loading} errorText={t('PDF 无法预览，可下载查看。','PDF preview is unavailable. Download to view it.','PDF tidak dapat dipratinjau. Unduh untuk melihatnya.')}/>
    </Suspense>;
  }
  if((mime==='image/png'||mime==='image/jpeg')&&!imageFailed)
    return <img className="crm-enrollment-finance-proof-image" src={url+'?preview=image'}
      alt={t('学员提交的转账凭证','Transfer proof submitted by the learner','Bukti transfer yang dikirim siswa')}
      onError={()=>setImageFailed(true)}/>;
  return <p className="crm-work-muted">{t('凭证无法预览，可下载查看。','Preview is unavailable. Download the proof to view it.','Pratinjau tidak tersedia. Unduh bukti untuk melihatnya.')}</p>;
}

function EnrollmentProofs({proofs,lang,isLight}:{proofs:FinanceProof[];lang:CrmLanguage;isLight:boolean}) {
  const [selectedId,setSelectedId]=useState<string>();
  const t=(zh:string,en:string,id:string)=>enrollmentCopy(lang,[zh,en,id]);
  // The detail endpoint returns the newest submission first.
  const {id,mime,submittedAt,transfer}=proofs.find(proof=>proof.id===selectedId)??proofs[0];
  const url=endpoint+'/proofs/'+encodeURIComponent(id);
  const title=t('转账凭证','Transfer proof','Bukti transfer');
  return <section className="crm-enrollment-finance-proof">
    <div className="crm-enrollment-finance-proof-heading">
      <h3>{title}</h3>
      <div className="crm-enrollment-finance-proof-actions">
        {proofs.length>1&&<AdminSingleSelect lang={lang} isLight={isLight} label={title} value={id}
          onChange={setSelectedId} options={proofs.map((proof,index)=>({
            value:proof.id,
            label:[t(`凭证 ${index+1}`,`Proof ${index+1}`,`Bukti ${index+1}`),
              proof.submittedAt&&formatCrmEventTime(proof.submittedAt)].filter(Boolean).join(' · '),
          }))}/>}
        <a className="crm-work-link" href={url}>{t('下载凭证','Download proof','Unduh bukti')}</a>
      </div>
    </div>
    {submittedAt&&<p className="crm-work-muted">{t('提交时间','Submitted','Waktu pengiriman')} · <time dateTime={submittedAt}>{formatCrmEventTime(submittedAt)}</time></p>}
    {transfer!==undefined&&<dl className="crm-opportunity-summary crm-enrollment-finance-summary">
      <div><dt>{t('学员填报金额（待核实）','Learner-reported amount (unverified)','Nominal dari siswa (belum diverifikasi)')}</dt>
        <dd>{transfer?.amount==null?t('未填写','Not provided','Tidak diisi'):formatCurrency(transfer.amount,lang)}</dd></div>
      <div><dt>{t('学员填报银行流水号','Bank reference from learner','Referensi bank dari siswa')}</dt>
        <dd className="break-all">{transfer?.reference||t('未填写','Not provided','Tidak diisi')}</dd></div>
    </dl>}
    <EnrollmentProofPreview key={id} url={url} mime={mime} lang={lang}/>
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
  const [bankLookup,setBankLookup]=useState(false);
  const [manualSaved,setManualSaved]=useState(false);
  const [lookupNumber,setLookupNumber]=useState('');
  const [reviewTransferId,setReviewTransferId]=useState<string>();
  const [search,setSearch]=useState('');
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('proof_review');
  const [page,setPage]=useState(1);
  const [list,setList]=useState<Worklist>();
  const queueSummary=useRef<HTMLParagraphElement>(null);
  const [refresh,setRefresh]=useState(0);
  const [loading,setLoading]=useState(true);
  const [denied,setDenied]=useState(false);
  const [error,setError]=useState('');
  const [details,setDetails]=useState<{id:string;row?:RecordRow}>();
  const [detailError,setDetailError]=useState('');
  const [selected,setSelected]=useState<string>();
  const receiptTrigger=useRef<HTMLButtonElement>(null);
  const receiptHeading=useRef<HTMLHeadingElement>(null);
  const receiptError=useRef<HTMLParagraphElement>(null);
  const lookupInput=useRef<HTMLInputElement>(null);
  const bankOrderSummary=useRef<HTMLDivElement>(null);
  const lookupFormId=useId();
  const receiptFormId=useId();
  const receivingAccountId=useId();
  const existingReceiptControlId=useId();
  const [existingReceiptChoice,setExistingReceiptChoice]=useState('');
  const [receivingAccountChoice,setReceivingAccountChoice]=useState('');
  const [manualReceivingAccount,setManualReceivingAccount]=useState('');
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
  const [discard,setDiscard]=useState<{destination?:string;receipt?:boolean}>();
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
        if(response.status===401||response.status===403){setList(undefined);setDenied(true);setOrderId(null);setBankLookup(false);return;}
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
    const params=new URLSearchParams({order:orderId});
    if(bankLookup)params.set('bankLookup','1');
    void fetch(endpoint+'?'+params,{cache:'no-store',signal:controller.signal})
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
  },[orderId,bankLookup,refresh,refreshVersion]);
  const [reviewFocus,setReviewFocus]=useState(Boolean(target));
  const reviewHeading=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(reviewFocus&&details?.id===orderId&&details?.row){
      reviewHeading.current?.focus();
      setReviewFocus(false);
    }
  },[reviewFocus,details,orderId]);
  const open=(id:string,transferId?:string)=>{
    setBankLookup(false);setReviewTransferId(transferId);setReviewFocus(!!transferId);
    setDetails(undefined);setDetailError('');setSavedDetailRead(null);setOrderId(id);
  };
  const closeOrder=(destination?:string)=>{
    if(destination){window.location.assign(destination);return;}
    receiptOperation.clear();setOrderId(null);setDetails(undefined);setSelected(undefined);setDirty(false);setDetailError('');setDiscard(undefined);setSavedDetailRead(null);
    setBankLookup(false);setManualSaved(false);setLookupNumber('');setReviewTransferId(undefined);
    const url=new URL(window.location.href);
    if(url.searchParams.has('enrollmentOrder')){
      url.searchParams.delete('enrollmentOrder');url.searchParams.delete('opportunityReturn');url.searchParams.delete('rosterReturn');
      url.searchParams.set('paymentView','enrollment');
      window.history.replaceState(window.history.state,'',url);onLocation(url.href);
    }
    requestAnimationFrame(()=>{
      if(document.activeElement===document.body)queueSummary.current?.focus({preventScroll:true});
    });
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
      if(bankLookup)setManualSaved(true);
      setSelected(undefined);afterWrite();
    }else if(outcome?.state==='rejected'){
      setRequestId(crypto.randomUUID());
      setDetailError(outcome.code==='enrollment_duplicate_receipt'
        ? t('这笔流水已登记。','This bank reference has already been recorded.','Referensi bank sudah dicatat.')
        : outcome.code==='enrollment_receiving_account_required'
          ? t('请填写实际收款账户。','Enter the actual receiving account.','Isi rekening penerima aktual.')
          : outcome.code==='enrollment_invalid_receipt_proof'
            ? t('这笔到账与所选转账无法关联，请核对流水号和记录。','This receipt could not be linked. Check the bank reference and selected transfer.','Penerimaan tidak dapat ditautkan. Periksa referensi bank dan transfer yang dipilih.')
          : t('到账登记被拒绝，请核对输入和订单状态。','Receipt rejected. Check the details and order status.','Penerimaan ditolak. Periksa data dan status pesanan.'));
    }
  };
  const filters=[
    {value:'proof_review',label:t('待核验转账','Transfers awaiting verification','Transfer menunggu verifikasi')},
    {value:'all',label:t('全部核款订单','All payment orders','Semua pesanan pembayaran')},
    {value:'partial',label:t('部分到账','Partially paid','Dibayar sebagian')},
    {value:'paid',label:t('已足额到账','Fully paid','Lunas')},
    {value:'refund',label:t('退款记录','Refund records','Riwayat pengembalian')},
    {value:'closed',label:t('已关闭订单','Closed orders','Pesanan ditutup')},
  ];
  const className=(row:WorkOrder|RecordRow)=>[row.level,interestOption(lang,row.period),interestOption(lang,row.format)].filter(Boolean).join(' · ');
  const statusLabel=(state:string)=>enrollmentStatuses[state]?enrollmentCopy(lang,enrollmentStatuses[state]):
    state==='recovered'?t('已恢复报名','Enrollment restored','Pendaftaran dipulihkan'):state;
  const row=details?.id===orderId?details?.row:undefined;
  const transfers=row?.learnerTransfers??[];
  const pendingTransfers=transfers.filter(transfer=>transfer.verifiedAmount===undefined);
  const reviewTransfer=reviewTransferId?transfers.find(transfer=>transfer.id===reviewTransferId):pendingTransfers[0];
  const declaredAmount=(amount?:number)=>amount===undefined
    ?t('未填写金额','Amount not provided','Nominal tidak diisi'):formatCurrency(amount,lang);
  const unmatchedReceipts=row?.receipts.filter(receipt=>row.unmatchedReferences?.includes(receipt.reference))??[];
  const existingReceipt=unmatchedReceipts.find(receipt=>receipt.reference===existingReceiptChoice);
  const transferProofs=bankLookup?[]:reviewTransfer
    ?(row?.proofs??[]).filter(proof=>reviewTransfer.proofIds.includes(proof.id))
    :row?.proofs?.length?row.proofs:row?.proofId?[{id:row.proofId,mime:row.proofMime}]:[];
  const receivingAccountLabel=t('实际收款账户','Actual receiving account','Rekening penerima aktual');
  const receivingAccountOptions=(row?.receivingAccounts??[]).map(account=>({
    value:account.source+':'+account.receiptAccount,
    label:[account.bankName,account.accountName,'•••• '+account.accountSuffix].join(' · '),
    description:account.source==='current'
      ?t('当前配置账户','Current configured account','Rekening yang dikonfigurasi saat ini')
      :t('订单原收款账户','Original order account','Rekening awal pesanan'),
    receiptAccount:account.receiptAccount,
  }));
  const selectedReceivingAccount=receivingAccountOptions.find(option=>option.value===receivingAccountChoice);
  const useManualAccount=receivingAccountChoice==='other';
  const recoveringReceipt=Boolean(row&&receiptOperation.pending?.restored&&receiptOperation.pending.request.orderId===row.id);
  const refunding=Boolean(row&&['refunding','refunded'].includes(row.status));
  const canRecord=!!row&&!refunding&&(bankLookup?!manualSaved:!!reviewTransfer&&reviewTransfer.verifiedAmount===undefined);
  const editingReceipt=!!row&&!refunding&&!recoveringReceipt&&selected===row.id;
  const startReceipt=(id:string=crypto.randomUUID())=>{
    if(!row||!canRecord)return;
    setSelected(row.id);setReceivingAccountChoice('');setManualReceivingAccount('');setExistingReceiptChoice('');
    if(!bankLookup)setReviewTransferId(reviewTransfer?.id);
    setRequestId(id);setDetailError('');setSavedDetailRead(null);
  };
  useLayoutEffect(()=>{
    if(editingReceipt)receiptHeading.current?.focus();
  },[editingReceipt]);
  useLayoutEffect(()=>{
    if(editingReceipt&&detailError)receiptError.current?.focus();
  },[editingReceipt,detailError]);
  useLayoutEffect(()=>{
    if(bankLookup&&row?.id)bankOrderSummary.current?.focus({preventScroll:true});
  },[bankLookup,row?.id]);
  const lookupLabel=t('登记无凭证来款','Record a transfer without proof','Catat transfer tanpa bukti');
  const verifyTransferLabel=t('核验此笔','Verify this transfer','Verifikasi transfer ini');
  const recordReceiptLabel=bankLookup?t('填写到账信息','Enter receipt details','Isi detail penerimaan')
    :t('登记此笔实际到账','Record this verified receipt','Catat penerimaan terverifikasi ini');
  const lookupPending=bankLookup&&!!orderId&&!details&&!detailError;
  const cancelLabel=t('取消','Cancel','Batal');
  const receiptActions=editingReceipt?<>
    <button type="button" className="crm-work-button" disabled={busy} onClick={()=>{
      if(bankLookup&&dirty)setDiscard({receipt:true});
      else cancelReceipt();
    }}>{cancelLabel}</button>
    <button type="submit" form={receiptFormId} className="crm-work-button" data-primary disabled={busy||!!receiptOperation.pending}>
      {existingReceipt?t('确认关联','Link receipt','Tautkan penerimaan'):t('保存到账','Save receipt','Simpan penerimaan')}
    </button>
  </>:canRecord&&!recoveringReceipt?<button type="button" ref={receiptTrigger} className="crm-work-button" data-primary
    disabled={savedDetailRead===orderId} onClick={()=>startReceipt()}>{bankLookup?lookupLabel:verifyTransferLabel}</button>:undefined;
  const bankActions=bankLookup&&!editingReceipt?<>
    <button type="button" className="crm-work-button" disabled={busy} onClick={()=>requestClose()}>
      {manualSaved?t('完成','Done','Selesai'):cancelLabel}
    </button>
    {row?receiptActions:<button type="submit" className="crm-work-button" data-primary form={lookupFormId} disabled={lookupPending}>
      {lookupPending?t('正在查找…','Finding order…','Mencari pesanan…'):t('查找订单','Find order','Cari pesanan')}
    </button>}
  </>:receiptActions;
  const hasResults=Boolean(list?.orders.length);
  const showProgress=status==='all';
  return <section className="crm-finance-workspace" aria-label={paymentWorkspaceLabel('enrollment',lang)}>
    {denied?<p role="alert">{t('你没有报名订单核款权限。','You do not have enrollment payment access.','Anda tidak memiliki akses verifikasi pembayaran.')}</p>:<>
      <CrmListFilters label={t('筛选核款订单','Filter enrollment payments','Filter pembayaran pendaftaran')}>
        <CrmListSearch label={t('搜索报名核款订单','Search enrollment payments','Cari pembayaran pendaftaran')}
          placeholder={t('学员、报名编号或班次','Learner, order number or class','Siswa, nomor pendaftaran, atau kelas')}
          value={search} onChange={setSearch}/>
        <AdminSingleSelect lang={lang} isLight={isLight} label={t('核款队列','Payment queue','Antrean verifikasi')} value={status}
          options={filters} onChange={next=>{if(next!==status){setList(undefined);setStatus(next);setPage(1);}}}/>
        {list&&<AdminPageAction label={lookupLabel} icon={Landmark} aria-haspopup="dialog" onClick={()=>{
          setBankLookup(true);setLookupNumber('');setReviewTransferId(undefined);setDetailError('');
        }}/>}
      </CrmListFilters>
      {error&&(savedListRead?<AdminSavedReadError lang={lang} busy={loading} onRetry={()=>setRefresh(value=>value+1)}/>:<p role="alert">{error}</p>)}
      {loading&&!list&&<p className="crm-list-meta" role="status">{t('正在加载…','Loading…','Memuat…')}</p>}
      {list&&<p ref={queueSummary} tabIndex={-1} className="crm-list-meta" role="status">{status==='proof_review'
        ?t(`待核验 ${list.total} 笔转账`,`${list.total} transfers awaiting verification`,`${list.total} transfer menunggu verifikasi`)
        :t(`匹配 ${list.total} 笔订单`,`${list.total} matching orders`,`${list.total} pesanan cocok`)}</p>}
      {list&&(hasResults?<CrmListTable label={paymentWorkspaceLabel('enrollment',lang)}
        busy={loading||search.trim()!==query} headers={[t('学员与订单','Learner and order','Siswa dan pesanan'),t('班次','Class','Kelas'),
          {label:t('应收','Amount due','Tagihan'),numeric:true},{label:t('已核实实收','Verified receipts','Penerimaan terverifikasi'),numeric:true},
          {label:t('未收余额','Outstanding','Sisa tagihan'),numeric:true},t('订单核款状态','Order payment status','Status pembayaran pesanan'),
          ...(showProgress?[t('核验进度','Verification progress','Progres verifikasi')]:[]),
          t('转账凭证与期限','Transfer proof and deadline','Bukti transfer dan tenggat'),t('下一步','Next step','Langkah berikutnya')]}>
        {list.orders.map(order=>{
          const {progress}=order;
          const transferId=order.transfer?.id??progress?.nextTransferId;
          const outstanding=['paid_cancelled','expired','ended','refunding','refunded'].includes(order.status)
            ?null:Math.max(0,order.price-order.received);
          return <tr key={order.transfer?.id??order.id}>
          <td><AdminRecordEntry onClick={()=>open(order.id,order.transfer?.id)}
            aria-label={t('查看核款订单','View payment order','Lihat pesanan pembayaran')+' · '+order.name+' · '+order.id.slice(0,8)}>{order.name}</AdminRecordEntry>
            <small title={order.id}>{t('订单','Order','Pesanan')} · {order.id.slice(0,8)}</small></td>
          <td><strong>{className(order)}</strong><small>{formatCrmEventTime(order.firstLessonAt).slice(0,16)}</small></td>
          <td className="crm-list-number">{formatCurrency(order.price,lang)}</td>
          <td className="crm-list-number" data-finance-tone={order.received>0?'success':undefined}>{formatCurrency(order.received,lang)}</td>
          <td className="crm-list-number" data-finance-tone={outstanding!==null&&outstanding>0?'warning':undefined}>
            {outstanding===null?'—':formatCurrency(outstanding,lang)}</td>
          <td><CrmListStatus tone={enrollmentListTone(order.status)}>{statusLabel(order.status)}</CrmListStatus>
            {order.hasProof&&order.status==='expired'&&<small>{t('有转账凭证','Transfer proof on file','Bukti transfer tersedia')}</small>}</td>
          {showProgress&&<td>{progress?<><strong>{t(`已申报 ${progress.reported} 笔`,
            `${progress.reported} reported`,`${progress.reported} dilaporkan`)}</strong>
            <small>{t(`已核验 ${progress.verified} 笔 · 待核 ${progress.pending} 笔`,
              `${progress.verified} verified · ${progress.pending} pending`,
              `${progress.verified} terverifikasi · ${progress.pending} tertunda`)}</small>
            <small>{progress.reported>0&&progress.missingAmounts===progress.reported
              ?t('申报金额未填写','No amounts reported','Nominal belum diisi')
              :[progress.missingAmounts
                ?t('已填金额合计','Total of reported amounts entered','Total nominal yang diisi')
                :t('申报合计','Reported total','Total dilaporkan'),formatCurrency(progress.reportedTotal,lang)].join(' · ')}</small>
          </>:'—'}</td>}
          <td>{order.transfer&&<strong>{declaredAmount(order.transfer.amount)} · {t(`${order.transfer.proofCount} 份凭证`,`${order.transfer.proofCount} proof files`,`${order.transfer.proofCount} berkas bukti`)}</strong>}
            {order.proofAt?<small><time dateTime={order.proofAt}>{t('提交于','Submitted','Dikirim')} · {formatCrmEventTime(order.proofAt).slice(0,16)}</time></small>:'—'}
            {order.reviewDueAt&&<div className="crm-list-secondary"><CrmEnrollmentReviewDeadline dueAt={order.reviewDueAt} lang={lang} compact/></div>}</td>
          <td>{transferId
            ?<AdminRowAction onClick={()=>open(order.id,transferId)}>{(progress?.pending??0)>1
              ?t('核验待核转账','Review pending transfers','Periksa transfer tertunda'):verifyTransferLabel}</AdminRowAction>
            :<span className="crm-work-muted">—</span>}</td>
          </tr>;
        })}
      </CrmListTable>:<p className="crm-finance-empty">{status==='proof_review'
        ?t('暂无符合条件的待核验转账。','No matching transfers awaiting verification.','Tidak ada transfer menunggu verifikasi yang cocok.')
        :t('暂无符合条件的报名订单。','No matching enrollment orders.','Tidak ada pesanan yang cocok.')}</p>)}
      {list&&list.total>list.pageSize&&<AdminListPagination lang={lang} page={list.page}
        pageCount={Math.ceil(list.total/list.pageSize)} busy={loading} onPageChange={setPage}/>}
    </>}
    {(orderId||bankLookup)&&<CrmOperationLayer title={bankLookup?lookupLabel:row?.name??t('报名核款详情','Enrollment payment details','Detail pembayaran pendaftaran')}
      context={row&&!bankLookup?className(row):undefined} navigation={row&&!bankLookup&&sourceBack&&<AdminRecordBack target={{
        label:rosterBack?t('返回班次名单','Back to class roster','Kembali ke daftar siswa'):t('返回商机列表','Back to opportunities','Kembali ke daftar peluang'),
        onClick:()=>requestClose(sourceBack),disabled:busy,
      }}/>}
      lang={lang} isLight={isLight} customerContext={false} busy={busy}
      onClose={()=>requestClose(bankLookup?undefined:rosterBack)} footer={bankActions}>
    {bankLookup&&!row&&<AdminForm id={lookupFormId} lang={lang} className="crm-form-layout" onSubmit={event=>{
      event.preventDefault();
      if(lookupPending)return;
      const id=lookupNumber.trim().toLowerCase();
      if(!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/.test(id)){
        setDetailError(t('请输入完整报名编号。','Enter the complete enrollment order number.','Masukkan nomor pendaftaran lengkap.'));
        lookupInput.current?.focus();
        return;
      }
      setDetails(undefined);setDetailError('');
      if(id===orderId)setRefresh(value=>value+1);
      else setOrderId(id);
    }}>
      <AdminFormSection title={<>{t('定位报名订单','Find the enrollment order','Temukan pesanan pendaftaran')} <AdminRequiredNote lang={lang} inline/></>}
        description={t('根据银行账单确认来款，再查找对应的报名订单。','Confirm the transfer on the bank statement and find the corresponding enrollment order.','Pastikan dana masuk di mutasi bank, lalu cari pesanan pendaftaran yang sesuai.')}>
        <AdminField required>
          {t('报名编号','Enrollment order number','Nomor pendaftaran')}
          <input ref={lookupInput} className="admin-text-input" value={lookupNumber} readOnly={lookupPending}
            onChange={event=>{setLookupNumber(event.target.value);setDetailError('');setDetails(undefined);setOrderId(null);}}
            required autoComplete="off" maxLength={50}/>
        </AdminField>
        {detailError&&<AdminFormFeedback state="error" lang={lang}>{detailError}</AdminFormFeedback>}
        {lookupPending&&<p role="status">{t('正在查找报名订单…','Finding the enrollment order…','Mencari pesanan pendaftaran…')}</p>}
        {details?.id===orderId&&<AdminFormFeedback state="error" lang={lang}>
          {t('未找到此报名订单，请核对完整编号。','No enrollment order found. Check the complete order number.','Pesanan tidak ditemukan. Periksa nomor lengkapnya.')}
        </AdminFormFeedback>}
      </AdminFormSection>
    </AdminForm>}
    <div className="crm-enrollment-finance-detail" onChange={()=>setDirty(true)}>
    {detailError&&!editingReceipt&&(!bankLookup||row)&&(savedDetailRead!==null&&savedDetailRead===orderId
      ?<AdminSavedReadError lang={lang} onRetry={()=>setRefresh(value=>value+1)}/>:<p role="alert">{detailError}</p>)}
    {!bankLookup&&orderId&&!details&&!detailError&&<p role="status">{t('正在加载…','Loading…','Memuat…')}</p>}
    {!bankLookup&&details?.id===orderId&&!row&&<p>{t('该报名订单暂不可核款。','This enrollment order is unavailable for verification.','Pesanan ini belum dapat diverifikasi.')}</p>}
    {row&&<article className="crm-course-catalog">
      {bankLookup?<div ref={bankOrderSummary} tabIndex={-1}>
        <AdminFormSummary title={t('核对报名订单','Confirm enrollment order','Periksa pesanan pendaftaran')} fields={[
          [t('学员姓名','Learner name','Nama siswa'),row.name],
          [t('班次','Class','Kelas'),className(row)],
          [t('报名编号','Order number','Nomor pendaftaran'),row.id,'wide'],
          [t('核款状态','Payment status','Status pembayaran'),<CrmListStatus tone={enrollmentListTone(row.status)}>{statusLabel(row.status)}</CrmListStatus>],
          [t('应收','Amount due','Tagihan'),formatCurrency(row.price,lang)],
          [t('已核实实收','Verified receipts','Penerimaan terverifikasi'),formatCurrency(row.received,lang)],
          [row.received>row.price?t('超收金额','Overpayment','Kelebihan pembayaran'):t('未收余额','Outstanding','Sisa tagihan'),
            formatCurrency(Math.abs(row.price-row.received),lang)],
        ]}/>
      </div>:<dl className="crm-opportunity-summary crm-enrollment-finance-summary">
        <div><dt>{t('报名编号','Order number','Nomor pendaftaran')}</dt><dd>{row.id}</dd></div>
        <div><dt>{t('核款状态','Payment status','Status pembayaran')}</dt><dd>{statusLabel(row.status)}</dd></div>
        <div><dt>{t('应收','Amount due','Tagihan')}</dt><dd>{formatCurrency(row.price,lang)}</dd></div>
        <div><dt>{t('已核实实收','Verified receipts','Penerimaan terverifikasi')}</dt><dd>{formatCurrency(row.received,lang)}</dd></div>
        {row.received>row.price
          ?<div><dt>{t('超收金额','Overpayment','Kelebihan pembayaran')}</dt><dd>{formatCurrency(row.received-row.price,lang)}</dd></div>
          :<div><dt>{t('未收余额','Outstanding','Sisa tagihan')}</dt><dd>{formatCurrency(row.price-row.received,lang)}</dd></div>}
      </dl>}
      {row.opened&&<p className="crm-work-muted">{t('已确认开班','Class confirmed','Kelas dikonfirmasi')}</p>}
      {manualSaved&&<AdminFormFeedback lang={lang} state="saved">{t('银行来款已登记。','Bank receipt recorded.','Dana masuk telah dicatat.')}</AdminFormFeedback>}
      {!bankLookup&&reviewTransfer&&<>
        {transfers.length>1&&<AdminSingleSelect lang={lang} isLight={isLight} label={t('转账记录','Reported transfer','Transfer yang dilaporkan')}
          value={reviewTransfer.id} disabled={editingReceipt||busy||!!receiptOperation.pending}
          options={transfers.map(transfer=>({value:transfer.id,label:[
            declaredAmount(transfer.amount),formatCrmEventTime(transfer.submittedAt),
            transfer.verifiedAmount===undefined?t('待核验','Awaiting verification','Menunggu verifikasi'):t('已核验','Verified','Terverifikasi'),
          ].join(' · ')}))} onChange={setReviewTransferId}/>}
        {reviewTransfer.reviewDueAt&&<CrmEnrollmentReviewDeadline dueAt={reviewTransfer.reviewDueAt} lang={lang}/>}
        <p role="status"><CrmListStatus tone={reviewTransfer.verifiedAmount===undefined?'warning':'success'}>
          {reviewTransfer.verifiedAmount===undefined?t('此笔待核验','This transfer is awaiting verification','Transfer ini menunggu verifikasi')
            :t('此笔已核验','This transfer is verified','Transfer ini telah diverifikasi')}
        </CrmListStatus>{' · '}{t(`本单还有 ${pendingTransfers.length} 笔待核验`,`${pendingTransfers.length} transfers awaiting verification on this order`,
          `${pendingTransfers.length} transfer pada pesanan ini menunggu verifikasi`)}</p>
      </>}
      {!!transferProofs.length&&<div ref={reviewHeading} tabIndex={-1} className="crm-list-review-target">
        <EnrollmentProofs key={row.id+':'+(reviewTransfer?.id??'all')} proofs={transferProofs} lang={lang} isLight={isLight}/>
      </div>}
      {!!row.receipts?.length&&(!bankLookup||!editingReceipt)&&<section className="crm-enrollment-finance-receipts">
        <h3>{t('已核实收款流水','Verified receipt history','Riwayat penerimaan terverifikasi')}</h3>
        <ul className="crm-course-records">{row.receipts.map(receipt=><li key={receipt.reference}>
          <strong>{formatCurrency(receipt.amount,lang)}</strong> · <time dateTime={receipt.settledAt}>{formatCrmEventTime(receipt.settledAt)}</time>
          <p>{t('实际收款账户','Actual receiving account','Rekening penerima aktual')} · {receipt.account??t('未记录','Not recorded','Belum dicatat')}</p>
          <p>{t('银行流水号','Bank reference','Nomor referensi bank')} · {receipt.reference}</p>
        </li>)}</ul>
      </section>}
      {!!row.credits?.length&&(!bankLookup||!editingReceipt)&&<AdminDisclosure heading={t('订单冲抵记录','Order payment credit history','Riwayat penggunaan dana antar pesanan')}>
        <ul className="crm-course-records">{row.credits.map(credit=><li key={credit.id}>
          <strong>{credit.direction==='in'
            ?t('旧单款项冲抵本单','Applied from an earlier order','Dana dari pesanan sebelumnya')
            :t('本单款项冲抵新单','Applied to a new order','Dana digunakan untuk pesanan baru')}</strong>
          {' · '}{formatCurrency(credit.amount,lang)}{' · '}<time dateTime={credit.appliedAt}>{formatCrmEventTime(credit.appliedAt)}</time>
          <p>{t('银行流水号','Bank reference','Nomor referensi bank')} · {credit.reference}</p>
          <a className="crm-work-link" href={enrollmentPaymentPath(credit.orderId)}>
            {t('查看关联订单','View related order','Lihat pesanan terkait')}
          </a>
        </li>)}</ul>
      </AdminDisclosure>}
      {recoveringReceipt ?
        <CrmOrderOperationFeedback lang={lang} command={receiptOperation} onCheck={()=>void receiptOutcome(receiptOperation.check())} onRetry={()=>{}}
          onResume={!canRecord?undefined:()=>{
            const originalRequestId=receiptOperation.resume();
            if(!originalRequestId)return;
            startReceipt(originalRequestId);
          }}/> :
      refunding ? bankLookup
        ?<p>{t('退款中的订单无法登记银行来款。请在退款记录中核对。','Bank receipts cannot be recorded on an order in the refund workflow. Check the refund records.','Dana masuk tidak dapat dicatat pada pesanan dalam proses pengembalian. Periksa riwayat pengembalian.')}</p>
        :<CrmEnrollmentRefund id={row.id} lang={lang} isLight={isLight} onUpdate={afterWrite} onBusyChange={setRefundBusy} onDraftChange={()=>setDirty(true)}/> :
      editingReceipt&&<AdminForm id={receiptFormId} lang={lang} className="crm-form-layout crm-enrollment-receipt-form" onSubmit={async (event:React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (busy||receiptOperation.pending) return;
        if(!canRecord){
          setDetailError(t('此笔转账的核验状态已变化，请查看最新记录。','The transfer status changed. Check the current record.','Status transfer berubah. Periksa catatan terbaru.'));
          return;
        }
        if(existingReceiptChoice){
          if(!existingReceipt||bankLookup||!reviewTransfer)return;
          setDetailError('');setDirty(true);
          await receiptOutcome(receiptOperation.submit('receipts',row.id,{existingReference:existingReceipt.reference,proofId:reviewTransfer.id,requestId}));
          return;
        }
        const form = new FormData(event.currentTarget);
        const receivingAccount=useManualAccount?manualReceivingAccount.trim():selectedReceivingAccount?.receiptAccount;
        if(!receivingAccount){
          setDetailError(useManualAccount
            ?t('请填写实际收款账户。','Enter the actual receiving account.','Isi rekening penerima aktual.')
            :t('请选择实际收款账户。','Select the actual receiving account.','Pilih rekening penerima aktual.'));
          return;
        }
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
          receivingAccount,transferredAt:instant.toISOString(),requestId,
          ...(!bankLookup&&reviewTransfer?{proofId:reviewTransfer.id}:{})}));
      }}>
        <h3 ref={receiptHeading} tabIndex={-1} data-admin-form-title>{recordReceiptLabel} <AdminRequiredNote lang={lang} inline/></h3>
        {detailError&&<p ref={receiptError} tabIndex={-1} role="alert">{detailError}</p>}
        <CrmOrderOperationFeedback lang={lang} command={receiptOperation}
          onCheck={()=>void receiptOutcome(receiptOperation.check())} onRetry={()=>void receiptOutcome(receiptOperation.retry())}/>
        <fieldset data-admin-stack disabled={busy||!!receiptOperation.pending}>
        {!bankLookup&&unmatchedReceipts.length>0&&<AdminField as="div" htmlFor={existingReceiptControlId}>
          <label>{t('银行来款来源','Receipt source','Sumber penerimaan')}</label>
          <AdminSingleSelect controlId={existingReceiptControlId} lang={lang} isLight={isLight}
            label={t('银行来款来源','Receipt source','Sumber penerimaan')} value={existingReceiptChoice||'new'}
            onChange={value=>{setExistingReceiptChoice(value==='new'?'':value);setDirty(true);setDetailError('');}}
            options={[{value:'new',label:t('登记新流水','Record a new receipt','Catat transaksi baru')},
              ...unmatchedReceipts.map(receipt=>({value:receipt.reference,label:[
                t('关联已登记流水','Link an existing receipt','Tautkan transaksi tercatat'),receipt.reference,
                formatCurrency(receipt.amount,lang),formatCrmEventTime(receipt.settledAt),
              ].join(' · ')}))]}/>
        </AdminField>}
        <fieldset data-admin-stack disabled={!!existingReceiptChoice} style={existingReceiptChoice?{display:'none'}:undefined}>
        <AdminField>{t('银行流水号','Bank reference','Nomor referensi bank')}<input className="admin-text-input" name="reference" maxLength={120} required/></AdminField>
        <AdminField as="div" htmlFor={receivingAccountId} required>
          <label>{receivingAccountLabel}</label>
          <AdminSingleSelect controlId={receivingAccountId} lang={lang} isLight={isLight} required disabled={busy||!!receiptOperation.pending}
            label={receivingAccountLabel} emptyLabel={t('选择收款账户','Select a receiving account','Pilih rekening penerima')}
            value={useManualAccount?'other':selectedReceivingAccount?.value??''}
            onChange={value=>{setReceivingAccountChoice(value);setDirty(true);setDetailError('');}}
            options={[...receivingAccountOptions,{value:'other',
              label:t('其他账户（手工填写）','Other account (enter manually)','Rekening lain (isi manual)')}]}/>
          <p>{t('按收款系统中的实际入账账户选择。','Select the account credited in the payment system.','Pilih rekening yang menerima dana di sistem pembayaran.')}</p>
        </AdminField>
        {useManualAccount&&<AdminField>{t('手工填写收款账户','Enter receiving account','Isi rekening penerima')}
          <input className="admin-text-input" maxLength={enrollmentReceivingAccountMaxLength} required autoComplete="off"
            value={manualReceivingAccount} onChange={event=>setManualReceivingAccount(event.currentTarget.value)}/>
        </AdminField>}
        <AdminField>{t('实收金额（Rp）','Verified amount (Rp)','Nominal terverifikasi (Rp)')}<input className="admin-text-input" name="amount" type="number" min="1" step="1" required/></AdminField>
        <AdminDateField name="time" lang={lang} withTime required onChange={()=>setDirty(true)}
          label={t('实际到账时间','Actual receipt time','Waktu dana diterima')}/>
        </fieldset>
        </fieldset>
      </AdminForm>}
    </article>}
    </div>
    </CrmOperationLayer>}
    {discard&&<AdminDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(undefined)} onDiscard={()=>{
      if(discard.receipt){
        setDiscard(undefined);
        cancelReceipt();
      }else closeOrder(discard.destination);
    }}/>}
  </section>;
}
