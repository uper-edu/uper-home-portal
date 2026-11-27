import {useCallback,useLayoutEffect,useRef,useState} from 'react';
import {ClipboardCheck,Landmark} from 'lucide-react';
import {useLocation,useNavigate} from 'react-router-dom';
import {AdminHeader,AdminModuleLink,adminText} from '../components/AdminHeader';
import {AdminContentNav} from '../components/admin/AdminContentNav';
import {AdminDiscardDialog} from '../components/admin/AdminDiscardDialog';
import {AdminListState} from '../components/admin/AdminList';
import {AdminPageHeader} from '../components/admin/AdminPageHeader';
import {AdminRefreshAction} from '../components/admin/AdminRefreshAction';
import {PageMetadata} from '../components/PageMetadata';
import CrmAccess,{type CrmEmployee} from '../components/CrmAccess';
import {CrmEnrollmentBank} from '../components/crm/CrmEnrollmentBank';
import {CrmEnrollmentFinance} from '../components/crm/CrmEnrollmentFinance';
import {CrmFinanceWorkspace} from '../components/crm/CrmFinanceWorkspace';
import {CrmQueueCount,useCrmQueueSummary} from '../components/crm/CrmQueueCount';
import {CrmUiProvider} from '../components/crm/CrmUiLanguage';
import {canManageEnrollmentFinance,canVerifyPayments} from '../utils/accessControl';
import {useAdminTheme} from '../utils/adminPreferences';
import {guardAdminWorkspaceHistory} from '../utils/adminWorkspaceHistory';
import {enrollmentBankPath,enrollmentVerificationPath,financeView,historicalPaymentsPath} from '../utils/financeNavigation';
import {paymentWorkspaceLabel} from '../utils/crmPaymentPresentation';
import type {CrmLanguage} from '../utils/crmLanguage';
import '../components/admin-workspace.css';
import '../components/crm/crm-detail-workspace.css';
import '../components/crm/crm-finance-workspace.css';
import '../components/crm/crm-list.css';
import '../components/crm/crm-opportunities.css';
import '../components/crm/crm-operation-layer.css';
import '../components/crm/crm-payments.css';

type Props={employee:CrmEmployee;lang:CrmLanguage;setLang:(lang:CrmLanguage)=>void};
const readHistoryEntry=()=>({url:window.location.href,state:window.history.state});
const historicalFilterKeys=['paymentState','paymentKind','paymentSearch','paymentPage'];

