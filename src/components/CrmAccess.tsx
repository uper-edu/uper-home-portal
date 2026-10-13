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
}: {
  lang: "zh" | "en" | "id";
  isLight: boolean;
}) {
  const account = useContext(AccountContext);
  if (!account) return null;
  const { employee } = account;
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  return (
    <details
      className="relative shrink-0 ml-auto"
      aria-label={t("Account menu", "账号菜单")}
    >
      <summary
        className={`list-none cursor-pointer flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs ${isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-slate-800 border-slate-700 text-slate-100"}`}
      >
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">
            {employee.displayName || employee.id}
          </span>
          <span className={isLight ? "text-slate-500" : "text-slate-400"}>
            {employee.roles
              .map((r) =>
                r === "crm_leader"
                  ? t("CRM Leader", "CRM 管理者")
                  : t("Sales", "销售"),
              )
              .join(" + ")}
          </span>
        </span>
        <span aria-hidden="true">▾</span>
      </summary>
      <div
        className={`absolute right-0 top-full mt-2 z-40 min-w-44 rounded-xl border shadow-lg p-1 text-xs ${isLight ? "bg-white border-slate-200 text-slate-800" : "bg-slate-900 border-slate-700 text-slate-100"}`}
      >
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
  if (!r.ok) throw Error(d.error || "Authentication failed");
  return d;
}
export default function CrmAccess({
  children,
}: {
  children: (
    employee: CrmEmployee,
    lang: CrmLanguage,
    setLang: (value: CrmLanguage) => void,
  ) => React.ReactNode;
}) {
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
        .then((d) => setEmployee(d.employee))
        .catch(() => {
          setEmployee(null);
          setChange(false);
        });
    }, 60000);
    return () => clearInterval(timer);
  }, [employee?.id]);
  useEffect(() => {
    if (!employee) document.title = t("CRM sign in | UPER", "CRM 登录 | UPER");
  }, [employee, lang]);
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
            <span className="crm-sign-in-eyebrow">{t("Sales workspace", "销售工作区")}</span>
            <h2 id="crm-sign-in-intro-title">{t("Every customer. A clear next step.", "每一位客户，都有清晰的下一步。")}</h2>
            <p>{t("Keep customer conversations, ownership and follow-up in one place.", "在同一个工作区管理客户对话、负责人和跟进安排。")}</p>
            <ul className="crm-sign-in-features">
              <li><Users size={20} aria-hidden="true" /><span>{t("Customer records & conversations", "客户资料与对话")}</span></li>
              <li><ListChecks size={20} aria-hidden="true" /><span>{t("Ownership & follow-up", "客户归属与跟进")}</span></li>
              <li><Bell size={20} aria-hidden="true" /><span>{t("Reminders & sales operations", "提醒与销售运营")}</span></li>
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
          <h1>{t("CRM sign in", "CRM 登录")}</h1>
          <p className="crm-sign-in-subtitle">{t("Use your staff account", "请使用员工账号登录")}</p>
          <label className="crm-sign-in-label">
            {t("Login ID", "登录账号")}
            <input
              className="crm-sign-in-input"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
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
        <footer className="crm-sign-in-footer">UPER · {t("Customer relationship management", "客户关系管理")}</footer>
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
                await auth("password", {
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
