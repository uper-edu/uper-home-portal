import {AdminRecordHeader} from '../admin/AdminRecordHeader';
import {AdminListState} from '../admin/AdminList';
import {AdminRecordEntry,AdminRowAction} from '../admin/AdminListControl';
import { useEffect,useState,useRef } from 'react';
import { RefreshCw, Send, Wallet } from 'lucide-react';
import { containPaneKeys, recordSplitMinWidth, revealRecord } from '../adminScroll';
import { enrollmentCopy,enrollmentPost,enrollmentStatuses } from '../EnrollmentApplication';
import { AdminField,AdminForm,AdminRequiredNote } from '../AdminForm';
import {CrmOrderOperationFeedback,useCrmOrderOperation} from './CrmOrderOperation';
import { AdminFormActions,AdminFormFeedback } from '../AdminFormLayout';
import { CrmOperationLayer } from './CrmOperationLayer';
import { CrmDiscardDialog, useCrmShellHeight, useRecordScrollMode } from './CrmDetailWorkspace';
import { CrmPageAction } from './CrmPageAction';
import { CrmDetailActions, CrmRecordFilters, CrmRecordRow, CrmRecordSearch, CrmRecordSidebar, CrmRecordSidebarToggle, CrmRecordTitle } from './CrmRecordWorkspace';
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
  const [selectedOrder,setSelectedOrder]=useState<ServiceOrder>();
  const selectedId=selectedOrder?.id;
  const shellHeight=useCrmShellHeight();
  const independent=useRecordScrollMode(shellHeight)==='independent';
  const [wide,setWide]=useState(()=>typeof window!=='undefined'&&window.innerWidth>=recordSplitMinWidth);
  const [orderListOpen,setOrderListOpen]=useState(false);
  const singleColumnListOpen=!wide&&orderListOpen;
  useEffect(()=>{
    const media=window.matchMedia(`(min-width: ${recordSplitMinWidth}px)`);
    const update=()=>{
      setWide(media.matches);
      if(media.matches)setOrderListOpen(false);
    };
    update();
    media.addEventListener('change',update);
    return ()=>media.removeEventListener('change',update);
  },[]);
  const listPosition=useRef<{top:number;left:number;offset:number;filters:string;trigger:HTMLElement|null}|undefined>(undefined);
  const listTable=useRef<HTMLDivElement>(null),listSearch=useRef<HTMLInputElement>(null);
  const detailBody=useRef<HTMLDivElement>(null);
  const detailPanel=useRef<HTMLDivElement>(null);
  const [details,setDetails]=useState<{id:string;data:ServiceDetails}>();
  const [detailError,setDetailError]=useState('');
  const [listRevision,setListRevision]=useState(0);
  const [detailFocus,setDetailFocus]=useState<'invite'|'refund'>();
  const transferHeading=useRef<HTMLHeadingElement>(null),refundHeading=useRef<HTMLHeadingElement>(null);
  const [classes,setClasses]=useState<PublicEnrollmentClass[]>([]);
  const [editor,setEditor]=useState<{order:ServiceOrder;mode:SupportAction;requestId:string}>();
  const [targetId,setTargetId]=useState('');
  const aftercareOperation=useCrmOrderOperation();
  const [endBusy,setEndBusy]=useState(false);
  const busy=aftercareOperation.busy||endBusy;
  const [dirty,setDirty]=useState(false);
  const [discard,setDiscard]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const filtersKey=JSON.stringify([query.trim(),classFilter,progressFilter,quickFilter]);
  const [loadedOffset,setLoadedOffset]=useState(0);
  const load=async(signal?:AbortSignal)=>{
    const params=new URLSearchParams({scope:'records',aftercare:quickFilter,q:search,classId:classFilter,progress:progressFilter,offset:String(offset)});
    const response=await fetch(staff+'?'+params,{cache:'no-store',signal});
    if(!response.ok){
      if(!signal?.aborted&&[401,403].includes(response.status)){setOrders(undefined);setClasses([]);setSelectedOrder(undefined);setCanReviewRefunds(false);}
      throw response.status;
    }
    const data=await response.json();
    if(signal?.aborted)return;
    const nextOrders:ServiceOrder[]=data.orders;
    setSelectedOrder(current=>current?nextOrders.find(row=>row.id===current.id)??current:undefined);
    setLoadedOffset(offset);setOrders(nextOrders);setTotal(data.total);setPageSize(data.pageSize);setCanReviewRefunds(data.canReviewRefunds);
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
    }).catch(cause=>{
      if(controller.signal.aborted)return;
      if([401,403,404].includes(cause)){
        setSelectedOrder(current=>current?.id===selectedId?undefined:current);
        setDetails(undefined);
        setError(t('这笔订单已无法查看。','This order is no longer available.','Pesanan ini tidak lagi tersedia.'));
        return;
      }
      setDetailError(t('无法读取报名详情。','Enrollment details could not be read.','Detail pendaftaran belum dapat dimuat.'));
    });
    return ()=>controller.abort();
  },[selectedId,listRevision,refreshVersion]);
  const openDetail=(order:ServiceOrder,focus?:'invite'|'refund')=>{
    if(!selectedId){
      listPosition.current={top:window.scrollY,left:listTable.current?.scrollLeft??0,offset,filters:filtersKey,
        trigger:document.activeElement instanceof HTMLElement?document.activeElement:null};
    }
    setOrderListOpen(false);
    if(detailBody.current)detailBody.current.scrollTop=0;
    setDetailFocus(focus);setSelectedOrder(order);
    if(!selectedId) window.scrollTo({top:0,behavior:'instant'});
  };
  const chooseOrder=(order:ServiceOrder)=>{
    openDetail(order);
    if(!wide){
      requestAnimationFrame(()=>detailPanel.current?.querySelector<HTMLElement>('h1')?.focus({preventScroll:true}));
    }
  };
  const closeDetail=()=>{
    setOrderListOpen(false);
    const position=listPosition.current;
    if(position?.filters===filtersKey)setOffset(position.offset);
    setSelectedOrder(undefined);
  };
  useEffect(()=>{
    if(selectedId||!listPosition.current)return;
    const position=listPosition.current;
    const sameFilters=position.filters===filtersKey;
    if(sameFilters&&(offset!==position.offset||loadedOffset!==offset)&&!error)return;
    const frame=requestAnimationFrame(()=>{
      if(listTable.current)listTable.current.scrollLeft=sameFilters?position.left:0;
      const trigger=position.trigger;
      const opener=trigger?.isConnected?trigger:trigger?.id?document.getElementById(trigger.id):null;
      (sameFilters&&opener?opener:listSearch.current)?.focus({preventScroll:true});
      window.scrollTo({top:sameFilters?position.top:0,behavior:'instant'});
      listPosition.current=undefined;
    });
    return ()=>cancelAnimationFrame(frame);
  },[selectedId,offset,loadedOffset,filtersKey,error]);
  useEffect(()=>{
    if(editor||details?.id!==selectedId||!detailFocus)return;
    const target=detailFocus==='invite'?transferHeading.current:refundHeading.current;
    if(target){
      if(independent&&detailBody.current)revealRecord(detailBody.current,target);
      else target.scrollIntoView({block:'nearest'});
      target.focus({preventScroll:true});
    }
    setDetailFocus(undefined);
  },[details,selectedId,detailFocus,editor,independent]);
  const start=(order:ServiceOrder,mode:SupportAction)=>{
    aftercareOperation.clear();setEditor({order,mode,requestId:crypto.randomUUID()});setTargetId('');setDirty(false);setError('');setNotice('');
  };
  const close=()=>{if(!busy){if(dirty)setDiscard(true);else setEditor(undefined);}};
  const endTitle=t('确认学员放弃报名','Confirm learner withdrawal','Konfirmasi siswa mengundurkan diri');
  const refundTitle=t('受理退款','Accept refund request','Terima permintaan pengembalian');
  const inviteTitle=t('发转班邀请','Send transfer invitation','Kirim undangan pindah kelas');
  const finishAftercare=(mode:SupportAction,replyBy?:string)=>{
    setEditor(undefined);setDirty(false);
    const deadline=formatCrmEventTime(replyBy);
    setNotice(mode==='refund'?t('已受理退款，相关席位已释放。','Refund accepted and the seat released.','Pengembalian diterima dan kursi dilepas.'):
      mode==='end'?t('报名已结束，席位已释放。','Enrollment ended and its seat was released.','Pendaftaran berakhir dan kursi dilepas.'):
        deadline?t(`转班邀请已登记，答复截止为 ${deadline}。`,`Transfer invitation recorded. Reply by ${deadline}.`,`Undangan pindah kelas dicatat. Jawab sebelum ${deadline}.`):
          t('转班邀请已登记。','Transfer invitation recorded.','Undangan pindah kelas dicatat.'));
    closeDetail();setListRevision(version=>version+1);
  };
  const aftercareOutcome=async(result:ReturnType<typeof aftercareOperation.submit>)=>{
    const outcome=await result;
    if(!editor||!outcome)return;
    if(outcome.state==='saved'){finishAftercare(editor.mode,outcome.replyBy);return;}
    setEditor({...editor,requestId:crypto.randomUUID()});
    setError(outcome.code==='enrollment_active_invitation'
      ? t('订单已有有效邀请，请核对当前转班进度。','There is already an active invitation. Review the transfer status.','Sudah ada undangan aktif. Periksa status pindah kelas.')
      : t('操作被拒绝，请核对订单状态和填写内容。','Action rejected. Review the order and your input.','Tindakan ditolak. Periksa pesanan dan isian.'));
  };
  const selected=selectedOrder;
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
  const orderNumberLabel=t('订单编号','Order number','Nomor pesanan');
  const orderShort=(row:ServiceOrder)=>orders?.some(item=>item.id!==row.id&&item.id.slice(0,8)===row.id.slice(0,8))?row.id:row.id.slice(0,8);
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
  const orderFilters=(sidebar:boolean)=><>
        <CrmSingleSelect lang={lang} isLight={isLight} label={t('班次','Class','Kelas')} value={classFilter}
          onChange={value=>{setClassFilter(value);setOffset(0);}}
          options={[{value:'',label:t('全部班次','All classes','Semua kelas')},...classOptions.map(row=>({
            value:row.id,label:[row.level,interestOption(lang,row.period),interestOption(lang,row.format),formatCrmEventTime(row.firstLessonAt).slice(0,16)].filter(Boolean).join(' · '),
          }))]}/>
        <CrmSingleSelect lang={lang} isLight={isLight} label={t('报名状态','Enrollment status','Status pendaftaran')} value={progressFilter}
          onChange={value=>{setProgressFilter(value);setOffset(0);}} options={recordStatusOptions}/>
        {sidebar&&<CrmSingleSelect lang={lang} isLight={isLight} label={progressLabel} value={quickFilter}
          options={quickOptions} onChange={value=>{setQuickFilter(value as SupportFilter);setOffset(0);}}/>}
        {(query||classFilter||progressFilter||quickFilter)&&<button type="button" className="crm-work-link" onClick={()=>{setQuery('');setSearch('');setClassFilter('');setProgressFilter('');setQuickFilter('');setOffset(0);}}>
          {t('清除筛选','Clear filters','Hapus filter')}</button>}
  </>;
  const backToOrders={label:t('返回售后服务','Back to after-sales support','Kembali ke layanan purnajual'),onClick:closeDetail};
  return <section className="crm-aftercare-workspace">
    <div className="crm-aftercare-list" hidden={Boolean(selectedId)}>
      {!embedded&&<header className="admin-page-toolbar"><h1>{t('售后服务','After-sales support','Layanan purnajual')}</h1></header>}
    <div className="crm-aftercare-controls">
      <CrmListViews label={t('售后快捷筛选','After-sales quick filters','Filter cepat layanan')}>
        {quickOptions.map(({value,label})=><button type="button" className="crm-work-button" key={value}
          aria-pressed={quickFilter===value} onClick={()=>{setQuickFilter(value);setOffset(0);}}>{label}</button>)}
      </CrmListViews>
      <CrmListFilters label={t('筛选售后订单','Filter after-sales orders','Filter pesanan purnajual')}>
        <CrmListSearch label={t('搜索报名记录','Search enrollments','Cari pendaftaran')}
          inputRef={listSearch} placeholder={t('学员姓名、报名编号或班次','Name, order number or class','Nama siswa, nomor pesanan, atau kelas')}
          value={query} onChange={setQuery}/>
        {orderFilters(false)}
      </CrmListFilters>
    </div>
    {!orders&&!error&&<p className="crm-enrollment-empty" role="status">{t('正在加载…','Loading…','Memuat…')}</p>}
    {orders?.length===0&&!isSearching&&<p className="crm-enrollment-empty">{t('没有符合条件的报名订单。','No enrollment orders match.','Tidak ada pesanan yang cocok.')}</p>}
    {!editor&&error&&<p className="crm-enrollment-empty" role="alert">{error}</p>}
    {orders&&<p className="crm-list-meta" role="status">{t(`匹配 ${total} 笔订单`,`${total} matching orders`,`${total} pesanan cocok`)}</p>}
    {!!orders?.length&&<CrmListTable label={t('售后服务订单','After-sales orders','Pesanan purnajual')}
      busy={isSearching} viewportRef={listTable} headers={[t('学员与订单','Learner and order','Siswa dan pesanan'),t('当前班次','Current class','Kelas saat ini'),
        t('报名状态','Enrollment status','Status pendaftaran'),progressLabel,
        {label:t('已核实实收','Verified receipts','Dana terverifikasi'),numeric:true},t('下一步','Next step','Langkah berikutnya')]}>
      {orders.map(row=><tr key={row.id}>
        <td><AdminRecordEntry id={'aftercare-order-'+row.id} onClick={()=>openDetail(row)}
          aria-label={t('查看报名订单','View enrollment order','Lihat pesanan pendaftaran')+' · '+row.name+' · '+orderShort(row)}>{row.name}</AdminRecordEntry>
          <small title={row.id}>{t('订单','Order','Pesanan')} · {orderShort(row)}</small></td>
        <td className="crm-enrollment-class-cell"><strong>{className(row)}</strong><small>{formatCrmEventTime(row.firstLessonAt).slice(0,16)}</small></td>
        <td>{status(row)}</td><td>{aftercareStatus(row)}</td>
        <td className="crm-list-number">{currency(row.received)}</td>
        <td>{inviteReady(row)
          ?<AdminRowAction disabled={isSearching} onClick={()=>start(row,'invite')}>{inviteTitle}</AdminRowAction>
          :hasRefund(row)||row.replyBy||row.transferred
            ?<AdminRowAction id={'aftercare-progress-'+row.id} onClick={()=>openDetail(row,hasRefund(row)?'refund':'invite')}>
              {hasRefund(row)?t('查看退款进度','View refund progress','Lihat kemajuan pengembalian'):
                row.replyBy?t('查看邀请','View invitation','Lihat undangan'):t('查看转班记录','View transfer history','Lihat riwayat pindah kelas')}
            </AdminRowAction>:<span className="crm-work-muted">—</span>}</td>
      </tr>)}
    </CrmListTable>}
    {!!orders?.length&&total>pageSize&&<div className="crm-finance-pagination crm-aftercare-pagination">
      <span className="crm-work-muted" aria-live="polite">{`${offset+1}–${offset+orders.length} / ${total}`}</span>
      <div>
        <button type="button" className="crm-work-button" disabled={isSearching||offset===0} onClick={()=>setOffset(offset-pageSize)}>{t('上一页','Previous','Sebelumnya')}</button>
        <button type="button" className="crm-work-button" disabled={isSearching||offset+pageSize>=total} onClick={()=>setOffset(offset+pageSize)}>{t('下一页','Next','Berikutnya')}</button>
      </div>
    </div>}
    </div>
    {notice&&<span className="crm-opportunity-feedback" role="status">{notice}</span>}
    {selectedId&&<div className="crm-aftercare-detail-shell crm-detail-root" data-theme={isLight?'light':'dark'}
      data-record-detail="true" data-record-scroll={independent?'independent':'page'} data-sidebar={wide}
      style={{'--crm-shell-height':shellHeight+'px'} as React.CSSProperties}>
      {singleColumnListOpen&&<div className="crm-record-navigation"><CrmRecordSidebarToggle
        controls="crm-aftercare-records" expanded label={t('返回订单详情','Back to order details','Kembali ke detail pesanan')}
        onClick={()=>{setOrderListOpen(false);requestAnimationFrame(()=>detailPanel.current?.querySelector<HTMLElement>('.crm-record-sidebar-toggle')?.focus());}}/></div>}
      <CrmRecordSidebar id="crm-aftercare-records" title={t('售后订单','After-sales orders','Pesanan purnajual')}
        count={orders?total:undefined} hidden={!wide&&!singleColumnListOpen} selectedId={selectedId}
        filters={<CrmRecordFilters lang={lang} count={[classFilter,progressFilter,quickFilter].filter(Boolean).length}
          search={<CrmRecordSearch label={t('搜索售后订单','Search after-sales orders','Cari pesanan purnajual')}
            placeholder={t('学员、订单号或班次','Learner, order number or class','Siswa, nomor pesanan atau kelas')}
            value={query} onChange={setQuery} maxLength={120}/>}>{orderFilters(true)}</CrmRecordFilters>}
        note={error&&orders?.length?error:!isSearching&&!error&&orders&&!orders.some(row=>row.id===selectedId)
          ?t('当前订单不在侧栏显示的结果中。','The current order is outside the results shown.','Pesanan saat ini tidak muncul pada hasil yang ditampilkan.'):undefined}
        footer={total>pageSize&&<div className="crm-aftercare-sidebar-pages">
          <span>{offset+1}–{offset+(orders?.length??0)} / {total}</span>
          <button type="button" className="crm-work-button" disabled={isSearching||offset===0} onClick={()=>setOffset(offset-pageSize)}>{t('上一页','Previous','Sebelumnya')}</button>
          <button type="button" className="crm-work-button" disabled={isSearching||offset+pageSize>=total} onClick={()=>setOffset(offset+pageSize)}>{t('下一页','Next','Berikutnya')}</button>
        </div>}
        busy={isSearching} busyLabel={t('更新中…','Updating…','Memperbarui…')}
        empty={!orders?.length?<p className="crm-record-sidebar-message">
          {error||(isSearching?t('正在加载…','Loading…','Memuat…'):t('没有符合条件的报名订单。','No enrollment orders match.','Tidak ada pesanan yang cocok.'))}</p>:undefined}>
        {orders?.map(row=><CrmRecordRow key={row.id} selected={row.id===selectedId} name={row.name}
          title={row.name+' · '+className(row)+' · '+orderNumberLabel+' '+orderShort(row)}
          onClick={()=>{if(row.id!==selectedId||singleColumnListOpen)chooseOrder(row);}}
          meta={<>{status(row)}<small>{className(row)}</small><small className="crm-aftercare-side-reference">{orderNumberLabel} {orderShort(row)}</small></>}/>)}
      </CrmRecordSidebar>
      <div className="crm-detail-panel crm-aftercare-detail-panel" ref={detailPanel} hidden={singleColumnListOpen}>
        <AdminRecordHeader back={backToOrders} title={<CrmRecordTitle title={selected?.name||t('报名订单详情','Enrollment order details','Detail pesanan pendaftaran')}
            status={selected&&status(selected)} meta={selected&&orderNumberLabel+' '+selected.id}/>} actions={<CrmDetailActions label={t('售后订单操作','After-sales actions','Tindakan purnajual')}
            secondary={<>
              {!wide&&<CrmRecordSidebarToggle controls="crm-aftercare-records" expanded={false}
                label={t('查看售后订单','View after-sales orders','Lihat pesanan purnajual')}
                onClick={()=>{setOrderListOpen(true);requestAnimationFrame(()=>document.querySelector<HTMLElement>('#crm-aftercare-records input[type=search]')?.focus({preventScroll:true}));}}/>}
              <CrmPageAction icon={RefreshCw} label={t('刷新','Refresh','Segarkan')} loading={isSearching}
                onClick={()=>setListRevision(version=>version+1)}/>
              {selected&&selectedDetails?.canRefund&&<CrmPageAction icon={Wallet} label={refundTitle}
                disabled={isSearching} onClick={()=>start(selected,'refund')}/>}
            </>}
            primary={selected&&selectedDetails&&inviteReady(selected)&&<CrmPageAction icon={Send} variant="primary"
              label={inviteTitle} disabled={isSearching} onClick={()=>start(selected,'invite')}/>}/>}/>
        {selected&&<div className="crm-panel-next">
          <dl className="crm-opportunity-summary crm-aftercare-summary">
            <div><dt>{t('当前班次','Current class','Kelas saat ini')}</dt><dd><a className="crm-work-link" href={enrollmentClassManagementPath(selected.classId)}>{className(selected)}</a>
              <small>{classSchedule(selected)}</small></dd></div>
            {originalClassId&&<div><dt>{t('原班','Original class','Kelas asal')}</dt><dd>{knownClass(originalClassId)}</dd></div>}
            <div><dt>{t('已核实实收','Verified receipts','Dana terverifikasi')}</dt><dd>{currency(selected.received)}</dd></div>
          </dl>
        </div>}
        <div className="crm-detail-body crm-enrollment-order-detail" ref={detailBody} tabIndex={0}
          data-admin-scroll="detail" onKeyDown={containPaneKeys}>
          {!selected?<p role="status">{t('这笔订单已不在当前列表中。','This order is no longer in the current list.','Pesanan ini sudah tidak ada di daftar saat ini.')}</p>:<>
        {!editor&&error&&<p role="alert">{error}</p>}
        {detailError?<p role="alert">{detailError}</p>:!selectedDetails?<p role="status">{t('正在加载售后明细…','Loading after-sales details…','Memuat detail layanan…')}</p>:<>
          {(selectedDetails.invitations.length>0||selectedDetails.transferHistory.length>0)&&<section>
            <h2 ref={transferHeading} tabIndex={-1}>{t('转班记录','Transfer history','Riwayat pindah kelas')}</h2>
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
          </section>}
          {!!(selectedDetails.receipts?.length||selectedDetails.creditIn||selectedDetails.creditOut)&&<section>
            <h2>{t('到账与冲抵记录','Receipts and payment credits','Riwayat penerimaan dan pengalihan dana')}</h2>
            <ul className="crm-enrollment-detail-list">
              {selectedDetails.receipts?.map((entry,index)=><li key={index}>{currency(entry.amount)} · {formatCrmEventTime(entry.settledAt).slice(0,16)}</li>)}
              {!!selectedDetails.creditIn&&<li>{t('转入冲抵','Credit applied to this order','Dana dialihkan masuk')} · {currency(selectedDetails.creditIn)}</li>}
              {!!selectedDetails.creditOut&&<li>{t('转出冲抵','Credit applied to another order','Dana dialihkan keluar')} · {currency(selectedDetails.creditOut)}</li>}
            </ul>
          </section>}
          {(selectedDetails.refundProgress||hasRefund(selected))&&<section>
            <h2 ref={refundHeading} tabIndex={-1}>{t('退款记录','Refund history','Riwayat pengembalian')}</h2>
            {selectedDetails.refundProgress&&<>
              <p>{t('累计已退／应退','Refunded / due','Dikembalikan / seharusnya')} · {currency(selectedDetails.refundProgress.refunded)} / {currency(selectedDetails.refundProgress.expected)}</p>
              {!!selectedDetails.refundPayments?.length&&<ul className="crm-enrollment-detail-list">
                {selectedDetails.refundPayments.map((entry,index)=><li key={index}>
                  {currency(entry.amount)}{entry.returned>0&&' · '+t('银行已退回','Returned by bank','Dikembalikan oleh bank')+' '+currency(entry.returned)}
                </li>)}
              </ul>}
            </>}
          </section>}
          {selectedDetails.canEnd&&<section>
            <h2>{t('报名关闭','Enrollment closure','Penutupan pendaftaran')}</h2>
            <button className="crm-work-button crm-enrollment-close-order" type="button" disabled={isSearching} onClick={()=>start(selected,'end')}>{endTitle}</button>
          </section>}
          {!selectedDetails.invitations.length&&!selectedDetails.transferHistory.length&&!selectedDetails.receipts?.length&&
            !selectedDetails.creditIn&&!selectedDetails.creditOut&&!selectedDetails.refundProgress&&!hasRefund(selected)&&!selectedDetails.canEnd&&
            <p className="crm-work-muted">{t('暂无售后处理记录。','There is no after-sales activity yet.','Belum ada aktivitas purnajual.')}</p>}
        </>}
          </>}
        </div>
      </div>
    </div>}
    {editor&&<CrmOperationLayer compose customerContext={false} title={<>{editor.mode==='invite'?inviteTitle:editor.mode==='end'?endTitle:refundTitle}<AdminRequiredNote inline lang={lang}/></>}
      lang={lang} isLight={isLight} busy={busy} onClose={close}>
      <AdminForm lang={lang} className="crm-editor-compose crm-course-editor" onChange={()=>setDirty(true)} onSubmit={async event=>{
        event.preventDefault();if(busy||aftercareOperation.pending)return;
        const form=new FormData(event.currentTarget);
        if(editor.mode==='end'){
          if(!String(form.get('reason')??'').trim()){
            setError(t('请填写学员放弃报名的原因。','Enter the reason the learner withdrew.','Isi alasan siswa mengundurkan diri.'));return;
          }
          setEndBusy(true);setError('');
          try{
            await enrollmentPost(staff+'/'+editor.order.id+'/end',{classId:editor.order.classId,requestId:editor.requestId,reason:form.get('reason')});
            finishAftercare('end');
          }catch{setError(t('未能确认操作，请刷新核对订单。','The action could not be confirmed. Refresh to review the order.','Tindakan belum terkonfirmasi. Muat ulang pesanan.'));}
          finally{setEndBusy(false);}
          return;
        }
        const original={classId:editor.order.classId,requestId:editor.requestId};
        setError('');
        if(editor.mode==='invite'){
          await aftercareOutcome(aftercareOperation.submit('invitations',editor.order.id,{...original,targetClassId:targetId}));
          return;
        }
        const local=String(form.get('requestedAt')??'');
        const instant=new Date(local);
        try{validateLocalInstant(local,instant,viewerTimeZone());if(instant>new Date())throw Error();}
        catch{
          setError(t('请核对收到退款申请的时间。','Check when the refund request was received.','Periksa waktu pengajuan pengembalian diterima.'));return;
        }
        await aftercareOutcome(aftercareOperation.submit('refund',editor.order.id,{...original,reason:form.get('reason'),
          delivered:Number(form.get('delivered')||0),special:form.get('special')==='on',requestedAt:instant.toISOString()}));
      }}><div className="crm-editor-scroll">
        <p>{editor.order.name} · {editor.order.id}</p>
        {error&&<AdminFormFeedback lang={lang} state="error">{error}</AdminFormFeedback>}
        <CrmOrderOperationFeedback command={aftercareOperation} lang={lang}
          onCheck={()=>void aftercareOutcome(aftercareOperation.check())} onRetry={()=>void aftercareOutcome(aftercareOperation.retry())}/>
        <fieldset data-admin-stack="" style={{border:0,padding:0,margin:0,minWidth:0}} disabled={busy||!!aftercareOperation.pending}>
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
        </fieldset>
      </div><AdminFormActions className="crm-editor-actions"><button type="button" className="crm-work-button" onClick={close}>{t('取消','Cancel','Batal')}</button>
        <button type="submit" className="crm-work-button" data-primary disabled={busy||!!aftercareOperation.pending||(editor.mode==='invite'&&!targetId)}>{t('确认保存','Confirm and save','Konfirmasi dan simpan')}</button>
      </AdminFormActions></AdminForm>
    </CrmOperationLayer>}
    {discard&&<CrmDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)} onDiscard={()=>{aftercareOperation.clear();setEditor(undefined);setDiscard(false);setDirty(false);}}/>}
  </section>;
}