function FinanceWorkspace({employee,lang,setLang}:Props){
  const {isLight,toggleTheme}=useAdminTheme();
  const navigate=useNavigate();
  const location=useLocation();
  const canVerify=canVerifyPayments(employee);
  const canManage=canManageEnrollmentFinance(employee);
  const defaultView=canManage?'enrollment':'historical';
  const params=new URLSearchParams(location.search);
  const view=financeView(params,defaultView);
  const bankView=view==='enrollment-bank';
  const accessible=canVerify&&(view==='historical'||canManage);
  const verificationPath=canManage?enrollmentVerificationPath:historicalPaymentsPath;
  const queue=useCrmQueueSummary('payments',canVerify?employee.id:undefined);
  const [refreshVersion,setRefreshVersion]=useState(0);
  const [loading,setLoading]=useState(false);
  const [destination,setDestination]=useState<string>();
  const dirty=useRef(false),busy=useRef(false);
  const setDirty=useCallback((value:boolean)=>{dirty.current=value;},[]);
  const setBusy=useCallback((value:boolean)=>{busy.current=value;},[]);
  const accepted=useRef(readHistoryEntry());
  const remember=useCallback(()=>{accepted.current=readHistoryEntry();},[]);
  const t=(en:string,id:string,zh:string)=>adminText(lang,en,id,zh);
  const verificationTitle=t('Payment verification','Verifikasi pembayaran','收款核验');
  const bankTitle=t('Enrollment bank account','Rekening pembayaran pendaftaran','报名收款账户');

  const go=(href:string)=>{
    const url=new URL(href,window.location.origin);
    if(url.origin!==window.location.origin)return;
    if(url.pathname===enrollmentVerificationPath){
      const current=new URLSearchParams(window.location.search);
      for(const key of historicalFilterKeys){
        const value=current.get(key);
        if(value!==null&&!url.searchParams.has(key))url.searchParams.set(key,value);
      }
    }
    setDirty(false);
    navigate(url.pathname+url.search+url.hash);
  };
  const onNavigate=(href:string)=>{
    if(busy.current)return;
    if(dirty.current)setDestination(href);
    else go(href);
  };
  useLayoutEffect(remember,[location,remember]);
  useLayoutEffect(()=>{
    const restore=(event:PopStateEvent)=>{
      const target=new URL(window.location.href);
      const previous=new URL(accepted.current.url);
      if(target.href===previous.href)return;
      // The historical list owns navigation between its own records and filters.
      if(view==='historical'&&target.pathname===enrollmentVerificationPath&&financeView(target.searchParams,defaultView)==='historical')return;
      if(dirty.current||busy.current){
        event.stopImmediatePropagation();
        window.history.pushState(accepted.current.state,'',previous.href);
        if(!busy.current)setDestination(target.href);
      }
    };
    const beforeUnload=(event:BeforeUnloadEvent)=>{
      if(dirty.current||busy.current){event.preventDefault();event.returnValue='';}
    };
    const clearGuard=guardAdminWorkspaceHistory(restore);
    window.addEventListener('beforeunload',beforeUnload);
    return ()=>{clearGuard();window.removeEventListener('beforeunload',beforeUnload);};
  },[defaultView,view]);

  return <div data-admin-workspace="finance" data-theme={isLight?'light':'dark'} className={`min-h-screen flex flex-col ${isLight?'bg-[#f5f5f7] text-slate-900':'bg-slate-950 text-slate-100'}`}>
    <PageMetadata lang={lang} options={{module:bankView?'enrollment-bank':'payments',state:accessible?undefined:'denied'}}/>
    <a className="admin-skip-link" href="#finance-main">{t('Skip to workspace','Lewati ke ruang kerja','跳到工作区')}</a>
    <AdminHeader workspace="finance" {...{employee,lang,setLang,isLight,toggleTheme}} onWorkspaceNavigate={onNavigate} navigation={canVerify&&<>
      <AdminModuleLink href={verificationPath} current={!bankView} onNavigate={bankView?onNavigate:undefined}>
        <ClipboardCheck size={16} aria-hidden="true"/>{verificationTitle}<CrmQueueCount queue="payments" count={queue.data?.pendingCount} lang={lang}/>
      </AdminModuleLink>
      {canManage&&<AdminModuleLink href={enrollmentBankPath} current={bankView} onNavigate={bankView?undefined:onNavigate}>
        <Landmark size={16} aria-hidden="true"/>{bankTitle}
      </AdminModuleLink>}
    </>}/>
    <main id="finance-main" tabIndex={-1} className="admin-workspace-main flex-1 space-y-5">
      {!accessible?<AdminListState lang={lang} state="denied" message={canVerify?
        t('Your payment verification access is limited to assigned customers.','Akses verifikasi terbatas pada pelanggan yang ditugaskan.','你的核验权限仅适用于分配给你的客户。'):
        t('You do not have access to finance management.','Anda tidak memiliki akses manajemen keuangan.','你没有财务管理访问权限。')}/>:
        bankView?<CrmEnrollmentBank {...{lang,isLight}} onDraftChange={setDirty} onBusyChange={setBusy}/>:
          <section className="crm-finance-workspace" aria-label={verificationTitle}>
            <AdminPageHeader title={verificationTitle} subtitle={view==='enrollment'
              ?t('Review transfer proofs and verify payments for enrollment orders.','Periksa bukti transfer dan verifikasi pembayaran pesanan pendaftaran.','查看报名订单的转账凭证，核实实际到账。')
              :t('Review receipts and refunds for historical customer payments.','Periksa penerimaan dan pengembalian dana pembayaran pelanggan terdahulu.','查询历史客户款项，核对收款和退款记录。')}
              actions={<AdminRefreshAction label={t('Refresh','Muat ulang','刷新')} loading={loading} onClick={()=>{setRefreshVersion(value=>value+1);queue.refresh();}}/>}/>
            {canManage&&<AdminContentNav label={t('Payment records','Catatan pembayaran','收款记录')} onNavigate={onNavigate} items={[
              {href:enrollmentVerificationPath,label:paymentWorkspaceLabel('enrollment',lang),current:view==='enrollment'},
              {href:historicalPaymentsPath,label:paymentWorkspaceLabel('historical',lang),current:view==='historical'},
            ]}/>}
            {view==='enrollment'?<CrmEnrollmentFinance key={params.get('enrollmentOrder')??'list'} actorId={employee.id} {...{lang,isLight,refreshVersion}}
              onRefreshingChange={setLoading} onQueueChanged={queue.refresh} onDirty={setDirty} onBusy={setBusy} onLocation={remember}/>:<CrmFinanceWorkspace
              {...{employee,lang,isLight,refreshVersion}} onRefreshingChange={setLoading} onQueueChanged={queue.refresh} onDirty={setDirty} onBusy={setBusy} onLocation={remember}/>}
          </section>}
    </main>
    {destination&&<AdminDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDestination(undefined)} onDiscard={()=>{
      setDestination(undefined);
      go(destination);
    }}/>}
  </div>;
}

export default function FinanceWorkbench(){
  return <CrmAccess workspace="finance">{(employee,lang,setLang)=><CrmUiProvider lang={lang}>
    <FinanceWorkspace key={employee.id} {...{employee,lang,setLang}}/>
  </CrmUiProvider>}</CrmAccess>;
}
