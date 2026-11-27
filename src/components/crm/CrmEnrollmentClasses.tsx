import {enrollmentClassTimeZones,enrollmentTimeZone,enrollmentTimeZoneLabel,isEnrollmentClassTimeZone,type EnrollmentClassTimeZone} from '../../utils/enrollmentDateFormat';
import {formatCrmOperatingTime} from '../../utils/crmOperatingTime';
import {AdminPageHeader} from '../admin/AdminPageHeader';
import {Plus,X} from 'lucide-react';
import {AdminCalendarPicker, type AdminCalendarDayMark} from '../admin/AdminCalendarPicker';
import {AdminDateField,AdminTimeField} from '../admin/AdminDateField';
import {previewEnrollmentClassSchedule} from '../../utils/enrollmentClassSchedule';
import {AdminSecondaryActions} from '../admin/AdminRecordActions';
import {AdminConfirmation} from '../admin/AdminConfirmation';
import {AdminDisclosure} from '../admin/AdminDisclosure';
import {EnrollmentSettingsSelect,useEnrollmentSettingsFilters,type EnrollmentListCopy} from './EnrollmentSettingsListControls';
import {CrmEnrollmentTemplates} from './CrmEnrollmentTemplates';
import {compareEnrollmentTemplates,enrollmentTemplateClassFields,type EnrollmentTeachingCourse,type EnrollmentTemplate} from '../../utils/enrollmentTemplates';
import {EnrollmentLearnerPreview} from './EnrollmentLearnerPreview';
import {AdminRefreshAction} from '../admin/AdminRefreshAction';
import {AdminEditor} from '../admin/AdminEditor';
import {AdminPageAction} from '../admin/AdminPageAction';
import {AdminListState,AdminListTable} from '../admin/AdminList';
import {AdminListToolbar} from '../admin/AdminListToolbar';
import {AdminStatus} from '../AdminStatus';
import {AdminRowAction} from '../admin/AdminListControl';
import { compareEnrollmentClassStarts,enrollmentClassDateFilter,enrollmentClassManagementPath,formatEnrollmentClassStart } from '../../utils/crmEnrollmentManagement';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AdminField } from '../AdminForm';
import { AdminStaticField, AdminFormFeedback, AdminSavedReadError, AdminFormGrid, AdminFormSection, AdminFormSummary } from '../AdminFormLayout';
import { CrmSaveFeedback } from './CrmDetailWorkspace';
import { AdminDiscardDialog } from '../admin/AdminDiscardDialog';
import { AdminSingleSelect, type AdminSelectChoice } from '../admin/AdminSingleSelect';
import {facultyName,type FacultyChoice} from '../../utils/crmFaculty';
import { enrollmentAllowsWeekday,enrollmentAutofillStart,enrollmentDateWeekday,enrollmentScheduleErrors,enrollmentSessionStart,enrollmentClassTitle,enrollmentTeacherLabel,enrollmentInstant,enrollmentLevels,enrollmentPeriods,enrollmentWeekdays,enrollmentWeeklyScheduleText,isEnrollmentSessionTime,type EnrollmentScheduleReviewField,type EnrollmentWeeklySchedule } from '../../utils/enrollmentCatalog';
import { allowedEnrollmentClassDate,emptyEnrollmentWeek,updateEnrollmentDraftFirst,type EnrollmentClassDraftConfig } from '../../utils/enrollmentClassDraft';
import type { EnrollmentClassAdmin, EnrollmentClassConfig } from '../../utils/enrollmentCatalog';
import { validEnrollmentHolidayDate } from '../../utils/enrollmentCatalog';
import type { CrmLanguage } from '../../utils/crmLanguage';
import { formatCurrency } from '../../utils/currency';
import { enrollmentPost } from '../../services/enrollmentSession';

type Copy = readonly [string, string, string];

