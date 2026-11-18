import {Plus,X} from 'lucide-react';
import {AdminCalendarPicker, type AdminCalendarDayMark} from '../admin/AdminCalendarPicker';
import {previewEnrollmentClassSchedule} from '../../utils/enrollmentClassSchedule';
import {AdminSecondaryActions} from '../admin/AdminRecordActions';
import {AdminConfirmation} from '../admin/AdminConfirmation';
import {AdminDisclosure} from '../admin/AdminDisclosure';
import {EnrollmentSettingsListSummary,EnrollmentSettingsSelect,useEnrollmentSettingsFilters,type EnrollmentListCopy} from './EnrollmentSettingsListControls';
import {CrmEnrollmentTemplates} from './CrmEnrollmentTemplates';
import {enrollmentTemplateClassFields,type EnrollmentTeachingCourse,type EnrollmentTemplate} from '../../utils/enrollmentTemplates';
import {EnrollmentLearnerPreview} from './EnrollmentLearnerPreview';
import {AdminRefreshAction} from '../admin/AdminRefreshAction';
import {AdminEditor} from '../admin/AdminEditor';
import {CrmPageAction} from './CrmPageAction';
import {AdminListState,AdminListTable} from '../admin/AdminList';
import {AdminSearchField} from '../admin/AdminSearchField';
import {AdminStatus} from '../AdminStatus';
import {AdminRowAction} from '../admin/AdminListControl';
import { compareEnrollmentClassStarts,enrollmentClassDateFilter,enrollmentClassManagementPath } from '../../utils/crmEnrollmentManagement';
import {formatCrmEventTime} from '../../utils/crmOperatingTime';
import { useEffect, useId, useRef, useState } from 'react';
import { AdminField, AdminFieldLabel, AdminForm, AdminRequiredNote } from '../AdminForm';
import { AdminStaticField, AdminFormActions, AdminFormFeedback, AdminFormGrid, AdminFormSection, AdminFormSummary } from '../AdminFormLayout';
import { CrmOperationLayer } from './CrmOperationLayer';
import { CrmDiscardDialog, CrmSaveFeedback } from './CrmDetailWorkspace';
import { CrmSingleSelect, type CrmChoice } from './CrmSingleSelect';
import { enrollmentAutofillStart,enrollmentScheduleErrors,enrollmentSessionStart,enrollmentClassTitle,enrollmentTeacherLabel,enrollmentInstant,enrollmentLevels,enrollmentPeriods,enrollmentScheduleDefaults,enrollmentWeekdays,enrollmentWeeklyScheduleText,type EnrollmentScheduleReviewField,type EnrollmentWeeklySchedule } from '../../utils/enrollmentCatalog';
import type { EnrollmentClassAdmin, EnrollmentClassConfig } from '../../utils/enrollmentCatalog';
import { validEnrollmentHolidayDate } from '../../utils/enrollmentCatalog';
import type { CrmLanguage } from '../../utils/crmLanguage';
import { formatCurrency } from '../../utils/currency';
import { enrollmentPost } from '../EnrollmentApplication';

type Copy = readonly [string, string, string];

function EnrollmentHolidayDates({config, previewOnly, disabled, lang, t, onChange, review}:{
  config:ClassDraftConfig; previewOnly:boolean; disabled:boolean; lang:CrmLanguage;
  t:(text:Copy)=>string; onChange:(dates:string[])=>void; review?:React.ReactNode;
}) {
  const [proposedDates,setProposedDates]=useState<string[]>();
  const dates=proposedDates??config.holidayDates??[];
  const changeDates=previewOnly?setProposedDates:onChange;
  const firstDate=config.firstLesson.split('T')[0];
  const plan=previewEnrollmentClassSchedule(config,dates);
  const classDay:AdminCalendarDayMark={tone:'info',label:t(['Class','Kelas','上课日'])};
  const holiday:AdminCalendarDayMark={tone:'warning',label:t(['Class break','Libur kelas','停课日'])};
  const makeup:AdminCalendarDayMark={tone:'success',label:t(['Makeup session','Kelas pengganti','补排日'])};
  const marks=(selection:readonly string[])=>{
    const schedule=previewEnrollmentClassSchedule(config,selection);
    const result=new Map<string,AdminCalendarDayMark>();
    for(const {date} of schedule?.meetings??[])result.set(date,classDay);
    for(const date of schedule?.skippedDates??[])result.set(date,holiday);
    for(const date of schedule?.makeupDates??[])result.set(date,makeup);
    return result;
  };
  const endLabel=t(['Estimated end date','Perkiraan tanggal selesai','预计结课']);
  const label = t(['Class break dates', 'Tanggal libur kelas', '停课日期']);
  const trigger = t(['View and select dates','Lihat dan pilih tanggal','查看并选择日期']);
  const count = t([`${dates.length} selected`,`${dates.length} tanggal dipilih`,`已选 ${dates.length} 天`]);
  return <AdminField as="div" data-admin-full-width="">
    <span className="admin-field-label">{label}{dates.length>0&&` · ${count}`}</span>
    {previewOnly&&<small>{t(['This class has orders. Break date changes are for preview only.',
      'Kelas ini memiliki pesanan. Perubahan tanggal libur hanya untuk pratinjau.','此班次已有订单，停课日期变更仅供预览。'])}</small>}
    {review}
    <AdminCalendarPicker multiple value={dates} onChange={changeDates} label={label} placeholder={trigger}
      lang={lang} anchorDate={validEnrollmentHolidayDate(firstDate)?firstDate:undefined} disabled={disabled}
      dayMarks={marks} legend={[classDay,holiday,makeup]} selectionPreview={selection=>{
        const candidate=previewEnrollmentClassSchedule(config,selection);
        if(!candidate)return null;
        return <>{endLabel} <strong>{candidate.end}</strong></>;
      }}/>
    {dates.length>0&&<ul className="admin-calendar-date-list" aria-label={label}>
      {dates.map(saved=><li key={saved}>
        <time dateTime={saved}>{saved}</time>
        <button type="button" className="admin-compact-action" disabled={disabled} aria-label={t([`Remove ${saved}`,`Hapus ${saved}`,`移除 ${saved}`])}
          onClick={()=>changeDates(dates.filter(value=>value!==saved))}><X size={15} aria-hidden="true"/></button>
      </li>)}
    </ul>}
    {plan?<div className="crm-class-break-summary">
      <div><strong>{endLabel}</strong> <time dateTime={plan.end}>{plan.end}</time>
        {plan.end!==plan.originalEnd&&<small>{t(['Originally','Tanggal awal','原结课'])} {plan.originalEnd}</small>}
      </div>
      <small>{t([`${config.sessions} periods · ${plan.meetings.length} sessions`,
        `${config.sessions} jam pelajaran · ${plan.meetings.length} pertemuan`,`共 ${config.sessions} 节 · ${plan.meetings.length} 次上课`])}</small>
      {plan.makeupDates.length>0&&<small>{makeup.label} · {plan.makeupDates.join(' · ')}</small>}
      {plan.unneededDates.length>0&&<small>{t(['No session to skip','Tidak ada pertemuan yang dilewati','未影响课次'])} · {plan.unneededDates.join(' · ')}</small>}
      {plan.first!==firstDate&&<small role="status" data-tone="warning">{t([
        `The first session falls on a break. Suggested first session: ${plan.first}. Confirm any change to the first session or registration deadline separately.`,
        `Pertemuan pertama jatuh pada hari libur. Usulan tanggal mulai: ${plan.first}. Konfirmasi perubahan tanggal mulai atau batas pendaftaran secara terpisah.`,
        `首课当天选为停课，拟顺延至 ${plan.first}。首课和报名截止保留原值，调整需另行确认。`,
      ])}</small>}
    </div>:<small>{t(['Enter a valid first session and weekly schedule to preview the end date.',
      'Isi jadwal mingguan dan pertemuan pertama untuk melihat perkiraan tanggal selesai.','填好首课和每周课表后，可预览预计结课日。'])}</small>}
  </AdminField>;
}
type Catalog = { classes: EnrollmentClassAdmin[]; courses: EnrollmentTeachingCourse[]; templates: EnrollmentTemplate[] };
type ClassDraftConfig=Omit<EnrollmentClassConfig,'period'>&{period:EnrollmentClassConfig['period']|''};
type Draft = { id: string; revision: number; state: 'draft' | 'published'; config: ClassDraftConfig;
  hasOrders?: boolean;
  publishedDates?: Pick<EnrollmentClassConfig,'firstLesson'|'enrollmentCloses'> };
