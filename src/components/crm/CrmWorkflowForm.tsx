import { trustError } from "../../utils/crmTrustLanguage";
import { completionForEntry } from "../../utils/crmSalesInput";
import { CrmDisclosure } from "./CrmDisclosure";
import { presentFollowUpTask } from "../../utils/crmTaskPresentation";
import { useState, useEffect, useRef } from "react";
import { CrmSingleSelect } from "./CrmSingleSelect";
import { calendarSample, nextWork } from "../../utils/workCalendar";
import { crmError } from "../../utils/crmLanguage";
import type { CrmLanguage } from "../../utils/crmLanguage";
export function CrmWorkflowForm({
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
  administrative,
  workCalendar,
  initialDraft,
  onDraft,
}: any) {
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  const [requestId] = useState(
    () => initialDraft?.requestId || crypto.randomUUID(),
  );
  const [completed, setCompleted] = useState<string[]>(
    completionForEntry(selectedTask, initialDraft?.completed || []),
  );
  const [taskOutcome, setTaskOutcome] = useState(
    initialDraft?.taskOutcome || "",
  );
  const [summary, setSummary] = useState(initialDraft?.summary || ""),
    [action, setAction] = useState(initialDraft?.action || ""),
    [purpose, setPurpose] = useState(initialDraft?.purpose || ""),
    [date, setDate] = useState(initialDraft?.date || ""),
    [reason, setReason] = useState(initialDraft?.reason || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [channel, setChannel] = useState(initialDraft?.channel || ""),
    [contact, setContact] = useState(initialDraft?.contact || ""),
    [stage, setStage] = useState(
      initialDraft?.stage || lead.currentStage || "New",
    ),
    [signal, setSignal] = useState(initialDraft?.signal || "");
  const tasks = (lead.attention?.tasks || []).filter((v: any) =>
    ["open", "overdue"].includes(v.status),
  );
  const boundTask = tasks.find((v: any) => v.id === selectedTask);
  const boundView = boundTask && presentFollowUpTask(boundTask, lang, timezone);
  const boundRevision = useRef(
    initialDraft?.boundRevision ?? boundTask?.revision,
  );
  const completedIds = completionForEntry(selectedTask, completed);
  const heading = selectedTask
    ? t("Process this task", "Proses tugas ini", "处理此任务")
    : administrative
      ? t(
          "Adjust contact arrangement",
          "Ubah pengaturan kontak",
          "调整联系安排",
        )
      : t("Record contact", "Catat kontak", "记录联系");
  const [arrangement, setArrangement] = useState(
    initialDraft?.arrangement || lead.contactArrangement?.state || "active",
  );
  const [arrangementReason, setArrangementReason] = useState(
    initialDraft?.arrangementReason || "",
  );
  const [reviewDate, setReviewDate] = useState(initialDraft?.reviewDate || "");
  const nextRef = useRef(false);
  const pending = useRef<any>(initialDraft?.pending || null);
  const [unknown, setUnknown] = useState(Boolean(initialDraft?.unknown));
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const [recordKind, setRecordKind] = useState(
    initialDraft?.recordKind || (administrative ? "closure" : "contact"),
  );
  const [disposition, setDisposition] = useState(
    initialDraft?.disposition || "",
  );
  useEffect(() => {
    if (disposition === "record_only" && completed.length) setDisposition("");
  }, [completed, disposition]);
  useEffect(() => {
    onDraft?.({
      pending: pending.current,
      unknown,
      boundRevision: boundRevision.current,
      originalStage: originalStage.current,
      originalStageRevision: originalStageRevision.current,
      originalArrangement: originalArrangement.current,
      arrangementVersion: arrangementVersion.current,
      requestId,
      completed,
      taskOutcome,
      summary,
      action,
      purpose,
      date,
      reason,
      arrangement,
      arrangementReason,
      reviewDate,
      channel,
      contact,
      stage,
      signal,
      recordKind,
      disposition,
    });
  }, [
    requestId,
    unknown,
    completed,
    taskOutcome,
    summary,
    action,
    purpose,
    date,
    reason,
    arrangement,
    arrangementReason,
    reviewDate,
    channel,
    contact,
    stage,
    signal,
    recordKind,
    disposition,
  ]);
  const originalArrangement = useRef(
    initialDraft?.originalArrangement ||
      lead.contactArrangement?.state ||
      "active",
  );
  const originalStageRevision = useRef(
    initialDraft?.originalStageRevision ?? lead.stageRevision ?? 0,
  );
  const originalStage = useRef(
    initialDraft?.originalStage || lead.currentStage || "New",
  );
  const arrangementVersion = useRef(
    initialDraft?.arrangementVersion ?? lead.contactArrangement?.version ?? 0,
  );
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) onDirty?.();
    else mounted.current = true;
  }, [
    summary,
    action,
    purpose,
    date,
    reason,
    completed,
    taskOutcome,
    disposition,
    channel,
    contact,
    stage,
    signal,
    recordKind,
    arrangement,
    arrangementReason,
    reviewDate,
  ]);
  useEffect(() => {
    document
      .getElementById("crm-sales-editor-title")
      ?.focus({ preventScroll: true });
  }, []);
  const select = (
    label: string,
    value: string,
    change: (v: string) => void,
    options: string[][],
  ) => (
    <label className="block">
      <span>{label}</span>
      <CrmSingleSelect
        label={label}
        value={value}
        onChange={change}
        options={options.map(([value, label]) => ({ value, label }))}
        lang={lang as CrmLanguage}
        isLight={isLight}
      />
    </label>
  );
  return (
    <form
      className="crm-workflow-form crm-sales-editor"
      noValidate
      onChange={() => onDirty?.()}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        onBusy?.(true);
        setError("");
        try {
          if (selectedTask && !boundTask)
            throw Error("Selected task changed; refresh and review");
          if (!pending.current) {
            if (recordKind !== "closure" && !channel)
              throw Error("Choose a contact channel");
            if (recordKind !== "closure" && !contact)
              throw Error("Choose a contact result");
            if (selectedTask && !taskOutcome)
              throw Error("Choose a task outcome");
            if (!disposition) throw Error("Choose the next arrangement");
            if (disposition === "none" && !arrangement)
              throw Error("Choose a contact arrangement");
          }
          const nextFollowUpAt = date
            ? calendarSample(
                date.slice(0, 10),
                date.slice(11),
                timezone,
              ).toISOString()
            : undefined;
          const r = await fetch(`/api/crm/leads/${lead.id}/logs`, {
            method: "POST",
            signal: AbortSignal.timeout(20000),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              (pending.current ||= {
                requestId,
                summary,
                completeTaskIds: completedIds,
                processingTaskId: selectedTask || null,
                taskOutcome: selectedTask ? taskOutcome : undefined,
                expectedTaskRevision: boundRevision.current,
                disposition,
                noNextReason: reason,
                nextAction: action,
                nextPurpose: purpose,
                nextFollowUpAt,
                channel: recordKind === "closure" ? undefined : channel,
                recordKind,
                sourceMessageId: sourceMessage?.id,
                sourceConversationId: sourceMessage?.conversation_id,
                connectStatus: recordKind === "closure" ? undefined : contact,
                newStage: stage !== originalStage.current ? stage : undefined,
                expectedStage: originalStage.current,
                expectedStageRevision: originalStageRevision.current,
                ...(disposition === "none" ||
                arrangement !== originalArrangement.current
                  ? {
                      contactArrangement: {
                        state: arrangement,
                        reason: arrangementReason,
                        reviewAt: reviewDate
                          ? calendarSample(
                              reviewDate.slice(0, 10),
                              reviewDate.slice(11),
                              timezone,
                            ).toISOString()
                          : undefined,
                        version: arrangementVersion.current,
                      },
                    }
                  : {}),
                buyingSignalDetected: signal || undefined,
              }),
            ),
          });
          const d = await r.json();
          if (!r.ok) {
            if (r.status < 500) pending.current = null;
            throw Error(d.error);
          }
          pending.current = null;
          setUnknown(false);
          await onSaved(
            { ...d, recordOnly: disposition === "record_only" },
            nextRef.current,
          );
        } catch (e) {
          setUnknown(Boolean(pending.current));
          setError(
            pending.current ||
              ["AbortError", "TimeoutError"].includes((e as Error).name)
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
            {lead.fullName} · {t("Recorded by", "Dicatat oleh", "记录人")}{" "}
            {employee.displayName || employee.id}
          </p>
          <h3 tabIndex={-1} id="crm-sales-editor-title">
            {heading}
          </h3>
        </div>
        <button
          type="button"
          className="crm-work-button"
          disabled={busy || unknown}
          onClick={onCancel}
        >
          {t("Back", "Kembali", "返回")}
        </button>
      </header>
      <div className="crm-sales-editor-layout">
        <aside className="crm-sales-context">
          {boundView && (
            <section>
              <h4>
                {t(
                  "Task being handled",
                  "Tugas yang sedang ditangani",
                  "本次处理任务",
                )}
              </h4>
              <strong>{boundView.action}</strong>
              {boundView.times.map((v: any, i: number) => (
                <p key={i}>
                  {v.label} · {boundView.formatTime(v.value)}
                </p>
              ))}
            </section>
          )}
          {sourceMessage && (
            <section>
              <h4>
                {t(
                  "Linked customer message",
                  "Pesan pelanggan terkait",
                  "已关联客户消息",
                )}
              </h4>
              <p className="crm-sales-original">{sourceMessage.content}</p>
            </section>
          )}
          {lead.followUpLogs?.length > 0 && (
            <section>
              <h4>
                {t(
                  "Latest saved note",
                  "Catatan tersimpan terakhir",
                  "最近记录",
                )}
              </h4>
              <p className="crm-sales-original">
                {
                  [...lead.followUpLogs].sort(
                    (a: any, b: any) =>
                      Date.parse(b.timestamp) - Date.parse(a.timestamp),
                  )[0]?.summary
                }
              </p>
            </section>
          )}
          <section>
            <h4>
              {t(
                "Other tasks stay unchanged",
                "Tugas lain tetap",
                "其他任务保持不变",
              )}
            </h4>
            {tasks
              .filter((v: any) => v.id !== selectedTask)
              .map((v: any) => (
                <p key={v.id}>
                  {presentFollowUpTask(v, lang, timezone).action}
                </p>
              ))}
          </section>
        </aside>
        <fieldset disabled={busy || unknown} className="crm-sales-fields">
          <section className="crm-sales-step">
            <h4>{t("This record", "Catatan kali ini", "本次记录")}</h4>
            {selectedTask && (
              <div
                className="crm-sales-segments"
                role="group"
                aria-label={t("Record type", "Jenis catatan", "记录类型")}
              >
                {[
                  [
                    "contact",
                    t("Customer contact", "Kontak pelanggan", "客户联系"),
                  ],
                  [
                    "closure",
                    t("Internal handling", "Penanganan internal", "内部处理"),
                  ],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={recordKind === value}
                    onClick={() => setRecordKind(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {recordKind === "closure" && (
              <p className="crm-work-muted">
                {t(
                  "Record internal work or a review; this does not count as customer contact.",
                  "Catat pekerjaan internal atau tinjauan; ini tidak dihitung sebagai kontak pelanggan.",
                  "记录内部核实或复查结果，不计为客户联系。",
                )}
              </p>
            )}
            {recordKind === "contact" && (
              <div className="crm-workflow-grid">
                {select(
                  t("Channel", "Kanal", "沟通方式"),
                  channel,
                  setChannel,
                  [
                    [
                      "",
                      t("Choose a channel", "Pilih kanal", "请选择沟通方式"),
                    ],
                    ["WhatsApp", "WhatsApp"],
                    ["Phone Call", t("Phone call", "Telepon", "电话")],
                    ["Email", t("Email", "Email", "电子邮件")],
                    [
                      "Campus Visit",
                      t("Campus visit", "Kunjungan kampus", "校区接待"),
                    ],
                    ["Other", t("Other", "Lainnya", "其他")],
                  ],
                )}
                {select(
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
              {recordKind === "closure"
                ? t(
                    "Handling result and reason",
                    "Hasil penanganan dan alasan",
                    "处理结果与依据",
                  )
                : t("Contact summary", "Ringkasan kontak", "沟通记录")}
              <textarea
                required
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
              />
            </label>
            <CrmDisclosure
              heading={
                <>{t("Sales progress", "Perkembangan penjualan", "销售进展")}</>
              }
              open={false}
            >
              {select(t("Stage", "Tahap", "销售阶段"), stage, setStage, [
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
              ])}
              {select(
                t("New buying signal", "Sinyal pembelian baru", "本次购买信号"),
                signal,
                setSignal,
                [
                  ["", t("No change", "Tidak diubah", "不修改")],
                  [
                    "None yet",
                    t(
                      "No new signal",
                      "Tidak ada sinyal baru",
                      "未观察到新信号",
                    ),
                  ],
                  [
                    "Asked price",
                    t("Asked price", "Menanyakan biaya", "咨询学费"),
                  ],
                  [
                    "Asked schedule",
                    t("Asked schedule", "Menanyakan jadwal", "询问开班"),
                  ],
                  [
                    "Asked payment",
                    t("Asked payment", "Menanyakan pembayaran", "询问付款"),
                  ],
                  [
                    "Ready to enroll",
                    t("Ready to enroll", "Siap mendaftar", "准备报名"),
                  ],
                ],
              )}
            </CrmDisclosure>
          </section>
          {selectedTask && (
            <section className="crm-sales-step">
              <h4>{t("Task outcome", "Hasil tugas", "任务结果")}</h4>
              <div
                className="crm-sales-segments"
                role="group"
                aria-label={t(
                  "Outcome for this task",
                  "Hasil untuk tugas ini",
                  "此任务处理结果",
                )}
              >
                {[
                  [
                    false,
                    t("Keep task open", "Biarkan tugas terbuka", "保持待处理"),
                  ],
                  [
                    true,
                    t(
                      "Complete this task",
                      "Selesaikan tugas ini",
                      "完成此任务",
                    ),
                  ],
                ].map(([done, label]) => (
                  <button
                    key={String(done)}
                    type="button"
                    aria-pressed={taskOutcome === (done ? "complete" : "keep")}
                    onClick={() => {
                      setTaskOutcome(done ? "complete" : "keep");
                      setCompleted(done ? [selectedTask] : []);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="crm-work-muted">
                {t(
                  "Only this task is affected. Other tasks and deadlines remain unchanged.",
                  "Hanya tugas ini yang terpengaruh. Tugas lain dan tenggatnya tetap.",
                  "仅处理当前任务，其他任务及其期限保持不变。",
                )}
              </p>
            </section>
          )}
          <section className="crm-sales-step">
            <h4>
              {t("Next arrangement", "Pengaturan berikutnya", "下一步安排")}
            </h4>
            {select(
              t("Next arrangement", "Pengaturan berikutnya", "后续去向"),
              disposition,
              (v) => {
                setDisposition(v);
                if (v === "none" && arrangement === "active")
                  setArrangement("");
                if (v !== "none" && !arrangement)
                  setArrangement(originalArrangement.current);
              },
              [
                [
                  "",
                  t(
                    "Choose the next arrangement",
                    "Pilih pengaturan berikutnya",
                    "请选择后续安排",
                  ),
                ],
                ...(!completed.length
                  ? [
                      [
                        "record_only",
                        t(
                          "Record only; keep arrangements",
                          "Catat saja; pertahankan pengaturan",
                          "仅记录，保留原安排",
                        ),
                      ],
                    ]
                  : []),
                [
                  "keep",
                  t(
                    "Keep existing task",
                    "Pertahankan tugas yang ada",
                    "保留已有安排",
                  ),
                ],
                [
                  "schedule",
                  t(
                    "Schedule next step",
                    "Jadwalkan langkah berikutnya",
                    "安排下一步",
                  ),
                ],
                [
                  "none",
                  t(
                    "Wait, nurture or stop contact",
                    "Tunggu, bina, atau hentikan kontak",
                    "等待、培育或停止联系",
                  ),
                ],
                ...(["Enrolled", "Lost"].includes(stage)
                  ? [
                      [
                        "closed",
                        t(
                          "Customer closed",
                          "Pelanggan ditutup",
                          "客户已成交或关闭",
                        ),
                      ],
                    ]
                  : []),
              ],
            )}
            {disposition === "schedule" && (
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
                  {t("Purpose", "Tujuan", "安排依据")}
                  <input
                    required
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="crm-work-link"
                  onClick={() => {
                    const day = new Intl.DateTimeFormat("en-CA", {
                      timeZone: timezone,
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    }).format(new Date(Date.now() + 86400000));
                    const c = {
                      timezone,
                      days: workCalendar.workDays,
                      start: workCalendar.startTime,
                      end: workCalendar.endTime,
                    };
                    const d = nextWork(
                      calendarSample(day, c.start, timezone),
                      c,
                    );
                    const parts = new Intl.DateTimeFormat("sv-SE", {
                      timeZone: timezone,
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      hourCycle: "h23",
                    }).format(d);
                    setDate(parts.replace(" ", "T"));
                  }}
                >
                  {t(
                    "Next working day start",
                    "Awal hari kerja berikutnya",
                    "下个工作日开始",
                  )}
                </button>
                <label>
                  {t("Deadline", "Tenggat", "截止时间")} · {timezone}
                  <input
                    required
                    type="datetime-local"
                    value={date}
                    onInput={(e) => setDate(e.currentTarget.value)}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
              </>
            )}
            {disposition === "none" && (
              <>
                {select(
                  t("Contact arrangement", "Pengaturan kontak", "联系安排"),
                  arrangement,
                  setArrangement,
                  [
                    [
                      "",
                      t(
                        "Choose a contact arrangement",
                        "Pilih pengaturan kontak",
                        "请选择联系安排",
                      ),
                    ],
                    [
                      "waiting",
                      t(
                        "Wait until review",
                        "Tunggu hingga tinjauan",
                        "等待至复查时间",
                      ),
                    ],
                    [
                      "nurture",
                      t("Pause for nurturing", "Jeda pembinaan", "暂缓培育"),
                    ],
                    [
                      "stopped",
                      t(
                        "Stop proactive contact",
                        "Hentikan kontak proaktif",
                        "停止主动联系",
                      ),
                    ],
                  ],
                )}
                <label>
                  {t("Reason", "Alasan", "原因")}
                  <textarea
                    required
                    value={arrangementReason}
                    onChange={(e) => setArrangementReason(e.target.value)}
                  />
                </label>
                {["waiting", "nurture"].includes(arrangement) && (
                  <label>
                    {t("Review time", "Waktu tinjauan", "复查时间")} ·{" "}
                    {timezone}
                    <input
                      required
                      type="datetime-local"
                      value={reviewDate}
                      onChange={(e) => setReviewDate(e.target.value)}
                    />
                  </label>
                )}
              </>
            )}
            {disposition !== "none" &&
              lead.contactArrangement &&
              lead.contactArrangement.state !== "active" && (
                <>
                  <label>
                    <input
                      type="checkbox"
                      checked={arrangement === "active"}
                      onChange={(e) =>
                        setArrangement(
                          e.target.checked
                            ? "active"
                            : lead.contactArrangement.state,
                        )
                      }
                    />
                    {t(
                      "Restore proactive contact",
                      "Pulihkan kontak proaktif",
                      "恢复主动联系",
                    )}
                  </label>
                  <label>
                    {t("Reason", "Alasan", "原因")}
                    <textarea
                      required
                      value={arrangementReason}
                      onChange={(e) => setArrangementReason(e.target.value)}
                    />
                  </label>
                </>
              )}
          </section>
        </fieldset>
      </div>
      <footer className="crm-sales-editor-footer">
        <div className="crm-sales-effect">
          {recordKind === "closure"
            ? t(
                "Save one internal record",
                "Simpan satu catatan internal",
                "保存一条内部处理记录",
              )
            : t(
                "Save one contact record",
                "Simpan satu catatan kontak",
                "保存一条联系记录",
              )}{" "}
          ·{" "}
          {unknown
            ? t("Retry original save", "Ulangi penyimpanan awal", "重试原保存")
            : selectedTask && !taskOutcome
              ? t(
                  "Task outcome not selected",
                  "Hasil tugas belum dipilih",
                  "尚未选择任务结果",
                )
              : completedIds.length
                ? t(
                    "Complete this task",
                    "Selesaikan tugas ini",
                    "完成当前任务",
                  )
                : t(
                    "No tasks completed",
                    "Tidak ada tugas diselesaikan",
                    "不完成任务",
                  )}
        </div>
        {unknown && (
          <button
            type="button"
            className="crm-work-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              onBusy?.(true);
              setError("");
              try {
                const r = await fetch(
                  `/api/crm/leads/${lead.id}/operations/${requestId}`,
                );
                const result = await r.json();
                if (!r.ok) throw Error(result.error);
                const detailResponse = await fetch(`/api/crm/leads/${lead.id}`);
                const detail = await detailResponse.json();
                if (!detailResponse.ok) throw Error(detail.error);
                pending.current = null;
                setUnknown(false);
                await onSaved(
                  {
                    ...result,
                    lead: detail.lead,
                    recordOnly: disposition === "record_only",
                  },
                  nextRef.current,
                );
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
        {error && (
          <p role="alert" ref={errorRef} tabIndex={-1}>
            {error === "Operation not found"
              ? trustError(error, lang)
              : crmError(error, lang)}
          </p>
        )}
        <button
          type="submit"
          className="crm-work-button"
          disabled={busy || unknown}
          onClick={() => {
            nextRef.current = true;
            onNext?.();
          }}
        >
          {t("Save and next", "Simpan dan lanjut", "保存并下一位")}
        </button>
        <button
          onClick={() => {
            if (!unknown) nextRef.current = false;
          }}
          type="submit"
          className="crm-work-button"
          data-primary="true"
          disabled={busy || Boolean(selectedTask && !boundTask)}
        >
          {unknown
            ? t("Retry original save", "Ulangi penyimpanan awal", "重试原保存")
            : selectedTask && !taskOutcome
              ? t("Save record", "Simpan catatan", "保存记录")
            : completedIds.length
              ? t(
                  "Save and complete this task",
                  "Simpan dan selesaikan tugas ini",
                  "保存并完成此任务",
                )
              : selectedTask
                ? t(
                    "Save progress; keep task open",
                    "Simpan progres; tugas tetap terbuka",
                    "保存进展，保持待处理",
                  )
                : t("Save record", "Simpan catatan", "保存记录")}
        </button>
        <button
          type="button"
          className="crm-work-button"
          disabled={busy || unknown}
          onClick={onCancel}
        >
          {t("Cancel", "Batal", "取消")}
        </button>
      </footer>
    </form>
  );
}
