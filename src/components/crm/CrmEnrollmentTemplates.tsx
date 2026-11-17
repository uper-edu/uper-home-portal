import {Plus} from 'lucide-react';
import {CrmPageAction} from './CrmPageAction';
import {useEffect,useRef,useState} from 'react';
import {AdminEditor} from '../admin/AdminEditor';
import {AdminConfirmation} from '../admin/AdminConfirmation';
import {AdminListState,AdminListTable} from '../admin/AdminList';
import {AdminRowAction} from '../admin/AdminListControl';
import {AdminRefreshAction} from '../admin/AdminRefreshAction';
import {AdminSearchField} from '../admin/AdminSearchField';
import {AdminStatus} from '../AdminStatus';
import {AdminField} from '../AdminForm';
import {AdminFormGrid,AdminFormSection,AdminFormSummary} from '../AdminFormLayout';
import {CrmDiscardDialog,CrmSaveFeedback} from './CrmDetailWorkspace';
import {CrmSingleSelect, type CrmChoice} from './CrmSingleSelect';
import {enrollmentLevels} from '../../utils/enrollmentCatalog';
import {defaultEnrollmentCourseName,enrollmentTemplateFormats,enrollmentTeacherTypes,enrollmentTemplateQuote,templateSize,type EnrollmentTemplate,type EnrollmentTeachingCourse} from '../../utils/enrollmentTemplates';
import {formatCurrency} from '../../utils/currency';
import type {CrmLanguage} from '../../utils/crmLanguage';

const endpoint='/api/crm/enrollment/templates';
type Catalog={courses:EnrollmentTeachingCourse[];templates:EnrollmentTemplate[];classes:{templateId?:string}[]};
type TemplateDraft=Omit<EnrollmentTemplate,'format'|'teacherType'>&{
 format:EnrollmentTemplate['format']|'';
 teacherType:EnrollmentTemplate['teacherType']|'';
};
type Props={lang:CrmLanguage;isLight:boolean;selected?:string;createFromCourse?:string;onCreateClass:(id:string)=>void;onDraftChange:(dirty:boolean)=>void};

