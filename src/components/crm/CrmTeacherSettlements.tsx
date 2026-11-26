import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {Pencil,Plus,Users} from 'lucide-react';
import {AdminField,AdminForm} from '../AdminForm';
import {AdminFormFeedback,AdminFormGrid,AdminFormSection,AdminFormSummary,AdminStaticField} from '../AdminFormLayout';
import {AdminDiscardDialog} from '../admin/AdminDiscardDialog';
import {AdminListState,AdminListTable} from '../admin/AdminList';
import {AdminOperationLayer} from '../admin/AdminOperationLayer';
import {AdminPageAction} from '../admin/AdminPageAction';
import {AdminSearchField} from '../admin/AdminSearchField';
import {AdminSingleSelect} from '../admin/AdminSingleSelect';
import {dashboardDate,type DashboardFilters} from '../../utils/crmOperationsDashboard';
import {formatCurrency} from '../../utils/currency';
import {enrollmentClassTitle,enrollmentPrivateLessonTitle} from '../../utils/enrollmentCatalog';
import type {CrmLanguage} from '../../utils/crmLanguage';
import {facultyAmount,facultyDateValid} from '../../utils/crmFaculty';
import {summarizeTeacherSettlements,teacherSettlementCost,teacherSettlementLineAmount,teacherSettlementMonth,type TeacherSettlement,type TeacherSettlementDraft,
  type TeacherRateQuote,type TeacherSettlementKind,type TeacherSettlementTarget} from '../../utils/crmTeacherSettlements';

