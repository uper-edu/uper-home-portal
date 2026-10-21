import {CrmSaveFeedback} from "./CrmDetailWorkspace";
import { CrmSalesDialog } from "./CrmSalesDialog";
import { presentFollowUpTask } from "../../utils/crmTaskPresentation";
import { MessageSquarePlus, NotebookPen, Plus } from "lucide-react";
import { CrmDisclosure } from "./CrmDisclosure";
import { CrmFollowupHistory } from "./CrmFollowupHistory";
import { CrmTaskCard } from "./CrmTaskCard";
import { projectPendingTasks } from "../../utils/crmTaskPresentation";
import { emptyFollowUpLabel } from "../../utils/crmFollowUp";
import { describeFollowUpTask } from "../../utils/crmFollowUp";
import { useEffect, useId, useRef, useState } from "react";
import { CrmSingleSelect } from "./CrmSingleSelect";
import { calendarSample } from "../../utils/workCalendar";
import { formatCrmOperatingTime } from "../../utils/crmOperatingTime";
import { crmValue, type CrmLanguage } from "../../utils/crmLanguage";
import { trustError } from "../../utils/crmTrustLanguage";
export function CrmStageEditor({
  lead, lang, isLight, onSaved, disabled, onDirty, onBusy, request = fetch,
}: any) {
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  const currentStage = lead.currentStage || "New";
  const [stage, setStage] = useState(currentStage),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [reasonInvalid, setReasonInvalid] = useState(false),
    [busy, setBusy] = useState(false),
    [busyAction, setBusyAction] = useState<"save" | "query">("save"),
    [unknown, setUnknown] = useState(false),
    [savedStage, setSavedStage] = useState<string | null>(null);
  const pending = useRef<any>(null), inFlight = useRef(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null), id = useId();
  const changed = stage !== currentStage;
  useEffect(() => {
    setStage(currentStage);
    setReason("");
    setReasonInvalid(false);
  }, [lead.id, currentStage]);
  useEffect(() => { onDirty?.(changed || unknown); }, [changed, unknown]);
  const finish = (data: any) => {
    if (data.saved !== true || data.lead?.id !== lead.id) throw Error("Unconfirmed response");
    pending.current = null;
    setUnknown(false);
    setError("");
    setReasonInvalid(false);
    setReason("");
    setStage(data.lead.currentStage || "New");
    setSavedStage(data.lead.currentStage || "New");
    onSaved(data.lead);
  };
  const save = async () => {
    if (disabled || inFlight.current) return;
    if (!pending.current && !reason.trim()) {
      setReasonInvalid(true);
      reasonRef.current?.focus();
      return;
    }
    const body = pending.current || (pending.current = {
      requestId: crypto.randomUUID(), newStage: stage,
      expectedStage: currentStage, expectedStageRevision: lead.stageRevision || 0,
      reason,
    });
    inFlight.current = true;
    setBusyAction("save"); setBusy(true); onBusy?.(true); setError("");
    let failure = "stage_save_unconfirmed";
    try {
      const r = await request("/api/crm/leads/" + lead.id + "/stage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000), body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status < 500) { pending.current = null; failure = d.error || "stage_save_failed"; }
        throw Error(failure);
      }
      finish(d);
    } catch {
      setUnknown(Boolean(pending.current));
      if (failure === "Stage change reason required") { setReasonInvalid(true); reasonRef.current?.focus(); }
      else setError(failure);
    } finally {
      inFlight.current = false; setBusy(false); onBusy?.(false);
    }
  };
  const query = async () => {
    if (!pending.current || inFlight.current) return;
    inFlight.current = true;
    setBusyAction("query"); setBusy(true); onBusy?.(true); setError("");
    let failure = "stage_query_unavailable";
    try {
      const r = await request("/api/crm/leads/" + lead.id + "/operations/" + pending.current.requestId);
      const d = await r.json();
      if (!r.ok) { if (r.status === 404) failure = "stage_result_not_found"; throw Error(failure); }
      finish(d);
    } catch { setError(failure); }
    finally { inFlight.current = false; setBusy(false); onBusy?.(false); }
  };
  const errorText = error === "stage_save_unconfirmed"
    ? t("The save result is not confirmed. Your draft is kept; query the result or retry the original save.", "Hasil penyimpanan belum terkonfirmasi. Draf tetap tersedia; periksa hasil atau ulangi penyimpanan awal.", "保存结果尚未确认，草稿已保留。请查询结果或重试原保存。")
    : error === "stage_query_unavailable"
      ? t("The result could not be checked. Your draft is kept. Try querying again.", "Hasil belum dapat diperiksa. Draf tetap tersedia. Coba periksa lagi.", "暂时无法查询保存结果，草稿已保留，请重试查询。")
      : error === "stage_result_not_found"
        ? t("No saved result was found for this request. You can retry the original save.", "Hasil tersimpan untuk permintaan ini belum ditemukan. Anda dapat mengulangi penyimpanan awal.", "尚未找到该请求的保存结果，可重试原保存。")
        : error === "stage_save_failed"
          ? t("The stage was not saved. Your draft is kept.", "Tahap belum tersimpan. Draf tetap tersedia.", "阶段未保存，草稿已保留。") : trustError(error, lang);
  const options = ["New", "Contacted", "Assessment Booked", "Assessment Done", "Trial Booked", "Trial Attended", "Enrolled", "Lost"]
    .map(value => ({ value, label: crmValue(value, lang) }));
  return (
    <div className="crm-stage-editor" aria-busy={busy}>
      <CrmSingleSelect
        label={t("Update sales stage", "Ubah tahap penjualan", "修改销售阶段")}
        value={stage}
        onChange={(value) => { setStage(value); setError(""); setReasonInvalid(false); setSavedStage(null); if (value === currentStage) setReason(""); }}
        disabled={disabled || busy || unknown} options={options} lang={lang} isLight={isLight}
      />
      {!disabled && <p className="crm-stage-help">{t("Stage changes are saved manually. Choose a stage, enter the required reason, then save.", "Perubahan tahap disimpan secara manual. Pilih tahap, isi alasan wajib, lalu simpan.", "阶段变更需手动保存：选择阶段，填写必填依据后点击保存。")}</p>}
      {(changed || unknown) && <div className="crm-stage-draft">
        <label htmlFor={id}>{t("Reason for stage change", "Alasan perubahan tahap", "阶段变更依据")} <span className="crm-stage-required">{t("(required)", "(wajib)", "（必填）")}</span></label>
        <p id={id + "-help"} className="crm-stage-help">{t("Describe the facts supporting this stage. Example: the customer confirmed a Saturday assessment booking.", "Jelaskan fakta yang mendukung tahap ini. Contoh: pelanggan mengonfirmasi jadwal asesmen hari Sabtu.", "请说明支持新阶段的事实。例如：客户已确认预约周六的测评。")}</p>
        <textarea id={id} ref={reasonRef} rows={3} required aria-required="true" aria-invalid={reasonInvalid}
          aria-describedby={id + "-help" + (reasonInvalid ? " " + id + "-error" : "")}
          disabled={disabled || busy || unknown} value={reason}
          onChange={e => { setReason(e.target.value); if (e.target.value.trim()) setReasonInvalid(false); }} />
        {reasonInvalid && <p id={id + "-error"} role="alert" className="crm-stage-error">{t("Enter the reason for this stage change before saving.", "Isi alasan perubahan tahap sebelum menyimpan.", "请填写阶段变更依据后再保存。")}</p>}
        <p className="crm-stage-transition">{crmValue(currentStage, lang)} → {crmValue(stage, lang)}</p>
        <div className="crm-stage-actions">
          <button type="button" className="crm-work-button" data-primary="true" disabled={disabled || busy} onClick={save}>
            {busy && busyAction === "save" ? t("Saving…", "Menyimpan…", "保存中…") : unknown ? t("Retry original save", "Ulangi penyimpanan awal", "重试原保存") : t("Save stage", "Simpan tahap", "保存阶段")}
          </button>
          {!unknown && <button type="button" className="crm-work-button" disabled={busy || disabled} onClick={() => { setStage(currentStage); setReason(""); setReasonInvalid(false); setError(""); setSavedStage(null); }}>{t("Cancel changes", "Batalkan perubahan", "取消修改")}</button>}
          {unknown && <button type="button" className="crm-work-button" disabled={busy} onClick={query}>{busy && busyAction === "query" ? t("Checking…", "Memeriksa…", "查询中…") : t("Query save result", "Periksa hasil penyimpanan", "查询保存结果")}</button>}
        </div>
      </div>}
      {(changed || unknown || savedStage === currentStage) && <p role="status" className="crm-stage-status">
        {busy ? (busyAction === "query" ? t("Checking save result…", "Memeriksa hasil penyimpanan…", "正在查询保存结果…") : t("Saving stage…", "Menyimpan tahap…", "正在保存阶段…"))
          : unknown ? t("Save result unknown; draft retained.", "Hasil penyimpanan belum diketahui; draf dipertahankan.", "保存结果未知，草稿已保留。")
            : changed ? t("Unsaved stage change", "Perubahan tahap belum tersimpan", "阶段变更尚未保存") : t("Stage saved", "Tahap tersimpan", "阶段已保存")}
      </p>}
      {error && <p role="alert" className="crm-stage-error">{errorText}</p>}
    </div>
  );
}
export function CrmTrustPanel({
  lead,
  lang,
  isLight,
  timezone,
  onRefresh,
  disabled,
  onDirty,
  onBusy,
  onProcess,
  onSource,
  focusTask,
  children,
  context,
  journey = [],
  workflowOpen,
  workflowTask,
  modalSuspended,
  command,
  onRequestEdit,
  onRecord,
  onArrange,
  onIdentity,
  mode,
}: any) {
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(""),
    [note, setNote] = useState("");
  const [editor, setEditor] = useState<any>(null),
    [reason, setReason] = useState(""),
    [action, setAction] = useState(""),
    [purpose, setPurpose] = useState(""),
    [date, setDate] = useState(""),
    [timing, setTiming] = useState(""),
    [choice, setChoice] = useState("");
  const initialDate = useRef("");
  const pending = useRef<{ id: string; path: string; body: any } | null>(null);
  const [unknown, setUnknown] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false),
    [historyTask, setHistoryTask] = useState<string>();
  const [noteOpen, setNoteOpen] = useState(false),
    [showOther, setShowOther] = useState(false);
  const focused = useRef<any>(null);
  useEffect(() => {
    if (!data || !focusTask || focused.current === focusTask) return;
    if (!focusTask.id) {
      focused.current = focusTask;
      const frame = requestAnimationFrame(() => {
        const node = document.getElementById("crm-followup-tasks");
        node?.scrollIntoView({ block: "start" });
        node?.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(frame);
    }
    const task = data.tasks.find((v: any) => v.id === focusTask.id);
    if (!task) return;
    focused.current = focusTask;
    if (
      ["completed", "cancelled"].includes(task.status) ||
      (task.status === "migration_hold" &&
        ["Enrolled", "Lost"].includes(lead.currentStage))
    )
      setHistoryOpen(true);
    const frame = requestAnimationFrame(() => {
      const node = document.getElementById("crm-followup-task-" + task.id);
      node?.scrollIntoView({ block: "center" });
      node?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [data, focusTask]);
  useEffect(() => {
    onDirty?.(
      Boolean(
        note.trim() ||
        unknown ||
        (editor &&
          (reason.trim() ||
            action.trim() ||
            purpose.trim() ||
            date !== initialDate.current ||
            timing !== "" ||
            choice)),
      ),
    );
  }, [note, editor, unknown, reason, action, purpose, date, timing, choice]);
  const load = async () => {
    const r = await fetch("/api/crm/leads/" + lead.id + "/trust");
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    setData(d);
  };
  useEffect(() => {
    setData(null);
    setError("");
    setNote("");
    setEditor(null);
    pending.current = null;
    setUnknown(false);
  }, [lead.id]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/crm/leads/" + lead.id + "/trust")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) {
          setData(null);
          setError(trustError(e.message, lang));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    lead.id,
    lead.followUpLogs?.length,
    lead.stageRevision,
    lead.contactArrangement?.version,
    JSON.stringify(lead.attention?.tasks),
  ]);
  const refresh = async () => {
    await load();
    onRefresh?.();
  };
  const submit = async (path: string, body: any) => {
    if (
      pending.current &&
      JSON.stringify(pending.current.body) !== JSON.stringify(body)
    ) {
      setError(
        t(
          "Query the previous result before editing.",
          "Periksa hasil sebelumnya sebelum mengubah isi.",
          "请先查询上次结果，再修改内容。",
        ),
      );
      return;
    }
    const p = pending.current || { id: crypto.randomUUID(), path, body };
    pending.current = p;
    setBusy(true);
    onBusy?.(true);
    setError("");
    setSaved("");
    try {
      const r = await fetch("/api/crm/leads/" + lead.id + "/" + p.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ ...p.body, requestId: p.id }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status < 500) pending.current = null;
        throw Error(d.error);
      }
      pending.current = null;
      setUnknown(false);
      setNote("");
      setNoteOpen(false);
      setEditor(null);
      setSaved(
        p.path === "information" ? "note" : p.body.command || "identity",
      );
      await refresh();
    } catch (e) {
      setUnknown(Boolean(pending.current));
      setError(trustError((e as Error).message, lang));
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  };
  const querySave = async () => {
    try {
      const p = pending.current!;
      const r = await fetch(
        "/api/crm/leads/" + lead.id + "/operations/" + p.id,
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      pending.current = null;
      setUnknown(false);
      setEditor(null);
      setNote("");
      setNoteOpen(false);
      setSaved("confirmed");
      await refresh();
    } catch (e) {
      setError(trustError((e as Error).message, lang));
    }
  };
  const open = (kind: string, task?: any) => {
    onRequestEdit?.({ kind, task });
  };
  useEffect(() => {
    if (workflowOpen) {
      setSaved("");
      setError("");
    }
  }, [workflowOpen]);
  useEffect(() => {
    setShowOther(false);
    if (!command) return;
    setSaved("");
    setError("");
    if (command.kind === "close") {
      setNoteOpen(false);
      setEditor(null);
      return;
    }
    if (command.kind === "note") {
      setNoteOpen(true);
      setEditor(null);
    } else {
      setNoteOpen(false);
      setEditor({ kind: command.kind, task: command.task });
    }
    setReason("");
    setAction("");
    setPurpose("");
    initialDate.current = "";
    setDate("");
    setTiming("");
    setChoice("");
    requestAnimationFrame(() => {
      const area = document.getElementById(
        command.kind === "note"
          ? "crm-information-editor"
          : "crm-followup-processing",
      );
      area?.scrollIntoView({ block: "start" });
      area
        ?.querySelector<HTMLElement>("input, textarea, button")
        ?.focus({ preventScroll: true });
    });
  }, [command]);
  const time = (v: any) =>
    v
      ? formatCrmOperatingTime(v, timezone)
      : t("Not recorded", "Belum dicatat", "未记录");
  const taskLabel = (task: any) =>
    describeFollowUpTask({ ...task, dueAt: task.due_at }, lang, timezone)
      .action;
  const groups = new Map<string, any>();
  for (const entry of data?.engagements || []) {
    if (entry.state !== "pending") continue;
    const key =
      entry.kind === "message"
        ? entry.data.conversationId || entry.id
        : entry.id;
    const group = groups.get(key);
    if (group) {
      group.members.push({ id: entry.id, version: entry.version });
      group.data.text += "\n\n" + entry.data.text;
    } else
      groups.set(key, {
        ...entry,
        data: { ...entry.data },
        members: [{ id: entry.id, version: entry.version }],
      });
  }
  const reviewGroups = [...groups.values()];
  const label = (kind: string) =>
    ({
      response: t("Response deadline", "Batas respons", "响应截止"),
      appointment: t(
        "Agreed execution time",
        "Waktu pelaksanaan yang disepakati",
        "约定执行时间",
      ),
      review: t(
        "Internal review time",
        "Waktu tinjauan internal",
        "内部复查时间",
      ),
    })[kind] || kind;
  const kindLabel = (kind: string) =>
    ({
      request_evidence: t("Request evidence", "Bukti permintaan", "请求依据"),
      create: t("New task", "Tugas baru", "新增任务"),
      supplement: t("Add task information", "Tambah informasi tugas", "补充任务信息"),
      reschedule: t("Reschedule", "Jadwal ulang", "改期"),
      replace: t("Replace task", "Ganti tugas", "替代任务"),
      cancel: t("Cancel task", "Batalkan tugas", "取消任务"),
      dismiss: t("No action needed", "Tidak perlu tindakan", "无需行动"),
      link: t("Link to task", "Tautkan ke tugas", "关联任务"),
      identity: t("Confirm identity", "Konfirmasi identitas", "核实身份"),
    })[kind] || kind;
  const activate = async (task: any) => {
    if (disabled || busy || unknown) return;
    setBusy(true);
    onBusy?.(true);
    setError("");
    try {
      const r = await fetch(
        `/api/crm/tasks/${encodeURIComponent(task.id)}/activate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await refresh();
    } catch (e) {
      setError(trustError((e as Error).message, lang));
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  };
  const history = (task: any) => {
    setHistoryTask(task.id);
    requestAnimationFrame(() => {
      const node = document.getElementById("crm-task-evidence-history");
      node?.scrollIntoView({ block: "start" });
      node?.focus({ preventScroll: true });
    });
  };
  const renderTask = (task: any) => (
    <CrmTaskCard
      key={task.id}
      task={task}
      lead={lead}
      lang={lang}
      timezone={timezone}
      compact={["open", "overdue", "migration_hold"].includes(task.status)}
      sourceQuote={
        (lead.chatTranscript || []).find(
          (m: any) =>
            m.role === "user" &&
            m.conversation_id === task.details?.sourceConversationId &&
            (m.id === task.details?.sourceMessageId ||
              m.request_id === task.details?.sourceMessageId),
        )?.content
      }
      readOnly={disabled || busy || unknown}
      focused={focusTask?.id === task.id}
      onProcess={onProcess ? () => onProcess(task) : undefined}
      onSource={
        onSource &&
        task.details?.sourceConversationId &&
        task.details?.sourceMessageId
          ? () => onSource(task)
          : undefined
      }
      onHistory={
        ["completed", "cancelled"].includes(task.status)
          ? () => history(task)
          : undefined
      }
      menu={
        task.status === "migration_hold" ? (
          <button
            type="button"
            className="crm-work-link"
            disabled={
              disabled ||
              busy ||
              unknown ||
              Boolean(editor) ||
              noteOpen ||
              workflowOpen
            }
            onClick={() => activate(task)}
          >
            {t(
              "Activate historical task",
              "Aktifkan tugas historis",
              "启用历史待办",
            )}
          </button>
        ) : ["open", "overdue"].includes(task.status) ? (
          <CrmSingleSelect
            label={t("Task actions", "Tindakan tugas", "任务操作")}
            displayValue="⋯"
            value=""
            onChange={(kind) => open(kind, task)}
            options={["supplement", "reschedule", "replace", "cancel"].map(
              (value) => ({ value, label: kindLabel(value) }),
            )}
            disabled={disabled || busy || unknown}
            lang={lang}
            isLight={isLight}
            className="crm-task-more"
          />
        ) : undefined
      }
    />
  );
  const pendingTasks = projectPendingTasks(
    data?.tasks || [],
    lead.currentStage,
  );
  const processingTaskId = workflowOpen ? workflowTask : editor?.task?.id;

  return (
    <section
      className="crm-trust-panel"
      aria-label={t("Facts and tasks", "Fakta dan tugas", "事实与任务")}
    >
      {mode !== "identity" && !workflowOpen && (
        <div className="crm-followup-toolbar">
          <h3>
            {t("Follow-up workspace", "Ruang tindak lanjut", "跟进工作区")}
          </h3>
          <div className="crm-followup-entry-actions">
            <button
              type="button"
              className="crm-work-button"
              data-primary="true"
              disabled={disabled || busy || unknown}
              onClick={onRecord}
            >
              <MessageSquarePlus size={17} aria-hidden="true" />
              {t("Record contact", "Catat kontak", "记录联系")}
            </button>
            <button
              type="button"
              className="crm-work-button"
              disabled={disabled || busy || unknown}
              onClick={() => open("note")}
            >
              <NotebookPen size={17} aria-hidden="true" />
              {t("Quick note", "Catatan singkat", "记笔记")}
            </button>
          </div>
        </div>
      )}
      {noteOpen && (
        <section id="crm-information-editor" className="crm-information-editor">
          <h3>{t("Quick note", "Catatan singkat", "记笔记")}</h3>
          <p>
            {t(
              "Record useful information at any time. This does not count as contact or complete a task.",
              "Catat informasi kapan saja. Ini tidak dihitung sebagai kontak dan tidak menyelesaikan tugas.",
              "随时记录有用信息；保存不计为联系，也不完成任务。",
            )}
          </p>
          <label>
            {t("Information", "Informasi", "信息内容")}
            <textarea
              disabled={disabled || busy || unknown}
              value={note}
              rows={2}
              onChange={(e) => {
                setNote(e.target.value);
                onDirty?.(Boolean(e.target.value.trim()));
              }}
            />
          </label>
          <button
            type="button"
            disabled={disabled || busy || unknown || !note.trim()}
            onClick={() => submit("information", { summary: note })}
          >
            {t("Save note", "Simpan catatan", "保存笔记")}
          </button>
          <button
            type="button"
            className="crm-work-link"
            disabled={busy || unknown}
            onClick={() => onRequestEdit?.({ kind: "close" })}
          >
            {t("Cancel", "Batal", "取消")}
          </button>
        </section>
      )}
      {error && !editor && <CrmSaveFeedback state={unknown?"unknown":"error"}>{error}</CrmSaveFeedback>}
      {saved && (
        <CrmSaveFeedback state="saved">
          {saved === "note"
            ? t(
                "Note saved. Contact counts and tasks are unchanged.",
                "Catatan disimpan. Jumlah kontak dan tugas tidak berubah.",
                "笔记已保存，联系次数和任务均未改变。",
              )
            : saved === "confirmed"
              ? t(
                  "Save confirmed",
                  "Penyimpanan dikonfirmasi",
                  "已确认保存成功",
                )
              : `${kindLabel(saved)} · ${t("Saved. Other tasks and original deadlines remain unchanged.", "Tersimpan. Tugas lain dan tenggat awal tetap.", "已保存，其他任务及原始期限保持不变。")}`}
        </CrmSaveFeedback>
      )}
      {unknown && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const p = pending.current;
            if (p) submit(p.path, p.body);
          }}
        >
          {t("Retry original save", "Ulangi penyimpanan awal", "重试原保存")}
        </button>
      )}
      {unknown && (
        <button type="button" disabled={busy} onClick={querySave}>
          {t("Query save result", "Periksa hasil penyimpanan", "查询保存结果")}
        </button>
      )}
      {!data && (
        <p role="status">
          {t(
            error
              ? "Follow-up information unavailable"
              : "Loading follow-up tasks…",
            error
              ? "Informasi tindak lanjut belum tersedia"
              : "Memuat tugas tindak lanjut…",
            error ? "跟进信息暂不可用" : "正在加载跟进任务…",
          )}
        </p>
      )}
      {!data && (
        <button
          type="button"
          onClick={() =>
            load().catch((e) => setError(trustError(e.message, lang)))
          }
        >
          {t(
            "Retry loading facts and tasks",
            "Muat ulang fakta dan tugas",
            "重新加载事实与任务",
          )}
        </button>
      )}
      {mode !== "identity" && !workflowOpen && (
        <section className="crm-followup-zone crm-followup-current">
          <div className="crm-followup-zone-heading">
            <h3>
              {t("Communication overview", "Ringkasan komunikasi", "沟通概况")}
            </h3>
            <button
              type="button"
              className="crm-work-link"
              disabled={disabled || busy || unknown}
              onClick={onArrange}
            >
              {t(
                "Adjust contact arrangement",
                "Ubah pengaturan kontak",
                "调整联系安排",
              )}
            </button>
          </div>
          {typeof context === "function" ? context({ data, error }) : context}
          {data && reviewGroups.length > 0 && (
            <section className="crm-detail-subsection ">
              <h3>
                {t(
                  "Information to review",
                  "Informasi untuk ditinjau",
                  "待核实动态",
                )}{" "}
                ({reviewGroups.length})
              </h3>
              {reviewGroups.map((e: any) => (
                <article key={e.id}>
                  <strong>
                    {e.kind === "reply_confirmation" ? (lang === "zh" ? "客户外部回复确认" : lang === "id" ? "Konfirmasi balasan eksternal" : "External customer reply confirmed") : e.kind === "assessment"
                      ? t("New assessment", "Asesmen baru", "新测评")
                      : t("Customer message", "Pesan pelanggan", "客户消息")}
                  </strong>
                  <p>{e.data.text || `${e.data.score} / ${e.data.maxScore}`}</p>
                  <small>{time(e.created_at)}</small>
                  <div className="crm-trust-actions">
                    {["link", "dismiss"].map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        disabled={disabled || busy || unknown}
                        onClick={() => open(kind, e)}
                      >
                        {kindLabel(kind)}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </section>
          )}
          {data?.candidates.some((c: any) => c.decision === "pending") && (
            <button
              type="button"
              className="crm-work-link"
              onClick={onIdentity}
            >
              {t(
                "Identity needs review · Open profile",
                "Identitas perlu ditinjau · Buka profil",
                "身份待核实 · 查看客户资料",
              )}
            </button>
          )}
        </section>
      )}
      {data && mode !== "identity" && !workflowOpen && (
        <section
          id="crm-followup-tasks"
          tabIndex={-1}
          className="crm-unified-task-list"
          aria-label={t("Follow-up tasks", "Tugas tindak lanjut", "跟进任务")}
        >
          <div className="crm-unified-task-heading">
            <h3>
              {t("Follow-up tasks", "Tugas tindak lanjut", "跟进任务")} (
              {pendingTasks.length})
            </h3>
            <button
              type="button"
              className="crm-work-link"
              disabled={disabled || busy || unknown}
              onClick={() => open("create")}
            >
              <Plus size={15} aria-hidden="true" />
              {kindLabel("create")}
            </button>
          </div>
          <p className="crm-task-timezone">
            {t("Times", "Waktu", "时间")} · {timezone}
          </p>
          <div className="crm-task-rows">
            {pendingTasks.length ? (
              pendingTasks
                .filter(
                  (task: any) =>
                    !processingTaskId ||
                    showOther ||
                    task.id === processingTaskId,
                )
                .map(renderTask)
            ) : (
              <p className="crm-work-muted">{emptyFollowUpLabel(lead, lang)}</p>
            )}
          </div>
        </section>
      )}
      {mode !== "identity" && !workflowOpen && (
        <div className="crm-followup-other-tasks">
          {processingTaskId && pendingTasks.length > 1 && (
            <button
              type="button"
              className="crm-work-link"
              onClick={() => setShowOther(!showOther)}
            >
              {showOther
                ? t(
                    "Hide other tasks",
                    "Sembunyikan tugas lain",
                    "收起其他任务",
                  )
                : t(
                    "Show other tasks",
                    "Lihat tugas lain",
                    "查看其他任务",
                  )}{" "}
              (
              {
                pendingTasks.filter((v: any) => v.id !== processingTaskId)
                  .length
              }
              )
            </button>
          )}
        </div>
      )}
      <div
        id="crm-followup-processing"
        className={
          workflowOpen ? "crm-followup-processing crm-sales-focus" : ""
        }
      >
        {editor && (
          <CrmSalesDialog
            isLight={isLight}
            title={kindLabel(editor.kind)}
            suspended={modalSuspended}
            busy={busy || unknown}
            onClose={() => onRequestEdit?.({ kind: "close" })}
          >
            {error && (
              <p role="alert" className="crm-sales-dialog-feedback">
                {error}
              </p>
            )}
            {unknown && (
              <div className="crm-sales-dialog-feedback">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const p = pending.current;
                    if (p) submit(p.path, p.body);
                  }}
                >
                  {t(
                    "Retry original save",
                    "Ulangi penyimpanan awal",
                    "重试原保存",
                  )}
                </button>
                <button type="button" disabled={busy} onClick={querySave}>
                  {t(
                    "Query save result",
                    "Periksa hasil penyimpanan",
                    "查询保存结果",
                  )}
                </button>
              </div>
            )}
            <form
              className="crm-workflow-form crm-task-operation-form"
              onSubmit={(e) => {
                e.preventDefault();
                let body: any = { command: editor.kind, reason };
                let path = "task-actions";
                if (["create", "replace"].includes(editor.kind))
                  Object.assign(body, {
                    action,
                    purpose,
                    timingKind: timing,
                    dueAt: date
                      ? calendarSample(
                          date.slice(0, 10),
                          date.slice(11),
                          timezone,
                        ).toISOString()
                      : "",
                  });
                if (editor.kind === "reschedule")
                  body.scheduledAt = date
                    ? calendarSample(
                        date.slice(0, 10),
                        date.slice(11),
                        timezone,
                      ).toISOString()
                    : "";
                if (editor.task)
                  Object.assign(body, {
                    taskId: editor.task.id,
                    revision: editor.task.revision,
                  });
                if (["link", "dismiss"].includes(editor.kind)) {
                  path = "engagement-actions";
                  Object.assign(body, {
                    engagementId: editor.task.id,
                    version: editor.task.version,
                    engagements: editor.task.members,
                    taskId: choice,
                  });
                }
                if (editor.kind === "identity") {
                  path = "identity-actions";
                  body = {
                    candidateId: editor.task.candidate_id,
                    decision: choice,
                    reason,
                  };
                }
                submit(path, body);
              }}
            >
              <fieldset disabled={busy || unknown || disabled}>
                {editor.task &&
                  !["link", "dismiss", "identity"].includes(editor.kind) && (
                    <div className="crm-sales-task-context" data-fixed-target={editor.kind === "supplement" || undefined}>
                      {editor.kind === "supplement" && <p className="crm-sales-task-target-label">{t("Target task · fixed", "Tugas tujuan · tetap", "目标任务 · 已固定")}</p>}
                      <strong>{taskLabel(editor.task)}</strong>
                      {presentFollowUpTask(
                        editor.task,
                        lang,
                        timezone,
                      ).times.map((v: any, i: number) => (
                        <p key={i}>
                          {v.label} · {time(v.value)}
                        </p>
                      ))}
                    </div>
                  )}
                {editor.kind === "reschedule" && date && (
                  <div className="crm-sales-time-change">
                    <span>
                      {t(
                        "Current agreed time",
                        "Waktu saat ini",
                        "当前约定时间",
                      )}
                      <strong>
                        {time(editor.task.scheduled_at || editor.task.due_at)}
                      </strong>
                    </span>
                    <span aria-hidden="true">→</span>
                    <span>
                      {t("New agreed time", "Waktu baru", "新的约定时间")}
                      <strong>
                        {time(
                          calendarSample(
                            date.slice(0, 10),
                            date.slice(11),
                            timezone,
                          ).toISOString(),
                        )}
                      </strong>
                    </span>
                  </div>
                )}
                <p>
                  {editor.kind === "supplement" ? t(
                    "This information is added only to the task above. Its status and deadline stay unchanged; tasks are not merged.",
                    "Informasi ditambahkan hanya ke tugas di atas. Status dan tenggat tetap; tugas tidak digabungkan.",
                    "补充内容仅保存到上方任务，状态和期限不变，不合并其他任务。",
                  ) : t(
                    "Only the selected item changes. Other tasks and original deadlines remain.",
                    "Hanya item terpilih berubah. Tugas lain dan tenggat awal tetap.",
                    "仅处理选定事项，保留其他任务及原始期限。",
                  )}
                </p>
                {["create", "replace"].includes(editor.kind) && (
                  <>
                    <label>
                      {t("Action", "Tindakan", "具体动作")}
                      <input
                        required
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                      />
                    </label>
                    <label>
                      {t("Purpose", "Tujuan", "用途")}
                      <input
                        required
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                      />
                    </label>
                    <CrmSingleSelect
                      label={t("Time meaning", "Makna waktu", "时间含义")}
                      value={timing}
                      onChange={setTiming}
                      options={[
                        { value: "", label: t("Choose time meaning", "Pilih makna waktu", "请选择时间含义") },
                        ...["response", "appointment", "review"].map(
                          (value) => ({ value, label: label(value) }),
                        ),
                      ]}
                      lang={lang}
                      isLight={isLight}
                    />
                  </>
                )}
                {["create", "replace", "reschedule"].includes(editor.kind) && (
                  <label>
                    {editor.kind === "reschedule"
                      ? t(
                          "New agreed execution time",
                          "Waktu pelaksanaan baru",
                          "新约定执行时间",
                        )
                      : timing ? label(timing) : t("Time", "Waktu", "时间")}{" "}
                    · {timezone}
                    <input
                      required
                      type="datetime-local"
                      value={date}
                      onInput={(e) => setDate(e.currentTarget.value)}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                )}
                {editor.kind === "link" && (
                  <CrmSingleSelect
                    label={t("Task", "Tugas", "任务")}
                    value={choice}
                    onChange={setChoice}
                    options={[
                      {
                        value: "",
                        label: t("Choose a task", "Pilih tugas", "选择任务"),
                      },
                      ...(data?.tasks || [])
                        .filter((v: any) =>
                          ["open", "overdue"].includes(v.status),
                        )
                        .map((v: any) => ({
                          value: v.id,
                          label: taskLabel(v),
                        })),
                    ]}
                    lang={lang}
                    isLight={isLight}
                  />
                )}
                {editor.kind === "identity" && (
                  <CrmSingleSelect
                    label={t("Decision", "Keputusan", "判断")}
                    value={choice}
                    onChange={setChoice}
                    options={[
                      { value: "", label: t("Choose", "Pilih", "请选择") },
                      {
                        value: "same",
                        label: t(
                          "Same customer",
                          "Pelanggan yang sama",
                          "同一客户",
                        ),
                      },
                      {
                        value: "different",
                        label: t(
                          "Different customers",
                          "Pelanggan berbeda",
                          "不同客户",
                        ),
                      },
                    ]}
                    lang={lang}
                    isLight={isLight}
                  />
                )}
                <label>
                  {editor.kind === "supplement" ? t("Additional information", "Informasi tambahan", "补充内容") : t("Reason / evidence", "Alasan / bukti", "原因／依据")}
                  <textarea
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <div className="crm-sales-dialog-actions">
                  <button disabled={busy || disabled || unknown} type="submit">
                    {editor.kind === "supplement" ? t("Save information", "Simpan informasi", "保存补充") : t("Confirm and save", "Konfirmasi dan simpan", "确认保存")}
                  </button>
                  <button
                    type="button"
                    disabled={busy || unknown}
                    onClick={() => onRequestEdit?.({ kind: "close" })}
                  >
                    {t("Cancel", "Batal", "取消")}
                  </button>
                </div>
              </fieldset>
            </form>
          </CrmSalesDialog>
        )}
        {children}
      </div>
      {mode === "identity" &&
        data?.candidates.some((c: any) => c.decision === "pending") && (
          <CrmDisclosure
            heading={
              <>{t("Identity candidates", "Kandidat identitas", "身份候选")}</>
            }
          >
            <p>
              {t(
                "Known sessions continue automatically. Matching contact details alone never merge customers. Sales may confirm candidates within their existing access. Confirmation records a relationship; records and owners are not transferred.",
                "Sesi yang dikenal berlanjut otomatis. Kontak yang cocok tidak menggabungkan pelanggan. Sales dapat mengonfirmasi kandidat dalam aksesnya. Konfirmasi mencatat hubungan; catatan dan penanggung jawab tidak dipindahkan.",
                "已知会话自动续记；联系方式相同不自动合并。销售可在现有权限内核实候选。确认只记录关系，不迁移历史或客户归属。",
              )}
            </p>
            {data.candidates
              .filter((c: any) => c.decision === "pending")
              .map((c: any) => (
                <button
                  key={c.candidate_id}
                  type="button"
                  disabled={disabled || busy || unknown || !c.canConfirm}
                  onClick={() => open("identity", c)}
                >
                  {c.name} · {kindLabel("identity")}
                </button>
              ))}
          </CrmDisclosure>
        )}
      {mode !== "identity" && data && !workflowOpen && (
        <CrmFollowupHistory
          facts={data.facts}
          journey={journey}
          tasks={data.tasks}
          lang={lang}
          timezone={timezone}
          isLight={isLight}
          taskId={historyTask}
          onClearTask={() => setHistoryTask(undefined)}
          onSource={onSource}
          kindLabel={kindLabel}
          historyTasks={
            <>
              {" "}
              {data.tasks.some(
                (v: any) =>
                  ["completed", "cancelled"].includes(v.status) ||
                  (v.status === "migration_hold" &&
                    ["Enrolled", "Lost"].includes(lead.currentStage)),
              ) && (
                <CrmDisclosure
                  heading={t("Past tasks", "Riwayat tugas", "历史任务")}
                  open={historyOpen}
                  onToggle={(e) => setHistoryOpen(e.currentTarget.open)}
                >
                  {data.tasks
                    .filter(
                      (v: any) =>
                        ["completed", "cancelled"].includes(v.status) ||
                        (v.status === "migration_hold" &&
                          ["Enrolled", "Lost"].includes(lead.currentStage)),
                    )
                    .map(renderTask)}
                </CrmDisclosure>
              )}
            </>
          }
        />
      )}
    </section>
  );
}
