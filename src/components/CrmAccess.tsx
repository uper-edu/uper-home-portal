import {managementRequest,clearAccessPasswords} from "../utils/accessOperationClient";
import {AccessOperationStatus} from "./AccessOperationStatus";
import { adminRoleLabel } from "../utils/adminWorkspace";
import { cmsText } from '../utils/cmsLanguage';
import {clearStaffDrafts} from "../utils/crmDrafts";
import { ArrowRight, LockKeyhole, Users, ListChecks, Bell } from "lucide-react";
import "./crm/crm-sign-in.css";
import { CrmLanguageSelect } from "./crm/CrmLanguageSelect";
import { crmId } from "../utils/crmIndonesian";
import {
  useCrmLanguage,
  crmError,
  type CrmLanguage,
} from "../utils/crmLanguage";
import { createContext, useContext, useEffect, useState } from "react";
export interface CrmEmployee {
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
  workspace?: "crm" | "cms" | "system";
}) {
  const account = useContext(AccountContext);
  if (!account) return null;
  const { employee } = account;
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const roleLabel = (role: string) => employee.roleLabels?.[role]?.[lang === "zh"?2:lang === "id"?1:0] || adminRoleLabel(role, lang);
  const preferredRole = workspace === 'system' ? 'access_admin' : workspace === 'cms' ? 'cms_admin' : employee.roles.includes('crm_leader') ? 'crm_leader' : 'sales';
  const currentRole = employee.roles.includes(preferredRole) && (!employee.rolePermissions || employee.rolePermissions[preferredRole]?.includes(workspace==='system'?'access.read':workspace==='cms'?'cms.manage':'crm.read')) ? preferredRole : employee.roles.find(role=>employee.rolePermissions?.[role]?.includes(workspace==='system'?'access.read':workspace==='cms'?'cms.manage':'crm.read')) || employee.roles[0] || '';
  return (
    <details
      className="relative shrink-0 ml-auto"
      aria-label={t("Account menu", "账号菜单")}
    >
      <summary
        className={workspace ? "admin-account-summary" : `list-none cursor-pointer flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs ${isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-slate-800 border-slate-700 text-slate-100"}`}
      >
        <span className={workspace ? "admin-account-identity" : "flex flex-col gap-0.5"}>
          <span className="admin-account-name font-semibold">
            {employee.displayName || employee.id}
          </span>
          <span className={workspace ? "admin-account-role" : isLight ? "text-slate-500" : "text-slate-400"}>
            {workspace ? roleLabel(currentRole) : employee.roles.map(roleLabel).join(" + ")}
          </span>
        </span>
        <span aria-hidden="true">▾</span>
      </summary>
      <div
        className={workspace ? "admin-account-popover" : `absolute right-0 top-full mt-2 z-40 min-w-44 rounded-xl border shadow-lg p-1 text-xs ${isLight ? "bg-white border-slate-200 text-slate-800" : "bg-slate-900 border-slate-700 text-slate-100"}`}
      >
        {workspace && <div className="admin-account-context"><strong>{employee.displayName || employee.id}</strong>{employee.roles.map(roleLabel).join(" · ")}</div>}
        <button
          type="button"
          className="block w-full text-left rounded-lg px-3 py-2 hover:bg-primary-500/10"
          onClick={(e) => {
            e.currentTarget.closest("details")?.removeAttribute("open");
            account.password();
          }}
        >
          {t("Change password", "修改密码")}
        </button>
        <button
          type="button"
          disabled={account.busy}
          className="block w-full text-left rounded-lg px-3 py-2 hover:bg-primary-500/10"
          onClick={() => account.logout()}
        >
          {t("Sign out", "退出登录")}
        </button>
        {account.error && (
          <p role="alert" className="text-rose-600 p-2">
            {account.error}
          </p>
        )}
      </div>
    </details>
  );
}
async function auth(path: string, body?: any) {
  const r = await fetch("/api/crm/auth/" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const d = await r.json();
  if (!r.ok) throw Object.assign(Error(d.error || "Authentication failed"),{status:r.status});
  return d;
}
export default function CrmAccess({
  children,
  workspace = "crm",
}: {
  workspace?: "crm" | "cms" | "system";
  children: (
    employee: CrmEmployee,
    lang: CrmLanguage,
    setLang: (value: CrmLanguage) => void,
  ) => React.ReactNode;
}) {
  const [connectionProblem,setConnectionProblem]=useState(false);
  const isCms = workspace === "cms", isSystem=workspace==='system';
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
    [notice, setNotice] = useState("");
  useEffect(() => {
    auth("me")
      .then((d) => setEmployee(d.employee))
      .catch(() => setEmployee(null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!employee) return;
    const timer = setInterval(() => {
      auth("me")
        .then((d) => {setEmployee(d.employee);setConnectionProblem(false);})
        .catch((error:any) => {
          if([401,403].includes(error.status)){setEmployee(null);setChange(false);}
          else setConnectionProblem(true);
        });
    }, 60000);
    return () => clearInterval(timer);
  }, [employee?.id]);
  useEffect(()=>{const refresh=()=>auth('me').then(d=>setEmployee(d.employee)).catch(e=>{if([401,403].includes(e.status))setEmployee(null);});window.addEventListener('uper-access-changed',refresh);return()=>window.removeEventListener('uper-access-changed',refresh);},[]);
  useEffect(() => {
    if (!employee) document.title = isSystem ? st("System sign in | UPER","Login sistem | UPER","系统登录 | UPER") : isCms ? cmsText("CMS sign in | UPER", "CMS 登录 | UPER", lang) : t("CRM sign in | UPER", "CRM 登录 | UPER");
  }, [employee, lang, isCms, isSystem]);
  const field =
    "w-full p-3 rounded-lg border border-slate-300 bg-white text-slate-900";
  if (loading)
    return (
      <div className="p-10 text-center">
        {t("Checking login…", "正在验证登录…")}
      </div>
    );
  if (!employee)
    return (
      <main className="crm-sign-in">
        <header className="crm-sign-in-header">
          <a href="/" className="crm-sign-in-brand" aria-label="UPER">
            <img src="/uper-logo-mark.svg" alt="" />
            <span>UPER</span>
          </a>
          <div className="crm-sign-in-language"><CrmLanguageSelect lang={lang} onChange={setLang} /></div>
        </header>
        <div className="crm-sign-in-layout">
          <section className="crm-sign-in-intro" aria-labelledby="crm-sign-in-intro-title">
            <span className="crm-sign-in-eyebrow">{isSystem ? st("System workspace","Ruang sistem","系统工作区") : isCms ? cmsText("Content workspace", "内容工作区", lang) : t("Sales workspace", "销售工作区")}</span>
            <h2 id="crm-sign-in-intro-title">{isSystem ? st("Clear responsibilities. Controlled access.","Tanggung jawab jelas. Akses terkendali.","职责清晰，授权有据。") : isCms ? cmsText("Keep website content clear and current.", "让网站内容清晰、及时。", lang) : t("Every customer. A clear next step.", "每一位客户，都有清晰的下一步。")}</h2>
            <p>{isSystem ? st("Manage users, roles and access audit in one workspace.","Kelola pengguna, peran, dan audit akses dalam satu ruang.","在同一个工作区管理用户、角色与权限审计。") : isCms ? cmsText("Manage website content and images in one workspace.", "在同一个工作区管理网站内容与图片。", lang) : t("Keep customer conversations, ownership and follow-up in one place.", "在同一个工作区管理客户对话、负责人和跟进安排。")}</p>
            <ul className="crm-sign-in-features">
              <li><Users size={20} aria-hidden="true" /><span>{isSystem ? st("Staff accounts","Akun staf","员工账号") : isCms ? cmsText("Content collections", "内容集合", lang) : t("Customer records & conversations", "客户资料与对话")}</span></li>
              <li><ListChecks size={20} aria-hidden="true" /><span>{isSystem ? st("Roles and data scopes","Peran dan cakupan data","角色及数据范围") : isCms ? cmsText("Images and media", "图片与素材", lang) : t("Ownership & follow-up", "客户归属与跟进")}</span></li>
              <li><Bell size={20} aria-hidden="true" /><span>{isSystem ? st("Access change audit","Audit perubahan akses","权限变更审计") : isCms ? cmsText("Website content updates", "网站内容更新", lang) : t("Reminders & sales operations", "提醒与销售运营")}</span></li>
            </ul>
          </section>
        <form
          className="crm-sign-in-card"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const d = await auth("login", { loginId, password });
              setEmployee(d.employee);
              setPassword("");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="crm-sign-in-lock"><LockKeyhole size={22} aria-hidden="true" /></div>
          <h1>{isSystem ? st("System sign in","Login sistem","系统登录") : isCms ? cmsText("CMS sign in", "CMS 登录", lang) : t("CRM sign in", "CRM 登录")}</h1>
          <p className="crm-sign-in-subtitle">{t("Use your staff account", "请使用员工账号登录")}</p>
          <label className="crm-sign-in-label">
            {st("Login ID or email", "ID login atau email", "登录ID或邮箱")}
            <input
              className="crm-sign-in-input"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
            />
          </label>
          <label className="crm-sign-in-label">
            {t("Password", "密码")}
            <input
              className="crm-sign-in-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p role="alert" className="crm-sign-in-error">
              {crmError(error, lang)}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="crm-sign-in-submit"
            aria-busy={busy}
          >
            {busy ? t("Signing in…", "正在登录…") : t("Sign in", "登录")}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <p className="crm-sign-in-footnote">{t("Staff access only. Your role determines what you can view and manage.", "仅供员工访问。可查看的数据与操作权限由账号角色决定。")}</p>
        </form>
        </div>
        <footer className="crm-sign-in-footer">UPER · {isSystem ? st("System management","Manajemen sistem","系统管理") : isCms ? cmsText("Content management", "内容管理", lang) : t("Customer relationship management", "客户关系管理")}</footer>
      </main>
    );
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
      {connectionProblem&&<p role="status" className="p-3 border border-amber-500">{lang==='zh'?'连接暂不可用，工作区和草稿仍保留；请恢复连接后重试。':lang==='id'?'Koneksi sementara tidak tersedia. Ruang kerja dan draf tetap disimpan; coba lagi setelah tersambung.':'Connection temporarily unavailable. Your workspace and draft remain; retry after reconnecting.'}</p>}
      {children(employee, lang, setLang)}
      {change && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-6">
          <form
            className="w-full max-w-sm bg-white rounded-2xl p-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await managementRequest(employee.id,"/api/crm/auth/password", {
                  currentPassword: current,
                  newPassword: next,
                });
                setCurrent("");
                setNext("");
                setNotice("password_updated");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <AccessOperationStatus actor={employee.id} lang={lang} onResolved={()=>setError('')}/>
            <h2 className="font-bold">
              {t("Change your password", "修改自己的密码")}
            </h2>
            <label className="block text-sm">
              {t("Current password", "当前密码")}
              <input
                className={field}
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              {t("New password", "新密码")}
              <input
                className={field}
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={200}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
              />
            </label>
            <p className="text-xs text-slate-500">
              {t("At least 8 characters", "至少 8 个字符")}
            </p>
            {error && (
              <p role="alert" className="text-sm text-rose-600">
                {crmError(error, lang)}
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
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={busy}
                className="bg-primary-600 text-white rounded-lg px-4 py-2"
              >
                {t("Save", "保存")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setChange(false);
                  setCurrent("");
                  setNext("");
                  setError("");
                }}
              >
                {t("Close", "关闭")}
              </button>
            </div>
          </form>
        </div>
      )}
    </AccountContext.Provider>
  );
}
