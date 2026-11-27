import {useEffect,useId,useLayoutEffect,useRef,useState,type FormEvent,type MouseEvent,type ReactNode} from 'react';
import {Paperclip,Pencil,Plus} from 'lucide-react';
import {AdminField} from '../AdminForm';
import {AdminFormFeedback,AdminFormGrid,AdminFormSection} from '../AdminFormLayout';
import {AdminStatus} from '../AdminStatus';
import {AdminDateField} from '../admin/AdminDateField';
import {AdminDetailTabs} from '../admin/AdminDetailTabs';
import {AdminDisclosure} from '../admin/AdminDisclosure';
import {AdminDiscardDialog} from '../admin/AdminDiscardDialog';
import {AdminEditor} from '../admin/AdminEditor';
import {AdminListPagination,AdminListState,AdminListTable} from '../admin/AdminList';
import {AdminRecordEntry,AdminRowAction} from '../admin/AdminListControl';
import {AdminRecordHeader,type AdminBackTarget} from '../admin/AdminRecordHeader';
import {AdminPageAction} from '../admin/AdminPageAction';
import {AdminRefreshAction} from '../admin/AdminRefreshAction';
import {AdminListToolbar} from '../admin/AdminListToolbar';
import {AdminSingleSelect} from '../admin/AdminSingleSelect';
import {AdminPageHeader} from '../admin/AdminPageHeader';
import {CrmDetailActions,CrmRecordTitle} from './CrmRecordWorkspace';
import {useEnrollmentSettingsFilters} from './EnrollmentSettingsListControls';
import type {CrmLanguage} from '../../utils/crmLanguage';
import {formatCrmOperatingTime,viewerTimeZone} from '../../utils/crmOperatingTime';
import {facultyAmount,facultyDateValid,facultyEffectiveDate,facultyEmploymentTypes,facultyEndpoint,facultyFields,facultyFileLimits,facultyLanguages,facultyMinorAmount,facultyName,
  facultyPresetTitles,facultyTeacherLabels,facultyText,facultyTitleLabel,facultyTitleOptions,facultyTitleSelection,facultyTitleSuggestion,facultyTitles,withFacultyTitles,
  type FacultyBio,type FacultyCurrency,type FacultyDirectoryEntry,type FacultyFileInput,type FacultyFileKind,
  type FacultyProfile,type FacultyRates,type FacultyTerm} from '../../utils/crmFaculty';

