import {AdminTopicHeader} from '../admin/AdminTopicHeader';
import {Plus} from 'lucide-react';
import {AdminPageAction} from '../admin/AdminPageAction';
import {useEffect,useRef,useState} from 'react';
import {AdminEditor} from '../admin/AdminEditor';
import {AdminConfirmation} from '../admin/AdminConfirmation';
import {EnrollmentSettingsListSummary,EnrollmentSettingsSelect,useEnrollmentSettingsFilters} from './EnrollmentSettingsListControls';
import {AdminListState,AdminListTable} from '../admin/AdminList';
import {AdminRowAction} from '../admin/AdminListControl';
import {AdminRefreshAction} from '../admin/AdminRefreshAction';
import {AdminSearchField} from '../admin/AdminSearchField';
import {AdminStatus} from '../AdminStatus';
import {AdminField} from '../AdminForm';
import {AdminFormFeedback,AdminSavedReadError,AdminFormGrid,AdminFormSection,AdminFormSummary} from '../AdminFormLayout';
import { CrmSaveFeedback } from './CrmDetailWorkspace';
import { AdminDiscardDialog } from '../admin/AdminDiscardDialog';
import {AdminSingleSelect, type AdminSelectChoice} from '../admin/AdminSingleSelect';
import {enrollmentLevels} from '../../utils/enrollmentCatalog';
import {compareEnrollmentTeachingCourses,compareEnrollmentTemplates,defaultEnrollmentCourseName,enrollmentTemplateFormats,enrollmentTeacherTypes,enrollmentTemplateQuote,templateSize,type EnrollmentTemplate,type EnrollmentTeachingCourse} from '../../utils/enrollmentTemplates';
import {formatCurrency} from '../../utils/currency';
import type {CrmLanguage} from '../../utils/crmLanguage';

const endpoint='/api/crm/enrollment/templates';
type Catalog={courses:EnrollmentTeachingCourse[];templates:EnrollmentTemplate[];classes:{templateId?:string}[]};
type TemplateDraft=Omit<EnrollmentTemplate,'format'|'teacherType'>&{
 format:EnrollmentTemplate['format']|'';
 teacherType:EnrollmentTemplate['teacherType']|'';
};
type SizeField='capacity'|'minimumPaid';
type Props={lang:CrmLanguage;isLight:boolean;selected?:string;createFromCourse?:string;onCreateClass?:(id:string)=>void;onDraftChange?:(dirty:boolean)=>void; quoteEdit?:{id:string;onReturn:()=>void}};

