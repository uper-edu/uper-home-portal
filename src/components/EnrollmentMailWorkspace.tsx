import {useCallback,useEffect,useId,useLayoutEffect,useRef,useState,type MouseEvent} from 'react';
import {ArrowDown,ArrowRightLeft,ArrowUp,ClipboardCheck,Pencil,Plus,Save} from 'lucide-react';
import {AdminRecordEntry,AdminRowAction} from './admin/AdminListControl';
import {AdminListPagination,AdminListState,AdminListTable} from './admin/AdminList';
import {AdminSearchField} from './admin/AdminSearchField';
import {AdminEditor} from './admin/AdminEditor';
import {AdminDisclosure} from './admin/AdminDisclosure';
import {AdminField} from './AdminForm';
import {AdminFormActions,AdminFormGrid,AdminFormSection,AdminFormFeedback} from './AdminFormLayout';
import {AdminRefreshAction} from './admin/AdminRefreshAction';
import {AdminRecordHeader} from './admin/AdminRecordHeader';
import {AdminDetailActions,AdminRecordTitle} from './admin/AdminRecordWorkspace';
import {CrmPageAction} from './crm/CrmPageAction';
import {CrmPageIdentity} from './crm/CrmPageIdentity';
import {CrmContentNav,CrmDiscardDialog} from './crm/CrmDetailWorkspace';
import {CrmSingleSelect} from './crm/CrmSingleSelect';
import {AdminStatus} from './AdminStatus';
import {formatCrmEventTime} from '../utils/crmOperatingTime';
import {enrollmentMailDefaults,enrollmentMailPoolLimit,mailAccountDefaults,mailPoolDailyLimitMax,mailPoolDefaults,mailPoolMembers,mailSmtpHostPattern,type EnrollmentMailConfig,type MailAccount,type MailPool} from '../utils/enrollmentMailConfig';
import {contactEmailText,validContactEmail} from '../utils/contactEmail';
import type {CrmLanguage} from '../utils/crmLanguage';
import './enrollment-mail-workspace.css';

type Usage={daily:number;external:number;monthly:number};
type MailEditorTarget='new-pool'|'reassign'|number|{pool:MailPool};
type AdminView={config:EnrollmentMailConfig;revision:number;environment:string;mode:string;timezone:string;
  usage:Record<string,Usage>;poolUsage:Record<string,number>;configured:{address:string;configured:boolean}[]};
type MailEditorDraft=EnrollmentMailConfig & Partial<Pick<MailPool,'dailyLimit'|'strategy'>>;
type BusinessView={revision:number;selectedPool:string;sticky:boolean;pools:Pick<MailPool,'id'|'name'|'enabled'>[];name:string;enabled:boolean;mode:string;rows:{id:string;subject:string;sender:string;routeReason?:string;state:string;recordedAt:string}[]};
const adminPath='/api/admin/enrollment-mail';
const accountListHref='/system?tab=mail';
const poolListHref='/system?tab=mail&mailView=pool';
const noop=()=>{};
const historyPageSize=20;
const deliveryTones={queued:'info',accepted:'success',failed:'danger',unknown:'warning',simulated:'neutral'} as const;
const stateWords:Record<string,[string,string,string]>={
  simulated:['已模拟','Simulated','Disimulasikan'],accepted:['SMTP 已接收','SMTP accepted','Diterima SMTP'],
  failed:['发送失败','Failed','Gagal'],unknown:['结果待核对','Outcome unknown','Hasil belum pasti'],
  queued:['待发送／等待额度','Queued / waiting for quota','Dalam antrean / menunggu kuota'],
  paused:['发信池暂停','Pool paused','Pool dijeda'],recipient_blocked:['收件人超出测试范围','Recipient outside test scope','Penerima di luar cakupan uji'],
  shared_window:['共享频率已满','Shared rate reached','Batas frekuensi tercapai'],binding_pending:['首次路由待确认','Initial routing pending','Perutean awal tertunda'],
  pool_daily_limit:['发信池日额度已满','Pool daily limit reached','Batas harian pool tercapai'],
  bound_account:['固定发件账号','Fixed sender','Pengirim tetap'],no_capacity:['无账号可用额度','No account quota available','Kuota akun tidak tersedia'],
  balanced:['按可用额度选号','Selected by available quota','Dipilih menurut kuota'],existing:['沿用原记录','Existing result','Hasil sebelumnya'],
  priority:['按账号优先级选号','Selected by account priority','Dipilih menurut prioritas akun'],
  disabled:['未启用','Disabled','Nonaktif'],simulation:['模拟 SMTP','Simulated SMTP','SMTP simulasi'],smtp:['正式 SMTP','Live SMTP','SMTP aktif'],
};