const classFiltersDefault={search:'',level:'',format:'',period:'',status:'',date:'',teacher:'',sort:'upcoming'};
const inlineFilterWidth=880;
const classStatusCopy={
  draft:['Draft','Draf','草稿'],
  published:['Published · Awaiting class confirmation','Diterbitkan · Menunggu konfirmasi kelas','已发布 · 待确认开班'],
  opened:['Class confirmed','Kelas dikonfirmasi','已确认开班'],
  cancelled:['Class will not open','Kelas tidak dibuka','已确认不开班'],
} as const;
const classStatus=(row:EnrollmentClassAdmin)=>row.state==='published'&&row.opened?'opened':row.state;
const initial: ClassDraftConfig = {
  courseId: '', level: 'HSK 1', format: 'standard', period: '',
  firstLesson: '', enrollmentCloses: '', decisionAt: '', schedule: '',
  sessions: 23, minutes: 45, minimumPaid: 10, capacity: 15, price: 0, standardPrice: null,
  learningOutcomes: '', material: '', resources: '', teacher: '',
};
const dateTimeLabels = {
  firstLesson: ['First session (WIB)', 'Pertemuan pertama (WIB)', '首次上课（WIB）'],
  decisionAt: ['Expected decision (WIB)', 'Perkiraan keputusan (WIB)', '预计通知开班结果（WIB）'],
  enrollmentCloses: ['Self-service deadline (WIB)', 'Batas daftar mandiri (WIB)', '自助报名截止（WIB）'],
} satisfies Record<string,Copy>;

