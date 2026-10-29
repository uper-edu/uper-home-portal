import { useEffect, useState } from "react";
import "./access-safety.css";
import { adminText } from "./AdminHeader";
import type { CrmLanguage } from "../utils/crmLanguage";
import {
  forgetAccessOperation,
  pendingAccessOperations,
} from "../utils/accessOperationClient";
export function AccessOperationStatus({
  actor,
  lang,
  onResolved,
}: {
  actor: string;
  lang: CrmLanguage;
  onResolved?: (result: {
    state: "committed" | "cancelled";
    url: string;
    operationId: string;
  }) => void;
}) {
  const [pending, setPending] = useState(() => pendingAccessOperations(actor)),
    [message, setMessage] = useState(""),
    [unconfirmed, setUnconfirmed] = useState<Record<string, boolean>>({}),
    [reasons, setReasons] = useState<Record<string, string>>({}),
    [closing, setClosing] = useState(false);
  const t = (en: string, id: string, zh: string) => adminText(lang, en, id, zh);
  useEffect(() => setMessage(""), [lang]);
  useEffect(() => {
    const sync = () => setPending(pendingAccessOperations(actor));
    window.addEventListener("uper-access-operation", sync);
    sync();
    return () => window.removeEventListener("uper-access-operation", sync);
  }, [actor]);
  if (!pending.length && !message) return null;
  return (
    <aside
      className="access-impact access-operation-status"
      aria-label={t(
        "Management operation results",
        "Hasil operasi pengelolaan",
        "管理操作结果",
      )}
    >
      <p role="status">
        {message ||
          t(
            "An operation needs confirmation. Check the result before submitting different changes.",
            "Hasil operasi perlu dipastikan. Periksa sebelum mengirim perubahan lain.",
            "有操作结果尚待确认，请先查询，再提交其他修改。",
          )}
      </p>
      {pending.map((p) => (
        <div data-admin-form="" key={p.operationId}>
          <small>{p.operationId}</small>
          <button
            type="button"
            onClick={async () => {
              try {
                const r = await fetch(
                  "/api/crm/auth/operations/" + p.operationId,
                  { cache: "no-store" },
                );
                if (!r.ok) throw Error();
                const d = await r.json();
                if (d.state === "committed" || d.state === "cancelled") {
                  forgetAccessOperation(p.operationId);
                  onResolved?.({
                    state: d.state,
                    url: p.url,
                    operationId: p.operationId,
                  });
                  setMessage(
                    d.state === "cancelled"
                      ? t(
                          "Closed before commit. Reload the current record, then start a new operation.",
                          "Ditutup sebelum tersimpan. Muat ulang data terbaru, lalu mulai operasi baru.",
                          "已在提交前关闭，请载入当前记录，再开始新操作。",
                        )
                      : t(
                          "Committed. Reload the saved record to review the actual result.",
                          "Tersimpan. Muat ulang data untuk meninjau hasil sebenarnya.",
                          "已提交成功，请重新载入记录核对实际结果。",
                        ),
                  );
                } else {
                  setUnconfirmed((v) => ({ ...v, [p.operationId]: true }));
                  setMessage(
                    t(
                      "Not confirmed. It may still be processing; keep this operation ID and check again.",
                      "Belum dapat dipastikan; operasi mungkin masih berjalan. Simpan ID dan periksa lagi.",
                      "尚未确认，原操作可能仍在处理；请保留操作ID并稍后查询。",
                    ),
                  );
                }
              } catch {
                setMessage(
                  t(
                    "Result unavailable. Sign in again if required, then check; do not repeat with a new operation ID.",
                    "Hasil belum tersedia. Login kembali bila perlu, lalu periksa; jangan mengulangi dengan ID baru.",
                    "暂无法查询；如需请重新登录后核对，不要换新操作ID重复执行。",
                  ),
                );
              }
            }}
          >
            {t("Check result", "Periksa hasil", "查询结果")}
          </button>
          {unconfirmed[p.operationId] && (
            <section>
              <p>
                {t(
                  "To replace a lost draft, close this unresolved operation first. The server will either return its committed result or prevent any delayed request from committing.",
                  "Untuk mengganti draf yang hilang, tutup operasi belum pasti ini dahulu. Server akan menampilkan hasil tersimpan atau mencegah permintaan tertunda tersimpan.",
                  "草稿丢失后，先关闭这项未确认操作。服务端会返回已提交结果，或阻止迟到的原请求再提交。",
                )}
              </p>
              <label className="admin-field">
                {t("Reason for closing", "Alasan penutupan", "关闭原因")}
                <input
                  value={reasons[p.operationId] || ""}
                  maxLength={500}
                  onChange={(e) =>
                    setReasons((v) => ({
                      ...v,
                      [p.operationId]: e.target.value,
                    }))
                  }
                />
              </label>
              <button
                type="button"
                disabled={closing || !reasons[p.operationId]?.trim()}
                onClick={async () => {
                  setClosing(true);
                  try {
                    const r = await fetch(
                      "/api/crm/auth/operations/" + p.operationId + "/close",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          url: p.url,
                          reason: reasons[p.operationId],
                        }),
                        cache: "no-store",
                      },
                    );
                    if (!r.ok) throw Error();
                    const d = await r.json();
                    if (!["committed", "cancelled"].includes(d.state))
                      throw Error();
                    forgetAccessOperation(p.operationId);
                    onResolved?.({
                      state: d.state,
                      url: p.url,
                      operationId: p.operationId,
                    });
                    setMessage(
                      d.state === "committed"
                        ? t(
                            "The original operation already committed. Reload the saved record; no saved change was cancelled.",
                            "Operasi awal sudah tersimpan. Muat ulang data; perubahan tersimpan tidak dibatalkan.",
                            "原操作已经提交，请载入实际记录；已保存的改动没有被撤销。",
                          )
                        : t(
                            "Closed before commit. Delayed requests cannot execute. Reload the current record before creating a new operation.",
                            "Ditutup sebelum tersimpan. Permintaan tertunda tidak dapat dijalankan. Muat ulang data sebelum membuat operasi baru.",
                            "已在提交前关闭，迟到请求不会再执行。请载入当前记录，再创建新操作。",
                          ),
                    );
                  } catch {
                    setMessage(
                      t(
                        "Outcome still unconfirmed. Keep the same operation ID and check again.",
                        "Hasil masih belum pasti. Simpan ID operasi yang sama dan periksa lagi.",
                        "结果仍未确认，请保留同一操作ID并继续查询。",
                      ),
                    );
                  } finally {
                    setClosing(false);
                  }
                }}
              >
                {t(
                  "Close uncommitted operation",
                  "Tutup operasi belum tersimpan",
                  "关闭未提交操作",
                )}
              </button>
            </section>
          )}
        </div>
      ))}
    </aside>
  );
}
