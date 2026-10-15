import { describeFollowUpTask } from "../utils/crmFollowUp";
import "./access-safety.css";
import { useEffect, useState } from "react";
import { adminText } from "./AdminHeader";
import type { CrmEmployee } from "./CrmAccess";
import type { CrmLanguage } from "../utils/crmLanguage";
import { CrmSingleSelect } from "./crm/CrmSingleSelect";
import { managementRequest } from "../utils/accessOperationClient";
import { AccessOperationStatus } from "./AccessOperationStatus";
import { accessError } from "../utils/accessLanguage";
import { AccessRecoveryPreparation } from "./AccessRecoveryPreparation";
async function read(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "access_unavailable");
  return data;
}
export function AccessHandoverPanel({
  actor,
  lang,
  isLight,
  system = false,
}: {
  actor: CrmEmployee;
  lang: CrmLanguage;
  isLight: boolean;
  system?: boolean;
}) {
  const [cases, setCases] = useState<any[]>([]),
    [staff, setStaff] = useState<any[]>([]),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Record<string, boolean>>({}),
    [targets, setTargets] = useState<Record<string, string>>({}),
    [reasons, setReasons] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const t = (en: string, id: string, zh: string) => adminText(lang, en, id, zh);
  const manager =
    actor.permissions.includes("crm.assign") &&
    actor.permissions.includes("crm.read");
  const url = system
    ? "/api/admin/access/handovers"
    : "/api/crm/access-handovers";
  const load = async () => {
    try {
      setCases(await read(url));
      if (manager) setStaff(await read("/api/portal/employees"));
      setLoaded(true);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void load();
    const sync = () => void load();
    window.addEventListener("uper-access-changed", sync);
    return () => window.removeEventListener("uper-access-changed", sync);
  }, [actor.id]);
  if (!system && !manager) return null;
  if (loaded && !cases.some((h) => h.state !== "completed") && !error)
    return null;
  const clearCaseDraft = (h: any) => {
    const ids = new Set([...h.leads, ...h.tasks].map((x: any) => x.id));
    setSelected((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id]) => !ids.has(id)),
      ),
    );
    setReasons((current) => ({ ...current, [h.id]: "" }));
  };
  return (
    <section
      className="access-card access-safety-surface"
      data-theme={isLight ? "light" : "dark"}
      aria-label={t("Staff handover", "Serah terima staf", "人员交接")}
    >
      <details>
        <summary>
          {t("Staff handover", "Serah terima staf", "人员交接")} ·{" "}
          {cases.filter((h) => h.state !== "completed").length}
        </summary>
        <p>
          {t(
            "Disabling access is immediate. Transfer only selected work; existing task deadlines stay unchanged.",
            "Penonaktifan akses berlaku segera. Alihkan hanya pekerjaan terpilih; tenggat tetap.",
            "停用立即生效；交接只处理所选事项，原任务截止时间保持不变。",
          )}
        </p>
        {!loaded && !error && (
          <p role="status">{t("Loading…", "Memuat…", "正在载入…")}</p>
        )}
        {error && <p role="alert">{accessError(error, lang)}</p>}
        <button type="button" disabled={busy} onClick={() => void load()}>
          {t("Refresh handovers", "Muat ulang serah terima", "刷新交接")}
        </button>
        {cases
          .filter((h) => h.state !== "completed")
          .map((h) => {
            const target = targets[h.id] || "",
              reason = reasons[h.id] || "";
            return (
              <section className="access-impact" key={h.id}>
                <h3>{h.userId}</h3>
                <p>
                  {t("Customers", "Pelanggan", "客户")} {h.customerCount} ·{" "}
                  {t("Unfinished tasks", "Tugas belum selesai", "未完成任务")}{" "}
                  {h.taskCount}
                </p>
                {!manager && (
                  <p>
                    {t(
                      "Ask an authorized CRM Manager to transfer the work in CRM. This role does not grant customer access.",
                      "Minta Manajer CRM berwenang mengalihkan pekerjaan di CRM. Peran ini tidak memberi akses pelanggan.",
                      "请由有权的CRM管理者在CRM处理交接；系统管理权限不授予客户访问权。",
                    )}
                  </p>
                )}
                {manager && (
                  <>
                    {h.leads.map((l: any) => (
                      <label key={l.id}>
                        <input
                          type="checkbox"
                          checked={!!selected[l.id]}
                          onChange={(e) =>
                            setSelected({
                              ...selected,
                              [l.id]: e.target.checked,
                            })
                          }
                        />
                        {t("Customer", "Pelanggan", "客户")}：{l.name}
                      </label>
                    ))}
                    {h.tasks.map((task: any) => (
                      <label key={task.id}>
                        <input
                          type="checkbox"
                          checked={!!selected[task.id]}
                          onChange={(e) =>
                            setSelected({
                              ...selected,
                              [task.id]: e.target.checked,
                            })
                          }
                        />
                        {t("Task", "Tugas", "任务")}：
                        {
                          describeFollowUpTask(task as any, lang, h.timezone)
                            .action
                        }{" "}
                        · {task.id} ·{" "}
                        {
                          describeFollowUpTask(task as any, lang, h.timezone)
                            .timing
                        }
                      </label>
                    ))}
                    {h.customerCount + h.taskCount > 0 && (
                      <CrmSingleSelect
                        label={t(
                          "Receiving owner",
                          "Penerima tanggung jawab",
                          "接收负责人",
                        )}
                        value={target}
                        emptyLabel={t(
                          "Select an owner",
                          "Pilih penanggung jawab",
                          "请选择接收负责人",
                        )}
                        options={staff
                          .filter(
                            (u) =>
                              u.active &&
                              u.id !== h.userId &&
                              u.permissions.includes("crm.own") &&
                              u.permissions.includes("crm.followup"),
                          )
                          .map((u) => ({
                            value: u.id,
                            label: u.displayName || u.id,
                          }))}
                        onChange={(value) =>
                          setTargets((current) => ({
                            ...current,
                            [h.id]: value,
                          }))
                        }
                        searchable
                        lang={lang}
                        isLight={isLight}
                      />
                    )}
                    <label>
                      {t(
                        "Reason and authorization check",
                        "Alasan dan pemeriksaan izin",
                        "原因及授权核对",
                      )}
                      <textarea
                        value={reason}
                        maxLength={500}
                        onChange={(e) =>
                          setReasons((current) => ({
                            ...current,
                            [h.id]: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      disabled={
                        busy ||
                        !reason.trim() ||
                        (h.customerCount + h.taskCount === 0 &&
                          h.remainingTotal > 0) ||
                        (h.customerCount + h.taskCount > 0 &&
                          (!target ||
                            ![...h.leads, ...h.tasks].some(
                              (x: any) => selected[x.id],
                            )))
                      }
                      onClick={async () => {
                        setBusy(true);
                        setError("");
                        try {
                          await managementRequest(
                            actor.id,
                            "/api/crm/access-handovers/" + h.id,
                            {
                              revision: h.revision,
                              reason,
                              targetId:
                                h.customerCount + h.taskCount > 0
                                  ? target
                                  : undefined,
                              leads: h.leads
                                .filter((l: any) => selected[l.id])
                                .map((l: any) => ({
                                  id: l.id,
                                  fingerprint: l.fingerprint,
                                })),
                              taskIds: h.tasks
                                .filter((x: any) => selected[x.id])
                                .map((x: any) => x.id),
                              complete: h.customerCount + h.taskCount === 0,
                            },
                          );
                          clearCaseDraft(h);
                          await load();
                          window.dispatchEvent(
                            new Event("uper-access-changed"),
                          );
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {h.customerCount + h.taskCount === 0
                        ? t(
                            "Confirm handover complete",
                            "Konfirmasi selesai",
                            "确认交接完成",
                          )
                        : t(
                            "Transfer selected work",
                            "Alihkan pekerjaan terpilih",
                            "交接所选事项",
                          )}
                    </button>
                  </>
                )}
              </section>
            );
          })}
        <AccessOperationStatus
          actor={actor.id}
          lang={lang}
          onResolved={({ state, url: operationUrl }) => {
            setError("");
            const h = cases.find(
              (h) => operationUrl === "/api/crm/access-handovers/" + h.id,
            );
            if (h && state === "committed") clearCaseDraft(h);
            void load();
          }}
        />
      </details>
    </section>
  );
}
export function AccessSafetyPanel({
  actor,
  lang,
  isLight,
}: {
  actor: CrmEmployee;
  lang: CrmLanguage;
  isLight: boolean;
}) {
  const [state, setState] = useState<any>(null),
    [released, setReleased] = useState(false),
    [error, setError] = useState(""),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false);
  const t = (en: string, id: string, zh: string) => adminText(lang, en, id, zh);
  const full = [
    "access.read",
    "access.users",
    "access.roles",
    "access.sessions",
    "access.audit",
  ].every((p) => actor.permissions.includes(p));
  const load = async () => {
    try {
      setState(await read("/api/admin/access/restore"));
      setConfirmed(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    if (full) void load();
    const refresh = () => {
      if (full) void load();
    };
    window.addEventListener("uper-access-changed", refresh);
    return () => window.removeEventListener("uper-access-changed", refresh);
  }, [actor.id, full]);
  const action = async (path: string, body: any) => {
    setBusy(true);
    setError("");
    try {
      const saved = await managementRequest(
        actor.id,
        "/api/admin/access/restore/" + path,
        {
          restoreId: state.restoreId,
          reason,
          ...body,
        },
      );
      if (saved.released) {
        setReleased(true);
        setState(null);
      } else {
        await load();
        window.dispatchEvent(new Event("uper-access-changed"));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {error && <p role="alert">{accessError(error, lang)}</p>}
      {released && (
        <p role="status">
          {t(
            "Review released. Sign in again with your new credentials.",
            "Tinjauan selesai. Login kembali dengan kredensial baru.",
            "复核已放行，请使用新凭据重新登录。",
          )}
          <button onClick={() => window.location.reload()}>
            {t("Sign in again", "Login kembali", "重新登录")}
          </button>
        </p>
      )}
      {full && !released && (
        <AccessRecoveryPreparation
          actor={actor.id}
          lang={lang}
          isLight={isLight}
          queryOnly={!!state?.required}
        />
      )}
      {state?.required && (
        <section
          className="access-card access-safety-surface"
          data-theme={isLight ? "light" : "dark"}
          aria-label={t(
            "Restore security review",
            "Tinjauan keamanan pemulihan",
            "恢复安全复核",
          )}
        >
          <h2>
            {t(
              "Business access is locked for restore review",
              "Akses bisnis dikunci untuk tinjauan pemulihan",
              "恢复待复核，业务访问已锁定",
            )}
          </h2>
          <button type="button" disabled={busy} onClick={() => void load()}>
            {t("Refresh review", "Muat ulang tinjauan", "刷新复核")}
          </button>
          <p>
            {t(
              "Compare the latest trusted authorization checkpoint, or explicitly review every account. Active accounts require a fresh password reset. Old notifications remain held.",
              "Bandingkan checkpoint izin terpercaya terbaru atau tinjau setiap akun secara eksplisit. Akun aktif harus direset kata sandinya. Notifikasi lama tetap ditahan.",
              "请核对最新可信授权清单；没有可信清单时须逐人明确复核。启用账号必须先重置凭据，历史通知继续保持暂停。",
            )}
          </p>
          <p>
            {t(
              "Complete system administrators",
              "Administrator sistem lengkap",
              "完整系统管理员",
            )}
            ：{state.administratorCount} / 2
          </p>
          <p>
            {t(
              "Historical notifications stay held after release",
              "Notifikasi historis tetap ditahan setelah akses dibuka",
              "放行后历史通知仍保持暂停",
            )}
            ：
            {state.historicalNotificationHolds
              ?.map(
                (h: any) =>
                  `${h.kind === "job" ? t("Notifications", "Notifikasi", "通知") : h.kind === "event" ? t("Events", "Peristiwa", "事件") : t("Tasks", "Tugas", "任务")}: ${h.count}`,
              )
              .join(" · ")}
          </p>
          <label>
            {t(
              "Review evidence and reason",
              "Bukti dan alasan peninjauan",
              "复核依据及原因",
            )}
            <textarea
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {t(
              "I have verified the intended authorization independently.",
              "Saya telah memverifikasi izin yang semestinya secara independen.",
              "我已独立核对本次应生效的授权。",
            )}
          </label>
          {state.users.map((u: any) => (
            <p key={u.id}>
              {u.name} ·{" "}
              {u.roles
                .map(
                  (id: string) =>
                    u.roleLabels?.[id]?.[
                      lang === "zh" ? 2 : lang === "id" ? 1 : 0
                    ] || id,
                )
                .join(" · ")}{" "}
              ·{" "}
              {u.reviewed
                ? t("Reviewed", "Ditinjau", "已复核")
                : u.reset || !u.active
                  ? t(
                      "Authorization review required",
                      "Perlu tinjauan izin",
                      "待核对授权",
                    )
                  : t(
                      "Reset password first",
                      "Reset kata sandi dahulu",
                      "须先重置密码",
                    )}{" "}
              {!u.reviewed && (
                <button
                  disabled={
                    busy ||
                    !reason.trim() ||
                    !confirmed ||
                    (u.active && !u.reset)
                  }
                  onClick={() =>
                    void action("review", {
                      userId: u.id,
                      authorizationStamp: u.authorizationStamp,
                      confirmAuthorization: true,
                    })
                  }
                >
                  {t(
                    "Confirm this account",
                    "Konfirmasi akun ini",
                    "确认此账号",
                  )}
                </button>
              )}
            </p>
          ))}
          <button
            disabled={
              busy ||
              !reason.trim() ||
              !confirmed ||
              state.users.some((u: any) => !u.reviewed) ||
              state.administratorCount < 2
            }
            onClick={() => void action("release", {})}
          >
            {t(
              "Release reviewed business access",
              "Buka akses bisnis yang telah ditinjau",
              "解除已复核业务访问限制",
            )}
          </button>
        </section>
      )}
      {actor.permissions.includes("access.read") && (
        <AccessHandoverPanel
          actor={actor}
          lang={lang}
          isLight={isLight}
          system
        />
      )}
    </>
  );
}
