import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {AdminForm,AdminField,AdminFieldLabel} from '../AdminForm';
import {AdminFormFeedback,AdminFormGrid,AdminFormSection} from '../AdminFormLayout';
import {AdminDiscardDialog} from '../admin/AdminDiscardDialog';
import {AdminOperationLayer} from '../admin/AdminOperationLayer';
import {AdminSingleSelect} from '../admin/AdminSingleSelect';
import {dashboardKpiKeys,dashboardKpiShiftMonth,
  type DashboardKpiEditorPlan,type DashboardKpiKey,type DashboardKpiValues} from '../../utils/crmOperationsDashboard';
import {formatCrmEventTime} from '../../utils/crmOperatingTime';
import type {CrmLanguage} from '../../utils/crmLanguage';
import {dashboardKpiMetricLabels,dashboardLabel} from './crmOperationsDashboardText';
import './crm-dashboard-kpi.css';

const words={
  month:['Plan month','Bulan rencana','计划月份'],
  targets:['Monthly targets','Target bulanan','月目标'],
  months:['Dates use Jakarta time (WIB).','Tanggal menggunakan waktu Jakarta (WIB).','计划按雅加达时间 WIB。'],
  empty:['No plan has been set for this month.','Belum ada rencana untuk bulan ini.','该月尚未设置计划。'],
  monthExists:['This month already has a plan. Return to the list to edit it.',
    'Bulan ini sudah memiliki rencana. Kembali ke daftar untuk mengeditnya.','该月份已有计划，请返回列表编辑。'],
  readonly:['Past months are read-only.','Bulan sebelumnya hanya dapat dilihat.','往月计划仅可查看。'],
  next:['This plan takes effect at the start of the selected WIB month.',
    'Rencana berlaku pada awal bulan terpilih menurut WIB.','计划于所选月份的 WIB 月初自动生效。'],
  revision:['Version','Versi','版本'],
  revised:['Last modified','Terakhir diubah','最近修改'],
  cancel:['Cancel','Batal','取消'],
  close:['Close','Tutup','关闭'],
  save:['Save plan','Simpan rencana','保存计划'],
  retry:['Retry','Coba lagi','重试'],
  latest:['Check latest version','Periksa versi terakhir','核对最新版本'],
  outcome:['Check save result','Periksa hasil simpan','查询保存结果'],
  loadError:['The plan could not be loaded.','Rencana tidak dapat dimuat.','计划读取失败。'],
  invalid:['Enter positive whole numbers for totals, and 0–100% for the payment rate.',
    'Masukkan bilangan bulat positif untuk jumlah, dan 0–100% untuk tingkat pembayaran.',
    '金额、人数、人次的月目标须为正整数，付款率须为 0–100%。'],
  needTarget:['Enter at least one monthly target.','Masukkan minimal satu target bulanan.','请填写至少一项月目标。'],
  conflict:['Another editor saved this month. Your draft is retained. Review the latest values before continuing.',
    'Editor lain menyimpan bulan ini. Draf Anda tetap ada. Tinjau nilai terbaru sebelum melanjutkan.',
    '该月已被其他编辑者修改，你的草稿已保留。请先核对最新值。'],
  compare:['Latest saved plan','Rencana tersimpan terakhir','最新已保存计划'],
  rebase:['Keep my draft after review','Pertahankan draf setelah peninjauan','核对后保留我的草稿'],
  rebaseHelp:['The next save replaces the editable values with your draft.',
    'Penyimpanan berikutnya mengganti nilai yang dapat diedit dengan draf Anda.','再次保存会使用你的草稿替换当前可编辑的值。'],
  loadLatest:['Use latest values','Gunakan nilai terbaru','使用最新值'],
  noChange:['No newer save was found. You can check again or save the retained draft.',
    'Simpanan baru belum ditemukan. Periksa kembali atau simpan draf.','未查到新的保存版本。可再次核对或保存保留的草稿。'],
  readonlyError:['This month is now read-only.','Bulan ini sekarang hanya dapat dilihat.','该月现已转为只读。'],
} as const;

const locale={zh:'zh-CN',en:'en-GB',id:'id-ID'};
const tIndex={en:0,id:1,zh:2} as const;
type Draft={targets:Partial<Record<DashboardKpiKey,string>>};
type Status='loading'|'loadError'|'denied'|'idle'|'error'|'unknown'|'conflict';
type Validation='invalid'|'needTarget';
const allowedKeys=(plan:DashboardKpiEditorPlan)=>dashboardKpiKeys.filter(key=>plan.finance||key!=='net');
const fromPlan=(plan:DashboardKpiEditorPlan,lang:CrmLanguage):Draft=>({
  targets:Object.fromEntries(allowedKeys(plan).flatMap(key=>{
    const value=plan.targets[key];
    return value===undefined?[]:[[key,key==='paymentRate'?String(Math.round(value*10_000)/100):
      key==='net'?new Intl.NumberFormat(locale[lang]).format(value):String(value)]];
  })),
});

