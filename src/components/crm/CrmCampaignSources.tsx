import {CrmFormLayoutScope} from '../AdminForm';
import {crmFormText} from '../../utils/crmFormLanguage';
import {X} from 'lucide-react';
import {CrmDiscardDialog} from './CrmDetailWorkspace';
import {AdminFormSection,AdminFormActions} from '../AdminFormLayout';
import {AdminField,AdminFieldLabel,AdminRequiredNote,AdminForm} from '../AdminForm';
import { campaignUi } from "../../utils/campaignI18n";
import { CrmPromotionReviews } from "./CrmPromotionReviews";
import { CampaignSourceEvidence } from "./CampaignSourceEvidence";
import React, { useEffect, useRef, useState } from "react";
import { CrmSingleSelect as CrmSelect } from "./CrmSingleSelect";
interface SourceProps {
  initialIssue?: string;
  promotionCampaign?: { id: string; name: string };
  onClearPromotionCampaign?: () => void;
  lang: "en" | "id" | "zh";
  isLight: boolean;
  campaigns: any[];
  onChanged: () => void;
  onLead?: (id: string) => void;
  onStateChange?: (state: { dirty: boolean; busy: boolean }) => void;
  onCount?: (count: number | null) => void;
}
function CrmCampaignSourcesBody(props: SourceProps) {
  const u = campaignUi(props.lang);
  const [tab, setTab] = useState(
      props.initialIssue === "promotions" ? "promotions" : "campaigns",
    ),
    [version, setVersion] = useState(0),
    [campaignCount, setCampaignCount] = useState<number | null>(null),
    [promotionCount, setPromotionCount] = useState<number | null>(null);
  useEffect(() => {
    if (props.initialIssue === "promotions") setTab("promotions");
  }, [props.initialIssue, props.promotionCampaign?.id]);
  const changed = () => {
    setVersion((v) => v + 1);
    props.onChanged();
  };
  const draftStates = React.useRef(
    new Map<string, { dirty: boolean; busy: boolean }>(),
  );
  const report = (key: string, state: { dirty: boolean; busy: boolean }) => {
    draftStates.current.set(key, state);
    props.onStateChange?.({
      dirty: [...draftStates.current.values()].some((s) => s.dirty),
      busy: [...draftStates.current.values()].some((s) => s.busy),
    });
  };
  return (
    <section aria-label={u("Source review workspace")} className="space-y-4">
      <nav className="campaign-area-nav" aria-label={u("Source issue type")}>
        <button
          type="button"
          aria-current={tab === "campaigns" ? "page" : undefined}
          onClick={() => setTab("campaigns")}
        >
          {u("Unknown campaign codes") + " ("}
          {campaignCount ?? "—"})
        </button>
        <button
          type="button"
          aria-current={tab === "promotions" ? "page" : undefined}
          onClick={() => setTab("promotions")}
        >
          {u("Promotion link issues") + " ("}
          {promotionCount ?? "—"})
        </button>
      </nav>
      <div hidden={tab !== "campaigns"}>
        <UnknownCampaignSources
          {...props}
          onChanged={changed}
          onCount={setCampaignCount}
          onStateChange={(state) => report("campaigns", state)}
        />
      </div>
      <div hidden={tab !== "promotions"}>
        <CrmPromotionReviews
          lang={props.lang}
          campaignFilter={props.promotionCampaign}
          onClearCampaignFilter={props.onClearPromotionCampaign}
          isLight={props.isLight}
          onChanged={changed}
          onLead={props.onLead}
          reloadToken={version}
          onCount={setPromotionCount}
          onStateChange={(state) => report("promotions", state)}
        />
      </div>
    </section>
  );
}
function UnknownCampaignSources({
  lang,
  isLight,
  campaigns,
  onChanged,
  onLead,
  onCount,
  onStateChange,
}: SourceProps) {
  const u = campaignUi(lang);
  const t = (en: string, id: string, zh: string) => ({ en, id, zh })[lang];
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState<string[] | null>(null),
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
  const dirty =
    !!active &&
    !!(target || name || reason || type !== "other" || action !== "link");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const nextReview = useRef<any>(null);
  useEffect(() => {
    onStateChange?.({ dirty, busy });
  }, [dirty, busy]);
  useEffect(() => () => onStateChange?.({ dirty: false, busy: false }), []);
  async function load() {
    setLoading(true);
    onCount?.(null);
    setError(null);
    try {
      const r = await fetch("/api/crm/campaigns/sources");
      if (!r.ok) throw Error();
      const data = await r.json();
      setRows(data.sources);
      onCount?.(
        data.sources.filter((row: any) => row.status === "pending").length,
      );
    } catch {
      onCount?.(null);
      setError([
        "Source data unavailable. Retry.",
        "Data sumber tidak tersedia. Coba lagi.",
        "来源数据暂不可用，请重试。",
      ]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function closeReview() {
    if (dirty) {
      nextReview.current = null;
      setConfirmDiscard(true);
      return;
    }
    finishClose();
  }
  function finishClose() {
    const id = active?.id;
    setActive(null);
    requestAnimationFrame(() => {
      if (id)
        document
          .getElementById("source-review-trigger-" + id)
          ?.focus({ preventScroll: true });
    });
  }
  function requestEdit(r: any) {
    if (dirty) {
      nextReview.current = r;
      setConfirmDiscard(true);
    } else edit(r);
  }
  function edit(r: any) {
    setActive(r);
    setReceipt(null);
    setError(null);
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
    setError(null);
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
        const failure = await r.json().catch(() => ({}));
        if (failure.error === "source_code_exists")
          setError([
            "This source code already belongs to a campaign. Refresh the list and link that campaign; no new campaign was created.",
            "Kode sumber ini sudah terdaftar pada kampanye. Muat ulang daftar lalu tautkan kampanye tersebut; tidak ada kampanye baru yang dibuat.",
            "原始代码已对应现有活动。请刷新列表并关联该活动；本次未创建新活动。",
          ]);
        else if (failure.error === "source_code_invalid")
          setError([
            "This original source code cannot be verified. Link an existing campaign or mark it invalid; the original is kept.",
            "Kode asli ini tidak dapat dipakai sebagai kode kampanye. Tautkan kampanye yang ada atau tandai sumber tidak valid; kode asli tetap disimpan.",
            "原始代码无法用作活动码。请关联已有活动或标记无效；原始来源仍保留。",
          ]);
        else if(r.status===403)setError(["Source attribution review is restricted by the current policy or your campaign permissions.","Verifikasi atribusi sumber dibatasi kebijakan saat ini atau izin kampanye Anda.","当前配置或营销活动权限不允许核实归因，草稿已保留。"]);
        else if (r.status === 409)
          setError([
            "Source changed. Refresh before reviewing again.",
            "Sumber berubah. Muat ulang sebelum meninjau lagi.",
            "来源已变化，请刷新后重新核实。",
          ]);
        else
          setError([
            "Could not save. Check your permission, target and inputs; your draft is kept.",
            "Gagal menyimpan. Periksa izin, kampanye, dan isian; draf tetap tersimpan.",
            "保存失败，请核对权限、目标活动与输入；草稿已保留。",
          ]);
        return;
      }
      setReceipt(await r.json());
      setActive(null);
      await load();
      onChanged();
    } catch {
      setError([
        "Connection interrupted. Retry uses the same request ID.",
        "Koneksi terputus. Percobaan ulang memakai ID permintaan yang sama.",
        "连接中断，重试将使用同一请求ID。",
      ]);
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
          {t(
            "Unknown campaign codes",
            "Sumber belum diverifikasi",
            "待核实来源",
          )}{" "}
          ({rows.filter((r) => r.status === "pending").length})
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
        <button
          type="button"
          onClick={() => {
            load();
            onChanged();
          }}
          className="underline"
        >
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
      {error && !active && (
        <p role="alert" className="text-red-600">
          {error[{ en: 0, id: 1, zh: 2 }[lang]]}
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
        <article
          key={r.id}
          aria-label={u("Source: {code}", { code: r.rawCode })}
          data-review-open={active?.id === r.id}
          className="campaign-source-card border rounded-xl p-3 space-y-2"
        >
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
            ：{" "}
            {r.firstSeen
              ? new Date(r.firstSeen).toLocaleString(
                  lang === "zh" ? "zh-CN" : lang === "id" ? "id-ID" : "en-GB",
                  {},
                )
              : "—"}{" "}
            /{" "}
            {r.lastSeen
              ? new Date(r.lastSeen).toLocaleString(
                  lang === "zh" ? "zh-CN" : lang === "id" ? "id-ID" : "en-GB",
                  {},
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
              id={"source-review-trigger-" + r.id}
              aria-expanded={active?.id === r.id}
              aria-controls={"source-review-" + r.id}
              disabled={busy||r.canReview===false}
              title={r.canReview===false?t("CRM Manager review required by policy","Kebijakan memerlukan verifikasi CRM Manager","当前配置要求由CRM Manager核实归因"):undefined}
              onClick={() => (active?.id === r.id ? closeReview() : requestEdit(r))}
            >
              {t("Review source", "Verifikasi sumber", "核实来源")}{" "}
              <span aria-hidden="true">{active?.id === r.id ? "⌃" : "⌄"}</span>
            </button>
          )}
          {active?.id === r.id && (
            <AdminForm lang={lang}
              id={"source-review-" + r.id}
              tabIndex={-1}
              onSubmit={save}
              className="campaign-source-review crm-form-layout border rounded-xl p-4"
              aria-label={t("Review source", "Verifikasi sumber", "核实来源")}
            >
<header className="crm-source-review-heading"><h3 data-admin-form-title>{crmFormText(lang,'sourceReview')}</h3><button type="button" className="crm-form-close" disabled={busy} aria-label={t('Close','Tutup','关闭')} onClick={closeReview}><X size={18} aria-hidden="true"/></button></header>
<AdminRequiredNote lang={lang}/>

              {error && (
                <p role="alert" className="text-red-600">
                  {error[{ en: 0, id: 1, zh: 2 }[lang]]}
                </p>
              )}

              <CampaignSourceEvidence
                lang={lang}
                source={active}
                onLead={onLead}
              />
              <AdminFormSection className="crm-form-section" title={u("Review decision")}>
              <div className="campaign-field"><AdminFieldLabel required>{t("Action", "Tindakan", "处理方式")}</AdminFieldLabel><CrmSelect required
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
              /></div>
              {action === "link" && (
                <>
                  <div className="campaign-field"><AdminFieldLabel required>{t("Target campaign", "Kampanye tujuan", "目标活动")}</AdminFieldLabel><CrmSelect required
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
                        label: t(
                          "Choose a campaign",
                          "Pilih kampanye",
                          "选择活动",
                        ),
                      },
                      ...campaigns.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  /></div>
                  <p className="text-sm">
                    {t(
                      "The original code stays as an alias. Existing and future leads from that code are attributed to the selected campaign.",
                      "Kode asli tetap menjadi alias. Prospek lama dan baru dari kode tersebut diatribusikan ke kampanye yang dipilih.",
                      "原始代码保留为来源别名；该代码的已有及后续客户归因到选定活动。",
                    )}
                  </p>
                </>
              )}
              {action === "create" && (
                <>
                  <p className="text-sm">
                    {t(
                      "Original source code",
                      "Kode sumber asli",
                      "原始来源代码",
                    )}
                    ：
                    <output className="font-mono break-all">
                      {active.rawCode}
                    </output>
                  </p>
                  <AdminField className="block">
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
                  </AdminField>
                  <div className="campaign-field"><AdminFieldLabel required>{t("Campaign type", "Jenis kampanye", "活动类型")}</AdminFieldLabel><CrmSelect required
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
                        label: t(
                          "Campus seminar",
                          "Seminar kampus",
                          "校园讲座",
                        ),
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
                        label: t(
                          "Education fair",
                          "Pameran pendidikan",
                          "教育展",
                        ),
                      },
                    ]}
                  /></div>
                  <p className="text-sm">
                    {t(
                      "Creates a planning campaign with a new camp- code. The original source code remains a working alias and stays in the audit record. Complete other details in campaign information.",
                      "Membuat kampanye berstatus Perencanaan dengan kode camp- baru. Kode sumber asli tetap menjadi alias yang berfungsi dan tersimpan dalam audit. Lengkapi rincian lain di Informasi kampanye.",
                      "创建使用新camp-活动码的筹备中活动；原始来源代码保留为可用别名及审计记录。其他信息可在活动信息中补充。",
                    )}
                  </p>
                </>
              )}
              <AdminField className="block">
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
              </AdminField>
              <p>
                {t(
                  "The original code and audit record are retained. Invalid sources do not delete leads or move them to Non-campaign source.",
                  "Kode asli dan audit tetap disimpan. Sumber tidak valid tidak menghapus pelanggan atau memindahkannya ke Sumber non-kampanye.",
                  "原始代码及审计保留；标记无效不会删除客户或归入非活动来源。",
                )}
              </p>
              </AdminFormSection>
              <AdminFormActions className="crm-source-review-actions flex gap-3">
                <button
                  disabled={
                    active?.canReview===false || busy || !reason.trim() || (action === "link" && !target)
                  }
                  className="bg-teal-700 text-white rounded-lg px-3 py-2 disabled:opacity-50"
                >
                  {busy
                    ? t("Saving…", "Menyimpan…", "保存中…")
                    : t("Confirm review", "Konfirmasi verifikasi", "确认核实")}
                </button>
                <button type="button" disabled={busy} onClick={closeReview}>
                  {t("Cancel", "Batal", "取消")}
                </button>
              </AdminFormActions>
            </AdminForm>
          )}
        </article>
      ))}
      {receipt && (
        <p role="status">
          {t(
            "Source review saved. Affected leads",
            "Verifikasi tersimpan. Prospek terdampak",
            "来源核实已保存，影响客户数",
          )}
          ：{receipt.affectedLeads}
          {receipt.campaignCode && (
            <>
              {" "}
              · {t("Campaign code", "Kode kampanye", "活动码")}：
              <span className="font-mono break-all">
                {receipt.campaignCode}
              </span>
            </>
          )}
        </p>
      )}
      {confirmDiscard && <CrmDiscardDialog lang={lang} isLight={isLight}
        onKeep={() => setConfirmDiscard(false)}
        onDiscard={() => {
          setConfirmDiscard(false);
          if (nextReview.current) edit(nextReview.current);
          else finishClose();
          nextReview.current = null;
        }}/ >}
    </section>
  );
}

export function CrmCampaignSources(props:Parameters<typeof CrmCampaignSourcesBody>[0]){return <CrmFormLayoutScope><CrmCampaignSourcesBody {...props}/></CrmFormLayoutScope>;}
