import { accessGuide, accessError } from "../utils/accessLanguage";
import { Fragment, useEffect, useRef, useState } from "react";
import CrmAccess, { type CrmEmployee } from "../components/CrmAccess";
import { AdminHeader, adminText } from "../components/AdminHeader";
import { CrmSingleSelect } from "../components/crm/CrmSingleSelect";
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
type User = {
  id: string;
  loginId: string;
  email?: string | null;
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
async function api(path = "", body?: any) {
  const r = await fetch("/api/admin/access" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "access_unavailable");
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
  const [tab, setTab] = useState("users"),
    [data, setData] = useState<{ users: User[]; roles: Role[] } | null>(null),
    [err, setErr] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [previewUserId, setPreviewUserId] = useState(employee.id),
    [audit, setAudit] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null),
    [role, setRole] = useState<Role | null>(null),
    [why, setWhy] = useState(""),
    [preview, setPreview] = useState<any[] | null>(null),
    [latest, setLatest] = useState<any>(null),
    [impact, setImpact] = useState<any>(null),
    [password, setPassword] = useState(""),
    [dirty, setDirty] = useState(false);
  const panel = useRef<HTMLElement>(null),
    priorFocus = useRef<HTMLElement | null>(null);
  const can = (permission: string) => employee.permissions.includes(permission);
  const load = async () => {
    setErr("");
    try {
      setData(await api());
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  useEffect(() => {
    if (can("access.read")) void load();
  }, [employee.id]);
  useEffect(() => {
    document.title = t(
      "Users & access | UPER",
      "Pengguna & akses | UPER",
      "用户与权限 | UPER",
    );
  }, [lang]);
  useEffect(() => {
    if (tab === "audit" && can("access.audit"))
      api("/audit")
        .then(setAudit)
        .catch((e) => setErr(e.message));
  }, [tab]);
  useEffect(() => {
    if (!user && !role) return;
    priorFocus.current = document.activeElement as HTMLElement;
    panel.current?.focus();
    return () => priorFocus.current?.focus();
  }, [!!user, !!role]);
  useEffect(() => {
    const protect = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  const close = () => {
    if (
      dirty &&
      !window.confirm(
        t(
          "Discard unsaved changes?",
          "Buang perubahan yang belum disimpan?",
          "放弃尚未保存的修改？",
        ),
      )
    )
      return;
    setUser(null);
    setRole(null);
    setPassword("");
    setDirty(false);
    setPreview(null);
    setWhy("");
    setImpact(null);
  };
  const openUser = (u: User | null) => {
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
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      if (user)
        await api(user.id ? "/users/" + user.id : "/users", {
          ...user,
          reason: why,
          temporaryPassword: password,
        });
      else if (role) {
        if (!preview) throw Error("access_preview_required");
        await api("/roles/" + role.id, { ...role, reason: why });
      }
      setDirty(false);
      setUser(null);
      setRole(null);
      setPassword("");
      setPreview(null);
      setWhy("");
      setNotice(
        t(
          "Saved. Affected sessions were revoked; sign in again if required. Customer ownership is unchanged.",
          "Tersimpan. Sesi terkait dicabut; login kembali jika diperlukan. Kepemilikan pelanggan tidak berubah.",
          "已保存，受影响会话已撤销；需要时请重新登录。客户归属没有改变。",
        ),
      );
      await load();
      window.dispatchEvent(new Event("uper-access-changed"));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const errorText =
    err === "access_preview_required"
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
    "access.teamless.role": ["Retired team permissions reviewed", "Izin tim lama ditinjau", "历史团队授权复核"],
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
  const selectedPreviewUser =
    data?.users.find((u) => u.id === previewUserId) || data?.users[0];
  return (
    <div className="access-page" data-theme={isLight ? "light" : "dark"}>
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
              ["users", "Users", "Pengguna", "用户"],
              ["roles", "Roles", "Peran", "角色"],
              ["preview", "Access preview", "Pratinjau akses", "权限预览"],
              ["audit", "Change audit", "Audit perubahan", "变更审计"],
              ["guide", "Guide", "Panduan", "使用指南"],
            ]
              .filter((a) => a[0] !== "audit" || can("access.audit"))
              .map((a) => (
                <button
                  key={a[0]}
                  aria-current={tab === a[0] ? "page" : undefined}
                  onClick={() => {
                    if (user || role) {
                      close();
                      return;
                    }
                    setTab(a[0]);
                  }}
                >
                  {a[col + 1]}
                </button>
              ))}
          </>
        }
      />
      <main id="access-main" className="access-main" tabIndex={-1}>
        <div className="admin-page-toolbar">
          <div>
            <h1>{t("Users & access", "Pengguna & akses", "用户与权限")}</h1>
            <p>
              {t(
                "Manage staff responsibilities and access without changing customer ownership.",
                "Kelola tanggung jawab dan akses staf tanpa mengubah kepemilikan pelanggan.",
                "管理员工职责和权限，不改变客户归属。",
              )}
            </p>
          </div>
          {can("access.read") && (
            <button disabled={busy || dirty} onClick={() => void load()}>
              {t("Reload", "Muat ulang", "重新载入")}
            </button>
          )}
        </div>
        {!can("access.read") ? (
          <p role="alert">
            {t(
              "System management access denied.",
              "Akses manajemen sistem ditolak.",
              "无系统管理访问权限。",
            )}
          </p>
        ) : (
          <>
            {err && (
              <p role="alert" className="access-error">
                {errorText}
              </p>
            )}
            {notice && (
              <p role="status" className="access-notice">
                {notice}
              </p>
            )}
            {!data && !err && (
              <p role="status">{t("Loading…", "Memuat…", "加载中…")}</p>
            )}
            {tab === "guide" ? (
              <section className="access-card">
                <h2>
                  {t(
                    "How access works",
                    "Cara kerja akses",
                    "权限逻辑与操作指南",
                  )}
                </h2>
                <ol>
                  {accessGuide.map((text, i) => (
                    <li key={i}>{text[col]}</li>
                  ))}
                </ol>
              </section>
            ) : null}
            {data && tab === "users" && (
              <>
                <div className="access-toolbar">
                  <label>
                    {t("Find a user", "Cari pengguna", "查找用户")}
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  {can("access.users") && (
                    <button onClick={() => openUser(null)}>
                      {t("Add user", "Tambah pengguna", "新增用户")}
                    </button>
                  )}
                </div>
                <div className="access-grid">
                  {data.users
                    .filter((u) =>
                      (u.displayName + " " + u.loginId + " " + (u.email || ""))
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .sort(
                      (a, b) =>
                        Number(b.id === employee.id) -
                        Number(a.id === employee.id),
                    )
                    .map((u) => (
                      <section className="access-card" key={u.id}>
                        <h2>
                          {u.displayName}{" "}
                          {u.id === employee.id && (
                            <small>
                              {t(
                                "Signed-in user",
                                "Pengguna yang sedang login",
                                "当前登录用户",
                              )}
                            </small>
                          )}
                        </h2>
                        <p>
                          {u.loginId} ·{" "}
                          {u.active
                            ? t("Active", "Aktif", "已启用")
                            : t("Disabled", "Nonaktif", "已停用")}
                        </p>
                        <p>
                          {u.email ||
                            t(
                              "No login email",
                              "Email login belum diisi",
                              "未设置登录邮箱",
                            )}
                        </p>
                        <p>
                          {u.roles
                            .map(
                              (id) =>
                                data.roles.find((r) => r.id === id)?.config
                                  .names[col] || id,
                            )
                            .join(" · ") ||
                            t("No roles", "Tanpa peran", "未授予角色")}
                        </p>
                        {(can("access.users") || can("access.sessions")) && (
                          <button onClick={() => openUser(u)}>
                            {t("Edit user", "Edit pengguna", "编辑用户")}
                          </button>
                        )}
                      </section>
                    ))}
                </div>
              </>
            )}
            {data && tab === "roles" && (
              <>
                <div className="access-toolbar">
                  <p>
                    {t(
                      "Role IDs stay stable when names change.",
                      "ID peran tetap saat nama berubah.",
                      "角色名称可以修改，内部ID保持稳定。",
                    )}
                  </p>
                  {can("access.roles") && (
                    <button onClick={() => openRole(null)}>
                      {t("Add role", "Tambah peran", "新增角色")}
                    </button>
                  )}
                </div>
                <div className="access-grid">
                  {data.roles.map((r) => (
                    <section className="access-card" key={r.id}>
                      <h2>{r.config.names[col]}</h2>
                      <p>{r.config.description[col]}</p>
                      <p>
                        {r.enabled
                          ? t("Active", "Aktif", "已启用")
                          : t("Disabled", "Nonaktif", "已停用")}{" "}
                        · {Object.keys(r.config.grants).length}{" "}
                        {t("permissions", "izin", "项权限")}
                      </p>
                      {can("access.roles") && (
                        <button onClick={() => openRole(r)}>
                          {t("Edit role", "Edit peran", "编辑角色")}
                        </button>
                      )}
                    </section>
                  ))}
                </div>
              </>
            )}
            {data && tab === "preview" && (
              <div className="access-preview">
                <CrmSingleSelect
                  label={t("Employee", "Staf", "员工")}
                  value={selectedPreviewUser?.id || ""}
                  options={data.users.map((u) => ({
                    value: u.id,
                    label: u.displayName,
                  }))}
                  onChange={setPreviewUserId}
                  searchable
                  lang={lang}
                  isLight={isLight}
                />
                {[selectedPreviewUser]
                  .filter((u): u is User => !!u)
                  .map((u) => (
                    <section className="access-card" key={u.id}>
                      <h2>{u.displayName}</h2>
                      {!u.active && (
                        <p>
                          {t(
                            "Disabled: cannot authenticate.",
                            "Nonaktif: tidak dapat login.",
                            "已停用：无法登录。",
                          )}
                        </p>
                      )}
                      <ul>
                        {permissionCatalog
                          .filter((p) =>
                            u.effective.permissions.includes(p.key),
                          )
                          .map((p) => (
                            <li key={p.key}>
                              {p.names[col]} —{" "}
                              {p.scoped
                                ? (u.effective.grants?.[p.key] || [])
                                    .map((scope) => scopeLabel(scope, p.key))
                                    .join(" / ")
                                : t("Enabled", "Aktif", "已启用")}
                              <small>
                                {t("From", "Dari", "来源")}：
                                {data.roles
                                  .filter(
                                    (r) =>
                                      u.roles.includes(r.id) &&
                                      r.enabled &&
                                      r.config.grants[p.key],
                                  )
                                  .map((r) => r.config.names[col])
                                  .join(" · ")}
                              </small>
                            </li>
                          ))}
                      </ul>
                    </section>
                  ))}
              </div>
            )}
            {tab === "audit" && (
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
                  <details key={a.id}>
                    <summary>
                      {a.actor} · {String(a.created_at)} ·{" "}
                      {auditLabels[a.action]?.[col] || a.action}
                    </summary>
                    <pre>{JSON.stringify(a.data, null, 2)}</pre>
                  </details>
                ))}
              </section>
            )}
          </>
        )}
      </main>
      {(user || role) && (
        <div
          className="access-backdrop"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            if (e.key === "Tab") {
              const controls = Array.from(
                panel.current?.querySelectorAll<HTMLElement>(
                  "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),summary,a[href]",
                ) || [],
              ).filter((e) => e.offsetParent !== null);
              if (e.shiftKey && document.activeElement === controls[0]) {
                e.preventDefault();
                controls.at(-1)?.focus();
              } else if (
                !e.shiftKey &&
                document.activeElement === controls.at(-1)
              ) {
                e.preventDefault();
                controls[0]?.focus();
              }
            }
          }}
        >
          <section
            ref={panel}
            tabIndex={-1}
            className="access-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-editor-title"
          >
            <div className="access-toolbar">
              <h2 id="access-editor-title">
                {user
                  ? t("User settings", "Pengaturan pengguna", "用户设置")
                  : t("Role settings", "Pengaturan peran", "角色设置")}
              </h2>
              <button onClick={close} disabled={busy}>
                {t("Close", "Tutup", "关闭")}
              </button>
            </div>
            {err && (
              <p role="alert" className="access-error">
                {errorText}
              </p>
            )}
            {err && (
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
            {notice && (
              <p role="status" className="access-notice">
                {notice}
              </p>
            )}
            {user && (
              <>
                <label>
                  {t("Login ID", "ID login", "登录ID")}
                  <input
                    value={user.loginId}
                    disabled={!!user.id}
                    onChange={(e) => {
                      setUser({ ...user, loginId: e.target.value });
                      setDirty(true);
                    }}
                  />
                </label>
                <label>
                  {t("Name", "Nama", "姓名")}
                  <input
                    disabled={!can("access.users")}
                    value={user.displayName}
                    onChange={(e) => {
                      setUser({ ...user, displayName: e.target.value });
                      setDirty(true);
                    }}
                  />
                </label>
                <label>
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
                </label>
                <CrmSingleSelect
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
                <label>
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
                </label>
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
                  <label>
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
                  </label>
                )}
              </>
            )}
            {role && (
              <>
                <label>
                  {t("Stable role ID", "ID peran tetap", "稳定角色ID")}
                  <input
                    disabled={role.revision > 0}
                    value={role.id}
                    onChange={(e) =>
                      changeRole({ ...role, id: e.target.value })
                    }
                  />
                </label>
                {["names", "description"].map((field) => (
                  <div key={field} className="access-languages">
                    {["English", "Bahasa Indonesia", "中文"].map(
                      (language, i) => (
                        <label key={language}>
                          {field === "names"
                            ? t("Role name", "Nama peran", "角色名称")
                            : t("Description", "Deskripsi", "职责说明")}{" "}
                          · {language}
                          <input
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
                        </label>
                      ),
                    )}
                  </div>
                ))}
                <label>
                  <input
                    type="checkbox"
                    checked={role.enabled}
                    onChange={(e) =>
                      changeRole({ ...role, enabled: e.target.checked })
                    }
                  />
                  {t("Role enabled", "Peran aktif", "启用角色")}
                </label>
                {permissionCatalog.map((p, index) => (
                  <Fragment key={p.key}>
                    {(index === 0 ||
                      permissionCatalog[index - 1].module !== p.module) && (
                      <h3>{modules[p.module][col]}</h3>
                    )}
                    <div className="access-permission">
                      <label>
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
                      </label>
                      {p.scoped && role.config.grants[p.key] && (
                        <CrmSingleSelect
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
              </>
            )}
            <label>
              {t("Change reason", "Alasan perubahan", "变更原因")}
              <textarea
                value={why}
                maxLength={500}
                onChange={(e) => setWhy(e.target.value)}
              />
            </label>
            <div className="access-actions">
              <button
                disabled={
                  busy ||
                  !why.trim() ||
                  (!!user && !can("access.users")) ||
                  !dirty ||
                  (!!role && !preview) ||
                  (!user?.id && !!user && password.length < 8)
                }
                onClick={() => void save()}
              >
                {busy
                  ? t("Saving…", "Menyimpan…", "保存中…")
                  : t("Save changes", "Simpan perubahan", "保存修改")}
              </button>
              {user?.id && can("access.sessions") && (
                <>
                  <button
                    disabled={busy || !why.trim()}
                    onClick={async () => {
                      setBusy(true);
                      setErr("");
                      try {
                        await api("/users/" + user.id + "/sessions", {
                          reason: why,
                        });
                        setNotice(
                          t(
                            "Sessions revoked.",
                            "Sesi dicabut.",
                            "会话已撤销。",
                          ),
                        );
                      } catch (e) {
                        setErr((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {t("Revoke sessions", "Cabut sesi", "撤销会话")}
                  </button>
                  <button
                    disabled={busy || password.length < 8 || !why.trim()}
                    onClick={async () => {
                      setBusy(true);
                      setErr("");
                      try {
                        await api("/users/" + user.id + "/password", {
                          temporaryPassword: password,
                          reason: why,
                          revision: user.revision,
                        });
                        setPassword("");
                        setUser({ ...user, revision: user.revision + 1 });
                        setNotice(
                          t(
                            "Password reset; sessions revoked.",
                            "Kata sandi direset; sesi dicabut.",
                            "密码已重置，会话已撤销。",
                          ),
                        );
                      } catch (e) {
                        setErr((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {t("Reset password", "Reset kata sandi", "重置密码")}
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
