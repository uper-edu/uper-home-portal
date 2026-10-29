import {AdminField,AdminRequiredNote,AdminFieldLabel} from './AdminForm';
import { useEffect, useState } from "react";
import { adminText } from "./AdminHeader";
import { CrmSingleSelect } from "./crm/CrmSingleSelect";
import { managementRequest } from "../utils/accessOperationClient";
import { accessError } from "../utils/accessLanguage";
import type { CrmLanguage } from "../utils/crmLanguage";
export function AccessRecoveryPreparation({
  actor,
  lang,
  isLight,
  queryOnly = false,
}: {
  actor: string;
  lang: CrmLanguage;
  isLight: boolean;
  queryOnly?: boolean;
}) {
  const [info, setInfo] = useState<any>(null),
    [userId, setUserId] = useState(""),
    [reason, setReason] = useState(""),
    [database, setDatabase] = useState(""),
    [backupHash, setBackupHash] = useState(""),
    [enable, setEnable] = useState(false),
    [restore, setRestore] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [download, setDownload] = useState(""),
    [query, setQuery] = useState(""),
    [outcome, setOutcome] = useState<any>(null);
  const t = (en: string, id: string, zh: string) => adminText(lang, en, id, zh);
  useEffect(() => {
    let live = true;
    fetch("/api/admin/access/recovery", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (live) {
          setInfo(d);
          setDatabase(d.target.database);
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [actor]);
  useEffect(
    () => () => {
      if (download) URL.revokeObjectURL(download);
    },
    [download],
  );
  // A changed scope must never keep an earlier authorization download visible.
  useEffect(() => {
    setDownload("");
  }, [userId, reason, database, backupHash, enable, restore]);
  return (
    <section data-admin-form=""
      className="access-card access-safety-surface"
      data-theme={isLight ? "light" : "dark"}
    >
      <details>
        <summary>
          {t(
            "Recovery preparation and results",
            "Persiapan dan hasil pemulihan",
            "恢复准备与结果查询",
          )}
        </summary>
        <p>
          {queryOnly
            ? t(
                "Check the recovery operation ID before resetting again. Business access remains locked until review is released.",
                "Periksa ID operasi pemulihan sebelum mereset lagi. Akses bisnis tetap dikunci hingga tinjauan selesai.",
                "重复重置前请先查询恢复操作ID。复核放行前，业务访问仍保持锁定。",
              )
            : t(
                "Prepare authorization while an administrator can sign in. This file does not reset credentials or unlock business access.",
                "Siapkan izin saat administrator masih dapat login. Berkas ini tidak mereset kredensial atau membuka akses bisnis.",
                "请在管理员仍可登录时准备授权。生成文件不会重置密码，也不会解除业务访问限制。",
              )}
        </p>
        {info && (
          <p>
            {t(
              "Complete system administrators",
              "Administrator sistem lengkap",
              "完整系统管理员",
            )}
            ：{info.administrators.map((u: any) => u.name).join("、")} (
            {info.administrators.length})
          </p>
        )}
        {info?.administrators.length < 2 && (
          <p role="status">
            {t(
              "Arrange a second authorized administrator before release.",
              "Siapkan administrator kedua yang berwenang sebelum membuka akses.",
              "放行前请安排第二位有权系统管理员。",
            )}
          </p>
        )}
        {error && <p role="alert">{accessError(error, lang)}</p>}
        {!queryOnly && (
          <>
            <AdminRequiredNote lang={lang}/><AdminFieldLabel required>{t("Recovery account", "Akun pemulihan", "恢复账号")}</AdminFieldLabel>
            <CrmSingleSelect
              required
              label={t("Recovery account", "Akun pemulihan", "恢复账号")}
              value={userId}
              options={[
                {
                  value: "",
                  label: t(
                    "Select a recovery account",
                    "Pilih akun pemulihan",
                    "请选择恢复账号",
                  ),
                  disabled: true,
                },
                ...(info?.users || []).map((u: any) => ({
                  value: u.id,
                  label: u.name,
                })),
              ]}
              onChange={setUserId}
              searchable
              lang={lang}
              isLight={isLight}
            />
            <AdminField>
              {t("Approval reason", "Alasan persetujuan", "授权原因")}
              <textarea
                required
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
              />
            </AdminField>
            <AdminField>
              <input
                type="checkbox"
                checked={enable}
                onChange={(e) => setEnable(e.target.checked)}
              />
              {t(
                "Allow re-enabling this account",
                "Izinkan mengaktifkan kembali akun ini",
                "允许重新启用此账号",
              )}
            </AdminField>
            <AdminField>
              <input
                type="checkbox"
                checked={restore}
                onChange={(e) => setRestore(e.target.checked)}
              />
              {t(
                "Explicitly allow restoring system administration permissions",
                "Izinkan pemulihan izin administrasi sistem secara eksplisit",
                "明确允许恢复系统管理权限",
              )}
            </AdminField>
            <AdminField>
              {t("Target database", "Basis data tujuan", "目标数据库")}
              <input
                required
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
              />
            </AdminField>
            <AdminField required={database!==info?.target.database}>
              {t(
                "Backup SHA-256",
                "SHA-256 cadangan",
                "备份SHA-256",
              )}
              <input
                value={backupHash}
                onChange={(e) => setBackupHash(e.target.value.trim())}
              />
            </AdminField>
            <button
              disabled={
                busy ||
                !userId ||
                !reason.trim() ||
                !database ||
                !!(
                  database !== info?.target.database &&
                  !/^[a-f0-9]{64}$/.test(backupHash)
                )
              }
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const d = await managementRequest(
                    actor,
                    "/api/admin/access/recovery/authorize",
                    {
                      userId,
                      reason,
                      enableAccount: enable,
                      restoreSystemAccess: restore,
                      targetDatabase: database,
                      backupSha256: backupHash || undefined,
                    },
                  );
                  setDownload(
                    URL.createObjectURL(
                      new Blob([JSON.stringify(d.authorization, null, 2)], {
                        type: "application/json",
                      }),
                    ),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t(
                "Prepare one-hour recovery authorization",
                "Siapkan izin pemulihan satu jam",
                "生成一小时有效恢复授权",
              )}
            </button>
            {download && (
              <p>
                <a href={download} download="uper-recovery-authorization.json">
                  {t(
                    "Download private authorization file",
                    "Unduh berkas izin privat",
                    "下载私密授权文件",
                  )}
                </a>{" "}
                ·{" "}
                {t(
                  "Store privately with file mode 0600. Never share it in chat.",
                  "Simpan privat dengan mode berkas 0600. Jangan bagikan lewat chat.",
                  "请私密保存并设置文件权限0600，不要发送到聊天。",
                )}
              </p>
            )}
          </>
        )}
        <hr />
        <AdminField>
          {t("Recovery operation ID", "ID operasi pemulihan", "恢复操作ID")}
          <input
            required
            value={query}
            onChange={(e) => {
              setQuery(e.target.value.trim());
              setOutcome(null);
            }}
          />
        </AdminField>
        <button
          disabled={busy || !/^[a-f0-9-]{36}$/.test(query)}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const r = await fetch(
                "/api/crm/auth/operations/" + query + "?actor=offline-recovery",
                { cache: "no-store" },
              );
              const d = await r.json();
              if (!r.ok) throw Error(d.error);
              setOutcome(d);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t(
            "Check recovery result",
            "Periksa hasil pemulihan",
            "查询恢复结果",
          )}
        </button>
        {outcome && (
          <p role="status">
            {outcome.state === "historical"
              ? t(
                  "Historical receipt; it does not confirm recovery in this environment.",
                  "Bukti historis; bukan konfirmasi pemulihan di lingkungan ini.",
                  "这是历史凭证，不能证明当前环境已恢复。",
                )
              : outcome.state === "committed"
                ? t(
                    "Recovery committed; no further reset is needed.",
                    "Pemulihan tersimpan; tidak perlu reset lagi.",
                    "恢复已提交，不需要重复重置。",
                  )
                : outcome.state === "cancelled"
                  ? t(
                      "Closed before commit; delayed requests cannot execute.",
                      "Ditutup sebelum tersimpan; permintaan tertunda tidak dapat dijalankan.",
                      "已在提交前关闭，迟到请求不会执行。",
                    )
                  : t(
                      "Unconfirmed. Keep the operation ID; do not assume the reset failed.",
                      "Belum pasti. Simpan ID operasi; jangan anggap reset gagal.",
                      "尚未确认，请保留操作ID，不能据此认定重置失败。",
                    )}
          </p>
        )}
      </details>
    </section>
  );
}
