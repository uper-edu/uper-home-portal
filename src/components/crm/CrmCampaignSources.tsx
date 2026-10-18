import React, { useEffect, useState, useRef } from "react";
import { CrmSingleSelect as CrmSelect } from "./CrmSingleSelect";
export function CrmCampaignSources({
  lang,
  isLight,
  campaigns,
  onChanged,
  onLead,
}: {
  lang: "en" | "id" | "zh";
  isLight: boolean;
  campaigns: any[];
  onChanged: () => void;
  onLead?: (id: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const t = (en: string, id: string, zh: string) => ({ en, id, zh })[lang];
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [active, setActive] = useState<any>(null),
    [action, setAction] = useState("link"),
    [target, setTarget] = useState(""),
    [name, setName] = useState(""),
    [type, setType] = useState("other"),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState<any>(null),
    [history, setHistory] = useState(false),
    [requestId, setRequestId] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/crm/campaigns/sources");
      if (!r.ok) throw Error();
      setRows((await r.json()).sources);
    } catch {
      setError(
        t(
          "Source data unavailable. Retry.",
          "Data sumber tidak tersedia. Coba lagi.",
          "来源数据暂不可用，请重试。",
        ),
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (active) {
      formRef.current?.focus({ preventScroll: true });
      formRef.current?.scrollIntoView({ block: "center" });
    }
  }, [active]);
  function edit(r: any) {
    setActive(r);
    setReceipt(null);
    setError("");
    setAction("link");
    setTarget("");
    setName("");
    setType("other");
    setReason("");
    setRequestId(crypto.randomUUID());
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        "/api/crm/campaigns/sources/" + active.id + "/review",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            campaignId: target,
            name,
            type,
            reason,
            revision: active.revision,
            requestId,
          }),
        },
      );
      if (!r.ok) {
        if (r.status === 409)
          setError(
            t(
              "Source changed. Refresh before reviewing again.",
              "Sumber berubah. Muat ulang sebelum meninjau lagi.",
              "来源已变化，请刷新后重新核实。",
            ),
          );
        else
          setError(
            t(
              "Could not save. Check your permission, target and inputs; your draft is kept.",
              "Gagal menyimpan. Periksa izin, kampanye, dan isian; draf tetap tersimpan.",
              "保存失败，请核对权限、目标活动与输入；草稿已保留。",
            ),
          );
        return;
      }
      setReceipt(await r.json());
      setActive(null);
      await load();
      onChanged();
    } catch {
      setError(
        t(
          "Connection interrupted. Retry uses the same request ID.",
          "Koneksi terputus. Percobaan ulang memakai ID permintaan yang sama.",
          "连接中断，重试将使用同一请求ID。",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  const visible = rows.filter((r) =>
    history ? r.status !== "pending" : r.status === "pending",
  );
  return (
    <section
      className="rounded-2xl border border-slate-300/50 p-4 space-y-3"
      aria-label={t("Source verification", "Verifikasi sumber", "来源核实")}
    >
      <div className="flex flex-wrap gap-3 items-center">
        <h2 className="font-bold">
          {t("Unverified sources", "Sumber belum diverifikasi", "待核实来源")} (
          {rows.filter((r) => r.status === "pending").length})
        </h2>
        <button
          type="button"
          className="underline"
          onClick={() => setHistory(!history)}
        >
          {history
            ? t("Pending", "Belum diproses", "待核实")
            : t("Review history", "Riwayat verifikasi", "核实历史")}
        </button>
        <button type="button" onClick={load} className="underline">
          {t("Refresh", "Muat ulang", "刷新")}
        </button>
      </div>
      <p className="text-sm">
        {t(
          "Only sources with saved leads appear. Verification changes attribution, not the original code, owner or tasks.",
          "Hanya sumber dengan prospek tersimpan yang muncul. Verifikasi mengubah atribusi, bukan kode asli, pemilik, atau tugas.",
          "仅显示已生成客户的来源。核实只调整归因关联，保留原始代码、负责人和任务。",
        )}
      </p>
      {loading && <p role="status">{t("Loading…", "Memuat…", "加载中…")}</p>}
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {!loading && !error && !visible.length && (
        <p>
          {t(
            "No sources in this view.",
            "Tidak ada sumber pada tampilan ini.",
            "当前没有此类来源。",
          )}
        </p>
      )}
      {visible.map((r) => (
        <article key={r.id} className="border rounded-xl p-3 space-y-2">
          <div className="flex flex-wrap justify-between gap-2">
            <strong className="break-all">{r.rawCode}</strong>
            <span>
              {r.status === "pending"
                ? t("Unverified", "Belum diverifikasi", "待核实")
                : r.status === "invalid"
                  ? t("Invalid source", "Sumber tidak valid", "无效来源")
                  : t("Linked", "Tertaut", "已关联")}
            </span>
          </div>
          <p>
            {t("Saved leads", "Prospek tersimpan", "已登记客户")}：{r.leadCount}
          </p>
          <p className="text-sm">
            {t(
              "First / latest registration",
              "Pendaftaran pertama / terakhir",
              "首次／最近登记",
            )}{" "}
            (Asia/Jakarta)：
            {r.firstSeen
              ? new Date(r.firstSeen).toLocaleString(
                  lang === "zh" ? "zh-CN" : lang === "id" ? "id-ID" : "en-GB",
                  { timeZone: "Asia/Jakarta" },
                )
              : "—"}{" "}
            /{" "}
            {r.lastSeen
              ? new Date(r.lastSeen).toLocaleString(
                  lang === "zh" ? "zh-CN" : lang === "id" ? "id-ID" : "en-GB",
                  { timeZone: "Asia/Jakarta" },
                )
              : "—"}
          </p>
          <div className="flex flex-wrap gap-2">
            {r.leads.map((l: any) => (
              <button
                type="button"
                className="underline break-all"
                key={l.id}
                onClick={() => onLead?.(l.id)}
              >
                {l.name}
              </button>
            ))}
          </div>
          {r.reason && (
            <p>
              {r.reason} · {r.actor}
            </p>
          )}
          {r.campaignId && (
            <p>
              {t("Campaign", "Kampanye", "活动")}：
              {campaigns.find((c) => c.id === r.campaignId)?.name ||
                r.campaignId}
            </p>
          )}
          {r.status === "pending" && (
            <button
              type="button"
              className="rounded-lg px-3 py-2 bg-teal-700 text-white"
              onClick={() => edit(r)}
            >
              {t("Review source", "Verifikasi sumber", "核实来源")}
            </button>
          )}
        </article>
      ))}
      {active && (
        <form
          ref={formRef}
          tabIndex={-1}
          onSubmit={save}
          className="border rounded-xl p-4 space-y-3"
          aria-label={t("Review source", "Verifikasi sumber", "核实来源")}
        >
          <h3 className="font-bold break-all">{active.rawCode}</h3>
          <p>
            {t("Affected leads", "Prospek terdampak", "影响客户数")}：
            {active.leadCount}
          </p>
          <CrmSelect
            lang={lang}
            isLight={isLight}
            label={t("Action", "Tindakan", "处理方式")}
            value={action}
            onChange={(v) => {
              setAction(v);
              setRequestId(crypto.randomUUID());
            }}
            options={[
              {
                value: "link",
                label: t(
                  "Link existing campaign",
                  "Tautkan kampanye yang ada",
                  "关联已有活动",
                ),
              },
              {
                value: "create",
                label: t(
                  "Create campaign and link",
                  "Buat dan tautkan kampanye",
                  "创建新活动并关联",
                ),
              },
              {
                value: "invalid",
                label: t("Mark invalid", "Tandai tidak valid", "标记无效"),
              },
            ]}
          />
          {action === "link" && (
            <CrmSelect
              lang={lang}
              isLight={isLight}
              label={t("Target campaign", "Kampanye tujuan", "目标活动")}
              value={target}
              onChange={(v) => {
                setTarget(v);
                setRequestId(crypto.randomUUID());
              }}
              options={[
                {
                  value: "",
                  label: t("Choose a campaign", "Pilih kampanye", "选择活动"),
                },
                ...campaigns.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          )}
          {action === "create" && (
            <>
              <label className="block">
                {t("Campaign name", "Nama kampanye", "活动名称")}
                <input
                  required
                  maxLength={200}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setRequestId(crypto.randomUUID());
                  }}
                  className="block w-full border rounded-lg p-2 bg-transparent"
                />
              </label>
              <CrmSelect
                lang={lang}
                isLight={isLight}
                label={t("Campaign type", "Jenis kampanye", "活动类型")}
                value={type}
                onChange={(v) => {
                  setType(v);
                  setRequestId(crypto.randomUUID());
                }}
                options={[
                  {
                    value: "other",
                    label: t(
                      "Other / unspecified",
                      "Lainnya / belum ditentukan",
                      "其他／未明确",
                    ),
                  },
                  {
                    value: "campus_seminar",
                    label: t("Campus seminar", "Seminar kampus", "校园讲座"),
                  },
                  {
                    value: "enterprise_roadshow",
                    label: t(
                      "Enterprise roadshow",
                      "Roadshow perusahaan",
                      "企业路演",
                    ),
                  },
                  {
                    value: "webinar_class",
                    label: t("Webinar", "Webinar", "线上研讨会"),
                  },
                  {
                    value: "education_fair",
                    label: t("Education fair", "Pameran pendidikan", "教育展"),
                  },
                ]}
              />
              <p className="text-sm">
                {t(
                  "Creates a planning campaign with a new code. Complete its details in the campaign editor.",
                  "Membuat kampanye perencanaan dengan kode baru. Lengkapi rinciannya di editor kampanye.",
                  "创建筹备中的活动并生成新代码；其他信息可在活动编辑中补充。",
                )}
              </p>
            </>
          )}
          <label className="block">
            {t("Reason", "Alasan", "核实依据")}
            <textarea
              required
              maxLength={1000}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setRequestId(crypto.randomUUID());
              }}
              className="block w-full border rounded-lg p-2 bg-transparent"
            />
          </label>
          <p>
            {t(
              "The original code and audit record are retained. Invalid sources do not delete leads or become organic traffic.",
              "Kode asli dan audit tetap disimpan. Sumber tidak valid tidak menghapus prospek atau menjadi trafik organik.",
              "原始代码及审计保留；标记无效不会删除客户或归入自然流量。",
            )}
          </p>
          <div className="flex gap-3">
            <button
              disabled={
                busy || !reason.trim() || (action === "link" && !target)
              }
              className="bg-teal-700 text-white rounded-lg px-3 py-2 disabled:opacity-50"
            >
              {busy
                ? t("Saving…", "Menyimpan…", "保存中…")
                : t("Confirm review", "Konfirmasi verifikasi", "确认核实")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setActive(null)}
            >
              {t("Cancel", "Batal", "取消")}
            </button>
          </div>
        </form>
      )}
      {receipt && (
        <p role="status">
          {t(
            "Source review saved. Affected leads",
            "Verifikasi tersimpan. Prospek terdampak",
            "来源核实已保存，影响客户数",
          )}
          ：{receipt.affectedLeads}
        </p>
      )}
    </section>
  );
}