export function EnrollmentMailWorkspace({lang,isLight,admin,allowed=true,view='accounts',recordId='',returnPoolId='',onNavigate=noop,onDraft=noop,onBusy=noop}:{
  lang:CrmLanguage;isLight:boolean;admin?:boolean;allowed?:boolean;
  view?:'accounts'|'pool';recordId?:string;returnPoolId?:string;onNavigate?:(href:string)=>void;
  onDraft?:(dirty:boolean)=>void;onBusy?:(busy:boolean)=>void;
}){
  const t=(zh:string,en:string,id:string)=>lang==='zh'?zh:lang==='id'?id:en;
  const stickyHelpId=useId();
  const memberOrderId=useId();
  const [result,setResult]=useState<AdminView|BusinessView>();
  const [loading,setLoading]=useState(false),[failure,setFailure]=useState<'error'|'denied'>();
  const [draft,setDraft]=useState<MailEditorDraft>(),[account,setAccount]=useState<MailAccount>();
  const [portInput,setPortInput]=useState('');
  const validPort=portInput==='465'||portInput==='587';
  const [editing,setEditing]=useState<MailEditorTarget>(),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false);
  const isPoolEditor=editing==='new-pool'||typeof editing==='object';
  const validPoolLimit=draft?.dailyLimit==null||
    Number.isInteger(draft.dailyLimit)&&draft.dailyLimit>=1&&draft.dailyLimit<=mailPoolDailyLimitMax;
  const [discard,setDiscard]=useState(false),[feedback,setFeedback]=useState<'saved'|'error'|'unknown'>();
  const [password,setPassword]=useState(''),[clearPassword,setClearPassword]=useState(false);
  const [credentialKeyError,setCredentialKeyError]=useState(false);
  const [pendingOperation,setPendingOperation]=useState<string>(),[operationCheck,setOperationCheck]=useState<'unconfirmed'|'error'>();
  const [adminConflict,setAdminConflict]=useState(false);
  const [revision,setRevision]=useState(0);
  const [settingsDraft,setSettingsDraft]=useState<{pool:string;sticky:boolean;revision:number}>();
  const [historySearch,setHistorySearch]=useState(''),[historyStatus,setHistoryStatus]=useState(''),[historyPage,setHistoryPage]=useState(1);
  const [replacement,setReplacement]=useState({recipient:'',account:'',reason:''});
  const listPosition=useRef<{id:string;view:typeof view;top:number}>(null);
  const detailTitle=useRef<HTMLHeadingElement>(null);
  const recordLinks=useRef(new Map<string,HTMLAnchorElement>());
  const memberLinks=useRef(new Map<string,HTMLAnchorElement>());
  const poolPosition=useRef<{id:string;address:string;top:number}>(null);
  const refresh=useCallback(async()=>{
    if(!allowed)return;
    setLoading(true);setFailure(undefined);
    try{
      const response=await fetch(admin?adminPath:'/api/crm/enrollment/mail',{cache:'no-store'});
      if(response.status===403||response.status===401){
        setFailure('denied');setResult(undefined);return;
      }
      if(!response.ok)throw Error();
      const next:AdminView|BusinessView=await response.json();
      setResult(next);
      return next;
    }catch{setFailure('error');}
    finally{setLoading(false);}
  },[admin,allowed]);
  useEffect(()=>{void refresh();},[refresh]);

  useEffect(()=>{onBusy(busy);return()=>onBusy(false);},[busy,onBusy]);
  const config=result&&'config' in result?result.config:undefined;
  const poolView=view==='pool';
  const isDetail=!!admin&&!!recordId;
  const detailPool=isDetail&&poolView?config?.pools?.find(pool=>pool.id===recordId):undefined;
  const accountIndex=isDetail&&!poolView?config?.accounts.findIndex(account=>account.address===recordId)??-1:-1;
  const detailAccount=config?.accounts[accountIndex];
  const recordName=detailPool?.name??detailAccount?.address;
  const listHref=poolView?poolListHref:accountListHref;
  const fromPool=!poolView&&/^[a-z0-9-]{1,40}$/.test(returnPoolId)?returnPoolId:'';
  const hasConfig=!!config;
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>{
      if(isDetail){
        if(poolView&&hasConfig&&poolPosition.current?.id===recordId){
          const {top,address}=poolPosition.current;
          window.scrollTo(0,top);
          (memberLinks.current.get(address)??detailTitle.current)?.focus({preventScroll:true});
          poolPosition.current=null;
        }else{
          window.scrollTo(0,0);
          detailTitle.current?.focus({preventScroll:true});
        }
      }else if(hasConfig&&listPosition.current?.view===view){
        const {id,top}=listPosition.current;
        window.scrollTo(0,top);
        recordLinks.current.get(id)?.focus({preventScroll:true});
        listPosition.current=null;
      }
    });
    return()=>cancelAnimationFrame(frame);
  },[isDetail,poolView,view,recordId,hasConfig]);
  const recordEntry=(id:string)=>{
    const href=listHref+(poolView?'&mailPool=':'&mailAccount=')+encodeURIComponent(id);
    return {href,ref:(element:HTMLAnchorElement|null)=>{
      if(element)recordLinks.current.set(id,element);else recordLinks.current.delete(id);
    },onClick:(event:MouseEvent<HTMLAnchorElement>)=>{
      if(event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
      event.preventDefault();
      listPosition.current={id,view,top:window.scrollY};
      onNavigate(href);
    }};
  };
  const activeView=result&&'config' in result?result:undefined;
  const business=result&&'rows' in result?result:undefined;
  const settings=business&&(settingsDraft??{pool:business.selectedPool,sticky:business.sticky,revision:business.revision});
  const choiceDirty=!!business&&!!settings&&(settings.pool!==business.selectedPool||settings.sticky!==business.sticky);
  const settingsConflict=choiceDirty&&settings?.revision!==business?.revision;
  useEffect(()=>{onDraft(dirty||choiceDirty||!admin&&busy);return()=>onDraft(false);},[admin,busy,dirty,choiceDirty,onDraft]);
  const changeSettings=(patch:Partial<{pool:string;sticky:boolean}>)=>{
    if(!settings||!business)return;
    const next={...settings,...patch};
    setSettingsDraft(next.pool===business.selectedPool&&next.sticky===business.sticky?undefined:next);
    if(feedback!=='unknown')setFeedback(undefined);
  };
  const saveChoice=async()=>{
    if(!settings||!choiceDirty||settingsConflict||busy||loading||feedback==='unknown')return;
    setBusy(true);setFeedback(undefined);
    try{
      const response=await fetch('/api/crm/enrollment/mail/pool',{method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(settings)});
      if(!response.ok){
        setFeedback(response.status>=500?'unknown':'error');
        if(response.status===409)await refresh();
        return;
      }
      const next=await refresh();
      if(next&&'rows' in next&&next.selectedPool===settings.pool&&next.sticky===settings.sticky){
        setSettingsDraft(undefined);setFeedback('saved');
      }else setFeedback('unknown');
    }catch{setFeedback('unknown');}
    finally{setBusy(false);}
  };
  const checkSettings=async()=>{
    if(!settingsDraft||loading)return;
    const next=await refresh();
    if(next&&'rows' in next&&next.selectedPool===settingsDraft.pool&&next.sticky===settingsDraft.sticky){
      setSettingsDraft(undefined);setFeedback('saved');
    }
  };
  const close=useCallback(()=>{
    setPassword('');setClearPassword(false);setCredentialKeyError(false);
    setEditing(undefined);setDraft(undefined);setAccount(undefined);setFeedback(undefined);setDirty(false);setDiscard(false);
    setPendingOperation(undefined);setOperationCheck(undefined);setAdminConflict(false);
  },[]);
  useLayoutEffect(()=>{if(admin)close();},[admin,view,recordId,close]);
  useLayoutEffect(()=>{if(admin&&(!allowed||failure==='denied'))close();},[admin,allowed,failure,close]);
  const edit=(target:MailEditorTarget,current=activeView)=>{
    if(!current)return;
    setPassword('');setClearPassword(false);setCredentialKeyError(false);
    setRevision(current.revision);setFeedback(undefined);setDirty(false);setEditing(target);
    setAdminConflict(false);setPendingOperation(undefined);setOperationCheck(undefined);
    const fields=typeof target==='object'?target.pool:target==='new-pool'?
      {...enrollmentMailDefaults,...mailPoolDefaults,name:'',members:[],accounts:current.config.accounts}:undefined;
    setDraft({...current.config,...fields});
    setReplacement({recipient:'',account:'',reason:''});
    setPortInput(typeof target==='number'?String((current.config.accounts[target]??mailAccountDefaults).port):'');
    setAccount(typeof target==='number'?{...(current.config.accounts[target]??mailAccountDefaults)}:undefined);
  };
  const validMonthly=account?.monthly==null||
    Number.isInteger(account.monthly)&&account.monthly>=1&&account.monthly<=10000000;
  const validAccountEmail=validContactEmail(account?.address);
  const duplicateAccount=!!account&&typeof editing==='number'&&!!draft?.accounts.some((item,index)=>
    index!==editing&&item.address===account.address.trim().toLowerCase());
  const validRecipient=validContactEmail(replacement.recipient);
  const reloadEditor=async()=>{
    if(busy||editing===undefined||editing==='reassign')return;
    setBusy(true);
    try{
      const latest=await refresh();
      if(!latest||!('config' in latest))return;
      if(typeof editing==='object'){
        const pool=latest.config.pools?.find(item=>item.id===editing.pool.id);
        if(pool)edit({pool},latest);else close();
      }else if(typeof editing==='number'){
        const original=draft?.accounts[editing];
        const index=original?latest.config.accounts.findIndex(item=>item.address===original.address):latest.config.accounts.length;
        if(index>=0)edit(index,latest);else close();
      }else edit(editing,latest);
    }finally{setBusy(false);}
  };
  const checkAdminResult=async()=>{
    if(busy||!pendingOperation)return;
    setBusy(true);setOperationCheck(undefined);
    try{
      const response=await fetch(adminPath+'/results/'+encodeURIComponent(pendingOperation),{cache:'no-store'});
      if(!response.ok)throw Error();
      if((await response.json()).state==='committed'){
        close();setFeedback('saved');await refresh();
      }else setOperationCheck('unconfirmed');
    }catch{setOperationCheck('error');}
    finally{setBusy(false);}
  };
  const save=async()=>{
    if(!draft||busy||pendingOperation||adminConflict||isPoolEditor&&!validPoolLimit||
      typeof editing==='number'&&(!validPort||!validMonthly||!validAccountEmail||duplicateAccount)||
      editing==='reassign'&&(!validRecipient||!replacement.account||!replacement.reason.trim()))return;
    const {dailyLimit,strategy,...base}=draft;
    const next={...base,accounts:[...base.accounts],members:mailPoolMembers(base)};
    if(typeof editing==='number'&&account)next.accounts[editing]={...account,port:portInput==='587'?587:465};
    if(isPoolEditor){
      const pool:MailPool={id:typeof editing==='object'?editing.pool.id:crypto.randomUUID(),
        transport:'smtp',name:draft.name.trim(),enabled:draft.enabled,members:mailPoolMembers(draft),
        dailyLimit:dailyLimit??null,strategy:strategy??'balanced'};
      const pools=draft.pools??[];
      next.pools=editing==='new-pool'?[...pools,pool]:pools.map(existing=>existing.id===pool.id?pool:existing);
    }
    const credential=typeof editing==='number'&&account&&(clearPassword||password!=='')?
      {address:account.address.trim().toLowerCase(),password:clearPassword?null:password}:undefined;
    const requestId=crypto.randomUUID();
    setBusy(true);setFeedback(undefined);setCredentialKeyError(false);
    try{
      const response=await fetch(editing==='reassign'?adminPath+'/reassign':adminPath,{
        method:editing==='reassign'?'POST':'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(editing==='reassign'?{...replacement,requestId}:{config:next,revision,requestId,credential})});
      if(response.status>=500)throw Error();
      if(!response.ok){
        const problem=await response.json().catch(()=>null);
        if(problem?.error==='enrollment_mail_credential_key_missing')setCredentialKeyError(true);
        if(response.status===409&&problem?.error==='enrollment_mail_conflict'){
          setAdminConflict(true);
          await refresh();
        }
        setFeedback('error');return;
      }
      close();setFeedback('saved');await refresh();
    }catch{setPendingOperation(requestId);setFeedback('unknown');}
    finally{setBusy(false);}
  };
  const heading=admin?t('邮件配置','Email configuration','Konfigurasi email'):t('招生邮件','Admissions email','Email penerimaan');
  const word=(state:string)=>stateWords[state]?t(...stateWords[state]):state;
  const historyTitle=t('招生邮件发送记录','Admissions email delivery history','Riwayat pengiriman email penerimaan');
  const searchTerm=historySearch.trim().toLowerCase();
  const filteredHistory=business?.rows.filter(row=>(!historyStatus||row.state===historyStatus)&&
    (!searchTerm||[row.subject,row.sender].some(value=>value?.toLowerCase().includes(searchTerm))))??[];
  const historyPageCount=Math.ceil(filteredHistory.length/historyPageSize);
  const currentHistoryPage=Math.min(historyPage,Math.max(1,historyPageCount));
  const visibleHistory=filteredHistory.slice((currentHistoryPage-1)*historyPageSize,currentHistoryPage*historyPageSize);
  const inputNumber=(label:string,value:number,onChange:(n:number)=>void,max?:number)=> <AdminField required>{label}
    <input type="number" min="1" max={max} required value={value||''} onChange={e=>onChange(Number(e.target.value))}/></AdminField>;
  const changeAccount=(patch:Partial<MailAccount>)=>{setAccount(a=>a&&{...a,...patch});setDirty(true);};
  const changePool=(patch:Partial<MailEditorDraft>)=>{setDraft(d=>d&&{...d,...patch});setDirty(true);};
  const orderedMembers=draft?mailPoolMembers(draft):[];
  const memberActionId=(address:string,offset:number)=>memberOrderId+'-'+encodeURIComponent(address)+'-'+offset;
  const moveMember=(index:number,offset:number)=>{
    const members=[...orderedMembers];
    const address=members[index];
    const target=index+offset;
    [members[index],members[target]]=[members[target],members[index]];
    changePool({members});
    requestAnimationFrame(()=>{
      const sameAction=document.getElementById(memberActionId(address,offset)) as HTMLButtonElement|null;
      (sameAction?.disabled?document.getElementById(memberActionId(address,-offset)):sameAction)?.focus({preventScroll:true});
    });
  };
  const changeReplacement=(patch:Partial<typeof replacement>)=>{setReplacement(value=>({...value,...patch}));setDirty(true);};
  const members=config?mailPoolMembers(config):[];
  const canReplace=!!config&&config.accounts.some(a=>!a.enabled||!members.includes(a.address))&&
    config.accounts.some(a=>a.enabled&&members.includes(a.address));

  const smtpPortLabel=t('SMTP 端口','SMTP port','Port SMTP');
  const smtpHostLabel=t('SMTP 主机','SMTP host','Host SMTP');
  const quotaLabel=t('账号额度','Account quotas','Kuota akun');
  const dailyLabel=t('每日封数','Messages per day','Pesan per hari');
  const externalLabel=t('每日外部收件人数','Unique external recipients per day','Penerima eksternal unik per hari');
  const monthlyLabel=t('每月封数上限','Monthly message limit','Batas pesan bulanan');
  const rateLabel=t('窗口封数','Messages per window','Pesan per jendela');
  const windowLabel=t('窗口秒数','Window in seconds','Jendela dalam detik');
  const credentialStatus=(address:string)=>activeView?.configured.some(c=>c.address===address&&c.configured)?
    t('已配置','Configured','Dikonfigurasi'):t('未配置','Missing','Belum diatur');
  const accountStatus=(account:MailAccount)=><AdminStatus active={account.enabled}>
    {account.enabled?t('启用','Enabled','Aktif'):t('停用','Disabled','Nonaktif')}
  </AdminStatus>;
  const cancel=t('取消','Cancel','Batal');
  const addPoolLabel=t('新增发信池','Add sending pool','Tambah pool pengiriman');
  const poolLimitLabel=t('每日发信上限','Daily sending limit','Batas pengiriman harian');
  const poolUsageLabel=t('今日占用','Used today','Terpakai hari ini');
  const strategyLabel=t('发件账号选择策略','Sender selection strategy','Strategi pemilihan pengirim');
  const priorityLabel=t('优先级','Priority','Prioritas');
  const poolMembersLabel=t('池内账号','Pool members','Anggota pool');
  const senderLabel=t('发件邮箱','Sender address','Alamat pengirim');
  const statusLabel=t('状态','Status','Status');
  const credentialLabel=t('凭证','Credential','Kredensial');
  const strategyOptions=[
    {value:'balanced',label:t('按额度均衡','Balance by quota','Seimbangkan menurut kuota')},
    {value:'priority',label:t('按优先级使用','Use priority order','Gunakan urutan prioritas')},
  ] as const;
  const strategyName=(strategy:MailPool['strategy'])=>strategyOptions.find(option=>option.value===strategy)?.label;
  const poolLimit=(pool:MailPool)=>pool.dailyLimit??t('不限','Unlimited','Tanpa batas');
  const savedAccount=adminConflict&&typeof editing==='number'&&draft?.accounts[editing]?
    config?.accounts.find(item=>item.address===draft.accounts[editing].address):undefined;
  const savedPool=adminConflict&&typeof editing==='object'?config?.pools?.find(item=>item.id===editing.pool.id):undefined;
  const savedComparison=savedAccount?[
    [statusLabel,accountStatus(savedAccount)],[smtpHostLabel,savedAccount.host],[smtpPortLabel,savedAccount.port],
    [credentialLabel,credentialStatus(savedAccount.address)],
    [dailyLabel,savedAccount.daily],[externalLabel,savedAccount.external],[monthlyLabel,savedAccount.monthly??'—'],
    [rateLabel,savedAccount.rate],[windowLabel,savedAccount.windowSeconds],
  ]:savedPool?[
    [t('发信池名称','Pool name','Nama pool'),savedPool.name],
    [statusLabel,savedPool.enabled?t('已启用','Enabled','Aktif'):word('disabled')],
    [strategyLabel,strategyName(savedPool.strategy)],[poolLimitLabel,poolLimit(savedPool)],
    [poolMembersLabel,savedPool.members.join(', ')||'—'],
  ]:undefined;
  return <section className="enrollment-mail-workspace" aria-label={heading}>
    {admin&&!isDetail&&<header className="admin-page-toolbar" data-theme={isLight?'light':'dark'}>
      <CrmPageIdentity title={heading} subtitle={t('管理当前环境的招生发信池、账号和限额。','Manage the admissions pool, accounts and quotas in this environment.','Kelola pool, akun, dan kuota penerimaan di lingkungan ini.')}/>
      {allowed&&failure!=='denied'&&<div className="admin-page-actions">
        <AdminRefreshAction label={t('刷新','Refresh','Segarkan')} loading={loading} onClick={()=>void refresh()}/>
        {config&&view==='accounts'&&<CrmPageAction icon={Plus} variant="primary" label={t('新增账号','Add account','Tambah akun')} onClick={()=>edit(config.accounts.length)}/>}
        {config?.pools&&view==='pool'&&<CrmPageAction icon={Plus} variant="primary" label={addPoolLabel}
          disabled={config.pools.length>=enrollmentMailPoolLimit}
          title={config.pools.length>=enrollmentMailPoolLimit?t(`最多可配置 ${enrollmentMailPoolLimit} 个发信池`,
            `Up to ${enrollmentMailPoolLimit} sending pools are allowed`,`Maksimal ${enrollmentMailPoolLimit} pool pengiriman`):undefined}
          onClick={()=>edit('new-pool')}/>}
      </div>}
    </header>}
    {!admin&&<header className="admin-edit-header" data-theme={isLight?'light':'dark'}>
      <div className="admin-edit-title"><h2>{heading}</h2></div>
      <AdminFormActions className="admin-edit-actions">
        {feedback==='unknown'&&<CrmPageAction icon={ClipboardCheck} label={t('核对保存结果','Check save result','Periksa hasil penyimpanan')}
          disabled={loading||busy} onClick={()=>void checkSettings()}/>}
        <AdminRefreshAction label={t('刷新','Refresh','Segarkan')} loading={loading} disabled={busy} onClick={()=>void refresh()}/>
        {settings&&<CrmPageAction icon={Save} variant="primary" keepFocusWhileLoading loading={busy}
          label={busy?t('正在保存…','Saving…','Menyimpan…'):t('保存发信设置','Save email settings','Simpan pengaturan email')}
          disabled={!choiceDirty||settingsConflict||loading&&!busy||feedback==='unknown'} onClick={()=>void saveChoice()}/>}
      </AdminFormActions>
    </header>}
    {admin&&!isDetail&&allowed&&failure!=='denied'&&<CrmContentNav label={heading} items={[
      {href:accountListHref,label:t('发件账号','Sending accounts','Akun pengirim'),current:view==='accounts'},
      {href:poolListHref,label:t('发信池','Sending pool','Pool pengiriman'),current:view==='pool'},
    ]} onNavigate={onNavigate}/>}
    {feedback==='saved'&&editing===undefined&&<AdminFormFeedback state="saved" lang={lang} placement="floating"/>}
    {!isDetail&&(!allowed||!result||failure)&&<AdminListState lang={lang} state={!allowed?'denied':failure??'loading'} onRetry={refresh}/>}
    {isDetail&&<div className="crm-detail-root" data-theme={isLight?'light':'dark'} data-record-scroll="page">
      <article className="crm-detail-panel access-record-detail">
        <AdminRecordHeader back={{label:poolView?t('返回发信池列表','Back to sending pools','Kembali ke daftar pool'):
          fromPool?t('返回发信池详情','Back to sending pool details','Kembali ke detail pool'):
            t('返回发件账号列表','Back to sending accounts','Kembali ke daftar akun pengirim'),
          onClick:()=>onNavigate(fromPool?poolListHref+'&mailPool='+encodeURIComponent(fromPool):listHref)}}
          title={<AdminRecordTitle title={recordName??(poolView?t('发信池','Sending pool','Pool pengiriman'):
            t('发件账号','Sending account','Akun pengirim'))} titleRef={detailTitle}
            status={detailAccount?accountStatus(detailAccount):detailPool&&<AdminStatus active={detailPool.enabled}>{detailPool.enabled?t('已启用','Enabled','Aktif'):word('disabled')}</AdminStatus>}/>}
          actions={allowed&&failure!=='denied'&&recordName&&<AdminDetailActions label={t('记录操作','Record actions','Tindakan rekaman')}
            secondary={detailPool&&detailPool.id===config?.selectedPool&&canReplace&&<CrmPageAction icon={ArrowRightLeft}
              label={t('更换不可用发件账号','Replace unavailable sender','Ganti pengirim yang tidak tersedia')} onClick={()=>edit('reassign')}/>}
            primary={<CrmPageAction icon={Pencil} variant="primary" label={poolView?t('编辑发信池','Edit sending pool','Edit pool pengiriman'):
              t('编辑发件账号','Edit sending account','Edit akun pengirim')}
              onClick={()=>edit(detailPool?{pool:detailPool}:accountIndex)}/>}/>}/>
        <div className="crm-detail-body access-record-body">
          {(!allowed||!config||failure)&&<AdminListState lang={lang} state={!allowed?'denied':failure??'loading'} onRetry={refresh}/>}
          {allowed&&activeView&&(detailPool?<><AdminFormSection title={t('发信配置','Sending configuration','Konfigurasi pengiriman')}>
            <dl className="access-record-facts">
              <div><dt>{t('发信池类型','Pool type','Jenis pool')}</dt><dd>{detailPool.transport.toUpperCase()}</dd></div>
              <div><dt>{t('本部署投递方式','Delivery mode for this deployment','Mode pengiriman untuk penerapan ini')}</dt><dd>{word(activeView.mode)}</dd></div>
              <div><dt>{strategyLabel}</dt><dd>{strategyName(detailPool.strategy)}</dd></div>
            </dl>
          </AdminFormSection><AdminFormSection title={t('每日额度','Daily quota','Kuota harian')}>
            <dl className="access-record-facts">
              <div><dt>{poolLimitLabel}</dt><dd>{poolLimit(detailPool)}</dd></div>
              <div><dt>{poolUsageLabel}</dt><dd>{activeView.poolUsage[detailPool.id]??0}</dd></div>
              <div><dt>{t('日额度结算时区','Daily quota time zone','Zona waktu kuota harian')}</dt><dd>{activeView.timezone}</dd></div>
            </dl>
          </AdminFormSection><AdminFormSection title={poolMembersLabel}>
            {detailPool.members.length?<AdminListTable label={poolMembersLabel} headers={[
              ...(detailPool.strategy==='priority'?[priorityLabel]:[]),
              senderLabel,statusLabel,credentialLabel,
            ]}>{detailPool.members.map((address,index)=>{
              const account=activeView.config.accounts.find(item=>item.address===address);
              const href=accountListHref+'&mailAccount='+encodeURIComponent(address)+'&mailFromPool='+encodeURIComponent(detailPool.id);
              return account&&<tr key={address}>{detailPool.strategy==='priority'&&<td>{index+1}</td>}
                <td><AdminRecordEntry href={href} ref={element=>{
                  if(element)memberLinks.current.set(address,element);else memberLinks.current.delete(address);
                }} onClick={event=>{
                  if(event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
                  event.preventDefault();
                  poolPosition.current={id:detailPool.id,address,top:window.scrollY};
                  onNavigate(href);
                }}>{address}</AdminRecordEntry></td>
                <td>{accountStatus(account)}</td><td>{credentialStatus(address)}</td>
              </tr>;
            })}</AdminListTable>:<AdminListState lang={lang} state="empty"/>}
          </AdminFormSection></>:detailAccount?<>
            <AdminFormSection title={t('SMTP 参数','SMTP settings','Pengaturan SMTP')}>
              <dl className="access-record-facts">
                <div><dt>{smtpHostLabel}</dt><dd>{detailAccount.host}</dd></div>
                <div><dt>{smtpPortLabel}</dt><dd>{detailAccount.port}</dd></div>
                <div><dt>{t('连接加密','Connection encryption','Enkripsi koneksi')}</dt><dd>{detailAccount.port===465?'TLS':'STARTTLS'}</dd></div>
                <div><dt>{t('凭证','Credential','Kredensial')}</dt><dd>{credentialStatus(detailAccount.address)}</dd></div>
              </dl>
            </AdminFormSection>
            <AdminFormSection title={quotaLabel}>
              <dl className="access-record-facts">
                <div><dt>{dailyLabel}</dt><dd>{detailAccount.daily}</dd></div>
                <div><dt>{externalLabel}</dt><dd>{detailAccount.external}</dd></div>
                <div><dt>{monthlyLabel}</dt><dd>{detailAccount.monthly??t('未设置','Not set','Belum diatur')}</dd></div>
                <div><dt>{rateLabel}</dt><dd>{detailAccount.rate}</dd></div>
                <div><dt>{windowLabel}</dt><dd>{detailAccount.windowSeconds}</dd></div>
              </dl>
            </AdminFormSection>
          </>:<AdminListState lang={lang} state="empty" message={poolView?t('找不到这个发信池。','This sending pool could not be found.','Pool pengiriman ini tidak ditemukan.'):
            t('找不到这个发件账号。','This sending account could not be found.','Akun pengirim ini tidak ditemukan.')}/>)}
        </div>
      </article>
    </div>}
    {allowed&&config&&activeView&&!isDetail&&<div className="enrollment-mail-sections">
      {poolView&&!isDetail&&
      <AdminListTable label={t('发信池列表','Sending pools','Daftar pool pengiriman')} busy={loading} headers={[
        t('发信池','Sending pool','Pool pengiriman'),t('状态','Status','Status'),t('账号数量','Account count','Jumlah akun'),
        poolUsageLabel,poolLimitLabel,strategyLabel,
        t('操作','Actions','Tindakan'),
      ]}>
        {(config.pools??[]).map(pool=><tr key={pool.id}>
          <td><AdminRecordEntry {...recordEntry(pool.id)}>{pool.name}</AdminRecordEntry></td>
          <td><AdminStatus active={pool.enabled}>{pool.enabled?t('已启用','Enabled','Aktif'):word('disabled')}</AdminStatus></td>
          <td>{pool.members.length}</td>
          <td>{activeView.poolUsage[pool.id]??0}</td>
          <td>{poolLimit(pool)}</td>
          <td>{strategyName(pool.strategy)}</td>
          <td><AdminRowAction onClick={()=>edit({pool})}>{t('编辑','Edit','Edit')}</AdminRowAction></td>
        </tr>)}
      </AdminListTable>}
      {!poolView&&!isDetail&&<AdminFormSection title={t('发件账号','Sending accounts','Akun pengirim')}>
        {config.accounts.length===0?<AdminListState lang={lang} state="empty"/>:
          <AdminListTable label={t('发件账号','Sending accounts','Akun pengirim')} headers={[
            t('邮箱','Mailbox','Kotak surat'),t('状态','Status','Status'),t('今日占用','Used today','Terpakai hari ini'),
            t('今日外部收件人','External recipients today','Penerima eksternal hari ini'),
            t('本月占用','Used this month','Terpakai bulan ini'),t('频率上限','Rate limit','Batas frekuensi'),
            t('凭证','Credential','Kredensial'),t('操作','Actions','Tindakan')]}>
            {config.accounts.map((a,index)=><tr key={a.address}>
              <td><AdminRecordEntry {...recordEntry(a.address)}>{a.address}</AdminRecordEntry></td><td>{accountStatus(a)}</td>
              <td>{activeView.usage[a.address]?.daily??0} / {a.daily}</td>
              <td>{activeView.usage[a.address]?.external??0} / {a.external}</td>
              <td>{activeView.usage[a.address]?.monthly??0} / {a.monthly??'—'}</td>
              <td>{a.rate} / {a.windowSeconds} {t('秒','seconds','detik')}</td>
              <td>{credentialStatus(a.address)}</td>
              <td><AdminRowAction onClick={()=>edit(index)}>{t('编辑','Edit','Edit')}</AdminRowAction></td>
            </tr>)}
          </AdminListTable>}
      </AdminFormSection>}
    </div>}
    {business&&settings&&<div className="enrollment-mail-sections" data-admin-form="">
      <AdminFormSection title={t('发信设置','Email settings','Pengaturan email')}>
        <AdminField as="div" className="enrollment-mail-pool-select">
          <label>{t('选用发信池','Select sending pool','Pilih pool pengiriman')}</label>
          <CrmSingleSelect lang={lang} isLight={isLight} label={t('选用发信池','Select sending pool','Pilih pool pengiriman')}
            disabled={busy||feedback==='unknown'} value={settings.pool} options={business.pools.map(pool=>({value:pool.id,
              label:pool.enabled?pool.name:pool.name+' · '+word('disabled')}))} onChange={pool=>changeSettings({pool})}/>
        </AdminField>
        <p className="crm-work-muted enrollment-mail-delivery-mode">
          {t('当前投递方式','Current delivery mode','Mode pengiriman saat ini')} · {word(business.mode)}
        </p>
        <div data-admin-stack className="enrollment-mail-fixed-sender">
          <AdminField className="enrollment-mail-switch-row">{t('为同一报名邮箱固定发件账号','Keep the same sender for each enrollment email address','Gunakan pengirim yang sama untuk setiap alamat email pendaftaran')}
            <input className="admin-switch" type="checkbox" role="switch" aria-describedby={stickyHelpId}
              checked={settings.sticky} disabled={busy||feedback==='unknown'}
              onChange={event=>changeSettings({sticky:event.target.checked})}/></AdminField>
          <div id={stickyHelpId} className="crm-work-muted">
            <p>{t('开启后，同一个报名邮箱后续沿用首封被 SMTP 接收的发件账号。该账号额度用完时，业务邮件排队等待。',
              'When on, later emails to the same enrollment address use the sender whose first message SMTP accepted. Business emails wait if that sender reaches its limit.',
              'Jika aktif, email berikutnya ke alamat pendaftaran yang sama memakai akun pengirim yang pertama kali diterima SMTP. Email bisnis menunggu jika kuota akun itu habis.')}</p>
            <p>{t('关闭后，每封邮件都按所选发信池的策略重新选择账号。',
              'When off, each email uses an account chosen by the selected pool strategy.',
              'Jika nonaktif, akun pengirim dipilih untuk setiap email sesuai strategi pool yang dipilih.')}</p>
          </div>
        </div>
        {settingsConflict&&feedback!=='unknown'?<AdminFormFeedback state="error" lang={lang}>
          {t('发信设置已在别处更新。','Email settings were updated elsewhere.','Pengaturan email telah diperbarui di tempat lain.')}
          {' '}<AdminRowAction onClick={()=>{setSettingsDraft(undefined);setFeedback(undefined);}}>
            {t('放弃草稿并查看最新设置','Discard draft and view current settings','Buang draf dan lihat pengaturan terkini')}
          </AdminRowAction>
        </AdminFormFeedback>:feedback&&feedback!=='saved'?<AdminFormFeedback state={feedback} lang={lang}/>:null}
      </AdminFormSection>
      <AdminFormSection title={historyTitle} description={t('最近 100 条业务邮件。SMTP 已接收表示邮件已交给邮件服务。','Latest 100 business emails. SMTP accepted means the mail service accepted the message.','100 email bisnis terakhir. Diterima SMTP berarti pesan diterima oleh layanan email.')}>
        <div className="enrollment-mail-history-controls">
          <AdminSearchField label={t('搜索主题或发件账号','Search subject or sender','Cari subjek atau pengirim')}
            placeholder={t('搜索主题或发件账号','Search subject or sender','Cari subjek atau pengirim')}
            value={historySearch} onChange={value=>{setHistorySearch(value);setHistoryPage(1);}}/>
          <CrmSingleSelect lang={lang} isLight={isLight} label={t('发送状态','Delivery status','Status pengiriman')}
            value={historyStatus} onChange={value=>{setHistoryStatus(value);setHistoryPage(1);}}
            options={[{value:'',label:t('全部状态','All statuses','Semua status')},...Object.keys(deliveryTones).map(value=>({value,label:word(value)}))]}/>
        </div>
        {visibleHistory.length?<AdminListTable label={historyTitle} busy={loading} headers={[
          t('主题','Subject','Subjek'),t('发送状态','Delivery status','Status pengiriman'),t('发件账号','Sender','Pengirim'),
          t('选用发件账号的原因','Sender selection reason','Alasan pemilihan pengirim'),
          {label:t('记录时间','Recorded at','Waktu catat'),sort:'descending'},
        ]}>{visibleHistory.map(row=><tr key={row.id}>
          <td>{row.subject||'—'}</td>
          <td><AdminStatus tone={deliveryTones[row.state as keyof typeof deliveryTones]}>{word(row.state)}</AdminStatus></td>
          <td>{row.sender||'—'}</td><td>{row.routeReason?word(row.routeReason):'—'}</td><td>{formatCrmEventTime(row.recordedAt)}</td>
        </tr>)}</AdminListTable>:<AdminListState lang={lang} state="empty"
          message={business.rows.length===0?t('暂无招生邮件发送记录。','No admissions email records yet.','Belum ada riwayat email penerimaan.'):undefined}/>}
        <AdminListPagination lang={lang} page={currentHistoryPage} pageCount={historyPageCount} busy={loading} onPageChange={setHistoryPage}/>
      </AdminFormSection>
    </div>}
    {editing!==undefined&&draft&&<AdminEditor variant="drawer" responsiveForm required lang={lang} light={isLight} busy={busy}
      title={editing==='reassign'?t('更换不可用发件账号','Replace unavailable sender','Ganti pengirim yang tidak tersedia'):
        editing==='new-pool'?addPoolLabel:isPoolEditor?t('编辑发信池','Edit sending pool','Edit pool pengiriman'):t('发信账号设置','Sending account settings','Pengaturan akun pengirim')}
      onSubmit={event=>{event.preventDefault();if(dirty&&(!isPoolEditor||draft.name.trim()))void save();}}
      onClose={()=>{if(dirty)setDiscard(true);else close();}}
      footer={<><button type="button" disabled={busy} onClick={()=>{if(dirty)setDiscard(true);else close();}}>{cancel}</button>
        {pendingOperation&&<CrmPageAction icon={ClipboardCheck} label={t('核对保存结果','Check save result','Periksa hasil penyimpanan')}
          disabled={busy} onClick={()=>void checkAdminResult()}/>}
        <button type="submit" data-primary
          disabled={busy||!dirty||!!pendingOperation||adminConflict||isPoolEditor&&(!draft.name.trim()||!validPoolLimit)||
            typeof editing==='number'&&(!validPort||!validMonthly||duplicateAccount)||
            editing==='reassign'&&(!validRecipient||!replacement.account||!replacement.reason.trim())}>{t('保存','Save','Simpan')}</button></>}>
      {adminConflict?<AdminFormFeedback state="error" lang={lang}>
        {t('邮件设置已在别处更新，当前草稿仍保留。','Email settings were updated elsewhere. Your draft is retained.',
          'Pengaturan email diperbarui di tempat lain. Draf Anda tetap tersimpan.')}
        {' '}<AdminRowAction disabled={busy} onClick={()=>void reloadEditor()}>
          {t('放弃草稿并载入最新设置','Discard draft and load current settings','Buang draf dan muat pengaturan terkini')}
        </AdminRowAction>
      </AdminFormFeedback>:credentialKeyError?<AdminFormFeedback state="error" lang={lang}>
        {t('本环境尚未配置 SMTP 凭证加密密钥，暂时无法保存密码。',
          'The SMTP credential encryption key is missing in this environment. The password cannot be saved yet.',
          'Kunci enkripsi kredensial SMTP belum tersedia di lingkungan ini. Kata sandi belum dapat disimpan.')}
      </AdminFormFeedback>:feedback&&<AdminFormFeedback state={feedback} lang={lang}/>}
      {savedComparison&&<AdminDisclosure heading={t('查看最新已保存设置','View the latest saved settings','Lihat pengaturan terbaru yang disimpan')}>
        <dl className="access-record-facts">{savedComparison.map(([label,value],index)=>
          <div key={index}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </AdminDisclosure>}
      {operationCheck&&<AdminFormFeedback state={operationCheck==='error'?'error':'unknown'} lang={lang}>
        {operationCheck==='error'?t('暂时无法核对保存结果，请稍后再查。','The save result could not be checked. Try again later.','Hasil penyimpanan belum bisa diperiksa. Coba lagi nanti.'):
          t('暂未查到保存回执，草稿已保留，可稍后再次核对。','No save receipt yet. Your draft is retained. Check again later.','Belum ada bukti penyimpanan. Draf tetap tersimpan. Periksa kembali nanti.')}
      </AdminFormFeedback>}
      <fieldset className="enrollment-mail-editor-fields" disabled={busy||!!pendingOperation}>
      {editing==='reassign'?<AdminFormSection title={t('选择新发件账号','Select the replacement sender','Pilih pengirim pengganti')}
        description={t('仅可更换绑定到停用或已移出发信池账号的报名邮箱，操作会记入变更审计。','Only an address bound to a disabled or removed pool member can be reassigned. Each change is audited.','Hanya alamat yang terikat akun nonaktif atau yang dikeluarkan dari pool dapat dipindahkan. Perubahan dicatat dalam audit.')}>
        <AdminField required>{t('报名邮箱','Enrollment address','Alamat pendaftaran')}
          <input type="email" required aria-invalid={!!replacement.recipient&&!validRecipient||undefined}
            value={replacement.recipient} onChange={e=>changeReplacement({recipient:e.target.value})}/>
          {!!replacement.recipient&&!validRecipient&&<small>{contactEmailText(lang).error}</small>}
        </AdminField>
        <AdminField as="div" required><label>{t('新发件账号','New sender','Pengirim baru')}</label>
          <CrmSingleSelect lang={lang} isLight={isLight} label={t('新发件账号','New sender','Pengirim baru')} value={replacement.account}
            options={[{value:'',label:t('请选择','Select an account','Pilih akun')},...draft.accounts.filter(a=>a.enabled&&mailPoolMembers(draft).includes(a.address)).map(a=>({value:a.address,label:a.address}))]}
            onChange={account=>changeReplacement({account})}/>
        </AdminField>
        <AdminField required>{t('更换原因','Reason for reassignment','Alasan penggantian')}<textarea required maxLength={500} value={replacement.reason} onChange={e=>changeReplacement({reason:e.target.value})}/></AdminField>
      </AdminFormSection>:isPoolEditor?<><AdminFormSection title={t('基本设置','General settings','Pengaturan umum')}>
        <AdminField required>{t('发信池名称','Pool name','Nama pool')}<input required maxLength={80} value={draft.name} onChange={e=>changePool({name:e.target.value})}/></AdminField>
        <AdminField>
          <input className="admin-switch" type="checkbox" role="switch" checked={draft.enabled} disabled={busy}
            onChange={e=>changePool({enabled:e.target.checked})}/>
          {t('启用发信池','Enable sending pool','Aktifkan pool')}
        </AdminField>
      </AdminFormSection><AdminFormSection className="enrollment-mail-pool-rules" title={t('发信规则','Sending rules','Aturan pengiriman')}>
        <AdminFormGrid>
          <AdminField>{poolLimitLabel}
            <input type="number" min="1" max={mailPoolDailyLimitMax} placeholder={t('不限','Unlimited','Tanpa batas')}
              aria-invalid={!validPoolLimit||undefined}
              value={draft.dailyLimit??''} onChange={event=>changePool({dailyLimit:event.target.value===''?null:Number(event.target.value)})}/>
            {!validPoolLimit&&<small>{t(`请输入 1–${mailPoolDailyLimitMax} 的整数，或留空。`,
              `Enter a whole number from 1 to ${mailPoolDailyLimitMax}, or leave blank.`,`Masukkan bilangan bulat 1–${mailPoolDailyLimitMax}, atau kosongkan.`)}</small>}
          </AdminField>
          <AdminField as="div">
            <label>{strategyLabel}</label>
            <CrmSingleSelect lang={lang} isLight={isLight} label={strategyLabel} disabled={busy}
              value={draft.strategy??'balanced'} options={[...strategyOptions]}
              onChange={strategy=>changePool({strategy:strategy==='priority'?'priority':'balanced'})}/>
          </AdminField>
        </AdminFormGrid>
      </AdminFormSection><AdminFormSection title={poolMembersLabel}
        description={draft.strategy==='priority'?t('按顺序尝试已加入的账号。','Selected accounts are tried in priority order.','Akun yang dipilih dicoba sesuai urutan prioritas.'):undefined}>
        {draft.accounts.length===0?<AdminListState lang={lang} state="empty"
          message={t('请先在发件账号页新增账号。','Add an account on the Sending accounts tab first.','Tambahkan akun di tab Akun pengirim terlebih dahulu.')}/>:
          <AdminListTable className="enrollment-mail-member-picker" label={poolMembersLabel} headers={[
            t('加入','Include','Sertakan'),senderLabel,statusLabel,
            ...(draft.strategy==='priority'?[priorityLabel,t('调整顺序','Reorder','Ubah urutan')]:[]),
          ]}>
            {(draft.strategy==='priority'?[...orderedMembers,...draft.accounts.map(account=>account.address).filter(address=>!orderedMembers.includes(address))]:
              draft.accounts.map(account=>account.address)).map(address=>{
              const account=draft.accounts.find(item=>item.address===address)!;
              const index=orderedMembers.indexOf(address);
              return <tr key={address}>
                <td><AdminField><input type="checkbox" aria-label={address} checked={index!==-1} disabled={busy} onChange={event=>
                  changePool({members:event.target.checked?[...orderedMembers,address]:orderedMembers.filter(member=>member!==address)})}/></AdminField></td>
                <td>{address}</td><td>{accountStatus(account)}</td>
                {draft.strategy==='priority'&&<><td>{index===-1?'—':index+1}</td><td>
                  {index!==-1&&<AdminFormActions>
                    <CrmPageAction id={memberActionId(address,-1)} icon={ArrowUp} iconOnly label={t('上移 ','Move up ','Naikkan ')+address}
                      disabled={busy||index===0} onClick={()=>moveMember(index,-1)}/>
                    <CrmPageAction id={memberActionId(address,1)} icon={ArrowDown} iconOnly label={t('下移 ','Move down ','Turunkan ')+address}
                      disabled={busy||index===orderedMembers.length-1} onClick={()=>moveMember(index,1)}/>
                  </AdminFormActions>}
                </td></>}
              </tr>;
            })}
          </AdminListTable>}
      </AdminFormSection></>:account&&<>
        <AdminFormSection title={t('SMTP 账号','SMTP account','Akun SMTP')}>
          <AdminField>{t('启用发件账号','Enable sending account','Aktifkan akun pengirim')}
            <input className="admin-switch" type="checkbox" role="switch" checked={account.enabled} disabled={busy}
              onChange={e=>changeAccount({enabled:e.target.checked})}/></AdminField>
          <AdminField required>{t('发件邮箱','Sender address','Alamat pengirim')}<input type="email" required
            aria-invalid={!!account.address&&(!validAccountEmail||duplicateAccount)||undefined}
            readOnly={typeof editing==='number'&&editing<draft.accounts.length} value={account.address} onChange={e=>changeAccount({address:e.target.value})}/>
            {duplicateAccount?<small>{t('此发件邮箱已存在。','This sender address already exists.','Alamat pengirim ini sudah ada.')}</small>:
              !!account.address&&!validAccountEmail&&<small>{contactEmailText(lang).error}</small>}
          </AdminField>
          <AdminFormGrid>
            <AdminField required>{smtpHostLabel}<input required pattern={mailSmtpHostPattern} value={account.host} onChange={e=>changeAccount({host:e.target.value})}/></AdminField>
            <AdminField required>{smtpPortLabel}
              <input required type="text" inputMode="numeric" pattern="465|587" maxLength={3}
                value={portInput} onChange={event=>{setPortInput(event.target.value.replace(/[^0-9]/g,''));setDirty(true);}}
                aria-invalid={portInput&&!validPort?true:undefined}/>
              <small>{t('支持 465 或 587。','Enter 465 or 587.','Masukkan 465 atau 587.')}</small>
            </AdminField>
          </AdminFormGrid>
          <AdminField>{t('SMTP 密码','SMTP password','Kata sandi SMTP')}
            <input type="password" autoComplete="new-password" maxLength={1024} value={password}
              disabled={clearPassword}
              onChange={e=>{setPassword(e.target.value);setCredentialKeyError(false);setDirty(true);}}/>
            <small>{credentialStatus(account.address)} · {t('留空沿用当前凭证。输入新密码后保存即可替换。',
              'Leave blank to keep the current credential. Enter a new password to replace it.',
              'Kosongkan untuk mempertahankan kredensial saat ini. Masukkan kata sandi baru untuk menggantinya.')}</small>
          </AdminField>
          {typeof editing==='number'&&editing<draft.accounts.length&&<AdminField as="label">
            <input type="checkbox" checked={clearPassword} onChange={e=>{
              setClearPassword(e.target.checked);setPassword('');setCredentialKeyError(false);setDirty(true);
            }}/>
            {t('保存时清除凭证','Clear credential when saving','Hapus kredensial saat menyimpan')}
          </AdminField>}
        </AdminFormSection>
        <AdminFormSection title={quotaLabel}>
          <AdminFormGrid>{inputNumber(rateLabel,account.rate,rate=>changeAccount({rate}),100000)}
            {inputNumber(windowLabel,account.windowSeconds,windowSeconds=>changeAccount({windowSeconds}),3600)}</AdminFormGrid>
          <AdminFormGrid>{inputNumber(dailyLabel,account.daily,daily=>changeAccount({daily}),100000)}
            {inputNumber(externalLabel,account.external,external=>changeAccount({external}),100000)}</AdminFormGrid>
          <AdminField>{monthlyLabel}
            <input type="number" min="1" max="10000000" aria-invalid={!validMonthly||undefined}
              value={account.monthly??''} onChange={e=>changeAccount({monthly:e.target.value===''?null:Number(e.target.value)})}/>
            {!validMonthly&&<small>{t('请输入 1–10,000,000 的整数，或留空。','Enter a whole number from 1 to 10,000,000, or leave blank.',
              'Masukkan bilangan bulat 1–10.000.000, atau kosongkan.')}</small>}
          </AdminField>
        </AdminFormSection>
      </>}
      </fieldset>
      {discard&&<CrmDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)} onDiscard={close}/>}
    </AdminEditor>}
  </section>;
}
