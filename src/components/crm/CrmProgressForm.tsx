import { useEffect, useRef, useState } from "react";
import { CrmSingleSelect } from "./CrmSingleSelect";
import { CrmDisclosure } from "./CrmDisclosure";
import { presentFollowUpTask } from "../../utils/crmTaskPresentation";
import { taskCompletionGuidance } from "../../utils/crmTaskGuidance";
import { buyingSignalOptions } from "../../utils/crmBuyingSignals";
import { crmError } from "../../utils/crmLanguage";
import { trustError } from "../../utils/crmTrustLanguage";

/** Progress, task closure and future planning are deliberately separate transactions. */
export function CrmProgressForm({
  lead,
  employee,
  lang,
  isLight,
  timezone,
  selectedTask,
  sourceMessage,
  onSaved,
  onCancel,
  onDirty,
  onBusy,
  onNext,
  initialDraft,
  onDraft,
  operation = "progress",
}: any) {
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  const closing = operation === "close";
  const draft =
    initialDraft?.operation === operation &&
    initialDraft?.selectedTask === selectedTask
      ? initialDraft
      : null;
  const [requestId] = useState(() => draft?.requestId || crypto.randomUUID());
  const [summary, setSummary] = useState(draft?.summary || "");
  const [contact, setContact] = useState(draft?.contact || "");
  const [channel, setChannel] = useState(draft?.channel || "");
  const [contacted, setContacted] = useState(draft?.contacted || false);
  const [customerReplied, setCustomerReplied] = useState(
    draft?.customerReplied || false,
  );
  const [outcome, setOutcome] = useState(draft?.outcome || "");
  const [stage, setStage] = useState(
    draft?.stage || lead.currentStage || "New",
  );
  const [signals, setSignals] = useState<string[]>(draft?.signals || []);
  const [checked, setChecked] = useState<string[]>(draft?.checked || []);
  const [requests, setRequests] = useState<any[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [unknown, setUnknown] = useState(Boolean(draft?.pending));
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const pending = useRef<any>(draft?.pending || null),
    next = useRef(false),
    mounted = useRef(false);
  const original = useRef(
    draft?.original || {
      stage: lead.currentStage,
      stageRevision: lead.stageRevision || 0,
    },
  );
  const task = (lead.attention?.tasks || []).find(
    (v: any) => v.id === selectedTask,
  );
  const revision = useRef(draft?.revision ?? task?.revision);
  const view = task && presentFollowUpTask(task, lang, timezone);
  const linked = (requests || []).filter(
    (r) => r.task_id === selectedTask && r.state === "linked",
  );
  const errorText = (message: string) =>
    ({
      "Choose a contact channel": t(
        "Choose a contact channel",
        "Pilih kanal kontak",
        "请选择沟通方式",
      ),
      "Choose a contact result": t(
        "Choose a contact result",
        "Pilih hasil kontak",
        "请选择联系结果",
      ),
      "Follow-up summary required": t(
        "Enter progress notes or a closure result",
        "Isi catatan progres atau hasil penutupan",
        "请填写跟进内容或关闭说明",
      ),
      "Choose a task outcome": t(
        "Choose completed or terminated",
        "Pilih selesai atau dihentikan",
        "请选择已完成或已终止",
      ),
      "Choose the requests handled by this result":
        closing && outcome === "cancel"
          ? t(
              "Confirm the requests being terminated. Retry if request data is unavailable.",
              "Konfirmasikan permintaan yang dihentikan. Coba lagi jika data belum tersedia.",
              "请确认随任务终止的请求；请求信息不可用时请重试。",
            )
          : t(
              "Confirm completed requests. Retry if request data is unavailable.",
              "Konfirmasikan permintaan yang selesai. Coba lagi jika data belum tersedia.",
              "请确认已完成的请求；请求信息不可用时请重试。",
            ),
    })[message] ||
    (trustError(message, lang) !== message
      ? trustError(message, lang)
      : crmError(message, lang));
  const heading = closing
    ? t("Close task", "Tutup tugas", "关闭任务")
    : t("Add progress", "Tambah progres", "添加进展");
  async function load() {
    setLoadError(false);
    try {
      const r = await fetch("/api/crm/leads/" + lead.id + "/trust", {
        signal: AbortSignal.timeout(15000),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setRequests(d.requests || []);
    } catch {
      setLoadError(true);
    }
  }
  useEffect(() => {
    if (closing) void load();
  }, [lead.id, closing]);
  useEffect(() => {
    onDraft?.({
      operation,
      selectedTask,
      requestId,
      summary,
      contact,
      channel,
      contacted,
      customerReplied,
      outcome,
      stage,
      signals,
      checked,
      original: original.current,
      revision: revision.current,
      pending: pending.current,
    });
    if (mounted.current) onDirty?.();
    else mounted.current = true;
  }, [
    summary,
    contact,
    channel,
    contacted,
    customerReplied,
    outcome,
    stage,
    signals,
    checked,
    unknown,
  ]);
  async function saved(d: any) {
    pending.current = null;
    setUnknown(false);
    await onSaved({ ...d, recordOnly: !closing }, next.current);
  }
  const select = (
    label: string,
    value: string,
    change: (v: string) => void,
    options: string[][],
  ) => (
    <label>
      <span>{label}</span>
      <CrmSingleSelect
        label={label}
        value={value}
        onChange={change}
        options={options.map(([value, label]) => ({ value, label }))}
        lang={lang}
        isLight={isLight}
      />
    </label>
  );
  return (
    <form
      className="crm-workflow-form crm-sales-editor crm-progress-form"
      noValidate
      onChange={() => setError("")}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        onBusy?.(true);
        setError("");
        try {
          if (!pending.current) {
            if (!summary.trim()) throw Error("Follow-up summary required");
            if (selectedTask && !task)
              throw Error("Selected task changed; refresh and review");
            if (closing && !["complete", "cancel"].includes(outcome))
              throw Error("Choose a task outcome");
            if (
              closing &&
              (!requests ||
                loadError ||
                linked.some((r) => !checked.includes(r.id)))
            )
              throw Error("Choose the requests handled by this result");
            if ((contacted || customerReplied) && !channel)
              throw Error("Choose a contact channel");
            if (contacted && !contact) throw Error("Choose a contact result");
            pending.current = {
              requestId,
              summary,
              recordKind: contacted ? "contact" : "closure",
              channel: contacted || customerReplied ? channel : undefined,
              customerReplied: customerReplied || undefined,
              customerReplySequenceRevision: customerReplied
                ? lead.noResponseSequence?.revision || 0
                : undefined,
              connectStatus: contacted ? contact : undefined,
              processingTaskId: selectedTask || null,
              taskOutcome: selectedTask
                ? closing
                  ? outcome
                  : "keep"
                : undefined,
              expectedTaskRevision: revision.current,
              completeTaskIds:
                closing && outcome === "complete" ? [selectedTask] : [],
              handledRequests: closing
                ? linked.map((r) => ({ id: r.id, version: r.version }))
                : [],
              disposition: "independent",
              buyingSignalsDetected: signals,
              newStage: stage !== original.current.stage ? stage : undefined,
              expectedStage: original.current.stage,
              expectedStageRevision: original.current.stageRevision,
              sourceMessageId: sourceMessage?.id,
              sourceConversationId: sourceMessage?.conversation_id,
            };
          }
          const r = await fetch("/api/crm/leads/" + lead.id + "/logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(20000),
            body: JSON.stringify(pending.current),
          });
          const d = await r.json();
          if (!r.ok) {
            if (r.status < 500) pending.current = null;
            throw Error(d.error);
          }
          await saved(d);
        } catch (e) {
          setUnknown(Boolean(pending.current));
          setError(
            pending.current
              ? "Save outcome unknown; retry unchanged draft"
              : (e as Error).message,
          );
        } finally {
          setBusy(false);
          onBusy?.(false);
        }
      }}
    >
      <header className="crm-sales-editor-heading">
        <div>
          <p className="crm-work-muted">
            {t("Recorded by","Dicatat oleh","记录人")} · {employee.displayName || employee.id}
          </p>
        </div>
      </header>
      {view && (
        <div className="crm-sales-task-summary">
          <strong>{view.action}</strong>
          <div>
            {view.times.map((v: any, i: number) => (
              <span key={i} data-tone={v.tone}>
                {v.label} · {view.formatTime(v.value)}
              </span>
            ))}
          </div>
        </div>
      )}
      <fieldset disabled={busy || unknown} className="crm-sales-fields">
        {closing && (
          <section className="crm-sales-step">
            {select(
              t("Closure outcome", "Hasil penutupan", "关闭方式"),
              outcome,
              setOutcome,
              [
                ["", t("Choose", "Pilih", "请选择")],
                ["complete", t("Completed", "Selesai", "已完成")],
                ["cancel", t("Terminated", "Dihentikan", "已终止")],
              ],
            )}
            {outcome === "complete" && task && (
              <p className="crm-work-muted">
                {taskCompletionGuidance(task, lang)}
              </p>
            )}
            {loadError && (
              <button
                type="button"
                className="crm-work-link"
                onClick={() => void load()}
              >
                {t(
                  "Request information unavailable · Retry",
                  "Informasi permintaan tidak tersedia · Coba lagi",
                  "请求信息不可用 · 重试",
                )}
              </button>
            )}
            {linked.length > 0 && (
              <fieldset className="crm-task-request-confirm">
                <legend>
                  {outcome === "cancel"
                    ? t(
                        "Requests terminated with this task",
                        "Permintaan dihentikan bersama tugas",
                        "随任务终止的请求",
                      )
                    : t(
                        "Customer requests completed",
                        "Permintaan pelanggan selesai",
                        "已完成的客户请求",
                      )}
                </legend>
                {linked.map((r) => (
                  <label key={r.id}>
                    <input
                      type="checkbox"
                      checked={checked.includes(r.id)}
                      onChange={(e) =>
                        setChecked((v) =>
                          e.target.checked
                            ? [...v, r.id]
                            : v.filter((id) => id !== r.id),
                        )
                      }
                    />
                    {r.data.text ||
                      t("Customer request", "Permintaan pelanggan", "客户请求")}
                  </label>
                ))}
              </fieldset>
            )}
          </section>
        )}
        {!closing && (
          <label className="crm-progress-contact-toggle">
            <input
              type="checkbox"
              checked={contacted}
              onChange={(e) => {
                setContacted(e.target.checked);
                if (e.target.checked) setCustomerReplied(false);
              }}
            />
            {t(
              "This progress includes a customer contact",
              "Progres ini mencakup kontak pelanggan",
              "本次有联系客户",
            )}
          </label>
        )}
        {!closing && !contacted && (
          <CrmDisclosure
            heading={t(
              "Record a customer reply outside CRM",
              "Catat balasan pelanggan di luar CRM",
              "补记客户在CRM外的回复",
            )}
          >
            <label className="crm-progress-contact-toggle">
              <input
                type="checkbox"
                checked={customerReplied}
                onChange={(e) => setCustomerReplied(e.target.checked)}
              />
              {t(
                "Customer replied; record the channel and evidence",
                "Pelanggan membalas; catat kanal dan buktinya",
                "客户已回复，记录渠道及依据",
              )}
            </label>
          </CrmDisclosure>
        )}
        {(contacted || customerReplied) && (
          <div className="crm-workflow-grid">
            {select(t("Channel", "Kanal", "沟通方式"), channel, setChannel, [
              ["", t("Choose a channel", "Pilih kanal", "请选择沟通方式")],
              ["WhatsApp", "WhatsApp"],
              ["Phone Call", t("Phone call", "Telepon", "电话")],
              ["Email", t("Email", "Email", "电子邮件")],
              [
                "Campus Visit",
                t("Campus visit", "Kunjungan kampus", "校区接待"),
              ],
              ["Other", t("Other", "Lainnya", "其他")],
            ])}
            {contacted &&
              select(
                t("Contact result", "Hasil kontak", "联系结果"),
                contact,
                setContact,
                [
                  ["", t("Choose a result", "Pilih hasil", "请选择联系结果")],
                  [
                    "Connected",
                    t(
                      "Connected / replied",
                      "Terhubung / dibalas",
                      "已联系／已回复",
                    ),
                  ],
                  [
                    "No Response",
                    t("No response", "Tidak ada respons", "未接通／未回复"),
                  ],
                  [
                    "Wrong Number",
                    t("Invalid number", "Nomor tidak valid", "号码无效"),
                  ],
                ],
              )}
          </div>
        )}
        <label>
          {closing
            ? outcome === "cancel"
              ? t(
                  "Termination reason (required)",
                  "Alasan penghentian (wajib)",
                  "终止原因（必填）",
                )
              : t(
                  "Completion result (required)",
                  "Hasil penyelesaian (wajib)",
                  "完成结果（必填）",
                )
            : t(
                "Progress notes (required)",
                "Catatan progres (wajib)",
                "跟进内容（必填）",
              )}
          <textarea
            required
            rows={4}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>
        {!closing && (
          <CrmDisclosure
            heading={t(
              "Sales progress (optional)",
              "Perkembangan penjualan (opsional)",
              "销售进展（选填）",
            )}
          >
            <fieldset className="crm-buying-signal-options">
              <legend>
                {t(
                  "New buying signals (multiple choice)",
                  "Sinyal pembelian baru (pilihan ganda)",
                  "本次新增购买信号（可多选）",
                )}
              </legend>
              {buyingSignalOptions.map((v, i) => (
                <label key={v}>
                  <input
                    type="checkbox"
                    checked={signals.includes(v)}
                    onChange={(e) =>
                      setSignals((old) =>
                        e.target.checked
                          ? [...old, v]
                          : old.filter((x) => x !== v),
                      )
                    }
                  />
                  {
                    [
                      t("Asked price", "Menanyakan biaya", "咨询学费"),
                      t("Asked schedule", "Menanyakan jadwal", "询问开班"),
                      t("Asked payment", "Menanyakan pembayaran", "询问付款"),
                      t("Ready to enroll", "Siap mendaftar", "准备报名"),
                    ][i]
                  }
                </label>
              ))}
            </fieldset>
            {select(
              t("Sales stage", "Tahap penjualan", "销售阶段"),
              stage,
              setStage,
              [
                ["New", t("New", "Baru", "待初访")],
                ["Contacted", t("Contacted", "Dihubungi", "已建联")],
                [
                  "Assessment Booked",
                  t("Assessment booked", "Asesmen dijadwalkan", "已预约测评"),
                ],
                [
                  "Assessment Done",
                  t("Assessment done", "Asesmen selesai", "测评完成"),
                ],
                [
                  "Trial Booked",
                  t("Trial booked", "Uji coba dijadwalkan", "已预约试听"),
                ],
                [
                  "Trial Attended",
                  t("Trial attended", "Uji coba dihadiri", "已参加试听"),
                ],
                ["Enrolled", t("Enrolled", "Terdaftar", "已报名")],
                ["Lost", t("Closed / lost", "Ditutup / hilang", "已关闭")],
              ],
            )}
          </CrmDisclosure>
        )}
      </fieldset>
      <footer className="crm-sales-editor-footer">
        {error && (
          <p role="alert" ref={errorRef} tabIndex={-1}>
            {errorText(error)}
          </p>
        )}
        {unknown && (
          <button
            type="button"
            className="crm-work-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              onBusy?.(true);
              try {
                const r = await fetch(
                  `/api/crm/leads/${lead.id}/operations/${requestId}`,
                  { signal: AbortSignal.timeout(15000) },
                );
                const d = await r.json();
                if (!r.ok) throw Error(d.error);
                const l = await fetch(`/api/crm/leads/${lead.id}`);
                const detail = await l.json();
                if (!l.ok) throw Error(detail.error);
                await saved({ ...d, lead: detail.lead });
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
                onBusy?.(false);
              }
            }}
          >
            {t(
              "Query save result",
              "Periksa hasil penyimpanan",
              "查询保存结果",
            )}
          </button>
        )}
        <button
          type="button"
          className="crm-work-button"
          disabled={busy || unknown}
          onClick={onCancel}
        >
          {t("Cancel", "Batal", "取消")}
        </button>
        {!closing && (
          <button
            type="submit"
            className="crm-work-button"
            disabled={busy || unknown}
            onClick={() => {
              next.current = true;
              onNext?.();
            }}
          >
            {t("Save and next", "Simpan dan lanjut", "保存并下一位")}
          </button>
        )}
        <button
          type="submit"
          className="crm-work-button"
          data-primary="true"
          disabled={busy}
          onClick={() => (next.current = false)}
        >
          {unknown
            ? t("Retry original save", "Ulangi penyimpanan awal", "重试原保存")
            : closing
              ? t("Close task", "Tutup tugas", "关闭任务")
              : t("Save progress", "Simpan progres", "保存进展")}
        </button>
      </footer>
    </form>
  );
}
