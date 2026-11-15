import { useEffect,useState,useRef } from 'react';
import { enrollmentCopy,enrollmentPost,enrollmentStatuses } from '../EnrollmentApplication';
import { AdminField,AdminForm,AdminRequiredNote } from '../AdminForm';
import { AdminFormActions } from '../AdminFormLayout';
import { CrmOperationLayer } from './CrmOperationLayer';
import { CrmDiscardDialog } from './CrmDetailWorkspace';
import { CrmSingleSelect } from './CrmSingleSelect';
import { CrmListFilters, CrmListSearch, CrmListStatus, CrmListTable, enrollmentListTone, CrmListViews } from './CrmList';
import { interestOption } from '../EnrollmentInterests';
import { enrollmentClassManagementPath,type EnrollmentClassSummary } from '../../utils/crmEnrollmentManagement';
import type { EnrollmentClosureReason } from '../../utils/enrollmentOrderStatus';
import {formatCrmEventTime,formatCrmOperatingTime,validateLocalInstant,viewerTimeZone} from '../../utils/crmOperatingTime';
import { formatCurrency } from '../../utils/currency';
import type { CrmLanguage } from '../../utils/crmLanguage';
import type { PublicEnrollmentClass } from '../../utils/enrollmentCatalog';

type ServiceOrder={id:string;classId:string;name:string;level:string;format:PublicEnrollmentClass['format'];opened:boolean;canInvite:boolean;transferred:boolean;received:number;priorityRequested:boolean;period:string;schedule:string;firstLessonAt:string;status:string;replyBy?:string;closureReason?:EnrollmentClosureReason};
type SupportFilter=''|'ready_to_invite'|'awaiting_reply'|'refunding'|'refunded';
type OrderClass=Pick<ServiceOrder,'level'|'period'|'format'|'firstLessonAt'>;
type ServiceDetails={
  classes:(OrderClass&{id:string})[];
  invitations:{id:string;targetClassId:string;expiresAt:string;state:string}[];
  transferHistory:{source_class_id:string;target_class_id:string;created_at:string}[];
  receipts?:{amount:number;settledAt:string}[];
  refundProgress:RefundDetails['progress']|null;
  refundPayments?:{amount:number;returned:number}[];
  creditIn?:number;creditOut?:number;canEnd?:boolean;canRefund?:boolean;
};
type SupportAction='refund'|'invite'|'end';
type RefundDetails={
  progress:{expected:number;refunded:number;requestedAt?:string;sendBy?:string;timezone?:string};
  receipts:{reference:string;remaining:number;account?:string|null}[];
  installments:{reference:string;receiptReference:string;amount:number;returned:number}[];
};
const staff='/api/crm/enrollment/aftercare';
const finance='/api/crm/enrollment/finance';