export function CrmEnrollmentTemplates({lang,isLight,selected,createFromCourse,onCreateClass,onDraftChange}:Props){
 const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const title=t('Class templates','Templat kelas','班型模板');
 const [catalog,setCatalog]=useState<Catalog>(),[read,setRead]=useState<'loading'|'ready'|'denied'|'error'>('loading');
 const [search,setSearch]=useState(''),[level,setLevel]=useState(''),[quoteFilter,setQuoteFilter]=useState('');
 const [draft,setDraft]=useState<TemplateDraft>(),[manualName,setManualName]=useState(false),[dirty,setDirty]=useState(false);
 const [discard,setDiscard]=useState(false),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState('');
 const [pending,setPending]=useState<string>();
 const [deleting,setDeleting]=useState<{item:EnrollmentTemplate;requestId:string}>();
 const [deleteUnknown,setDeleteUnknown]=useState(false);
 const [deleteError,setDeleteError]=useState('');
 const [deleted,setDeleted]=useState(false);
 const request=useRef<AbortController|null>(null),inFlight=useRef(false),located=useRef<string|undefined>(undefined);
 const openedFromCourse=useRef<string|undefined>(undefined);
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
     if(!controller.signal.aborted){setCatalog(value);setRead('ready');}
   }catch{if(!controller.signal.aborted)setRead('error');}
 };
 useEffect(()=>{void load();return ()=>request.current?.abort();},[]);
 useEffect(()=>{onDraftChange(dirty||busy||!!pending||!!deleting);},[dirty,busy,pending,deleting,onDraftChange]);
 useEffect(()=>()=>onDraftChange(false),[onDraftChange]);

 const visible=catalog?.templates.filter(item=>{
   const c=course(item.courseId);
   const query=search.trim().toLowerCase();
   return [item.name,c?.name,c?.teaching?.material].some(value=>value?.toLowerCase().includes(query))&&
     (!level||c?.teaching?.level===level)&&(!quoteFilter||(item.saleUnitPrice?'ready':'missing')===quoteFilter);
 })??[];
 useEffect(()=>{
   if(!selected){located.current=undefined;return;}
   if(read!=='ready'||located.current===selected)return;
   const row=document.getElementById('enrollment-template-row-'+selected);
   if(!row)return;
   located.current=selected;
   row.scrollIntoView({block:'nearest'});
   row.focus({preventScroll:true});
 },[read,selected]);
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
   const seed:TemplateDraft=item??{id:crypto.randomUUID(),revision:0,name:'',courseId,format:'',teacherType:'',
     minimumPaid:0,capacity:0,standardUnitPrice:null,saleUnitPrice:null};
   setDraft({...seed,name:item?.name??auto(seed)});setManualName(!!item&&item.name!==auto(item));setError('');setSaved(false);setDirty(false);
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
 const close=()=>{if(busy||pending)return;if(dirty)setDiscard(true);else setDraft(undefined);};
 const complete=async()=>{
   await load();
   setDraft(undefined);setPending(undefined);setDirty(false);setSaved(true);onDraftChange(false);
 };
 const save=async(e:React.FormEvent)=>{
   e.preventDefault();
   if(!draft||!draft.courseId||!draft.format||!draft.teacherType||inFlight.current||pending)return;
   const requestId=crypto.randomUUID();
   inFlight.current=true;setBusy(true);setError('');
   try{
     const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...draft,requestId})});
     if(response.status>=500)throw Error();
     if(!response.ok){setError(response.status===409?t('Reload to check the latest version. Your draft is kept.','Muat ulang untuk memeriksa versi terbaru. Draf disimpan.','请刷新核对最新版本，草稿已保留。'):t('Check the name, seat limits and price pair.','Periksa nama, batas peserta, dan kedua harga.','请核对名称、人数及两项单价。'));return;}
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
 const field=(label:string,value:string,options:CrmChoice[],change:(v:string)=>void,disabled=false)=><AdminField required>{label}<CrmSingleSelect label={label} lang={lang} isLight={isLight} value={value} options={options} onChange={change} disabled={disabled}/></AdminField>;
 const searchLabel=t('Search templates','Cari templat','搜索模板');
 const filters=<div className="crm-ops-actions">
   <AdminSearchField label={searchLabel} placeholder={searchLabel} value={search} onChange={setSearch}/>
   <CrmSingleSelect label={t('Level','Level','级别')} value={level} onChange={setLevel} lang={lang} isLight={isLight} options={[{value:'',label:t('All levels','Semua level','全部级别')},...enrollmentLevels.map(v=>({value:v,label:v}))]}/>
   <CrmSingleSelect label={t('Quote status','Status harga','报价状态')} value={quoteFilter} onChange={setQuoteFilter} lang={lang} isLight={isLight} options={[
     {value:'',label:t('All quote statuses','Semua status harga','全部报价状态')},{value:'ready',label:t('Configured','Tersedia','已配置')},{value:'missing',label:t('Pending','Menunggu','待确认')}]}/>
 </div>;
 const draftCourse=draft&&course(draft.courseId),draftQuote=draft&&draftCourse&&enrollmentTemplateQuote(draft,draftCourse.sessions);
 const ready=!!catalog&&read!=='denied';
 const titleActions=<AdminRefreshAction label={t('Refresh','Segarkan','刷新')} loading={read==='loading'} onClick={()=>void load()}/>;
 return <div className="crm-course-catalog">
     <header className="admin-edit-header"><h2>{title}</h2><div className="crm-ops-actions">{titleActions}
       <CrmPageAction icon={Plus} variant="primary" label={t('New template','Templat baru','新建模板')} disabled={!newCourse||read!=='ready'} onClick={()=>edit()}/></div></header>
     {ready&&filters}
     {ready&&!!visible.length&&<AdminListTable label={title} busy={read==='loading'} headers={[
       t('Template name','Nama templat','模板名称'),t('Class type and teacher','Jenis kelas dan pengajar','班型与师资'),
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
             {item.format!=='one-on-one'&&<AdminRowAction disabled={read!=='ready'} onClick={()=>onCreateClass(item.id)}>
               {t('Create class','Buat kelas','创建班次')}
             </AdminRowAction>}
             {!referencedTemplates.has(item.id)&&<AdminRowAction disabled={read!=='ready'} onClick={()=>{
               setDeleteError('');setDeleteUnknown(false);setDeleted(false);setSaved(false);
               setDeleting({item,requestId:crypto.randomUUID()});
             }}>{t('Delete','Hapus','删除')}</AdminRowAction>}
           </div></td>
         </tr>;
       })}
     </AdminListTable>}
   {(read!=='ready'||!visible.length)&&<AdminListState lang={lang} state={read==='ready'?'empty':read} onRetry={()=>void load()}/>}
   {saved&&!draft&&<CrmSaveFeedback lang={lang} state="saved"/>}
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
   {draft&&<AdminEditor lang={lang} light={isLight} variant="drawer" className="crm-course-editor" responsiveForm required busy={busy}
     title={draft.revision?t('Edit template','Edit templat','编辑模板'):t('New template','Templat baru','新建模板')} onClose={close} onSubmit={save}
     footer={<><button type="button" onClick={close} disabled={busy||!!pending}>{t('Cancel','Batal','取消')}</button>
       {pending?<button type="button" disabled={busy} onClick={check}>{t('Check save result','Periksa hasil','查询保存结果')}</button>:
         <button type="submit" data-primary="" disabled={busy}>{t('Save','Simpan','保存')}</button>}</>}>
     {error&&<p role="alert">{error}</p>}{pending&&<CrmSaveFeedback lang={lang} state="unknown"/>}
     <fieldset disabled={busy||!!pending} data-admin-section-stack="open">
       <AdminFormSection variant="subgroup" title={t('Course','Kursus','课程')}>
         {field(t('Select a course','Pilih kursus','选择课程'),draft.courseId,catalog?.courses.filter(c=>c.teaching&&(c.active||c.id===draft.courseId)).map(c=>({value:c.id,label:c.name}))??[],v=>patch({courseId:v}),!!draft.revision)}
         {draftCourse?.teaching&&<AdminFormSummary fields={[
           [t('Level','Level','级别'),draftCourse.teaching.level],
           [t('Main textbook and edition','Buku ajar utama dan edisi','主教材及版本'),draftCourse.teaching.material],
           [t('Periods','Jam pelajaran','总节数'),draftCourse.sessions],
           [t('Minutes per period','Menit per jam pelajaran','每节时长（分钟）'),draftCourse.teaching.minutes],
         ]}/>}
       </AdminFormSection>
       <AdminFormSection variant="subgroup" title={t('Class type and teacher','Jenis kelas dan pengajar','班型与师资')}>
         <AdminFormGrid>
           {field(t('Class type','Jenis kelas','班型'),draft.format,enrollmentTemplateFormats.map(value=>({value,label:formats[value]})),v=>{const format=v as EnrollmentTemplate['format'];patch({format,capacity:templateSize[format].capacity,minimumPaid:templateSize[format].minimumPaid});},!!draft.revision)}
           {field(t('Teacher type','Jenis pengajar','教师类型'),draft.teacherType,enrollmentTeacherTypes.map(value=>({value,label:teachers[value]})),v=>patch({teacherType:v as EnrollmentTemplate['teacherType']}),!!draft.revision)}
           <div data-admin-full-width="">
             <AdminField required>{t('Template name','Nama templat','模板名称')}<input required maxLength={200} value={draft.name} onChange={e=>{setManualName(true);patch({name:e.target.value},true);}}/></AdminField>
             <div className="admin-template-name-help">
               <small className="crm-work-muted">{t('The default name uses the course, class type and teacher type in English format. You can edit it.','Nama bawaan memakai kursus, jenis kelas, dan jenis pengajar dalam format bahasa Inggris. Nama dapat diedit.','默认用英文格式按课程、班型和教师类型命名，可手动修改。')}</small>
               {manualName&&draft.name!==auto(draft)&&<button type="button" className="crm-work-link"
                 onClick={()=>{setManualName(false);patch({},false);}}>{t('Use default name','Gunakan nama bawaan','使用默认名称')}</button>}
             </div>
           </div>
         </AdminFormGrid>
       </AdminFormSection>
       <AdminFormSection variant="subgroup" title={t('Class size','Jumlah peserta','招生人数')}><AdminFormGrid>
         {([['minimumPaid',t('Minimum fully paid to open','Minimum peserta lunas','足额到账开班底线')],['capacity',t('Seat limit','Kapasitas','招生上限')]] as const).map(([key,label])=><AdminField required key={key}>{label}<input required type="number" min="1" max="200" value={draft[key]||''} onChange={e=>patch({[key]:Number(e.target.value)})}/></AdminField>)}
       </AdminFormGrid></AdminFormSection>
       <AdminFormSection variant="subgroup" title={t('Price per period','Harga per jam pelajaran','每节报价')}><AdminFormGrid>
         {([['standardUnitPrice',t('Standard price (Rp)','Harga standar (Rp)','标准价（Rp）')],['saleUnitPrice',t('Enrollment price (Rp)','Harga pendaftaran (Rp)','报名优惠价（Rp）')]] as const).map(([key,label])=><AdminField key={key}>{label}<input type="number" min="1" value={draft[key]??''} onChange={e=>patch({[key]:e.target.value?Number(e.target.value):null})}/></AdminField>)}
       </AdminFormGrid>
       {draftQuote?<AdminFormSummary title={t('Total tuition','Total biaya kursus','学费总价')} fields={[
         [t('Standard total','Total harga standar','标准总价'),draftQuote.standardPrice?<del>{money(draftQuote.standardPrice)}</del>:'—'],
         [t('Enrollment total','Total harga pendaftaran','报名总价'),<strong>{money(draftQuote.price)}</strong>],
       ]}/>:<p className="crm-work-muted">{priceStatus(draft)}</p>}
       <small className="crm-work-muted">{t('Published classes and existing orders keep their saved prices.','Kelas terbit dan pesanan lama mempertahankan harga tersimpan.','已发布班次和已有订单沿用原价。')}</small></AdminFormSection>
     </fieldset>
   </AdminEditor>}
   {discard&&<CrmDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)} onDiscard={()=>{setDiscard(false);setDraft(undefined);setDirty(false);}}/>}
 </div>;
}
