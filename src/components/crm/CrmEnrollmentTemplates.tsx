import {Pencil,Plus} from 'lucide-react';
import {CrmPageAction} from './CrmPageAction';
import './crm-record-workspace.css';
import {useEffect,useRef,useState} from 'react';
import {AdminEditor} from '../admin/AdminEditor';
import {AdminListState,AdminListTable} from '../admin/AdminList';
import {AdminRecordEntry} from '../admin/AdminListControl';
import {AdminRecordHeader} from '../admin/AdminRecordHeader';
import {AdminDetailActions,AdminRecordRow,AdminRecordSidebar,AdminRecordTitle} from '../admin/AdminRecordWorkspace';
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
type Catalog={courses:EnrollmentTeachingCourse[];templates:EnrollmentTemplate[]};
type TemplateDraft=Omit<EnrollmentTemplate,'format'|'teacherType'>&{
 format:EnrollmentTemplate['format']|'';
 teacherType:EnrollmentTemplate['teacherType']|'';
};
type Props={lang:CrmLanguage;isLight:boolean;selected?:string;onSelect:(id?:string)=>void;onCreateClass:(id:string)=>void;onDraftChange:(dirty:boolean)=>void};

export function CrmEnrollmentTemplates({lang,isLight,selected,onSelect,onCreateClass,onDraftChange}:Props){
 const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const title=t('Class templates','Templat kelas','班型模板');
 const [catalog,setCatalog]=useState<Catalog>(),[read,setRead]=useState<'loading'|'ready'|'denied'|'error'>('loading');
 const [search,setSearch]=useState(''),[level,setLevel]=useState(''),[quoteFilter,setQuoteFilter]=useState('');
 const [draft,setDraft]=useState<TemplateDraft>(),[manualName,setManualName]=useState(false),[dirty,setDirty]=useState(false);
 const [discard,setDiscard]=useState(false),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState('');
 const [pending,setPending]=useState<string>();
 const request=useRef<AbortController|null>(null),inFlight=useRef(false),focusedEntry=useRef<HTMLButtonElement|null>(null),listTop=useRef(0);
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
 useEffect(()=>{onDraftChange(dirty||busy||!!pending);},[dirty,busy,pending,onDraftChange]);
 useEffect(()=>()=>onDraftChange(false),[onDraftChange]);

 const visible=catalog?.templates.filter(item=>{
   const c=course(item.courseId);
   const query=search.trim().toLowerCase();
   return [item.name,c?.name,c?.teaching?.material].some(value=>value?.toLowerCase().includes(query))&&
     (!level||c?.teaching?.level===level)&&(!quoteFilter||(item.saleUnitPrice?'ready':'missing')===quoteFilter);
 })??[];
 const current=catalog?.templates.find(item=>item.id===selected);
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
 const edit=(item?:EnrollmentTemplate)=>{
   if(!item&&!newCourse)return;
   const seed:TemplateDraft=item??{id:crypto.randomUUID(),revision:0,name:'',courseId:'',format:'',teacherType:'',
     minimumPaid:0,capacity:0,standardUnitPrice:null,saleUnitPrice:null};
   setDraft({...seed,name:item?.name??auto(seed)});setManualName(!!item&&item.name!==auto(item));setError('');setSaved(false);setDirty(false);
 };
 const patch=(values:Partial<TemplateDraft>,manual=manualName)=>{
   setDraft(prev=>{
     if(!prev)return prev;
     const next={...prev,...values};
     return manual?next:{...next,name:auto(next)};
   });
   setDirty(true);setError('');
 };
 const close=()=>{if(busy||pending)return;if(dirty)setDiscard(true);else setDraft(undefined);};
 const complete=async(id:string)=>{
   await load();
   setDraft(undefined);setPending(undefined);setDirty(false);setSaved(true);onDraftChange(false);
   if(selected!==id)onSelect(id);
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
     await complete(draft.id);
   }catch{setPending(requestId);}finally{inFlight.current=false;setBusy(false);}
 };
 const check=async()=>{
   if(!draft||!pending||inFlight.current)return;
   inFlight.current=true;setBusy(true);
   try{
     const response=await fetch(endpoint+'/results/'+encodeURIComponent(pending),{cache:'no-store'});
     if(!response.ok||(await response.json()).templateId!==draft.id)throw Error();
     await complete(draft.id);
   }catch{setError(t('Save not confirmed. Check again before retrying.','Penyimpanan belum terkonfirmasi. Periksa lagi.','保存结果未确认，请继续查询。'));}
   finally{inFlight.current=false;setBusy(false);}
 };
 const field=(label:string,value:string,options:CrmChoice[],change:(v:string)=>void,disabled=false)=><AdminField required>{label}<CrmSingleSelect label={label} lang={lang} isLight={isLight} value={value} options={options} onChange={change} disabled={disabled}/></AdminField>;
 const searchLabel=t('Search templates','Cari templat','搜索模板');
 const filters=<div className="crm-ops-actions">
   <AdminSearchField label={searchLabel} placeholder={searchLabel} value={search} onChange={setSearch}/>
   <CrmSingleSelect label={t('Level','Level','级别')} value={level} onChange={setLevel} lang={lang} isLight={isLight} options={[{value:'',label:t('All levels','Semua level','全部级别')},...enrollmentLevels.map(v=>({value:v,label:v}))]}/>
   <CrmSingleSelect label={t('Quote status','Status harga','报价状态')} value={quoteFilter} onChange={setQuoteFilter} lang={lang} isLight={isLight} options={[
     {value:'',label:t('All quote statuses','Semua status harga','全部报价状态')},{value:'ready',label:t('Configured','Tersedia','已配置')},{value:'missing',label:t('Pending','Menunggu','待确认')}]}/>
 </div>;
 const back=()=>{onSelect(undefined);requestAnimationFrame(()=>requestAnimationFrame(()=>{window.scrollTo(0,listTop.current);document.querySelector<HTMLElement>('[data-template-entry="'+focusedEntry.current?.dataset.templateEntry+'"]')?.focus({preventScroll:true});}));};
 const currentCourse=current&&course(current.courseId),currentQuote=current&&currentCourse&&enrollmentTemplateQuote(current,currentCourse.sessions);
 const draftCourse=draft&&course(draft.courseId),draftQuote=draft&&draftCourse&&enrollmentTemplateQuote(draft,draftCourse.sessions);
 const ready=!!catalog&&read!=='denied';
 const titleActions=<AdminRefreshAction label={t('Refresh','Segarkan','刷新')} loading={read==='loading'} onClick={()=>void load()}/>;
 return <div className="crm-course-catalog">
   {current&&ready?<><AdminRecordHeader back={{label:t('Back to templates','Kembali ke templat','返回班型模板'),onClick:back}}
     title={<AdminRecordTitle title={current.name} status={priceStatus(current)}/>}
     actions={<AdminDetailActions label={title} primary={<CrmPageAction icon={Pencil} variant="primary" label={t('Edit template','Edit templat','编辑模板')} onClick={()=>edit(current)}/>}
       secondary={current.format!=='one-on-one'&&<button type="button" className="crm-work-button" onClick={()=>onCreateClass(current.id)}>{t('Create class from template','Buat kelas dari templat','使用模板创建班次')}</button>}/>}/>
     <div className="grid min-w-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]" data-record-detail="true">
       <AdminRecordSidebar id="enrollment-template-sidebar" title={title} selectedId={current.id} busyLabel={t('Loading','Memuat','正在读取')} filters={filters}>
         {visible.map(item=><AdminRecordRow key={item.id} selected={item.id===current.id} name={item.name} title={item.name} onClick={()=>onSelect(item.id)} meta={course(item.courseId)?.teaching?.material}/>)}
       </AdminRecordSidebar>
       <div className="crm-detail-panel min-w-0 space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
         <AdminFormSection title={t('Course and teacher','Kursus dan pengajar','课程与师资')}>
           <p>{currentCourse?.name} · {currentCourse?.teaching?.material}</p>
           <p>{currentCourse?.sessions} × {currentCourse?.teaching?.minutes} min · {formats[current.format]} · {teachers[current.teacherType]}</p>
         </AdminFormSection>
         <AdminFormSection title={t('Enrollment rules','Aturan pendaftaran','招生规则')}>
           <p>{templateSize[current.format].typical} · {t('Seat limit','Kapasitas','招生上限')} {current.capacity}</p>
           {current.format!=='one-on-one'&&<p>{t('Minimum fully paid to open','Minimum peserta lunas','足额到账开班底线')} {current.minimumPaid}</p>}
         </AdminFormSection>
         <AdminFormSection title={t('Quote','Harga','报价')}>
           {currentQuote?<><p>{money(current.standardUnitPrice!)} → <strong>{money(current.saleUnitPrice!)}</strong></p>
             <p>{currentQuote.standardPrice&&<del>{money(currentQuote.standardPrice)} </del>}<strong>{money(currentQuote.price)}</strong></p></>:priceStatus(current)}
         </AdminFormSection>
       </div>
     </div></>:<>
     <header className="admin-edit-header"><h2>{title}</h2><div className="crm-ops-actions">{titleActions}
       <CrmPageAction icon={Plus} variant="primary" label={t('New template','Templat baru','新建模板')} disabled={!newCourse||read!=='ready'} onClick={()=>edit()}/></div></header>
     {ready&&filters}
     {ready&&!!visible.length&&<AdminListTable label={title} busy={read==='loading'} headers={[t('Template name','Nama templat','模板名称'),t('Class type','Jenis kelas','班型'),t('Teacher type','Jenis pengajar','教师类型'),t('Typical size','Ukuran kelas','通常人数'),t('Price per lesson','Harga per sesi','每节优惠价'),t('Quote status','Status harga','报价状态')]}>
       {visible.map(item=><tr key={item.id}><td><AdminRecordEntry data-template-entry={item.id} onClick={e=>{focusedEntry.current=e.currentTarget;listTop.current=window.scrollY;onSelect(item.id);}}>{item.name}</AdminRecordEntry>
         <div>{course(item.courseId)?.teaching?.material} · {course(item.courseId)?.sessions}</div></td><td>{formats[item.format]}</td><td>{teachers[item.teacherType]}</td>
         <td>{templateSize[item.format].typical}</td><td>{item.saleUnitPrice?money(item.saleUnitPrice):'—'}</td><td>{priceStatus(item)}</td></tr>)}
     </AdminListTable>}
   </>}
   {(read!=='ready'||!current&&!visible.length)&&<AdminListState lang={lang} state={read==='ready'?'empty':read} onRetry={()=>void load()}/>}
   {saved&&!draft&&<CrmSaveFeedback lang={lang} state="saved"/>}
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
           [t('Lessons','Sesi','总节数'),draftCourse.sessions],
           [t('Minutes per lesson','Menit per sesi','每节时长（分钟）'),draftCourse.teaching.minutes],
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
       <AdminFormSection variant="subgroup" title={t('Quote per lesson','Harga per sesi','每节报价')}><AdminFormGrid>
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
