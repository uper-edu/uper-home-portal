import type { EnrollmentClosureReason } from '../../utils/enrollmentOrderStatus';
import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { containPaneKeys, revealRecord } from '../adminScroll';
import { interestOption } from '../EnrollmentInterests';
import { enrollmentCopy } from '../EnrollmentApplication';
import { formatCrmEventTime } from '../../utils/crmOperatingTime';
import { formatCurrency } from '../../utils/currency';
import type { CrmLanguage } from '../../utils/crmLanguage';
import type { AccessEmployee } from '../../utils/accessControl';
import { canViewEnrollmentManagement, enrollmentManagementScopes, enrollmentClassManagementPath, enrollmentRosterStates,
  type EnrollmentClassSummary, type EnrollmentRosterEntry, type EnrollmentRosterState } from '../../utils/crmEnrollmentManagement';
import { CrmEnrollmentSupport } from './CrmEnrollmentResolution';
import { CrmSingleSelect } from './CrmSingleSelect';
import { CrmPageAction } from './CrmPageAction';
import { CrmDetailActions, CrmRecordFilters, CrmRecordNavigation, CrmRecordRow, CrmRecordSearch,
  CrmRecordSidebar, CrmRecordSidebarToggle, CrmRecordTitle } from './CrmRecordWorkspace';
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