export function CrmEnrollmentRefund({id,lang,isLight,onUpdate,onBusyChange}:{id:string;lang:CrmLanguage;isLight:boolean;onUpdate:()=>void;onBusyChange?:(busy:boolean)=>void}) {
  const t=(zh:string,en:string,id:string)=>enrollmentCopy(lang,[zh,en,id]);
  const [details,setDetails]=useState<RefundDetails>();
  const [source,setSource]=useState('');
  const [error,setError]=useState('');
  const refundOperation=useCrmOrderOperation();
  const busy=refundOperation.busy;
  const refundForm=useRef<HTMLFormElement>(null);
  const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
  const [returnEntry,setReturnEntry]=useState<{reference:string;requestId:string}>();
  const base=finance+'/'+id;
  const [readState,setReadState]=useState<'loading'|'ready'|'error'|'denied'|'empty'>('loading');
  const load=async(signal?:AbortSignal)=>{
    setReadState('loading');
    try{
      const response=await fetch(base+'/refund-details',{cache:'no-store',signal});
      if(signal?.aborted)return;
      if(response.status===401||response.status===403){setDetails(undefined);setReadState('denied');return;}
      if(response.status===404){setDetails(undefined);setReadState('empty');return;}
      if(!response.ok)throw Error();
      const data=await response.json();
      if(!signal?.aborted){setDetails(data);setReadState('ready');}
    }catch{
      if(!signal?.aborted)setReadState('error');
    }
  };
  const refundOutcome=async(result:ReturnType<typeof refundOperation.submit>,bankReturn:boolean)=>{
    const outcome=await result;
    if(!outcome)return;
    if(outcome.state==='saved'){
      if(bankReturn)setReturnEntry(undefined);
      else {refundForm.current?.reset();setSource('');setRequestId(crypto.randomUUID());}
      await load();onUpdate();
      return;
    }
    if(bankReturn)setReturnEntry(entry=>entry&&{...entry,requestId:crypto.randomUUID()});
    else setRequestId(crypto.randomUUID());
    setError(outcome.code==='enrollment_duplicate_refund_return'
      ? t('这笔银行退回已登记。','This bank return has already been recorded.','Pengembalian oleh bank ini sudah dicatat.')
      : outcome.code==='enrollment_refund_return_amount_exceeds'
        ? t('退回金额超过这笔退款流水尚可登记的金额。','This return exceeds the remaining amount of the refund payment.','Jumlah melebihi sisa pembayaran pengembalian.')
        : outcome.code==='enrollment_refund_amount_exceeds'
          ? t('金额超过该笔原流水或退款单的可退余额。','The amount exceeds the refundable balance.','Jumlah melebihi saldo pengembalian.')
          : t('登记被拒绝，请核对退款单和流水。','Entry rejected. Review the refund and bank reference.','Entri ditolak. Periksa pengembalian dan referensi bank.'));
  };
  useEffect(()=>{onBusyChange?.(busy);return ()=>onBusyChange?.(false);},[busy,onBusyChange]);
  useEffect(()=>{const request=new AbortController();void load(request.signal);return ()=>request.abort();},[id]);
  if(readState!=='ready'||!details)return <AdminListState lang={lang} compact state={readState==='ready'?'empty':readState}
    message={readState==='error'?t('未能加载退款明细。','Refund details could not be loaded.','Rincian belum dapat dimuat.'):undefined}
    onRetry={()=>void load()}/>;
  const {expected,refunded,requestedAt,sendBy,timezone}=details.progress;
  const original=details.receipts.find(row=>row.reference===source);
  const payment=details.installments.find(entry=>entry.reference===returnEntry?.reference);
  return <section className="crm-course-catalog">
    <CrmOrderOperationFeedback command={refundOperation} lang={lang}
      onCheck={()=>void refundOutcome(refundOperation.check(),!!returnEntry)}
      onRetry={()=>void refundOutcome(refundOperation.retry(),!!returnEntry)}/>
    <p>{t('累计已原路退款','Total refunded to original payment','Total dikembalikan ke pembayaran asal')} {formatCurrency(refunded,lang)} / {formatCurrency(expected,lang)}</p>
    {requestedAt&&<p>{sendBy?t('收到正式申请','Formal request received','Permintaan resmi diterima'):
      t('退款登记时间','Refund recorded at','Waktu pengembalian dicatat')} · <time dateTime={requestedAt}>{formatCrmEventTime(requestedAt)}</time></p>}
    {sendBy&&timezone&&<p>{t('原定发出期限','Original send-by deadline','Tenggat awal pengiriman')} · <time dateTime={sendBy}>{formatCrmOperatingTime(sendBy,timezone)} · {timezone}</time></p>}
    {!!details.installments.length&&<ul aria-label={t('已登记退款流水','Recorded refunds','Riwayat pengembalian tercatat')}>
      {details.installments.map(entry=><li key={entry.reference}>
        {formatCurrency(entry.amount,lang)} · {entry.reference} · {t('原收款','Original receipt','Penerimaan asal')} {entry.receiptReference}
        {entry.returned>0&&<> · {t('银行已退回','Returned by bank','Dikembalikan oleh bank')} {formatCurrency(entry.returned,lang)}</>}
        {!returnEntry&&entry.amount>entry.returned&&<button type="button" className="crm-work-button" disabled={busy||!!refundOperation.pending} onClick={()=>{
          setError('');setReturnEntry({reference:entry.reference,requestId:crypto.randomUUID()});
        }}>{t('登记银行退回','Record bank return','Catat pengembalian oleh bank')}</button>}
      </li>)}
    </ul>}
    {error&&<AdminFormFeedback lang={lang} state="error">{error}</AdminFormFeedback>}
    {returnEntry&&payment&&<AdminForm lang={lang} className="crm-form-layout" onSubmit={async event=>{
      event.preventDefault();if(busy||refundOperation.pending)return;
      const input=new FormData(event.currentTarget);
      setError('');
      await refundOutcome(refundOperation.submit('refund-returns',id,{
        refundReference:payment.reference,reference:input.get('reference'),amount:Number(input.get('amount')),requestId:returnEntry.requestId,
      }),true);
    }}>
      <p>{t('退款流水','Refund payment','Pembayaran pengembalian')} · {payment.reference} · {formatCurrency(payment.amount-payment.returned,lang)}</p>
      <AdminRequiredNote lang={lang}/>
      <fieldset className="crm-form-layout" style={{border:0,padding:0,margin:0,minWidth:0}} disabled={busy||!!refundOperation.pending}>
      <AdminField required>{t('银行退回参考号','Bank return reference','Referensi pengembalian oleh bank')}<input name="reference" required maxLength={120}/></AdminField>
      <AdminField required>{t('银行退回金额（Rp）','Bank return amount (Rp)','Jumlah dikembalikan oleh bank (Rp)')}
        <input name="amount" type="number" min="1" max={payment.amount-payment.returned} step="1" required/>
      </AdminField>
      </fieldset>
      <AdminFormActions>
        <button type="button" className="crm-work-button" disabled={busy||!!refundOperation.pending} onClick={()=>{setReturnEntry(undefined);setError('');}}>{t('取消','Cancel','Batal')}</button>
        <button type="submit" className="crm-work-button" data-primary disabled={busy||!!refundOperation.pending}>{t('确认登记退回','Confirm bank return','Konfirmasi pengembalian oleh bank')}</button>
      </AdminFormActions>
    </AdminForm>}
    {refunded<expected&&<div hidden={!!returnEntry}><AdminForm ref={refundForm} lang={lang} className="crm-form-layout" onSubmit={async event=>{
      event.preventDefault();if(!source||busy||refundOperation.pending)return;
      const input=new FormData(event.currentTarget);
      setError('');
      await refundOutcome(refundOperation.submit('refunds',id,{
        receiptReference:source,reference:input.get('reference'),amount:Number(input.get('amount')),requestId,
      }),false);
    }}>
      <fieldset className="crm-form-layout" style={{border:0,padding:0,margin:0,minWidth:0}} disabled={busy||!!refundOperation.pending}>
      <AdminField required>{t('原收款流水','Original receipt','Referensi penerimaan asal')}
        <CrmSingleSelect label={t('原收款流水','Original receipt','Referensi penerimaan asal')} value={source}
          lang={lang} isLight={isLight} required options={details.receipts.filter(row=>row.remaining>0)
            .map(row=>({value:row.reference,label:row.reference+' · '+formatCurrency(row.remaining,lang)}))} onChange={setSource}/>
      </AdminField>
      {original&&<p>{t('原公司收款账户','Original company receiving account','Rekening penerima perusahaan asal')} · {original.account??t('未记录，请核对原交易','Not recorded. Check the original transaction.','Belum dicatat. Periksa transaksi asal.')}</p>}
      <AdminField required>{t('退款流水号','Refund bank reference','Referensi bank pengembalian')}<input name="reference" required maxLength={120}/></AdminField>
      <AdminField required>{t('本次退款金额（Rp）','Refund amount (Rp)','Jumlah pengembalian (Rp)')}<input name="amount" type="number" min="1" max={Math.min(expected-refunded,details.receipts.find(row=>row.reference===source)?.remaining??expected-refunded)} required/></AdminField>
      </fieldset>
      <button type="submit" className="crm-work-button" data-primary disabled={busy||!source||!!refundOperation.pending}>{t('登记分笔退款','Record refund installment','Catat tahap pengembalian')}</button>
    </AdminForm></div>}
  </section>;
}
