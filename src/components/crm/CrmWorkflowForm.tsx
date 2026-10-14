import { describeFollowUpTask } from "../../utils/crmFollowUp";
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
    initialDraft?.completed || (selectedTask ? [selectedTask] : []),
  );
  const [summary, setSummary] = useState(initialDraft?.summary || ""),
    [action, setAction] = useState(initialDraft?.action || ""),
    [purpose, setPurpose] = useState(initialDraft?.purpose || ""),
    [date, setDate] = useState(initialDraft?.date || ""),
    [reason, setReason] = useState(initialDraft?.reason || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [channel, setChannel] = useState(initialDraft?.channel || "WhatsApp"),
    [contact, setContact] = useState(initialDraft?.contact || ""),
    [stage, setStage] = useState(
      initialDraft?.stage || lead.currentStage || "New",
    ),
    [signal, setSignal] = useState(initialDraft?.signal || "None yet");
  const tasks = (lead.attention?.tasks || []).filter((v: any) =>
    ["open", "overdue"].includes(v.status),
  );
  const [arrangement, setArrangement] = useState(
    initialDraft?.arrangement || lead.contactArrangement?.state || "active",
  );
  const [arrangementReason, setArrangementReason] = useState(
    initialDraft?.arrangementReason || "",
  );
  const [reviewDate, setReviewDate] = useState(initialDraft?.reviewDate || "");
  const nextRef = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const [recordKind, setRecordKind] = useState(
    initialDraft?.recordKind || (administrative ? "closure" : "contact"),
  );
  const [disposition, setDisposition] = useState(
    initialDraft?.disposition ||
      (tasks.some((v: any) => v.id !== selectedTask)
        ? "keep"
        : ["Enrolled", "Lost"].includes(lead.currentStage)
          ? "closed"
          : "schedule"),
  );
  useEffect(() => {
    onDraft?.({
      originalStage:originalStage.current,originalArrangement:originalArrangement.current,arrangementVersion:arrangementVersion.current,
      requestId,
      completed,
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
    completed,
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
  const originalArrangement=useRef(initialDraft?.originalArrangement || lead.contactArrangement?.state || "active");
  const originalStage=useRef(initialDraft?.originalStage || lead.currentStage || "New");
  const arrangementVersion=useRef(initialDraft?.arrangementVersion ?? lead.contactArrangement?.version ?? 0);
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
    disposition,
    channel,
    contact,
    stage,
    signal,
    recordKind,
  ]);
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
      className="crm-workflow-form"
      noValidate
      onChange={() => onDirty?.()}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        onBusy?.(true);
        setError("");
        try {
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
            body: JSON.stringify({
              requestId,
              summary,
              completeTaskIds: completed,
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
              buyingSignalDetected: signal,
            }),
          });
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          await onSaved(d, nextRef.current);
        } catch (e) {
          setError(
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
      <h3>{t("Record result", "Catat hasil", "记录处理结果")}</h3>
      <p>
        {t("Recorded by", "Dicatat oleh", "记录人")}：
        {employee.displayName || employee.id}
      </p>
      {sourceMessage && (
        <p>
          {t(
            "Linked customer message",
            "Pesan pelanggan terkait",
            "已关联客户消息",
          )}
          ：{sourceMessage.content}
        </p>
      )}
      {select(
        t("Record type", "Jenis catatan", "处理类型"),
        recordKind,
        setRecordKind,
        [
          ["contact", t("Customer contact", "Kontak pelanggan", "客户联系")],
          [
            "closure",
            t(
              "Administrative record",
              "Catatan administratif",
              "非联系处理记录",
            ),
          ],
        ],
      )}
      {recordKind === "contact" && (
        <div className="crm-workflow-grid">
          {select(t("Channel", "Kanal", "沟通方式"), channel, setChannel, [
            ["WhatsApp", "WhatsApp"],
            ["Phone Call", t("Phone call", "Telepon", "电话")],
            ["Email", t("Email", "Email", "电子邮件")],
            ["Campus Visit", t("Campus visit", "Kunjungan kampus", "校区接待")],
            ["Other", t("Other", "Lainnya", "其他")],
          ])}
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
        {t("Notes", "Catatan", "沟通记录")}
        <textarea
          required
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
        />
      </label>
      <details open={contact === "Connected"}>
        <summary>
          {t("Sales progress", "Perkembangan penjualan", "销售进展")}
        </summary>
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
            [
              "None yet",
              t("No new signal", "Tidak ada sinyal baru", "未观察到新信号"),
            ],
            ["Asked price", t("Asked price", "Menanyakan biaya", "咨询学费")],
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
      </details>
      <fieldset>
        <legend>
          {t(
            "Complete only selected tasks",
            "Selesaikan tugas yang dipilih saja",
            "仅完成以下勾选任务",
          )}
        </legend>
        {tasks.map((v: any) => (
          <label key={v.id}>
            <input
              type="checkbox"
              checked={completed.includes(v.id)}
              onChange={() =>
                setCompleted(
                  completed.includes(v.id)
                    ? completed.filter((x) => x !== v.id)
                    : [...completed, v.id],
                )
              }
            />
            {describeFollowUpTask(v, lang, timezone).action} ·{" "}
            {describeFollowUpTask(v, lang, timezone).timing}
          </label>
        ))}
      </fieldset>
      {select(
        t("Next arrangement", "Pengaturan berikutnya", "后续去向"),
        disposition,
        (v) => {
          setDisposition(v);
          if (v === "none" && arrangement === "active")
            setArrangement("waiting");
        },
        [
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
                  t("Customer closed", "Pelanggan ditutup", "客户已成交或关闭"),
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
              const d = nextWork(calendarSample(day, c.start, timezone), c);
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
              {t("Review time", "Waktu tinjauan", "复查时间")} · {timezone}
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
                    e.target.checked ? "active" : lead.contactArrangement.state,
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
      {false && (
        <label>
          {t("Reason", "Alasan", "暂不安排原因")}
          <textarea
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      )}
      <p>
        {t(
          "Tasks selected for completion",
          "Tugas dipilih untuk diselesaikan",
          "本次选定完成任务",
        )}
        ：{completed.length}
      </p>
      {error && (
        <p role="alert" ref={errorRef} tabIndex={-1}>
          {crmError(error, lang)}
        </p>
      )}
      <button
        type="submit"
        className="crm-work-button"
        disabled={busy}
        onClick={() => {
          nextRef.current = true;
          onNext?.();
        }}
      >
        {t("Save and next", "Simpan dan lanjut", "保存并下一位")}
      </button>
      <button
        onClick={() => {
          nextRef.current = false;
        }}
        type="submit"
        className="crm-work-button"
        data-primary="true"
        disabled={busy}
      >
        {t("Save result", "Simpan hasil", "保存处理结果")}
      </button>
      <button type="button" className="crm-work-button" onClick={onCancel}>
        {t("Cancel", "Batal", "取消")}
      </button>
    </form>
  );
}