const endpoint='/api/crm/operations-dashboard/teacher-settlements';
const copy={
  title:['教师结算','Teacher settlements','Penyelesaian biaya pengajar'],
  faculty:['教师档案','Faculty directory','Direktori pengajar'],
  basis:['按 WIB 结算月汇总财务核定应付，独立于看板日期筛选。','Finance-approved amounts by settlement month (WIB), independent of the dashboard date filter.','Nilai disetujui tim keuangan per bulan penyelesaian (WIB), terpisah dari filter tanggal dasbor.'],
  month:['结算月份','Settlement month','Bulan penyelesaian'],
  view:['查看','View','Lihat'],
  add:['登记结算','Record settlement','Catat penyelesaian'],
  edit:['更正','Correct','Koreksi'],
  actions:['操作','Actions','Tindakan'],
  editTitle:['更正教师结算','Correct teacher settlement','Koreksi penyelesaian biaya pengajar'],
  number:['结算单号','Settlement number','Nomor penyelesaian'],
  total:['核定应付','Approved payable','Utang disetujui'],
  ordinary:['普通班','Group class','Kelas grup'],
  private:['一对一约课','One-to-one booking','Pemesanan privat'],
  type:['关联类型','Record type','Jenis catatan'],
  target:['班次或约课','Class or booking','Kelas atau pemesanan'],
  search:['按编号或教师查找','Search by reference or teacher','Cari berdasarkan nomor atau pengajar'],
  choose:['选择班次或约课','Select a class or booking','Pilih kelas atau pemesanan'],
  emptyTargets:['未找到符合条件的班次或已确认约课。','No matching classes or confirmed bookings.','Tidak ada kelas atau pemesanan terkonfirmasi yang cocok.'],
  noRecords:['该结算月暂无登记。','No settlements recorded for this month.','Belum ada catatan pada bulan ini.'],
  teacher:['班次教师','Assigned teacher','Pengajar kelas'],
  lessons:['核定课时数','Approved lesson count','Jumlah sesi disetujui'],
  duration:['每节时长','Lesson length','Durasi per sesi'],
  rate:['教师课时费（IDR／课时）','Teacher fee (IDR per lesson)','Honor pengajar (IDR per sesi)'],
  feeHelp:['一节课计一个课时。','Each lesson counts as one billable unit.','Setiap sesi dihitung sebagai satu satuan biaya.'],
  manualRate:['此历史班次尚未关联教师档案，按本次财务核定费率登记。','This historical class has no linked faculty profile. Enter the fee approved for this settlement.','Kelas lama ini belum terhubung ke profil pengajar. Masukkan honor yang disetujui untuk penyelesaian ini.'],
  starts:['授课起日（WIB）','Service starts (WIB)','Mulai mengajar (WIB)'],
  ends:['授课止日（WIB）','Service ends (WIB)','Selesai mengajar (WIB)'],
  original:['档案生效课时费','Applicable profile fee','Tarif profil yang berlaku'],
  fx:['核定折算总额（IDR）','Approved converted total (IDR)','Total konversi disetujui (IDR)'],
  fxBasis:['折算依据','Conversion basis','Dasar konversi'],
  pendingAllocation:['月薪待分摊','Monthly salary allocation pending','Alokasi gaji bulanan tertunda'],
  missingRate:['所选期间没有费率，请先到教师档案维护。','No rate applies to this period. Set it in the faculty profile.','Tarif untuk periode ini belum ada. Atur di profil pengajar.'],
  splitRate:['所选期间跨费率，请按调价日拆成两条不重叠的明细。','The rate changes in this period. Split it into non-overlapping lines at the rate change.','Tarif berganti pada periode ini. Pisahkan menjadi rincian yang tidak tumpang tindih.'],
  rateChanged:['费率已更新，请重新选择授课日期以核对最新费率。','The rate changed. Select the dates again to review the latest rate.','Tarif telah berubah. Pilih ulang tanggal untuk meninjau tarif terbaru.'],
  rateLoad:['正在读取适用费率…','Loading the applicable rate…','Memuat tarif yang berlaku…'],
  rateError:['费率读取失败，请重新选择授课日期。','Could not load the rate. Select the service dates again.','Tarif gagal dimuat. Pilih ulang tanggal mengajar.'],
  line:['班次明细','Class entry','Rincian kelas'],
  addLine:['新增明细','Add line','Tambah rincian'],
  removeLine:['移除明细','Remove line','Hapus rincian'],
  amount:['班次成本','Class cost','Biaya kelas'],
  reason:['更正原因','Correction reason','Alasan koreksi'],
  save:['保存','Save','Simpan'],
  cancel:['取消','Cancel','Batal'],
  saved:['教师结算已保存。','Teacher settlement saved.','Penyelesaian biaya pengajar tersimpan.'],
  invalid:['请核对结算单号、月份、课时数和教师课时费。单号可使用字母、数字及 . / _ -。','Check the settlement number, month, lesson count and fee per lesson. Use letters, digits or . / _ - in the number.','Periksa nomor penyelesaian, bulan, jumlah sesi, dan honor per sesi. Gunakan huruf, angka, atau . / _ - pada nomor.'],
  duplicate:['该结算单号已存在。请在原结算月份找到记录并更正。','This number already exists. Find the record in its settlement month and correct it there.','Nomor ini sudah ada. Buka catatan pada bulan penyelesaian awal untuk mengoreksinya.'],
  linesDuplicate:['同一班次或约课的授课期间不能重叠。未关联教师档案的历史班次只能登记一条。','Service periods for the same class or booking cannot overlap. Historical classes without faculty have one line.','Periode mengajar untuk kelas atau pemesanan yang sama tidak boleh tumpang tindih. Kelas lama tanpa profil hanya satu rincian.'],
  teacherMissing:['请先在班次或约课中指派教师。','Assign a teacher in the class or booking first.','Tetapkan pengajar pada kelas atau pemesanan terlebih dahulu.'],
  conflict:['记录已有新版本。请关闭后重新打开最新记录，再核对并更正。','A newer revision exists. Close and reopen the latest record before correcting it.','Versi terbaru tersedia. Tutup dan buka kembali catatan terbaru sebelum mengoreksi.'],
  targetGone:['关联的班次或约课已不可用，请重新选择。','The class or booking is no longer available. Select another record.','Kelas atau pemesanan tidak tersedia. Pilih catatan lain.'],
  unknown:['保存结果未确认。可用当前内容重试，结算单号和版本会防止重复登记。','Save result unknown. Retry the same details. The settlement number and revision prevent duplicates.','Hasil belum pasti. Coba kembali dengan isian yang sama. Nomor dan versi mencegah duplikasi.'],
  retry:['重试保存','Retry save','Coba simpan lagi'],
} as const;
const word=(lang:CrmLanguage,key:keyof typeof copy)=>copy[key][lang==='zh'?0:lang==='id'?2:1];

