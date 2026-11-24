import '../components/crm/crm-detail-workspace.css';
import {IntegrationCredentialsOverview,resolveIntegrationTopic,type IntegrationTopic} from '../components/IntegrationCredentials';
import {EnrollmentMailWorkspace} from '../components/EnrollmentMailWorkspace';
import {SystemAccessGuide} from '../components/SystemAccessGuide';
import {AdminRefreshAction} from '../components/admin/AdminRefreshAction';
import {AdminPageHeader} from '../components/admin/AdminPageHeader';
import {CrmPageAction} from '../components/crm/CrmPageAction';
import {AdminConfirmation} from '../components/admin/AdminConfirmation';
import {AdminDisclosure} from '../components/admin/AdminDisclosure';
import {AdminEditor} from '../components/admin/AdminEditor';
import {AdminSearchField} from '../components/admin/AdminSearchField';
import {CrmContentNav,CrmDiscardDialog} from '../components/crm/CrmDetailWorkspace';
import {LarkEmployeeBinding} from '../components/LarkEmployeeBinding';
import {AdminFormSection,AdminFormFeedback,AdminFormGrid,AdminSavedReadError} from '../components/AdminFormLayout';
import {isAiAdministrator} from '../utils/aiServicePolicy';
import {formatCrmEventTime} from '../utils/crmOperatingTime';
import {AdminField,firstMissingAdminField} from '../components/AdminForm';
import {PageMetadata} from '../components/PageMetadata';
import { managementRequest, pendingAccessOperations } from "../utils/accessOperationClient";
import { AccessOperationStatus } from "../components/AccessOperationStatus";
import { AccessSafetyPanel, canUseAccessRecovery } from "../components/AccessSafetyPanel";
import {AdminListState,AdminListTable} from '../components/admin/AdminList';
import {AdminRecordEntry,AdminRowAction} from '../components/admin/AdminListControl';
import {AdminRecordHeader} from '../components/admin/AdminRecordHeader';
import {AdminDetailActions,AdminRecordFilters,AdminRecordRow,AdminRecordSidebar,AdminRecordTitle,useAdminRecordSidebarLayout} from '../components/admin/AdminRecordWorkspace';
import {AdminStatus} from '../components/AdminStatus';
import {containPaneKeys,recordSplitMinWidth} from '../components/adminScroll';
import {useCrmShellHeight,useRecordScrollMode} from '../components/crm/CrmDetailWorkspace';
import '../components/crm/crm-record-workspace.css';
import '../components/admin-workspace.css';
import '../components/crm/crm-operations-workspace.css';
import { accessError } from "../utils/accessLanguage";
import { Fragment, type MouseEvent, useEffect, useRef, useState } from "react";
import {Pencil, Plus, BookOpen, Users, FlaskConical, Mail, KeyRound } from "lucide-react";
import {TestEnvironmentPanel} from '../components/TestEnvironmentPanel';
import CrmAccess, { type CrmEmployee } from "../components/CrmAccess";
import { AdminHeader, adminText } from "../components/AdminHeader";
import { AdminSingleSelect } from "../components/admin/AdminSingleSelect";
import { useAdminTheme } from "../utils/adminPreferences";
import { type CrmLanguage } from "../utils/crmLanguage";
import {
  permissionCatalog,
  projectEmployee,
  type RoleConfig,
  type AccessScope,
} from "../utils/accessControl";
import "../components/crm/crm-lead-filters.css";
import "./access-management.css";
const moduleIcons = {
  users: Users,
  roles: Users,
  audit: Users,
  guide: BookOpen,
  test: FlaskConical,
  mail: Mail,
  credentials: KeyRound,
};
type User = {
  id: string;
  loginId: string;
  email?: string | null;
  larkBound?: boolean;
  displayName: string;
  roles: string[];
  active: boolean;
  revision: number;
  effective: CrmEmployee;
};
type Role = {
  id: string;
  config: RoleConfig;
  enabled: boolean;
  revision: number;
};
const accessTabs=['users','roles','audit'] as const;
const isAccessTab=(tab:string)=>accessTabs.some(value=>value===tab);

