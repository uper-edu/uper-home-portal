import {AdminTopicHeader} from '../admin/AdminTopicHeader';
import {Plus} from 'lucide-react';
import {AdminConfirmation} from '../admin/AdminConfirmation';
import {AdminSearchField} from '../admin/AdminSearchField';
import {EnrollmentSettingsListSummary,EnrollmentSettingsSelect,useEnrollmentSettingsFilters} from './EnrollmentSettingsListControls';
import {AdminSingleSelect} from '../admin/AdminSingleSelect';
import {enrollmentLevels} from '../../utils/enrollmentCatalog';
import {enrollmentIntroductionFields,enrollmentIntroductionLanguages,enrollmentIntroductionLimits,enrollmentIntroductionStages,type EnrollmentCourseIntroduction,type EnrollmentIntroductionLanguage,type EnrollmentIntroductionStage} from '../../utils/enrollmentCourseIntroduction';
import {defaultEnrollmentCourseName} from '../../utils/enrollmentTemplates';
import {AdminRefreshAction} from '../admin/AdminRefreshAction';
import {CrmPageAction} from './CrmPageAction';
import {AdminListState,AdminListTable} from '../admin/AdminList';
import {AdminStatus} from '../AdminStatus';
import {AdminRowAction} from '../admin/AdminListControl';
import {formatCurrency} from '../../utils/currency';
import {useEffect,useId,useRef,useState} from 'react';
import {AdminField} from '../AdminForm';
import {AdminSavedReadError,AdminStaticField,AdminFormGrid,AdminFormSection} from '../AdminFormLayout';
import {AdminEditor} from '../admin/AdminEditor';
import {CrmDetailTabs,CrmDiscardDialog,CrmSaveFeedback} from './CrmDetailWorkspace';
import {courseError} from '../../utils/crmCoursePricing';
import type {CrmLanguage} from '../../utils/crmLanguage';
export function CrmCourses({lang,isLight,onDraftChange,onCreateTemplate}:{lang:CrmLanguage;isLight:boolean;onDraftChange:(dirty:boolean)=>void;onCreateTemplate:(courseId:string)=>void}){
 const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const [data,setData]=useState<any>(null),[form,setForm]=useState<any>(null),[error,setError]=useState(''),[state,setState]=useState(''),[dirty,setDirty]=useState(false),[discard,setDiscard]=useState(false),[latest,setLatest]=useState<any>(null);
 const pending=useRef<any>(null),gate=useRef(false);const busy=['saving','checking'].includes(state),unknown=state==='unknown';
 const [readState,setReadState]=useState<'loading'|'ready'|'error'|'denied'>('loading');
 const [awaitingSavedRead,setAwaitingSavedRead]=useState(false);
 const readRequest=useRef<AbortController|null>(null);
 const title=t('Courses','Kursus','课程');
 const {filters,change,clear}=useEnrollmentSettingsFilters('courses',{search:'',level:'',status:'',sort:'level'});
 const listState=readState==='loading'&&data?'ready':readState;
 const money=(n:number)=>formatCurrency(n,lang);
 const load=async()=>{
  readRequest.current?.abort();
  const controller=new AbortController();
  readRequest.current=controller;
  const {signal}=controller;
  setReadState('loading');
  try{
   const r=await fetch('/api/crm/courses',{cache:'no-store',signal});
   if(signal.aborted)return;
   if(r.status===401||r.status===403){setData(null);setReadState('denied');return;}
   if(!r.ok)throw Error();
   const d=await r.json();
   if(signal.aborted)return;
   setData(d);setReadState('ready');setAwaitingSavedRead(false);
   try{const id=sessionStorage.getItem('uper_course_pending:'+d.actorId);if(id&&!pending.current){pending.current={requestId:id};setState('unknown');}}catch{}
  }catch(cause){
   if(signal.aborted)return;
   setReadState('error');
   throw cause;
  }
 };
 const refresh=()=>void load().catch(()=>{});
 useEffect(()=>{refresh();return ()=>readRequest.current?.abort();},[]);
 useEffect(()=>{onDraftChange(dirty||unknown||busy);},[onDraftChange,dirty,unknown,busy]);
 useEffect(()=>()=>onDraftChange(false),[onDraftChange]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty||unknown){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty,unknown]);
 const [manualName,setManualName]=useState(false);
 const [addingBook,setAddingBook]=useState(false);
 const [contentLanguage,setContentLanguage]=useState<EnrollmentIntroductionLanguage>('en');
 const [contentStage,setContentStage]=useState<EnrollmentIntroductionStage|'course'>('course');
 const contentTabsId=useId();
 const contentPanelId=contentTabsId+'-panel';
 const introduction:EnrollmentCourseIntroduction|undefined=form?.config.teaching.introduction;
 const translation=introduction?.[contentLanguage];
 const isStagedCourse=form?.config.teaching.level==='HSK 4';
 const stage=isStagedCourse&&contentStage!=='course'?contentStage:undefined;
 const visibleContent=stage?translation?.stages?.[stage]:translation;
 const contentLanguageLabel=t('Content language','Bahasa konten','内容语言');
 const introductionLabels={
   audience:t('Who it’s for and recommended starting level','Untuk siapa dan kemampuan awal yang disarankan','适合学员与建议基础'),
   outcomes:t('Learning outcomes','Hasil belajar','学习成果'),
   topics:t('Core topics','Topik utama','核心知识点'),
   practice:t('Learning activities and practice resources','Kegiatan dan sumber latihan','教学活动与练习资源'),
 };
 const emptyTeaching={level:'',material:'',knowledge:'',learningOutcomes:'',resources:'',minutes:0};
 const edit=(c?:any)=>{
   setManualName(!!c&&c.name!==defaultEnrollmentCourseName(c.teaching??emptyTeaching,c.sessions));
   setAddingBook(false);
   setContentLanguage('en');
   setContentStage(c?.teaching?.level==='HSK 4'?'4A':'course');
   setForm(c?{...c,config:{name:c.name,sessions:c.sessions,teaching:c.teaching??emptyTeaching,price:c.price,active:c.active,maxDiscountBps:c.maxDiscountBps,maxDiscountAmount:c.maxDiscountAmount}}:{id:crypto.randomUUID(),revision:0,config:{name:'',sessions:'',price:0,teaching:emptyTeaching,active:false,maxDiscountBps:0,maxDiscountAmount:null}});
   setError('');setLatest(null);setState('');setDirty(false);pending.current=null;
 };
 const patch=(k:string,v:any)=>{
   setForm((f:any)=>{
     const config={...f.config,[k]:v};
     if(!manualName&&(k==='teaching'||k==='sessions'))config.name=defaultEnrollmentCourseName(config.teaching,config.sessions);
     return {...f,config};
   });
   setDirty(true);setError('');setState('');
 };
 const teach=(key:string,value:unknown)=>patch('teaching',{...form.config.teaching,[key]:value});
 const books=[...new Set<string>((data?.courses??[]).flatMap((c:any)=>c.teaching?.material?[c.teaching.material]:[]))].sort((a,b)=>a.localeCompare(b,lang));
 const textbookLabel=t('Main textbook and edition','Buku ajar utama dan edisi','主教材及版本');
 const visibleLabel=t('Visible to learners','Ditampilkan kepada siswa','学员可见');
 const fixed=!!data?.courses.find((c:any)=>c.id===form?.id)?.teaching;
 const levelRank=(course:any)=>{
   const rank=enrollmentLevels.indexOf(course.teaching?.level);
   return rank<0?enrollmentLevels.length:rank;
 };
 const searchQuery=filters.search.trim().toLowerCase();
 const rows=data?.courses.filter((c:any)=>(!filters.level||c.teaching?.level===filters.level)&&
   (!filters.status||(c.active?'published':'draft')===filters.status)&&
   [c.name,c.teaching?.material].some(v=>v?.toLowerCase().includes(searchQuery))).sort((a:any,b:any)=>{
   const name=a.name.localeCompare(b.name,lang,{numeric:true});
   return (filters.sort==='name-desc'?-name:filters.sort==='name-asc'?name:levelRank(a)-levelRank(b)||name)||
     a.id.localeCompare(b.id);
 })??[];
 const close=()=>{if(dirty||unknown)setDiscard(true);else setForm(null);};
 async function finishSave() {
   setDirty(false);setForm(null);pending.current=null;
   try{sessionStorage.removeItem('uper_course_pending:'+data.actorId);}catch{}
   setState('');setError('');setAwaitingSavedRead(true);
   await load().catch(()=>{});
 }
 const save=async(e:any)=>{e.preventDefault();if(gate.current||unknown)return;if(!form.config.teaching.level){setError(t('Select the level.','Pilih level.','请选择级别。'));return;}if(!form.config.teaching.material.trim()){setError(t('Select or add a textbook.','Pilih atau tambahkan buku ajar.','请选择或新增主教材。'));return;}gate.current=true;setState('saving');setError('');const b={id:form.id,revision:form.revision,requestId:crypto.randomUUID(),config:{...form.config,sessions:Number(form.config.sessions),price:Number(form.config.price),maxDiscountBps:Number(form.config.maxDiscountBps),maxDiscountAmount:form.config.maxDiscountAmount===null||form.config.maxDiscountAmount===''?null:Number(form.config.maxDiscountAmount)}};pending.current=b;try{sessionStorage.setItem('uper_course_pending:'+data.actorId,b.requestId);}catch{}
 try{const r=await fetch('/api/crm/courses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const d=await r.json();if(!r.ok){if(r.status>=500){setState('unknown');return;}setState('failed');setError(courseError(d.error,lang));if(r.status===409){try{const fresh=await fetch('/api/crm/courses',{cache:'no-store'});if(fresh.ok)setLatest((await fresh.json()).courses.find((c:any)=>c.id===b.id));}catch{}}pending.current=null;try{sessionStorage.removeItem('uper_course_pending:'+data.actorId);}catch{}return;}if(d.courseId!==b.id||d.operationKind!=='course')throw Error('unconfirmed');await finishSave();}catch{setState('unknown');}finally{gate.current=false;}};
 const query=async()=>{if(!pending.current||gate.current)return;gate.current=true;setState('checking');try{const r=await fetch('/api/crm/courses/results/'+pending.current.requestId,{cache:'no-store'});if(!r.ok)throw Error();const receipt=await r.json();if(receipt.operationKind!=='course'||!receipt.courseId||(pending.current.id&&receipt.courseId!==pending.current.id))throw Error();await finishSave();}catch{setState('unknown');setError(t('Save result is not confirmed. Check again before resubmitting.','Hasil simpan belum pasti. Periksa lagi sebelum mengirim ulang.','保存结果尚未确认，请继续查询，不要重复提交。'));}finally{gate.current=false;}};
 const [deleting,setDeleting]=useState<{id:string;name:string;revision:number;requestId:string}>();
 const [deleteState,setDeleteState]=useState<'idle'|'saving'|'unknown'|'checking'>('idle');
 const deleteGate=useRef(false);
 const [deleteError,setDeleteError]=useState('');
 const cancelDelete=()=>{if(!deleteGate.current&&deleteState!=='unknown'){setDeleting(undefined);setDeleteState('idle');setDeleteError('');}};
 const confirmDelete=async()=>{
   if(!deleting||deleteGate.current)return;
   const checking=deleteState==='unknown';
   deleteGate.current=true;
   setDeleteState(checking?'checking':'saving');setDeleteError('');
   try{
     const response=checking?await fetch('/api/crm/courses/results/'+encodeURIComponent(deleting.requestId),{cache:'no-store'}):
       await fetch('/api/crm/courses/delete',{method:'POST',headers:{'Content-Type':'application/json'},
         body:JSON.stringify({id:deleting.id,revision:deleting.revision,requestId:deleting.requestId})});
     if(response.status>=500||checking&&!response.ok)throw Error();
     const result=await response.json();
     if(!response.ok){
       setDeleteError(result.error==='course_in_use'?t('This course is already in use.','Kursus ini sudah digunakan.','此课程已有班型模板、班次或历史报名引用，无法删除。'):
         t('Unable to delete. Refresh the list and check the course.','Tidak dapat menghapus. Segarkan daftar dan periksa kursus.','无法删除，请刷新列表并核对课程。'));
       setDeleteState('idle');return;
     }
     if(result.courseId!==deleting.id||result.operationKind!=='course.delete')throw Error();
     setDeleting(undefined);setDeleteState('idle');setState('saved');await load().catch(()=>{});
   }catch{
     setDeleteState('unknown');
     setDeleteError(t('Deletion is unconfirmed. Check the original result.','Penghapusan belum terkonfirmasi. Periksa hasil awal.','删除结果尚未确认，请查询原操作结果。'));
   }finally{deleteGate.current=false;}
 };
 useEffect(()=>{if(deleting)onDraftChange(true);return()=>{if(deleting)onDraftChange(false);};},[deleting,onDraftChange]);
 return <div className="crm-course-catalog">
 <AdminTopicHeader title={title} isLight={isLight}
   subtitle={t('Maintain teaching content and course specifications.','Kelola materi dan spesifikasi kursus.','维护主教材、节数和学习成果。')}
   actions={<><AdminRefreshAction label={t('Refresh','Segarkan','刷新')} loading={readState==='loading'} onClick={refresh}/>
     {data?.canManage&&<CrmPageAction icon={Plus} variant="primary" label={t('Create course','Buat kursus','创建课程')} disabled={readState!=='ready'||unknown||busy} onClick={()=>edit()}/>}</>}/>
 {awaitingSavedRead&&readState==='error'&&<AdminSavedReadError lang={lang} onRetry={refresh}/>}
 {!form&&unknown&&<div><CrmSaveFeedback state="unknown" lang={lang}/><button type="button" className="crm-work-button" onClick={query}>{t('Check save result','Periksa hasil simpan','查询保存结果')}</button></div>}{!form&&state==='saved'&&<CrmSaveFeedback state="saved" lang={lang}/ >}{!form&&error&&<p role="alert">{error}</p>}
 {(listState!=='ready'||!data?.courses.length)&&!(awaitingSavedRead&&readState==='error')&&<AdminListState lang={lang}
   state={listState==='ready'?'empty':listState}
   message={listState==='ready'
    ?t('No courses yet. Create and publish a course before confirming enrollment.','Belum ada kursus. Buat dan terbitkan sebelum konfirmasi pendaftaran.','暂无课程。创建并发布课程后，销售才能确认报名。')
    :listState==='error'&&data?t('Refresh failed. Showing the last loaded courses.','Gagal menyegarkan. Kursus yang terakhir dimuat masih ditampilkan.','刷新失败，仍显示上次读取的课程。'):undefined}
   onRetry={refresh}/>}
 {data&&<>
  <div className="crm-class-config-filters">
   <AdminSearchField label={t('Search courses','Cari kursus','搜索课程')} placeholder={t('Course or textbook','Kursus atau buku ajar','课程或教材')}
     value={filters.search} onChange={search=>change({search})}/>
   <EnrollmentSettingsSelect lang={lang} isLight={isLight} label={['Level','Level','级别']} all={['All levels','Semua level','全部级别']}
     value={filters.level} onChange={level=>change({level})} options={enrollmentLevels.map(value=>({value,label:value}))}/>
   <EnrollmentSettingsSelect lang={lang} isLight={isLight} label={['Publication status','Status publikasi','发布状态']}
     all={['All statuses','Semua status','全部状态']} value={filters.status} onChange={status=>change({status})} options={[
       {value:'published',label:t('Published','Diterbitkan','已发布')},{value:'draft',label:t('Draft','Draf','草稿')},
     ]}/>
  </div>
  <EnrollmentSettingsListSummary lang={lang} count={rows.length} total={data.courses.length}
    filtered={!!(filters.search||filters.level||filters.status)} onClear={clear}>
    <EnrollmentSettingsSelect lang={lang} isLight={isLight} label={['Sort','Urutkan','排序']} value={filters.sort} onChange={sort=>change({sort})} options={[
      {value:'level',label:t('Level, then course name','Level, lalu nama kursus','级别、课程名称')},
      {value:'name-asc',label:t('Name · Ascending','Nama · Naik','名称升序')},
      {value:'name-desc',label:t('Name · Descending','Nama · Turun','名称降序')},
    ]}/>
  </EnrollmentSettingsListSummary>
 </>}
 {!!rows.length&&<AdminListTable label={title} busy={readState==='loading'} headers={[
   {label:t('Course','Kursus','课程'),sort:filters.sort==='name-asc'?'ascending':filters.sort==='name-desc'?'descending':undefined},
   {label:t('Level','Level','级别'),sort:filters.sort==='level'?'ascending':undefined},t('Textbook','Buku ajar','主教材'),
   t('Periods','Jam pelajaran','节数'),t('Status','Status','状态'),t('Actions','Tindakan','操作'),
 ]}>{rows.map((c:any)=><tr key={c.id}><td><strong>{c.name}</strong>{c.systemManaged&&<div><AdminStatus tone="neutral">{t('System preset','Preset sistem','系统预置')}</AdminStatus></div>}</td><td>{c.teaching?.level??'—'}</td>
   <td>{c.teaching?.material??'—'}</td><td>{c.sessions}{c.teaching?' × '+c.teaching.minutes+' min':''}</td>
   <td><AdminStatus tone={c.active?'success':'neutral'}>{c.active?t('Published','Diterbitkan','已发布'):t('Draft','Draf','草稿')}</AdminStatus></td>
   <td>{data.canManage&&<div className="flex flex-wrap gap-x-3 gap-y-1">
     <AdminRowAction disabled={busy||unknown||readState!=='ready'} onClick={()=>edit(c)}>{t('Edit','Edit','编辑')}</AdminRowAction>
     {c.active&&c.teaching&&<AdminRowAction disabled={busy||unknown||readState!=='ready'} onClick={()=>onCreateTemplate(c.id)}>
       {t('Create template','Buat templat','创建模板')}</AdminRowAction>}
     {c.canDelete&&<AdminRowAction disabled={busy||unknown||readState!=='ready'} onClick={()=>{setDeleteError('');setDeleting({id:c.id,name:c.name,revision:c.revision,requestId:crypto.randomUUID()});}}>
       {t('Delete','Hapus','删除')}</AdminRowAction>}
   </div>}</td></tr>)}</AdminListTable>}
 {data?.courses.length>0&&!rows.length&&<AdminListState lang={lang} state="empty"/>}
 {form&&<AdminEditor variant="drawer" responsiveForm required className="crm-course-editor"
  title={form.revision?t('Edit course','Edit kursus','编辑课程'):t('Create course','Buat kursus','创建课程')}
  lang={lang} light={isLight} busy={busy} onClose={close} onSubmit={save}
  footer={unknown
    ?<button type="button" disabled={busy} onClick={query}>{t('Check save result','Periksa hasil simpan','查询保存结果')}</button>
    :<><button type="button" disabled={busy} onClick={close}>{t('Cancel','Batal','取消')}</button>
      <button type="submit" data-primary="" disabled={busy}>{t('Save','Simpan','保存')}</button></>}>
  {error&&<p role="alert">{error}</p>}
  {latest&&<aside><p>{t('Latest standard price','Harga standar terbaru','最新标准价')}：{money(latest.price)}</p>
    <button type="button" className="crm-work-button" onClick={()=>{setForm((f:any)=>({...f,revision:latest.revision}));setLatest(null);setError('');}}>{t('Keep draft after review','Pertahankan draf setelah ditinjau','核对后保留草稿继续')}</button>
  </aside>}
  {unknown&&<CrmSaveFeedback state="unknown" lang={lang}/>}
  <div data-admin-section-stack="open">
  <AdminFormSection variant="subgroup" title={t('Course details','Informasi kursus','课程信息')}>
    <AdminFormGrid>
      {fixed?<>
        <AdminStaticField label={t('Level','Level','级别')} value={form.config.teaching.level}/>
        <AdminStaticField label={textbookLabel} value={form.config.teaching.material}/>
        <AdminStaticField label={t('Periods','Jam pelajaran','总节数')} value={form.config.sessions}/>
        <AdminStaticField label={t('Minutes per period','Menit per jam pelajaran','每节时长（分钟）')} value={form.config.teaching.minutes}/>
      </>:<>
      <AdminField required>{t('Level','Level','级别')}<AdminSingleSelect lang={lang} isLight={isLight} disabled={busy||unknown}
        label={t('Level','Level','级别')} value={form.config.teaching.level} onChange={v=>teach('level',v)} options={enrollmentLevels.map(value=>({value,label:value}))}/></AdminField>
      <AdminField required>{textbookLabel}
        <AdminSingleSelect lang={lang} isLight={isLight} searchable disabled={busy||unknown} label={textbookLabel}
          value={addingBook?'new-textbook:':form.config.teaching.material?'book:'+form.config.teaching.material:''}
          options={[...books.map(book=>({value:'book:'+book,label:book})),{value:'new-textbook:',label:t('Add a textbook','Tambah buku ajar','新增教材')}]}
          onChange={value=>{setAddingBook(value==='new-textbook:');teach('material',value.startsWith('book:')?value.slice(5):'');}}/>
      </AdminField>
      {addingBook&&<AdminField required data-admin-full-width="">{t('New textbook name and edition','Judul dan edisi buku baru','新教材名称及版本')}
        <input required maxLength={1200} value={form.config.teaching.material} onChange={e=>teach('material',e.target.value)}/></AdminField>}
      <AdminField required>{t('Periods','Jam pelajaran','总节数')}<input type="number" required min="1" max="1000" disabled={busy||unknown} value={form.config.sessions} onChange={e=>patch('sessions',e.target.value)}/></AdminField>
      <AdminField required>{t('Minutes per period','Menit per jam pelajaran','每节时长（分钟）')}
        <AdminSingleSelect lang={lang} isLight={isLight} disabled={busy||unknown}
          label={t('Minutes per period','Menit per jam pelajaran','每节时长（分钟）')}
          value={form.config.teaching.minutes?String(form.config.teaching.minutes):''}
          options={[30,45,50,60,90].map(minutes=>({value:String(minutes),label:String(minutes)}))}
          onChange={v=>teach('minutes',Number(v))}/>
      </AdminField>
      </>}
      <AdminField required data-admin-full-width="">{t('Course name','Nama kursus','课程名称')}
        <input type="text" required maxLength={200} disabled={busy||unknown} value={form.config.name}
          onChange={e=>{setManualName(!!e.target.value.trim());patch('name',e.target.value);}}/>
        <small>{t('The default name uses the level, textbook, period count and duration in English format. You can edit it.','Nama bawaan memakai level, buku ajar, jumlah jam pelajaran, dan durasi dalam format bahasa Inggris. Nama dapat diedit.','默认用英文格式按「级别 · 主教材 · 总节数 × 每节时长」生成，可手动修改。')}</small>
      </AdminField>
    </AdminFormGrid>
  </AdminFormSection>
  <AdminFormSection variant="subgroup" title={t('Teaching content','Materi pembelajaran','教学内容')}>
    <CrmDetailTabs id={contentTabsId} value={contentLanguage} label={contentLanguageLabel} contentId={contentPanelId}
      disabled={busy||unknown} tabs={[
        {id:'en',label:'English'},{id:'id',label:'Bahasa Indonesia'},{id:'zh',label:'中文'},
      ]} onChange={value=>{
        const locale=enrollmentIntroductionLanguages.find(candidate=>candidate===value);
        if(locale)setContentLanguage(locale);
      }}/>
    <div id={contentPanelId} role="tabpanel" aria-labelledby={contentTabsId+'-tab-'+contentLanguage}>
      {isStagedCourse&&<AdminField>{t('Course stage','Tahap kursus','课程阶段')}
        <AdminSingleSelect lang={lang} isLight={isLight} disabled={busy||unknown}
          label={t('Course stage','Tahap kursus','课程阶段')} value={contentStage}
          options={[
            {value:'course',label:t('Course overview','Ringkasan kursus','课程总览')},
            ...enrollmentIntroductionStages.map(value=>({value,label:'HSK '+value})),
          ]} onChange={value=>setContentStage(enrollmentIntroductionStages.find(candidate=>candidate===value)??'course')}/>
      </AdminField>}
      {enrollmentIntroductionFields.map(field=><AdminField key={field}>
        <span>{introductionLabels[field]} <span className="crm-work-muted text-xs font-normal">· {visibleLabel}</span></span>
        <textarea disabled={busy||unknown} maxLength={enrollmentIntroductionLimits[field]}
          value={visibleContent?.[field]??''} onChange={event=>{
            const next={...visibleContent,[field]:event.target.value};
            teach('introduction',{
              ...introduction,[contentLanguage]:stage
                ? {...translation,stages:{...translation?.stages,[stage]:next}}
                : next,
            });
          }}/>
      </AdminField>)}
    </div>
    {(['knowledge','learningOutcomes','resources'] as const).some(key=>form.config.teaching[key])&&<details>
      <summary>{t('Existing unlocalized content','Konten lama tanpa bahasa','既有未分语种内容')}</summary>
      {([['knowledge','Core topics','Topik utama','核心知识点'],['learningOutcomes','Learning outcomes','Hasil belajar','学习成果'],['resources','Practice resources','Sumber latihan','练习资源']] as const).map(([key,en,id,zh])=><AdminField key={key}>
        <span>{t(en,id,zh)}</span>
        <textarea disabled={busy||unknown} maxLength={key==='knowledge'?1200:2500} value={form.config.teaching[key]} onChange={e=>teach(key,e.target.value)}/>
      </AdminField>)}
    </details>}
  </AdminFormSection>
  <AdminFormSection variant="subgroup" title={t('Publication settings','Pengaturan publikasi','发布设置')}>
    <label className="admin-field admin-field--choice"><input type="checkbox" disabled={busy||unknown} checked={form.config.active} onChange={e=>patch('active',e.target.checked)}/>
      <span>{t('Publish for new enrollment','Terbitkan untuk pendaftaran baru','发布并允许新报名')}</span></label>
  </AdminFormSection>
  </div>
 </AdminEditor>}
 {deleting&&<AdminConfirmation light={isLight} danger busy={deleteState==='saving'||deleteState==='checking'}
   title={t('Delete this course?','Hapus kursus ini?','删除这门课程？')}
   description={t('The course will be removed from the catalog.','Kursus akan dihapus dari katalog.','删除后，这门课程将从课程目录移除。')+' '+deleting.name}
   cancelLabel={t('Cancel','Batal','取消')}
   confirmLabel={deleteState==='unknown'?t('Check deletion result','Periksa hasil penghapusan','查询删除结果'):t('Delete course','Hapus kursus','删除课程')}
   onCancel={cancelDelete} onConfirm={()=>void confirmDelete()}>
   {deleteError&&<p role="alert">{deleteError}</p>}
 </AdminConfirmation>}
 {discard&&<CrmDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)} onDiscard={()=>{setDiscard(false);setForm(null);setDirty(false);setError('');}}/>}
 </div>;
}
