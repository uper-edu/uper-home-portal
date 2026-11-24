import {enrollmentClassTitle,enrollmentCopy} from '../../utils/enrollmentCatalog';
import {AdminRefreshAction} from '../admin/AdminRefreshAction';
import {AdminListTable,AdminListState,AdminListPagination} from '../admin/AdminList';
import {AdminRecordHeader} from '../admin/AdminRecordHeader';
import {useAdminRecordSidebarLayout} from '../admin/AdminRecordWorkspace';
import {AdminRecordEntry,AdminRowAction} from '../admin/AdminListControl';
import { AdminContentNav } from '../admin/AdminContentNav';
import {AdminSearchField} from '../admin/AdminSearchField';
import type { EnrollmentClosureReason } from '../../utils/enrollmentOrderStatus';
import { useEffect, useRef, useState } from 'react';
import {Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { containPaneKeys, revealRecord } from '../adminScroll';
import { interestOption } from '../../utils/enrollmentInterestCopy';
import { formatCrmEventTime } from '../../utils/crmOperatingTime';
import { formatCurrency } from '../../utils/currency';
import type { CrmLanguage } from '../../utils/crmLanguage';
import type { AccessEmployee } from '../../utils/accessControl';
import { canViewEnrollmentManagement, enrollmentManagementScopes, enrollmentClassManagementPath, enrollmentRosterStates,
  enrollmentClassPageSize, enrollmentClassShortfall, filterEnrollmentClasses, readEnrollmentClassFilters, writeEnrollmentClassFilters,
  type EnrollmentClassFilters,
  type EnrollmentClassSummary, type EnrollmentRosterEntry, type EnrollmentRosterState } from '../../utils/crmEnrollmentManagement';
import { CrmEnrollmentSupport } from './CrmEnrollmentResolution';
import { AdminSingleSelect } from '../admin/AdminSingleSelect';
import { AdminPageHeader } from '../admin/AdminPageHeader';
import { AdminPageAction } from '../admin/AdminPageAction';
import { enrollmentSettingsPath } from './operationsSections';
import { CrmDetailActions, CrmRecordFilters, CrmRecordRow, CrmRecordSearch,
  CrmRecordSidebar, CrmRecordTitle } from './CrmRecordWorkspace';
import { useCrmShellHeight, useRecordScrollMode } from './CrmDetailWorkspace';
import './crm-enrollment-management.css';

type Copy=readonly [string,string,string];
type Result={classes:EnrollmentClassSummary[]}|{cohort:EnrollmentClassSummary;rows:EnrollmentRosterEntry[]};
const list='/crm?tab=enrollment-management';
const aftercarePath='/crm?tab=enrollment-aftercare';
const groups:Record<EnrollmentRosterState,Copy>={
  awaiting_payment:['待付款','Awaiting payment','Menunggu pembayaran'],
  proof_review:['凭证待核实','Proof awaiting review','Bukti menunggu verifikasi'],
  partial:['部分到账','Partially paid','Dibayar sebagian'],
  paid:['足额到账','Fully paid','Lunas'],
  held:['转班留位','Transfer hold','Kursi pindah kelas'],
  waiting:['候补中','On waitlist','Dalam daftar tunggu'],
  history:['已关闭','Closed','Ditutup'],
};
const closeReasons:Record<EnrollmentClosureReason,Copy>={
  learner_cancelled:['学员主动取消','Canceled by learner','Dibatalkan oleh siswa'],
  payment_timeout:['付款超时','Payment deadline passed','Tenggat pembayaran terlewati'],
  staff_ended:['员工手工结束','Closed by staff','Ditutup oleh staf'],
};
const actual:Record<string,Copy>={
  recovered:['已恢复报名','Enrollment restored','Pendaftaran dipulihkan'],
  expired:['订单已终止','Order expired','Pesanan kedaluwarsa'],
  ended:['报名已结束','Enrollment ended','Pendaftaran berakhir'],
  refunded:['已退款','Refunded','Dana dikembalikan'],
  refunding:['退款中','Refund in progress','Pengembalian diproses'],
  converted:['候补已转申请','Waitlist converted','Daftar tunggu menjadi permohonan'],
  closed:['候补已关闭','Waitlist closed','Daftar tunggu ditutup'],
  withdrawn:['已撤回候补','Waitlist withdrawn','Daftar tunggu ditarik'],
};
const statuses:Record<EnrollmentClassSummary['status'],Copy>={
  opened:['已确认开班','Opening confirmed','Pembukaan dikonfirmasi'],
  recruiting:['报名中 · 待成班','Enrolling · Opening pending','Pendaftaran dibuka · Menunggu pembukaan'],
  closed:['自助报名截止 · 待成班','Enrollment closed · Opening pending','Pendaftaran ditutup · Menunggu pembukaan'],
  cancelled:['已确认不开班','Class will not open','Kelas tidak dibuka'],
};

export function CrmEnrollmentManagement({lang,isLight,employee,employees,canSupport,aftercare,onNavigate}:{
  lang:CrmLanguage;isLight:boolean;employee:AccessEmployee;employees:{id:string;displayName?:string}[];canSupport:boolean;aftercare:boolean;onNavigate:(href:string)=>void;
}){
  const t=(copy:Copy)=>enrollmentCopy(lang,copy);
  useLocation();
  const navigate=useNavigate();
  const params=new URLSearchParams(window.location.search);
  const shellHeight=useCrmShellHeight();
  const independent=useRecordScrollMode(shellHeight)==='independent';
  const resumeClassList=params.get('resumeClassList')==='1';
  const id=params.get('classId');
  const classDetail=Boolean(id&&!aftercare);
  const allowed=canViewEnrollmentManagement(employee);
  const scope=enrollmentManagementScopes(employee);
  const authorizationKey=JSON.stringify([employee.id,employee.permissions,employee.grants,employee.scope,employee.active]);
  const [loaded,setLoaded]=useState<{data:Result;key:string}>();
  const result=allowed&&loaded?.key===authorizationKey?loaded.data:undefined;
  const [requestVersion,setRequestVersion]=useState(0);
  const [sidebarClasses,setSidebarClasses]=useState<{classes:EnrollmentClassSummary[];key:string}>();
  const [sidebarLoading,setSidebarLoading]=useState(false);
  const [sidebarFailed,setSidebarFailed]=useState(false);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const rosterOrder=params.get('rosterOrder');
  const returnFromSettings=params.get('resumeRosterSettings')==='1';
  const rosterPositionBase='uper_enrollment_roster:'+employee.id+':'+id;
  const rosterPositionKey=rosterPositionBase+(returnFromSettings?':settings':'');
  const rosterRestoreTarget=returnFromSettings?'settings':rosterOrder;
  const settingsButtonId='crm-enrollment-class-settings';
  const [browseClasses,setBrowseClasses]=useState(false);
  const restoredFilter=enrollmentRosterStates.find(state=>state===params.get('rosterStatus'))??'';
  const restoredClosure=params.get('rosterClosure')??'';
  const [filter,setFilter]=useState<EnrollmentRosterState|''>(restoredFilter);
  const [closure,setClosure]=useState(restoredClosure);
  const restored=useRef<string|null>(null);
  const detailBody=useRef<HTMLDivElement>(null);
  const rosterTable=useRef<HTMLDivElement>(null);
  const classResults=useRef<HTMLElement>(null);
  const classTable=useRef<HTMLDivElement>(null);
  const classPositionKey='uper_enrollment_class_position:'+employee.id;
  const rosterHeading=useRef<HTMLHeadingElement>(null);
  const financePath=(orderId:string)=>{
    const returnParams=new URLSearchParams(classLinkParams);
    returnParams.set('tab','enrollment-management');returnParams.set('classId',id!);returnParams.set('rosterOrder',orderId);
    if(filter)returnParams.set('rosterStatus',filter);
    if(filter==='history'&&closure)returnParams.set('rosterClosure',closure);
    return '/crm?'+new URLSearchParams({tab:'payments',paymentView:'enrollment',enrollmentOrder:orderId,
      rosterReturn:'/crm?'+returnParams});
  };
  const rememberRoster=(orderId:string,key=rosterPositionBase)=>{
    try{sessionStorage.setItem(key,JSON.stringify({orderId,top:window.scrollY,bodyTop:detailBody.current?.scrollTop,tableLeft:rosterTable.current?.scrollLeft}));}catch{}
  };
  const [classFilters,setClassFilters]=useState(()=>readEnrollmentClassFilters(params));
  const classLinkParams=new URLSearchParams();
  writeEnrollmentClassFilters(classLinkParams,classFilters);
  const classFilterQuery=classLinkParams.size?'&'+classLinkParams.toString():'';
  const classDetailPath=(classId:string,page=classFilters.page)=>{
    const query=new URLSearchParams();
    writeEnrollmentClassFilters(query,{...classFilters,page});
    return enrollmentClassManagementPath(classId)+(query.size?'&'+query.toString():'');
  };
  const rememberClass=(event:React.MouseEvent<HTMLAnchorElement>,classId:string)=>{
    if(event.button!==0||event.altKey||event.metaKey||event.shiftKey||event.ctrlKey)return;
    const roster=event.currentTarget.classList.contains('crm-enrollment-roster-link');
    const rowTop=event.currentTarget.closest('tr')?.getBoundingClientRect().top;
    try{sessionStorage.setItem(classPositionKey,JSON.stringify({classId,roster,rowTop,top:window.scrollY,left:classTable.current?.scrollLeft}));}catch{}
  };
  const recordLayout=useAdminRecordSidebarLayout({id:'crm-class-records',lang,persistent:independent,available:allowed,
    listOpen:browseClasses,setListOpen:setBrowseClasses,
    back:{label:t(['返回班次列表','Back to classes','Kembali ke daftar kelas']),href:list+classFilterQuery+'&resumeClassList=1'}});
  const changeClassFilters=(next:Partial<EnrollmentClassFilters>)=>{
    const updated={...classFilters,page:1,...next};
    setClassFilters(updated);
    const url=new URL(window.location.href);
    writeEnrollmentClassFilters(url.searchParams,updated);
    window.history.replaceState(window.history.state,'',url);
  };
  useEffect(()=>{
    const restore=()=>setClassFilters(readEnrollmentClassFilters(new URLSearchParams(window.location.search)));
    window.addEventListener('popstate',restore);
    return ()=>window.removeEventListener('popstate',restore);
  },[]);
  useEffect(()=>{
    setBrowseClasses(false);
    if(detailBody.current)detailBody.current.scrollTop=0;
    restored.current=null;
  },[id,aftercare]);
  useEffect(()=>{
    if(!classDetail||!allowed||!recordLayout.sidebarVisible)return;
    const controller=new AbortController();
    setSidebarLoading(true);setSidebarFailed(false);
    void fetch('/api/crm/enrollment/management',{cache:'no-store',signal:controller.signal}).then(async response=>{
      if(!response.ok)throw Error();
      const data=await response.json();
      if(!controller.signal.aborted)setSidebarClasses({key:authorizationKey,classes:data.classes});
    }).catch(()=>{
      if(!controller.signal.aborted){setSidebarClasses(undefined);setSidebarFailed(true);}
    }).finally(()=>{if(!controller.signal.aborted)setSidebarLoading(false);});
    return ()=>controller.abort();
  },[classDetail,allowed,recordLayout.sidebarVisible,authorizationKey,requestVersion]);
  useEffect(()=>{
    setLoaded(undefined);setFilter(restoredFilter);setClosure(restoredClosure);
  },[id,employee.id,allowed]);
  useEffect(()=>{
    if(aftercare||!allowed)return;
    const controller=new AbortController();
    setLoading(true);setError('');
    const endpoint='/api/crm/enrollment/management'+(id?'/'+encodeURIComponent(id):'');
    void fetch(endpoint,{cache:'no-store',signal:controller.signal}).then(async response=>{
      if(controller.signal.aborted)return;
      if(!response.ok){if(response.status<500)setLoaded(undefined);setError(String(response.status));return;}
      const data=await response.json();
      if(!controller.signal.aborted)setLoaded({data,key:authorizationKey});
    }).catch(()=>{if(!controller.signal.aborted)setError('failed');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[aftercare,allowed,id,authorizationKey,requestVersion]);
  const cohort=result&&'cohort' in result&&result.cohort.id===id?result.cohort:null;
  const classes=result&&'classes' in result?result.classes:
    allowed&&id&&sidebarClasses?.key===authorizationKey?sidebarClasses.classes:undefined;
  const rows=result&&'rows' in result&&cohort?result.rows.filter(row=>(!filter||row.status===filter)&&(filter!=='history'||!closure||row.closureReason===closure)):undefined;
  useEffect(()=>{
    if(!rows||!rosterRestoreTarget||restored.current===rosterRestoreTarget)return;
    const target=document.getElementById(returnFromSettings?settingsButtonId:'roster-verify-'+rosterOrder)??rosterHeading.current;
    if(!target)return;
    const frame=requestAnimationFrame(()=>{
      restored.current=rosterRestoreTarget;
      let saved:{orderId?:string;top?:number;bodyTop?:number;tableLeft?:number}|undefined;
      try{
        const value=sessionStorage.getItem(rosterPositionKey);
        if(value)saved=JSON.parse(value);
        sessionStorage.removeItem(rosterPositionKey);
      }catch{}
      const body=detailBody.current;
      const sameRecord=saved?.orderId===rosterRestoreTarget;
      if(independent&&body){
        if(sameRecord&&typeof saved.bodyTop==='number')body.scrollTop=saved.bodyTop;
        if(!returnFromSettings)revealRecord(body,target);
      }else if(sameRecord&&typeof saved.top==='number')window.scrollTo({top:saved.top,behavior:'instant'});
      else target.scrollIntoView({block:'nearest',behavior:'instant'});
      if(sameRecord&&rosterTable.current&&typeof saved.tableLeft==='number')rosterTable.current.scrollLeft=saved.tableLeft;
      target.focus({preventScroll:true});
    });
    return ()=>cancelAnimationFrame(frame);
  },[rows,rosterRestoreTarget,returnFromSettings,rosterOrder,rosterPositionKey,independent]);
  useEffect(()=>{
    if(id||aftercare||!classes||!resumeClassList)return;
    // Let the list and its header settle before restoring the page position.
    let restoreFrame=0;
    const frame=requestAnimationFrame(()=>{
      restoreFrame=requestAnimationFrame(()=>{
        try{
          const value=sessionStorage.getItem(classPositionKey);
          sessionStorage.removeItem(classPositionKey);
          if(!value)return;
          const position=JSON.parse(value);
          const region=classResults.current;
          const row=[...region?.querySelectorAll<HTMLTableRowElement>('[data-class-id]')??[]]
            .find(item=>item.dataset.classId===position.classId);
          if(classTable.current&&typeof position.left==='number')classTable.current.scrollLeft=position.left;
          const entry=row?.querySelector<HTMLAnchorElement>(position.roster?'.crm-enrollment-roster-link':'.crm-enrollment-name');
          (entry??region?.querySelector<HTMLInputElement>('input[type=search]'))?.focus({preventScroll:true});
          const top=row&&typeof position.rowTop==='number'
            ?window.scrollY+row.getBoundingClientRect().top-position.rowTop:position.top;
          window.scrollTo({top,behavior:'instant'});
        }catch{}
        finally{
          const url=new URL(window.location.href);
          url.searchParams.delete('resumeClassList');
          window.history.replaceState(window.history.state,'',url);
        }
      });
    });
    return ()=>{cancelAnimationFrame(frame);cancelAnimationFrame(restoreFrame);};
  },[id,aftercare,classes,resumeClassList,classPositionKey]);
  const title=t(['报名管理','Enrollment management','Pengelolaan pendaftaran']);
  const classTitle=(row:EnrollmentClassSummary)=>enrollmentClassTitle(row,lang);
  const matchedClasses=filterEnrollmentClasses(classes??[],classFilters,classTitle);
  const pageCount=Math.max(1,Math.ceil(matchedClasses.length/enrollmentClassPageSize));
  const page=Math.min(classFilters.page,pageCount);
  const offset=(page-1)*enrollmentClassPageSize;
  const visibleClasses=matchedClasses.slice(offset,offset+enrollmentClassPageSize);
  const hasClassFilters=Boolean(classFilters.search||classFilters.level||classFilters.format||classFilters.period||classFilters.status||classFilters.seats||classFilters.date);
  const classOptions=(key:'level'|'format'|'period',all:Copy)=>[
    {value:'',label:t(all)},...Array.from(new Set([...(classes??[]).map(row=>row[key]),classFilters[key]].filter(Boolean)))
      .sort((a,b)=>a.localeCompare(b,lang,{numeric:true})).map(value=>({value,label:interestOption(lang,value)})),
  ];
  const stateLabel=(row:EnrollmentClassSummary)=>t(statuses[row.status]);
  const statusBadge=(row:EnrollmentClassSummary)=><span className="crm-payment-status" data-tone={row.status==='opened'?'success':row.status==='recruiting'?'info':undefined}>{stateLabel(row)}</span>;
  const enrollmentProgress=(row:EnrollmentClassSummary,showStatus=true)=><>
    {row.status==='opened'||row.status==='cancelled'?(showStatus&&statusBadge(row)):<strong>{enrollmentClassShortfall(row)>0
      ?t(['距开班差 '+enrollmentClassShortfall(row)+' 人','Need '+enrollmentClassShortfall(row)+' more to open','Butuh '+enrollmentClassShortfall(row)+' siswa lagi'])
      :t(['达到开班门槛','Opening minimum reached','Minimum pembukaan tercapai'])}</strong>}
    {row.status!=='cancelled'&&<small>{row.counts.paid} / {row.minimumPaid} {t(['人足额到账','fully paid','siswa lunas'])}</small>}
  </>;
  const seatProgress=(row:EnrollmentClassSummary)=><>
    <strong>{!row.accepting?t(['自助报名已截止','Self-service closed','Pendaftaran mandiri ditutup']):
      row.available?t(['剩 '+row.available+' 席',row.available+' seats left',row.available+' kursi tersisa']):t(['已满班','Full','Kelas penuh'])}</strong>
    {row.status!=='cancelled'&&<small>{row.occupied} / {row.capacity} {t(['席已占','seats reserved','kursi terisi'])}</small>}
  </>;
  const firstLesson=(row:EnrollmentClassSummary)=>t(['首课','First session','Pertemuan pertama'])+' '+formatCrmEventTime(row.firstLessonAt).slice(0,16);
  const owner=(row:EnrollmentRosterEntry)=>row.customerId
    ?(row.owner?employees.find(employee=>employee.id===row.owner)?.displayName??row.owner:t(['未分配','Unassigned','Belum ditugaskan'])):'—';

  const canRefresh=allowed&&(!aftercare||canSupport);
  const refreshLabel=t(['刷新','Refresh','Segarkan']);
  const searchLabel=t(['搜索班次','Search classes','Cari kelas']);
  const classFilterCount=[classFilters.search.trim(),classFilters.level,classFilters.format,classFilters.period,
    classFilters.status,classFilters.seats,classFilters.date].filter(Boolean).length;
  const classFilterControls=<>
    <AdminSingleSelect lang={lang} isLight={isLight} label={t(['级别','Level','Level'])} value={classFilters.level}
      onChange={level=>changeClassFilters({level})} options={classOptions('level',['全部级别','All levels','Semua level'])}/>
    <AdminSingleSelect lang={lang} isLight={isLight} label={t(['班型','Class format','Tipe kelas'])} value={classFilters.format}
      onChange={format=>changeClassFilters({format})} options={classOptions('format',['全部班型','All formats','Semua tipe kelas'])}/>
    <AdminSingleSelect lang={lang} isLight={isLight} label={t(['时段','Schedule','Jadwal'])} value={classFilters.period}
      onChange={period=>changeClassFilters({period})} options={classOptions('period',['全部时段','All schedules','Semua jadwal'])}/>
    <AdminSingleSelect lang={lang} isLight={isLight} label={t(['班次状态','Class status','Status kelas'])} value={classFilters.status}
      onChange={status=>changeClassFilters({status})} options={[{value:'',label:t(['全部班次状态','All class statuses','Semua status kelas'])},
        ...Object.entries(statuses).map(([value,copy])=>({value,label:t(copy)}))]}/>
    <AdminSingleSelect lang={lang} isLight={isLight} label={t(['招生余位','Seat availability','Kursi tersedia'])} value={classFilters.seats}
      onChange={seats=>changeClassFilters({seats})} options={[
        {value:'',label:t(['全部余位状态','All seat statuses','Semua status kursi'])},
        {value:'available',label:t(['可报名 · 有余位','Enrollment open · Seats available','Pendaftaran dibuka · Kursi tersedia'])},
        {value:'full',label:t(['已满班','Full','Kelas penuh'])},
        {value:'closed',label:t(['自助报名已截止','Self-service closed','Pendaftaran mandiri ditutup'])},
      ]}/>
    <AdminSingleSelect lang={lang} isLight={isLight} label={t(['首课日期','First-session date','Tanggal pertemuan pertama'])} value={classFilters.date}
      onChange={date=>changeClassFilters({date})} options={[
        {value:'',label:t(['全部首课日期','All first-session dates','Semua tanggal pertemuan pertama'])},
        {value:'7',label:t(['未来 7 天（含今天）','Next 7 days including today','7 hari ke depan termasuk hari ini'])},
        {value:'30',label:t(['未来 30 天（含今天）','Next 30 days including today','30 hari ke depan termasuk hari ini'])},
        {value:'past',label:t(['首课时间已过','First session has passed','Pertemuan pertama sudah lewat'])},
      ]}/>
    {hasClassFilters&&<button className="crm-work-link" type="button" onClick={()=>changeClassFilters({search:'',level:'',format:'',period:'',status:'',seats:'',date:''})}>
      {t(['清除筛选','Clear filters','Hapus filter'])}</button>}
  </>;
  const classSortControl=<AdminSingleSelect lang={lang} isLight={isLight} label={t(['排序','Sort','Urutkan'])} value={classFilters.sort}
      onChange={sort=>changeClassFilters({sort:sort as EnrollmentClassFilters['sort']})} options={[
        {value:'upcoming',label:t(['即将开课优先','Upcoming first','Kelas mendatang dahulu'])},
        {value:'latest',label:t(['首课日期从晚到早','First session · Latest first','Pertemuan pertama · Terbaru dahulu'])},
        {value:'oldest',label:t(['首课日期从早到晚','First session · Earliest first','Pertemuan pertama · Terlama dahulu'])},
        {value:'seats',label:t(['可报余位从多到少','Available seats · Most first','Kursi tersedia · Terbanyak dahulu'])},
        {value:'waitlist',label:t(['候补人数从多到少','Waitlist · Largest first','Daftar tunggu · Terbanyak dahulu'])},
        {value:'opening',label:t(['最接近成班优先','Closest to opening first','Paling dekat pembukaan dahulu'])},
      ]}/>;
  const issue=!allowed||(aftercare&&!canSupport)||error==='403'||error==='401'
    ?t(['无权查看报名管理。','You do not have access to enrollment management.','Anda tidak memiliki akses ke pengelolaan pendaftaran.'])
    :error==='404'?t(['班次不存在或当前账号无权查看。','The class is unavailable or you cannot view it.','Kelas tidak tersedia atau tidak dapat Anda lihat.'])
      :error?t(['暂时无法读取，请刷新后重试。','Could not load enrollments. Refresh to retry.','Pendaftaran gagal dimuat. Segarkan dan coba lagi.']):undefined;
  const loadingLabel=t(['正在加载…','Loading…','Memuat…']);
  const noMatches=t(['暂无符合条件的班次。','No classes match.','Tidak ada kelas yang sesuai.']);

  const openClassSettings=(classId:string)=>{
    const returnTo=new URLSearchParams(classLinkParams);
    returnTo.set('tab','enrollment-management');
    returnTo.set('classId',classId);
    if(filter)returnTo.set('rosterStatus',filter);
    if(filter==='history'&&closure)returnTo.set('rosterClosure',closure);
    rememberRoster('settings',rosterPositionBase+':settings');
    onNavigate(enrollmentSettingsPath('enrollment-classes',{classId,returnTo:'/crm?'+returnTo}));
  };
  const overviewHeader=<div className="crm-enrollment-overview">
    {!classDetail&&<AdminPageHeader title={title} subtitle={aftercare
      ?t(['按报名订单查找学员，跟进转班、退款和其他售后处理。','Find learners by enrollment order and follow up on transfers, refunds and other after-sales requests.','Cari peserta berdasarkan pesanan pendaftaran dan tindak lanjuti pindah kelas, pengembalian dana, serta layanan purnajual lainnya.'])
      :t(['按班次查看报名人数、名单和学员的付款状态。','Review enrollment counts, rosters and learner payment status by class.','Lihat jumlah pendaftar, daftar peserta, dan status pembayaran per kelas.'])}
      actions={allowed&&(scope.operations||canRefresh)&&<>
        {scope.operations&&<AdminPageAction icon={Settings}
          label={t(['课程与班次设置','Course and class settings','Pengaturan kursus dan kelas'])}
          onClick={()=>onNavigate(enrollmentSettingsPath('courses',{returnTo:(aftercare?aftercarePath:list)+classFilterQuery}))}/>}
        {canRefresh&&<AdminRefreshAction label={refreshLabel} loading={loading} onClick={()=>setRequestVersion(v=>v+1)}/>}
    </>}/>}
    {!id&&allowed&&canSupport&&<AdminContentNav label={title} onNavigate={onNavigate} items={[
      {href:list+classFilterQuery,label:t(['班次','Classes','Kelas']),current:!aftercare},
      {href:aftercarePath+classFilterQuery,label:t(['售后服务','After-sales support','Layanan purnajual']),current:aftercare},
    ]}/>}
  </div>;
  return <section className="crm-enrollment-management" aria-busy={!aftercare&&loading}>
    {overviewHeader}
    {!classDetail&&(!allowed||(aftercare?!canSupport:error==='403'||error==='401'))
      ?<AdminListState lang={lang} state="denied" message={issue}/>
      :aftercare?<CrmEnrollmentSupport key={authorizationKey} lang={lang} isLight={isLight} embedded refreshVersion={requestVersion} onRefreshingChange={setLoading}/>
      :<>
        {!id&&<section className="crm-enrollment-panel" ref={classResults}>
          <div className="crm-opportunity-filters crm-enrollment-filters" role="group" aria-label={t(['班次筛选','Class filters','Filter kelas'])}>
            <AdminSearchField className="crm-enrollment-search" value={classFilters.search} maxLength={120}
              label={searchLabel}
              placeholder={t(['搜索级别、班次编号、日期或课表','Search level, class ID, date or schedule','Cari level, ID kelas, tanggal atau jadwal'])}
              onChange={search=>changeClassFilters({search})}/>
            {classFilterControls}
          </div>
          <div className="crm-enrollment-results">
            <span role="status">{classes?t([matchedClasses.length+' 个班次',matchedClasses.length+' classes',matchedClasses.length+' kelas']):'—'}</span>
            {classSortControl}
          </div>
          {issue&&<AdminListState lang={lang} state="error" message={issue}
            compact={Boolean(visibleClasses.length)} onRetry={()=>setRequestVersion(v=>v+1)}/>}
          {!issue&&!classes&&<AdminListState lang={lang} state="loading"/>}
          {!issue&&classes&&!visibleClasses.length&&<AdminListState lang={lang} state="empty" message={noMatches}/>}
          {visibleClasses.length>0&&<AdminListTable className="crm-enrollment-table" label={t(['班次','Classes','Kelas'])}
            busy={loading} viewportRef={classTable} headers={[
              {label:t(['班次','Class','Kelas']),sort:classFilters.sort==='latest'?'descending':classFilters.sort==='oldest'?'ascending':classFilters.sort==='upcoming'?'other':undefined},
              {label:t(['开班进度','Class opening','Status pembukaan']),sort:classFilters.sort==='opening'?'other':undefined},
              {label:t(['招生余位','Seat availability','Kursi tersedia']),sort:classFilters.sort==='seats'?'other':undefined},
              {label:t(['候补','Waitlist','Daftar tunggu']),numeric:true,sort:classFilters.sort==='waitlist'?'descending':undefined},
              t(['操作','Actions','Tindakan']),
            ]}>
            {visibleClasses.map(row=><tr key={row.id} data-class-id={row.id}>
              <td className="crm-enrollment-class-cell"><AdminRecordEntry className="crm-enrollment-name" href={classDetailPath(row.id,page)} onClick={event=>rememberClass(event,row.id)}>{classTitle(row)}</AdminRecordEntry>
                <small>{firstLesson(row)}{row.schedule?' · '+row.schedule:''}</small></td>
              <td>{enrollmentProgress(row)}</td>
              <td>{seatProgress(row)}</td>
              <td className="crm-list-number">{row.counts.waiting}</td>
              <td><AdminRowAction className="crm-enrollment-roster-link" href={classDetailPath(row.id,page)} onClick={event=>rememberClass(event,row.id)} aria-label={t(['查看名单','View roster','Lihat daftar siswa'])+' · '+classTitle(row)}>{t(['查看名单','View roster','Lihat daftar siswa'])}</AdminRowAction></td>
            </tr>)}
          </AdminListTable>}
          <AdminListPagination lang={lang} page={page} pageCount={pageCount} busy={loading}
            summary={`${offset+1}–${offset+visibleClasses.length} / ${matchedClasses.length}`}
            onPageChange={page=>changeClassFilters({page})}/>
        </section>}
        {classDetail&&<div className="crm-enrollment-detail-shell crm-detail-root" data-theme={isLight?'light':'dark'}
          data-record-detail="true" data-record-scroll={independent?'independent':'page'} data-sidebar={independent&&recordLayout.sidebarVisible}
          style={{'--crm-shell-height':shellHeight+'px'} as React.CSSProperties}>
          {recordLayout.listNavigation}
          <CrmRecordSidebar {...recordLayout.sidebar} title={t(['班次','Classes','Kelas'])}
            count={classes?matchedClasses.length:undefined} selectedId={matchedClasses.some(row=>row.id===id)?id??undefined:undefined}
            busy={sidebarLoading} busyLabel={loadingLabel}
            note={classes&&cohort&&!matchedClasses.some(row=>row.id===id)?t([
              '当前班次不在筛选结果中，名单仍保持打开。','The current class is outside these filters. Its roster stays open.',
              'Kelas saat ini di luar filter. Daftar siswanya tetap terbuka.',
            ]):undefined}
            empty={!classes?<p className="crm-record-sidebar-message" role={sidebarFailed?'alert':'status'}>
              {sidebarFailed?t(['暂时无法读取班次列表。','Could not load classes.','Daftar kelas tidak dapat dimuat.']):loadingLabel}</p>:
              !matchedClasses.length?<p className="crm-record-sidebar-message">{noMatches}</p>:undefined}
            filters={<CrmRecordFilters lang={lang} count={classFilterCount}
              search={<CrmRecordSearch label={searchLabel} placeholder={t(['级别、日期或课表','Level, date or schedule','Level, tanggal atau jadwal'])}
                value={classFilters.search} onChange={search=>changeClassFilters({search})}/>}>
              {classFilterControls}{classSortControl}
            </CrmRecordFilters>}>
            {matchedClasses.map((row,index)=>{
              const targetPage=Math.floor(index/enrollmentClassPageSize)+1;
              const path=classDetailPath(row.id,targetPage);
              return <CrmRecordRow key={row.id} selected={row.id===id} name={classTitle(row)}
                title={classTitle(row)+' · '+firstLesson(row)} href={path} onClick={event=>{
                  if(event.altKey||event.metaKey||event.shiftKey||event.ctrlKey)return;
                  event.preventDefault();
                  if(row.id!==id){
                    if(classFilters.page!==targetPage)setClassFilters(current=>({...current,page:targetPage}));
                    navigate(path);
                  }
                  if(!independent)setBrowseClasses(false);
                }} meta={<>{statusBadge(row)}<small>{firstLesson(row)}</small></>}/>;
            })}
          </CrmRecordSidebar>
          <div className="crm-detail-panel crm-enrollment-detail-panel" hidden={recordLayout.listOnly}>
            <AdminRecordHeader back={recordLayout.headerBack} title={<CrmRecordTitle title={cohort?classTitle(cohort):t(['班次详情','Class details','Detail kelas'])}
                status={cohort&&statusBadge(cohort)} meta={cohort&&[firstLesson(cohort),cohort.schedule].filter(Boolean).join(' · ')}/>}
              actions={<CrmDetailActions label={t(['班次操作','Class actions','Tindakan kelas'])} secondary={<>{recordLayout.browseAction}
                {scope.operations&&cohort&&<AdminPageAction id={settingsButtonId} icon={Settings} label={t(['班次设置','Class settings','Pengaturan kelas'])}
                  onClick={()=>openClassSettings(cohort.id)}/>}
                {canRefresh&&<AdminRefreshAction label={refreshLabel} loading={loading} onClick={()=>setRequestVersion(v=>v+1)}/>}
              </>}/>}/>
            {cohort&&<div className="crm-panel-next">
              <dl className="crm-enrollment-detail-summary">
                {cohort.status!=='cancelled'&&<div><dt>{t(['开班进度','Class opening','Status pembukaan'])}</dt>
                  <dd>{enrollmentProgress(cohort,false)}</dd></div>}
                <div><dt>{t(['招生余位','Seat availability','Kursi tersedia'])}</dt><dd>{seatProgress(cohort)}</dd></div>
              </dl>
            </div>}
            <div className="crm-detail-body crm-enrollment-detail-body" ref={detailBody}
              tabIndex={0} data-admin-scroll="detail" onKeyDown={containPaneKeys}>
            {issue?<p role="alert">{issue}</p>:!cohort?<p role="status">{loadingLabel}</p>:<section className="crm-enrollment-detail-roster">
                <div className="crm-enrollment-roster-heading">
                  <h2 ref={rosterHeading} tabIndex={-1}>{t(['学员名单','Learner roster','Daftar siswa'])}</h2>
                  <p className="crm-work-muted">{t(['名单按客户权限显示。','Roster visibility follows customer permissions.','Daftar mengikuti izin akses pelanggan.'])}</p>
                </div>
              <div className="crm-enrollment-conditions" aria-label={t(['按报名状态筛选','Filter by enrollment status','Filter menurut status'])}>
                <button type="button" className="crm-work-button" aria-pressed={!filter} onClick={()=>setFilter('')}>{t(['全部记录','All records','Semua catatan'])}</button>
                {enrollmentRosterStates.map(state=><button key={state} type="button" className="crm-work-button" aria-pressed={filter===state} onClick={()=>setFilter(state)}>
                  {t(groups[state])} <strong>{cohort.counts[state]}</strong>
                </button>)}
              </div>
              {filter==='history'&&<div className="crm-opportunity-filters"><AdminSingleSelect lang={lang} isLight={isLight} label={t(['关闭原因','Closure reason','Alasan penutupan'])} value={closure} onChange={setClosure}
                options={[{value:'',label:t(['全部原因','All reasons','Semua alasan'])},...Object.entries(closeReasons).map(([value,copy])=>({value,label:t(copy)}))]}/></div>}
              {rows?.length?<AdminListTable className="crm-enrollment-table" viewportRef={rosterTable} busy={loading}
                label={t(['学员名单','Learner roster','Daftar siswa'])} headers={([
                  ['学员','Learner','Siswa'],['报名状态','Enrollment status','Status pendaftaran'],['应付／已核实','Due / verified','Tagihan / terverifikasi'],
                  ['截止时间','Deadline','Tenggat'],['操作','Actions','Tindakan'],
                ] as Copy[]).map(t)}>
                {rows.map(row=><tr key={row.status+row.id}>
                  <td><strong>{row.name||t(['未记录姓名','Name not recorded','Nama belum dicatat'])}</strong>
                    {row.customerId&&<div className="crm-work-muted">{owner(row)}</div>}
                    {row.email&&<div>{row.email}</div>}{row.phone&&<div>{row.phone}</div>}</td>
                  <td>{t(row.closureReason?closeReasons[row.closureReason]:actual[row.actualStatus]??groups[row.status])}</td>
                  <td>{row.price===undefined?'—':formatCurrency(row.price,lang)+' / '+formatCurrency(row.received??0,lang)}</td>
                  <td>{row.dueAt&&['awaiting_payment','held'].includes(row.status)?formatCrmEventTime(row.dueAt):'—'}</td>
                  <td><div className="crm-enrollment-row-actions">
                    {row.customerId&&<AdminRowAction href={'/crm?tab=leads&lead='+encodeURIComponent(row.customerId)}>{t(['客户','Customer','Pelanggan'])}</AdminRowAction>}
                    {row.opportunityId&&<AdminRowAction href={'/crm?tab=opportunities&opportunity='+encodeURIComponent(row.opportunityId)}>{t(['商机','Opportunity','Peluang'])}</AdminRowAction>}
                    {row.canVerify&&<AdminRowAction id={'roster-verify-'+row.id} href={financePath(row.id)} onClick={()=>rememberRoster(row.id)}>{t(['核对到账','Verify payment','Verifikasi pembayaran'])}</AdminRowAction>}
                  </div></td>
                </tr>)}
              </AdminListTable>:<AdminListState lang={lang} state="empty" message={t(['当前筛选下没有可查看的学员记录。','No visible learner records match this filter.','Tidak ada catatan siswa yang dapat dilihat untuk filter ini.'])}/>}
              </section>}
          </div>
          </div>
        </div>}
      </>}
  </section>;
}