const words={
  title:['教师档案','Faculty directory','Direktori pengajar'],
  add:['新增教师','Add teacher','Tambah pengajar'],
  listHint:['查看与维护教师资料，查看排课状态。','Review and maintain faculty profiles and scheduling status.','Lihat dan kelola profil serta status penjadwalan pengajar.'],
  back:['返回教师档案','Back to faculty directory','Kembali ke direktori pengajar'],
  actions:['教师档案操作','Faculty profile actions','Tindakan profil pengajar'],
  rowActions:['操作','Actions','Tindakan'],
  view:['查看详情','View details','Lihat detail'],
  rowEdit:['编辑','Edit','Edit'],
  search:['搜索教师姓名','Search teacher names','Cari nama pengajar'],
  allCategories:['全部教师类别','All teacher categories','Semua kategori pengajar'],
  allStatuses:['全部状态','All statuses','Semua status'],
  nameAsc:['姓名升序','Name ascending','Nama menaik'],
  nameDesc:['姓名降序','Name descending','Nama menurun'],
  refresh:['刷新','Refresh','Segarkan'],
  refreshFailed:['刷新失败，仍显示上次读取的档案。','Refresh failed. The previous results are still shown.','Penyegaran gagal. Hasil sebelumnya tetap ditampilkan.'],
  edit:['编辑档案','Edit profile','Edit profil'],
  name:['教师姓名','Teacher name','Nama pengajar'],
  separateTitle:['拆分姓名和职称','Separate name and title','Pisahkan nama dan jabatan'],
  noTitle:['不填写','No title','Tanpa jabatan'],
  employmentType:['任职类型','Employment type','Jenis pekerjaan'],
  notSpecified:['未填写','Not specified','Belum diisi'],
  allTitles:['全部职称','All titles','Semua jabatan'],
  otherTitles:['其他职称','Other titles','Jabatan lainnya'],
  allEmploymentTypes:['全部任职类型','All employment types','Semua jenis pekerjaan'],
  allBillingMethods:['全部计费方式','All pay bases','Semua dasar pembayaran'],
  billingUnset:['未设置计费方式','Pay basis not set','Dasar pembayaran belum diatur'],
  category:['教师类别','Teacher category','Kategori pengajar'],
  status:['状态','Status','Status'],
  active:['可排课','Available for scheduling','Tersedia untuk penjadwalan'],
  inactive:['停用','Inactive','Nonaktif'],
  profile:['档案资料','Profile','Profil'],
  photo:['照片','Photo','Foto'],
  cv:['简历文件','CV file','Berkas CV'],
  attachments:['照片与简历','Photo and CV','Foto dan CV'],
  files:['附件','Attachments','Lampiran'],
  choosePhoto:['选择照片','Choose photo','Pilih foto'],
  chooseCv:['选择简历','Choose CV','Pilih CV'],
  noFile:['未上传','No file uploaded','Belum diunggah'],
  fileHelp:['照片支持 JPG、PNG，最多 8 MB。简历也支持 PDF，最多 2 MB。','Photos accept JPG and PNG up to 8 MB. CVs also accept PDF, up to 2 MB.','Foto mendukung JPG dan PNG hingga 8 MB. CV juga mendukung PDF hingga 2 MB.'],
  remove:['移除文件','Remove file','Hapus berkas'],
  rates:['课酬','Compensation','Honorarium'],
  editRates:['编辑课酬','Edit compensation','Edit honorarium'],
  pendingDate:['待确认生效日','Start date pending','Tanggal mulai belum dikonfirmasi'],
  unknownCurrency:['待确认币种','Currency pending','Mata uang belum dikonfirmasi'],
  rateHistory:['课酬调整记录','Compensation history','Riwayat perubahan honorarium'],
  priorRate:['调整前','Before','Sebelum perubahan'],
  nextRate:['调整后','After','Sesudah perubahan'],
  reason:['调整原因','Reason for change','Alasan perubahan'],
  noHistory:['暂无课酬调整记录。','No compensation changes yet.','Belum ada riwayat perubahan honorarium.'],
  contract:['合同生效日','Contract start date','Tanggal mulai kontrak'],
  phaseShort:['生效后月数','Months after start','Bulan setelah mulai'],
  effective:['本段生效日','Effective from','Berlaku sejak'],
  phase:['费率阶段','Rate phase','Fase tarif'],
  kind:['计费方式','Pay basis','Dasar pembayaran'],
  lessonBasis:['按课时','Per lesson','Per sesi'],
  monthlyBasis:['月薪','Monthly salary','Gaji bulanan'],
  scheduledBasis:['待生效','Not yet effective','Belum berlaku'],
  lesson:['按课时（45 分钟一节）','Per 45-minute lesson','Per sesi 45 menit'],
  monthly:['月薪 · 待分摊','Monthly salary · allocation pending','Gaji bulanan · alokasi tertunda'],
  currency:['币种','Currency','Mata uang'],
  amount:['金额','Amount','Jumlah'],
  rateNote:['协议备注','Agreement notes','Catatan perjanjian'],
  addRate:['新增费率阶段','Add rate phase','Tambah fase tarif'],
  removeRate:['移除阶段','Remove phase','Hapus fase'],
  noRates:['尚未维护课酬。','Compensation has not been configured.','Honorarium belum diatur.'],
  cancel:['取消','Cancel','Batal'],
  save:['保存','Save','Simpan'],
  saved:['已保存。','Saved.','Tersimpan.'],
  invalid:['请核对必填项、金额、合同日期及费率阶段。','Check the required fields, amount, contract dates and rate phases.','Periksa kolom wajib, jumlah, tanggal kontrak, dan fase tarif.'],
  conflict:['记录已更新。草稿已保留，关闭编辑后可核对最新档案。','A newer revision exists. Your draft is retained. Close the editor to review the latest profile.','Ada versi lebih baru. Draf disimpan. Tutup editor untuk memeriksa profil terbaru.'],
  nameHelp:['至少填写一种语言的教师姓名。','Enter the teacher name in at least one language.','Isi nama pengajar dalam setidaknya satu bahasa.'],
  nameMissing:['请至少填写一种语言的教师姓名。','Enter the teacher name in at least one language.','Isi nama pengajar dalam setidaknya satu bahasa.'],
  version:['资料语言','Profile language','Bahasa profil'],
  fileInvalid:['请检查文件格式和大小。','Check the file type and size.','Periksa jenis dan ukuran berkas.'],
  reread:['核对保存结果','Check save result','Periksa hasil simpan'],
  basic:['基本信息','Basic information','Informasi dasar'],
  education:['教育与语言','Education and languages','Pendidikan dan bahasa'],
  experience:['职务与经历','Roles and experience','Jabatan dan pengalaman'],
  teaching:['研究与教学','Research and teaching','Riset dan pengajaran'],
  noneInLanguage:['当前语言暂无履历资料。','No biography in this language.','Belum ada riwayat profil dalam bahasa ini.'],
  viewProfileLanguage:['查看资料','View profile in','Lihat profil dalam'],
} as const;
type Word=keyof typeof words;
type Mode='profile'|'rates';
type Details={profile:FacultyProfile;rates?:FacultyRates};
type RateDraft=Omit<FacultyTerm,'amountMinor'>&{amount:string;key:number;contractGroup?:string};
const profileGroups=[
  {title:'education',fields:['qualification','education','chineseProficiency','languages']},
  {title:'experience',fields:['positions','teachingExperience','chineseTeachingExperience','internationalExperience','leadershipExperience','practicalExperience']},
  {title:'teaching',fields:['researchAreas','academicAchievements','publications','teachingExpertise','strengths','teachingHighlights','teachingFeatures']},
] as const satisfies readonly {title:Word;fields:readonly (keyof typeof facultyFields)[]}[];
const fullWidthFacts=new Set<keyof typeof facultyFields>(['education','positions','publications']);
const defaultFilters={search:'',category:'',status:'',professionalTitle:'',employmentType:'',billingMethod:'',sort:'name-asc'};
const pageSize=25;
const employmentChoices=(lang:CrmLanguage)=>Object.entries(facultyEmploymentTypes).map(([value,labels])=>({value,label:facultyText(lang,labels)}));

function followWorkspaceLink(event:MouseEvent<HTMLAnchorElement>,navigate:(href:string)=>void){
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.defaultPrevented)return;
  event.preventDefault();
  navigate(event.currentTarget.href);
}

function rateDraft(term:FacultyTerm,key:number):RateDraft{
  return {...term,key,contractGroup:term.contractStart,amount:term.amountMinor===null||term.currency===null?'':facultyAmount(term.amountMinor,term.currency)};
}
function hasProfileText(bio?:FacultyBio){
  return Object.entries(bio??{}).some(([field,value])=>field!=='professionalTitle'&&value?.trim());
}
async function get<T>(url:string,signal?:AbortSignal){
  const response=await fetch(url,{cache:'no-store',signal});
  if(!response.ok)throw Object.assign(Error(),{status:response.status});
  return response.json() as Promise<T>;
}
function filePayload(file:File){
  return new Promise<FacultyFileInput>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=reject;
    reader.onload=()=>resolve({name:file.name,type:file.type,data:String(reader.result).split(',')[1]??''});
    reader.readAsDataURL(file);
  });
}

