import {lazy,Suspense,useEffect,useRef,useState,type RefObject} from 'react';
import {ArrowLeft,Eye,Pencil,Plus} from 'lucide-react';
import {AdminPageHeader} from '../admin/AdminPageHeader';
import {AdminPageAction} from '../admin/AdminPageAction';
import {AdminRefreshAction} from '../admin/AdminRefreshAction';
import {AdminListState,AdminListTable} from '../admin/AdminList';
import {AdminFormFeedback} from '../AdminFormLayout';
import {AdminStatus} from '../AdminStatus';
import {dashboardKpiKeys,dashboardKpiShiftMonth,type DashboardKpiEditorPlan,type DashboardKpiKey,
  type DashboardKpiList,type DashboardKpiListRow} from '../../utils/crmOperationsDashboard';
import {formatCrmEventTime} from '../../utils/crmOperatingTime';
import type {CrmLanguage} from '../../utils/crmLanguage';
import {dashboardKpiMetricLabels,dashboardLabel} from './crmOperationsDashboardText';
import type {DashboardKpiEditorMode} from './CrmDashboardKpiSettings';

const PlanEditor=lazy(()=>import('./CrmDashboardKpiSettings').then(module=>({default:module.CrmDashboardKpiSettings})));
const words={
  back:['Back to operating overview','Kembali ke ringkasan operasi','返回经营总览'],
  month:['Plan month','Bulan rencana','计划月份'],
  state:['Status','Status','状态'],
  current:['Current month','Bulan ini','本月'],
  next:['Next month','Bulan depan','下月'],
  past:['Past month','Bulan sebelumnya','往月'],
  updated:['Last modified','Terakhir diubah','最近修改'],
  action:['Actions','Tindakan','操作'],
  edit:['Edit','Edit','编辑'],
  view:['View','Lihat','查看'],
  empty:['No monthly plans yet.','Belum ada rencana bulanan.','暂无月度目标。'],
  monthsPlanned:['Plans for this month and next month are already in the list.',
    'Rencana bulan ini dan bulan depan sudah ada di daftar.','本月和下月的计划均已列出。'],
  saved:['Plan saved. The wallboard reads it on its next successful refresh.',
    'Rencana tersimpan. Layar TV membacanya pada penyegaran berikutnya.','计划已保存，电视大屏将在下次成功刷新时读取。'],
  nextSaved:['Plan saved for next month. It takes effect at the start of that WIB month.',
    'Rencana bulan depan tersimpan dan berlaku pada awal bulan WIB tersebut.','下月计划已保存，将在所选月份的 WIB 月初生效。'],
} as const;
const locales={zh:'zh-CN',en:'en-GB',id:'id-ID'};
type Editor={mode:DashboardKpiEditorMode;month:string;creationMonths:readonly string[]};
type LoadStatus='loading'|'error'|'denied'|'ready';

