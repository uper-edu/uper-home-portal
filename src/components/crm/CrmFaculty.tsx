import {useEffect,useId,useLayoutEffect,useRef,useState,type FormEvent,type MouseEvent} from 'react';
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
import {AdminSearchField} from '../admin/AdminSearchField';
import {AdminSingleSelect} from '../admin/AdminSingleSelect';
import {AdminTopicHeader} from '../admin/AdminTopicHeader';
import {CrmDetailActions,CrmRecordTitle} from './CrmRecordWorkspace';
import {EnrollmentSettingsListSummary,useEnrollmentSettingsFilters} from './EnrollmentSettingsListControls';
import type {CrmLanguage} from '../../utils/crmLanguage';
import {formatCrmOperatingTime,viewerTimeZone} from '../../utils/crmOperatingTime';
import {facultyAmount,facultyDateValid,facultyEffectiveDate,facultyEndpoint,facultyFields,facultyFileLimits,facultyLanguages,facultyMinorAmount,facultyName,
  facultyTeacherLabels,facultyText,type FacultyBio,type FacultyChoice,type FacultyCurrency,type FacultyFileInput,type FacultyFileKind,
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
  sort:['排序','Sort','Urutkan'],
  nameAsc:['姓名升序','Name ascending','Nama menaik'],
  nameDesc:['姓名降序','Name descending','Nama menurun'],
  refresh:['刷新','Refresh','Segarkan'],
  refreshFailed:['刷新失败，仍显示上次读取的档案。','Refresh failed. The previous results are still shown.','Penyegaran gagal. Hasil sebelumnya tetap ditampilkan.'],
  edit:['编辑档案','Edit profile','Edit profil'],
  name:['教师姓名','Teacher name','Nama pengajar'],
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
  kind:['计费方式','Pay basis','Dasar pembayaran'],
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
  nameHelp:['至少填写一种语言的教师姓名。原文按语言分别保存。','Enter the teacher name in at least one language. Each version is saved separately.','Isi nama pengajar dalam setidaknya satu bahasa. Setiap versi disimpan secara terpisah.'],
  version:['资料语言','Profile language','Bahasa profil'],
  fileInvalid:['请检查文件格式和大小。','Check the file type and size.','Periksa jenis dan ukuran berkas.'],
  reread:['核对保存结果','Check save result','Periksa hasil simpan'],
  basic:['基本信息','Basic information','Informasi dasar'],
  education:['教育与语言','Education and languages','Pendidikan dan bahasa'],
  experience:['职务与经历','Roles and experience','Jabatan dan pengalaman'],
  teaching:['研究与教学','Research and teaching','Riset dan pengajaran'],
  noneInLanguage:['当前语言暂无资料。','No profile information in this language.','Belum ada informasi profil dalam bahasa ini.'],
} as const;
type Word=keyof typeof words;
type Mode='profile'|'rates';
type Details={profile:FacultyProfile;rates?:FacultyRates};
type RateDraft=Omit<FacultyTerm,'amountMinor'>&{amount:string;key:number};
const profileGroups=[
  {title:'education',fields:['qualification','education','chineseProficiency','languages']},
  {title:'experience',fields:['positions','teachingExperience','chineseTeachingExperience','internationalExperience','leadershipExperience','practicalExperience']},
  {title:'teaching',fields:['researchAreas','academicAchievements','publications','teachingExpertise','strengths','teachingHighlights','teachingFeatures']},
] as const satisfies readonly {title:Word;fields:readonly (keyof typeof facultyFields)[]}[];
const fullWidthFacts=new Set<keyof typeof facultyFields>(['education','positions','publications']);
const defaultFilters={search:'',category:'',status:'',sort:'name-asc'};
const pageSize=25;

function followWorkspaceLink(event:MouseEvent<HTMLAnchorElement>,navigate:(href:string)=>void){
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.defaultPrevented)return;
  event.preventDefault();
  navigate(event.currentTarget.href);
}