export function CrmEnrollmentSupport({lang,isLight,embedded=false,refreshVersion=0,onRefreshingChange}:{lang:CrmLanguage;isLight:boolean;embedded?:boolean;refreshVersion?:number;onRefreshingChange?:(active:boolean)=>void}) {
  const t=(zh:string,en:string,id:string)=>enrollmentCopy(lang,[zh,en,id]);
  const [orders,setOrders]=useState<ServiceOrder[]>();
  const [quickFilter,setQuickFilter]=useState<SupportFilter>('');
  const [query,setQuery]=useState('');
  const [search,setSearch]=useState('');
  const [classFilter,setClassFilter]=useState('');
  const [progressFilter,setProgressFilter]=useState('');
  const [classOptions,setClassOptions]=useState<EnrollmentClassSummary[]>([]);
  const [canReviewRefunds,setCanReviewRefunds]=useState(false);
  const [offset,setOffset]=useState(0);
  const [total,setTotal]=useState(0);
  const [pageSize,setPageSize]=useState(30);
  const [loading,setLoading]=useState(true);
  const [selectedId,setSelectedId]=useState<string>();
  const [details,setDetails]=useState<{id:string;data:ServiceDetails}>();
  const [detailError,setDetailError]=useState('');
  const [listRevision,setListRevision]=useState(0);
  const [detailFocus,setDetailFocus]=useState<'invite'|'refund'>();
  const transferHeading=useRef<HTMLHeadingElement>(null),refundHeading=useRef<HTMLHeadingElement>(null);
  const [classes,setClasses]=useState<PublicEnrollmentClass[]>([]);
  const [editor,setEditor]=useState<{order:ServiceOrder;mode:SupportAction;requestId:string}>();
  const [targetId,setTargetId]=useState('');
  const [busy,setBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [discard,setDiscard]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const load=async(signal?:AbortSignal)=>{
    const params=new URLSearchParams({scope:'records',aftercare:quickFilter,q:search,classId:classFilter,progress:progressFilter,offset:String(offset)});
    const response=await fetch(staff+'?'+params,{cache:'no-store',signal});
    if(!response.ok){
      if(!signal?.aborted&&[401,403].includes(response.status)){setOrders(undefined);setClasses([]);setSelectedId(undefined);setCanReviewRefunds(false);}
      throw response.status;
    }
    const data=await response.json();
    if(signal?.aborted)return;
    setOrders(data.orders);setTotal(data.total);setPageSize(data.pageSize);setCanReviewRefunds(data.canReviewRefunds);
    if(offset&&data.orders.length===0)setOffset(Math.max(0,offset-data.pageSize));
  };
  useEffect(()=>{
    const timeout=window.setTimeout(()=>{setSearch(query.trim());setOffset(0);},180);
    return ()=>window.clearTimeout(timeout);
  },[query]);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);onRefreshingChange?.(true);setError('');
    void load(controller.signal).catch(cause=>{
      if(!controller.signal.aborted)setError([401,403].includes(cause)
        ?t('无权查看售后服务。','You do not have access to enrollment support.','Anda tidak memiliki akses ke layanan pendaftaran.')
        :t('售后记录暂时无法读取。','Aftercare records could not be read.','Catatan layanan belum dapat dimuat.'));
    }).finally(()=>{if(!controller.signal.aborted){setLoading(false);onRefreshingChange?.(false);}});
    return ()=>{controller.abort();onRefreshingChange?.(false);};
  },[refreshVersion,listRevision,onRefreshingChange,quickFilter,search,classFilter,progressFilter,offset]);
  useEffect(()=>{
    const controller=new AbortController(), options={cache:'no-store',signal:controller.signal} as const;
    const read=async(path:string)=>{
      const response=await fetch(path,options);
      return response.ok?(await response.json()).classes:[];
    };
    void read('/api/enrollment/classes').then(rows=>{if(!controller.signal.aborted)setClasses(rows);}).catch(()=>{});
    void read('/api/crm/enrollment/management').then(rows=>{if(!controller.signal.aborted)setClassOptions(rows);}).catch(()=>{});
    return ()=>controller.abort();
  },[refreshVersion]);
  useEffect(()=>{
    if(!notice)return;
    const timeout=window.setTimeout(()=>setNotice(''),6000);
    return ()=>window.clearTimeout(timeout);
  },[notice]);
  useEffect(()=>{
    if(!selectedId)return;
    const controller=new AbortController();
    setDetails(undefined);setDetailError('');
    void fetch(staff+'/'+encodeURIComponent(selectedId),{cache:'no-store',signal:controller.signal}).then(async response=>{
      if(!response.ok)throw response.status;
      const data:ServiceDetails=await response.json();
      if(!controller.signal.aborted)setDetails({id:selectedId,data});
    }).catch(()=>{
      if(!controller.signal.aborted)setDetailError(t('无法读取报名详情。','Enrollment details could not be read.','Detail pendaftaran belum dapat dimuat.'));
    });
    return ()=>controller.abort();
  },[selectedId,listRevision,refreshVersion]);
  const openDetail=(id:string,focus?:'invite'|'refund')=>{
    setDetailFocus(focus);setSelectedId(id);
  };
  useEffect(()=>{
    if(!editor&&details?.id===selectedId){
      if(detailFocus==='invite')transferHeading.current?.focus();
      if(detailFocus==='refund')refundHeading.current?.focus();
    }
  },[details,selectedId,detailFocus,editor]);
  const start=(order:ServiceOrder,mode:SupportAction)=>{
    setEditor({order,mode,requestId:crypto.randomUUID()});setTargetId('');setDirty(false);setError('');setNotice('');
  };
  const close=()=>{if(!busy){if(dirty)setDiscard(true);else setEditor(undefined);}};
  const endTitle=t('确认学员放弃报名','Confirm learner withdrawal','Konfirmasi siswa mengundurkan diri');
  const refundTitle=t('受理退款','Accept refund request','Terima permintaan pengembalian');
  const inviteTitle=t('发转班邀请','Send transfer invitation','Kirim undangan pindah kelas');
  const selected=orders?.find(row=>row.id===selectedId);
  const className=(row:OrderClass)=>[row.level,[row.period,row.format].filter(Boolean).map(value=>interestOption(lang,value)).join(lang==='zh'?'':' ')].join(' · ');
  const classSchedule=(row:ServiceOrder)=>[row.firstLessonAt?t('首课','First session','Pertemuan pertama')+' '+formatCrmEventTime(row.firstLessonAt).slice(0,16):'',row.schedule].filter(Boolean).join(' · ');
  const status=(row:ServiceOrder)=>{
    const copy=hasRefund(row)?t('已退出报名','Enrollment withdrawn','Pendaftaran dihentikan'):row.closureReason==='learner_cancelled'
      ?t('已取消报名','Enrollment canceled','Pendaftaran dibatalkan')
      :enrollmentStatuses[row.status]?enrollmentCopy(lang,enrollmentStatuses[row.status]) :row.status==='recovered'?t('已恢复报名','Enrollment restored','Pendaftaran dipulihkan'):'—';
    return <CrmListStatus tone={enrollmentListTone(row.status)}>{copy}</CrmListStatus>;
  };
  const selectedDetails=details?.id===selectedId?details?.data:undefined;
  const originalClassId=selectedDetails?.transferHistory.at(-1)?.source_class_id;
  const progressLabel=t('售后进度','After-sales status','Status layanan');
  const quickOptions:{value:SupportFilter;label:string}[]=[
    {value:'',label:t('全部订单','All orders','Semua pesanan')},
    {value:'ready_to_invite',label:t('可发转班邀请','Ready to invite','Bisa kirim undangan')},
    {value:'awaiting_reply',label:t('待学员答复','Awaiting learner reply','Menunggu jawaban siswa')},
  ];
  if(canReviewRefunds)quickOptions.push(
    {value:'refunding',label:enrollmentCopy(lang,enrollmentStatuses.refunding)},
    {value:'refunded',label:enrollmentCopy(lang,enrollmentStatuses.refunded)},
  );
  const recordStatusOptions=[
    {value:'',label:t('全部报名状态','All enrollment statuses','Semua status pendaftaran')},
    ...['awaiting_payment','proof_review','partial','paid','paid_cancelled'].map(value=>({value,label:enrollmentCopy(lang,enrollmentStatuses[value])})),
    {value:'closed',label:t('已关闭','Closed','Ditutup')},
  ];
  const isSearching=loading||query.trim()!==search;
  const inviteReady=(row:ServiceOrder)=>row.canInvite&&!row.replyBy;
  const hasRefund=(row:ServiceOrder)=>row.status==='refunding'||row.status==='refunded';
  const aftercareStatus=(row:ServiceOrder)=>{
    if(hasRefund(row))return <CrmListStatus tone={row.status==='refunded'?'success':'info'}>{enrollmentCopy(lang,enrollmentStatuses[row.status])}</CrmListStatus>;
    if(row.replyBy)return <>
      <CrmListStatus tone="warning">{t('待学员答复','Awaiting learner reply','Menunggu jawaban siswa')}</CrmListStatus>
      <small>{t('答复截止','Reply by','Batas jawaban')} · {formatCrmEventTime(row.replyBy).slice(0,16)}</small>
    </>;
    if(inviteReady(row))return <>
      <CrmListStatus tone="info">{t('可发转班邀请','Ready to invite','Bisa kirim undangan')}</CrmListStatus>
      {row.priorityRequested&&<small>{t('已开启优先安排','Priority arrangements enabled','Pengaturan prioritas aktif')}</small>}
    </>;
    if(row.transferred)return <CrmListStatus tone="success">{t('已转班','Transferred','Sudah pindah kelas')}</CrmListStatus>;
    return <span className="crm-work-muted">—</span>;
  };
  const inviteStates:Record<string,string>={
    offered:t('待学员答复','Awaiting learner reply','Menunggu jawaban siswa'),
    accepted:t('已接受','Accepted','Diterima'),
    declined:t('已拒绝','Declined','Ditolak'),
    expired:t('已过期','Expired','Kedaluwarsa'),
    released:t('留位已释放','Seat released','Kursi dilepas'),
  };
  const knownClass=(id:string)=>{
    const record=selectedDetails?.classes.find(row=>row.id===id);
    return record?className(record)+' · '+formatCrmEventTime(record.firstLessonAt).slice(0,16):id;
  };
  const currency=(value:number)=>formatCurrency(value,lang);
  return <section className="crm-aftercare-workspace">
    {!embedded&&<header className="admin-page-toolbar"><h1>{t('售后服务','After-sales support','Layanan purnajual')}</h1></header>}
    <div className="crm-aftercare-controls">
      <CrmListViews label={t('售后快捷筛选','After-sales quick filters','Filter cepat layanan')}>
        {quickOptions.map(({value,label})=><button type="button" className="crm-work-button" key={value}
          aria-pressed={quickFilter===value} onClick={()=>{setQuickFilter(value);setOffset(0);}}>{label}</button>)}
      </CrmListViews>
      <CrmListFilters label={t('筛选售后订单','Filter after-sales orders','Filter pesanan purnajual')}>
        <CrmListSearch label={t('搜索报名记录','Search enrollments','Cari pendaftaran')}
          placeholder={t('学员姓名、报名编号或班次','Name, order number or class','Nama siswa, nomor pesanan, atau kelas')}
          value={query} onChange={setQuery}/>
        <CrmSingleSelect lang={lang} isLight={isLight} label={t('班次','Class','Kelas')} value={classFilter}
          onChange={value=>{setClassFilter(value);setOffset(0);}}
          options={[{value:'',label:t('全部班次','All classes','Semua kelas')},...classOptions.map(row=>({
            value:row.id,label:[row.level,interestOption(lang,row.period),interestOption(lang,row.format),formatCrmEventTime(row.firstLessonAt).slice(0,16)].filter(Boolean).join(' · '),
          }))]}/>
        <CrmSingleSelect lang={lang} isLight={isLight} label={t('报名状态','Enrollment status','Status pendaftaran')} value={progressFilter}
          onChange={value=>{setProgressFilter(value);setOffset(0);}} options={recordStatusOptions}/>
        {(query||classFilter||progressFilter||quickFilter)&&<button type="button" className="crm-work-link" onClick={()=>{setQuery('');setSearch('');setClassFilter('');setProgressFilter('');setQuickFilter('');setOffset(0);}}>
          {t('清除筛选','Clear filters','Hapus filter')}</button>}
      </CrmListFilters>
    </div>
    {!orders&&!error&&<p className="crm-enrollment-empty" role="status">{t('正在加载…','Loading…','Memuat…')}</p>}
    {orders?.length===0&&!isSearching&&<p className="crm-enrollment-empty">{t('没有符合条件的报名订单。','No enrollment orders match.','Tidak ada pesanan yang cocok.')}</p>}
    {notice&&<span className="crm-opportunity-feedback" role="status">{notice}</span>}
    {!editor&&error&&<p className="crm-enrollment-empty" role="alert">{error}</p>}
    {orders&&<p className="crm-list-meta" role="status">{t(`匹配 ${total} 笔订单`,`${total} matching orders`,`${total} pesanan cocok`)}</p>}
    {!!orders?.length&&<CrmListTable label={t('售后服务订单','After-sales orders','Pesanan purnajual')}
      busy={isSearching} headers={[t('学员与订单','Learner and order','Siswa dan pesanan'),t('当前班次','Current class','Kelas saat ini'),
        t('报名状态','Enrollment status','Status pendaftaran'),progressLabel,
        {label:t('已核实实收','Verified receipts','Dana terverifikasi'),numeric:true},t('下一步','Next step','Langkah berikutnya')]}>
      {orders.map(row=><tr key={row.id}>
        <td><button className="crm-list-record" type="button" onClick={()=>openDetail(row.id)}
          aria-label={t('查看报名订单','View enrollment order','Lihat pesanan pendaftaran')+' · '+row.name+' · '+row.id.slice(0,8)}>{row.name}</button>
          <small title={row.id}>{t('订单','Order','Pesanan')} · {row.id.slice(0,8)}</small></td>
        <td className="crm-enrollment-class-cell"><strong>{className(row)}</strong><small>{formatCrmEventTime(row.firstLessonAt).slice(0,16)}</small></td>
        <td>{status(row)}</td><td>{aftercareStatus(row)}</td>
        <td className="crm-list-number">{currency(row.received)}</td>
        <td>{inviteReady(row)
          ?<button type="button" className="crm-list-action" disabled={isSearching} onClick={()=>start(row,'invite')}>{inviteTitle}</button>
          :hasRefund(row)||row.replyBy||row.transferred
            ?<button type="button" className="crm-list-action" onClick={()=>openDetail(row.id,hasRefund(row)?'refund':'invite')}>
              {hasRefund(row)?t('查看退款进度','View refund progress','Lihat kemajuan pengembalian'):
                row.replyBy?t('查看邀请','View invitation','Lihat undangan'):t('查看转班记录','View transfer history','Lihat riwayat pindah kelas')}
            </button>:<span className="crm-work-muted">—</span>}</td>
      </tr>)}
    </CrmListTable>}
    {!!orders?.length&&total>pageSize&&<div className="crm-finance-pagination crm-aftercare-pagination">
      <span className="crm-work-muted" aria-live="polite">{`${offset+1}–${offset+orders.length} / ${total}`}</span>
      <div>
        <button type="button" className="crm-work-button" disabled={isSearching||offset===0} onClick={()=>setOffset(offset-pageSize)}>{t('上一页','Previous','Sebelumnya')}</button>
        <button type="button" className="crm-work-button" disabled={isSearching||offset+pageSize>=total} onClick={()=>setOffset(offset+pageSize)}>{t('下一页','Next','Berikutnya')}</button>
      </div>
    </div>}
    {selected&&!editor&&<CrmOperationLayer title={selected.name} context={t('报名订单详情','Enrollment order details','Detail pesanan pendaftaran')} lang={lang} isLight={isLight} customerContext={false} onClose={()=>setSelectedId(undefined)}>
      <div className="crm-enrollment-order-detail">
        <dl className="crm-opportunity-summary">
          <div><dt>{t('当前班次','Current class','Kelas saat ini')}</dt><dd><a className="crm-work-link" href={enrollmentClassManagementPath(selected.classId)}>{className(selected)}</a><small>{classSchedule(selected)}</small></dd></div>
          {originalClassId&&<div><dt>{t('原班','Original class','Kelas asal')}</dt><dd>{knownClass(originalClassId)}</dd></div>}
          <div><dt>{t('报名状态','Enrollment status','Status pendaftaran')}</dt><dd>{status(selected)}</dd></div>
          <div><dt>{t('已核实实收','Verified receipts','Dana terverifikasi')}</dt><dd>{currency(selected.received)}</dd></div>
          <div><dt>{t('报名编号','Order number','Nomor pendaftaran')}</dt><dd>{selected.id}</dd></div>
        </dl>
        {detailError?<p role="alert">{detailError}</p>:!selectedDetails?<p role="status">{t('正在加载售后明细…','Loading after-sales details…','Memuat detail layanan…')}</p>:<>
          {(selected.canInvite||selectedDetails.invitations.length>0||selectedDetails.transferHistory.length>0)&&<section>
            <h3 ref={transferHeading} tabIndex={-1}>{t('转班记录','Transfer history','Riwayat pindah kelas')}</h3>
            {!!selectedDetails.transferHistory.length&&<ul className="crm-enrollment-detail-list">
              {selectedDetails.transferHistory.map((entry,index)=><li key={index}>
                {knownClass(entry.source_class_id)} → {knownClass(entry.target_class_id)}
                <small>{t('转班时间','Transferred at','Waktu pindah')} · {formatCrmEventTime(entry.created_at).slice(0,16)}</small>
              </li>)}</ul>}
            {!!selectedDetails.invitations.length&&<ul className="crm-enrollment-detail-list">
              {selectedDetails.invitations.map(entry=><li key={entry.id}>
                <strong>{inviteStates[entry.state]??entry.state}</strong> · {knownClass(entry.targetClassId)}
                {entry.state==='offered'&&selected.replyBy&&<small>{t('答复截止','Reply by','Batas jawaban')} · {formatCrmEventTime(selected.replyBy).slice(0,16)}</small>}
              </li>)}</ul>}
            {inviteReady(selected)&&<button className="crm-work-button" type="button" onClick={()=>start(selected,'invite')}>{inviteTitle}</button>}
          </section>}
          {!!(selectedDetails.receipts?.length||selectedDetails.creditIn||selectedDetails.creditOut)&&<section>
            <h3>{t('到账与冲抵记录','Receipts and payment credits','Riwayat penerimaan dan pengalihan dana')}</h3>
            <ul className="crm-enrollment-detail-list">
              {selectedDetails.receipts?.map((entry,index)=><li key={index}>{currency(entry.amount)} · {formatCrmEventTime(entry.settledAt).slice(0,16)}</li>)}
              {!!selectedDetails.creditIn&&<li>{t('转入冲抵','Credit applied to this order','Dana dialihkan masuk')} · {currency(selectedDetails.creditIn)}</li>}
              {!!selectedDetails.creditOut&&<li>{t('转出冲抵','Credit applied to another order','Dana dialihkan keluar')} · {currency(selectedDetails.creditOut)}</li>}
            </ul>
          </section>}
          {(selectedDetails.refundProgress||selectedDetails.canRefund||hasRefund(selected))&&<section>
            <h3 ref={refundHeading} tabIndex={-1}>{t('退款记录','Refund history','Riwayat pengembalian')}</h3>
            {selectedDetails.refundProgress&&<>
              <p>{t('累计已退／应退','Refunded / due','Dikembalikan / seharusnya')} · {currency(selectedDetails.refundProgress.refunded)} / {currency(selectedDetails.refundProgress.expected)}</p>
              {!!selectedDetails.refundPayments?.length&&<ul className="crm-enrollment-detail-list">
                {selectedDetails.refundPayments.map((entry,index)=><li key={index}>
                  {currency(entry.amount)}{entry.returned>0&&' · '+t('银行已退回','Returned by bank','Dikembalikan oleh bank')+' '+currency(entry.returned)}
                </li>)}
              </ul>}
            </>}
            {selectedDetails.canRefund&&<>
              <p>{t('收到学员正式退款申请后可受理。','Accept a refund after receiving the learner’s formal request.','Terima pengembalian setelah siswa mengajukan permintaan resmi.')}</p>
              <button className="crm-work-button" type="button" onClick={()=>start(selected,'refund')}>{refundTitle}</button>
            </>}
          </section>}
          {selectedDetails.canEnd&&<section>
            <h3>{t('报名关闭','Enrollment closure','Penutupan pendaftaran')}</h3>
            <button className="crm-work-button crm-enrollment-close-order" type="button" onClick={()=>start(selected,'end')}>{endTitle}</button>
          </section>}
        </>}
      </div>
    </CrmOperationLayer>}
    {editor&&<CrmOperationLayer compose customerContext={false} title={<>{editor.mode==='invite'?inviteTitle:editor.mode==='end'?endTitle:refundTitle}<AdminRequiredNote inline lang={lang}/></>}
      lang={lang} isLight={isLight} busy={busy} onClose={close}>
      <AdminForm lang={lang} className="crm-editor-compose crm-course-editor" onChange={()=>setDirty(true)} onSubmit={async event=>{
        event.preventDefault();if(busy)return;
        const form=new FormData(event.currentTarget);
        if(editor.mode==='end'&&!String(form.get('reason')??'').trim()){
          setError(t('请填写学员放弃报名的原因。','Enter the reason the learner withdrew.','Isi alasan siswa mengundurkan diri.'));return;
        }
        setBusy(true);setError('');
        try{
          let requestedAt:string|undefined;
          if(editor.mode==='refund'){
            const local=String(form.get('requestedAt')??'');
            const instant=new Date(local);
            try{validateLocalInstant(local,instant,viewerTimeZone());if(instant>new Date())throw Error();}
            catch{
              setError(t('请核对收到退款申请的时间。','Check when the refund request was received.','Periksa waktu pengajuan pengembalian diterima.'));
              return;
            }
            requestedAt=instant.toISOString();
          }
          const result=await enrollmentPost(staff+'/'+editor.order.id+'/'+(editor.mode==='invite'?'invitations':editor.mode),{
            classId:editor.order.classId,requestId:editor.requestId,
            ...(editor.mode==='invite'?{targetClassId:targetId}:editor.mode==='end'?{reason:form.get('reason')}:
              {reason:form.get('reason'),delivered:Number(form.get('delivered')||0),special:form.get('special')==='on',requestedAt}),
          });
          setEditor(undefined);setDirty(false);
          const deadline=formatCrmEventTime(result.replyBy);
          setNotice(editor.mode==='refund'?t('已受理退款，相关席位已释放。','Refund accepted and the seat released.','Pengembalian diterima dan kursi dilepas.'):
            editor.mode==='end'?t('报名已结束，席位已释放。','Enrollment ended and its seat was released.','Pendaftaran berakhir dan kursi dilepas.'):
              deadline?t(`转班邀请已登记，答复截止为 ${deadline}。`,`Transfer invitation recorded. Reply by ${deadline}.`,`Undangan pindah kelas dicatat. Jawab sebelum ${deadline}.`):
                t('转班邀请已登记。','Transfer invitation recorded.','Undangan pindah kelas dicatat.'));
          setSelectedId(undefined);
          setListRevision(version=>version+1);
        }catch{setError(t('未能确认操作，请刷新核对订单。','The action could not be confirmed. Refresh to review the order.','Tindakan belum terkonfirmasi. Muat ulang pesanan.'));}
        finally{setBusy(false);}
      }}><div className="crm-editor-scroll">
        <p>{editor.order.name} · {editor.order.id}</p>
        {error&&<p role="alert">{error}</p>}
        {editor.mode==='invite'?<><AdminField required>{t('目标班次','Target class','Kelas tujuan')}
          <CrmSingleSelect lang={lang} isLight={isLight} required label={t('目标班次','Target class','Kelas tujuan')} value={targetId}
            options={classes.filter(row=>row.id!==editor.order.classId&&row.level===editor.order.level&&row.format===editor.order.format&&row.availability!=='full')
              .map(row=>({value:row.id,label:row.level+' · '+row.firstLesson.replace('T',' ')+' WIB'}))}
            onChange={value=>{setTargetId(value);setDirty(true);}}/></AdminField>
          <p>{t('答复期限按报名规则计算，最晚到目标班次的报名截止时间。','The reply deadline follows the enrollment rules and ends no later than the target class’s enrollment cutoff.','Batas jawaban mengikuti aturan pendaftaran dan paling lambat saat pendaftaran kelas tujuan ditutup.')}</p>
        </>:editor.mode==='end'?<>
          <p>{t('仅在学员明确放弃时操作。确认后关闭付款入口并释放席位，已有实收和凭证会保留。','Use only after the learner has clearly withdrawn. This closes payment and releases the seat while retaining receipts and proof.','Gunakan hanya setelah siswa menyatakan mundur. Pembayaran ditutup dan kursi dilepas. Dana tercatat dan bukti tetap disimpan.')}</p>
          <AdminField required>{t('学员放弃报名的原因','Reason the learner withdrew','Alasan siswa mengundurkan diri')}<textarea name="reason" required maxLength={1000}/></AdminField>
        </>:<>
          <p>{t('正式受理后会结束报名及转班等待，并释放席位。','Accepting this request ends the enrollment and releases any held seat.','Menerima permintaan mengakhiri pendaftaran dan melepaskan kursi.')}</p>
          <AdminField required>{t('学员申请及受理原因','Request and acceptance reason','Alasan permintaan dan penerimaan')}<textarea name="reason" required maxLength={1000}/></AdminField>
          <AdminField required>{t('收到正式申请的时间','Formal request received at','Waktu permintaan resmi diterima')}
            <input name="requestedAt" type="datetime-local" required defaultValue={formatCrmEventTime(new Date().toISOString()).slice(0,16).replace(' ','T')}/>
          </AdminField>
          {editor.order.opened&&<>
            <label className="admin-field admin-field--choice"><input type="checkbox" name="special" required/>{t('确认已核实特殊退款原因','Confirm the verified exception','Konfirmasi pengecualian terverifikasi')}</label>
            <AdminField required>{t('申请前已实际交付课次','Sessions delivered before the request','Pertemuan yang telah diberikan sebelum pengajuan')}<input name="delivered" type="number" min="0" step="1" required/></AdminField>
          </>}
        </>}
      </div><AdminFormActions className="crm-editor-actions"><button type="button" className="crm-work-button" onClick={close}>{t('取消','Cancel','Batal')}</button>
        <button type="submit" className="crm-work-button" data-primary disabled={busy||(editor.mode==='invite'&&!targetId)}>{t('确认保存','Confirm and save','Konfirmasi dan simpan')}</button>
      </AdminFormActions></AdminForm>
    </CrmOperationLayer>}
    {discard&&<CrmDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)} onDiscard={()=>{setEditor(undefined);setDiscard(false);setDirty(false);}}/>}
  </section>;
}