export function CrmFaculty({lang,isLight,canEdit,canRates,canReadRates=canRates,onDraftChange,selectedId,secondaryActions,listHref,recordHref,onNavigate}:{
  lang:CrmLanguage;isLight:boolean;canEdit:boolean;canRates:boolean;canReadRates?:boolean;onDraftChange:(dirty:boolean)=>void;
  selectedId?:string;secondaryActions?:ReactNode;listHref:string;recordHref:(id:string)=>string;onNavigate:(href:string)=>void;
}){
  const t=(key:Word)=>facultyText(lang,words[key]);
  const [items,setItems]=useState<FacultyDirectoryEntry[]>();
  const [listState,setListState]=useState<'loading'|'ready'|'error'|'denied'>('loading');
  const {filters,change,clear}=useEnrollmentSettingsFilters('faculty',defaultFilters);
  const [page,setPage]=useState(1);
  const [adding,setAdding]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const [justCreated,setJustCreated]=useState<string>();
  const [editRequest,setEditRequest]=useState<string>();
  const position=useRef<{focusId:string;top:number;left:number}|undefined>(undefined);
  const table=useRef<HTMLDivElement>(null);
  const heading=useRef<HTMLHeadingElement>(null);
  const reload=()=>{setListState('loading');setRefresh(value=>value+1);};
  useEffect(()=>{
    if(selectedId)return;
    const abort=new AbortController();
    get<FacultyDirectoryEntry[]>(facultyEndpoint,abort.signal).then(rows=>{
      if(!abort.signal.aborted){setItems(rows);setListState('ready');}
    }).catch(error=>{
      if(abort.signal.aborted)return;
      if(error.status===403||error.status===401){setItems(undefined);setListState('denied');}
      else setListState('error');
    });
    return ()=>abort.abort();
  },[refresh,selectedId]);
  const search=filters.search.trim().toLocaleLowerCase();
  const names=new Intl.Collator(lang,{sensitivity:'base',numeric:true});
  const billingFilter=canReadRates?filters.billingMethod:'';
  const optionalMatch=(selected:string,value?:string)=>!selected||selected===(value||'unset');
  const filtered=(items??[]).filter(item=>(!filters.category||item.category===filters.category)&&
    (!filters.status||item.active===(filters.status==='active'))&&
    optionalMatch(filters.professionalTitle,facultyTitleSelection(item.professionalTitles??{}))&&
    optionalMatch(filters.employmentType,item.employmentType)&&optionalMatch(billingFilter,item.billingMethod?.kind)&&
    Object.values(item.names).some(name=>name.toLocaleLowerCase().includes(search)))
    .sort((a,b)=>(filters.sort==='name-desc'?-1:1)*names.compare(facultyName(a.names,lang),facultyName(b.names,lang))||a.id.localeCompare(b.id));
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize)),currentPage=Math.min(page,pageCount);
  const rows=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
  useLayoutEffect(()=>{
    if(selectedId&&editRequest)setEditRequest(undefined);
    if(selectedId||!position.current||!items)return;
    const {focusId,top,left}=position.current;
    position.current=undefined;
    window.scrollTo({top,behavior:'instant'});
    if(table.current)table.current.scrollLeft=left;
    (document.getElementById(focusId)??heading.current)?.focus({preventScroll:true});
  },[selectedId,items,editRequest]);
  const back:AdminBackTarget={label:t('back'),href:listHref,onClick:event=>followWorkspaceLink(event,onNavigate)};
  if(selectedId)return <FacultyEditor key={selectedId} id={selectedId} lang={lang} isLight={isLight} canEdit={canEdit}
    canRates={canRates} back={back} created={justCreated===selectedId} onClose={()=>onNavigate(listHref)}
    openForEdit={editRequest===selectedId} onDraftChange={onDraftChange}/>;

  const openRecord=(id:string,focusId:string,href:string,edit=false)=>{
    position.current={focusId,top:window.scrollY,left:table.current?.scrollLeft??0};
    setJustCreated(undefined);
    setEditRequest(edit?id:undefined);
    onNavigate(href);
  };
  const updateFilter=(patch:Parameters<typeof change>[0])=>{change(patch);setPage(1);};
  const filterSelect=(filter:Exclude<keyof typeof defaultFilters,'search'|'sort'>,label:string,all:Word,options:{value:string;label:string}[])=>{
    const selected=options.find(option=>option.value===filters[filter]);
    return <AdminSingleSelect lang={lang} isLight={isLight} label={label} value={filters[filter]}
      displayValue={selected?`${label} · ${selected.label}`:undefined}
      onChange={value=>updateFilter({[filter]:value})} options={[{value:'',label:t(all)},...options]}/>;
  };
  return <div className="crm-course-catalog">
    <AdminPageHeader title={t('title')} subtitle={t('listHint')} headingRef={heading} actions={(secondaryActions||listState!=='denied')&&<>
      {secondaryActions}
      {listState!=='denied'&&<>
        <AdminRefreshAction label={t('refresh')} loading={listState==='loading'} onClick={reload}/>
        {canEdit&&<AdminPageAction label={t('add')} icon={Plus} variant="primary" aria-haspopup="dialog" onClick={()=>setAdding(true)}/>}
      </>}
    </>}/>
    {items&&<AdminListToolbar lang={lang} isLight={isLight} count={filtered.length} total={items.length}
      filtered={Boolean(filters.search||filters.category||filters.status||filters.professionalTitle||filters.employmentType||billingFilter)}
      onClear={()=>{clear();setPage(1);}}
      search={{label:t('search'),placeholder:t('search'),value:filters.search,onChange:search=>updateFilter({search})}}
      sort={{value:filters.sort,onChange:sort=>updateFilter({sort}),options:[
        {value:'name-asc',label:t('nameAsc')},{value:'name-desc',label:t('nameDesc')},
      ]}}
      more={{count:[filters.professionalTitle,filters.employmentType,billingFilter].filter(Boolean).length,fields:<>
        {filterSelect('professionalTitle',facultyText(lang,facultyFields.professionalTitle),'allTitles',[
          ...facultyTitleOptions(lang),{value:'legacy',label:t('otherTitles')},{value:'unset',label:t('notSpecified')},
        ])}
        {filterSelect('employmentType',t('employmentType'),'allEmploymentTypes',[
          ...employmentChoices(lang),{value:'unset',label:t('notSpecified')},
        ])}
        {canReadRates&&filterSelect('billingMethod',t('kind'),'allBillingMethods',[
          {value:'lesson',label:t('lessonBasis')},{value:'monthly',label:t('monthlyBasis')},{value:'unset',label:t('billingUnset')},
        ])}
      </>}}>
        {filterSelect('category',t('category'),'allCategories',(['local','foreign'] as const).map(value=>({value,label:facultyText(lang,facultyTeacherLabels[value])})))}
        {filterSelect('status',t('status'),'allStatuses',(['active','inactive'] as const).map(value=>({value,label:t(value)})))}
    </AdminListToolbar>}
    {(listState==='error'||!items||listState==='ready'&&!rows.length)&&<AdminListState lang={lang}
      state={listState==='ready'?'empty':listState} message={listState==='error'&&items?t('refreshFailed'):undefined} onRetry={reload}/>}
    {!!rows.length&&<>
      <AdminListTable label={t('title')} viewportRef={table} busy={listState==='loading'}
        headers={[{label:t('name'),sort:filters.sort==='name-desc'?'descending':'ascending'},
          facultyText(lang,facultyFields.professionalTitle),t('category'),t('employmentType'),
          ...(canReadRates?[t('kind')]:[]),t('status'),t('rowActions')]}>
        {rows.map(item=>{
          const href=recordHref(item.id),entryId='faculty-entry-'+item.id,actionId='faculty-action-'+item.id;
          const name=facultyName(item.names,lang);
          const billing=item.billingMethod;
          return <tr key={item.id}><th scope="row">
            <AdminRecordEntry id={entryId} href={href} onClick={event=>
              followWorkspaceLink(event,url=>openRecord(item.id,entryId,url))}>{name}</AdminRecordEntry>
          </th><td>{facultyTitleLabel(item.professionalTitles??{},lang)||'—'}</td>
          <td>{facultyText(lang,facultyTeacherLabels[item.category])}</td>
          <td>{item.employmentType?facultyText(lang,facultyEmploymentTypes[item.employmentType]):t('notSpecified')}</td>
          {canReadRates&&<td>{billing?<>
            {t(billing.kind==='lesson'?'lessonBasis':'monthlyBasis')}
            {billing.status!=='effective'&&' · '+t(billing.status==='undated'?'pendingDate':'scheduledBasis')}
          </>:'—'}</td>}
          <td><AdminStatus active={item.active}>{t(item.active?'active':'inactive')}</AdminStatus></td>
          <td>{canEdit
            ?<AdminRowAction id={actionId} aria-label={t('rowEdit')+' · '+name} aria-haspopup="dialog"
              onClick={()=>openRecord(item.id,actionId,href,true)}>{t('rowEdit')}</AdminRowAction>
            :<AdminRowAction id={actionId} aria-label={t('view')+' · '+name} href={href} onClick={event=>
              followWorkspaceLink(event,url=>openRecord(item.id,actionId,url))}>{t('view')}</AdminRowAction>}
          </td></tr>;
        })}
      </AdminListTable>
      <AdminListPagination lang={lang} page={currentPage} pageCount={pageCount} busy={listState==='loading'} onPageChange={setPage}/>
    </>}
    {adding&&<FacultyEditor id={null} lang={lang} isLight={isLight} canEdit={canEdit} canRates={canRates}
      onClose={()=>setAdding(false)} onDraftChange={onDraftChange} onCreated={id=>{
        setAdding(false);setJustCreated(id);onNavigate(recordHref(id));
      }}/>}
  </div>;
}

