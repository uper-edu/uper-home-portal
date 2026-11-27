import './admin-workspace-base.css';
import {AdminAccountMenu} from './admin/AdminAccountMenu';
import {AdminLoginView} from './admin/AdminLoginView';
import {validStaffPassword} from '../utils/staffPassword';
import {AdminField,AdminRequiredNote,AdminForm} from './AdminForm';
import {PageMetadata} from './PageMetadata';
import {managementRequest,clearAccessPasswords} from "../utils/accessOperationClient";
import {AccessOperationStatus} from "./AccessOperationStatus";
import {clearStaffDrafts} from "../utils/crmDrafts";
import type {AdminWorkspace} from "../utils/adminWorkspace";
import "./crm/crm-sign-in.css";
import { crmId } from "../utils/crmIndonesian";
import {
  useCrmLanguage,
  crmError,
  type CrmLanguage,
} from "../utils/crmLanguage";
import { createContext, useContext, useEffect, useRef, useState } from "react";
export interface CrmEmployee {
  passwordChangeRequired?: boolean;
  id: string;
  displayName?: string;
  roles: string[];
  permissions: string[];
  scope: string;
  active: boolean;
  teams: string[];
  grants?: Record<string,Array<"own"|"team"|"all">>;
  roleLabels?: Record<string,[string,string,string]>;
  rolePermissions?: Record<string,string[]>;
}
const AccountContext = createContext<{
  employee: CrmEmployee;
  password: () => void;
  logout: () => Promise<void>;
  busy: boolean;
  error: string;
} | null>(null);
export function CrmAccountControls({
  lang,
  isLight,
  workspace,
}: {
  lang: "zh" | "en" | "id";
  isLight: boolean;
  workspace?: AdminWorkspace;
}) {
  const account = useContext(AccountContext);
  if (!account) return null;
  return <AdminAccountMenu employee={account.employee} lang={lang} isLight={isLight} workspace={workspace}
    busy={account.busy} error={account.error} onChangePassword={account.password} onLogout={account.logout}/>;
}
async function auth(path: string, body?: any, signal?: AbortSignal) {
  const r = await fetch("/api/crm/auth/" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal,
  });
  if (!r.ok) {
    const failure=await r.json().catch(()=>null);
    throw Object.assign(Error(failure?.error || "Authentication failed"),{status:r.status});
  }
  return r.json();
}
export default function CrmAccess({
  children,
  workspace = "crm",
}: {
  workspace?: AdminWorkspace;
  children: (
    employee: CrmEmployee,
    lang: CrmLanguage,
    setLang: (value: CrmLanguage) => void,
  ) => React.ReactNode;
}) {
  const [connectionProblem,setConnectionProblem]=useState(false);
  const st=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
  const [lang, setLang] = useCrmLanguage();
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const [employee, setEmployee] = useState<CrmEmployee | null>(null),
    [loading, setLoading] = useState(true),
    [loginId, setLoginId] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [change, setChange] = useState(false),
    [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [confirm, setConfirm] = useState(""),
    [notice, setNotice] = useState("");
  const sessionRead=useRef<AbortController | undefined>(undefined);
  async function checkSession(replace=false) {
    if(sessionRead.current&&!replace)return;
    sessionRead.current?.abort();
    const check=new AbortController();
    sessionRead.current=check;
    try {
      const d=await auth('me',undefined,AbortSignal.any([check.signal,AbortSignal.timeout(12000)]));
      if(check.signal.aborted)return;
      if(typeof d?.employee?.id!=='string'||!d.employee.id)throw Error('Invalid staff session response');
      setEmployee(d.employee);
      setConnectionProblem(false);
    } catch(error) {
      if(check.signal.aborted)return;
      if([401,403].includes((error as {status:number}).status)){
        setEmployee(null);setChange(false);setConnectionProblem(false);
      }else setConnectionProblem(true);
    } finally {
      if(sessionRead.current===check){sessionRead.current=undefined;setLoading(false);}
    }
  }
  useEffect(() => {
    let active=true,scheduled=false;
    const refresh=()=>{
      if(scheduled)return;
      scheduled=true;
      queueMicrotask(()=>{scheduled=false;if(active)void checkSession(true);});
    };
    void checkSession();
    window.addEventListener('uper-access-changed',refresh);
    return ()=>{
      active=false;
      sessionRead.current?.abort();sessionRead.current=undefined;
      window.removeEventListener('uper-access-changed',refresh);
    };
  },[]);
  useEffect(()=>{
    if(!employee)return;
    const timer=setInterval(()=>void checkSession(),60000);
    return ()=>clearInterval(timer);
  }, [employee?.id]);

  async function login() {
    setBusy(true);
    setError("");
    try {
      const d = await auth("login", { loginId, password });
      sessionRead.current?.abort();
      setEmployee(d.employee);
      setConnectionProblem(false);
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full p-3 rounded-lg border border-slate-300 bg-white text-slate-900";
  if (loading)
    return (
      <div className="p-10 text-center"><PageMetadata lang={lang} options={{state:"checking"}}/>
        {t("Checking login…", "正在验证登录…")}
      </div>
    );
  if (!employee)
    return <AdminLoginView workspace={workspace} lang={lang} setLang={setLang} loginId={loginId} password={password}
      error={error} busy={busy} connectionProblem={connectionProblem}
      onLoginIdChange={setLoginId} onPasswordChange={setPassword} onLogin={login} onRetry={()=>void checkSession()}/>;
  return (
    <AccountContext.Provider
      value={{
        employee,
        busy,
        error: change ? "" : error ? crmError(error, lang) : "",
        password: () => {
          setChange(true);
          setError("");
          setNotice("");
        },
        logout: async () => {
          setBusy(true);
          try {
            await auth("logout", {});
            sessionRead.current?.abort();
            clearStaffDrafts(employee.id);clearAccessPasswords(employee.id);
            setEmployee(null);
            setChange(false);
            setCurrent("");
            setNext("");
            setNotice("");
            setError("");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        },
      }}
    >
      {connectionProblem&&<p role="status" className="p-3 border border-amber-500">
        {st('Connection temporarily unavailable. Your workspace and draft remain.','Koneksi sementara tidak tersedia. Ruang kerja dan draf tetap disimpan.','连接暂不可用，工作区和草稿仍保留。')}{' '}
        <button type="button" disabled={busy} className="underline" onClick={()=>void checkSession()}>{st('Retry check','Periksa lagi','重新检查')}</button>
      </p>}
      {!employee.passwordChangeRequired&&children(employee, lang, setLang)}
      {(change||employee.passwordChangeRequired) && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-6">
          <AdminForm lang={lang}
            className="w-full max-w-sm bg-white rounded-2xl p-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if(!validStaffPassword(next,employee.id,current)||next!==confirm){setError('password_policy_required');return;}
              setBusy(true);
              setError("");
              try {
                await managementRequest(employee.id,"/api/crm/auth/password", {
                  currentPassword: current,
                  newPassword: next,
                });
                setCurrent("");
                setNext("");
                setConfirm("");
                await checkSession(true);
                setChange(false);setNotice("password_updated");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <AccessOperationStatus actor={employee.id} lang={lang} onResolved={()=>setError('')}/>
            <h2 className="font-bold">
              <span>{employee.passwordChangeRequired?st("Set a new password","Buat kata sandi baru","设置新密码"):t("Change your password", "修改自己的密码")}</span><AdminRequiredNote lang={lang} inline/>
            </h2>
            {employee.passwordChangeRequired&&<p className="text-sm text-slate-600">{st('Change your initial or reset password before continuing.','Ganti kata sandi awal atau reset sebelum melanjutkan.','请先修改初始或重置密码，再进入工作区。')}</p>}
            <AdminField className="block text-sm">
              {t("Current password", "当前密码")}
              <input
                className={field}
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </AdminField>
            <AdminField className="block text-sm">
              {t("New password", "新密码")}
              <input
                className={field}
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={200}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
              />
            </AdminField>
            <AdminField className="block text-sm">{st('Confirm new password','Konfirmasi kata sandi baru','确认新密码')}<input className={field} type="password" autoComplete="new-password" value={confirm} required minLength={12} maxLength={200} onChange={e=>setConfirm(e.target.value)}/></AdminField>
            <p className="text-xs text-slate-500">{st('12–200 characters, with uppercase and lowercase letters and a number. Use a different password from your account name and current password.','12–200 karakter, dengan huruf besar dan kecil serta angka. Jangan gunakan nama akun atau kata sandi saat ini.','12–200个字符，包含大小写字母和数字，不得与账号或当前密码相同。')}</p>
            {error && (
              <p role="alert" className="text-sm text-rose-600">
                {error==='password_policy_required'?st('Check the password rules and make sure both new passwords match.','Periksa aturan kata sandi dan pastikan keduanya sama.','请按规则设置密码，并确保两次输入一致。'):crmError(error, lang)}
              </p>
            )}
            {notice && (
              <p role="status" className="text-sm text-emerald-700">
                {t(
                  "Password updated; other sessions signed out.",
                  "密码已更新，其他会话已退出。",
                )}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="submit"
                disabled={busy}
                className="bg-primary-600 text-white rounded-lg px-4 py-2"
              >
                {t("Save", "保存")}
              </button>
              <button
                type="button"
                disabled={busy}
                className="order-first"
                onClick={async () => {
                  if(employee.passwordChangeRequired){await auth('logout',{});sessionRead.current?.abort();setEmployee(null);}
                  setChange(false);
                  setCurrent("");
                  setNext("");
                  setError("");
                }}
              >
                {employee.passwordChangeRequired?st("Sign out","Keluar","退出登录"):t("Close", "关闭")}
              </button>
            </div>
          </AdminForm>
        </div>
      )}
    </AccountContext.Provider>
  );
}