function targetTitle(target:TeacherSettlementTarget,lang:CrmLanguage){
  const title=target.kind==='class'?enrollmentClassTitle(target,lang):enrollmentPrivateLessonTitle(target.level,lang);
  return [title,target.firstLesson].filter(Boolean).join(' · ');
}

export function CrmTeacherSettlements({lang,isLight,asOf,refresh,filter,onFaculty}:{
  lang:CrmLanguage;isLight:boolean;asOf:string;refresh:number;filter:Pick<DashboardFilters,'format'|'level'>;onFaculty:()=>void;
}){
  const t=(key:keyof typeof copy)=>word(lang,key);
  const [month,setMonth]=useState(()=>dashboardDate(Date.parse(asOf)).slice(0,7));
  const [selectedMonth,setSelectedMonth]=useState(month);
  const [records,setRecords]=useState<TeacherSettlement[]|null>(null);
  const [status,setStatus]=useState<'loading'|'error'|'denied'|'ready'>('loading');
  const [reload,setReload]=useState(0);
  const [editor,setEditor]=useState<TeacherSettlement|null|undefined>(undefined);
  const [saved,setSaved]=useState(false);
  const list=useRef<HTMLDivElement>(null);
  const focusNumber=useRef('');
  const {level,format}=filter;
  const visible=records?.map(record=>({...record,lines:record.lines.filter(({target})=>
    (!level||target.level===level)&&(!format||target.format===format))})).filter(record=>record.lines.length);
  const totals=visible?.length?summarizeTeacherSettlements(visible):null;
  const money=(amount:number)=>formatCurrency(amount,lang);
  const loadLatest=()=>setReload(value=>value+1);

  useEffect(()=>{
    const controller=new AbortController();
    setRecords(null);setStatus('loading');
    fetch(endpoint+'?month='+selectedMonth,{cache:'no-store',signal:controller.signal}).then(async response=>{
      if(controller.signal.aborted)return;
      if(response.status===401||response.status===403){setStatus('denied');setEditor(undefined);return;}
      if(!response.ok)throw Error();
      const data=await response.json() as {records:TeacherSettlement[]};
      if(!controller.signal.aborted){setRecords(data.records);setStatus('ready');}
    }).catch(()=>{if(!controller.signal.aborted)setStatus('error');});
    return ()=>controller.abort();
  },[selectedMonth,reload,refresh]);

  useEffect(()=>{
    if(!records||!focusNumber.current)return;
    const buttons=Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[data-settlement-number]')??[]);
    buttons.find(button=>button.dataset.settlementNumber===focusNumber.current)?.focus({preventScroll:true});
    focusNumber.current='';
  },[records]);

  return <section className="ops-dash-panel">
    <header><h2>{t('title')}</h2>
      {status==='ready'&&<div className="admin-form-actions">
        <AdminPageAction label={t('faculty')} icon={Users} onClick={onFaculty}/>
        <AdminPageAction label={t('add')} icon={Plus} variant="primary" aria-haspopup="dialog"
          onClick={()=>{setSaved(false);setEditor(null);}}/>
      </div>}</header>
    <p>{t('basis')}</p>
    <form className="ops-dash-filters" onSubmit={event=>{
      event.preventDefault();
      if(teacherSettlementMonth.test(month)){setSaved(false);setSelectedMonth(month);}
    }}>
      <AdminField required>{t('month')} · WIB
        <input className="admin-text-input" aria-label={t('month')} type="month" value={month} onChange={event=>setMonth(event.target.value)}/>
      </AdminField>
      <button type="submit" className="crm-work-button" disabled={!teacherSettlementMonth.test(month)||month===selectedMonth}>{t('view')}</button>
    </form>
    {saved&&<AdminFormFeedback state="saved" lang={lang}>{t('saved')}</AdminFormFeedback>}
    {status!=='ready'?<AdminListState lang={lang} state={status} onRetry={loadLatest}/>:!visible?.length?
      <AdminListState lang={lang} state="empty" message={t('noRecords')}/>:<>
      {totals&&<AdminFormSummary fields={[[t('total'),money(totals.IDR)],[t('ordinary'),money(totals.class)],
        [t('private'),money(totals.appointment)],[t('lessons'),new Intl.NumberFormat(lang).format(totals.lessons)],
        ...(totals.pending?[[t('pendingAllocation'),totals.pending] as const]:[])]}/>}
      <AdminListTable key={selectedMonth} viewportRef={list} label={t('title')}
        headers={[t('number'),t('target'),t('teacher'),{label:t('lessons'),numeric:true},{label:t('rate'),numeric:true},
          {label:t('amount'),numeric:true},t('actions')]}>
        {visible.flatMap(record=>record.lines.map((line,index)=><tr key={record.number+':'+index}>
          {index===0&&<th rowSpan={record.lines.length}>{record.number}</th>}
          <td>{targetTitle(line.target,lang)}{line.service&&<div>{line.service.from}–{line.service.to}</div>}</td><td>{line.target.teacher}</td>
          <td className="crm-list-number">{line.lessons}</td>
          <td className="crm-list-number">{line.rate?.kind==='monthly'?'—':line.rate?.kind==='lesson'
            ?line.rate.currency+' '+facultyAmount(line.rate.amountMinor,line.rate.currency):money(line.lessonFee)}</td>
          <td className="crm-list-number">{line.rate?.kind==='monthly'?t('pendingAllocation'):money(teacherSettlementLineAmount(line)??0)}</td>
          {index===0&&<td rowSpan={record.lines.length}>
            <button className="crm-work-link" type="button" aria-haspopup="dialog" data-settlement-number={record.number}
              onClick={()=>{setSaved(false);setEditor(records?.find(row=>row.number===record.number));}}><Pencil size={14}/> {t('edit')}</button>
          </td>}
        </tr>))}
      </AdminListTable>
    </>}
    {editor!==undefined&&<SettlementEditor lang={lang} isLight={isLight} record={editor} month={selectedMonth}
      onDenied={()=>{setRecords(null);setStatus('denied');setEditor(undefined);}}
      onClose={()=>setEditor(undefined)}
      onConflictClose={()=>{setEditor(undefined);loadLatest();}}
      onSaved={record=>{
        setEditor(undefined);setSaved(true);focusNumber.current=record.number;
        setMonth(record.month);setSelectedMonth(record.month);loadLatest();
      }}/>}
  </section>;
}