export function CrmEnrollmentTemplates({lang,isLight,selected,createFromCourse,onCreateClass,onDraftChange,quoteEdit}:Props){
 const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const title=t('Class templates','Templat kelas','班型模板');
 const createTemplateLabel=t('New class template','Buat templat kelas','新建班型模版');
 const [catalog,setCatalog]=useState<Catalog>(),[read,setRead]=useState<'loading'|'ready'|'denied'|'error'>('loading');
 const {filters,change,clear}=useEnrollmentSettingsFilters('templates',{search:'',level:'',quote:'',format:'',teacher:'',sort:'course'});
 const [draft,setDraft]=useState<TemplateDraft>(),[manualName,setManualName]=useState(false),[dirty,setDirty]=useState(false);
 const [discard,setDiscard]=useState(false),[busy,setBusy]=useState(false),[awaitingSavedRead,setAwaitingSavedRead]=useState(false),[error,setError]=useState('');
 const [pending,setPending]=useState<string>();
 const [deleting,setDeleting]=useState<{item:EnrollmentTemplate;requestId:string}>();
 const [deleteUnknown,setDeleteUnknown]=useState(false);
 const [deleteError,setDeleteError]=useState('');
 const [deleted,setDeleted]=useState(false);
 const request=useRef<AbortController|null>(null),inFlight=useRef(false),located=useRef<string|undefined>(undefined);
 const openedFromCourse=useRef<string|undefined>(undefined);
 const editedSizes=useRef(new Set<SizeField>());
 const money=(amount:number)=>formatCurrency(amount,lang);
 const formats={standard:t('Standard','Standar','标准班'),small:t('Small group','Kelompok kecil','小班'),'one-on-one':t('One-to-one','Privat','一对一')};
 const teachers={local:t('Local teacher','Pengajar lokal','本土教师'),foreign:t('Foreign teacher','Pengajar asing','外教')};
 const course=(id:string)=>catalog?.courses.find(c=>c.id===id);
 const load=async()=>{
   request.current?.abort();
   const controller=new AbortController();
   request.current=controller;
   setRead('loading');
   try{
     const response=await fetch('/api/crm/enrollment/classes',{cache:'no-store',signal:controller.signal});
     if(controller.signal.aborted)return;
     if([401,403].includes(response.status)){setCatalog(undefined);setRead('denied');return;}
     if(!response.ok)throw Error();
     const value=await response.json();
     if(!controller.signal.aborted){setCatalog(value);setRead('ready');setAwaitingSavedRead(false);}
   }catch{if(!controller.signal.aborted)setRead('error');}
 };
 useEffect(()=>{void load();return ()=>request.current?.abort();},[]);
 useEffect(()=>{onDraftChange?.(dirty||busy||!!pending||!!deleting);},[dirty,busy,pending,deleting,onDraftChange]);
 useEffect(()=>()=>onDraftChange?.(false),[onDraftChange]);

 const visible=catalog?.templates.filter(item=>{
   const c=course(item.courseId);
   const query=filters.search.trim().toLowerCase();
   return [item.name,c?.name,c?.teaching?.material].some(value=>value?.toLowerCase().includes(query))&&
     (!filters.level||c?.teaching?.level===filters.level)&&(!filters.quote||(item.saleUnitPrice?'ready':'missing')===filters.quote)&&
     (!filters.format||item.format===filters.format)&&(!filters.teacher||item.teacherType===filters.teacher);
 }).sort(compareEnrollmentTemplates(catalog.courses,lang,filters.sort))??[];
 const selectedVisible=visible.some(item=>item.id===selected);
 useEffect(()=>{
   if(!selected){located.current=undefined;return;}
   if(read!=='ready'||located.current===selected)return;
   const row=document.getElementById('enrollment-template-row-'+selected);
   if(!row)return;
   located.current=selected;
   row.scrollIntoView({block:'nearest'});
   row.focus({preventScroll:true});
 },[read,selected,selectedVisible]);
 const newCourse=catalog?.courses.find(c=>c.active&&c.teaching);
 const auto=(item:TemplateDraft)=>{
   if(!item.courseId||!item.format||!item.teacherType)return '';
   const selectedCourse=course(item.courseId);
   if(!selectedCourse?.teaching)return '';
   const {level}=selectedCourse.teaching;
   const hasSameLevel=catalog?.courses.some(other=>other.id!==selectedCourse.id&&other.teaching?.level===level);
   const classType={standard:'Standard Class',small:'Small Group','one-on-one':'One-to-One'}[item.format];
   const teacherType=item.teacherType==='local'?'Local Teacher':'Foreign Teacher';
   const suffix=' · '+classType+' · '+teacherType;
   const courseLabel=hasSameLevel
     ? defaultEnrollmentCourseName(selectedCourse.teaching,selectedCourse.sessions,200-suffix.length)||level
     : level;
   return courseLabel+suffix;
 };
 const priceStatus=(item:Pick<EnrollmentTemplate,'saleUnitPrice'>)=><AdminStatus tone={item.saleUnitPrice?'success':'warning'}>{item.saleUnitPrice?t('Quote configured','Harga tersedia','报价已配置'):t('Quote pending','Harga belum dikonfirmasi','报价待确认')}</AdminStatus>;
 const edit=(item?:EnrollmentTemplate,courseId='')=>{
   if(!item&&!newCourse)return;
   editedSizes.current.clear();
   const seed:TemplateDraft=item??{id:crypto.randomUUID(),revision:0,name:'',courseId,format:'',teacherType:'',
     minimumPaid:0,capacity:0,standardUnitPrice:null,saleUnitPrice:null};
   setDraft({...seed,name:item?.name??auto(seed)});setManualName(!!item&&item.name!==auto(item));setError('');setDirty(false);
 };
 useEffect(()=>{
   if(!createFromCourse){openedFromCourse.current=undefined;return;}
   if(read!=='ready'||draft||openedFromCourse.current===createFromCourse)return;
   const source=course(createFromCourse);
   if(!source?.active||!source.teaching)return;
   openedFromCourse.current=createFromCourse;
   edit(undefined,source.id);
 },[catalog,read,createFromCourse,draft]);
 const patch=(values:Partial<TemplateDraft>,manual=manualName)=>{
   setDraft(prev=>{
     if(!prev)return prev;
     const next={...prev,...values};
     return manual?next:{...next,name:auto(next)};
   });
   setDirty(true);setError('');
 };
 const changeFormat=(format:EnrollmentTemplate['format'])=>{
   const {capacity,minimumPaid}=templateSize[format];
   patch({format,...(!editedSizes.current.has('capacity')&&{capacity}),
     ...(!editedSizes.current.has('minimumPaid')&&{minimumPaid})});
 };
 const changeSize=(key:SizeField,value:number)=>{
   editedSizes.current.add(key);
   patch({[key]:value});
 };
 useEffect(()=>{
   if(!quoteEdit||read!=='ready'||draft)return;
   const item=catalog?.templates.find(template=>template.id===quoteEdit.id);
   if(item)edit(item);
 },[read,catalog,quoteEdit,draft]);
 const close=()=>{
   if(busy||pending)return;
   if(dirty)setDiscard(true);
   else if(quoteEdit)quoteEdit.onReturn();
   else setDraft(undefined);
 };
 const complete=async()=>{
   setDraft(undefined);setPending(undefined);setDirty(false);onDraftChange?.(false);
   if(quoteEdit){quoteEdit.onReturn();return;}
   setAwaitingSavedRead(true);
   await load();
 };
 const save=async(e:React.FormEvent)=>{
   e.preventDefault();
   if(!draft||!draft.courseId||!draft.format||!draft.teacherType||inFlight.current||pending)return;
   if(!termsLocked){
     const {standardUnitPrice,saleUnitPrice,minimumPaid,capacity}=draft;
     if(minimumPaid>capacity){
       setError(t('The minimum cannot exceed the seat limit.','Jumlah minimum tidak boleh melebihi kapasitas.','人数下限不能超过人数上限。'));return;
     }
     if((standardUnitPrice===null)!==(saleUnitPrice===null)){
       setError(t('Enter both prices, or leave both blank.','Isi kedua harga atau kosongkan keduanya.','请填写两项报价，或将两项都留空。'));return;
     }
     if(standardUnitPrice!==null&&saleUnitPrice!==null&&saleUnitPrice>standardUnitPrice){
       setError(t('The enrollment price cannot exceed the standard price.','Harga pendaftaran tidak boleh melebihi harga standar.','报名价不能高于标准价。'));return;
     }
   }
   const requestId=crypto.randomUUID();
   inFlight.current=true;setBusy(true);setError('');
   try{
     const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...draft,requestId})});
     if(response.status>=500)throw Error();
     if(!response.ok){
       const failure=await response.json().catch(()=>null);
       if(failure?.error==='enrollment_template_terms_locked'){
         setError(t('This template already has a class. Its size and prices are locked.','Templat ini sudah memiliki kelas. Kapasitas dan harga terkunci.','此模板已有班次，人数和报价已锁定。'));
         await load();
         return;
       }
       setError(response.status===409?t('Reload to check the latest version. Your draft is kept.','Muat ulang untuk memeriksa versi terbaru. Draf disimpan.','请刷新核对最新版本，草稿已保留。'):t('Check the name, seat limits and price pair.','Periksa nama, batas peserta, dan kedua harga.','请核对名称、人数及两项单价。'));return;}
     if((await response.json()).templateId!==draft.id)throw Error();
     await complete();
   }catch{setPending(requestId);}finally{inFlight.current=false;setBusy(false);}
 };
 const check=async()=>{
   if(!draft||!pending||inFlight.current)return;
   inFlight.current=true;setBusy(true);
   try{
     const response=await fetch(endpoint+'/results/'+encodeURIComponent(pending),{cache:'no-store'});
     if(!response.ok||(await response.json()).templateId!==draft.id)throw Error();
     await complete();
   }catch{setError(t('Save not confirmed. Check again before retrying.','Penyimpanan belum terkonfirmasi. Periksa lagi.','保存结果未确认，请继续查询。'));}
   finally{inFlight.current=false;setBusy(false);}
 };
 const referencedTemplates=new Set(catalog?.classes.map(row=>row.templateId));
 const deleteTemplate=async()=>{
   if(!deleting||inFlight.current)return;
   const {item,requestId}=deleting;
   inFlight.current=true;setBusy(true);setDeleteError('');
   try{
     const response=deleteUnknown
       ? await fetch(endpoint+'/results/'+encodeURIComponent(requestId),{cache:'no-store'})
       : await fetch(endpoint+'/delete',{method:'POST',headers:{'Content-Type':'application/json'},
         body:JSON.stringify({id:item.id,revision:item.revision,requestId})});
     if(response.status>=500||deleteUnknown&&!response.ok)throw Error();
     const result=await response.json();
     if(!response.ok){
       setDeleteError(result.error==='enrollment_template_in_use'
         ? t('A class already uses this template.','Templat ini sudah digunakan oleh kelas.','已有班次使用此模板，无法删除。')
         : t('Deletion failed. Refresh and review the template.','Penghapusan gagal. Segarkan dan periksa templat.','删除失败，请刷新并核对模板。'));
       await load();
       return;
     }
     if(result.operationKind!=='enrollment.template.delete'||result.templateId!==item.id)throw Error();
     setCatalog(value=>value&&({...value,templates:value.templates.filter(template=>template.id!==item.id)}));
     setDeleting(undefined);setDeleteUnknown(false);setDeleted(true);
     await load();
   }catch{
     setDeleteUnknown(true);
     setDeleteError(t('Deletion is unconfirmed. Check the original result.','Penghapusan belum terkonfirmasi. Periksa hasil awal.','删除结果尚未确认，请查询原操作结果。'));
   }finally{inFlight.current=false;setBusy(false);}
 };
 const field=(label:string,value:string,options:AdminSelectChoice[],change:(v:string)=>void,searchable=false)=><AdminField required>{label}
   <AdminSingleSelect label={label} lang={lang} isLight={isLight} value={value} options={options} onChange={change} searchable={searchable} disabled={busy||!!pending}/>
 </AdminField>;
 const termsLocked=!!draft&&referencedTemplates.has(draft.id);
 const searchLabel=t('Search templates','Cari templat','搜索模板');
 const filterControls=<div className="crm-class-config-filters">
   <AdminSearchField label={searchLabel} placeholder={t('Template, course or textbook','Templat, kursus, atau buku ajar','模板、课程或教材')} value={filters.search} onChange={search=>change({search})}/>
   <EnrollmentSettingsSelect lang={lang} isLight={isLight} label={['Level','Level','级别']} all={['All levels','Semua level','全部级别']}
     value={filters.level} onChange={level=>change({level})} options={enrollmentLevels.map(value=>({value,label:value}))}/>
   <EnrollmentSettingsSelect lang={lang} isLight={isLight} label={['Class type','Jenis kelas','班型']} all={['All class types','Semua jenis kelas','全部班型']}
     value={filters.format} onChange={format=>change({format})} options={Object.entries(formats).map(([value,label])=>({value,label}))}/>
   <EnrollmentSettingsSelect lang={lang} isLight={isLight} label={['Teacher type','Jenis pengajar','教师类型']} all={['All teacher types','Semua jenis pengajar','全部教师类型']}
     value={filters.teacher} onChange={teacher=>change({teacher})} options={Object.entries(teachers).map(([value,label])=>({value,label}))}/>
   <EnrollmentSettingsSelect lang={lang} isLight={isLight} label={['Quote status','Status harga','报价状态']} all={['All quote statuses','Semua status harga','全部报价状态']}
     value={filters.quote} onChange={quote=>change({quote})} options={[
       {value:'ready',label:t('Configured','Tersedia','已配置')},{value:'missing',label:t('Pending','Menunggu','待确认')}]}/>
 </div>;
 const draftCourse=draft&&course(draft.courseId);
 const draftQuote=draft&&draftCourse&&(draft.saleUnitPrice??0)>0&&(draft.saleUnitPrice??0)<=(draft.standardUnitPrice??0)
   ?enrollmentTemplateQuote(draft,draftCourse.sessions):null;
 const editorTitle=quoteEdit?t('Set template quote','Atur harga templat','设置班型报价'):
   draft?.revision?t('Edit template','Edit templat','编辑模板'):createTemplateLabel;
 const returnToClass=t('Back to class draft','Kembali ke draf kelas','返回班次草稿');
 const formatLabel=t('Class type','Jenis kelas','班型');
 const teacherLabel=t('Teacher type','Jenis pengajar','教师类型');
 const sizeFields=[
   ['minimumPaid',t('Minimum fully paid','Minimum peserta lunas','人数下限（到账为准）')],
   ['capacity',t('Seat limit','Jumlah peserta maksimum','人数上限')],
 ] as const;
 const unitPriceFields=[
   ['standardUnitPrice',t('Standard price per period','Harga standar per jam pelajaran','每节标准价')],
   ['saleUnitPrice',t('Enrollment price per period','Harga pendaftaran per jam pelajaran','每节报名价')],
 ] as const;
 const tuitionFields=draftQuote?[
   [t('Standard total','Total harga standar','标准总价'),draftQuote.standardPrice?<del>{money(draftQuote.standardPrice)}</del>:'—'],
   [t('Enrollment total','Total harga pendaftaran','报名总价'),<strong>{money(draftQuote.price)}</strong>],
 ] as const:[];
 const pricingSection=draft&&<AdminFormSection variant="subgroup" title={t('Tuition','Biaya kursus','课程报价')}
   description={termsLocked?t('Classes already use this template. Class size and prices are locked.','Kelas sudah menggunakan templat ini. Jumlah peserta dan harga terkunci.','已有班次使用此模板，人数和报价已锁定。'):
     t('Enter both prices in rupiah per period, or leave both blank to set the quote later.','Isi kedua harga per jam pelajaran dalam rupiah, atau kosongkan keduanya untuk mengaturnya nanti.','按每节课填写两项印尼盾报价，也可全部留空稍后设置。')}>
   {termsLocked?<AdminFormSummary fields={[
     ...unitPriceFields.map(([key,label])=>[label,draft[key]===null?'—':money(draft[key])] as const),...tuitionFields,
   ]}/>:<>
     <AdminFormGrid>{unitPriceFields.map(([key,label])=><AdminField key={key}>{label}
       <input type="number" min="1" value={draft[key]??''} onChange={e=>patch({[key]:e.target.value?Number(e.target.value):null})}/>
     </AdminField>)}</AdminFormGrid>
     {draftQuote&&<AdminFormSummary title={t('Total tuition','Total biaya kursus','学费总价')} fields={tuitionFields}/>}
   </>}
 </AdminFormSection>;
 const ready=!!catalog&&read!=='denied';
 const titleActions=<AdminRefreshAction label={t('Refresh','Segarkan','刷新')} loading={read==='loading'} onClick={()=>void load()}/>;
 return <div className="crm-course-catalog">
     {!quoteEdit&&<><AdminTopicHeader title={title} isLight={isLight}
       subtitle={t('Set class size, teacher type and tuition for each course’s class templates.','Atur ukuran kelas, jenis pengajar, dan biaya pada templat setiap kursus.','按课程维护建班模板，设置人数、教师类型和报价。')}
       actions={<>{titleActions}
       <AdminPageAction icon={Plus} variant="primary" label={createTemplateLabel} disabled={!newCourse||read!=='ready'} onClick={()=>edit()}/></>}/>
     {ready&&filterControls}
     {ready&&<EnrollmentSettingsListSummary lang={lang} count={visible.length} total={catalog.templates.length}
       filtered={!!(filters.search||filters.level||filters.format||filters.teacher||filters.quote)} onClear={clear}>
       <EnrollmentSettingsSelect lang={lang} isLight={isLight} label={['Sort','Urutkan','排序']} value={filters.sort} onChange={sort=>change({sort})} options={[
         {value:'course',label:t('Level, class type and teacher','Level, jenis kelas, dan pengajar','级别、班型、教师类型')},
         {value:'name-asc',label:t('Name · Ascending','Nama · Naik','名称升序')},
         {value:'name-desc',label:t('Name · Descending','Nama · Turun','名称降序')},
       ]}/>
     </EnrollmentSettingsListSummary>}
     {ready&&selected&&!selectedVisible&&catalog.templates.some(item=>item.id===selected)&&<p className="crm-work-muted">
       {t('The linked template is outside the current filters. Clear filters to show it.',
         'Templat yang ditautkan berada di luar filter saat ini. Hapus filter untuk menampilkannya.','当前筛选未包含链接指向的模板。清除筛选即可查看。')}
     </p>}
     {ready&&!!visible.length&&<AdminListTable label={title} busy={read==='loading'} headers={[
       {label:t('Template name','Nama templat','模板名称'),sort:filters.sort==='name-asc'?'ascending':filters.sort==='name-desc'?'descending':undefined},
       t('Class type and teacher','Jenis kelas dan pengajar','班型与师资'),
       t('Class size','Jumlah peserta','招生人数'),t('Price per period','Harga per jam pelajaran','每节报价'),t('Actions','Tindakan','操作'),
     ]}>
       {visible.map(item=>{
         const linkedCourse=course(item.courseId);
         const quote=linkedCourse&&enrollmentTemplateQuote(item,linkedCourse.sessions);
         return <tr key={item.id} id={'enrollment-template-row-'+item.id} tabIndex={-1}>
           <td><strong>{item.name}</strong>{linkedCourse?.teaching&&<div className="crm-work-muted">
             {linkedCourse.teaching.material} · {linkedCourse.sessions} {t('periods','jam pelajaran','节')} × {linkedCourse.teaching.minutes} {t('min','menit','分钟')}
           </div>}</td>
           <td>{formats[item.format]}<div className="crm-work-muted">{teachers[item.teacherType]}</div></td>
           <td>{item.format!=='one-on-one'&&<div>{t('Minimum fully paid','Minimum peserta lunas','足额到账开班底线')} {item.minimumPaid}</div>}
             <div>{t('Seat limit','Kapasitas','招生上限')} {item.capacity}</div>
           </td>
           <td>{quote?<><strong>{money(item.saleUnitPrice!)}</strong>{quote.standardPrice&&<> <del className="crm-work-muted">{money(item.standardUnitPrice!)}</del></>}
             <div className="crm-work-muted">{t('Enrollment total','Total harga pendaftaran','报名总价')} {money(quote.price)}</div></>:priceStatus(item)}</td>
           <td><div className="flex flex-wrap gap-x-3 gap-y-1">
             <AdminRowAction disabled={read!=='ready'} onClick={()=>edit(item)}>{t('Edit','Edit','编辑')}</AdminRowAction>
             {item.format!=='one-on-one'&&<AdminRowAction disabled={read!=='ready'} onClick={()=>onCreateClass?.(item.id)}>
               {t('Create class','Buat kelas','创建班次')}
             </AdminRowAction>}
             {!referencedTemplates.has(item.id)&&<AdminRowAction disabled={read!=='ready'} onClick={()=>{
               setDeleteError('');setDeleteUnknown(false);setDeleted(false);
               setDeleting({item,requestId:crypto.randomUUID()});
             }}>{t('Delete','Hapus','删除')}</AdminRowAction>}
           </div></td>
         </tr>;
       })}
     </AdminListTable>}
   {(read!=='ready'||!visible.length)&&!(awaitingSavedRead&&read==='error')&&<AdminListState lang={lang} state={read==='ready'?'empty':read} onRetry={()=>void load()}/>}
   {awaitingSavedRead&&read==='error'&&<AdminSavedReadError lang={lang} onRetry={()=>void load()}/>}
   {deleted&&<CrmSaveFeedback lang={lang} state="saved">{t('Template deleted.','Templat dihapus.','模板已删除。')}</CrmSaveFeedback>}
   {deleting&&<AdminConfirmation light={isLight} danger busy={busy}
     title={t('Delete class template?','Hapus templat kelas?','删除班型模板？')}
     description={deleting.item.name+' · '+t('This action cannot be undone.','Tindakan ini tidak dapat dibatalkan.','删除后无法恢复。')}
     cancelLabel={deleteUnknown?t('Close','Tutup','关闭'):t('Cancel','Batal','取消')}
     confirmLabel={deleteUnknown?t('Check result','Periksa hasil','查询结果'):t('Delete','Hapus','删除')}
     confirmDisabled={!deleteUnknown&&!!deleteError}
     onCancel={()=>{if(!inFlight.current)setDeleting(undefined);}} onConfirm={()=>void deleteTemplate()}>
     {deleteError&&<p role="alert">{deleteError}</p>}
   </AdminConfirmation>}
   </>}
   {quoteEdit&&!draft&&<AdminEditor lang={lang} light={isLight} variant="drawer" responsiveForm title={editorTitle} onClose={quoteEdit.onReturn}
     footer={<button type="button" onClick={quoteEdit.onReturn}>{returnToClass}</button>}>
     <AdminListState lang={lang} state={read==='ready'?'empty':read} onRetry={()=>void load()}/>
   </AdminEditor>}
   {draft&&<AdminEditor lang={lang} light={isLight} variant="drawer" className="crm-course-editor" responsiveForm required busy={busy}
     title={editorTitle} description={quoteEdit?draft.name:undefined} closeDisabled={!!pending} onClose={close} onSubmit={save}
     footer={<>
       {busy?<AdminFormFeedback className="basis-full" lang={lang} state="saving">
         {pending&&t('Checking save result…','Memeriksa hasil simpan…','正在查询保存结果…')}
       </AdminFormFeedback>:pending?<AdminFormFeedback className="basis-full" lang={lang} state="unknown">{error}</AdminFormFeedback>:
         error&&<AdminFormFeedback className="basis-full" lang={lang} state="error">{error}</AdminFormFeedback>}
       {pending?<button type="button" data-primary="" disabled={busy} onClick={check}>{t('Check save result','Periksa hasil','查询保存结果')}</button>:
         <><button type="button" onClick={close} disabled={busy}>{quoteEdit?returnToClass:t('Cancel','Batal','取消')}</button>
           <button type="submit" data-primary="" disabled={busy}>{quoteEdit?t('Save and return','Simpan dan kembali','保存并返回'):t('Save','Simpan','保存')}</button></>}
     </>}>
     <fieldset disabled={busy||!!pending} data-admin-section-stack="open">
       {quoteEdit&&pricingSection}
       <AdminFormSection variant="subgroup" title={t('Course','Kursus','课程')}>
         {!draft.revision&&field(t('Select a course','Pilih kursus','选择课程'),draft.courseId,
           catalog?.courses.filter(c=>c.teaching&&c.active).sort(compareEnrollmentTeachingCourses(lang)).map(c=>({value:c.id,label:c.name}))??[],
           v=>patch({courseId:v}),true)}
         {draftCourse?.teaching&&<AdminFormSummary fields={[
           ...(draft.revision?[[t('Course','Kursus','课程'),draftCourse.name,'wide'] as const]:[]),
           [t('Level','Level','级别'),draftCourse.teaching.level],
           [t('Main textbook and edition','Buku ajar utama dan edisi','主教材及版本'),draftCourse.teaching.material],
           [t('Periods','Jam pelajaran','总节数'),draftCourse.sessions],
           [t('Minutes per period','Menit per jam pelajaran','每节时长（分钟）'),draftCourse.teaching.minutes],
         ]}/>}
         {draft.revision>0&&!draftCourse?.teaching&&<AdminFormSummary fields={[[t('Course','Kursus','课程'),draftCourse?.name??'—']]}/>}
       </AdminFormSection>
       <AdminFormSection variant="subgroup" title={t('Class type and teacher','Jenis kelas dan pengajar','班型与师资')}>
         {draft.revision?<AdminFormSummary fields={[[formatLabel,draft.format?formats[draft.format]:'—'],[teacherLabel,draft.teacherType?teachers[draft.teacherType]:'—']]}/>:
           <AdminFormGrid>
             {field(formatLabel,draft.format,enrollmentTemplateFormats.map(value=>({value,label:formats[value]})),v=>changeFormat(v as EnrollmentTemplate['format']))}
             {field(teacherLabel,draft.teacherType,enrollmentTeacherTypes.map(value=>({value,label:teachers[value]})),v=>patch({teacherType:v as EnrollmentTemplate['teacherType']}))}
           </AdminFormGrid>}
         <div>
           <AdminField required>{t('Template name','Nama templat','模板名称')}<input required maxLength={200} value={draft.name} onChange={e=>{setManualName(true);patch({name:e.target.value},true);}}/>
             {!draft.revision&&!manualName&&<small>{t('Generated in English from the course, class type and teacher type.','Dibuat dalam bahasa Inggris dari kursus, jenis kelas dan jenis pengajar.','根据课程、班型和教师类型自动生成英文名称。')}</small>}
           </AdminField>
           {manualName&&draft.name!==auto(draft)&&<div className="admin-template-name-help"><button type="button" className="crm-work-link"
             onClick={()=>{setManualName(false);patch({},false);}}>{t('Use default name','Gunakan nama bawaan','使用默认名称')}</button></div>}
         </div>
       </AdminFormSection>
       <AdminFormSection variant="subgroup" title={t('Class size','Jumlah peserta','班级人数')}
         description={!draft.format?t('Choose a class type to set the default class size.','Pilih jenis kelas untuk mengisi jumlah peserta bawaan.','选择班型后自动带出默认人数。'):undefined}>
         {termsLocked?<AdminFormSummary fields={sizeFields.map(([key,label])=>[label,draft[key]])}/>:<AdminFormGrid>
           {sizeFields.map(([key,label])=><AdminField required key={key}>{label}
             <input required type="number" min="1" max="200" disabled={!draft.format} value={draft[key]||''} onChange={e=>changeSize(key,Number(e.target.value))}/>
           </AdminField>)}
         </AdminFormGrid>}
       </AdminFormSection>
       {!quoteEdit&&pricingSection}
     </fieldset>
   </AdminEditor>}
   {discard&&<AdminDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)} onDiscard={()=>{setDiscard(false);if(quoteEdit)quoteEdit.onReturn();else{setDraft(undefined);setDirty(false);}}}/>}
 </div>;
}