export function CrmEnrollmentClasses({ lang, isLight, target, createFrom, onShowAll, onDraftChange }: {
  lang: CrmLanguage; isLight: boolean; target?: string; createFrom?: string; onShowAll: () => void; onDraftChange: (dirty:boolean) => void;
}) {
  const t = ([en, id, zh]: Copy) => lang === 'zh' ? zh : lang === 'id' ? id : en;
  const teacherHelpId=useId();
  const fieldHintId=useId();
  const [catalog, setCatalog] = useState<Catalog>();
  const [readState,setReadState]=useState<'loading'|'ready'|'error'|'denied'>('loading');
  const {filters,change:changeFilters,clear}=useEnrollmentSettingsFilters('classes',classFiltersDefault);
  const catalogPanel=useRef<HTMLElement>(null);
  const [showAllFilters,setShowAllFilters]=useState(false);
  const [draft, setDraft] = useState<Draft>();
  const [quoteDirty,setQuoteDirty]=useState(false);
  const [quoteTemplateId,setQuoteTemplateId]=useState<string>();
  const [preview,setPreview]=useState(false);
  const [confirmDates,setConfirmDates]=useState(false);
  const createOpened=useRef<string|undefined>(undefined);
  const [insertion, setInsertion] = useState<{row:EnrollmentClassAdmin;requestId:string}>();
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [closing, setClosing] = useState<{id:string;requestId:string}>();
  const [deleting,setDeleting]=useState<{row:EnrollmentClassAdmin;requestId:string}>();
  const [deleteUnknown,setDeleteUnknown]=useState(false);
  const [deleteError,setDeleteError]=useState('');
  const [deleted,setDeleted]=useState(false);
  const deletingInFlight=useRef(false);
  const [pending, setPending] = useState<string>();
  const [checkState,setCheckState]=useState<'missing'|'error'>();
  const checkMessage=checkState==='missing'
    ? t(['No result yet. Your draft is retained.','Hasil belum ditemukan. Draf disimpan.','暂未查到这次操作的结果，草稿已保留。'])
    : checkState==='error'
      ? t(['Unable to check the result. Your draft is retained.','Hasil belum dapat diperiksa. Draf disimpan.','暂时无法查询结果，草稿已保留。'])
      : undefined;
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const endpoint = '/api/crm/enrollment/classes';

  const readRequest=useRef<AbortController|null>(null);
  async function load() {
    readRequest.current?.abort();
    const controller=new AbortController();
    readRequest.current=controller;
    const {signal}=controller;
    setReadState('loading');
    try{
      const result=await fetch(endpoint,{cache:'no-store',signal});
      if(signal.aborted)return;
      if(result.status===401||result.status===403){setCatalog(undefined);setReadState('denied');return;}
      if(!result.ok)throw Error();
      const data=await result.json();
      if(signal.aborted)return;
      setCatalog(data);setReadState('ready');
    }catch(cause){
      if(signal.aborted)return;
      setReadState('error');
      throw cause;
    }
  }
  const refresh=()=>void load().catch(()=>{});
  async function deleteClass() {
    if(!deleting||deletingInFlight.current)return;
    const {row,requestId}=deleting;
    deletingInFlight.current=true;
    setBusy(true);
    setDeleteError('');
    try{
      const response=deleteUnknown
        ? await fetch(endpoint+'/results/'+encodeURIComponent(requestId),{cache:'no-store'})
        : await fetch(endpoint+'/delete',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({id:row.id,revision:row.revision,requestId})});
      if(response.status>=500||deleteUnknown&&!response.ok)throw Error();
      if(!response.ok){
        setDeleteError(t(['This draft can no longer be deleted. Refresh to check its current state.',
          'Draf ini tidak dapat dihapus. Segarkan untuk melihat status terkini.','当前草稿无法删除，请刷新核对最新状态。']));
        return;
      }
      const result=await response.json();
      if(result.classId!==row.id||result.operationKind!=='enrollment.class.delete')throw Error();
      setCatalog(current=>current&&{...current,classes:current.classes.filter(item=>item.id!==row.id)});
      setDeleting(undefined);
      setDeleted(true);
      refresh();
    }catch{
      setDeleteUnknown(true);
      setDeleteError(t(['Deletion is not confirmed yet. Check the result before retrying.',
        'Penghapusan belum terkonfirmasi. Periksa hasil sebelum mencoba lagi.','删除结果尚未确认，请先查询结果。']));
    }finally{
      deletingInFlight.current=false;
      setBusy(false);
    }
  }
  useEffect(()=>{refresh();return ()=>readRequest.current?.abort();},[]);
  useEffect(()=>{
    const panel=catalogPanel.current;
    if(!panel)return;
    const measure=()=>setShowAllFilters(panel.clientWidth>=inlineFilterWidth);
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(panel);
    return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{onDraftChange(dirty||busy||!!pending||quoteDirty);},[onDraftChange,dirty,busy,pending,quoteDirty]);
  useEffect(()=>()=>onDraftChange(false),[onDraftChange]);
  useEffect(() => {
    if (!dirty && !pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, pending]);
  function edit(row?: EnrollmentClassAdmin) {
    if (row?.state==='cancelled') return;
    setSaved(false);
    setError('');
    setDirty(false);
    if (row) {
      const { id, revision, state, opened, canInsert, hasOrders, ...config } = row;
      const publishedDates=state==='published'?{firstLesson:config.firstLesson,enrollmentCloses:config.enrollmentCloses}:undefined;
      setDraft({id,revision,state,config,hasOrders,publishedDates});
    } else {
      setDraft({ id: crypto.randomUUID(), revision: 0, state: 'draft', config: { ...initial } });
    }
  }
  function chooseTemplate(id:string){
    const template=catalog?.templates.find(item=>item.id===id);
    const course=catalog?.courses.find(item=>item.id===template?.courseId);
    const derived=template&&course&&enrollmentTemplateClassFields(template,course);
    if(!derived)return;
    setDraft(value=>value&&({...value,config:{...value.config,...derived,
      teacher:value.config.teacherType&&value.config.teacherType!==derived.teacherType?'':value.config.teacher}}));
    setDirty(true);setError('');
  }
  useEffect(()=>{
    if(!catalog||!createFrom||createOpened.current===createFrom)return;
    createOpened.current=createFrom;
    edit();
    chooseTemplate(createFrom);
  },[catalog,createFrom]);
  function change(name: keyof EnrollmentClassConfig, value: string | number | null) {
    setDraft(current=>{
      if(!current)return current;
      const config=name==='firstLesson'&&typeof value==='string'?enrollmentAutofillStart(current.config,value):{...current.config,[name]:value};
      if(name==='firstLesson'&&current.revision===0&&typeof value==='string'){
        const defaults=enrollmentScheduleDefaults(value);
        const previousDate=current.config.firstLesson.split('T')[0];
        const previous=enrollmentScheduleDefaults(previousDate+'T00:00');
        if(defaults){
          if(!config.decisionAt||config.decisionAt===previous?.decisionAt)config.decisionAt=defaults.decisionAt;
          if(!config.enrollmentCloses||config.enrollmentCloses===previous?.enrollmentCloses)config.enrollmentCloses=defaults.enrollmentCloses;
        }
      }
      return {...current,config};
    });
    setDirty(true);
  }
  const weekly=draft?.config.weeklySchedule??{days:[],start:'',lessons:1};
  const scheduleText=enrollmentWeeklyScheduleText(draft?.config.weeklySchedule,draft?.config.minutes??45,lang);
  const timeSlotMessage=draft?.config.period==='mixed'
    ? t(['Select at least one weekday and one weekend day.','Pilih minimal satu hari kerja dan satu hari akhir pekan.','工作日与周末班须同时选择工作日和周末的上课日。'])
    :draft?.config.period==='weekend'
    ? t(['Weekend classes must use Saturday or Sunday.','Kelas akhir pekan harus dijadwalkan pada Sabtu atau Minggu.','周末班的每周上课日只能选择周六、周日。'])
    : t(['Weekday evening classes must use Monday to Friday.','Kelas malam hari kerja harus dijadwalkan pada Senin hingga Jumat.','工作日晚间班的每周上课日只能选择周一至周五。']);
  const fieldErrors=draft?enrollmentScheduleErrors(draft.config,lang):{};
  if(draft&&!draft.config.courseId)fieldErrors.templateId=t(['Select a class template.','Pilih templat kelas.','请选择班型模板。']);
  const hasFieldErrors=Object.keys(fieldErrors).length>0;
  const hint=(name:string)=>fieldErrors[name]?<small id={fieldHintId+'-'+name} role="alert">{fieldErrors[name]}</small>:null;
  const hintProps=(name:string)=>({'aria-invalid':!!fieldErrors[name]||undefined,'aria-describedby':fieldErrors[name]?fieldHintId+'-'+name:undefined});
  const currentTemplate=draft?.state==='draft'&&catalog?.templates.find(item=>item.id===draft.config.templateId);
  const templateUpdate=currentTemplate&&currentTemplate.revision!==draft?.config.templateRevision?currentTemplate:undefined;
  const updatedCourse=templateUpdate&&catalog?.courses.find(item=>item.id===templateUpdate.courseId);
  const updatedFields=templateUpdate&&updatedCourse&&enrollmentTemplateClassFields(templateUpdate,updatedCourse);
  const templateWarning=templateUpdate?t(['Review and apply the latest template before saving or publishing.',
    'Periksa dan terapkan templat terbaru sebelum menyimpan atau menerbitkan.','请先核对并采用最新班型模板，再保存或发布。']):undefined;
  const sourceReview=draft?.config.scheduleReview??{};
  const hasSourceReview=Object.keys(sourceReview).length>0;
  const sourceReviewMessage=t(['Confirm the source schedule details before publishing.',
    'Konfirmasi rincian jadwal dari sumber sebelum menerbitkan.','请先核对原排期资料中的待确认项，再发布班次。']);
  const sourceHint=(field:EnrollmentScheduleReviewField)=>sourceReview[field]&&<div>
    <small>{t(['Source schedule to review','Jadwal sumber yang perlu diperiksa','原排期待核对'])} · {sourceReview[field]}</small>
    <AdminRowAction disabled={busy||!!pending} onClick={()=>{
      setDraft(current=>{
        if(!current)return current;
        const scheduleReview={...current.config.scheduleReview};
        delete scheduleReview[field];
        return {...current,config:{...current.config,scheduleReview}};
      });
      setDirty(true);
    }}>{t(['Mark reviewed','Tandai sudah diperiksa','标记为已核对'])}</AdminRowAction>
  </div>;
  const validationMessages=[fieldErrors.templateId,fieldErrors.period,fieldErrors.firstLesson,fieldErrors.days,fieldErrors.start,
    fieldErrors.lessons,fieldErrors.decisionAt,fieldErrors.enrollmentCloses,templateWarning,hasSourceReview&&sourceReviewMessage].filter(Boolean);
  const publishBlocked=hasFieldErrors||hasSourceReview||!!templateUpdate;
  const saveBlocked=!draft||!!templateUpdate||!draft.config.courseId||!draft.config.period||
    !enrollmentInstant(draft.config.firstLesson)||!enrollmentInstant(draft.config.enrollmentCloses)||
    !enrollmentInstant(draft.config.decisionAt)||!!fieldErrors.lessons||
    (draft.state==='published'&&publishBlocked);
  const firstSessionOnBreak=draft?.state==='draft'&&draft.config.holidayDates?.includes(draft.config.firstLesson.slice(0,10));
  const datesToConfirm=(['firstLesson','enrollmentCloses'] as const).filter(key=>
    draft?.publishedDates&&draft.config[key]!==draft.publishedDates[key]);
  const firstSessionOnBreakMessage=t(['The first session falls on a break. Confirm the first session and signup cutoff before publishing.',
    'Pertemuan pertama jatuh pada hari libur. Konfirmasi pertemuan pertama dan batas pendaftaran sebelum menerbitkan.',
    '首课当天已选为停课。请先确认首课及报名截止，再发布班次。']);
  const previewRow=draft?.config.courseId&&draft.config.period
    ? {...draft.config,period:draft.config.period,id:draft.id,state:draft.state,revision:draft.revision}
    : undefined;
  function changeWeekly(values:Partial<EnrollmentWeeklySchedule>){
    const next={...weekly,...values};
    if(next.startByDay&&values.days){
      next.startByDay=Object.fromEntries(next.days.map(day=>[day,enrollmentSessionStart(next,day)]));
    }
    setDraft(current=>current&&({...current,config:{...current.config,weeklySchedule:next,
      schedule:enrollmentWeeklyScheduleText(next,current.config.minutes,lang)}}));
    setDirty(true);
  }
  function close() {
    if (busy || pending) return;
    if (dirty) setDiscard(true);
    else setDraft(undefined);
  }
  async function complete() {
    setPending(undefined);
    setDirty(false);
    setDraft(undefined);
    setSaved(true);
    await load().catch(()=>{});
  }
  async function save(state:Draft['state']=draft?.state??'draft') {
    if (!draft || saveBlocked || busy || pending) return;
    if(state==='published'&&(publishBlocked||!draft.config.price||firstSessionOnBreak))return;
    const requestId = crypto.randomUUID();
    setError('');
    setBusy(true);
    try {
      const result = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id:draft.id,revision:draft.revision,config:draft.config,state,requestId }),
      });
      if (result.status >= 500) throw Error();
      if (!result.ok) {
        const failure=await result.json();
        setError(failure.error==='enrollment_class_schedule_review_pending'
          ? sourceReviewMessage
          : failure.error==='enrollment_class_break_preview_only'
          ? t(['An order now exists. Reopen the editor to preview break dates.','Sudah ada pesanan. Buka ulang editor untuk melihat pratinjau tanggal libur.','该班次已有订单，请重新打开编辑器预览停课日期。'])
          : failure.error==='enrollment_class_first_session_on_break'
          ? firstSessionOnBreakMessage
          : failure.error==='enrollment_class_batch_scope_fixed'
          ? t(['The time slot cannot change after publication. Create another class instead.','Waktu kelas tidak dapat diubah setelah diterbitkan. Buat kelas baru.','班次发布后不能更改时段类型，请另建班次。'])
          : failure.error==='enrollment_class_timeslot_mismatch'
          ? timeSlotMessage
          : failure.error==='enrollment_class_schedule_mismatch'
          ? t(['The first session must match the weekly class day and start time.','Pertemuan pertama harus sesuai dengan hari dan waktu mulai jadwal mingguan.','首次上课的星期和开始时间须与每周课表一致。'])
          : failure.error==='enrollment_template_conflict'
          ? t(['The template changed. Review the latest settings before saving.','Templat berubah. Periksa pengaturan terbaru sebelum menyimpan.','模板已更新，请核对最新配置后再保存。'])
          : result.status === 409
          ? t(['Refresh to review the latest class and course.', 'Segarkan untuk memeriksa data kelas dan kursus terbaru.', '请刷新核对最新的班次及课程状态。'])
          : t(['Check the class dates, capacity and tuition.', 'Periksa jadwal, kapasitas, dan biaya kelas.', '请核对班次日期、人数和学费。']));
        if(result.status===409)await load().catch(()=>{});
        return;
      }
      const receipt = await result.json();
      if (receipt.classId !== draft.id) throw Error();
      setPreview(false);
      await complete();
    } catch {
      setCheckState(undefined);setPending(requestId);
    } finally { setBusy(false); }
  }
  async function check() {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const result=await fetch(endpoint+'/results/'+encodeURIComponent(pending),{cache:'no-store'});
      if(result.status===404){setCheckState('missing');return;}
      if(!result.ok||(await result.json()).classId!==draft?.id)throw Error();
      setPreview(false);
      await complete();
    }catch{setCheckState('error');}
    finally{setBusy(false);}
  }
  async function completeInsertion() {
    setPending(undefined);
    setDirty(false);
    setInsertion(undefined);
    setSaved(true);
    await load().catch(()=>{});
  }
  async function saveInsertion(form:FormData) {
    if(!insertion||busy||pending) return;
    setBusy(true);setError('');
    try{
      const response=await fetch(endpoint+'/'+encodeURIComponent(insertion.row.id)+'/insertions',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({requestId:insertion.requestId,name:form.get('name'),email:form.get('email'),
          phone:form.get('phone'),price:Number(form.get('price')),confirmed:form.get('confirmed')==='on'}),
      });
      if(response.status>=500) throw Error();
      const result=await response.json();
      if(!response.ok){
        setError(result.error==='enrollment_class_full'
          ? t(['This class is full.','Kelas ini penuh.','本班已满。'])
          : result.error==='enrollment_already_has_seat'
            ? t(['This learner already has a seat.','Siswa ini sudah mendapat kursi.','该学员已在本班占有席位。'])
            : t(['Check learner details, tuition and class availability.','Periksa data siswa, biaya, dan ketersediaan kelas.','请核对学员信息、学费和班次状态。']));
        return;
      }
      if(result.classId!==insertion.row.id||!result.id) throw Error();
      await completeInsertion();
    }catch{setCheckState(undefined);setPending(insertion.requestId);}
    finally{setBusy(false);}
  }
  async function checkInsertion() {
    if(!insertion||!pending||busy) return;
    setBusy(true);
    try{
      const response=await fetch(endpoint+'/results/'+encodeURIComponent(pending),{cache:'no-store'});
      if(response.status===404){setCheckState('missing');return;}
      if(!response.ok)throw Error();
      const result=await response.json();
      if(result.operationKind!=='enrollment.order.insert'||result.classId!==insertion.row.id||!result.id)throw Error();
      await completeInsertion();
    }catch{setCheckState('error');}
    finally{setBusy(false);}
  }
  const title = t(['Enrollment classes', 'Kelas pendaftaran', '报名班次']);
  const listState=readState==='loading'&&catalog?'ready':readState;
  const normalize=(value:string)=>value.normalize('NFKC').toLowerCase().trim();
  const tokens=normalize(filters.search).split(/\s+/u).filter(Boolean);
  const now=Date.now();
  const matchesDate=enrollmentClassDateFilter(filters.date,now);
  const visibleClasses=catalog?.classes.flatMap(row=>{
    if(target&&row.id!==target)return [];
    const start=enrollmentInstant(row.firstLesson);
    if(!target&&((filters.level&&row.level!==filters.level)||(filters.format&&row.format!==filters.format)||
      (filters.period&&row.period!==filters.period)||(filters.status&&classStatus(row)!==filters.status)||
      (filters.teacher&&row.teacherType!==filters.teacher)||!matchesDate(start)))return [];
    const entry={row,time:start?.getTime()??null,firstSession:start?formatCrmEventTime(start.toISOString()).slice(0,16):'—'};
    if(target||!tokens.length)return [entry];
    const haystack=normalize([row.id,row.courseName,row.level.replace(/\s+/gu,''),enrollmentClassTitle(row,lang),
      row.schedule,row.firstLesson,entry.firstSession,enrollmentTeacherLabel(row.teacherType,lang),row.teacher].join(' '));
    return tokens.every(token=>haystack.includes(token))?[entry]:[];
  }).sort((a,b)=>compareEnrollmentClassStarts(a.time,b.time,filters.sort,now)||a.row.id.localeCompare(b.row.id));
  const advancedCount=Number(!!filters.date)+Number(!!filters.teacher);
  const select=(field:keyof typeof classFiltersDefault,label:EnrollmentListCopy,options:CrmChoice[],all?:EnrollmentListCopy)=>
    <EnrollmentSettingsSelect lang={lang} isLight={isLight} label={label} all={all} options={options}
      value={filters[field]} onChange={value=>changeFilters({[field]:value})}/>;
  const additionalFilters=<>
    {select('date',['First-session date','Tanggal pertemuan pertama','首课日期'],[
      {value:'7',label:t(['Next 7 days including today','7 hari ke depan termasuk hari ini','未来 7 天（含今天）'])},
      {value:'30',label:t(['Next 30 days including today','30 hari ke depan termasuk hari ini','未来 30 天（含今天）'])},
      {value:'past',label:t(['First session has passed','Pertemuan pertama sudah lewat','首课时间已过'])},
    ],['All first-session dates','Semua tanggal pertemuan pertama','全部首课日期'])}
    {select('teacher',['Teacher type','Jenis pengajar','教师类型'],(['local','foreign'] as const).map(value=>({value,label:enrollmentTeacherLabel(value,lang)})),
      ['All teacher types','Semua jenis pengajar','全部教师类型'])}
  </>;
  const fieldDisabled=busy||!!pending;
  const dateTimeField=(name:keyof typeof dateTimeLabels)=>{
    const label=t(dateTimeLabels[name]);
    const [date='',time='']=(draft?.config[name]??'').split('T');
    const firstDate=draft?.config.firstLesson.split('T')[0];
    const error=hintProps(name);
    return <AdminField as="div" role="group" aria-label={label} required>
      <AdminFieldLabel required>{label}</AdminFieldLabel>
      <div className="admin-schedule-date-time">
        <AdminCalendarPicker label={label+' · '+t(['Date','Tanggal','日期'])} placeholder={t(['Select date','Pilih tanggal','选择日期'])}
          lang={lang} value={validEnrollmentHolidayDate(date)?[date]:[]}
          anchorDate={validEnrollmentHolidayDate(firstDate)?firstDate:undefined} disabled={fieldDisabled}
          invalid={error['aria-invalid']} describedBy={error['aria-describedby']}
          onChange={([next])=>change(name,next+'T'+time)}/>
        <input type="text" value={time} placeholder="HH:mm" maxLength={5} required
          aria-label={label+' · '+t(['Time','Waktu','时间'])} {...error} disabled={fieldDisabled}
          onChange={event=>change(name,date+'T'+event.target.value)}/>
      </div>
      {hint(name)}
      {name==='firstLesson'&&sourceHint(name)}
    </AdminField>;
  };
  const selectField=(name:'courseId'|'level'|'format'|'period',label:Copy,options:CrmChoice[],fullWidth=false)=>
    name==='period'&&draft?.state==='published'
      ? <AdminStaticField label={t(label)} value={options.find(option=>option.value===draft.config.period)?.label} fullWidth={fullWidth}/>
      : <AdminField required data-admin-full-width={fullWidth||undefined}>{t(label)}
      <CrmSingleSelect label={t(label)} value={draft?.config[name]??''} options={options} lang={lang} isLight={isLight}
        disabled={fieldDisabled} onChange={value=>change(name,value)}/>
      {hint(name)}
    </AdminField>;
  return <section className="crm-course-catalog" ref={catalogPanel}>
    <header className="admin-edit-header">
      <div className="admin-edit-title"><h2>{title}</h2></div>
      <div className="crm-ops-actions">
        {target&&<AdminRowAction onClick={onShowAll}>{t(['View all classes','Lihat semua kelas','查看全部班次'])}</AdminRowAction>}
        <AdminRefreshAction label={t(['Refresh', 'Segarkan', '刷新'])} loading={readState==='loading'} onClick={refresh}/>
        <CrmPageAction icon={Plus} variant="primary" label={t(['Create class','Buat kelas','创建班次'])} disabled={readState!=='ready'} onClick={()=>edit()}/>
      </div>
    </header>
    {!!error && !draft && !insertion && <p role="alert">{error}</p>}
    {saved && <CrmSaveFeedback state="saved" lang={lang}/>}
    {deleted && <CrmSaveFeedback state="saved" lang={lang}>{t(['Class draft deleted.','Draf kelas dihapus.','班次草稿已删除。'])}</CrmSaveFeedback>}
    {!target&&catalog&&<>
      <div className="crm-class-config-filters">
        <AdminSearchField label={t(['Search classes','Cari kelas','搜索班次'])}
          placeholder={t(['Class, teacher or schedule','Kelas, pengajar, atau jadwal','班次、教师或课表'])}
          value={filters.search} onChange={search=>changeFilters({search})}/>
        {select('level',['Level','Level','级别'],enrollmentLevels.map(value=>({value,label:value})),['All levels','Semua level','全部级别'])}
        {select('format',['Class type','Jenis kelas','班型'],[
          {value:'standard',label:t(['Standard class','Kelas standar','标准班'])},
          {value:'small',label:t(['Small group','Kelompok kecil','小班'])},
        ],['All class types','Semua jenis kelas','全部班型'])}
        {select('period',['Time slot','Waktu kelas','时段'],[
          {value:'weekday-evening',label:t(['Weekday evening','Malam hari kerja','工作日晚班'])},
          {value:'mixed',label:t(['Weekday & weekend','Hari kerja & akhir pekan','工作日与周末'])},
          {value:'weekend',label:t(['Weekend','Akhir pekan','周末班'])},
        ],['All time slots','Semua waktu kelas','全部时段'])}
        {select('status',['Class status','Status kelas','班次状态'],Object.entries(classStatusCopy).map(([value,copy])=>({value,label:t(copy)})),
          ['All statuses','Semua status','全部状态'])}
        {showAllFilters&&additionalFilters}
      </div>
      {!showAllFilters&&<AdminDisclosure heading={t(['More filters','Filter lainnya','更多筛选'])+(advancedCount?' · '+advancedCount:'')} density="compact">
        <div className="crm-class-config-filters">{additionalFilters}</div>
      </AdminDisclosure>}
      <EnrollmentSettingsListSummary lang={lang} count={visibleClasses?.length??0} total={catalog.classes.length}
        filtered={!!(filters.search||filters.level||filters.format||filters.period||filters.status||advancedCount)} onClear={clear}>
        {select('sort',['Sort','Urutkan','排序'],[
          {value:'upcoming',label:t(['Upcoming classes first','Kelas mendatang dahulu','即将开课优先'])},
          {value:'oldest',label:t(['First session date · Oldest to newest','Tanggal pertemuan pertama · Terlama ke terbaru','首课日期从早到晚'])},
          {value:'latest',label:t(['First session date · Newest to oldest','Tanggal pertemuan pertama · Terbaru ke terlama','首课日期从晚到早'])},
        ])}
      </EnrollmentSettingsListSummary>
    </>}
    {(listState!=='ready'||!visibleClasses?.length)&&<AdminListState lang={lang}
      state={listState==='ready'?'empty':listState}
      message={listState==='ready'&&target?t(['Class not found.','Kelas tidak ditemukan.','班次不存在。'])
        :listState==='error'&&catalog?t(['Refresh failed. Showing the last loaded classes.','Gagal menyegarkan. Kelas yang terakhir dimuat masih ditampilkan.','刷新失败，仍显示上次读取的班次。']):undefined}
      onRetry={refresh}/>}
    {!!visibleClasses?.length&&<AdminListTable label={title} className="crm-course-list" busy={readState==='loading'} headers={[
      t(['Class','Kelas','班次']),{label:t(['Schedule','Jadwal','课表']),sort:target?undefined:filters.sort==='oldest'?'ascending':filters.sort==='latest'?'descending':'other'},
      {label:t(['Tuition','Biaya','学费']),numeric:true},
      t(['Status','Status','状态']),t(['Actions','Tindakan','操作']),
    ]}>
      {visibleClasses.map(({row,firstSession}) => <tr key={row.id}>
        <td>{enrollmentClassTitle(row,lang)}<br/><small>{enrollmentTeacherLabel(row.teacherType,lang)}</small></td><td>{firstSession}<br/>{row.schedule}</td>
        <td className="crm-list-number">{formatCurrency(row.price, lang)}</td><td><AdminStatus tone={row.opened||row.state==='published'?'success':'neutral'}>{t(classStatusCopy[classStatus(row)])}</AdminStatus></td>
        <td><div className="flex flex-wrap items-center gap-x-3 gap-y-1">{row.state!=='draft'&&<AdminRowAction href={enrollmentClassManagementPath(row.id)}>{t(['View enrollments','Lihat pendaftaran','查看报名'])}</AdminRowAction>}
          {row.state!=='cancelled' && <AdminRowAction disabled={readState==='error'} onClick={() => edit(row)}>{t(['Edit', 'Edit', '编辑'])}</AdminRowAction>}
          {row.canDelete&&<AdminRowAction disabled={readState!=='ready'} onClick={()=>{
            setDeleted(false);setDeleteError('');setDeleteUnknown(false);
            setDeleting({row,requestId:crypto.randomUUID()});
          }}>{t(['Delete','Hapus','删除'])}</AdminRowAction>}
          {row.canInsert&&<AdminRowAction disabled={readState==='error'} onClick={()=>{
            setInsertion({row,requestId:crypto.randomUUID()});setDirty(false);setError('');setSaved(false);
          }}>{t(['Add to class','Tambah siswa ke kelas','办理插班'])}</AdminRowAction>}
          {row.state==='published'&&!row.opened&&<AdminSecondaryActions alwaysMenu disabled={readState==='error'} label={t(['More actions','Tindakan lain','更多操作'])}>
            <button type="button" onClick={()=>setClosing({id:row.id,requestId:crypto.randomUUID()})}>{t(['Class will not open','Kelas tidak dibuka','确认不开班'])}</button>
          </AdminSecondaryActions>}</div></td>
      </tr>)}</AdminListTable>}
    {draft&&!preview&&!quoteTemplateId&&<AdminEditor variant="drawer" responsiveForm required className="crm-course-editor"
      title={draft.revision?t(['Edit class','Edit kelas','编辑班次']):t(['Create class','Buat kelas','创建班次'])}
      lang={lang} light={isLight} busy={busy} closeDisabled={!!pending} onClose={close}
      onSubmit={event=>{
        event.preventDefault();
        if(!saveBlocked&&datesToConfirm.length)setConfirmDates(true);
        else void save();
      }} footer={<>
          {pending ? <button type="button" className="crm-work-button" disabled={busy} onClick={() => void check().catch(() => {})}>{t(['Check save result', 'Periksa hasil simpan', '查询保存结果'])}</button>
            : <>{saveBlocked&&validationMessages[0]&&<AdminFormFeedback state="error" lang={lang} className="crm-class-quote-feedback">
                {validationMessages[0]}
              </AdminFormFeedback>}
              <button type="button" className="crm-work-button" disabled={busy} onClick={close}>{t(['Cancel', 'Batal', '取消'])}</button>
              <button type="button" className="crm-work-button" disabled={busy} onClick={()=>setPreview(true)}>
                {t(['Preview for learners','Pratinjau siswa','学员预览'])}</button>
              <button type="submit" data-primary="" disabled={busy||saveBlocked}>{draft.state==='draft'?t(['Save draft','Simpan draf','保存草稿']):t(['Save','Simpan','保存'])}</button></>}
      </>}>
          {error && <p role="alert">{error}</p>}
          {readState==='error'&&<AdminRefreshAction label={t(['Retry loading latest settings','Coba muat ulang pengaturan terbaru','重新读取最新配置'])}
            loading={false} onClick={refresh}/>}
          {pending && <CrmSaveFeedback state={busy?"saving":"unknown"} lang={lang}>{!busy&&checkMessage}</CrmSaveFeedback>}
          {templateUpdate&&updatedFields&&<AdminFormSection title={t(['Template updated','Templat diperbarui','模板已更新'])}
            description={t(['Review the latest template before applying it. Your schedule and teacher will be kept.','Periksa templat terbaru sebelum menerapkannya. Jadwal dan pengajar Anda tetap tersimpan.','请核对后采用最新模板。已填写的课表、日期和授课教师会保留。'])}>
            <AdminFormSummary fields={[
              [t(['Current enrollment total','Total pendaftaran saat ini','当前报名总价']),formatCurrency(draft.config.price,lang)],
              [t(['Latest enrollment total','Total pendaftaran terbaru','最新报名总价']),updatedFields.price?formatCurrency(updatedFields.price,lang):t(['Quote pending','Harga belum dikonfirmasi','报价待确认'])],
              [t(['Latest standard total','Total harga standar terbaru','最新标准总价']),updatedFields.standardPrice?formatCurrency(updatedFields.standardPrice,lang):'—'],
              [t(['Latest minimum fully paid','Minimum peserta lunas terbaru','最新开班底线']),updatedFields.minimumPaid],
              [t(['Latest capacity','Kapasitas terbaru','最新招生上限']),updatedFields.capacity],
            ]}/>
            <button type="button" className="crm-work-button" disabled={busy||!!pending} onClick={()=>chooseTemplate(templateUpdate.id)}>
              {t(['Apply latest template','Terapkan templat terbaru','采用最新模板'])}
            </button>
          </AdminFormSection>}
          <div data-admin-section-stack="open">
          <AdminFormSection variant="subgroup" title={t(['Class template','Templat kelas','班型模板'])}>
            {draft.state==='published'
              ? <AdminStaticField label={t(['Class template','Templat kelas','班型模板'])}
                  value={catalog?.templates.find(item=>item.id===draft.config.templateId)?.name}/>
              : <AdminField required={!draft.revision||!!draft.config.templateId}>
              {t(['Select a class template','Pilih templat kelas','选择班型模板'])}
              <CrmSingleSelect label={t(['Select a class template','Pilih templat kelas','选择班型模板'])} lang={lang} isLight={isLight}
                value={draft.config.templateId??''} disabled={fieldDisabled}
                options={(catalog?.templates??[]).filter(item=>item.format!=='one-on-one').map(item=>({value:item.id,
                  label:item.name+(item.saleUnitPrice?'':' · '+t(['Quote pending','Harga belum dikonfirmasi','报价待确认']))}))}
                onChange={chooseTemplate}/>
            </AdminField>}
            {hint('templateId')}
            {!!draft.config.courseId&&<AdminFormSummary fields={[
              [t(['Course','Kursus','课程']),draft.config.courseName||draft.config.level,'wide'],
              [t(['Periods × minutes','Jam pelajaran × menit','节数 × 分钟']),draft.config.sessions+' × '+draft.config.minutes],
              [t(['Teacher type','Jenis pengajar','教师类型']),draft.config.teacherType==='foreign'?t(['Foreign teacher','Pengajar asing','外教']):draft.config.teacherType==='local'?t(['Local teacher','Pengajar lokal','本土教师']):'—'],
              [t(['Minimum fully paid','Minimum peserta lunas','足额到账开班底线']),draft.config.minimumPaid],
              [t(['Capacity','Kapasitas','招生上限']),draft.config.capacity],
              ...(draft.config.standardPrice?[[t(['Standard total','Total harga standar','标准总价']),<del>{formatCurrency(draft.config.standardPrice,lang)}</del>] as const]:[]),
              [t(['Enrollment total','Total harga pendaftaran','报名总价']),draft.config.price?<strong>{formatCurrency(draft.config.price,lang)}</strong>:'—'],
            ]}/>}
            {!!draft.config.courseId&&!draft.config.price&&<p className="crm-work-muted">{t(['Quote pending. Publication is blocked.','Harga belum dikonfirmasi. Kelas belum bisa diterbitkan.','报价待确认，可保存草稿，暂不能发布。'])}</p>}
          </AdminFormSection>
          <AdminFormSection variant="subgroup" title={t(['Schedule and dates','Jadwal dan tanggal','本期时间安排'])}>
            <AdminFormGrid>
              <AdminField as="div" data-admin-full-width="">
                <label>{t(['Teacher','Pengajar','授课教师'])}</label>
                <input type="text" maxLength={2500} aria-describedby={teacherHelpId} value={draft.config.teacher??''} disabled={fieldDisabled}
                  onChange={event=>change('teacher',event.target.value)}/>
                <small id={teacherHelpId}>{t(['Enter the name displayed to learners. Leave blank if a teacher hasn’t been assigned.','Masukkan nama yang ditampilkan kepada siswa. Kosongkan jika pengajar belum ditetapkan.','填写对学员公开的姓名。尚未排定教师时可留空。'])}</small>
              </AdminField>
              {selectField('period',['Time slot','Waktu','时段'],enrollmentPeriods.map(value=>({
                value,label:value==='mixed'?t(['Weekday & weekend','Hari kerja & akhir pekan','工作日与周末']):value==='weekend'?t(['Weekend','Akhir pekan','周末']):t(['Weekday evening','Malam hari kerja','工作日晚间']),
              })))}
              {dateTimeField('firstLesson')}
              <AdminField as="div" role="group" {...hintProps('days')} required={!!draft.config.templateId} data-admin-full-width="">
                <label>{t(['Weekly class days','Hari kelas setiap minggu','每周上课日'])}</label>
                <CrmSingleSelect multiple value="" lang={lang} isLight={isLight} disabled={fieldDisabled}
                  label={t(['Weekly class days','Hari kelas setiap minggu','每周上课日'])}
                  emptyLabel={t(['Select weekdays','Pilih hari','请选择上课日'])} values={weekly.days.map(String)} onChange={()=>{}} onValuesChange={days=>changeWeekly({days:days.map(Number)})}
                  options={enrollmentWeekdays.map(([zh,en,id],index)=>({value:String(index+1),label:t([en,id,zh])}))}/>
                {hint('days')}
                {sourceHint('days')}
              </AdminField>
              <AdminField data-admin-full-width="" className="crm-class-per-day-choice">
                <input type="checkbox" checked={!!weekly.startByDay} disabled={fieldDisabled} onChange={event=>{
                  if(event.target.checked){
                    changeWeekly({startByDay:Object.fromEntries(weekly.days.map(day=>[day,weekly.start]))});
                  }else{
                    changeWeekly({start:enrollmentSessionStart(weekly,weekly.days[0])||weekly.start,startByDay:undefined});
                  }
                }}/>
                {t(['Set start times by weekday','Atur waktu mulai per hari','按上课日设置开始时间'])}
              </AdminField>
              {weekly.startByDay ? weekly.days.map(day=>{
                const dayLabel=t([enrollmentWeekdays[day-1][1],enrollmentWeekdays[day-1][2],enrollmentWeekdays[day-1][0]]);
                const label=t([`${dayLabel} start time (WIB)`,`Waktu mulai ${dayLabel} (WIB)`,`${dayLabel}开始时间（WIB）`]);
                return <AdminField key={day} required={draft.state==='published'}>{label}
                  <input type="time" aria-label={label} {...hintProps('start')} required={draft.state==='published'}
                    value={enrollmentSessionStart(weekly,day)} disabled={fieldDisabled}
                    onChange={event=>changeWeekly({startByDay:{...weekly.startByDay,[day]:event.target.value}})}/>
                </AdminField>;
              }) : <AdminField required={draft.state==='published'&&!!draft.config.templateId}>{t(['Session start time (WIB)','Waktu mulai pertemuan (WIB)','每次开始时间（WIB）'])}
                <input aria-label={t(['Session start time (WIB)','Waktu mulai pertemuan (WIB)','每次开始时间（WIB）'])} {...hintProps('start')}
                  type="time" required={draft.state==='published'&&!!draft.config.templateId} value={weekly.start} disabled={fieldDisabled}
                  onChange={event=>changeWeekly({start:event.target.value})}/>
              </AdminField>}
              {(fieldErrors.start||sourceReview.start)&&<div data-admin-full-width="">{hint('start')}{sourceHint('start')}</div>}
              <AdminField required={!!draft.config.templateId}>{t(['Periods per session','Jam pelajaran per pertemuan','每次上课节数'])}<input aria-label={t(['Periods per session','Jam pelajaran per pertemuan','每次上课节数'])} {...hintProps('lessons')} type="number" min="1" max="24" required={!!draft.config.templateId} value={weekly.lessons||''} disabled={fieldDisabled} onChange={e=>changeWeekly({lessons:Number(e.target.value)})}/>{hint('lessons')}</AdminField>
              <AdminStaticField fullWidth label={t(['Weekly schedule (automatic)','Jadwal mingguan (otomatis)','每周课表（自动生成）'])}
                value={draft.config.weeklySchedule?scheduleText:draft.config.schedule}/>
              <EnrollmentHolidayDates key={draft.id} config={draft.config} previewOnly={draft.state==='published'&&draft.hasOrders!==false} disabled={fieldDisabled} lang={lang} t={t} review={sourceHint('holidayDates')}
                onChange={holidayDates=>{
                  if(holidayDates.join()===draft.config.holidayDates?.join()||(!holidayDates.length&&!draft.config.holidayDates?.length))return;
                  setDirty(true);
                  setDraft(current=>current&&({...current,config:{...current.config,holidayDates}}));
                }}/>
              {dateTimeField('decisionAt')}
              {dateTimeField('enrollmentCloses')}
            </AdminFormGrid>
          </AdminFormSection>
          </div>
    </AdminEditor>}
    {quoteTemplateId&&<CrmEnrollmentTemplates lang={lang} isLight={isLight} onDraftChange={setQuoteDirty}
      quoteEdit={{id:quoteTemplateId,onReturn:()=>{
        refresh();
        setQuoteTemplateId(undefined);
      }}}/>}
    {preview&&draft&&!quoteTemplateId&&<AdminEditor variant="drawer" lang={lang} light={isLight} title={t(['Learner preview','Pratinjau siswa','学员预览'])}
      onClose={()=>setPreview(false)} footer={<>
        {draft.state==='draft'&&previewRow&&!previewRow.price&&<div className="crm-class-quote-feedback">
          <p>{t(['Add pricing to the class template before publishing.','Tambahkan harga pada templat kelas sebelum menerbitkan.','班型模板缺少报价，补齐后才能发布。'])}</p>
          {catalog?.classes.some(row=>row.templateId===draft.config.templateId)
            ? <p>{t(['This template is locked. Go back and select a template with pricing.','Templat ini terkunci. Kembali dan pilih templat dengan harga.','该模板已有班次，报价已锁定。请返回编辑并选择已有报价的模板。'])}</p>
            : draft.config.templateId&&<AdminRowAction onClick={()=>{
            setQuoteTemplateId(draft.config.templateId);
            setPreview(false);
          }}>{t(['Add pricing in the class template','Tambahkan harga di templat kelas','前往班型模板补报价'])}</AdminRowAction>}
        </div>}

        <button type="button" onClick={()=>setPreview(false)}>{t(['Back to editing','Kembali mengedit','返回编辑'])}</button>
        {firstSessionOnBreak&&<p role="alert" className="crm-class-quote-feedback">{firstSessionOnBreakMessage}</p>}
        {draft.state==='draft'&&<button type="button" data-primary="" disabled={busy||saveBlocked||publishBlocked||!!pending||!previewRow?.price||firstSessionOnBreak}
          onClick={()=>void save('published')}>{t(['Publish class','Terbitkan kelas','发布班次'])}</button>}
      </>}>
      {previewRow&&!previewRow.batchNumber&&<p>{t(['Batch number assigned on first publication.','Nomor angkatan ditetapkan saat pertama diterbitkan.','首次发布时自动分配期数。'])}</p>}
      {!!validationMessages.length&&<div>
        <AdminFormFeedback state="error" lang={lang}>
          {t(['Resolve these issues before publishing.','Selesaikan masalah berikut sebelum menerbitkan.','请先解决以下问题，再发布班次。'])}
        </AdminFormFeedback>
        <ul>{validationMessages.map(message=><li key={message}>{message}</li>)}</ul>
      </div>}
      {error&&<p role="alert">{error}</p>}
      {pending&&<><CrmSaveFeedback state="unknown" lang={lang}/><button type="button" disabled={busy} onClick={()=>void check()}>{t(['Check save result','Periksa hasil simpan','查询保存结果'])}</button></>}
      {previewRow&&<EnrollmentLearnerPreview row={previewRow} language={lang}/>}
    </AdminEditor>}
    {insertion&&<CrmOperationLayer compose title={<>{t(['Add to class','Tambah siswa ke kelas','办理插班'])}<AdminRequiredNote inline lang={lang}/></>}
      lang={lang} isLight={isLight} customerContext={false} busy={busy} onClose={()=>{
        if(busy||pending)return;
        if(dirty)setDiscard(true);else setInsertion(undefined);
      }}>
      <AdminForm lang={lang} className="crm-editor-compose crm-course-editor" onChange={()=>setDirty(true)} onSubmit={event=>{
        event.preventDefault();void saveInsertion(new FormData(event.currentTarget));
      }}>
        <div className="crm-editor-scroll">
          <p>{insertion.row.level} · {insertion.row.schedule}</p>
          <p>{t(['Confirm tuition with the learner before reserving a seat. The payment deadline uses the enrollment rules in effect when you save.',
            'Konfirmasikan biaya dengan siswa sebelum memesan kursi. Batas pembayaran mengikuti aturan pendaftaran saat Anda menyimpan.',
            '分配席位前请先与学员确认应付金额。付款和提交凭证的截止时间按保存时生效的报名规则计算。'])}</p>
      {error&&<p role="alert">{error}</p>}
          {pending&&<CrmSaveFeedback state={busy?"saving":"unknown"} lang={lang}>{!busy&&checkMessage}</CrmSaveFeedback>}
          <AdminField required>{t(['Learner name','Nama siswa','学员姓名'])}<input name="name" required maxLength={120} disabled={busy||!!pending}/></AdminField>
          <AdminField required>{t(['Email','Email','电子邮箱'])}<input name="email" type="email" required maxLength={254} disabled={busy||!!pending}/></AdminField>
          <AdminField required>{t(['Phone with country code','Nomor telepon dengan kode negara','手机号（含国家区号）'])}
            <input name="phone" type="tel" required disabled={busy||!!pending}/></AdminField>
          <AdminField required>{t(['Agreed tuition (Rp)','Biaya yang disepakati (Rp)','已确认应付金额（Rp）'])}
            <input name="price" type="number" min="1" max="1000000000" step="1" required defaultValue={insertion.row.price} disabled={busy||!!pending}/></AdminField>
          <label className="admin-field admin-field--choice"><input type="checkbox" name="confirmed" required disabled={busy||!!pending}/>
            <span>{t(['The learner agreed to join at this amount','Siswa menyetujui pendaftaran dengan biaya ini','学员已确认加入并同意应付金额'])} *</span></label>
        </div>
        <AdminFormActions className="crm-editor-actions">
          {pending?<button type="button" className="crm-work-button" disabled={busy} onClick={()=>void checkInsertion().catch(()=>{})}>
            {t(['Check save result','Periksa hasil simpan','查询保存结果'])}</button>:<>
            <button type="button" className="crm-work-button" disabled={busy} onClick={()=>{if(dirty)setDiscard(true);else setInsertion(undefined);}}>
              {t(['Cancel','Batal','取消'])}</button>
            <button type="submit" className="crm-work-button" data-primary disabled={busy}>{t(['Confirm and reserve seat','Konfirmasi dan pesan kursi','确认并分配席位'])}</button>
          </>}
        </AdminFormActions>
      </AdminForm>
    </CrmOperationLayer>}
    {discard && <CrmDiscardDialog lang={lang} isLight={isLight} onKeep={() => setDiscard(false)} onDiscard={() => {
      setDiscard(false); setDirty(false); setDraft(undefined); setInsertion(undefined); setError('');
    }}/>}
    {confirmDates&&draft?.publishedDates&&<AdminConfirmation light={isLight}
      title={t(['Confirm changes to class dates?','Konfirmasi perubahan tanggal kelas?','确认修改班次日期？'])}
      description={t(['Review the changed dates in WIB before saving.','Periksa perubahan tanggal dalam WIB sebelum menyimpan.','请核对以下 WIB 时间，再确认保存。'])}
      cancelLabel={t(['Back to editing','Kembali ke pengeditan','返回编辑'])}
      confirmLabel={t(['Confirm and save','Konfirmasi dan simpan','确认并保存'])}
      onCancel={()=>setConfirmDates(false)} onConfirm={()=>{setConfirmDates(false);void save();}}>
      <ul>{datesToConfirm.map(key=><li key={key}>
        {t(dateTimeLabels[key])} {draft.publishedDates?.[key].replace('T',' ')} → {draft.config[key].replace('T',' ')}
      </li>)}</ul>
    </AdminConfirmation>}
    {deleting&&<AdminConfirmation light={isLight} danger busy={busy}
      title={t(['Delete class draft?','Hapus draf kelas?','删除班次草稿？'])}
      description={enrollmentClassTitle(deleting.row,lang)+' · '+t(['This action cannot be undone.','Tindakan ini tidak dapat dibatalkan.','删除后无法恢复。'])}
      cancelLabel={deleteUnknown?t(['Close','Tutup','关闭']):t(['Cancel','Batal','取消'])}
      confirmLabel={deleteUnknown?t(['Check result','Periksa hasil','查询结果']):t(['Delete','Hapus','删除'])}
      confirmDisabled={!deleteUnknown&&!!deleteError}
      onCancel={()=>{if(!deletingInFlight.current)setDeleting(undefined);}} onConfirm={()=>void deleteClass()}>
      {deleteError&&<p role="alert">{deleteError}</p>}
    </AdminConfirmation>}
    {closing&&<CrmDiscardDialog lang={lang} isLight={isLight}
      title={t(['Confirm the class will not open?','Konfirmasi kelas tidak dibuka?','确认这个班不开班？'])}
      description={t(['New applications and transfers stop. Existing payment records remain available.','Pendaftaran dan transfer baru dihentikan. Riwayat pembayaran tetap tersedia.','关闭新报名和转账入口，保留已有付款记录。'])}
      keepLabel={t(['Go back','Kembali','返回'])} discardLabel={t(['Confirm','Konfirmasi','确认不开班'])}
      onKeep={()=>{if(!busy)setClosing(undefined);}} onDiscard={()=>{
        if(busy)return;
        setBusy(true);setError('');
        void enrollmentPost(endpoint+'/'+closing.id+'/cancel',{requestId:closing.requestId})
          .then(async()=>{setClosing(undefined);setSaved(true);await load();})
          .catch(()=>{setClosing(undefined);setError(t(['Check the current class state.','Periksa status kelas terbaru.','请刷新核对当前班次状态。']));})
          .finally(()=>setBusy(false));
      }}/>}
  </section>;
}