type LineDraft={id:number;kind:TeacherSettlementKind;target:TeacherSettlementTarget|null;lessons:string;lessonFee:string;
  from:string;to:string;convertedIDR:string;basis:string;quote:TeacherRateQuote|null;quoteError:boolean;};
const blankLine=(id:number):LineDraft=>({id,kind:'class',target:null,lessons:'',lessonFee:'',from:'',to:'',convertedIDR:'',basis:'',quote:null,quoteError:false});
type Issue='invalid'|'duplicate'|'linesDuplicate'|'teacherMissing'|'conflict'|'targetGone'|'unknown'|'missingRate'|'splitRate'|'rateChanged';
const serverIssues:Record<string,Issue>={
  teacher_settlement_duplicate:'duplicate',teacher_settlement_lines_duplicate:'linesDuplicate',
  teacher_settlement_conflict:'conflict',teacher_settlement_target:'targetGone',
  teacher_settlement_teacher_missing:'teacherMissing',
  teacher_settlement_rate_required:'missingRate',teacher_settlement_rate_missing:'missingRate',
  teacher_settlement_rate_split:'splitRate',teacher_settlement_rate_changed:'rateChanged',
};

function SettlementEditor({lang,isLight,record,month:initialMonth,onClose,onConflictClose,onDenied,onSaved}:{
  lang:CrmLanguage;isLight:boolean;record:TeacherSettlement|null;month:string;onClose:()=>void;onConflictClose:()=>void;
  onDenied:()=>void;onSaved:(record:TeacherSettlement)=>void;
}){
  const t=(key:keyof typeof copy)=>word(lang,key);
  const formId=useId();
  const [number,setNumber]=useState(record?.number??'');
  const [month,setMonth]=useState(record?.month??initialMonth);
  const [reason,setReason]=useState('');
  const [lines,setLines]=useState<LineDraft[]>(()=>record?.lines.map((line,id)=>({...blankLine(id),target:line.target,kind:line.target.kind,
    lessons:String(line.lessons),lessonFee:String(line.lessonFee),from:line.service?.from??'',to:line.service?.to??'',
    convertedIDR:line.service?.convertedIDR?.toString()??'',basis:line.service?.basis??'',quote:line.rate??null}))??[blankLine(0)]);
  const nextId=useRef(lines.length);
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState(false);
  const pending=useRef(false);
  const [discard,setDiscard]=useState(false);
  const [issue,setIssue]=useState<Issue|null>(null);
  const locked=busy||issue==='unknown'||issue==='conflict';
  function change(action:()=>void){
    setDirty(true);setIssue(null);action();
  }
  function close(){
    if(busy)return;
    if(dirty)setDiscard(true);
    else onClose();
  }
  async function save(event:FormEvent){
    event.preventDefault();
    if(pending.current||issue==='conflict')return;
    const submitted:TeacherSettlementDraft['lines']=[];
    for(const line of lines){
      const common={kind:line.kind,referenceId:line.target?.referenceId??'',lessons:Number(line.lessons)};
      if(!line.target?.teacherId){submitted.push({...common,lessonFee:Number(line.lessonFee)});continue;}
      const quote=line.quote;
      if(quote?.kind!=='lesson'&&quote?.kind!=='monthly'){setIssue(quote?.kind==='split'?'splitRate':'missingRate');return;}
      submitted.push({...common,lessonFee:0,service:{from:line.from,to:line.to,rateRevision:quote.revision,
        ...(quote.kind==='lesson'&&quote.currency==='CNY'?{convertedIDR:Number(line.convertedIDR),basis:line.basis}:{})}});
    }
    const body:TeacherSettlementDraft={number,month,reason,revision:record?.revision??null,lines:submitted};
    pending.current=true;setBusy(true);
    try{
      const response=await fetch(endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(response.ok){onSaved(await response.json());return;}
      if(response.status===401||response.status===403){onDenied();return;}
      const {error}=await response.json().catch(()=>({}));
      setIssue(response.status>=500?'unknown':Object.hasOwn(serverIssues,error)?serverIssues[error]:'invalid');
    }catch{setIssue('unknown');}
    finally{pending.current=false;setBusy(false);}
  }
  return <AdminOperationLayer title={t(record?'editTitle':'add')} lang={lang} isLight={isLight} busy={busy} onClose={close}
    footer={<>
      <button type="button" className="crm-work-link" disabled={busy} onClick={close}>{t('cancel')}</button>
      <button type="submit" className="crm-work-button" form={formId} disabled={busy||issue==='conflict'||!dirty}>
        {t(issue==='unknown'?'retry':'save')}</button>
    </>}>
    <AdminForm id={formId} lang={lang} onSubmit={save}>
      <AdminFormGrid>
        <AdminField required>{t('number')}<input className="admin-text-input" required value={number} maxLength={64}
          readOnly={Boolean(record)} disabled={locked} onChange={event=>change(()=>setNumber(event.target.value))}/></AdminField>
        <AdminField required>{t('month')} · WIB<input className="admin-text-input" type="month" required value={month}
          disabled={locked} onChange={event=>change(()=>setMonth(event.target.value))}/></AdminField>
      </AdminFormGrid>
      {lines.map((line,index)=><AdminFormSection key={line.id} title={t('line')+' '+(index+1)} variant="subgroup"
        actions={lines.length>1&&<button type="button" className="crm-work-link" disabled={locked}
          onClick={()=>change(()=>setLines(lines.filter(item=>item.id!==line.id)))}>{t('removeLine')}</button>}>
        <SettlementLine line={line} lang={lang} isLight={isLight} disabled={locked}
          onQuote={patch=>setLines(rows=>rows.map(item=>item.id===line.id&&item.target?.referenceId===line.target?.referenceId&&
            item.from===line.from&&item.to===line.to?{...item,...patch}:item))}
          onChange={patch=>change(()=>setLines(rows=>rows.map(item=>item.id===line.id?{...item,...patch}:item)))}/>
      </AdminFormSection>)}
      <button type="button" className="crm-work-link" disabled={locked||lines.length>=50}
        onClick={()=>change(()=>setLines([...lines,blankLine(nextId.current++)]))}>{t('addLine')}</button>
      {record&&<AdminField required>{t('reason')}<textarea className="admin-text-input" required value={reason} maxLength={500}
        disabled={locked} onChange={event=>change(()=>setReason(event.target.value))}/></AdminField>}
      {busy&&<AdminFormFeedback state="saving" lang={lang}/>}
      {issue&&<AdminFormFeedback state={issue==='unknown'||issue==='conflict'?'unknown':'error'} lang={lang}>{t(issue)}</AdminFormFeedback>}
    </AdminForm>
    {discard&&<AdminDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)}
      onDiscard={issue==='conflict'?onConflictClose:onClose}/>}
  </AdminOperationLayer>;
}