export function CrmEnrollmentManagement({lang,isLight,employee,employees,canSupport,aftercare}:{
  lang:CrmLanguage;isLight:boolean;employee:AccessEmployee;employees:{id:string;displayName?:string}[];canSupport:boolean;aftercare:boolean;
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
  const rosterPositionKey='uper_enrollment_roster:'+employee.id+':'+id;
  const [sidebarPreference,setSidebarPreference]=useState<boolean|undefined>(()=>{
    if(!id||!rosterOrder)return undefined;
    try{
      const position=JSON.parse(sessionStorage.getItem(rosterPositionKey)??'null');
      if(position?.orderId===rosterOrder&&typeof position.sidebarOpen==='boolean')return position.sidebarOpen;
    }catch{}
    return undefined;
  });
  const sidebarOpen=sidebarPreference??independent;
  const restoredFilter=enrollmentRosterStates.find(state=>state===params.get('rosterStatus'))??'';
  const restoredClosure=params.get('rosterClosure')??'';
  const [filter,setFilter]=useState<EnrollmentRosterState|''>(restoredFilter);
  const [closure,setClosure]=useState(restoredClosure);
  const restored=useRef<string|null>(null);
  const detailBody=useRef<HTMLDivElement>(null);
  const rosterTable=useRef<HTMLDivElement>(null);
  const classResults=useRef<HTMLElement>(null);
  const classPositionKey='uper_enrollment_class_position:'+employee.id;
  const rosterHeading=useRef<HTMLHeadingElement>(null);
  const financePath=(orderId:string)=>{
    const returnParams=new URLSearchParams(classFilterQuery);
    returnParams.set('tab','enrollment-management');returnParams.set('classId',id!);returnParams.set('rosterOrder',orderId);
    if(filter)returnParams.set('rosterStatus',filter);
    if(filter==='history'&&closure)returnParams.set('rosterClosure',closure);
    return '/crm?'+new URLSearchParams({tab:'payments',paymentView:'enrollment',enrollmentOrder:orderId,
      rosterReturn:'/crm?'+returnParams});
  };
  const rememberRoster=(orderId:string)=>{
    try{sessionStorage.setItem(rosterPositionKey,JSON.stringify({orderId,sidebarOpen,top:window.scrollY,bodyTop:detailBody.current?.scrollTop,tableLeft:rosterTable.current?.scrollLeft}));}catch{}
  };
  const [classFilter,setClassFilter]=useState(()=>params.get('classStatus')??'');
  const [sidebarSearch,setSidebarSearch]=useState('');
  const classFilterQuery=classFilter?'&classStatus='+encodeURIComponent(classFilter):'';
  const classDetailPath=(classId:string)=>enrollmentClassManagementPath(classId)+classFilterQuery;
  const rememberClass=(classId:string)=>{
    try{sessionStorage.setItem(classPositionKey,JSON.stringify({classId,top:window.scrollY}));}catch{}
  };
  const changeClassFilter=(status:string)=>{
    setClassFilter(status);
    const url=new URL(window.location.href);
    if(status)url.searchParams.set('classStatus',status);
    else url.searchParams.delete('classStatus');
    window.history.replaceState(window.history.state,'',url);
  };
  useEffect(()=>{
    const restore=()=>setClassFilter(new URLSearchParams(window.location.search).get('classStatus')??'');
    window.addEventListener('popstate',restore);
    return ()=>window.removeEventListener('popstate',restore);
  },[]);
  useEffect(()=>{
    if(!id||aftercare){setSidebarPreference(undefined);setSidebarSearch('');}
    if(detailBody.current)detailBody.current.scrollTop=0;
    restored.current=null;
  },[id,aftercare]);
  useEffect(()=>{
    if(!classDetail||!allowed||!sidebarOpen)return;
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
  },[classDetail,allowed,sidebarOpen,authorizationKey,requestVersion]);
  useEffect(()=>{
    setLoaded(undefined);setFilter(restoredFilter);setClosure(restoredClosure);
  },[id,aftercare,employee.id,allowed]);
  useEffect(()=>{
    if(aftercare||!allowed)return;
    const controller=new AbortController();
    setLoading(true);setError('');
    const endpoint='/api/crm/enrollment/management'+(id?'/'+encodeURIComponent(id):'');
    void fetch(endpoint,{cache:'no-store',signal:controller.signal}).then(async response=>{
      if(controller.signal.aborted)return;
      if(!response.ok){setLoaded(undefined);setError(String(response.status));return;}
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
    if(!rows||!rosterOrder||restored.current===rosterOrder)return;
    const target=document.getElementById('roster-verify-'+rosterOrder)??rosterHeading.current;
    if(!target)return;
    const frame=requestAnimationFrame(()=>{
      restored.current=rosterOrder;
      let saved:{orderId?:string;top?:number;bodyTop?:number;tableLeft?:number}|undefined;
      try{
        const value=sessionStorage.getItem(rosterPositionKey);
        if(value)saved=JSON.parse(value);
        sessionStorage.removeItem(rosterPositionKey);
      }catch{}
      const body=detailBody.current;
      const sameOrder=saved?.orderId===rosterOrder;
      if(independent&&body){
        if(sameOrder&&typeof saved.bodyTop==='number')body.scrollTop=saved.bodyTop;
        revealRecord(body,target);
      }else if(sameOrder&&typeof saved.top==='number')window.scrollTo({top:saved.top,behavior:'instant'});
      else target.scrollIntoView({block:'nearest',behavior:'instant'});
      if(sameOrder&&rosterTable.current&&typeof saved.tableLeft==='number')rosterTable.current.scrollLeft=saved.tableLeft;
      target.focus({preventScroll:true});
    });
    return ()=>cancelAnimationFrame(frame);
  },[rows,rosterOrder,rosterPositionKey,independent]);
  useEffect(()=>{
    if(id||aftercare||!classes||!resumeClassList)return;
    const frame=requestAnimationFrame(()=>{
      const url=new URL(window.location.href);
      url.searchParams.delete('resumeClassList');
      window.history.replaceState(window.history.state,'',url);
      try{
        const value=sessionStorage.getItem(classPositionKey);
        sessionStorage.removeItem(classPositionKey);
        if(!value)return;
        const position=JSON.parse(value);
        const region=classResults.current;
        const row=[...region?.querySelectorAll<HTMLTableRowElement>('[data-class-id]')??[]]
          .find(item=>item.dataset.classId===position.classId);
        (row?.querySelector('a')??region?.querySelector<HTMLElement>('button[aria-haspopup]'))?.focus({preventScroll:true});
        window.scrollTo({top:position.top,behavior:'instant'});
      }catch{}
    });
    return ()=>cancelAnimationFrame(frame);
  },[id,aftercare,classes,resumeClassList,classPositionKey]);
  const title=t(['报名管理','Enrollment management','Pengelolaan pendaftaran']);
  const classTitle=(row:EnrollmentClassSummary)=>row.level+' · '+[row.period,row.format].filter(Boolean).map(value=>interestOption(lang,value)).join(lang==='zh'?'':' ');
  const visibleClasses=classes?.filter(row=>!classFilter||row.status===classFilter)??[];
  const search=sidebarSearch.trim().toLowerCase();
  const matchedClasses=visibleClasses.filter(row=>!search||
    [classTitle(row),row.id,row.schedule,formatCrmEventTime(row.firstLessonAt)].some(value=>value?.toLowerCase().includes(search)));
  const stateLabel=(row:EnrollmentClassSummary)=>t(statuses[row.status]);
  const statusBadge=(row:EnrollmentClassSummary)=><span className="crm-payment-status" data-tone={row.status==='opened'?'success':row.status==='recruiting'?'info':undefined}>{stateLabel(row)}</span>;
  const enrollmentProgress=(row:EnrollmentClassSummary)=><>
    {row.status!=='opened'&&row.status!=='cancelled'&&<strong>{Math.max(0,row.minimumPaid-row.counts.paid)>0
      ?t(['距开班差 '+Math.max(0,row.minimumPaid-row.counts.paid)+' 人','Need '+Math.max(0,row.minimumPaid-row.counts.paid)+' more to open','Butuh '+Math.max(0,row.minimumPaid-row.counts.paid)+' siswa lagi'])
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
  const listClassTitle=(row:EnrollmentClassSummary)=>row.level+' · '+t(row.format==='standard'
    ?['标准班','Standard class','Kelas standar']:['小班','Small group','Kelompok kecil'])+' · '+formatCrmEventTime(row.firstLessonAt);
  const listStateLabel=(row:EnrollmentClassSummary)=>t(statuses[row.status])+(row.status==='opened'&&!row.accepting
    ?' · '+t(['自助报名截止','Enrollment closed','Pendaftaran ditutup']):'');
  const available=(row:EnrollmentClassSummary)=>row.accepting?row.available:'—';
  const classFilterControl=<CrmSingleSelect lang={lang} isLight={isLight} label={t(['班次状态','Class status','Status kelas'])}
    value={classFilter} onChange={changeClassFilter} options={[{value:'',label:t(['全部班次','All classes','Semua kelas'])},
      ...Object.entries(statuses).map(([value,copy])=>({value,label:t(copy)}))]}/>;
  const issue=!allowed||(aftercare&&!canSupport)||error==='403'||error==='401'
    ?t(['无权查看报名管理。','You do not have access to enrollment management.','Anda tidak memiliki akses ke pengelolaan pendaftaran.'])
    :error==='404'?t(['班次不存在或当前账号无权查看。','The class is unavailable or you cannot view it.','Kelas tidak tersedia atau tidak dapat Anda lihat.'])
      :error?t(['暂时无法读取，请刷新后重试。','Could not load enrollments. Refresh to retry.','Pendaftaran gagal dimuat. Segarkan dan coba lagi.']):undefined;
  const loadingLabel=t(['正在加载…','Loading…','Memuat…']);
  const noMatches=t(['暂无符合条件的班次。','No classes match.','Tidak ada kelas yang sesuai.']);

  return <section className="crm-enrollment-management" aria-busy={!aftercare&&loading}>
    {!classDetail&&<header className="admin-page-toolbar crm-enrollment-heading">
      <h1>{title}</h1>
      {allowed&&(!aftercare||canSupport)&&<div className="crm-ops-actions">
        <button type="button" className="crm-work-button" disabled={loading} onClick={()=>setRequestVersion(v=>v+1)}>{t(['刷新','Refresh','Segarkan'])}</button>
      </div>}
    </header>}
    {!id&&allowed&&canSupport&&<nav className="crm-enrollment-views" aria-label={title}>
      <a className="crm-work-link" href={list} aria-current={!aftercare?'page':undefined}>{t(['班次','Classes','Kelas'])}</a>
      <a className="crm-work-link" href={aftercarePath} aria-current={aftercare?'page':undefined}>{t(['售后服务','After-sales support','Layanan purnajual'])}</a>
    </nav>}
    {!classDetail&&(!allowed||aftercare&&!canSupport||error==='403'||error==='401')
      ?<p role="alert">{issue}</p>
      :aftercare?<CrmEnrollmentSupport key={authorizationKey} lang={lang} isLight={isLight} embedded refreshVersion={requestVersion} onRefreshingChange={setLoading}/>
      :<>
        {!classDetail&&issue&&<p role="alert">{issue}</p>}
        {!classDetail&&!result&&!issue&&<p role="status">{loadingLabel}</p>}
        {!id&&classes&&<section className="crm-enrollment-class-list" ref={classResults}>
          <div className="crm-opportunity-filters">
            {classFilterControl}
          </div>
          {visibleClasses.length?<div className="crm-opportunity-table"><table>
            <thead><tr>{([
              ['班次与课表','Class and schedule','Kelas dan jadwal'],['状态','Status','Status'],['足额到账／开班门槛','Fully paid / minimum','Lunas / minimum'],
              ['占席／上限','Reserved / capacity','Terisi / kapasitas'],['可报名余位','Available seats','Kursi tersedia'],['候补','Waitlist','Daftar tunggu'],
            ] as Copy[]).map(copy=><th key={copy[1]} scope="col">{t(copy)}</th>)}</tr></thead>
            <tbody>{visibleClasses.map(row=><tr key={row.id} data-class-id={row.id}>
              <td><a className="crm-work-link" href={classDetailPath(row.id)} onClick={()=>rememberClass(row.id)}>{listClassTitle(row)}</a><div className="crm-work-muted">{row.schedule}</div></td>
              <td>{listStateLabel(row)}</td><td>{row.counts.paid} / {row.minimumPaid}</td><td>{row.occupied} / {row.capacity}</td><td>{available(row)}</td><td>{row.counts.waiting}</td>
            </tr>)}</tbody>
          </table></div>:<p>{t(['暂无符合条件的班次。','No classes match.','Tidak ada kelas yang sesuai.'])}</p>}
        </section>}
        {classDetail&&<div className="crm-enrollment-detail-shell crm-detail-root" data-theme={isLight?'light':'dark'}
          data-record-detail="true" data-record-scroll={independent?'independent':'page'} data-sidebar={independent&&sidebarOpen}
          style={{'--crm-shell-height':shellHeight+'px'} as React.CSSProperties}>
          <CrmRecordNavigation label={t(['班次导航','Class navigation','Navigasi kelas'])}
            back={{label:t(['返回班次列表','Back to classes','Kembali ke daftar kelas']),href:list+classFilterQuery+'&resumeClassList=1'}}
            tools={allowed&&<CrmRecordSidebarToggle controls="crm-class-records" expanded={sidebarOpen}
              label={sidebarOpen?t(['收起班次侧栏','Hide class sidebar','Sembunyikan daftar kelas']):
                t(['展开班次侧栏','Show class sidebar','Tampilkan daftar kelas'])}
              onClick={()=>setSidebarPreference(!sidebarOpen)}/>}/>
          <CrmRecordSidebar id="crm-class-records" title={t(['班次','Classes','Kelas'])} hidden={!sidebarOpen||!allowed}
            count={classes?matchedClasses.length:undefined} selectedId={matchedClasses.some(row=>row.id===id)?id??undefined:undefined}
            busy={sidebarLoading} busyLabel={loadingLabel}
            note={classes&&cohort&&!matchedClasses.some(row=>row.id===id)?t([
              '当前班次不在筛选结果中，名单仍保持打开。','The current class is outside these filters. Its roster stays open.',
              'Kelas saat ini di luar filter. Daftar siswanya tetap terbuka.',
            ]):undefined}
            empty={!classes?<p className="crm-record-sidebar-message" role={sidebarFailed?'alert':'status'}>
              {sidebarFailed?t(['暂时无法读取班次列表。','Could not load classes.','Daftar kelas tidak dapat dimuat.']):loadingLabel}</p>:
              !matchedClasses.length?<p className="crm-record-sidebar-message">{noMatches}</p>:undefined}
            filters={<CrmRecordFilters lang={lang} count={Number(Boolean(classFilter))+Number(Boolean(search))}
              search={<CrmRecordSearch label={searchLabel} placeholder={t(['级别、日期或课表','Level, date or schedule','Level, tanggal atau jadwal'])}
                value={sidebarSearch} onChange={setSidebarSearch}/>}>
              {classFilterControl}
            </CrmRecordFilters>}>
            {matchedClasses.map(row=>{
              const path=classDetailPath(row.id);
              return <CrmRecordRow key={row.id} selected={row.id===id} name={classTitle(row)}
                title={classTitle(row)+' · '+firstLesson(row)} href={path} onClick={event=>{
                  if(event.altKey||event.metaKey||event.shiftKey||event.ctrlKey)return;
                  event.preventDefault();
                  if(row.id!==id)navigate(path);
                  if(!independent)setSidebarPreference(false);
                }} meta={<>{statusBadge(row)}<small>{firstLesson(row)}</small></>}/>;
            })}
          </CrmRecordSidebar>
          <div className="crm-detail-panel crm-enrollment-detail-panel" hidden={!independent&&sidebarOpen}>
            <header className="crm-detail-header">
              <CrmRecordTitle title={cohort?classTitle(cohort):t(['班次详情','Class details','Detail kelas'])}
                status={cohort&&statusBadge(cohort)} meta={cohort&&[firstLesson(cohort),cohort.schedule].filter(Boolean).join(' · ')}/>
              {canRefresh&&<CrmDetailActions label={t(['班次操作','Class actions','Tindakan kelas'])} secondary={<>
                {scope.operations&&cohort&&<CrmPageAction icon={Settings} label={t(['班次设置','Class settings','Pengaturan kelas'])}
                  href={'/crm?tab=policy&policyTopic=enrollment-classes&enrollmentClass='+encodeURIComponent(cohort.id)}/>}
                <CrmPageAction icon={RefreshCw} label={refreshLabel} loading={loading} onClick={()=>setRequestVersion(v=>v+1)}/>
              </>}/>}
            </header>
            {cohort&&<div className="crm-panel-next">
              <dl className="crm-enrollment-detail-summary">
                {cohort.status!=='cancelled'&&<div><dt>{t(['开班进度','Class opening','Status pembukaan'])}</dt>
                  <dd>{enrollmentProgress(cohort)}</dd></div>}
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
              {filter==='history'&&<div className="crm-opportunity-filters"><CrmSingleSelect lang={lang} isLight={isLight} label={t(['关闭原因','Closure reason','Alasan penutupan'])} value={closure} onChange={setClosure}
                options={[{value:'',label:t(['全部原因','All reasons','Semua alasan'])},...Object.entries(closeReasons).map(([value,copy])=>({value,label:t(copy)}))]}/></div>}
              {rows?.length?<div className="crm-opportunity-table crm-enrollment-table" ref={rosterTable}><table>
                <thead><tr>{([
                  ['学员','Learner','Siswa'],['报名状态','Enrollment status','Status pendaftaran'],['应付／已核实','Due / verified','Tagihan / terverifikasi'],
                  ['截止时间','Deadline','Tenggat'],['操作','Actions','Tindakan'],
                ] as Copy[]).map(copy=><th key={copy[1]} scope="col">{t(copy)}</th>)}</tr></thead>
                <tbody>{rows.map(row=><tr key={row.status+row.id}>
                  <td><strong>{row.name||t(['未记录姓名','Name not recorded','Nama belum dicatat'])}</strong>
                    {row.customerId&&<div className="crm-work-muted">{owner(row)}</div>}
                    {row.email&&<div>{row.email}</div>}{row.phone&&<div>{row.phone}</div>}</td>
                  <td>{t(row.closureReason?closeReasons[row.closureReason]:actual[row.actualStatus]??groups[row.status])}</td>
                  <td>{row.price===undefined?'—':formatCurrency(row.price,lang)+' / '+formatCurrency(row.received??0,lang)}</td>
                  <td>{row.dueAt&&['awaiting_payment','held'].includes(row.status)?formatCrmEventTime(row.dueAt):'—'}</td>
                  <td><div className="crm-enrollment-row-actions">
                    {row.customerId&&<a className="crm-work-link" href={'/crm?tab=leads&lead='+encodeURIComponent(row.customerId)}>{t(['客户','Customer','Pelanggan'])}</a>}
                    {row.opportunityId&&<a className="crm-work-link" href={'/crm?tab=opportunities&opportunity='+encodeURIComponent(row.opportunityId)}>{t(['商机','Opportunity','Peluang'])}</a>}
                    {row.canVerify&&<a className="crm-work-link" id={'roster-verify-'+row.id} href={financePath(row.id)} onClick={()=>rememberRoster(row.id)}>{t(['核对到账','Verify payment','Verifikasi pembayaran'])}</a>}
                  </div></td>
                </tr>)}</tbody>
              </table></div>:<p className="crm-enrollment-empty">{t(['当前筛选下没有可查看的学员记录。','No visible learner records match this filter.','Tidak ada catatan siswa yang dapat dilihat untuk filter ini.'])}</p>}
              </section>}
          </div>
          </div>
        </div>}
      </>}
  </section>;
}