function amountOf(raw:string,key:DashboardKpiKey){
  if(key==='paymentRate')return /^\d{1,3}(?:[.,]\d{1,2})?$/u.test(raw)?Number(raw.replace(',','.'))/100:NaN;
  if(/^\d+$/u.test(raw))return Number(raw);
  if(key==='net'&&/^\d{1,3}([.,])\d{3}(?:\1\d{3})*$/u.test(raw))return Number(raw.replace(/[.,]/gu,''));
  return NaN;
}
function draftValues(draft:Draft):{values:DashboardKpiValues;issue?:never}|{issue:Validation;values?:never}{
  const targets:DashboardKpiValues['targets']={};
  for(const key of dashboardKpiKeys){
    const raw=draft.targets[key]?.trim();
    if(!raw)continue;
    const amount=amountOf(raw,key);
    if(key==='paymentRate'?!(amount>=0&&amount<=1):!Number.isSafeInteger(amount)||amount<=0)return {issue:'invalid'};
    targets[key]=amount;
  }
  return {values:{targets}};
}
function planSignature(plan:DashboardKpiValues){
  return JSON.stringify(dashboardKpiKeys.map(key=>plan.targets[key]));
}
const endpoint=(month:string)=>'/api/crm/operations-dashboard/kpi/'+encodeURIComponent(month);
async function readPlan(month:string,signal?:AbortSignal){
  const response=await fetch(endpoint(month),{cache:'no-store',signal});
  if(!response.ok)throw Object.assign(Error('read failed'),{status:response.status});
  return await response.json() as DashboardKpiEditorPlan;
}

export type DashboardKpiEditorMode='create'|'edit'|'view';