const enrollmentZoneNames:Record<EnrollmentClassTimeZone,Copy>={
  'Asia/Jakarta':['Jakarta (WIB)','Jakarta (WIB)','雅加达（WIB）'],
  'Africa/Lagos':['Lagos (WAT)','Lagos (WAT)','拉各斯（WAT）'],
};
const periodsPerSessionChoices=[1,2,3,4].map(periods=>({value:String(periods),label:String(periods)}));

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
  return <div className="crm-class-holidays" data-admin-full-width="">
    <AdminDisclosure density="compact" heading={label+(dates.length>0?` · ${count}`:'')}>
      {previewOnly&&<small>{t(['This class has orders. Break date changes are for preview only.',
        'Kelas ini memiliki pesanan. Perubahan tanggal libur hanya untuk pratinjau.','此班次已有订单，停课日期变更仅供预览。'])}</small>}
      {review}
      <div className="crm-class-holiday-options">
        <AdminCalendarPicker multiple value={dates} onChange={changeDates} label={label} placeholder={trigger}
          lang={lang} anchorDate={validEnrollmentHolidayDate(firstDate)?firstDate:undefined} disabled={disabled}
          dayMarks={marks} isDateSelectable={(_,mark)=>!!mark} legend={[classDay,holiday,makeup]} selectionPreview={selection=>{
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
      </div>
      {!!plan?.unneededDates.length&&<small>{t(['No session to skip','Tidak ada pertemuan yang dilewati','未影响课次'])} · {plan.unneededDates.join(' · ')}</small>}
      {plan&&plan.first!==firstDate&&<small className="crm-class-first-break-warning" role="status">{t([
        `The first session falls on a break. Suggested first session: ${plan.first}. Confirm any change to the first session or registration deadline separately.`,
        `Pertemuan pertama jatuh pada hari libur. Usulan tanggal mulai: ${plan.first}. Konfirmasi perubahan tanggal mulai atau batas pendaftaran secara terpisah.`,
        `首课当天选为停课，拟顺延至 ${plan.first}。首课和报名截止保留原值，调整需另行确认。`,
      ])}</small>}
    </AdminDisclosure>
    {plan&&<p className="crm-class-end-date"><strong>{endLabel}</strong> <time dateTime={plan.end}>{plan.end}</time></p>}
  </div>;
}
type Catalog = { classes: EnrollmentClassAdmin[]; courses: EnrollmentTeachingCourse[]; templates: EnrollmentTemplate[];teachers?:FacultyChoice[] };
type ClassDraftConfig=EnrollmentClassDraftConfig;
type Draft = { id: string; revision: number; state: 'draft' | 'published'; config: ClassDraftConfig;
  autoFirstDay?: number;
  hasOrders?: boolean;
  publishedDates?: Pick<EnrollmentClassConfig,'firstLesson'|'enrollmentCloses'> };
const classFiltersDefault={search:'',level:'',format:'',period:'',status:'',date:'',teacher:'',sort:'upcoming'};
const classStatusCopy={
  draft:['Draft','Draf','草稿'],
  published:['Published','Diterbitkan','已发布'],
  opened:['Confirmed','Dikonfirmasi','已成班'],
  cancelled:['Cancelled','Dibatalkan','已取消'],
} as const;
const classStatus=(row:EnrollmentClassAdmin)=>row.state==='published'&&row.opened?'opened':row.state;
const initial: ClassDraftConfig = {
  courseId: '', level: 'HSK 1', format: 'standard', period: '',
  firstLesson: '', enrollmentCloses: '', enrollmentClosesMode:'automatic', schedule: '',
  sessions: 23, minutes: 45, minimumPaid: 10, capacity: 15, price: 0, standardPrice: null,
  learningOutcomes: '', material: '', resources: '', teacher: '',
};
const dateTimeLabels = {
  firstLesson: ['First session', 'Pertemuan pertama', '首次上课'],
  enrollmentCloses: ['Self-service deadline', 'Batas daftar mandiri', '自助报名截止'],
} satisfies Record<string,Copy>;

type ScheduleChange = {kind:'period'; value:EnrollmentClassConfig['period']} |
  {kind:'zone'; value:EnrollmentClassTimeZone} | {kind:'uniform'};

export function CrmEnrollmentClasses({ lang, isLight, canSales, secondaryActions, target, createFrom, onShowAll, onDraftChange }: {
  lang: CrmLanguage; isLight: boolean; canSales:boolean; secondaryActions?:ReactNode; target?: string; createFrom?: string; onShowAll: () => void; onDraftChange: (dirty:boolean) => void;
}) {
  const t = ([en, id, zh]: Copy) => lang === 'zh' ? zh : lang === 'id' ? id : en;
  const fieldHintId=useId();
  const [catalog, setCatalog] = useState<Catalog>();
  const [readState,setReadState]=useState<'loading'|'ready'|'error'|'denied'>('loading');
  const {filters,change:changeFilters,clear}=useEnrollmentSettingsFilters('classes',classFiltersDefault);
  const [draft, setDraft] = useState<Draft>();
  const [quoteDirty,setQuoteDirty]=useState(false);
  const [quoteTemplateId,setQuoteTemplateId]=useState<string>();
  const [preview,setPreview]=useState(false);
  const [confirmDates,setConfirmDates]=useState(false);
  const [scheduleChange,setScheduleChange]=useState<ScheduleChange>();
  const [teacherCleared,setTeacherCleared]=useState(false);
  const createOpened=useRef<string|undefined>(undefined);
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
  const [awaitingSavedRead,setAwaitingSavedRead]=useState(false);
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
      setCatalog(data);setReadState('ready');setAwaitingSavedRead(false);
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
    setScheduleChange(undefined);
    setTeacherCleared(false);
    if (row) {
      const { id, revision, state, opened, hasOrders, ...config } = row;
      const publishedDates=state==='published'?{firstLesson:config.firstLesson,enrollmentCloses:config.enrollmentCloses}:undefined;
      setDraft({id,revision,state,config,hasOrders,publishedDates});
    } else {
      setDraft({ id: crypto.randomUUID(), revision: 0, state: 'draft', config: { ...initial } });
    }
  }
  function chooseTemplate(id:string,{initial=false}={}){
    const template=catalog?.templates.find(item=>item.id===id);
    const course=catalog?.courses.find(item=>item.id===template?.courseId);
    const derived=template&&course&&enrollmentTemplateClassFields(template,course);
    if(!derived)return;
    const teacherChanged=!!draft?.config.teacherType&&draft.config.teacherType!==derived.teacherType;
    setTeacherCleared(teacherChanged&&Boolean(draft?.config.teacherId||draft?.config.teacher));
    setDraft(value=>value&&({...value,config:{...value.config,...derived,
      teacherId:value.config.teacherType&&value.config.teacherType!==derived.teacherType?'':value.config.teacherId,
      teacher:value.config.teacherType&&value.config.teacherType!==derived.teacherType?'':value.config.teacher}}));
    if(!initial)setDirty(true);
    setError('');
  }
  useEffect(()=>{
    if(!catalog||!createFrom||createOpened.current===createFrom)return;
    createOpened.current=createFrom;
    edit();
    chooseTemplate(createFrom,{initial:true});
  },[catalog,createFrom]);
  function changeDateTime(name:keyof typeof dateTimeLabels,value:string) {
    if(name==='enrollmentCloses'&&value===draft?.config.enrollmentCloses)return;
    setDraft(current=>{
      if(!current)return current;
      if(name==='enrollmentCloses')return {...current,config:{...current.config,enrollmentCloses:value,enrollmentClosesMode:'custom'}};
      if(current.state==='published')return {...current,config:enrollmentAutofillStart(current.config,value)};
      const next=updateEnrollmentDraftFirst(current.config,value,current.autoFirstDay);
      return {...current,...next};
    });
    setDirty(true);
  }
  const weekly=draft?.config.weeklySchedule??emptyEnrollmentWeek;
  const firstDate=draft?.config.firstLesson.split('T')[0]??'';
  const firstDay=allowedEnrollmentClassDate(draft?.config.period??'',firstDate)?enrollmentDateWeekday(firstDate):undefined;
  const classReady=!!draft?.config.templateId||!!draft?.revision&&!!draft.config.courseId;
  const firstReady=firstDay!==undefined&&!!enrollmentInstant(draft?.config.firstLesson,draft?.config.timeZone);
  const linkedSchedule=draft?.state==='draft';
  const periodsLabel=t(['Periods per session','Jam pelajaran per pertemuan','每次上课节数']);
  const classZone=draft?.config.timeZone??enrollmentTimeZone;
  const zoneLabel=enrollmentTimeZoneLabel(classZone);
  const withZone=(label:string)=>label+(lang==='zh'?'（'+zoneLabel+'）':' ('+zoneLabel+')');
  const scheduleText=enrollmentWeeklyScheduleText(draft?.config.weeklySchedule,draft?.config.minutes??45,lang,classZone);
  const timeSlotMessage=draft?.config.period==='mixed'
    ? t(['Select at least one weekday and one weekend day.','Pilih minimal satu hari kerja dan satu hari akhir pekan.','工作日与周末班须同时选择工作日和周末的上课日。'])
    :draft?.config.period==='weekend'
    ? t(['Weekend classes must use Saturday or Sunday.','Kelas akhir pekan harus dijadwalkan pada Sabtu atau Minggu.','周末班的每周上课日只能选择周六、周日。'])
    : t(['Weekday evening classes must use Monday to Friday.','Kelas malam hari kerja harus dijadwalkan pada Senin hingga Jumat.','工作日晚间班的每周上课日只能选择周一至周五。']);
  const fieldErrors=draft?enrollmentScheduleErrors(draft.config,lang):{};
  const incompleteWeeklyTime=[weekly.start,...Object.values(weekly.startByDay??{})].some(time=>time&&!isEnrollmentSessionTime(time));
  if(incompleteWeeklyTime)fieldErrors.start=t(['Select both the hour and minute for each start time.',
    'Pilih jam dan menit untuk setiap waktu mulai.','请选择完整的上课小时和分钟。']);
  if(draft&&!draft.config.courseId)fieldErrors.templateId=t(['Select a class template.','Pilih templat kelas.','请选择班型模板。']);
  const hasFieldErrors=Object.keys(fieldErrors).length>0;
  // New forms use the footer for missing fields and show inline feedback for entered values.
  const inlineErrors:Record<string,string|undefined>=draft?.revision===0?{
    ...fieldErrors,
    templateId:undefined,
    period:undefined,
    firstLesson:draft.config.firstLesson.split('T')[1]?fieldErrors.firstLesson:undefined,
    enrollmentCloses:draft.config.enrollmentCloses.replace('T','')?fieldErrors.enrollmentCloses:undefined,
    start:(weekly.startByDay?Object.values(weekly.startByDay).some(Boolean):weekly.start)?fieldErrors.start:undefined,
  }:fieldErrors;
  const hint=(name:string)=>inlineErrors[name]?<small id={fieldHintId+'-'+name} role="alert">{inlineErrors[name]}</small>:null;
  const hintProps=(name:string)=>({'aria-invalid':!!inlineErrors[name]||undefined,'aria-describedby':inlineErrors[name]?fieldHintId+'-'+name:undefined});
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
    fieldErrors.lessons,fieldErrors.enrollmentCloses,templateWarning,hasSourceReview&&sourceReviewMessage].filter(Boolean);
  const publishBlocked=hasFieldErrors||hasSourceReview||!!templateUpdate;
  const draftSaveError=templateWarning||fieldErrors.templateId||fieldErrors.period||
    (!enrollmentInstant(draft?.config.firstLesson,classZone)&&fieldErrors.firstLesson)||
    (!enrollmentInstant(draft?.config.enrollmentCloses,classZone)&&fieldErrors.enrollmentCloses)||
    (incompleteWeeklyTime&&fieldErrors.start)||fieldErrors.lessons;
  const saveError=draft?.state==='published'?validationMessages[0]:draftSaveError;
  const saveBlocked=!draft||!!saveError;
  const firstSessionOnBreak=draft?.state==='draft'&&draft.config.holidayDates?.includes(draft.config.firstLesson.slice(0,10));
  const datesToConfirm=(['firstLesson','enrollmentCloses'] as const).filter(key=>
    draft?.publishedDates&&draft.config[key]!==draft.publishedDates[key]);
  const firstSessionOnBreakMessage=t(['The first session falls on a break. Confirm the first session and signup cutoff before publishing.',
    'Pertemuan pertama jatuh pada hari libur. Konfirmasi pertemuan pertama dan batas pendaftaran sebelum menerbitkan.',
    '首课当天已选为停课。请先确认首课及报名截止，再发布班次。']);
  const previewRow=classReady&&draft?.config.courseId&&draft.config.period&&(draft.state==='published'||firstReady)
    ? {...draft.config,period:draft.config.period,id:draft.id,state:draft.state,revision:draft.revision}
    : undefined;
  function changeWeekly(values:Partial<EnrollmentWeeklySchedule>){
    const next={...weekly,...values};
    if(next.startByDay&&values.days){
      next.startByDay=Object.fromEntries(next.days.map(day=>[day,next.startByDay?.[day]??next.start]));
    }
    setDraft(current=>current&&({...current,config:{...current.config,weeklySchedule:next,
      schedule:enrollmentWeeklyScheduleText(next,current.config.minutes,lang,current.config.timeZone)}}));
    setDirty(true);
  }
  function applyScheduleChange(change:ScheduleChange){
    setScheduleChange(undefined);
    if(change.kind==='uniform'){
      changeWeekly({startByDay:undefined,start:firstReady?draft!.config.firstLesson.slice(11):weekly.start});
      return;
    }
    setDraft(current=>{
      if(!current)return current;
      if(change.kind==='zone')return {...current,config:{...current.config,timeZone:change.value}};
      const period=change.value;
      const {firstLesson}=current.config;
      const date=firstLesson.split('T')[0];
      const first=allowedEnrollmentClassDate(period,date)?firstLesson:'T'+(firstLesson.split('T')[1]??'');
      const plan=current.config.weeklySchedule??emptyEnrollmentWeek;
      const days=plan.days.filter(day=>enrollmentAllowsWeekday(period,day));
      const keptWeek={...plan,days,startByDay:plan.startByDay&&Object.fromEntries(
        days.map(day=>[day,plan.startByDay?.[day]??plan.start]))};
      return {...current,...updateEnrollmentDraftFirst({...current.config,period,weeklySchedule:keptWeek},first,current.autoFirstDay)};
    });
    setDirty(true);
  }
  function requestScheduleChange(change:ScheduleChange){
    if(!draft)return;
    const config=draft.config;
    const needsConfirmation=change.kind==='period'?(!!firstDate&&!allowedEnrollmentClassDate(change.value,firstDate)||
      weekly.days.some(day=>!enrollmentAllowsWeekday(change.value,day))):
      change.kind==='zone'?Boolean(firstDate||config.enrollmentCloses.split('T')[0]):
      weekly.days.some(day=>enrollmentSessionStart(weekly,day)!==(firstReady?config.firstLesson.slice(11):weekly.start));
    if(needsConfirmation)setScheduleChange(change);
    else applyScheduleChange(change);
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
    setAwaitingSavedRead(true);
    await load().catch(()=>{});
  }
  async function save(state:Draft['state']=draft?.state??'draft') {
    if (!draft || saveBlocked || busy || pending) return;
    if(state==='published'&&(publishBlocked||!draft.config.price||firstSessionOnBreak))return;
    if(state==='published'&&draft.state!=='published'&&!draft.config.teacherId){
      setError(t(['Select a teacher before publishing.','Pilih pengajar sebelum menerbitkan.','请先选择授课教师。']));
      return;
    }
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
        setError(failure.error==='faculty_required'
          ? t(['Select a teacher before publishing.','Pilih pengajar sebelum menerbitkan.','请先选择授课教师。'])
          : failure.error==='faculty_unavailable'
          ? t(['The teacher is unavailable for this class. Select another teacher.','Pengajar tidak tersedia untuk kelas ini. Pilih pengajar lain.','该教师当前不可指派给这个班次，请重新选择。'])
          : failure.error==='faculty_assignment_fixed'
          ? t(['This class has started. Its teacher assignment is fixed.','Kelas sudah dimulai. Penugasan pengajar dikunci.','该班次已开课，教师指派已锁定。'])
          : failure.error==='enrollment_class_schedule_review_pending'
          ? sourceReviewMessage
          : failure.error==='enrollment_class_break_preview_only'
          ? t(['An order now exists. Reopen the editor to preview break dates.','Sudah ada pesanan. Buka ulang editor untuk melihat pratinjau tanggal libur.','该班次已有订单，请重新打开编辑器预览停课日期。'])
          : failure.error==='enrollment_class_first_session_on_break'
          ? firstSessionOnBreakMessage
          : failure.error==='enrollment_class_timezone_fixed'
          ? t(['The class time zone is fixed after publication.','Zona waktu kelas terkunci setelah diterbitkan.','班次发布后，时区不可更改。'])
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
  const title = t(['Classes', 'Kelas', '班次']);
  const listState=readState==='loading'&&catalog?'ready':readState;
  const normalize=(value:string)=>value.normalize('NFKC').toLowerCase().trim();
  const tokens=normalize(filters.search).split(/\s+/u).filter(Boolean);
  const now=Date.now();
  const matchesDate=enrollmentClassDateFilter(filters.date,now);
  const teachersById=new Map(catalog?.teachers?.map(teacher=>[teacher.id,teacher]));
  const unassignedTeacher=t(['Unassigned','Belum ditugaskan','未分配']);
  const visibleClasses=catalog?.classes.flatMap(row=>{
    if(target&&row.id!==target)return [];
    const start=enrollmentInstant(row.firstLesson,row.timeZone);
    if(!target&&((filters.level&&row.level!==filters.level)||(filters.format&&row.format!==filters.format)||
      (filters.period&&row.period!==filters.period)||(filters.status&&classStatus(row)!==filters.status)||
      (filters.teacher&&row.teacherType!==filters.teacher)||!matchesDate(start,row.timeZone)))return [];
    const schedule=enrollmentWeeklyScheduleText(row.weeklySchedule,row.minutes,lang,row.timeZone)||(row.weeklySchedule?'':row.schedule);
    const teacher=row.teacherId?teachersById.get(row.teacherId):undefined;
    const teacherType=enrollmentTeacherLabel(row.teacherType,lang);
    const teacherDetail=row.teacherId?(teacher&&facultyName(teacher.names,lang))||row.teacher.trim():unassignedTeacher;
    const entry={row,schedule,teacherType,teacherDetail,time:start?.getTime()??null,firstSession:start?formatEnrollmentClassStart(start,row.timeZone)+' '+enrollmentTimeZoneLabel(row.timeZone):'—'};
    if(target||!tokens.length)return [entry];
    const haystack=normalize([row.id,row.courseName,row.level.replace(/\s+/gu,''),enrollmentClassTitle(row,lang),
      schedule,row.schedule,row.firstLesson,entry.firstSession,teacherType,teacherDetail,row.teacher].join(' '));
    return tokens.every(token=>haystack.includes(token))?[entry]:[];
  }).sort((a,b)=>compareEnrollmentClassStarts(a.time,b.time,filters.sort,now)||a.row.id.localeCompare(b.row.id));
  const advancedCount=Number(!!filters.period)+Number(!!filters.date)+Number(!!filters.teacher);
  const select=(field:keyof typeof classFiltersDefault,label:EnrollmentListCopy,options:AdminSelectChoice[],all?:EnrollmentListCopy)=>
    <EnrollmentSettingsSelect lang={lang} isLight={isLight} label={label} all={all} options={options}
      value={filters[field]} onChange={value=>changeFilters({[field]:value})}/>;
  const additionalFilters=<>
    {select('date',['First-session date (class time zone)','Tanggal pertemuan pertama (zona kelas)','首课日期（班次当地时间）'],[
      {value:'7',label:t(['Next 7 days including today','7 hari ke depan termasuk hari ini','未来 7 天（含今天）'])},
      {value:'30',label:t(['Next 30 days including today','30 hari ke depan termasuk hari ini','未来 30 天（含今天）'])},
      {value:'past',label:t(['First session has passed','Pertemuan pertama sudah lewat','首课时间已过'])},
    ],['All first-session dates','Semua tanggal pertemuan pertama','全部首课日期'])}
    {select('teacher',['Teacher type','Jenis pengajar','教师类型'],(['local','foreign'] as const).map(value=>({value,label:enrollmentTeacherLabel(value,lang)})),
      ['All teacher types','Semua jenis pengajar','全部教师类型'])}
  </>;
  const fieldDisabled=busy||!!pending;
  const periodsHint=hintProps('lessons');
  const startHint=hintProps('start');
  const dateTimeField=(name:keyof typeof dateTimeLabels)=>{
    const label=withZone(t(dateTimeLabels[name]));
    const firstLesson=name==='firstLesson';
    const anchorDate=validEnrollmentHolidayDate(firstDate)?firstDate:formatCrmOperatingTime(new Date().toISOString(),classZone).slice(0,10);
    const dateAllowed=name==='firstLesson'
      ? (day:string)=>allowedEnrollmentClassDate(draft?.config.period??'',day)
      : linkedSchedule&&validEnrollmentHolidayDate(firstDate)?(day:string)=>day<=firstDate:undefined;
    return <div className="crm-class-date-time" data-admin-full-width="" data-admin-stack="">
      <AdminDateField label={label} lang={lang} withTime required
        value={draft?.config[name]??''} onChange={value=>changeDateTime(name,value)}
        disabled={fieldDisabled||firstLesson&&!draft?.config.period} error={inlineErrors[name]}
        calendar={{anchorDate,isDateSelectable:dateAllowed}}/>
      {firstLesson&&sourceHint(name)}
    </div>;
  };
  const selectField=(name:'period'|'timeZone',label:Copy,options:AdminSelectChoice[])=>
    draft?.state==='published'
      ? <AdminStaticField label={t(label)} value={options.find(option=>option.value===(name==='timeZone'?classZone:draft.config.period))?.label}/>
      : <AdminField required>{t(label)}
      <AdminSingleSelect label={t(label)} value={name==='timeZone'?classZone:draft?.config[name]??''} options={options} lang={lang} isLight={isLight}
        disabled={fieldDisabled} onChange={value=>{
          if(name==='timeZone'&&isEnrollmentClassTimeZone(value)&&value!==classZone)requestScheduleChange({kind:'zone',value});
          if(name==='period'&&value!==draft?.config.period&&enrollmentPeriods.some(period=>period===value))
            requestScheduleChange({kind:'period',value:value as EnrollmentClassConfig['period']});
        }}/>
      {hint(name)}
    </AdminField>;
  const teacherLabel=t(['Teacher','Pengajar','授课教师']);
  const unassigned=t(['Unassigned','Belum ditugaskan','未分配']);
  return <section className="crm-course-catalog">
    <AdminPageHeader title={title}
      subtitle={t(['Create classes from templates, set lesson schedules and preview before publishing.','Buat kelas dari templat, atur jadwal, dan lihat pratinjau sebelum menerbitkan.','从班型模板创建班次，维护上课时间并预览发布。'])} actions={<>
        {secondaryActions}
        {target&&<AdminRowAction onClick={onShowAll}>{t(['View all classes','Lihat semua kelas','查看全部班次'])}</AdminRowAction>}
        <AdminRefreshAction label={t(['Refresh', 'Segarkan', '刷新'])} loading={readState==='loading'} onClick={refresh}/>
        <AdminPageAction icon={Plus} variant="primary" label={t(['Create class','Buat kelas','创建班次'])} disabled={readState!=='ready'} onClick={()=>edit()}/>
    </>}/>
    {!!error && !draft && <p role="alert">{error}</p>}
    {awaitingSavedRead&&readState==='error'&&<AdminSavedReadError lang={lang} onRetry={refresh}/>}
    {saved && <CrmSaveFeedback state="saved" lang={lang}/>}
    {deleted && <CrmSaveFeedback state="saved" lang={lang}>{t(['Class draft deleted.','Draf kelas dihapus.','班次草稿已删除。'])}</CrmSaveFeedback>}
    {!target&&catalog&&<AdminListToolbar lang={lang} isLight={isLight} count={visibleClasses?.length??0} total={catalog.classes.length}
      filtered={!!(filters.search||filters.level||filters.format||filters.status||advancedCount)} onClear={clear}
      search={{label:t(['Search classes','Cari kelas','搜索班次']),placeholder:t(['Class, teacher or schedule','Kelas, pengajar, atau jadwal','班次、教师或课表']),
        value:filters.search,onChange:search=>changeFilters({search})}}
      sort={{value:filters.sort,onChange:sort=>changeFilters({sort}),options:[
        {value:'upcoming',label:t(['Upcoming classes first','Kelas mendatang dahulu','即将开课优先'])},
        {value:'oldest',label:t(['First session date · Oldest to newest','Tanggal pertemuan pertama · Terlama ke terbaru','首课日期从早到晚'])},
        {value:'latest',label:t(['First session date · Newest to oldest','Tanggal pertemuan pertama · Terbaru ke terlama','首课日期从晚到早'])},
      ]}}
      more={{count:advancedCount,fields:<>
        {select('period',['Time slot','Waktu kelas','时段'],[
          {value:'weekday-evening',label:t(['Weekday evening','Malam hari kerja','工作日晚班'])},
          {value:'mixed',label:t(['Weekday & weekend','Hari kerja & akhir pekan','工作日与周末'])},
          {value:'weekend',label:t(['Weekend','Akhir pekan','周末班'])},
        ],['All time slots','Semua waktu kelas','全部时段'])}
        {additionalFilters}
      </>}}>
        {select('level',['Level','Level','级别'],enrollmentLevels.map(value=>({value,label:value})),['All levels','Semua level','全部级别'])}
        {select('format',['Class type','Jenis kelas','班型'],[
          {value:'standard',label:t(['Standard class','Kelas standar','标准班'])},
          {value:'small',label:t(['Small group','Kelompok kecil','小班'])},
        ],['All class types','Semua jenis kelas','全部班型'])}
        {select('status',['Class status','Status kelas','班次状态'],Object.entries(classStatusCopy).map(([value,copy])=>({value,label:t(copy)})),
          ['All statuses','Semua status','全部状态'])}
    </AdminListToolbar>}
    {(listState!=='ready'||!visibleClasses?.length)&&!(awaitingSavedRead&&readState==='error')&&<AdminListState lang={lang}
      state={listState==='ready'?'empty':listState}
      message={listState==='ready'&&target?t(['Class not found.','Kelas tidak ditemukan.','班次不存在。'])
        :listState==='error'&&catalog?t(['Refresh failed. Showing the last loaded classes.','Gagal menyegarkan. Kelas yang terakhir dimuat masih ditampilkan.','刷新失败，仍显示上次读取的班次。']):undefined}
      onRetry={refresh}/>}
    {!!visibleClasses?.length&&<AdminListTable label={title} className="crm-course-list" busy={readState==='loading'} headers={[
      t(['Class','Kelas','班次']),{label:t(['Schedule','Jadwal','课表']),sort:target?undefined:filters.sort==='oldest'?'ascending':filters.sort==='latest'?'descending':'other'},
      {label:t(['Tuition','Biaya','学费']),numeric:true},
      t(['Status','Status','状态']),t(['Actions','Tindakan','操作']),
    ]}>
      {visibleClasses.map(({row,firstSession,schedule,teacherType,teacherDetail}) => <tr key={row.id}>
        <td>{enrollmentClassTitle(row,lang)}{(teacherType||teacherDetail)&&<><br/><small>
          {teacherType}{teacherType&&teacherDetail&&' · '}
          {row.teacherId?teacherDetail:<AdminStatus tone="danger" showDot={false}>{teacherDetail}</AdminStatus>}
        </small></>}</td><td>{firstSession}{schedule&&<><br/>{schedule.replace(/ (?:WIB|WAT)$/u,'')}</>}</td>
        <td className="crm-list-number">{formatCurrency(row.price, lang)}</td><td><AdminStatus showDot={false} tone={row.opened||row.state==='published'?'success':'neutral'}>{t(classStatusCopy[classStatus(row)])}</AdminStatus></td>
        <td><div className="flex flex-wrap items-center gap-x-3 gap-y-1">{canSales&&row.state!=='draft'&&<AdminRowAction href={enrollmentClassManagementPath(row.id)} title={t(['View enrollments','Lihat pendaftaran','查看报名'])}>{t(['View','Lihat','查看'])}</AdminRowAction>}
          {row.state!=='cancelled' && <AdminRowAction disabled={readState==='error'} onClick={() => edit(row)}>{t(['Edit', 'Ubah', '编辑'])}</AdminRowAction>}
          {row.canDelete&&<AdminRowAction title={t(['Delete draft','Hapus draf','删除班次草稿'])} disabled={readState!=='ready'} onClick={()=>{
            setDeleted(false);setDeleteError('');setDeleteUnknown(false);
            setDeleting({row,requestId:crypto.randomUUID()});
          }}>{t(['Delete','Hapus','删除'])}</AdminRowAction>}
          {row.state==='published'&&!row.opened&&<AdminSecondaryActions alwaysMenu disabled={readState==='error'} label={t(['More actions','Tindakan lain','更多操作'])}>
            <button type="button" onClick={()=>setClosing({id:row.id,requestId:crypto.randomUUID()})}>{t(['Cancel class','Batalkan kelas','取消班次'])}</button>
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
            : <>{saveError&&<AdminFormFeedback state="error" lang={lang} className="crm-class-quote-feedback">
                {saveError}
              </AdminFormFeedback>}
              <button type="button" className="crm-work-button" disabled={busy} onClick={close}>{t(['Cancel', 'Batal', '取消'])}</button>
              <button type="button" className="crm-work-button" disabled={busy||!previewRow} onClick={()=>setPreview(true)}>
                {t(['Preview for learners','Pratinjau siswa','学员预览'])}</button>
              <button type="submit" data-primary="" disabled={busy||saveBlocked}>{draft.state==='draft'?t(['Save draft','Simpan draf','保存草稿']):t(['Save','Simpan','保存'])}</button></>}
      </>}>
          {error && <p role="alert">{error}</p>}
          {readState==='error'&&<AdminRefreshAction label={t(['Retry loading latest settings','Coba muat ulang pengaturan terbaru','重新读取最新配置'])}
            loading={false} onClick={refresh}/>}
          {pending && <CrmSaveFeedback state={busy?"saving":"unknown"} lang={lang}>{!busy&&checkMessage}</CrmSaveFeedback>}
          {templateUpdate&&updatedFields&&<AdminFormSection title={t(['Template updated','Templat diperbarui','模板已更新'])}
            description={t(['Review the latest template before applying it. Your schedule and dates will be kept.','Periksa templat terbaru sebelum menerapkannya. Jadwal dan tanggal tetap tersimpan.','请核对后采用最新模板。已填写的课表和日期会保留。'])}>
            <AdminFormSummary fields={[
              [t(['Current enrollment total','Total pendaftaran saat ini','当前报名总价']),formatCurrency(draft.config.price,lang)],
              [t(['Latest enrollment total','Total pendaftaran terbaru','最新报名总价']),updatedFields.price?formatCurrency(updatedFields.price,lang):t(['Quote pending','Harga belum dikonfirmasi','报价待确认'])],
              [t(['Latest standard total','Total harga standar terbaru','最新标准总价']),updatedFields.standardPrice?formatCurrency(updatedFields.standardPrice,lang):'—'],
              [t(['Latest minimum fully paid','Minimum peserta lunas terbaru','最新人数下限（到账为准）']),updatedFields.minimumPaid],
              [t(['Latest capacity','Kapasitas terbaru','最新人数上限']),updatedFields.capacity],
            ]}/>
            <button type="button" className="crm-work-button" disabled={busy||!!pending} onClick={()=>chooseTemplate(templateUpdate.id)}>
              {t(['Apply latest template','Terapkan templat terbaru','采用最新模板'])}
            </button>
          </AdminFormSection>}
          <div data-admin-section-stack="open">
          <AdminFormSection variant="subgroup" title={t(['Template and course','Templat dan kursus','班型与课程'])}>
            {draft.state==='published'
              ? <AdminStaticField label={t(['Class template','Templat kelas','班型模板'])}
                  value={catalog?.templates.find(item=>item.id===draft.config.templateId)?.name}/>
              : <AdminField required={!draft.revision||!!draft.config.templateId}>
              {t(['Select a class template','Pilih templat kelas','选择班型模板'])}
              <AdminSingleSelect label={t(['Select a class template','Pilih templat kelas','选择班型模板'])} lang={lang} isLight={isLight}
                value={draft.config.templateId??''} disabled={fieldDisabled}
                options={catalog?.templates.filter(item=>item.format!=='one-on-one').sort(compareEnrollmentTemplates(catalog.courses,lang)).map(item=>({value:item.id,
                  label:item.name+(item.saleUnitPrice?'':' · '+t(['Quote pending','Harga belum dikonfirmasi','报价待确认']))}))??[]}
                onChange={chooseTemplate}/>
            </AdminField>}
            {hint('templateId')}
            {classReady&&<AdminFormSummary fields={[
              [t(['Course','Kursus','课程']),draft.config.courseName||draft.config.level,'wide'],
              [t(['Periods × minutes','Jam pelajaran × menit','节数 × 分钟']),draft.config.sessions+' × '+draft.config.minutes],
              [t(['Enrollment total','Total harga pendaftaran','报名总价']),draft.config.price?<strong>{formatCurrency(draft.config.price,lang)}</strong>:
                t(['Quote pending','Harga belum dikonfirmasi','报价待确认'])],
              [t(['Teacher type','Jenis pengajar','教师类型']),draft.config.teacherType?enrollmentTeacherLabel(draft.config.teacherType,lang):'—'],
              [t(['Minimum fully paid','Minimum peserta lunas','人数下限（到账为准）']),draft.config.minimumPaid],
              [t(['Capacity','Kapasitas','人数上限']),draft.config.capacity],
              ...(draft.config.standardPrice?[[t(['Standard total','Total harga standar','标准总价']),<del>{formatCurrency(draft.config.standardPrice,lang)}</del>] as const]:[]),
            ]}/>}
          </AdminFormSection>
          {classReady&&<>
          <AdminFormSection variant="subgroup" title={t(['Teaching assignment','Penugasan pengajar','授课安排'])}>
            <AdminFormGrid>
              <AdminField as="div">
                <label>{teacherLabel}</label>
                <AdminSingleSelect label={teacherLabel} value={draft.config.teacherId??''}
                  displayValue={draft.config.teacherId?undefined:draft.config.teacher||undefined} lang={lang} isLight={isLight} searchable
                  disabled={fieldDisabled||Boolean(draft.config.teacherId&&draft.publishedDates&&(enrollmentInstant(draft.publishedDates.firstLesson,classZone)?.getTime()??Infinity)<=Date.now())}
                  emptyLabel={unassigned}
                  options={[...(draft.state==='draft'?[{value:'',label:unassigned}]:[]),
                    ...(catalog?.teachers??[]).filter(item=>item.active&&(!draft.config.teacherType||item.category===draft.config.teacherType))
                    .map(item=>({value:item.id,label:facultyName(item.names,lang)})),
                    ...(draft.config.teacherId&&draft.config.teacher&&
                      !catalog?.teachers?.some(item=>item.active&&item.id===draft.config.teacherId&&(!draft.config.teacherType||item.category===draft.config.teacherType))
                      ?[{value:draft.config.teacherId,label:draft.config.teacher,disabled:true}]:[])]}
                  onChange={teacherId=>{
                    const item=catalog?.teachers?.find(item=>item.id===teacherId);
                    if(teacherId&&(!item?.active||(draft.config.teacherType&&draft.config.teacherType!==item.category)))return;
                    setDraft(current=>current&&({...current,config:{...current.config,teacherId,teacher:item?facultyName(item.names,'en'):''}}));
                    setTeacherCleared(false);
                    setDirty(true);setError('');
                  }}/>
                {teacherCleared&&<small role="status">{t(['The previous teacher does not match this template. Select another teacher.',
                  'Pengajar sebelumnya tidak sesuai dengan templat ini. Pilih pengajar lain.','原教师与当前班型不匹配，已清除。请重新选择。'])}</small>}
              </AdminField>
              <AdminField required={!!draft.config.templateId}>{periodsLabel}
                <AdminSingleSelect label={periodsLabel} value={String(weekly.lessons||'')} options={periodsPerSessionChoices}
                  displayValue={weekly.lessons>4?String(weekly.lessons):undefined} lang={lang} isLight={isLight}
                  invalid={periodsHint['aria-invalid']} describedBy={periodsHint['aria-describedby']}
                  disabled={fieldDisabled} onChange={value=>changeWeekly({lessons:Number(value)})}/>
                {hint('lessons')}
              </AdminField>
            </AdminFormGrid>
          </AdminFormSection>
          <AdminFormSection variant="subgroup" title={t(['Class schedule','Jadwal kelas','排课'])}>
            <AdminFormGrid>
              {selectField('timeZone',['Class time zone','Zona waktu kelas','班次时区'],enrollmentClassTimeZones.map(value=>({
                  value,label:t(enrollmentZoneNames[value]),
                })))}
              {selectField('period',['Class day type','Jenis hari kelas','上课日类型'],enrollmentPeriods.map(value=>({
                value,label:value==='mixed'?t(['Weekday & weekend','Hari kerja & akhir pekan','工作日与周末']):value==='weekend'?t(['Weekend','Akhir pekan','周末']):t(['Weekday evening','Malam hari kerja','工作日晚间']),
              })))}
              {dateTimeField('firstLesson')}
              <AdminField as="div" role="group" {...(weekly.days.length?hintProps('days'):{})} required={!!draft.config.templateId} data-admin-full-width="">
                <label>{t(['Weekly class days','Hari kelas setiap minggu','每周上课日'])}</label>
                <AdminSingleSelect multiple value="" lang={lang} isLight={isLight} disabled={fieldDisabled||!draft.config.period}
                  label={t(['Weekly class days','Hari kelas setiap minggu','每周上课日'])}
                  emptyLabel={t(['Select weekdays','Pilih hari','请选择上课日'])} values={weekly.days.map(String)} onChange={()=>{}} onValuesChange={days=>changeWeekly({days:days.map(Number)})}
                  options={enrollmentWeekdays.map(([zh,en,id],index)=>{
                    const day=index+1;
                    return {value:String(day),label:t([en,id,zh]),disabled:
                      (!enrollmentAllowsWeekday(draft.config.period,day)&&!weekly.days.includes(day))||
                      (linkedSchedule&&firstDay===day&&weekly.days.includes(day))};
                  })}/>
                {weekly.days.length>0&&hint('days')}{sourceHint('days')}
              </AdminField>
              {!linkedSchedule&&!weekly.startByDay&&
                <AdminTimeField label={withZone(t(['Session start time','Waktu mulai pertemuan','每次开始时间']))}
                  lang={lang} required={!!draft.config.templateId} disabled={fieldDisabled}
                  invalid={startHint['aria-invalid']} describedBy={startHint['aria-describedby']}
                  value={weekly.start} onChange={start=>changeWeekly({start})}/>}
              <AdminField className="crm-class-per-day-choice" data-admin-full-width="">
                <input type="checkbox" checked={!!weekly.startByDay}
                  disabled={fieldDisabled||linkedSchedule&&!weekly.startByDay&&(!firstReady||weekly.days.length<2)} onChange={event=>{
                  if(event.target.checked){
                    const start=linkedSchedule&&firstReady?draft.config.firstLesson.slice(11):weekly.start;
                    changeWeekly({start,startByDay:Object.fromEntries(weekly.days.map(day=>[day,start]))});
                  }else{
                    if(linkedSchedule)requestScheduleChange({kind:'uniform'});
                    else changeWeekly({start:enrollmentSessionStart(weekly,weekly.days[0])||weekly.start,startByDay:undefined});
                  }
                }} aria-describedby={inlineErrors.start?fieldHintId+'-start':undefined}/>
                {t(['Set start times by weekday','Atur waktu mulai per hari','按上课日设置开始时间'])}
              </AdminField>
              {weekly.startByDay&&weekly.days.map(day=>{
                const dayLabel=t([enrollmentWeekdays[day-1][1],enrollmentWeekdays[day-1][2],enrollmentWeekdays[day-1][0]]);
                const label=t([`${dayLabel} start time (${zoneLabel})`,`Waktu mulai ${dayLabel} (${zoneLabel})`,`${dayLabel}开始时间（${zoneLabel}）`]);
                return <AdminTimeField key={day} label={label} lang={lang} required={draft.state==='published'}
                  value={enrollmentSessionStart(weekly,day)} disabled={fieldDisabled||linkedSchedule&&day===firstDay}
                  invalid={startHint['aria-invalid']} describedBy={startHint['aria-describedby']}
                  onChange={value=>changeWeekly({startByDay:{...weekly.startByDay,[day]:value}})}/>;
              })}
              {sourceReview.start&&<div data-admin-full-width="">{sourceHint('start')}</div>}
              {firstReady&&inlineErrors.start&&<div data-admin-full-width="">
                {hint('start')}
                {linkedSchedule&&!weekly.startByDay&&weekly.start!==draft.config.firstLesson.slice(11)&&
                  <AdminRowAction disabled={fieldDisabled} onClick={()=>changeDateTime('firstLesson',draft.config.firstLesson)}>
                    {t(['Use the first session time','Gunakan waktu pertemuan pertama','按首课时间更新课表'])}
                  </AdminRowAction>}
              </div>}
              {(scheduleText||(!draft.config.weeklySchedule&&draft.config.schedule))&&
                <AdminStaticField fullWidth label={t(['Weekly schedule','Jadwal mingguan','每周课表'])}
                  value={draft.config.weeklySchedule?scheduleText:draft.config.schedule}/>}
              {(!!scheduleText&&firstReady||!linkedSchedule||!!sourceReview.holidayDates||!!draft.config.holidayDates?.length)&&
              <EnrollmentHolidayDates key={draft.id} config={draft.config} previewOnly={draft.state==='published'&&draft.hasOrders!==false}
                disabled={fieldDisabled||(!scheduleText||!firstReady)&&!draft.config.holidayDates?.length} lang={lang} t={t} review={sourceHint('holidayDates')}
                onChange={holidayDates=>{
                  if(holidayDates.join()===draft.config.holidayDates?.join()||(!holidayDates.length&&!draft.config.holidayDates?.length))return;
                  setDirty(true);
                  setDraft(current=>current&&({...current,config:{...current.config,holidayDates}}));
                }}/>}
            </AdminFormGrid>
          </AdminFormSection>
          <AdminFormSection variant="subgroup" title={t(['Self-service enrollment','Pendaftaran mandiri','自助报名'])}>
            <AdminFormGrid>{dateTimeField('enrollmentCloses')}</AdminFormGrid>
          </AdminFormSection>
          </>}
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
        {draft.state==='draft'&&!draft.config.teacherId&&<p className="crm-class-quote-feedback">
          {t(['Choose a teacher in the class editor before publishing.','Pilih pengajar pada editor kelas sebelum menerbitkan.','发布前请返回编辑并选择授课教师。'])}
        </p>}
        {draft.state==='draft'&&<button type="button" data-primary="" disabled={busy||saveBlocked||publishBlocked||!!pending||!previewRow?.price||firstSessionOnBreak||!draft.config.teacherId}
          onClick={()=>void save('published')}>{t(['Publish class','Terbitkan kelas','发布班次'])}</button>}
      </>}>
      {previewRow&&!previewRow.batchNumber&&<p>{t(['Batch number assigned on first publication.','Nomor angkatan ditetapkan saat pertama diterbitkan.','首次发布时自动分配期数。'])}</p>}
      {!!validationMessages.length&&<div>
        <AdminFormFeedback state="error" lang={lang}>
          {t(['Resolve these issues before publishing.','Selesaikan masalah berikut sebelum menerbitkan.','请先解决以下问题，再发布班次。'])}
        </AdminFormFeedback>
        <ul>{validationMessages.map(message=><li key={message}>{message}</li>)}</ul>
        {sourceHint('days')}
      </div>}
      {error&&<p role="alert">{error}</p>}
      {pending&&<><CrmSaveFeedback state="unknown" lang={lang}/><button type="button" disabled={busy} onClick={()=>void check()}>{t(['Check save result','Periksa hasil simpan','查询保存结果'])}</button></>}
      {previewRow&&<EnrollmentLearnerPreview row={previewRow} language={lang}/>}
    </AdminEditor>}
    {discard && <AdminDiscardDialog lang={lang} isLight={isLight} onKeep={() => setDiscard(false)} onDiscard={() => {
      setDiscard(false); setDirty(false); setDraft(undefined); setError('');
    }}/>}
    {scheduleChange&&draft&&<AdminConfirmation light={isLight}
      title={scheduleChange.kind==='period'?t(['Change the time slot?','Ubah waktu kelas?','更改上课日类型？']):
        scheduleChange.kind==='zone'?t(['Change the time zone?','Ubah zona waktu?','更改班次时区？']):
        t(['Use the first session time for every day?','Gunakan waktu pertemuan pertama setiap hari?','所有上课日改用首课时间？'])}
      description={scheduleChange.kind==='period'?t([
        'Incompatible dates and weekly days will be cleared. The time and any custom deadline will be kept.',
        'Tanggal dan hari kelas yang tidak sesuai akan dikosongkan. Jam dan batas pendaftaran khusus tetap disimpan.',
        '不符合新时段的首课日期和上课日会被清除。已填写的时间和手动报名截止将保留。',
      ]):scheduleChange.kind==='zone'?t([
        'The entered dates and times stay the same in the new local time zone.',
        'Tanggal dan jam yang sudah dimasukkan menjadi waktu lokal di zona waktu baru.',
        '已填写的日期和钟点将按新时区解释。',
      ]):t([
        'This removes the individual start times you entered.',
        'Waktu mulai yang diatur untuk tiap hari akan dihapus.',
        '已设置的分日开始时间将被清除。',
      ])}
      cancelLabel={t(['Back to editing','Kembali ke pengeditan','返回编辑'])}
      confirmLabel={t(['Confirm change','Konfirmasi perubahan','确认更改'])}
      onCancel={()=>setScheduleChange(undefined)} onConfirm={()=>applyScheduleChange(scheduleChange)}/>}
    {confirmDates&&draft?.publishedDates&&<AdminConfirmation light={isLight}
      title={t(['Confirm changes to class dates?','Konfirmasi perubahan tanggal kelas?','确认修改班次日期？'])}
      description={t(['Review the changed dates in the class time zone before saving.','Periksa perubahan tanggal dalam zona waktu kelas sebelum menyimpan.','请核对以下班次当地时间，再确认保存。'])}
      cancelLabel={t(['Back to editing','Kembali ke pengeditan','返回编辑'])}
      confirmLabel={t(['Confirm and save','Konfirmasi dan simpan','确认并保存'])}
      onCancel={()=>setConfirmDates(false)} onConfirm={()=>{setConfirmDates(false);void save();}}>
      <ul>{datesToConfirm.map(key=><li key={key}>
        {withZone(t(dateTimeLabels[key]))} {draft.publishedDates?.[key].replace('T',' ')} → {draft.config[key].replace('T',' ')}
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
    {closing&&<AdminDiscardDialog lang={lang} isLight={isLight}
      title={t(['Cancel this class?','Batalkan kelas ini?','取消这个班次？'])}
      description={t(['Stops new applications and payments. Existing payment records stay available.','Pendaftaran dan pembayaran baru dihentikan. Riwayat pembayaran tetap tersedia.','关闭新报名和转账入口，保留已有付款记录。'])}
      keepLabel={t(['Keep class','Pertahankan kelas','保留班次'])} discardLabel={t(['Cancel class','Batalkan kelas','取消班次'])}
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
