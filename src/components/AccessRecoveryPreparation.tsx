import {AdminFormSection,AdminFormActions,AdminFormFeedback} from './AdminFormLayout';
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
  onDraft,onBusy,
}: {
  actor: string;
  lang: CrmLanguage;
  isLight: boolean;
  queryOnly?: boolean;
  onDraft?: (dirty:boolean)=>void;
  onBusy?: (busy:boolean)=>void;
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
    [queryError, setQueryError] = useState<"unavailable" | "not-found" | "failed">(),
    [outcome, setOutcome] = useState<any>(null);
  const t = (en: string, id: string, zh: string) => adminText(lang, en, id, zh);
  useEffect(() => {
    if(queryOnly)return;
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
  }, [actor,queryOnly]);
  useEffect(
    () => () => {
      if (download) URL.revokeObjectURL(download);
    },
    [download],
  );
  useEffect(()=>{
    onDraft?.(!queryOnly&&!download&&Boolean(userId||reason||backupHash||enable||restore||(info&&database!==info.target.database)));
    return ()=>onDraft?.(false);
  },[queryOnly,userId,reason,database,backupHash,enable,restore,info,download,onDraft]);
  useEffect(()=>{
    onBusy?.(busy);
    return ()=>onBusy?.(false);
  },[busy,onBusy]);
  // A changed scope must never keep an earlier authorization download visible.
  useEffect(() => {
    setDownload("");
  }, [userId, reason, database, backupHash, enable, restore]);
  return (
    <div data-admin-form="" className="access-recovery-sections" data-theme={isLight?"light":"dark"}>
      {!queryOnly&&<AdminFormSection variant="card" title={t('Issue recovery authorization','Terbitkan izin pemulihan','签发恢复授权')}
        actions={<AdminRequiredNote lang={lang} inline/>}
        description={t('Prepare a one-hour authorization for a trusted operator. Issuing it does not change the password or unlock business access.',
          'Siapkan izin satu jam bagi operator tepercaya. Penerbitan tidak mengubah sandi atau membuka akses bisnis.',
          '为可信运维人员签发一小时有效的授权。签发后，密码和业务访问状态保持原样。')}>
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
        <AdminFieldLabel required>{t("Recovery account", "Akun pemulihan", "恢复账号")}</AdminFieldLabel>
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
        <AdminFormActions><button type="button" data-primary
          disabled={
            busy || !info ||
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
        </button></AdminFormActions>
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
      </AdminFormSection>}
      <AdminFormSection variant="card" title={t('Check recovery result','Periksa hasil pemulihan','查询恢复结果')}
        actions={<AdminRequiredNote lang={lang} inline/>}
        description={t('Use the operation ID to check whether recovery was committed before trying again.',
          'Gunakan ID operasi untuk memeriksa hasil pemulihan sebelum mencoba lagi.',
          '请凭恢复操作 ID 核对恢复是否已提交，再决定下一步。')}>
        <AdminField>
          {t("Recovery operation ID", "ID operasi pemulihan", "恢复操作ID")}
          <input
            required
            disabled={busy}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value.trim());
              setQueryError(undefined);
              setOutcome(null);
            }}
          />
        </AdminField>
        <AdminFormActions><button type="button" data-primary
          disabled={busy || !/^[a-f0-9-]{36}$/.test(query)}
          onClick={async () => {
            setBusy(true);
            setQueryError(undefined);
            setOutcome(null);
            try {
              const r = await fetch(
                "/api/crm/auth/operations/" + query + "?actor=offline-recovery",
                { cache: "no-store" },
              );
              if (!r.ok) {
                setQueryError(r.status === 404 ? "not-found" : r.status === 503 ? "unavailable" : "failed");
                return;
              }
              setOutcome(await r.json());
            } catch {
              setQueryError("failed");
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
        </button></AdminFormActions>
        {queryError && (
          <AdminFormFeedback state="error" lang={lang}>
            {queryError === "not-found"
              ? t("Recovery operation not found. Check the operation ID and query again.",
                  "Operasi pemulihan tidak ditemukan. Periksa ID operasi lalu coba lagi.",
                  "未查到恢复操作。请核对操作 ID 后再次查询。")
              : queryError === "unavailable"
                ? t("Recovery result lookup is temporarily unavailable. Please try again later.",
                    "Pemeriksaan hasil pemulihan sementara tidak tersedia. Silakan coba lagi nanti.",
                    "恢复结果查询暂不可用，请稍后重试。")
                : t("Unable to query the recovery result. Please try again.",
                    "Hasil pemulihan tidak dapat diperiksa. Silakan coba lagi.",
                    "恢复结果查询失败，请重试。")}
          </AdminFormFeedback>
        )}
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
      </AdminFormSection>
      {error&&<AdminFormFeedback state="error" lang={lang}>{accessError(error,lang)}</AdminFormFeedback>}
    </div>
  );
}