function rateDraft(term:FacultyTerm,key:number):RateDraft{
  return {...term,key,amount:term.amountMinor===null||term.currency===null?'':facultyAmount(term.amountMinor,term.currency)};
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

export function CrmFaculty({lang,isLight,canEdit,canRates,onDraftChange,selectedId,listHref,recordHref,onNavigate}:{
  lang:CrmLanguage;isLight:boolean;canEdit:boolean;canRates:boolean;onDraftChange:(dirty:boolean)=>void;
  selectedId?:string;listHref:string;recordHref:(id:string)=>string;onNavigate:(href:string)=>void;
}){
  const t=(key:Word)=>facultyText(lang,words[key]);
  const [items,setItems]=useState<FacultyChoice[]>();
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
    get<FacultyChoice[]>(facultyEndpoint,abort.signal).then(rows=>{
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
  const filtered=(items??[]).filter(item=>(!filters.category||item.category===filters.category)&&
    (!filters.status||item.active===(filters.status==='active'))&&
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
  const filterSelect=(filter:'category'|'status',label:Word,all:Word,options:{value:string;label:string}[])=>
    <AdminSingleSelect lang={lang} isLight={isLight} label={t(label)} value={filters[filter]}
      onChange={value=>updateFilter({[filter]:value})} options={[{value:'',label:t(all)},...options]}/>;
  return <div className="crm-course-catalog">
    <AdminTopicHeader title={t('title')} subtitle={t('listHint')} isLight={isLight} headingRef={heading} actions={listState!=='denied'&&<>
      <AdminRefreshAction label={t('refresh')} loading={listState==='loading'} onClick={reload}/>
      {canEdit&&<AdminPageAction label={t('add')} icon={Plus} variant="primary" aria-haspopup="dialog" onClick={()=>setAdding(true)}/>}
    </>}/>
    {items&&<>
      <div className="crm-class-config-filters">
        <AdminSearchField label={t('search')} placeholder={t('search')} value={filters.search} onChange={value=>updateFilter({search:value})}/>
        {filterSelect('category','category','allCategories',(['local','foreign'] as const).map(value=>({value,label:facultyText(lang,facultyTeacherLabels[value])})))}
        {filterSelect('status','status','allStatuses',(['active','inactive'] as const).map(value=>({value,label:t(value)})))}
      </div>
      <EnrollmentSettingsListSummary lang={lang} count={filtered.length} total={items.length}
        filtered={Boolean(filters.search||filters.category||filters.status)} onClear={()=>{clear();setPage(1);}}>
        <AdminSingleSelect lang={lang} isLight={isLight} label={t('sort')} value={filters.sort} onChange={value=>updateFilter({sort:value})}
          options={[{value:'name-asc',label:t('nameAsc')},{value:'name-desc',label:t('nameDesc')}]}/>
      </EnrollmentSettingsListSummary>
    </>}
    {(listState==='error'||!items||listState==='ready'&&!rows.length)&&<AdminListState lang={lang}
      state={listState==='ready'?'empty':listState} message={listState==='error'&&items?t('refreshFailed'):undefined} onRetry={reload}/>}
    {!!rows.length&&<>
      <AdminListTable label={t('title')} viewportRef={table} busy={listState==='loading'}
        headers={[{label:t('name'),sort:filters.sort==='name-desc'?'descending':'ascending'},t('category'),t('status'),t('rowActions')]}>
        {rows.map(item=>{
          const href=recordHref(item.id),entryId='faculty-entry-'+item.id,actionId='faculty-action-'+item.id;
          const name=facultyName(item.names,lang);
          return <tr key={item.id}><th scope="row">
            <AdminRecordEntry id={entryId} href={href} onClick={event=>
              followWorkspaceLink(event,url=>openRecord(item.id,entryId,url))}>{name}</AdminRecordEntry>
          </th><td>{facultyText(lang,facultyTeacherLabels[item.category])}</td>
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
  const [locale,setLocale]=useState<CrmLanguage>(lang);
  const [dirty,setDirty]=useState(false);
  const [discard,setDiscard]=useState(false);
  const [busy,setBusy]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [load,setLoad]=useState<'loading'|'ready'|'error'|'denied'>(id?'loading':'ready');
  const [feedback,setFeedback]=useState<'saved'|'invalid'|'conflict'|'unknown'|'fileInvalid'|null>(null);
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
        setFeedback('invalid');nameInput.current?.focus();return;
      }
      body={revision:draft.revision,category:draft.category,active:draft.active,content:draft.content,files};
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
  const tabs=facultyLanguages.map(code=>({id:code,label:{zh:'中文',en:'English',id:'Bahasa Indonesia'}[code]}));
  const patchBio=(field:keyof FacultyBio,value:string)=>change(()=>setDraft(prev=>prev&&({...prev,
    content:{...prev.content,[locale]:{...prev.content[locale],[field]:value}}})));
  const patchRate=(key:number,patch:Partial<RateDraft>)=>change(()=>setTerms(prev=>prev.map(term=>term.key===key?{...term,...patch}:term)));
  const profileName=details?facultyName(Object.fromEntries(facultyLanguages.map(code=>[code,details.profile.content[code]?.name])),lang):'';
  const readRates=details?.rates;
  const shown=details?.profile.content[locale]??{};
  const modeTabs=[{id:'profile',label:t('profile')},...(readRates?[{id:'rates',label:t('rates')}]:[])];
  const modeId=contentId+'detail',detailTabsId=tabsId+'detail';
  const languageId=contentId+'language',languageTabsId=tabsId+'language';
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
                      value={locale} options={tabs.map(tab=>({value:tab.id,label:tab.label}))}
                      onChange={value=>setLocale(value as CrmLanguage)}/>
                  </div>
                </div>
                {shown.name?.trim()&&<dl className="crm-customer-facts">{fact(t('name'),shown.name)}</dl>}
                {!Object.values(shown).some(value=>value?.trim())&&<AdminListState compact lang={lang} state="empty" message={t('noneInLanguage')}/>}
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

  const editText=(field:keyof typeof facultyFields)=><AdminField key={field}>{facultyText(lang,facultyFields[field])}
    <textarea className="admin-text-input" rows={3} maxLength={20000} value={draft.content[locale]?.[field]??''} disabled={blocked}
      onChange={event=>patchBio(field,event.target.value)}/></AdminField>;
  return <>
    {detailView}
    <AdminEditor title={t(!profileExists?'add':mode==='profile'?'edit':'editRates')} description={profileName||undefined}
      lang={lang} light={isLight} variant="drawer" responsiveForm required busy={busy||uploading} onClose={close} onSubmit={save}
      footer={<>
        <button type="button" onClick={close} disabled={busy||uploading}>{t('cancel')}</button>
        {unknown?<button type="button" onClick={()=>void check()} disabled={busy}>{t('reread')}</button>:
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
          </AdminFormGrid>
        </AdminFormSection>
        <AdminFormSection title={t('profile')} variant="subgroup">
          <AdminDetailTabs id={languageTabsId} contentId={languageId} value={locale} label={t('version')}
            tabs={tabs} onChange={value=>setLocale(value as CrmLanguage)}/>
          <div id={languageId} role="tabpanel" aria-labelledby={languageTabsId+'-tab-'+locale} data-admin-stack="">
            <AdminField as="div"><label>{t('name')}</label>
              <input className="admin-text-input" ref={nameInput} maxLength={120} value={draft.content[locale]?.name??''} disabled={blocked}
                aria-describedby={languageId+'-name-help'}
                onChange={event=>patchBio('name',event.target.value)}/>
              <small id={languageId+'-name-help'}>{t('nameHelp')}</small>
            </AdminField>
            {profileGroups.map(group=><AdminDisclosure key={group.title} heading={t(group.title)} density="panel">
              <AdminFormGrid>{group.fields.map(editText)}</AdminFormGrid>
            </AdminDisclosure>)}
            <AdminDisclosure heading={facultyText(lang,facultyFields.cv)} density="panel">{editText('cv')}</AdminDisclosure>
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
        {terms.map(term=><AdminFormSection key={term.key} title={t('effective')+' · '+(facultyDateValid(term.contractStart)
          ?facultyEffectiveDate(term):t('pendingDate'))}
          variant="subgroup" actions={<AdminRowAction disabled={blocked}
            onClick={()=>change(()=>setTerms(terms.filter(row=>row.key!==term.key)))}>{t('removeRate')}</AdminRowAction>}>
          <AdminFormGrid>
            <AdminDateField label={t('contract')} lang={lang} value={term.contractStart} disabled={blocked}
              onChange={value=>change(()=>setTerms(previous=>previous.map(row=>
                row.contractStart===term.contractStart?{...row,contractStart:value}:row)))}/>
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
        <div className="mt-4"><AdminPageAction label={t('addRate')} icon={Plus} disabled={blocked||terms.length>=120}
          onClick={()=>change(()=>setTerms([...terms,{key:nextKey.current++,contractStart:'',monthsAfterStart:0,kind:'lesson',
            currency:draft.category==='foreign'?'CNY':'IDR',amount:'',note:''}]))}/></div>
        <div className="mt-4"><AdminField>{t('reason')}<input className="admin-text-input" value={rateReason} maxLength={500}
          disabled={blocked} onChange={event=>setRateReason(event.target.value)}/></AdminField></div>
      </div>}
      {busy&&<AdminFormFeedback state="saving" lang={lang}/>}
      {feedback&&feedback!=='saved'&&<AdminFormFeedback state={feedback==='unknown'?'unknown':'error'} lang={lang}>
        {feedback==='unknown'?undefined:t(feedback)}
      </AdminFormFeedback>}
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