function systemLocation(href:string, employeeId:string) {
  const url=new URL(href,window.location.origin);
  if(url.searchParams.get('tab')==='preview'){
    url.searchParams.set('tab','users');
    if(!url.searchParams.get('user'))url.searchParams.set('user',employeeId);
  }
  if(url.searchParams.get('tab')==='ai'){
    url.searchParams.set('tab','credentials');
    url.searchParams.set('credentialTopic','llm');
  }
  const tab=url.searchParams.get('tab')||'users';
  return {
    href:url.pathname+url.search,
    tab:Object.hasOwn(moduleIcons,tab)||tab==='restore-review'?tab:'users',
    params:url.searchParams,
  };
}
async function apiRequest(path = "", body?: any) {
  const r = await fetch("/api/admin/access" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const d = await r.json();
  if (!r.ok) throw Object.assign(Error(d.error || "access_unavailable"),{status:r.status});
  return d;
}
export default function AccessWorkbench() {
  return (
    <CrmAccess workspace="system">
      {(employee, lang, setLang) => (
        <AccessWorkspace
          key={employee.id}
          employee={employee}
          lang={lang}
          setLang={setLang}
        />
      )}
    </CrmAccess>
  );
}
export function AccessWorkspace({
  employee,
  lang,
  setLang,
}: {
  employee: CrmEmployee;
  lang: CrmLanguage;
  setLang: (lang: CrmLanguage) => void;
}) {
  const { isLight, toggleTheme } = useAdminTheme(),
    col = lang === "zh" ? 2 : lang === "id" ? 1 : 0,
    t = (en: string, id: string, zh: string) => adminText(lang, en, id, zh);
  const [discarding, setDiscarding] = useState(false);
  const [recoveryDraft,setRecoveryDraft]=useState(false);
  const [recoveryBusy,setRecoveryBusy]=useState(false);
  const [integrationDraft,setIntegrationDraft]=useState(false);
  const [integrationBusy,setIntegrationBusy]=useState(false);
  const [larkDirty,setLarkDirty]=useState(false);
  const [larkDraft,setLarkDraft]=useState<any>(undefined);
  const [initialLocation] = useState(()=>systemLocation(window.location.href,employee.id));
  const [integrationTopic,setIntegrationTopic]=useState(()=>resolveIntegrationTopic(initialLocation.params.get('credentialTopic')));
  const [mailView,setMailView]=useState<'accounts'|'pool'>(initialLocation.params.get('mailView')==='pool'?'pool':'accounts');
  const [mailRecordId,setMailRecordId]=useState(initialLocation.params.get(mailView==='pool'?'mailPool':'mailAccount')??'');
  const [mailReturnPool,setMailReturnPool]=useState(initialLocation.params.get('mailFromPool')??'');
  const [tab, setTab] = useState(initialLocation.tab),
    [readDenied,setReadDenied]=useState(false),
    [data, setData] = useState<{ users: User[]; roles: Role[]; testDirectoryAvailable?:boolean } | null>(null),
    [err, setErr] = useState(""),
    [notice, setNotice] = useState(""),
    [larkValidation, setLarkValidation] = useState(""),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [audit, setAudit] = useState<any[]>([]);
  const pendingSaveId=useRef<string|undefined>(undefined);
  const [savedReadFailed,setSavedReadFailed]=useState(false);
  const [signInNoticeUserId,setSignInNoticeUserId]=useState<string|null>(null);
  const [user, setUser] = useState<any>(null),
    [role, setRole] = useState<Role | null>(null),
    [why, setWhy] = useState(""),
    [preview, setPreview] = useState<any[] | null>(null),
    [latest, setLatest] = useState<any>(null),
    [impact, setImpact] = useState<any>(null),
    [password, setPassword] = useState(""),
    [dirty, setDirty] = useState(false);
  const [sensitiveAction,setSensitiveAction]=useState<"sessions"|"password">();
  const refreshing = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [recordId,setRecordId]=useState(()=>(isAccessTab(tab)&&tab!=='audit'?initialLocation.params.get(tab==='roles'?'role':'user'):'')||'');
  const [roleFilter,setRoleFilter]=useState(()=>new URLSearchParams(window.location.search).get('assignedRole')||'');
  const [filters,setFilters]=useState<Record<string,{query:string;status:string}>>({});
  const {query='',status:statusFilter=''}=filters[tab]??{};
  const setQuery=(query:string)=>setFilters(old=>({...old,[tab]:{query,status:statusFilter}}));
  const setStatusFilter=(status:string)=>setFilters(old=>({...old,[tab]:{query,status}}));
  const changeRoleFilter=(value:string)=>{
    const url=new URL(window.location.href);
    if(value)url.searchParams.set('assignedRole',value);else url.searchParams.delete('assignedRole');
    locationRef.current=url.pathname+url.search;
    window.history.replaceState(window.history.state,'',locationRef.current);
    setRoleFilter(value);
  };
  const [showRecords,setShowRecords]=useState(false);
  const [wide,setWide]=useState(()=>window.innerWidth>=recordSplitMinWidth);
  const shellHeight=useCrmShellHeight("[data-admin-header]"),scrollMode=useRecordScrollMode(shellHeight);
  const locationRef=useRef(initialLocation.href);
  useEffect(()=>{
    if(window.location.pathname+window.location.search!==initialLocation.href)
      window.history.replaceState(window.history.state,'',initialLocation.href);
  },[initialLocation]);
  const pendingNavigation=useRef<(()=>void)|undefined>(undefined);
  const listPosition=useRef<{module:string;id:string;top:number}|undefined>(undefined);
  const listSearch=useRef<HTMLInputElement>(null);
  const recordHeading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{
    const media=window.matchMedia(`(min-width: ${recordSplitMinWidth}px)`);
    const sync=()=>{setWide(media.matches);if(media.matches)setShowRecords(false);};
    media.addEventListener('change',sync);
    return ()=>media.removeEventListener('change',sync);
  },[]);
  const panel = useRef<HTMLDialogElement>(null);
  const can = (permission: string) => employee.permissions.includes(permission);
  useEffect(() => {setNotice("");setLarkValidation("");}, [lang]);
  const api = (path = "", body?: any) =>
    body && !path.endsWith("/preview")
      ? managementRequest(employee.id, "/api/admin/access" + path, body)
      : apiRequest(path, body);
  const submitSensitiveAction=async()=>{
    if(!sensitiveAction||busy||!user?.id||!can('access.sessions')||!why.trim()||
      (sensitiveAction==='password'&&password.length<8))return;
    const action=sensitiveAction;
    setBusy(true);setErr('');
    try{
      await api('/users/'+user.id+'/'+action,action==='sessions'?{reason:why}:
        {temporaryPassword:password,reason:why,revision:user.revision});
      if(action==='password'){setPassword('');setUser({...user,revision:user.revision+1});}
      setNotice(action==='sessions'?t('Sessions revoked.','Sesi dicabut.','会话已撤销。'):
        t('Password reset; sessions revoked.','Kata sandi direset; sesi dicabut.','密码已重置，会话已撤销。'));
    }catch(e){setErr((e as Error).message);}
    finally{setSensitiveAction(undefined);setBusy(false);}
  };
  const load = async () => {
    setErr("");
    try {
      setData(await api());
      setReadDenied(false);
      setSavedReadFailed(false);
      return true;
    } catch (e) {
      const failure=e as Error&{status?:number};
      if(failure.status===401||failure.status===403){setReadDenied(true);setData(null);resetEditor();}
      setErr(failure.message);
      return false;
    }
  };
  useEffect(()=>{const refresh=()=>{void load();};window.addEventListener('uper-lark-changed',refresh);return()=>window.removeEventListener('uper-lark-changed',refresh);},[employee.id]);
  const operationResolved = (receipt:Parameters<NonNullable<React.ComponentProps<typeof AccessOperationStatus>['onResolved']>>[0]) => {
    const editorPath=user?'/users'+(user.id?'/'+user.id:''):role?'/roles/'+role.id:undefined;
    if(receipt.state==='committed'&&receipt.operationId===pendingSaveId.current&&editorPath&&receipt.url==='/api/admin/access'+editorPath&&
      (user?receipt.body?.user?.id:typeof receipt.body?.revision==='number')){
      void finishSave(receipt.body);
      return true;
    }
    setErr("");
    void api()
      .then((current) => {
        setData(current);
        if (role) setLatest(current.roles.find((r: Role) => r.id === role.id));
        else if (user)
          setLatest(
            current.users.find((u: User) =>
              user.id
                ? u.id === user.id
                : u.loginId.toLowerCase() === user.loginId.toLowerCase(),
            ),
          );
      })
      .catch((e) => setErr(e.message));
    window.dispatchEvent(new Event("uper-access-changed"));
  };
  useEffect(() => {
    if (can("access.read")) void load();
  }, [employee.id]);

  useEffect(() => {
    if (tab === "audit" && can("access.audit"))
      api("/audit")
        .then(setAudit)
        .catch((e) => setErr(e.message));
  }, [tab]);
  const recoveryView=tab==='restore-review';
  const editorHasDraft = Boolean(user || role) && (dirty || larkDirty || why.length > 0 || password.length > 0);
  const refreshAccess = async () => {
    if (refreshing.current || busy || editorHasDraft) return;
    refreshing.current = true;
    setIsRefreshing(true);
    setErr("");
    try {
      await Promise.all([
        load(),
        tab === "audit" && can("access.audit") ? api("/audit").then(setAudit) : undefined,
      ]);
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      refreshing.current = false;
      setIsRefreshing(false);
    }
  };
  useEffect(() => {
    const protect = (e: BeforeUnloadEvent) => {
      if (editorHasDraft||recoveryDraft||recoveryBusy||integrationDraft||integrationBusy) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [editorHasDraft,recoveryDraft,recoveryBusy,integrationDraft,integrationBusy]);
  const close = () => {
    if (busy) return;
    if (editorHasDraft) {
      setDiscarding(true);
      return;
    }
    resetEditor();
  };
  const resetEditor = () => {
    pendingSaveId.current=undefined;
    setLarkDirty(false);
    setLarkDraft(undefined);
    setLarkValidation("");
    setDiscarding(false);
    setUser(null);
    setRole(null);
    setPassword("");
    setDirty(false);
    setPreview(null);
    setWhy("");
    setImpact(null);
  };
  const recordHref=(module:string,id='',assignedRole?:string)=>{
    const params=new URLSearchParams({tab:module});
    if(id)params.set(module==='users'?'user':'role',id);
    if(assignedRole)params.set('assignedRole',assignedRole);
    return '/system?'+params;
  };
  const applyLocation=(href:string)=>{
    const {tab:nextTab,params,href:canonical}=systemLocation(href,employee.id);
    if(href!==canonical)window.history.replaceState(window.history.state,'',canonical);
    setTab(nextTab);
    setIntegrationTopic(resolveIntegrationTopic(params.get('credentialTopic')));
    setMailView(params.get('mailView')==='pool'?'pool':'accounts');
    setMailRecordId(params.get(params.get('mailView')==='pool'?'mailPool':'mailAccount')??'');
    setMailReturnPool(params.get('mailFromPool')??'');
    setRecordId(nextTab==='users'?params.get('user')||'':nextTab==='roles'?params.get('role')||'':'');
    setRoleFilter(params.get('assignedRole')||'');
    setShowRecords(false);
    locationRef.current=canonical;
  };
  const proceedNavigation=(href:string)=>{
    if(href===locationRef.current)return;
    window.history.pushState(window.history.state,'',href);
    applyLocation(href);
  };
  const requestNavigation=(action:()=>void)=>{
    if(busy||recoveryBusy||integrationBusy)return;
    if(editorHasDraft||recoveryDraft||integrationDraft){pendingNavigation.current=action;setDiscarding(true);return;}
    if(user||role)resetEditor();
    action();
  };
  const navigateIntegrationTopic=(next:IntegrationTopic)=>{
    if(next!==integrationTopic)proceedNavigation('/system?tab=credentials&credentialTopic='+next);
  };
  const navigateRecord=(module:string,id:string,assignedRole?:string)=>{
    if(!recordId&&id&&module===tab){
      listPosition.current={module,id,top:window.scrollY};
    }
    requestNavigation(()=>{
      if(assignedRole)setFilters(old=>({...old,users:{query:'',status:''}}));
      proceedNavigation(recordHref(module,id,assignedRole??(module==='users'&&tab==='users'?roleFilter:'')));
    });
  };
  const openRecord=(event:MouseEvent<HTMLElement>,module:string,id:string,assignedRole?:string)=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
    event.preventDefault();
    navigateRecord(module,id,assignedRole);
  };
  useEffect(()=>{
    const onPop=()=>{
      const destination=window.location.pathname+window.location.search;
      if(destination===locationRef.current)return;
      if(tab==='credentials'&&systemLocation(destination,employee.id).tab==='credentials'){
        applyLocation(destination);
      }else if(editorHasDraft||busy||recoveryDraft||recoveryBusy||integrationDraft||integrationBusy){
        window.history.pushState(window.history.state,'',locationRef.current);
        requestNavigation(()=>{window.history.replaceState(window.history.state,'',destination);applyLocation(destination);});
      }else requestNavigation(()=>applyLocation(destination));
    };
    window.addEventListener('popstate',onPop);
    return ()=>window.removeEventListener('popstate',onPop);
  },[editorHasDraft,busy,recoveryDraft,recoveryBusy,integrationDraft,integrationBusy,user,role,tab,employee.id]);
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>{
      if(recordId){recordHeading.current?.focus({preventScroll:true});return;}
      const position=listPosition.current;
      if(position?.module===tab){
        window.scrollTo({top:position.top,behavior:'instant'});
        const entry=[...document.querySelectorAll<HTMLElement>('[data-access-record]')].find(el=>el.dataset.accessRecord===position.id);
        (entry??listSearch.current)?.focus({preventScroll:true});
        listPosition.current=undefined;
      }
    });
    return ()=>cancelAnimationFrame(frame);
  },[recordId,tab,Boolean(data)]);
  const openUser = (u: User | null) => {
    setLarkDirty(false);setLarkDraft(undefined);
    setDiscarding(false);
    setLatest(null);
    setRole(null);
    setUser(
      u
        ? { ...u }
        : {
            id: "",
            loginId: "",
            email: "",
            displayName: "",
            roles: [],
            active: true,
            revision: 0,
          },
    );
    setWhy("");
    setErr("");
    setNotice("");
    setDirty(false);
    setPassword("");
    setImpact(null);
    if (u)
      api("/users/" + u.id + "/impact")
        .then(setImpact)
        .catch((e) => setErr(e.message));
  };
  const openRole = (r: Role | null) => {
    setLatest(null);
    setUser(null);
    setRole(
      r
        ? structuredClone(r)
        : {
            id: "",
            revision: 0,
            enabled: true,
            config: {
              names: ["", "", ""],
              description: ["", "", ""],
              grants: {},
            },
          },
    );
    setWhy("");
    setErr("");
    setNotice("");
    setPreview(null);
    setDirty(false);
  };
  const changeRole = (next: Role) => {
    setRole(next);
    setDirty(true);
    setPreview(null);
  };
  const finishSave = async (result:{user?:Omit<User,'effective'>;revision?:number;signInRequired?:boolean}={}) => {
    setNotice("");
    if(user){
      const savedUser=result.user;
      if(savedUser){
        setData(previous=>previous&&{...previous,users:previous.users.map(row=>
          row.id===savedUser.id?{...row,...savedUser}:row)});
        if(!user.id)proceedNavigation(recordHref('users',savedUser.id,roleFilter));
      }
      if(user.id)setSignInNoticeUserId(result.signInRequired===true?user.id:null);
    }else if(role&&typeof result.revision==='number'){
      const savedRole={...role,revision:result.revision};
      setData(previous=>previous&&{...previous,roles:previous.roles.some(row=>row.id===role.id)
        ?previous.roles.map(row=>row.id===role.id?savedRole:row):[...previous.roles,savedRole]});
      if(!recordId)proceedNavigation(recordHref('roles',role.id));
    }
    resetEditor();
    setLatest(null);
    if(!await load())setSavedReadFailed(true);
    window.dispatchEvent(new Event("uper-access-changed"));
  };
  const save = async () => {
    if (busy) return;
    if(larkDirty && !larkDraft){setLarkValidation(t("Look up the Lark identity first, or clear the input.","Cari identitas Lark dahulu atau kosongkan input.","请先查询核对Lark身份，或清空查询输入。"));return;}
    setLarkValidation("");
    const missing=panel.current&&firstMissingAdminField(panel.current);
    if(missing){missing.focus();setErr('admin_required_missing');return;}
    setBusy(true);
    setSaving(true);
    setErr("");
    const path=user?'/users'+(user.id?'/'+user.id:''):role?'/roles/'+role.id:undefined;
    const operationUrl='/api/admin/access'+path;
    const previousOperation=pendingAccessOperations(employee.id).find(operation=>operation.url===operationUrl);
    try {
      let result;
      if (user) {
        result=await api(user.id ? "/users/" + user.id : "/users", {
          ...user,
          reason: why,
          temporaryPassword: password,
          ...(larkDraft?{larkBinding:larkDraft}:{}),
        });
      } else if (role) {
        if (!preview) throw Error("access_preview_required");
        result=await api("/roles/" + role.id, { ...role, reason: why });
      }
      await finishSave(result);
    } catch (e) {
      if(!previousOperation){
        pendingSaveId.current=pendingAccessOperations(employee.id).find(operation=>operation.url===operationUrl)?.operationId;
      }
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      setSaving(false);
    }
  };
  const hasPendingResult=err!==""&&pendingAccessOperations(employee.id).some(operation=>operation.url.startsWith("/api/admin/access/"));
  const errorText =
    err === "admin_required_missing" ? t("Complete the required fields.","Lengkapi kolom wajib.","请填写必填项。") : err === "access_preview_required"
      ? t(
          "Preview the role impact before saving.",
          "Pratinjau dampak peran sebelum menyimpan.",
          "请先预览角色变更影响，再保存。",
        )
      : accessError(err, lang);
  const scopeLabel = (scope: string, permission?: string) =>
    permission === "crm.claim"
      ? t(
          "Shared unassigned pool",
          "Kumpulan pelanggan tanpa penanggung jawab",
          "共享未分配客户池",
        )
      : scope === "all"
        ? t("All", "Semua", "全部")
        : t("Own", "Sendiri", "本人");
  const modules: Record<string, [string, string, string]> = {
    crm: ["Customers & follow-up", "Pelanggan & tindak lanjut", "客户及跟进"],
    operations: [
      "Sales operations & notifications",
      "Operasional penjualan & notifikasi",
      "销售运营及通知",
    ],
    cms: ["Website content", "Konten situs", "网站内容"],
    hr: ["Recruitment", "Rekrutmen", "招聘"],
    system: ["Access administration", "Administrasi akses", "权限管理"],
  };
  const auditLabels: Record<string, [string, string, string]> = {
    "access.integration.set": ["Credential setup checked","Pengaturan kredensial diperiksa","已记录凭证设置核验"],
    "access.integration.stage": ["Credential candidate saved","Kredensial calon disimpan","候选凭证已保存"],
    "access.integration.import": ["Legacy credential imported","Kredensial lama diimpor","已导入旧凭证"],
    "access.integration.verify": ["Credential verification recorded","Verifikasi kredensial dicatat","已记录凭证核验"],
    "access.integration.activate": ["Credential activated","Kredensial diaktifkan","凭证已启用"],
    "access.integration.revoke": ["Credential revoked","Kredensial dicabut","凭证已撤销"],
    "access.integration.lark_settings": ["Lark application settings saved","Pengaturan aplikasi Lark disimpan","已保存 Lark 应用设置"],
    "access.integration.delegate": ["Credential operators updated","Operator kredensial diperbarui","凭证操作人已更新"],
    "ai.configuration": ["AI model configuration", "Konfigurasi model AI", "AI模型配置"],
    "access.recovery.emergency_authorize": [
      "Emergency recovery authorization recorded",
      "Persetujuan pemulihan darurat dicatat",
      "应急恢复授权已记录",
    ],
    "access.recovery.authorize": [
      "Recovery authorization issued",
      "Izin pemulihan diterbitkan",
      "恢复授权已签发",
    ],
    "access.recovery.closed": [
      "Uncommitted recovery closed",
      "Pemulihan belum tersimpan ditutup",
      "未提交恢复已关闭",
    ],
    "access.operation.closed": [
      "Uncommitted operation closed",
      "Operasi belum tersimpan ditutup",
      "未提交操作已关闭",
    ],
    "access.handover.required": [
      "Staff handover required",
      "Serah terima staf diperlukan",
      "需要人员交接",
    ],
    "access.handover.update": [
      "Staff handover updated",
      "Serah terima staf diperbarui",
      "人员交接已更新",
    ],
    "access.restore.bootstrap_administrator": [
      "Restore administrator password initialized",
      "Kata sandi administrator pemulihan disiapkan",
      "已设置恢复复核管理员的临时密码",
    ],
    "access.restore.review": [
      "Restored authorization reviewed",
      "Izin hasil pemulihan ditinjau",
      "恢复授权已复核",
    ],
    "access.restore.release": [
      "Restore review released",
      "Tinjauan pemulihan diselesaikan",
      "恢复复核已放行",
    ],
    "access.recovery": [
      "Offline administrator recovery",
      "Pemulihan administrator luring",
      "离线管理员恢复",
    ],
    "access.teamless.role": [
      "Retired team permissions reviewed",
      "Izin tim lama ditinjau",
      "历史团队授权复核",
    ],
    "access.bootstrap": [
      "Access initialization",
      "Inisialisasi akses",
      "权限初始化",
    ],
    "access.user.create": ["User created", "Pengguna dibuat", "新增用户"],
    "access.user.update": [
      "User access updated",
      "Akses pengguna diperbarui",
      "更新用户权限",
    ],
    "access.role.update": ["Role updated", "Peran diperbarui", "更新角色"],
    "access.sessions.revoke": ["Sessions revoked", "Sesi dicabut", "撤销会话"],
    "access.password.reset": [
      "Password reset",
      "Kata sandi direset",
      "重置密码",
    ],
  };
  const roleOptions = (data?.roles || []).map((r) => ({
    value: r.id,
    label: r.config.names[col],
    disabled: !r.enabled && !user?.roles.includes(r.id),
  }));
  const draftAccess =
    user && data
      ? projectEmployee(
          {
            id: user.id,
            display_name: user.displayName,
            roles: user.roles,
            active: user.active,
          },
          data.roles,
        )
      : null;
  const priorAccess = data?.users.find((u) => u.id === user?.id)?.effective;
  const accessTitle=t("Users & access","Pengguna & akses","用户与权限");
  const accessNav=[
    ['users',t('Users','Pengguna','用户')],
    ['roles',t('Roles','Peran','角色')],
    ...(can('access.audit')?[['audit',t('Change audit','Audit perubahan','变更审计')]]:[]),
  ];
  const userTab=tab==='users';
  const recordTab=(userTab||tab==='roles')&&can('access.read')&&!readDenied;
  const listTitle=userTab?t('Users','Pengguna','用户'):t('Roles','Peran','角色');
  const searchLabel=userTab?t('Find a user','Cari pengguna','查找用户'):t('Find a role','Cari peran','查找角色');
  const nameLabel=t('Name','Nama','名称');
  const idLabel=userTab?t('Login ID','ID login','登录 ID'):t('Role ID','ID peran','角色 ID');
  const emailLabel=t('Login email','Email login','登录邮箱');
  const rolesLabel=t('Roles','Peran','角色');
  const statusLabel=t('Status','Status','状态');
  const larkLabel=t('Lark binding','Koneksi Lark','Lark 绑定');
  const permissionCountLabel=t('Permissions','Izin','权限项数');
  const activeLabel=t('Enabled','Aktif','已启用');
  const inactiveLabel=t('Disabled','Nonaktif','已停用');
  const roleName=(id:string)=>data?.roles.find(r=>r.id===id)?.config.names[col]||id;
  const recordName=(r:User|Role)=>'loginId' in r?r.displayName||r.loginId:r.config.names[col]||r.id;
  const recordMeta=(r:User|Role)=>'loginId' in r?r.loginId:r.id;
  const recordActive=(r:User|Role)=>'loginId' in r?r.active:r.enabled;
  const recordStatus=(r:User|Role)=><AdminStatus active={recordActive(r)}>{recordActive(r)?activeLabel:inactiveLabel}</AdminStatus>;
  const bindingStatus=(u:User)=>u.larkBound?t('Bound','Terhubung','已绑定'):t('Not bound','Belum terhubung','未绑定');
  const allRecords=userTab?data?.users??[]:data?.roles??[];
  const selectedRecord=allRecords.find(r=>r.id===recordId);
  const searchTerm=query.trim().toLowerCase();
  const records=[...allRecords].filter(r=>{
    const terms='loginId' in r?[r.displayName,r.loginId,r.email]:[r.id,...r.config.names];
    return terms.some(term=>term?.toLowerCase().includes(searchTerm)) &&
      (!statusFilter || recordActive(r)===(statusFilter==='active')) &&
      (!userTab || !roleFilter || ('loginId' in r && r.roles.includes(roleFilter)));
  }).sort((a,b)=>userTab?Number(b.id===employee.id)-Number(a.id===employee.id):0);
  const recordListState=err?'error':data?'empty':'loading';
  const recordLayout=useAdminRecordSidebarLayout({id:'access-records',lang,persistent:wide,
    listOpen:showRecords,setListOpen:setShowRecords,
    back:{label:userTab?t('Back to users','Kembali ke pengguna','返回用户列表'):t('Back to roles','Kembali ke peran','返回角色列表'),
      href:recordHref(tab,'',userTab?roleFilter:undefined),onClick:event=>openRecord(event,tab,'')}});
  const searchControl=<AdminSearchField inputRef={listSearch} label={searchLabel} value={query} onChange={setQuery}/>;
  const filterControls=<>
    <AdminSingleSelect lang={lang} isLight={isLight} label={statusLabel} value={statusFilter} onChange={setStatusFilter}
      options={[{value:'',label:t('All statuses','Semua status','全部状态')},{value:'active',label:activeLabel},{value:'inactive',label:inactiveLabel}]}/>
    {userTab&&<AdminSingleSelect lang={lang} isLight={isLight} label={rolesLabel} value={roleFilter} onChange={changeRoleFilter}
      options={[{value:'',label:t('All roles','Semua peran','全部角色')},...(data?.roles??[]).map(r=>({value:r.id,label:roleName(r.id)}))]}/>}
  </>;
  const permissions=(r:User|Role)=>{
    const userRecord='loginId' in r;
    const entries=permissionCatalog.filter(p=>userRecord?r.effective.permissions.includes(p.key):Boolean(r.config.grants[p.key]));
    return <section><h2>{userRecord?t('Effective access','Akses efektif','生效权限'):t('Granted permissions','Izin diberikan','授予权限')}</h2>
      {!entries.length&&<p>{t('No permissions','Tanpa izin','无权限项')}</p>}
      {[...new Set(entries.map(p=>p.module))].map(module=><section key={module} className="access-record-permissions">
        <h3>{modules[module][col]}</h3>
        {userRecord?<AdminListTable className="access-permission-table" label={modules[module][col]}
          headers={[t('Permission','Izin','权限'),t('Effective scope','Cakupan efektif','生效范围'),t('Source roles','Peran sumber','来源角色')]}>
          {entries.filter(p=>p.module===module).map(p=>{
            const sources=data?.roles.filter(role=>r.roles.includes(role.id)&&role.enabled&&r.effective.rolePermissions?.[role.id]?.includes(p.key))??[];
            const scope=p.scoped?(r.effective.grants?.[p.key]??[]).map(value=>scopeLabel(value,p.key)).join(' / ')||'—':activeLabel;
            return <tr key={p.key}><td>{p.names[col]}</td><td>{scope}</td><td>
              {sources.length?<div className="access-permission-sources">
                {sources.map(role=><AdminRowAction key={role.id} href={recordHref('roles',role.id)}
                  onClick={event=>openRecord(event,'roles',role.id)}>{role.config.names[col]}</AdminRowAction>)}
              </div>:'—'}
            </td></tr>;
          })}
        </AdminListTable>:<dl>{entries.filter(p=>p.module===module).map(p=><div key={p.key}>
          <dt>{p.names[col]}</dt>
          <dd>{p.scoped?scopeLabel(r.config.grants[p.key],p.key):activeLabel}</dd>
        </div>)}</dl>}
      </section>)}
    </section>;
  };
  return (
    <div data-admin-form="" className="access-page" data-admin-workspace="system" data-theme={isLight ? "light" : "dark"}>
      <PageMetadata lang={lang} options={{module:tab,state:can("access.read")?undefined:"denied"}}/>
      <a className="admin-skip-link" href="#access-main">
        {t("Skip to workspace", "Lewati ke ruang kerja", "跳到工作区")}
      </a>
      <AdminHeader
        employee={employee}
        workspace="system"
        lang={lang}
        setLang={setLang}
        isLight={isLight}
        toggleTheme={toggleTheme}
        navigation={
          <>
            {[
              ["users", "Users & access", "Pengguna & akses", "用户与权限"],
              ["mail", "Email configuration", "Konfigurasi email", "邮件配置"],
              ["credentials", "Integrations", "Integrasi", "集成配置"],
              ["guide", "Guide", "Panduan", "使用指南"],
              ["test", "Test environment & accounts", "Lingkungan uji & akun", "测试环境和账号"],
            ]
              .filter((a) => a[0] !== "credentials" || isAiAdministrator(employee))
              .filter((a) => a[0] !== "mail" || canUseAccessRecovery(employee))
              .filter((a) => a[0] !== "test" || data?.testDirectoryAvailable)
              .map((a) => {
                const Icon = moduleIcons[a[0] as keyof typeof moduleIcons];
                return (
                  <button
                    type="button"
                    key={a[0]}
                    aria-current={(a[0]==='users'?(isAccessTab(tab)||recoveryView):tab===a[0])?"page":undefined}
                    onClick={()=>{if(a[0]!=='users'||!isAccessTab(tab)){
                      if(a[0]!=='credentials'||tab!=='credentials')navigateRecord(a[0],'');
                    }}}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {a[col + 1]}
                  </button>
                );
              })}
          </>
        }
      />
      <main id="access-main" className="access-main admin-workspace-main" tabIndex={-1}>
        <AccessOperationStatus
          actor={employee.id}
          lang={lang}
          onResolved={operationResolved}
        />
        <AccessSafetyPanel actor={employee} lang={lang} isLight={isLight}
          view={tab==='restore-review'?'review':undefined}
          onReview={()=>navigateRecord('restore-review','')}
          onReturn={()=>requestNavigation(()=>{
            proceedNavigation(recordHref('users'));
          })}
          onDraft={setRecoveryDraft} onBusy={setRecoveryBusy}/>
        {discarding&&!user&&!role&&<CrmDiscardDialog lang={lang} isLight={isLight}
          onKeep={()=>{pendingNavigation.current=undefined;setDiscarding(false);}}
          onDiscard={()=>{
            const action=pendingNavigation.current;
            pendingNavigation.current=undefined;
            setDiscarding(false);
            action?.();
          }}/>}

        {isAccessTab(tab)&&(!recordTab||!recordId)&&<AdminPageHeader
          title={t("Users & access", "Pengguna & akses", "用户与权限")}
          subtitle={tab==='audit'
            ?t('Review changes to employee accounts, roles, and permissions.','Tinjau perubahan akun staf, peran, dan izin.','查询员工账号、角色和权限的变更记录。')
            :tab==='roles'
              ?t('Manage role permissions and preview the impact of changes.','Kelola izin peran dan pratinjau dampak perubahan.','管理角色权限，预览调整对员工的影响。')
              :t('Manage employee accounts and review their effective access.','Kelola akun staf dan tinjau akses yang berlaku.','管理员工账号，核对各账号的生效权限。')}
          actions={can("access.read") && (tab!=='audit'||can('access.audit')) && (
            <AdminDetailActions label={t("Page actions", "Tindakan halaman", "页面操作")}
              secondary={<>
                <AdminRefreshAction label={t("Refresh", "Segarkan", "刷新")}
                loading={isRefreshing} disabled={busy || editorHasDraft}
                onClick={() => void refreshAccess()}/>
              </>}
              primary={recordTab&&can(userTab?'access.users':'access.roles')&&
                <CrmPageAction icon={Plus} variant="primary"
                  label={userTab?t('Add user','Tambah pengguna','新增用户'):t('Add role','Tambah peran','新增角色')}
                  onClick={()=>userTab?openUser(null):openRole(null)}/>}/>
          )}/>}
        {!can("access.read")||readDenied ? (
          <p role="alert">
            {t(
              "System management access denied.",
              "Akses manajemen sistem ditolak.",
              "无系统管理访问权限。",
            )}
          </p>
        ) : (
          <>
            {savedReadFailed&&!user&&!role&&<AdminSavedReadError lang={lang} busy={isRefreshing} onRetry={()=>void refreshAccess()}/>}
            {err && !savedReadFailed && !user && !role && (
              <p role="alert" className="access-error">
                {errorText}
              </p>
            )}
            {notice && !user && !role && (
              <AdminFormFeedback state="saved" lang={lang} placement="floating">{notice}</AdminFormFeedback>
            )}
            {isAccessTab(tab)&&<CrmContentNav label={accessTitle}
              items={accessNav.map(([id,label])=>({href:recordHref(id),label,current:tab===id}))}
              onNavigate={href=>requestNavigation(()=>proceedNavigation(href))}/>}
            {!recoveryView && !recordTab && !data && !err && (
              <p role="status">{t("Loading…", "Memuat…", "加载中…")}</p>
            )}
            {tab === 'test' && data?.testDirectoryAvailable && <TestEnvironmentPanel lang={lang}/>}
            {tab==='credentials'&&(isAiAdministrator(employee)?<IntegrationCredentialsOverview lang={lang} isLight={isLight}
              topic={integrationTopic} onTopicChange={navigateIntegrationTopic} onDraftChange={setIntegrationDraft} onBusyChange={setIntegrationBusy}/>:
              <AdminListState lang={lang} state="denied"/>)}
            {tab==='mail'&&!canUseAccessRecovery(employee)&&<AdminListState lang={lang} state="denied"/>}
            {tab==='mail'&&canUseAccessRecovery(employee)&&<EnrollmentMailWorkspace lang={lang} isLight={isLight} admin allowed
              canManageCredentials={isAiAdministrator(employee)}
              view={mailView} recordId={mailRecordId} returnPoolId={mailReturnPool} onNavigate={href=>requestNavigation(()=>proceedNavigation(href))}
              onDraft={setRecoveryDraft} onBusy={setRecoveryBusy}/>}
            {tab==='guide'&&<SystemAccessGuide lang={lang} canAudit={can('access.audit')}
              canAi={isAiAdministrator(employee)} canTest={!!data?.testDirectoryAvailable}
              shellHeight={shellHeight}
              onNavigate={href=>requestNavigation(()=>proceedNavigation(href))}/>}
            {recordTab && <section className="access-record-workspace crm-detail-root" data-theme={isLight?"light":"dark"} style={{"--crm-shell-height":shellHeight+"px"} as React.CSSProperties} aria-label={listTitle}>
              {!recordId && <div className="access-record-toolbar">
                {searchControl}
                {filterControls}
              </div>}
              {!recordId && records.length>0 && <AdminListTable label={listTitle} busy={isRefreshing}
                headers={userTab?[nameLabel,idLabel,emailLabel,rolesLabel,statusLabel,larkLabel]:
                  [nameLabel,idLabel,statusLabel,permissionCountLabel]}>
                {records.map(r=><tr key={r.id}>
                  <td><AdminRecordEntry data-access-record={r.id} href={recordHref(tab,r.id,userTab?roleFilter:undefined)}
                    onClick={event=>openRecord(event,tab,r.id)}>{recordName(r)}</AdminRecordEntry></td>
                  <td>{recordMeta(r)}</td>
                  {'loginId' in r?<><td>{r.email||'—'}</td><td>{r.roles.map(roleName).join(' · ')||'—'}</td>
                    <td>{recordStatus(r)}</td><td>{bindingStatus(r)}</td></>:
                    <><td>{recordStatus(r)}</td><td>{Object.keys(r.config.grants).length}</td></>}
                </tr>)}
              </AdminListTable>}
              {!recordId&&!records.length&&<AdminListState lang={lang} state={recordListState} onRetry={refreshAccess}/>}
              {recordId&&<div className="access-record-split" data-record-detail="true" data-record-scroll={scrollMode}>
                {recordLayout.listNavigation}
                <AdminRecordSidebar {...recordLayout.sidebar} title={listTitle} count={records.length} selectedId={recordId}
                  busy={isRefreshing} busyLabel={t('Refreshing…','Memuat ulang…','正在刷新…')}
                  filters={<AdminRecordFilters lang={lang} count={Number(Boolean(statusFilter))+Number(userTab&&Boolean(roleFilter))}
                    search={<AdminSearchField label={searchLabel} value={query} onChange={setQuery}/>}>{filterControls}</AdminRecordFilters>}
                  note={selectedRecord&&!records.includes(selectedRecord)?t('The open record is outside the current filters.','Rekaman terbuka di luar filter saat ini.','当前记录不在筛选结果中，详情仍保留。'):undefined}
                  empty={!records.length?<AdminListState lang={lang} compact state={recordListState} onRetry={refreshAccess}/>:undefined}>
                  {records.map(r=><AdminRecordRow key={r.id} selected={recordId===r.id} name={recordName(r)} title={recordName(r)}
                    href={recordHref(tab,r.id,userTab?roleFilter:undefined)} onClick={event=>openRecord(event,tab,r.id)}
                    meta={<span className="access-record-sidebar-meta">
                      <span className="access-record-sidebar-id" title={recordMeta(r)}>{recordMeta(r)}</span>
                      {recordStatus(r)}
                    </span>}/>)}
                </AdminRecordSidebar>
                <article className="crm-detail-panel access-record-detail" hidden={recordLayout.listOnly}>
                  <AdminRecordHeader back={recordLayout.headerBack}
                    title={<AdminRecordTitle title={selectedRecord?recordName(selectedRecord):listTitle} titleRef={recordHeading}
                      status={selectedRecord&&recordStatus(selectedRecord)} meta={selectedRecord&&recordMeta(selectedRecord)}/>}
                    actions={<AdminDetailActions label={t('Record actions','Tindakan rekaman','记录操作')}
                      secondary={<>
                        {recordLayout.browseAction}
                        <AdminRefreshAction label={t('Refresh','Segarkan','刷新')} loading={isRefreshing} disabled={busy||editorHasDraft} onClick={()=>void refreshAccess()}/>
                      </>}
                      primary={selectedRecord&&('loginId' in selectedRecord
                        ?(can('access.users')||can('access.sessions'))&&<CrmPageAction icon={Pencil} variant="primary"
                          label={can('access.users')?t('Edit user','Edit pengguna','编辑用户'):t('Manage sessions and password','Kelola sesi dan sandi','管理会话与密码')}
                          onClick={()=>openUser(selectedRecord)}/>
                        :can('access.roles')&&<CrmPageAction icon={Pencil} variant="primary" label={t('Edit role','Edit peran','编辑角色')}
                          onClick={()=>openRole(selectedRecord)}/>)}/>}/>
                  <div className="crm-detail-body access-record-body" data-admin-scroll="detail" tabIndex={0} onKeyDown={containPaneKeys}>
                    {signInNoticeUserId&&signInNoticeUserId===selectedRecord?.id&&<div className="access-user-signin">
                      <AdminFormFeedback state="saved" lang={lang}>{t('This user needs to sign in again.','Pengguna ini perlu masuk kembali.','该用户需要重新登录。')}</AdminFormFeedback>
                      <button type="button" onClick={()=>setSignInNoticeUserId(null)}>{t('Dismiss','Tutup','关闭提示')}</button>
                    </div>}
                    {selectedRecord?'loginId' in selectedRecord?<><section>
                      <h2>{t('Account information','Informasi akun','账号信息')}</h2>
                      <dl className="access-record-facts">
                        <div><dt>{emailLabel}</dt><dd>{selectedRecord.email||'—'}</dd></div>
                        <div><dt>{larkLabel}</dt><dd>{bindingStatus(selectedRecord)}</dd></div>
                        <div><dt>{t('Assigned roles','Peran yang ditetapkan','已分配角色')}</dt>
                          <dd>{selectedRecord.roles.length?selectedRecord.roles.map(id=>data?.roles.some(role=>role.id===id)
                            ?<AdminRowAction key={id} href={recordHref('roles',id)} onClick={event=>openRecord(event,'roles',id)}>{roleName(id)}</AdminRowAction>
                            :<span key={id}>{id}</span>):'—'}</dd></div>
                      </dl>
                    </section>{permissions(selectedRecord)}</>:<>
                      <section><h2>{t('Purpose','Kegunaan','职责说明')}</h2><p>{selectedRecord.config.description[col]||'—'}</p>
                        <AdminRowAction href={recordHref('users','',selectedRecord.id)} onClick={event=>openRecord(event,'users','',selectedRecord.id)}>
                          {t('View users assigned this role','Lihat pengguna dengan peran ini','查看分配了此角色的用户')}
                        </AdminRowAction></section>
                      {permissions(selectedRecord)}
                    </>:<AdminListState lang={lang} state={recordListState} onRetry={refreshAccess}
                      message={recordListState==='empty'?t('This record is unavailable.','Rekaman ini tidak tersedia.','此记录已不存在或不可访问。'):undefined}/>}
                  </div>
                </article>
              </div>}
            </section>}
            {tab === "audit" && !can('access.audit') && <p role="alert">
              {t('You do not have access to change audit.','Anda tidak memiliki akses ke audit perubahan.','无变更审计访问权限。')}
            </p>}
            {tab === "audit" && can('access.audit') && (
              <section className="access-card">
                <h2>
                  {t(
                    "Recent access changes",
                    "Perubahan akses terbaru",
                    "近期权限变更",
                  )}
                </h2>
                {audit.length === 0 && (
                  <p>
                    {t(
                      "No changes recorded.",
                      "Belum ada perubahan tercatat.",
                      "暂无变更记录。",
                    )}
                  </p>
                )}
                {audit.map((a) => (
                  <AdminDisclosure key={a.id} density="compact" heading={<>
                    {a.actor} · {formatCrmEventTime(a.created_at)} · {auditLabels[a.action]?.[col] || a.action}
                  </>}>
                    <pre className="admin-disclosure-original">{JSON.stringify(a.data,null,2)}</pre>
                  </AdminDisclosure>
                ))}
              </section>
            )}
          </>
        )}
      </main>
      {(user || role) && (
        <AdminEditor variant="drawer" responsiveForm={!!user} className="access-panel" lang={lang} light={isLight} required
          dialogRef={panel} onClose={close} busy={busy} bodyClassName="access-editor-body"
          title={user?t("User settings","Pengaturan pengguna","用户设置"):t("Role settings","Pengaturan peran","角色设置")}
          footer={<>
              {user?.id && can("access.sessions") && (
                <>
                  <button type="button" disabled={busy||!why.trim()} onClick={()=>setSensitiveAction('sessions')}>
                    {t("Revoke sessions", "Cabut sesi", "撤销会话")}
                  </button>
                  <button type="button" disabled={busy||password.length<8||!why.trim()} onClick={()=>setSensitiveAction('password')}>
                    {t("Reset password", "Reset kata sandi", "重置密码")}
                  </button>
                </>
              )}
              <button type="button" disabled={busy} onClick={close}>{t("Cancel","Batal","取消")}</button>
              <button type="button" data-primary=""
                disabled={
                  busy ||
                  !why.trim() ||
                  (!!user && !can("access.users")) ||
                  (!dirty && !larkDraft) ||
                  (!!role && !preview) ||
                  (!user?.id && !!user && password.length < 8)
                }
                onClick={() => void save()}
              >
                {saving
                  ? t("Saving…", "Menyimpan…", "保存中…")
                  : t("Save changes", "Simpan perubahan", "保存修改")}
              </button>
          </>}
        >
            {discarding && <CrmDiscardDialog lang={lang} isLight={isLight}
              title={t("Unsaved changes", "Perubahan belum disimpan", "修改尚未保存")}
              description={t("Keep editing, or discard your unsaved changes and close. Saved records stay unchanged.", "Lanjutkan mengedit atau buang perubahan yang belum disimpan dan tutup. Data tersimpan tidak berubah.", "可以继续编辑，或放弃未保存的修改并关闭；已保存记录保持不变。")}
              keepLabel={t("Keep editing", "Lanjutkan mengedit", "继续编辑")}
              discardLabel={t("Discard draft and close", "Buang draf dan tutup", "放弃草稿并关闭")}
              onKeep={()=>{pendingNavigation.current=undefined;setDiscarding(false);}} onDiscard={()=>{
                const action=pendingNavigation.current;
                pendingNavigation.current=undefined;
                resetEditor();action?.();
              }} />}
            {sensitiveAction&&user?.id&&<AdminConfirmation light={isLight} busy={busy} danger
              title={sensitiveAction==='sessions'?t('Revoke sessions','Cabut sesi','撤销会话'):t('Reset password','Reset kata sandi','重置密码')}
              description={<>{user.displayName||user.loginId} · {sensitiveAction==='sessions'
                ? t('The employee will need to sign in again on all devices.','Staf perlu masuk lagi di semua perangkat.','该员工需要在所有设备上重新登录。')
                : t('This revokes active sessions. The employee must change the temporary password at the next login.','Tindakan ini mencabut sesi aktif. Staf harus mengubah kata sandi sementara saat masuk berikutnya.','现有会话将失效，员工下次登录时必须修改临时密码。')}</>}
              cancelLabel={t('Cancel','Batal','取消')} confirmLabel={t('Confirm','Konfirmasi','确认')}
              onCancel={()=>setSensitiveAction(undefined)} onConfirm={()=>void submitSensitiveAction()}/>}
            <AccessOperationStatus
              actor={employee.id}
              lang={lang}
              onResolved={operationResolved}
            />
            {saving&&<AdminFormFeedback state="saving" lang={lang}/>}
            {err&&<AdminFormFeedback state={hasPendingResult?'unknown':'error'} lang={lang}>{hasPendingResult&&user?.id?undefined:errorText}</AdminFormFeedback>}
            {larkValidation&&larkDirty&&!larkDraft&&<AdminFormFeedback state="error" lang={lang}>{larkValidation}</AdminFormFeedback>}
            {err && err!=="admin_required_missing" && (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const current = await api();
                    setData(current);
                    setLatest(
                      role
                        ? current.roles.find((r: Role) => r.id === role.id)
                        : current.users.find((u: User) =>
                            user.id
                              ? u.id === user.id
                              : u.loginId.toLowerCase() ===
                                user.loginId.toLowerCase(),
                          ),
                    );
                  } catch (e) {
                    setErr((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t(
                  "Load current record; keep draft",
                  "Muat data terbaru; pertahankan draf",
                  "载入当前记录，保留草稿",
                )}
              </button>
            )}
            {latest && (
              <section className="access-impact">
                <h3>
                  {t(
                    "Current saved version",
                    "Versi tersimpan terbaru",
                    "当前已保存版本",
                  )}
                  ：{latest.revision}
                </h3>
                <p>
                  {role ? latest.config.names[col] : latest.displayName} ·{" "}
                  {latest.enabled === false || latest.active === false
                    ? t("Disabled", "Nonaktif", "已停用")
                    : t("Active", "Aktif", "已启用")}
                </p>
                {role ? (
                  <ul>
                    {permissionCatalog
                      .filter((p) => latest.config.grants[p.key])
                      .map((p) => (
                        <li key={p.key}>
                          {p.names[col]} —{" "}
                          {scopeLabel(latest.config.grants[p.key], p.key)}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p>
                    {latest.roles
                      .map(
                        (id: string) =>
                          data?.roles.find((r) => r.id === id)?.config.names[
                            col
                          ] || id,
                      )
                      .join(" · ")}{" "}
                  </p>
                )}
                <button
                  disabled={busy}
                  onClick={() => {
                    if (role) {
                      setRole({ ...role, revision: latest.revision });
                      setPreview(null);
                    } else {
                      setUser({
                        ...user,
                        id: latest.id,
                        revision: latest.revision,
                      });
                      setPassword("");
                    }
                    setDirty(true);
                    setLatest(null);
                    setErr("");
                  }}
                >
                  {t(
                    "Use this version; retain and review draft",
                    "Gunakan versi ini; pertahankan dan tinjau draf",
                    "采用此版本，保留并核对草稿",
                  )}
                </button>
              </section>
            )}
            {notice&&<AdminFormFeedback state="saved" lang={lang}>{notice}</AdminFormFeedback>}
            {user && (
              <AdminFormSection title={t("User details", "Detail pengguna", "用户信息")}>
                <AdminFormGrid>
                  <AdminField>
                    {t("Login ID", "ID login", "登录ID")}
                    <input
                      required={!user.id}
                      value={user.loginId}
                      disabled={!!user.id}
                      onChange={(e) => {
                        setUser({ ...user, loginId: e.target.value });
                        setDirty(true);
                      }}
                    />
                  </AdminField>
                  <AdminField>
                    {t("Name", "Nama", "姓名")}
                    <input
                      disabled={!can("access.users")}
                      required
                      value={user.displayName}
                      onChange={(e) => {
                        setUser({ ...user, displayName: e.target.value });
                        setDirty(true);
                      }}
                    />
                  </AdminField>
                </AdminFormGrid>
                <AdminField>
                  {t(
                    "Login email (optional)",
                    "Email login (opsional)",
                    "登录邮箱（可选）",
                  )}
                  <input
                    type="email"
                    maxLength={254}
                    autoComplete="off"
                    disabled={!can("access.users")}
                    value={user.email || ""}
                    onChange={(e) => {
                      setUser({ ...user, email: e.target.value });
                      setDirty(true);
                    }}
                  />
                  <small>
                    {t(
                      "Use this email or Login ID with the same password. It must be unique; leave blank to use Login ID only.",
                      "Gunakan email ini atau ID login dengan kata sandi yang sama. Email harus unik; kosongkan untuk memakai ID login saja.",
                      "可使用此邮箱或登录ID配合同一密码登录。邮箱不可重复，留空则仅使用登录ID。",
                    )}
                  </small>
                </AdminField>
                <AdminSingleSelect
                  label={t("Roles", "Peran", "角色")}
                  footer={() => (
                    <button
                      type="button"
                      onClick={() => {
                        setUser({ ...user, roles: [] });
                        setDirty(true);
                      }}
                    >
                      {t(
                        "Clear role selection",
                        "Hapus pilihan peran",
                        "清空角色选择",
                      )}
                    </button>
                  )}
                  value=""
                  values={user.roles}
                  disabled={!can("access.users")}
                  multiple
                  searchable
                  options={roleOptions}
                  onChange={() => {}}
                  onValuesChange={(values) => {
                    setUser({ ...user, roles: values });
                    setDirty(true);
                  }}
                  lang={lang}
                  isLight={isLight}
                  emptyLabel={t("Select roles", "Pilih peran", "选择角色")}
                />
                <AdminField>
                  <input
                    type="checkbox"
                    checked={user.active}
                    disabled={!can("access.users")}
                    onChange={(e) => {
                      setUser({ ...user, active: e.target.checked });
                      setDirty(true);
                    }}
                  />
                  {t("Account enabled", "Akun aktif", "启用账号")}
                </AdminField>
                {draftAccess && (
                  <section className="access-impact" aria-live="polite">
                    <h3>
                      {t(
                        "Access after this change",
                        "Akses setelah perubahan",
                        "本次修改后的权限",
                      )}
                    </h3>
                    <p>
                      {user.active
                        ? t("Account enabled", "Akun aktif", "账号启用")
                        : t(
                            "Account disabled; sign-in blocked",
                            "Akun nonaktif; login diblokir",
                            "账号停用，无法登录",
                          )}
                    </p>
                    <p>
                      {draftAccess.permissions.length}{" "}
                      {t(
                        "permissions from enabled roles",
                        "izin dari peran aktif",
                        "项启用角色授予的权限",
                      )}
                    </p>
                    <ul>
                      {permissionCatalog
                        .filter(
                          (p) =>
                            JSON.stringify(
                              priorAccess?.grants?.[p.key] || [],
                            ) !==
                            JSON.stringify(draftAccess.grants?.[p.key] || []),
                        )
                        .map((p) => (
                          <li key={p.key}>
                            {p.names[col]}：
                            {(priorAccess?.grants?.[p.key] || [])
                              .map((s) => scopeLabel(s, p.key))
                              .join(" / ") || "—"}
                            {" → "}
                            {(draftAccess.grants?.[p.key] || [])
                              .map((s) => scopeLabel(s, p.key))
                              .join(" / ") || "—"}
                          </li>
                        ))}
                    </ul>
                    <small>
                      {t(
                        "Role changes revoke active sessions. Existing customer ownership and tasks are retained.",
                        "Perubahan peran mencabut sesi aktif. Kepemilikan pelanggan dan tugas tetap dipertahankan.",
                        "角色修改会撤销现有会话。客户归属及任务仍然保留。",
                      )}
                    </small>
                  </section>
                )}
                {impact && (
                  <p role="status">
                    {t(
                      "Existing ownership is retained",
                      "Kepemilikan lama dipertahankan",
                      "现有归属保留",
                    )}
                    ：{impact.customerCount}{" "}
                    {t("customers", "pelanggan", "位客户")} · {impact.taskCount}{" "}
                    {t(
                      "unfinished tasks",
                      "tugas belum selesai",
                      "项未完成任务",
                    )}
                  </p>
                )}
                {(!user.id || can("access.sessions")) && (
                  <AdminField>
                    {user.id
                      ? t(
                          "New password for reset",
                          "Kata sandi baru untuk reset",
                          "重置后的新密码",
                        )
                      : t("Initial password", "Kata sandi awal", "初始密码")}
                    <input
                      type="password"
                      autoComplete="new-password"
                      required={!user.id}
                      value={password}
                      minLength={8}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (!user.id) setDirty(true);
                      }}
                    />
                    <small>
                      {t(
                        "Passwords are never returned or recorded in audit.",
                        "Kata sandi tidak dikembalikan atau dicatat di audit.",
                        "密码不会返回或记入审计。",
                      )}
                    </small>
                  </AdminField>
                )}
              </AdminFormSection>
            )}
            {user?.id && can("access.users") && (
              <AdminFormSection title={t("Lark account", "Akun Lark", "Lark账号")}>
                <LarkEmployeeBinding key={user.id} employeeId={user.id} lang={lang} isLight={isLight} onDraftChange={setLarkDirty} onBindingDraft={setLarkDraft} disabled={busy} />
              </AdminFormSection>
            )}
            {role && (
              <AdminFormSection title={t("Role details", "Detail peran", "角色信息")}>
                <AdminField>
                  {t("Stable role ID", "ID peran tetap", "稳定角色ID")}
                  <input
                    disabled={role.revision > 0}
                    required={role.revision===0}
                    value={role.id}
                    onChange={(e) =>
                      changeRole({ ...role, id: e.target.value })
                    }
                  />
                </AdminField>
                {["names", "description"].map((field) => (
                  <div key={field} className="access-languages" data-admin-grid="">
                    {["English", "Bahasa Indonesia", "中文"].map(
                      (language, i) => (
                        <AdminField key={language}>
                          {field === "names"
                            ? t("Role name", "Nama peran", "角色名称")
                            : t("Description", "Deskripsi", "职责说明")}{" "}
                          · {language}
                          <input
                            required={field==="names"}
                            value={
                              role.config[field as "names" | "description"][i]
                            }
                            onChange={(e) => {
                              const values = [
                                ...role.config[
                                  field as "names" | "description"
                                ],
                              ] as [string, string, string];
                              values[i] = e.target.value;
                              changeRole({
                                ...role,
                                config: { ...role.config, [field]: values },
                              });
                            }}
                          />
                        </AdminField>
                      ),
                    )}
                  </div>
                ))}
                <AdminField>
                  <input
                    type="checkbox"
                    checked={role.enabled}
                    onChange={(e) =>
                      changeRole({ ...role, enabled: e.target.checked })
                    }
                  />
                  {t("Role enabled", "Peran aktif", "启用角色")}
                </AdminField>
                {permissionCatalog.map((p, index) => (
                  <Fragment key={p.key}>
                    {(index === 0 ||
                      permissionCatalog[index - 1].module !== p.module) && (
                      <h3>{modules[p.module][col]}</h3>
                    )}
                    <div className="access-permission">
                      <AdminField>
                        <input
                          type="checkbox"
                          checked={!!role.config.grants[p.key]}
                          onChange={(e) => {
                            const grants = { ...role.config.grants };
                            if (e.target.checked)
                              grants[p.key] =
                                p.key === "crm.own"
                                  ? "own"
                                  : p.key === "crm.claim"
                                    ? "all"
                                    : p.scoped
                                      ? "own"
                                      : "all";
                            else delete grants[p.key];
                            changeRole({
                              ...role,
                              config: { ...role.config, grants },
                            });
                          }}
                        />
                        {p.names[col]}
                      </AdminField>
                      {p.scoped && role.config.grants[p.key] && (
                        <AdminSingleSelect
                          label={t("Data scope", "Cakupan data", "数据范围")}
                          value={role.config.grants[p.key]}
                          options={
                            p.key === "crm.claim"
                              ? [
                                  {
                                    value: "all",
                                    label: scopeLabel("all", p.key),
                                  },
                                ]
                              : [
                                  { value: "own", label: scopeLabel("own") },
                                  { value: "all", label: scopeLabel("all") },
                                ]
                          }
                          onChange={(value) =>
                            changeRole({
                              ...role,
                              config: {
                                ...role.config,
                                grants: {
                                  ...role.config.grants,
                                  [p.key]: value as AccessScope,
                                },
                              },
                            })
                          }
                          lang={lang}
                          isLight={isLight}
                        />
                      )}
                    </div>
                  </Fragment>
                ))}
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setErr("");
                    try {
                      const d = await api("/roles/preview", { ...role });
                      setPreview(d.affected);
                    } catch (e) {
                      setErr((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t("Preview impact", "Pratinjau dampak", "预览影响")}
                </button>
                {preview && (
                  <section className="access-impact">
                    <h3>
                      {t("Affected staff", "Staf terdampak", "受影响员工")}：
                      {preview.length}
                    </h3>
                    {preview.map((p) => (
                      <div key={p.user.id}>
                        <strong>{p.user.displayName}</strong>
                        {permissionCatalog
                          .filter(
                            (entry) =>
                              JSON.stringify(
                                p.before.grants?.[entry.key] || [],
                              ) !==
                              JSON.stringify(p.after.grants?.[entry.key] || []),
                          )
                          .map((entry) => (
                            <p key={entry.key}>
                              {entry.names[col]}：
                              {(p.before.grants?.[entry.key] || [])
                                .map((scope) => scopeLabel(scope, entry.key))
                                .join(", ") || "—"}{" "}
                              →{" "}
                              {(p.after.grants?.[entry.key] || [])
                                .map((scope) => scopeLabel(scope, entry.key))
                                .join(", ") || "—"}
                            </p>
                          ))}
                      </div>
                    ))}
                  </section>
                )}
              </AdminFormSection>
            )}
            <AdminField>
              {t("Change reason", "Alasan perubahan", "变更原因")}
              <textarea
                required
                value={why}
                maxLength={500}
                onChange={(e) => setWhy(e.target.value)}
              />
            </AdminField>
        </AdminEditor>
      )}
    </div>
  );
}
