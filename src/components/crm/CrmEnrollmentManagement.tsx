import type { EnrollmentClosureReason } from '../../utils/enrollmentOrderStatus';
import { useEffect, useState } from 'react';
import { enrollmentCopy } from '../EnrollmentApplication';
import { formatCrmEventTime } from '../../utils/crmOperatingTime';
import { formatCurrency } from '../../utils/currency';
import type { CrmLanguage } from '../../utils/crmLanguage';
import type { AccessEmployee } from '../../utils/accessControl';
import { canViewEnrollmentManagement, enrollmentManagementScopes, enrollmentClassManagementPath, enrollmentRosterStates,
  type EnrollmentClassSummary, type EnrollmentRosterEntry, type EnrollmentRosterState } from '../../utils/crmEnrollmentManagement';
import { CrmEnrollmentSupport } from './CrmEnrollmentResolution';
import { CrmSingleSelect } from './CrmSingleSelect';
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
  const params=new URLSearchParams(window.location.search);
  const id=params.get('classId');
  const allowed=canViewEnrollmentManagement(employee);
  const scope=enrollmentManagementScopes(employee);
  const authorizationKey=JSON.stringify([employee.id,employee.permissions,employee.grants,employee.scope,employee.active]);
  const [loaded,setLoaded]=useState<{data:Result;key:string}>();
  const result=allowed&&loaded?.key===authorizationKey?loaded.data:undefined;
  const [requestVersion,setRequestVersion]=useState(0);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const [filter,setFilter]=useState<EnrollmentRosterState|''>('');
  const [closure,setClosure]=useState('');
  const [classFilter,setClassFilter]=useState(()=>params.get('classStatus')??'');
  const classFilterQuery=classFilter?'&classStatus='+encodeURIComponent(classFilter):'';
  const changeClassFilter=(status:string)=>{
    setClassFilter(status);
    const url=new URL(window.location.href);
    if(status)url.searchParams.set('classStatus',status);
    else url.searchParams.delete('classStatus');
    window.history.replaceState(window.history.state,'',url);
  };
  useEffect(()=>{
    setLoaded(undefined);setFilter('');setClosure('');
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
  const classes=result&&'classes' in result?result.classes:undefined;
  const rows=result&&'rows' in result&&cohort?result.rows.filter(row=>(!filter||row.status===filter)&&(filter!=='history'||!closure||row.closureReason===closure)):undefined;
  const title=t(['报名管理','Enrollment management','Pengelolaan pendaftaran']);
  const classTitle=(row:EnrollmentClassSummary)=>row.level+' · '+t(row.format==='standard'
    ?['标准班','Standard class','Kelas standar']:['小班','Small group','Kelompok kecil'])+' · '+formatCrmEventTime(row.firstLessonAt);
  const stateLabel=(row:EnrollmentClassSummary)=>t(statuses[row.status])+(row.status==='opened'&&!row.accepting
    ?' · '+t(['自助报名截止','Enrollment closed','Pendaftaran ditutup']):'');
  const owner=(row:EnrollmentRosterEntry)=>row.customerId
    ?(row.owner?employees.find(employee=>employee.id===row.owner)?.displayName??row.owner:t(['未分配','Unassigned','Belum ditugaskan'])):'—';
  const available=(row:EnrollmentClassSummary)=>row.accepting?row.available:'—';

  return <section className="crm-enrollment-management" aria-busy={!aftercare&&loading}>
    {id&&!aftercare&&<a className="crm-work-link" href={list+classFilterQuery}>{t(['← 返回班次列表','← Back to classes','← Kembali ke daftar kelas'])}</a>}
    <header className="admin-page-toolbar crm-enrollment-heading">
      <h1>{cohort?classTitle(cohort):title}</h1>
      {!aftercare&&allowed&&<div className="crm-ops-actions">
        {scope.operations&&cohort&&<a className="crm-work-link" href={'/crm?tab=policy&policyTopic=enrollment-classes&enrollmentClass='+encodeURIComponent(cohort.id)}>{t(['班次设置','Class settings','Pengaturan kelas'])}</a>}
        <button type="button" className="crm-work-button" disabled={loading} onClick={()=>setRequestVersion(v=>v+1)}>{t(['刷新','Refresh','Segarkan'])}</button>
      </div>}
    </header>
    {!id&&allowed&&canSupport&&<nav className="crm-enrollment-views" aria-label={title}>
      <a className="crm-work-link" href={list} aria-current={!aftercare?'page':undefined}>{t(['按班次','By class','Per kelas'])}</a>
      <a className="crm-work-link" href={aftercarePath} aria-current={aftercare?'page':undefined}>{t(['报名售后','Enrollment support','Layanan pendaftaran'])}</a>
    </nav>}
    {!allowed||(aftercare&&!canSupport)||error==='403'||error==='401'
      ?<p role="alert">{t(['无权查看报名管理。','You do not have access to enrollment management.','Anda tidak memiliki akses ke pengelolaan pendaftaran.'])}</p>
      :aftercare?<CrmEnrollmentSupport lang={lang} isLight={isLight} embedded/>
      :<>
        {error&&<p role="alert">{error==='404'?t(['班次不存在或当前账号无权查看。','The class is unavailable or you cannot view it.','Kelas tidak tersedia atau tidak dapat Anda lihat.'])
          :t(['暂时无法读取，请刷新后重试。','Could not load enrollments. Refresh to retry.','Pendaftaran gagal dimuat. Segarkan dan coba lagi.'])}</p>}
        {!result&&!error&&<p role="status">{t(['正在加载…','Loading…','Memuat…'])}</p>}
        {!id&&classes&&<>
          <div className="crm-opportunity-filters">
            <CrmSingleSelect lang={lang} isLight={isLight} label={t(['班次状态','Class status','Status kelas'])} value={classFilter} onChange={changeClassFilter}
              options={[{value:'',label:t(['全部班次','All classes','Semua kelas'])},...Object.entries(statuses).map(([value,copy])=>({value,label:t(copy)}))]}/>
          </div>
          {classes.some(row=>!classFilter||row.status===classFilter)?<div className="crm-opportunity-table"><table>
            <thead><tr>{([
              ['班次与课表','Class and schedule','Kelas dan jadwal'],['状态','Status','Status'],['足额到账／开班门槛','Fully paid / minimum','Lunas / minimum'],
              ['占席／上限','Reserved / capacity','Terisi / kapasitas'],['可报名余位','Available seats','Kursi tersedia'],['候补','Waitlist','Daftar tunggu'],
            ] as Copy[]).map(copy=><th key={copy[1]} scope="col">{t(copy)}</th>)}</tr></thead>
            <tbody>{classes.filter(row=>!classFilter||row.status===classFilter).map(row=><tr key={row.id}>
              <td><a className="crm-work-link" href={enrollmentClassManagementPath(row.id)+classFilterQuery}>{classTitle(row)}</a><div className="crm-work-muted">{row.schedule}</div></td>
              <td>{stateLabel(row)}</td><td>{row.counts.paid} / {row.minimumPaid}</td><td>{row.occupied} / {row.capacity}</td><td>{available(row)}</td><td>{row.counts.waiting}</td>
            </tr>)}</tbody>
          </table></div>:<p>{t(['暂无符合条件的班次。','No classes match.','Tidak ada kelas yang sesuai.'])}</p>}
        </>}
        {cohort&&<>
          <div className="crm-enrollment-summary">
            <p>{stateLabel(cohort)}{cohort.schedule?' · '+cohort.schedule:''}</p>
            <dl>
              <div><dt>{t(['足额到账／开班门槛','Fully paid / opening minimum','Lunas / minimum pembukaan'])}</dt><dd>{cohort.counts.paid} / {cohort.minimumPaid}</dd>
                {cohort.status!=='opened'&&cohort.status!=='cancelled'&&<small>{t(['距开班差','Still needed to open','Masih diperlukan'])} {Math.max(0,cohort.minimumPaid-cohort.counts.paid)} {t(['人','learners','siswa'])}</small>}</div>
              <div><dt>{t(['已占席／招生上限','Reserved / capacity','Terisi / kapasitas'])}</dt><dd>{cohort.occupied} / {cohort.capacity}</dd></div>
              <div><dt>{t(['可报名余位','Available seats','Kursi tersedia'])}</dt><dd>{available(cohort)}</dd></div>
            </dl>
          </div>
          <div className="crm-enrollment-conditions" aria-label={t(['按报名状态筛选','Filter by enrollment status','Filter menurut status'])}>
            <button type="button" className="crm-work-button" aria-pressed={!filter} onClick={()=>setFilter('')}>{t(['全部记录','All records','Semua catatan'])}</button>
            {enrollmentRosterStates.map(state=><button key={state} type="button" className="crm-work-button" aria-pressed={filter===state} onClick={()=>setFilter(state)}>
              {t(groups[state])} <strong>{cohort.counts[state]}</strong>
            </button>)}
          </div>
          {filter==='history'&&<div className="crm-opportunity-filters"><CrmSingleSelect lang={lang} isLight={isLight} label={t(['关闭原因','Closure reason','Alasan penutupan'])} value={closure} onChange={setClosure}
            options={[{value:'',label:t(['全部原因','All reasons','Semua alasan'])},...Object.entries(closeReasons).map(([value,copy])=>({value,label:t(copy)}))]}/></div>}
          <h2>{t(['学员名单','Learner roster','Daftar siswa'])}</h2>
          <p className="crm-work-muted">{t(['上方数字是全班总数。下方只显示当前账号有权查看的记录。','Totals cover the whole class. The roster shows records you have access to.','Angka di atas mencakup seluruh kelas. Daftar hanya menampilkan catatan yang dapat Anda akses.'])}</p>
          {rows?.length?<div className="crm-opportunity-table"><table>
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
                {row.canVerify&&<a className="crm-work-link" href={'/crm?tab=payments&enrollmentOrder='+encodeURIComponent(row.id)}>{t(['核对到账','Verify payment','Verifikasi pembayaran'])}</a>}
              </div></td>
            </tr>)}</tbody>
          </table></div>:<p>{t(['当前筛选下没有可查看的学员记录。','No visible learner records match this filter.','Tidak ada catatan siswa yang dapat dilihat untuk filter ini.'])}</p>}
        </>}
      </>}
  </section>;
}