function FacultyEditor({id,lang,isLight,canEdit,canRates,onClose,onDraftChange,onCreated,back,created,openForEdit}:{
  id:string|null;lang:CrmLanguage;isLight:boolean;canEdit:boolean;canRates:boolean;onClose:()=>void;
  onDraftChange:(dirty:boolean)=>void;onCreated?:(id:string)=>void;back?:AdminBackTarget;created?:boolean;openForEdit?:boolean;
}){
  const t=(key:Word)=>facultyText(lang,words[key]),tabsId=useId(),contentId=useId();
  const heading=useRef<HTMLHeadingElement>(null);
  const nameInput=useRef<HTMLInputElement>(null);
  const photoInput=useRef<HTMLInputElement>(null);
  const cvInput=useRef<HTMLInputElement>(null);
  const [newId]=useState(()=>crypto.randomUUID()),teacherId=id??newId;
  const endpoint=facultyEndpoint+'/'+teacherId;
  const [details,setDetails]=useState<Details|null>(id?null:{
    profile:{id:teacherId,revision:0,category:'local',active:true,content:{},files:{}},rates:canRates?{revision:0,terms:[],source:''}:undefined});
  const [draft,setDraft]=useState<FacultyProfile|null>(details?.profile??null);
  const [files,setFiles]=useState<Partial<Record<FacultyFileKind,FacultyFileInput|null>>>({});
  const [terms,setTerms]=useState<RateDraft[]>([]);
  const [rateReason,setRateReason]=useState('');
  const nextKey=useRef(0);
  const [mode,setMode]=useState<Mode>('profile');
  const [editing,setEditing]=useState(()=>!id||Boolean(canEdit&&openForEdit));
  const directEdit=useRef(Boolean(canEdit&&openForEdit));
  const [editorLanguage,setEditorLanguage]=useState<CrmLanguage>(lang);
  const [selectedDetailLanguage,setDetailLanguage]=useState<CrmLanguage>();
  const [dirty,setDirty]=useState(false);
  const [discard,setDiscard]=useState(false);
  const [busy,setBusy]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [load,setLoad]=useState<'loading'|'ready'|'error'|'denied'>(id?'loading':'ready');
  const [feedback,setFeedback]=useState<'saved'|'invalid'|'conflict'|'unknown'|'fileInvalid'|'nameMissing'|null>(null);
  const [retry,setRetry]=useState(0);
  const guard=useRef(false);
  const unknown=feedback==='unknown';
  const blocked=busy||uploading||unknown;
  const profileExists=Boolean(details?.profile.revision);
  const updateDirty=(value:boolean)=>{setDirty(value);onDraftChange(value);};
  useEffect(()=>()=>onDraftChange(false),[onDraftChange]);
  useEffect(()=>{
    if(!id)return;
    const controller=new AbortController();
    get<Details>(endpoint,controller.signal).then(result=>{
      if(!controller.signal.aborted){setDetails(result);setDraft(result.profile);setLoad('ready');}
    }).catch(error=>{
      if(!controller.signal.aborted)setLoad(error.status===401||error.status===403?'denied':'error');
    });
    return ()=>controller.abort();
  },[id,endpoint,retry]);
  useLayoutEffect(()=>{
    if(id&&load==='ready'){
      window.scrollTo({top:0,behavior:'instant'});
      heading.current?.focus({preventScroll:true});
    }
  },[id,load]);

  function start(next:Mode){
    if(!details)return;
    setDraft(details.profile);setFiles({});setMode(next);setFeedback(null);
    const rateDrafts=(details.rates?.terms??[]).map((term,index)=>rateDraft(term,index));
    nextKey.current=rateDrafts.length;
    setTerms(rateDrafts);setRateReason('');setEditing(true);
  }
  function change(run:()=>void){
    updateDirty(true);setFeedback(null);run();
  }
  function close(){
    if(busy||uploading)return;
    if(dirty)setDiscard(true);
    else if(profileExists)closeEditor();
    else onClose();
  }
  function closeEditor(){
    setEditing(false);
    if(directEdit.current){
      directEdit.current=false;
      requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));
    }
  }
  function finish(next:Details){
    setDetails(next);setDraft(next.profile);setFiles({});
    updateDirty(false);closeEditor();setFeedback('saved');
    if(!id)onCreated?.(next.profile.id);
  }
  async function chooseFile(kind:FacultyFileKind,file?:File){
    if(!file)return;
    if(file.size>facultyFileLimits[kind]||!['image/jpeg','image/png',...(kind==='cv'?['application/pdf']:[])].includes(file.type)){
      setFeedback('fileInvalid');return;
    }
    setUploading(true);
    try{
      const payload=await filePayload(file);
      change(()=>setFiles(previous=>({...previous,[kind]:payload})));
    }catch{setFeedback('fileInvalid');}
    finally{setUploading(false);}
  }
  async function save(event:FormEvent){
    event.preventDefault();
    if(!draft||!dirty||blocked||guard.current||!details)return;
    let body:unknown;
    if(mode==='profile'){
      if(!facultyLanguages.some(lang=>draft.content[lang]?.name?.trim())){
        setFeedback('nameMissing');nameInput.current?.focus();return;
      }
      body={revision:draft.revision,category:draft.category,active:draft.active,employmentType:draft.employmentType??null,content:draft.content,files};
    }else{
      const normalized:FacultyTerm[]=[];
      for(const [index,{contractStart,monthsAfterStart,amount,kind,currency,note}] of terms.entries()){
        if(contractStart&&!facultyDateValid(contractStart)){
          setFeedback('invalid');
          event.currentTarget.querySelectorAll<HTMLButtonElement>('.admin-calendar-trigger')[index]?.focus();
          return;
        }
        const amountMinor=currency===null?null:facultyMinorAmount(amount,currency);
        if(!amountMinor&&(kind==='lesson'||amount!=='')){setFeedback('invalid');return;}
        normalized.push({contractStart,monthsAfterStart,amountMinor,kind,currency,note});
      }
      body={revision:details.rates?.revision??0,terms:normalized,reason:rateReason};
    }
    guard.current=true;setBusy(true);setFeedback(null);
    try{
      const response=await fetch(endpoint+(mode==='rates'?'/rates':''),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(response.ok){
        const saved=await response.json();
        finish(mode==='profile'?{...details,profile:saved}:{...details,rates:saved});return;
      }
      if(response.status===401||response.status===403){
        setDetails(null);setDraft(null);setLoad('denied');setEditing(false);updateDirty(false);return;
      }
      setFeedback(response.status===409?'conflict':response.status>=500?'unknown':'invalid');
    }catch{setFeedback('unknown');}
    finally{setBusy(false);guard.current=false;}
  }
  async function check(){
    setBusy(true);
    try{
      const result=await get<Details>(endpoint);
      const previous=mode==='profile'?details?.profile.revision:details?.rates?.revision;
      const current=mode==='profile'?result.profile.revision:result.rates?.revision;
      setFeedback(current===previous?'invalid':'conflict');
    }catch(error){if(error.status===404&&mode==='profile'&&!details?.profile.revision)setFeedback('invalid');}
    finally{setBusy(false);}
  }
  const languageLabels={zh:'中文',en:'English',id:'Bahasa Indonesia'};
  const tabs=facultyLanguages.map(code=>({id:code,label:languageLabels[code]}));
  const patchBio=(fields:FacultyBio)=>change(()=>setDraft(prev=>prev&&({...prev,
    content:{...prev.content,[editorLanguage]:{...prev.content[editorLanguage],...fields}}})));
  const patchRate=(key:number,patch:Partial<RateDraft>)=>change(()=>setTerms(prev=>prev.map(term=>term.key===key?{...term,...patch}:term)));
  function changeContractDate(term:RateDraft,contractStart:string){
    change(()=>setTerms(previous=>previous.map(row=>{
      const sameContract=term.contractGroup!==undefined&&row.contractGroup===term.contractGroup;
      return row.key===term.key||sameContract?{...row,contractStart}:row;
    })));
  }
  const profileName=details?facultyName(Object.fromEntries(facultyLanguages.map(code=>[code,details.profile.content[code]?.name])),lang):'';
  const readRates=details?.rates;
  const detailLanguage=selectedDetailLanguage??(details?.profile.category==='local'?'en':'zh');
  const shown=details?.profile.content[detailLanguage]??{};
  const shownTitle=facultyTitleLabel(facultyTitles(details?.profile.content),detailLanguage);
  const employmentType=details?.profile.employmentType;
  const availableLanguage=(['en','zh','id'] as const).find(code=>code!==detailLanguage&&hasProfileText(details?.profile.content[code]));
  const modeTabs=[{id:'profile',label:t('profile')},...(readRates?[{id:'rates',label:t('rates')}]:[])];
  const modeId=contentId+'detail',detailTabsId=tabsId+'detail';
  const languageId=contentId+'language',languageTabsId=tabsId+'language';
  const editorLanguageId=contentId+'editor-language',editorLanguageTabsId=tabsId+'editor-language';
  const canEditMode=load==='ready'&&(mode==='profile'?canEdit:canRates&&readRates);
  const rateTable=(terms:FacultyTerm[],label:string)=>terms.length?<AdminListTable label={label}
    headers={[t('contract'),t('effective'),t('phaseShort'),t('kind'),t('currency'),{label:t('amount'),numeric:true},t('rateNote')]}>
    {terms.map(term=><tr key={term.contractStart+':'+term.monthsAfterStart}>
      <td>{term.contractStart||'—'}</td><td>{term.contractStart?facultyEffectiveDate(term):t('pendingDate')}</td>
      <td>{term.monthsAfterStart}</td><td>{t(term.kind)}</td><td>{term.currency||t('unknownCurrency')}</td>
      <td className="crm-list-number">{term.amountMinor===null||term.currency===null?'—':facultyAmount(term.amountMinor,term.currency)}</td>
      <td className="whitespace-pre-wrap">{term.note}</td>
    </tr>)}
  </AdminListTable>:<AdminListState compact lang={lang} state="empty" message={t('noRates')}/>;
  const fact=(label:string,value:React.ReactNode,wide=false)=><div key={label} className={wide?'col-span-full':undefined}>
    <dt>{label}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd>
  </div>;
  const detailView=id&&<section className="crm-detail-root" data-record-scroll="page" data-theme={isLight?'light':'dark'}>
      <article className="crm-detail-panel">
        <AdminRecordHeader back={back}
          title={<CrmRecordTitle title={load==='ready'&&profileName?profileName:t('title')} titleRef={heading}
            status={load==='ready'&&details&&<AdminStatus active={details.profile.active}>{t(details.profile.active?'active':'inactive')}</AdminStatus>}
            meta={load==='ready'&&details&&facultyText(lang,facultyTeacherLabels[details.profile.category])}/>}
          actions={canEditMode&&<CrmDetailActions label={t('actions')} primary={<AdminPageAction icon={Pencil} variant="primary"
            label={t(mode==='profile'?'edit':'editRates')} aria-haspopup="dialog" onClick={()=>start(mode)}/>}/>}/>
        {load==='ready'&&readRates&&<AdminDetailTabs id={detailTabsId} contentId={modeId} value={mode} label={t('title')}
          tabs={modeTabs} onChange={value=>{setMode(value as Mode);setFeedback(null);}}/>}
        <div className="crm-detail-body" id={readRates?modeId:undefined} role={readRates?'tabpanel':undefined}
          aria-labelledby={readRates?detailTabsId+'-tab-'+mode:undefined}>
          {load!=='ready'||!details?<AdminListState lang={lang} state={load==='ready'?'error':load}
            onRetry={()=>{setLoad('loading');setRetry(value=>value+1);}}/>:<>
            {(feedback==='saved'||created)&&<AdminFormFeedback state="saved" lang={lang}>{t('saved')}</AdminFormFeedback>}
            {mode==='profile'?<div className="crm-customer-sections">
              <section className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">{t('basic')}</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-sm" htmlFor={languageId}>{t('version')}</label>
                    <AdminSingleSelect controlId={languageId} label={t('version')} lang={lang} isLight={isLight}
                      value={detailLanguage} options={tabs.map(tab=>({value:tab.id,label:tab.label}))}
                      onChange={value=>setDetailLanguage(value as CrmLanguage)}/>
                  </div>
                </div>
                {(shown.name?.trim()||shownTitle||employmentType)&&<dl className="crm-customer-facts">
                  {shown.name?.trim()&&fact(t('name'),shown.name)}
                  {shownTitle&&fact(facultyText(lang,facultyFields.professionalTitle),shownTitle)}
                  {employmentType&&fact(t('employmentType'),facultyText(lang,facultyEmploymentTypes[employmentType]))}
                </dl>}
                {!hasProfileText(shown)&&<>
                  <AdminListState compact lang={lang} state="empty" message={t('noneInLanguage')}/>
                  {availableLanguage&&<div><AdminRowAction onClick={()=>setDetailLanguage(availableLanguage)}>
                    {t('viewProfileLanguage')} · {languageLabels[availableLanguage]}
                  </AdminRowAction></div>}
                </>}
              </section>
                {profileGroups.map(group=>{
                  const fields=group.fields.filter(field=>shown[field]?.trim());
                  return fields.length>0&&<section key={group.title}>
                    <h2 className="mb-4 text-base font-semibold">{t(group.title)}</h2>
                    <dl className="crm-customer-facts">{fields.map(field=>
                      fact(facultyText(lang,facultyFields[field]),shown[field],fullWidthFacts.has(field)))}</dl>
                  </section>;
                })}
                {(shown.cv?.trim()||Object.keys(details.profile.files).length>0)&&<section>
                  <h2 className="mb-4 text-base font-semibold">{t('attachments')}</h2>
                  <dl className="crm-customer-facts">
                    {shown.cv?.trim()&&fact(facultyText(lang,facultyFields.cv),shown.cv,true)}
                    {(['photo','cv'] as const).map(kind=>{
                      const saved=details.profile.files[kind];
                      return saved&&fact(t(kind),<AdminRowAction href={endpoint+'/files/'+kind} target="_blank" rel="noreferrer">{saved.name}</AdminRowAction>);
                    })}
                  </dl>
                </section>}
              </div>:readRates&&<div className="crm-customer-sections">
              <section><h2 className="mb-4 text-base font-semibold">{t('rates')}</h2>
                {rateTable(readRates.terms,t('rates'))}
              </section>
              <section><h2 className="mb-4 text-base font-semibold">{t('rateHistory')}</h2>
                {readRates.history?.length?readRates.history.map(change=><AdminDisclosure key={change.revision} density="panel"
                  heading={<>{formatCrmOperatingTime(change.at,viewerTimeZone())} · {change.actor}{change.reason&&' · '+change.reason}</>}>
                  <div className="grid gap-3">
                    <h3 className="font-semibold">{t('priorRate')}</h3>{rateTable(change.before,t('priorRate'))}
                    <h3 className="font-semibold">{t('nextRate')}</h3>{rateTable(change.after,t('nextRate'))}
                  </div>
                </AdminDisclosure>):<AdminListState compact lang={lang} state="empty" message={t('noHistory')}/>}
              </section>
            </div>}
          </>}
        </div>
      </article>
    </section>;
  if(!editing||!draft)return <>{detailView}</>;

  const editorBio=draft.content[editorLanguage];
  const titleSuggestion=mode==='profile'?facultyTitleSuggestion(editorBio):undefined;
  const titleLabel=facultyText(lang,facultyFields.professionalTitle);
  const savedTitles=facultyTitles(details?.profile.content);
  const draftTitles=facultyTitles(draft.content);
  const titleValue=facultyTitleSelection(draftTitles);
  const legacyTitles=titleValue==='legacy'?draftTitles:facultyTitleSelection(savedTitles)==='legacy'?savedTitles:undefined;
  const titleOptions=[{value:'',label:t('noTitle')},...facultyTitleOptions(lang),
    ...(legacyTitles?[{value:'legacy',label:facultyTitleLabel(legacyTitles,lang)}]:[])];
  const setTitle=(value:string)=>change(()=>setDraft(previous=>previous&&({...previous,
    content:withFacultyTitles(previous.content,value==='legacy'&&legacyTitles?legacyTitles:facultyPresetTitles(value)),
  })));
  function splitTitle(suggestion:NonNullable<typeof titleSuggestion>){
    const choice=facultyTitleSelection({[editorLanguage]:suggestion.professionalTitle});
    change(()=>setDraft(previous=>{
      if(!previous)return previous;
      const titles=choice!=='legacy'&&(!titleValue||titleValue===choice)?facultyPresetTitles(choice):
        {...facultyTitles(previous.content),[editorLanguage]:suggestion.professionalTitle};
      const content=withFacultyTitles(previous.content,titles);
      content[editorLanguage]={...content[editorLanguage],name:suggestion.name};
      return {...previous,content};
    }));
    nameInput.current?.focus();
  }
  const editText=(field:keyof typeof facultyFields)=><AdminField key={field}>{facultyText(lang,facultyFields[field])}
    <textarea className="admin-text-input" rows={3} maxLength={20000} value={editorBio?.[field]??''} disabled={blocked}
      onChange={event=>patchBio({[field]:event.target.value})}/></AdminField>;
  return <>
    {detailView}
    <AdminEditor title={t(!profileExists?'add':mode==='profile'?'edit':'editRates')} description={profileName||undefined}
      lang={lang} light={isLight} variant="drawer" responsiveForm required={mode==='profile'||terms.some(term=>term.kind==='lesson')} busy={busy||uploading} onClose={close} onSubmit={save}
      footer={<>
        {busy&&<AdminFormFeedback className="basis-full" state="saving" lang={lang}>
          {unknown&&facultyText(lang,['正在查询保存结果…','Checking save result…','Memeriksa hasil simpan…'])}
        </AdminFormFeedback>}
        {!busy&&feedback&&feedback!=='saved'&&<AdminFormFeedback className="basis-full"
          state={feedback==='unknown'?'unknown':'error'} lang={lang}>{feedback==='unknown'?undefined:t(feedback)}</AdminFormFeedback>}
        <button type="button" onClick={close} disabled={busy||uploading}>{t('cancel')}</button>
        {unknown?<button type="button" data-primary="" onClick={()=>void check()} disabled={busy}>{t('reread')}</button>:
          <button type="submit" data-primary="" disabled={!dirty||blocked||feedback==='conflict'}>{t('save')}</button>}
      </>}>
      {mode==='profile'?<div data-admin-section-stack="open">
        <AdminFormSection title={t('basic')} variant="subgroup">
          <AdminFormGrid>
            <AdminField as="div" required><label>{t('category')}</label>
              <AdminSingleSelect label={t('category')} lang={lang} isLight={isLight} value={draft.category} disabled={blocked}
                options={(['local','foreign'] as const).map(value=>({value,label:facultyText(lang,facultyTeacherLabels[value])}))}
                onChange={value=>change(()=>setDraft({...draft,category:value as FacultyProfile['category']}))}/>
            </AdminField>
            <AdminField as="div"><label>{t('status')}</label>
              <AdminSingleSelect label={t('status')} lang={lang} isLight={isLight} disabled={blocked}
                value={draft.active?'active':'inactive'}
                options={(['active','inactive'] as const).map(value=>({value,label:t(value)}))}
                onChange={value=>change(()=>setDraft({...draft,active:value==='active'}))}/>
            </AdminField>
            <AdminField as="div"><label>{titleLabel}</label>
              <AdminSingleSelect label={titleLabel} lang={lang} isLight={isLight} value={titleValue}
                disabled={blocked} options={titleOptions} onChange={setTitle}/>
            </AdminField>
            <AdminField as="div"><label>{t('employmentType')}</label>
              <AdminSingleSelect label={t('employmentType')} lang={lang} isLight={isLight} value={draft.employmentType??''}
                disabled={blocked} options={[{value:'',label:t('notSpecified')},...employmentChoices(lang)]}
                onChange={value=>change(()=>setDraft(previous=>previous&&({...previous,
                  employmentType:value==='full-time'||value==='part-time'?value:undefined,
                })))}/>
            </AdminField>
          </AdminFormGrid>
        </AdminFormSection>
        <AdminFormSection title={t('profile')} description={t('nameHelp')} variant="subgroup">
          <AdminDetailTabs id={editorLanguageTabsId} contentId={editorLanguageId} value={editorLanguage} label={t('version')}
            disabled={blocked} tabs={tabs} onChange={value=>setEditorLanguage(value as CrmLanguage)}/>
          <div id={editorLanguageId} role="tabpanel" aria-labelledby={editorLanguageTabsId+'-tab-'+editorLanguage} data-admin-stack="">
            <AdminField as="div"><label>{t('name')}</label>
              <input className="admin-text-input" ref={nameInput} maxLength={120} value={editorBio?.name??''} disabled={blocked}
                onChange={event=>patchBio({name:event.target.value})}/>
            </AdminField>
            {titleSuggestion&&<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <AdminRowAction disabled={blocked} aria-describedby={editorLanguageId+'-title-preview'}
                onClick={()=>splitTitle(titleSuggestion)}>{t('separateTitle')}</AdminRowAction>
              <span id={editorLanguageId+'-title-preview'} className="text-sm text-[var(--admin-muted)]">
                {titleSuggestion.name} · {titleSuggestion.professionalTitle}
              </span>
            </div>}
            {profileGroups.map(group=><AdminDisclosure key={group.title} heading={t(group.title)} density="compact">
              <AdminFormGrid>{group.fields.map(editText)}</AdminFormGrid>
            </AdminDisclosure>)}
            <AdminDisclosure heading={facultyText(lang,facultyFields.cv)} density="compact">{editText('cv')}</AdminDisclosure>
          </div>
        </AdminFormSection>
        <AdminFormSection title={t('files')} description={t('fileHelp')} variant="subgroup">
          <AdminFormGrid>{(['photo','cv'] as const).map(kind=>{
            const staged=files[kind],saved=draft.files[kind],name=staged===null?'':staged?.name??saved?.name;
            const input=kind==='photo'?photoInput:cvInput;
            return <div key={kind} data-admin-stack="">
              <div className="flex flex-wrap items-center gap-2">
                <input ref={input} hidden type="file" aria-label={t(kind)}
                  accept={kind==='photo'?'image/jpeg,image/png':'image/jpeg,image/png,application/pdf'}
                  disabled={blocked} onChange={event=>{void chooseFile(kind,event.currentTarget.files?.[0]);event.currentTarget.value='';}}/>
                <AdminPageAction label={t(kind==='photo'?'choosePhoto':'chooseCv')} icon={Paperclip}
                  disabled={blocked} onClick={()=>input.current?.click()}/>
                {!name&&<span className="text-sm text-[var(--admin-muted)]">{t('noFile')}</span>}
              </div>
              {name&&<div className="flex flex-wrap items-center gap-2">
                {staged?<span className="break-all">{name}</span>:<AdminRowAction href={endpoint+'/files/'+kind} target="_blank" rel="noreferrer">{name}</AdminRowAction>}
                <AdminRowAction aria-label={t('remove')+' · '+t(kind)} disabled={blocked}
                  onClick={()=>change(()=>setFiles({...files,[kind]:null}))}>{t('remove')}</AdminRowAction>
              </div>}
            </div>;
          })}</AdminFormGrid>
        </AdminFormSection>
      </div>:<div data-admin-section-stack="open">
        {terms.map((term,index)=><AdminFormSection key={term.key} title={t('phase')+' '+(index+1)}
          description={facultyDateValid(term.contractStart)?t('effective')+' · '+facultyEffectiveDate(term):t('pendingDate')}
          variant="subgroup" actions={<AdminRowAction disabled={blocked}
            aria-label={t('removeRate')+' · '+t('phase')+' '+(index+1)}
            onClick={()=>change(()=>setTerms(terms.filter(row=>row.key!==term.key)))}>{t('removeRate')}</AdminRowAction>}>
          <AdminFormGrid>
            <AdminDateField label={t('contract')} lang={lang} value={term.contractStart} disabled={blocked}
              onChange={value=>changeContractDate(term,value)}/>
            <AdminField as="div"><label>{t('kind')}</label><AdminSingleSelect label={t('kind')} lang={lang} isLight={isLight} disabled={blocked}
              value={term.kind} options={(['lesson','monthly'] as const).map(value=>({value,label:t(value)}))}
              onChange={value=>patchRate(term.key,{kind:value as FacultyTerm['kind']})}/></AdminField>
            <AdminField as="div"><label>{t('currency')}</label><AdminSingleSelect label={t('currency')} lang={lang} isLight={isLight} disabled={blocked}
              value={term.currency??''} emptyLabel={t('unknownCurrency')} options={['IDR','CNY'].map(value=>({value,label:value}))}
              onChange={value=>patchRate(term.key,{currency:value as FacultyCurrency})}/></AdminField>
            <AdminField required={term.kind==='lesson'}>{t('amount')}<input className="admin-text-input" inputMode="decimal" maxLength={13} required={term.kind==='lesson'} disabled={blocked}
              value={term.amount} onChange={e=>patchRate(term.key,{amount:e.target.value})}/></AdminField>
            <AdminField data-admin-full-width="">{t('rateNote')}<textarea className="admin-text-input" maxLength={4000} disabled={blocked}
              value={term.note} onChange={e=>patchRate(term.key,{note:e.target.value})}/></AdminField>
          </AdminFormGrid>
        </AdminFormSection>)}
        <AdminFormSection title={t('rates')} variant="subgroup">
          {terms.length===0&&<p className="m-0 text-sm text-[var(--admin-muted)]">{t('noRates')}</p>}
          <AdminPageAction label={t('addRate')} icon={Plus} className="justify-self-start" disabled={blocked||terms.length>=120}
            onClick={()=>change(()=>setTerms([...terms,{key:nextKey.current++,contractStart:'',monthsAfterStart:0,kind:'lesson',
              currency:draft.category==='foreign'?'CNY':'IDR',amount:'',note:''}]))}/>
          <AdminField>{t('reason')}<input className="admin-text-input" value={rateReason} maxLength={500}
            disabled={blocked} onChange={event=>setRateReason(event.target.value)}/></AdminField>
        </AdminFormSection>
      </div>}
    </AdminEditor>
    {discard&&<AdminDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)} onDiscard={()=>{
      setDiscard(false);updateDirty(false);setFeedback(null);
      if(!profileExists){onClose();return;}
      closeEditor();setDraft(details?.profile??null);setFiles({});
      if(feedback==='conflict'||unknown){
        setLoad('loading');setRetry(value=>value+1);
      }
    }}/>}
  </>;
}