function SettlementLine({line,lang,isLight,disabled,onChange,onQuote}:{
  line:LineDraft;lang:CrmLanguage;isLight:boolean;disabled:boolean;onChange:(patch:Partial<LineDraft>)=>void;
  onQuote:(patch:Partial<LineDraft>)=>void;
}){
  const t=(key:keyof typeof copy)=>word(lang,key);
  const [search,setSearch]=useState('');
  const [targets,setTargets]=useState<TeacherSettlementTarget[]>([]);
  const [status,setStatus]=useState<'loading'|'error'|'ready'>('loading');
  const [reload,setReload]=useState(0);
  const quoteHandler=useRef(onQuote);
  quoteHandler.current=onQuote;
  useEffect(()=>{
    const controller=new AbortController();
    setTargets([]);setStatus('loading');
    const timer=setTimeout(()=>{
      const params=new URLSearchParams({kind:line.kind,search:search.trim()});
      fetch(endpoint+'/targets?'+params,{signal:controller.signal,cache:'no-store'}).then(async response=>{
        if(!response.ok)throw Error();
        const matches=await response.json() as TeacherSettlementTarget[];
        if(!controller.signal.aborted){setTargets(matches);setStatus('ready');}
      }).catch(()=>{if(!controller.signal.aborted)setStatus('error');});
    },200);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[line.kind,search,reload]);
  const {from,to,quote,quoteError}=line;
  const registered=Boolean(line.target?.teacherId),referenceId=line.target?.referenceId;
  const serviceDates=facultyDateValid(from)&&facultyDateValid(to)&&from<=to;
  useEffect(()=>{
    if(!registered||!referenceId||!serviceDates||quote||quoteError)return;
    const controller=new AbortController();
    const params=new URLSearchParams({kind:line.kind,id:referenceId,from,to});
    fetch(endpoint+'/rate?'+params,{signal:controller.signal,cache:'no-store'}).then(async response=>{
      if(!response.ok)throw Error();
      const result=await response.json() as TeacherRateQuote;
      if(!controller.signal.aborted)quoteHandler.current({quote:result});
    }).catch(()=>{if(!controller.signal.aborted)quoteHandler.current({quoteError:true});});
    return ()=>controller.abort();
  },[registered,referenceId,line.kind,from,to,serviceDates,quote,quoteError]);
  const options=line.target&&!targets.some(target=>target.referenceId===line.target?.referenceId)?[line.target,...targets]:targets;
  const foreignRate=quote?.kind==='lesson'&&quote.currency==='CNY';
  const amount=registered?quote?.kind==='lesson'?
    foreignRate?Number(line.convertedIDR):teacherSettlementCost(Number(line.lessons),quote.amountMinor):0:
    teacherSettlementCost(Number(line.lessons),Number(line.lessonFee));
  const duration=line.target?.minutes?new Intl.NumberFormat(lang,{style:'unit',unit:'minute'}).format(line.target.minutes):null;
  return <>
    <AdminFormGrid>
      <AdminField as="div"><label>{t('type')}</label>
        <AdminSingleSelect label={t('type')} value={line.kind} disabled={disabled} lang={lang} isLight={isLight}
          options={[{value:'class',label:t('ordinary')},{value:'appointment',label:t('private')}]}
          onChange={value=>{if(value!==line.kind){setSearch('');onChange({...blankLine(line.id),kind:value as TeacherSettlementKind});}}}/>
      </AdminField>
      <AdminField as="div"><label>{t('search')}</label>
        <AdminSearchField label={t('search')} value={search} onChange={setSearch} maxLength={100} disabled={disabled}/>
      </AdminField>
      <AdminField as="div" required><label>{t('target')}</label>
        <AdminSingleSelect label={t('target')} value={line.target?.referenceId??''} disabled={disabled} lang={lang} isLight={isLight}
          emptyLabel={t('choose')} options={options.map(target=>({value:target.referenceId,label:targetTitle(target,lang),
            description:[target.teacher,target.referenceId].filter(Boolean).join(' · ')}))}
          onChange={value=>{const target=options.find(option=>option.referenceId===value);
            if(target)onChange({...blankLine(line.id),kind:line.kind,target});}}/>
        {status!=='ready'?<AdminListState compact lang={lang} state={status} onRetry={()=>setReload(value=>value+1)}/>:
          !options.length&&<p>{t('emptyTargets')}</p>}
      </AdminField>
      <AdminStaticField label={t('teacher')} value={line.target?.teacher}/>
      {line.target&&!line.target.teacher&&<AdminFormFeedback state="error" lang={lang}>{t('teacherMissing')}</AdminFormFeedback>}
      {duration&&<AdminStaticField label={t('duration')} value={duration}/>}
      <AdminField required>{t('lessons')}<input className="admin-text-input" required type="number" min={1} max={10000} step={1}
        inputMode="numeric" value={line.lessons} disabled={disabled} onChange={event=>onChange({lessons:event.target.value})}/></AdminField>
      {registered?<>
        <AdminField required>{t('starts')}<input className="admin-text-input" type="date" required disabled={disabled} value={from}
          onChange={event=>onChange({from:event.target.value,quote:null,quoteError:false,convertedIDR:'',basis:''})}/></AdminField>
        <AdminField required>{t('ends')}<input className="admin-text-input" type="date" required disabled={disabled} value={to}
          onChange={event=>onChange({to:event.target.value,quote:null,quoteError:false,convertedIDR:'',basis:''})}/></AdminField>
        {serviceDates&&!quote&&<p role="status">{t(quoteError?'rateError':'rateLoad')}</p>}
        {quote?.kind==='missing'&&<p role="alert">{t('missingRate')}</p>}
        {quote?.kind==='split'&&<p role="alert">{t('splitRate')}</p>}
        {quote?.kind==='monthly'&&<p role="status">{t('pendingAllocation')}</p>}
        {quote?.kind==='lesson'&&<AdminStaticField label={t('original')} value={quote.currency+' '+facultyAmount(quote.amountMinor,quote.currency)}/>}
        {foreignRate&&<>
          <AdminField required>{t('fx')}<input className="admin-text-input" required type="number" min={1} max={1000000000000} step={1}
            disabled={disabled} value={line.convertedIDR} onChange={event=>onChange({convertedIDR:event.target.value})}/></AdminField>
          <AdminField required>{t('fxBasis')}<input className="admin-text-input" required maxLength={500}
            disabled={disabled} value={line.basis} onChange={event=>onChange({basis:event.target.value})}/></AdminField>
        </>}
      </>:<AdminField required>{t('rate')}<input className="admin-text-input" required type="number" min={1} max={100000000} step={1}
        inputMode="numeric" value={line.lessonFee} disabled={disabled} onChange={event=>onChange({lessonFee:event.target.value})}/>
        <small className="crm-work-muted">{t(line.target?'manualRate':'feeHelp')}</small></AdminField>}
    </AdminFormGrid>
    <AdminFormSummary fields={[[t('amount'),amount>0?formatCurrency(amount,lang):'—']]}/>
  </>;
}