export function CrmEnrollmentRefund({id,lang,isLight,onUpdate,onBusyChange}:{id:string;lang:CrmLanguage;isLight:boolean;onUpdate:()=>void;onBusyChange?:(busy:boolean)=>void}) {
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
  useEffect(()=>{onBusyChange?.(busy);return ()=>onBusyChange?.(false);},[busy,onBusyChange]);
  useEffect(()=>{void load().catch(()=>setError(t('未能加载退款明细。','Refund details could not be loaded.','Rincian belum dapat dimuat.')));},[id]);
  if(!details) return error?<p role="alert">{error}</p>:null;
  const {expected,refunded,requestedAt,sendBy,timezone}=details.progress;
  const original=details.receipts.find(row=>row.reference===source);
  const payment=details.installments.find(entry=>entry.reference===returnEntry?.reference);
  return <section className="crm-course-catalog">
    <p>{t('累计已原路退款','Total refunded to original payment','Total dikembalikan ke pembayaran asal')} {formatCurrency(refunded,lang)} / {formatCurrency(expected,lang)}</p>
    {requestedAt&&<p>{sendBy?t('收到正式申请','Formal request received','Permintaan resmi diterima'):
      t('退款登记时间','Refund recorded at','Waktu pengembalian dicatat')} · <time dateTime={requestedAt}>{formatCrmEventTime(requestedAt)}</time></p>}
    {sendBy&&timezone&&<p>{t('原定发出期限','Original send-by deadline','Tenggat awal pengiriman')} · <time dateTime={sendBy}>{formatCrmOperatingTime(sendBy,timezone)} · {timezone}</time></p>}
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
      {original&&<p>{t('原公司收款账户','Original company receiving account','Rekening penerima perusahaan asal')} · {original.account??t('未记录，请核对原交易','Not recorded. Check the original transaction.','Belum dicatat. Periksa transaksi asal.')}</p>}
      <AdminField required>{t('退款流水号','Refund bank reference','Referensi bank pengembalian')}<input name="reference" required maxLength={120}/></AdminField>
      <AdminField required>{t('本次退款金额（Rp）','Refund amount (Rp)','Jumlah pengembalian (Rp)')}<input name="amount" type="number" min="1" max={Math.min(expected-refunded,details.receipts.find(row=>row.reference===source)?.remaining??expected-refunded)} required/></AdminField>
      <button type="submit" className="crm-work-button" data-primary disabled={busy||!source}>{t('登记分笔退款','Record refund installment','Catat tahap pengembalian')}</button>
    </AdminForm></div>}
  </section>;
}