export function CrmDashboardKpiList({lang,isLight,allowed,headingRef,onBack}:{
  lang:CrmLanguage;isLight:boolean;allowed:boolean;headingRef:RefObject<HTMLHeadingElement|null>;onBack:()=>void;
}){
  const t=(key:keyof typeof words)=>words[key][lang==='zh'?2:lang==='id'?1:0];
  const [data,setData]=useState<DashboardKpiList|null>(null);
  const [status,setStatus]=useState<LoadStatus>('loading');
  const [revision,setRevision]=useState(0);
  const [editor,setEditor]=useState<Editor|null>(null);
  const [notice,setNotice]=useState<'saved'|'nextSaved'|null>(null);
  const viewport=useRef<HTMLDivElement>(null);
  const focusMonth=useRef<string|null>(null);
  const refresh=()=>setRevision(value=>value+1);

  useEffect(()=>{
    if(!allowed)return;
    const controller=new AbortController();
    setStatus('loading');
    fetch('/api/crm/operations-dashboard/kpi',{cache:'no-store',signal:controller.signal}).then(async response=>{
      if(controller.signal.aborted)return;
      if(response.status===401||response.status===403){
        setData(null);setEditor(null);setStatus('denied');return;
      }
      if(!response.ok)throw Error('Unable to load monthly KPI plans');
      const list=await response.json() as DashboardKpiList;
      if(controller.signal.aborted)return;
      setData(list);setStatus('ready');
    }).catch(()=>{if(!controller.signal.aborted)setStatus('error');});
    return ()=>controller.abort();
  },[allowed,revision]);
  useEffect(()=>{
    if(!focusMonth.current)return;
    const action=viewport.current?.querySelector<HTMLElement>('[data-kpi-month="'+focusMonth.current+'"]');
    action?.focus({preventScroll:true});
    focusMonth.current=null;
  },[data]);

  const title=dashboardLabel(lang,'kpiPlans');
  const monthFormatter=new Intl.DateTimeFormat(locales[lang],{timeZone:'Asia/Jakarta',year:'numeric',month:'long'});
  const number=new Intl.NumberFormat(locales[lang]);
  const percentage=new Intl.NumberFormat(locales[lang],{style:'percent',maximumFractionDigits:2});
  const label=(month:string)=>monthFormatter.format(new Date(month+'-01T00:00:00Z'));
  const metric=(key:DashboardKpiKey)=>dashboardLabel(lang,dashboardKpiMetricLabels[key]);
  const savedMonths=new Set(data?.plans.map(plan=>plan.month));
  const available=data?[data.currentMonth,dashboardKpiShiftMonth(data.currentMonth,1)].filter(month=>!savedMonths.has(month)):[];
  const keys=dashboardKpiKeys.filter(key=>data?.finance||key!=='net');
  function target(key:DashboardKpiKey,value:number|undefined){
    if(value===undefined)return '—';
    return key==='paymentRate'?percentage.format(value):(key==='net'?'Rp ':'')+number.format(value);
  }
  function open(entry:Editor){
    setNotice(null);setEditor(entry);
  }
  function close(){
    setEditor(null);
    if(editor?.mode==='create')refresh();
  }
  function onSaved(plan:DashboardKpiEditorPlan){
    const {month,targets,updatedAt,updatedBy}=plan;
    const item:DashboardKpiListRow={month,targets,updatedAt,updatedBy};
    focusMonth.current=month;
    setData(prior=>({currentMonth:plan.currentMonth,finance:plan.finance,
      plans:[item,...(prior?.plans??[]).filter(other=>other.month!==month)].sort((a,b)=>b.month.localeCompare(a.month))}));
    setNotice(month===plan.currentMonth?'saved':'nextSaved');
    setEditor(null);
  }

  return <>
    <AdminPageHeader title={title} headingRef={headingRef} subtitle={allowed&&data&&!available.length?t('monthsPlanned'):'WIB'}
      actions={<>
        <AdminPageAction label={t('back')} icon={ArrowLeft} onClick={onBack}/>
        {allowed&&<AdminRefreshAction label={dashboardLabel(lang,'refresh')} loading={status==='loading'} onClick={refresh}/>}
        {allowed&&data&&<AdminPageAction label={dashboardLabel(lang,'kpiCreate')} icon={Plus} variant="primary"
          aria-haspopup="dialog" disabled={!available.length||status==='loading'} onClick={()=>{
            if(available[0])open({mode:'create',month:available[0],creationMonths:available});
          }}/>}
      </>}/>
    {!allowed||status==='denied'?<AdminListState lang={lang} state="denied"/>:<>
      {notice&&<AdminFormFeedback lang={lang} state="saved">{t(notice)}</AdminFormFeedback>}
      {status==='error'&&<AdminListState lang={lang} state="error" onRetry={refresh}/>}
      {status==='loading'&&!data&&<AdminListState lang={lang} state="loading"/>}
      {status==='ready'&&!data?.plans.length&&<AdminListState lang={lang} state="empty" message={t('empty')}/>}
      {data&&data.plans.length>0&&<AdminListTable label={title} viewportRef={viewport} busy={status==='loading'}
        headers={[{label:t('month'),sort:'descending'},t('state'),...keys.map(key=>({label:metric(key),numeric:true})),t('updated'),t('action')]}>
        {data.plans.map(row=>{
          const past=row.month<data.currentMonth,current=row.month===data.currentMonth;
          const action=t(past?'view':'edit');
          return <tr key={row.month}>
            <th scope="row">{label(row.month)}</th>
            <td><AdminStatus tone={current?'success':past?'neutral':'info'}>{t(current?'current':past?'past':'next')}</AdminStatus></td>
            {keys.map(key=><td key={key} className="crm-list-number">{target(key,row.targets[key])}</td>)}
            <td>{row.updatedAt?<time dateTime={row.updatedAt}>{formatCrmEventTime(row.updatedAt).slice(0,16)}</time>:'—'}
              {row.updatedBy&&<small className="ops-dash-subvalue block">{row.updatedBy}</small>}</td>
            <td><button type="button" className="admin-list-control ops-dash-kpi-row-action"
              data-kpi-month={row.month} aria-label={action+' '+label(row.month)} aria-haspopup="dialog"
              onClick={()=>open({mode:past?'view':'edit',month:row.month,creationMonths:[]})}>
              {past?<Eye size={14} aria-hidden="true"/>:<Pencil size={14} aria-hidden="true"/>}{action}
            </button></td>
          </tr>;
        })}
      </AdminListTable>}
      {editor&&<Suspense fallback={<AdminListState lang={lang} state="loading" compact/>}>
        <PlanEditor key={editor.mode+editor.month} lang={lang} isLight={isLight} mode={editor.mode}
          initialMonth={editor.month} creationMonths={editor.creationMonths} onClose={close} onSaved={onSaved}/>
      </Suspense>}
    </>}
  </>;
}