export function CrmDashboardKpiSettings({lang,isLight,mode,initialMonth,creationMonths,onClose,onSaved}:{
  lang:CrmLanguage;isLight:boolean;mode:DashboardKpiEditorMode;initialMonth:string;creationMonths:readonly string[];
  onClose:()=>void;onSaved:(plan:DashboardKpiEditorPlan)=>void;
}){
  const t=(key:keyof typeof words)=>words[key][tIndex[lang]],number=new Intl.NumberFormat(locale[lang]);
  const formatMonth=new Intl.DateTimeFormat(locale[lang],{timeZone:'Asia/Jakarta',year:'numeric',month:'long'});
  const [month,setMonth]=useState(initialMonth);
  const [plan,setPlan]=useState<DashboardKpiEditorPlan|null>(null);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [latest,setLatest]=useState<DashboardKpiEditorPlan|null>(null);
  const [status,setStatus]=useState<Status>('loading');
  const [busy,setBusy]=useState(false),operation=useRef(false);
  const pending=useRef<DashboardKpiValues|null>(null);
  const [validation,setValidation]=useState<Validation|null>(null);
  const [readOnlyError,setReadOnlyError]=useState(false);
  const [retry,setRetry]=useState(0);
  const [discard,setDiscard]=useState<string|null>(null);
  const formId=useId();
  const selected=plan?.month===month?plan:null;
  const monthExists=mode==='create'&&Boolean(selected?.revision);
  const canEdit=Boolean(selected&&mode!=='view'&&!monthExists&&!selected.readOnly&&!readOnlyError);
  const dirty=Boolean(selected&&draft&&JSON.stringify(draft)!==JSON.stringify(fromPlan(selected,lang)));
  const keys=selected?allowedKeys(selected):[];
  const metric=(key:DashboardKpiKey)=>dashboardLabel(lang,dashboardKpiMetricLabels[key]);
  const unit=(key:DashboardKpiKey)=>key==='net'?'Rp':key==='paymentRate'?'%':
    dashboardLabel(lang,key==='paid'?'tvEnrollmentUnit':'tvLearnerUnit');
  const formatted=(key:DashboardKpiKey,value:number|undefined)=>value===undefined?'—':
    key==='paymentRate'?number.format(value*100)+'%':key==='net'?'Rp '+number.format(value):number.format(value)+' '+unit(key);
  const monthLabel=(value:string)=>formatMonth.format(new Date(value+'-01T00:00:00Z'));
  const monthOptions=creationMonths.map(value=>({value,label:monthLabel(value)}));

  function adopt(value:DashboardKpiEditorPlan){
    setPlan(value);setDraft(fromPlan(value,lang));setLatest(null);setStatus('idle');setValidation(null);setReadOnlyError(false);
    pending.current=null;
  }
  function deny(){
    setPlan(null);setDraft(null);setLatest(null);setStatus('denied');pending.current=null;
  }
  useEffect(()=>{
    const controller=new AbortController();
    setStatus('loading');
    readPlan(month,controller.signal).then(value=>{
      if(!controller.signal.aborted)adopt(value);
    }).catch(error=>{
      if(controller.signal.aborted)return;
      if(error.status===401||error.status===403)deny();
      else setStatus('loadError');
    });
    return ()=>controller.abort();
  },[month,retry]);
  useEffect(()=>{
    if(!dirty)return;
    const confirm=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',confirm);
    return ()=>window.removeEventListener('beforeunload',confirm);
  },[dirty]);

  function requestExit(destination:string){
    if(operation.current)return;
    if(dirty||pending.current)setDiscard(destination);
    else if(destination==='close')onClose();
    else setMonth(destination);
  }
  function discardChanges(){
    const destination=discard;
    setDiscard(null);pending.current=null;
    if(destination==='close')onClose();
    else if(destination==='latest'&&latest)adopt(latest);
    else if(destination)setMonth(destination);
  }
  function change(nextDraft:Draft){
    setDraft(nextDraft);setValidation(null);
    if(status==='error')setStatus('idle');
  }
  function normalizeMoney(raw:string,update:(formattedValue:string)=>void){
    const value=amountOf(raw.trim(),'net');
    if(Number.isSafeInteger(value)&&value>=0)update(number.format(value));
  }
  async function checkLatest(reason:'unknown'|'conflict'){
    try{
      const observed=await readPlan(month);
      if(observed.finance!==selected?.finance){adopt(observed);return;}
      if(reason==='unknown'&&pending.current&&planSignature(observed)===planSignature(pending.current)){
        onSaved(observed);return;
      }
      if(reason==='unknown'&&observed.revision===selected?.revision){
        pending.current=null;setStatus('error');return;
      }
      pending.current=null;setLatest(observed);setStatus('conflict');
    }catch(error){
      if((error as {status?:number}).status===401||(error as {status?:number}).status===403)deny();
    }
  }
  async function run(work:()=>Promise<void>){
    if(operation.current)return;
    operation.current=true;setBusy(true);
    try{await work();}
    finally{operation.current=false;setBusy(false);}
  }
  async function save(){
    if(!selected||!draft||!canEdit||!dirty||status==='unknown'||status==='conflict')return;
    const result=draftValues(draft);
    const values=result.values;
    if(!values){setValidation(result.issue);return;}
    if(mode==='create'&&!Object.keys(values.targets).length){setValidation('needTarget');return;}
    await run(async()=>{
      setValidation(null);setStatus('idle');pending.current=values;
      try{
        const response=await fetch(endpoint(month),{method:'PUT',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({...values,revision:selected.revision})});
        if(response.ok){onSaved(await response.json());return;}
        if(response.status===409){pending.current=null;setStatus('conflict');await checkLatest('conflict');return;}
        const error=await response.json().catch(()=>({}));
        if(error.error==='dashboard_kpi_readonly'){pending.current=null;setReadOnlyError(true);setStatus('error');return;}
        if(response.status===401||response.status===403){deny();return;}
        if(response.status<500){
          pending.current=null;
          setValidation('invalid');
          return;
        }
      }catch{ /* Re-read before allowing any retry. */ }
      setStatus('unknown');
    });
  }

  const editable=canEdit&&!busy&&status!=='unknown'&&status!=='conflict';
  const input=(raw:string,key:DashboardKpiKey,label:string,update:(value:string)=>void)=>(
    <input aria-label={label} className="admin-text-input" inputMode={key==='paymentRate'?'decimal':'numeric'}
      disabled={!editable} value={raw} maxLength={28}
      onChange={event=>update(event.target.value)}
      onBlur={key==='net'?()=>normalizeMoney(raw,update):undefined}/>
  );

  const title=dashboardLabel(lang,mode==='create'?'kpiCreate':mode==='edit'?'kpiEdit':'kpiView');
  return <AdminOperationLayer lang={lang} isLight={isLight} title={title} context={t('months')}
    className="crm-dashboard-kpi" busy={busy} onClose={()=>requestExit('close')}
    footer={<>
      <button type="button" className="crm-work-link" onClick={()=>requestExit('close')} disabled={busy}>{canEdit?t('cancel'):t('close')}</button>
      {canEdit&&<button type="submit" form={formId} className="crm-work-button"
        disabled={!editable||!dirty}>{t('save')}</button>}
    </>}>
    <AdminForm id={formId} className="crm-dashboard-kpi-form" lang={lang} onSubmit={(event:FormEvent)=>{event.preventDefault();void save();}}>
      <div className="crm-kpi-month">
        {mode==='create'&&monthOptions.length>1?<>
          <AdminFieldLabel>{t('month')}</AdminFieldLabel>
          <AdminSingleSelect label={t('month')} value={month} options={monthOptions}
            onChange={value=>{if(value!==month)requestExit(value);}}
            lang={lang} isLight={isLight} disabled={busy||status==='loading'}/>
        </>:<strong>{monthLabel(month)} · WIB</strong>}
        {selected?.readOnly&&<p>{t('readonly')}</p>}
        {selected&&month===dashboardKpiShiftMonth(selected.currentMonth,1)&&<p>{t('next')}</p>}
        {selected?.updatedAt&&<p>{t('revised')} · <time dateTime={selected.updatedAt}>{formatCrmEventTime(selected.updatedAt).slice(0,16)}</time>{selected.updatedBy&&' · '+selected.updatedBy}
          {selected.revision&&<> · {t('revision')} {selected.revision.slice(0,8)}</>}</p>}
        {selected&&!selected.revision&&mode!=='create'&&<p>{t('empty')}</p>}
      </div>
      {status==='loading'&&<p role="status">{dashboardLabel(lang,'load')}</p>}
      {status==='denied'&&<AdminFormFeedback state="error" lang={lang}>{dashboardLabel(lang,'denied')}</AdminFormFeedback>}
      {status==='loadError'&&<div><AdminFormFeedback state="error" lang={lang}>{t('loadError')}</AdminFormFeedback>
        <button type="button" className="crm-work-link" onClick={()=>setRetry(value=>value+1)}>{t('retry')}</button></div>}
      {monthExists&&<AdminFormFeedback state="unknown" lang={lang}>{t('monthExists')}</AdminFormFeedback>}
      {selected&&draft&&!monthExists&&<AdminFormSection title={t('targets')}>
          <AdminFormGrid>
            {keys.map(key=><AdminField key={key}>{metric(key)} · {unit(key)}
              {input(draft.targets[key]??'',key,metric(key),value=>change({...draft,targets:{...draft.targets,[key]:value}}))}
            </AdminField>)}
          </AdminFormGrid>
      </AdminFormSection>}
      <div className="crm-kpi-feedback">
        {busy&&<AdminFormFeedback state="saving" lang={lang}/>}
        {validation&&<AdminFormFeedback state="error" lang={lang}>{t(validation)}</AdminFormFeedback>}
        {status==='error'&&<AdminFormFeedback state="error" lang={lang}>{t(readOnlyError?'readonlyError':'noChange')}</AdminFormFeedback>}
        {status==='unknown'&&<>
          <AdminFormFeedback state="unknown" lang={lang}/>
          <button type="button" className="crm-work-link" disabled={busy} onClick={()=>void run(()=>checkLatest('unknown'))}>{t('outcome')}</button>
        </>}
        {status==='conflict'&&<>
          <AdminFormFeedback state="unknown" lang={lang}>{t(mode==='create'&&latest?.revision?'monthExists':'conflict')}</AdminFormFeedback>
          {latest?<AdminFormSection title={t('compare')} description={mode==='create'?undefined:t('rebaseHelp')}>
            <dl className="crm-kpi-latest">{keys.map(key=><div key={key}><dt>{metric(key)}</dt><dd>{formatted(key,latest.targets[key])}</dd></div>)}</dl>
            {mode!=='create'&&<div className="crm-kpi-review-actions">
              <button type="button" className="crm-work-link" disabled={busy} onClick={()=>setDiscard('latest')}>{t('loadLatest')}</button>
              <button type="button" className="crm-work-button" disabled={busy} onClick={()=>{
                setPlan(latest);setLatest(null);setStatus('idle');setReadOnlyError(false);
              }}>{t('rebase')}</button>
            </div>}
          </AdminFormSection>:<button type="button" className="crm-work-link" disabled={busy}
            onClick={()=>void run(()=>checkLatest('conflict'))}>{t('latest')}</button>}
        </>}
      </div>
    </AdminForm>
    {discard&&<AdminDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(null)}
      onDiscard={discardChanges}/>}
  </AdminOperationLayer>;
}
