import {CrmSimpleWorkflow} from './CrmSimpleWorkflow';
import {CrmProgressForm} from './CrmProgressForm';
export function CrmWorkflowForm(props:any){return <CrmSimpleWorkflow {...props}/>;}
import {taskCompletionGuidance} from '../../utils/crmTaskGuidance';
import {CrmTaskOverlap} from './CrmTaskOverlap';
import {formatCrmOperatingTime} from '../../utils/crmOperatingTime';
import { trustError } from "../../utils/crmTrustLanguage";
import { completionForEntry } from "../../utils/crmSalesInput";
import { CrmDisclosure } from "./CrmDisclosure";
import { presentFollowUpTask } from "../../utils/crmTaskPresentation";
import { useState, useEffect, useRef } from "react";
import { CrmSingleSelect } from "./CrmSingleSelect";
import { calendarSample, nextWork } from "../../utils/workCalendar";
import { crmError } from "../../utils/crmLanguage";
import type { CrmLanguage } from "../../utils/crmLanguage";
function CrmArrangementForm({
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
  const [requestData,setRequestData]=useState<any[]|null>(null),[requestLoadFailed,setRequestLoadFailed]=useState(false);
  const [handledRequests,setHandledRequests]=useState<string[]>(initialDraft?.handledRequests||[]);
  const [nextCommand,setNextCommand]=useState(initialDraft?.nextCommand||''),[nextTarget,setNextTarget]=useState(initialDraft?.nextTarget||'');
  const [separateMatter,setSeparateMatter]=useState(initialDraft?.separateMatter||false),[sameMatter,setSameMatter]=useState(initialDraft?.sameMatter||false);
  useEffect(()=>{let cancelled=false;fetch('/api/crm/leads/'+lead.id+'/trust',{signal:AbortSignal.timeout(15000)}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(!cancelled)setRequestData(d.requests||[]);}).catch(()=>{if(!cancelled)setRequestLoadFailed(true);});return()=>{cancelled=true;};},[lead.id]);
  const taskRequests=(requestData||[]).filter(r=>r.task_id===selectedTask&&r.state==='linked');
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
  const [reviewTask,setReviewTask]=useState(initialDraft?.reviewTask || false);
  const [blockBefore,setBlockBefore]=useState(initialDraft?.blockBefore || false);
  const [cancelReview,setCancelReview]=useState(initialDraft?.cancelReview || false);
  const [messageAnswered,setMessageAnswered]=useState(initialDraft?.messageAnswered || false);
  const nextRef = useRef(false);
  const pending = useRef<any>(initialDraft?.pending || null);
  const [unknown, setUnknown] = useState(Boolean(initialDraft?.unknown));
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const [recordKind, setRecordKind] = useState(
    initialDraft?.recordKind || (administrative || boundTask?.kind === "contact_review" || boundTask?.timing_kind === "review" ? "closure" : "contact"),
  );
  const [customerReplied, setCustomerReplied] = useState(initialDraft?.customerReplied || false);
  const [disposition, setDisposition] = useState(
    initialDraft?.disposition || "",
  );
  useEffect(() => {
    if (disposition === "record_only" && (completed.length||handledRequests.length)) setDisposition("");
  }, [completed, handledRequests, disposition]);
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
      handledRequests,nextCommand,nextTarget,separateMatter,sameMatter,
      completed,
      taskOutcome,
      summary,
      action,
      purpose,
      date,
      reason,
      arrangement,
      arrangementReason,
      reviewTask,blockBefore,cancelReview,messageAnswered,
      channel,
      contact,
      stage,
      signal,
      recordKind,
      customerReplied,
      disposition,
    });
  }, [
    requestId,
    handledRequests,nextCommand,nextTarget,separateMatter,sameMatter,
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
    reviewTask,blockBefore,cancelReview,messageAnswered,
    channel,
    contact,
    stage,
    signal,
    recordKind,
    customerReplied,
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
    handledRequests,nextCommand,nextTarget,separateMatter,sameMatter,
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
    reviewTask,blockBefore,cancelReview,messageAnswered,
  ]);
  useEffect(() => {
    document
      .getElementById("crm-sales-editor-title")
      ?.focus({ preventScroll: true });
  }, []);
  const pureArrangement = administrative && !selectedTask && recordKind === "closure" && !customerReplied;
  const changeReason = pureArrangement ? summary : arrangementReason;
  const nextPurpose = pureArrangement ? summary : purpose;
  const nextChoice = disposition === "schedule" ? reviewTask ? "review" : nextCommand === "create" ? "create" : "change" : disposition;
  const chooseNext = (value:string) => {
    const scheduled = ["create","change","review"].includes(value);
    setDisposition(scheduled ? "schedule" : value);
    if(scheduled){setReviewTask(value === "review");setNextCommand(value === "create" ? "create" : "");setNextTarget("");setSameMatter(false);}
    if(value === "none" && arrangement === "active")setArrangement("");
    if(value !== "none" && !arrangement)setArrangement(originalArrangement.current);
  };
  const purposeLabel = nextCommand==='supplement'?t("Additional information (required)","Informasi tambahan (wajib)","补充信息（必填）"):nextCommand==='reschedule'?t("Reschedule reason (required)","Alasan perubahan jadwal (wajib)","改期原因（必填）"):nextCommand==='replace'?t("Replacement reason (required)","Alasan penggantian (wajib)","替代原因（必填）"):t("Review reason (required)","Alasan peninjauan (wajib)","复查依据（必填）");
  const reuseRecord = (setter:(value:string)=>void) => summary.trim() ? <button type="button" className="crm-work-link crm-reuse-record" onClick={()=>setter(summary)}>{t("Use this record","Gunakan catatan ini","使用本次记录")}</button> : null;
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
            if ((recordKind !== "closure" || customerReplied) && !channel)
              throw Error("Choose a contact channel");
            if (recordKind !== "closure" && !contact)
              throw Error("Choose a contact result");
            if (selectedTask && !taskOutcome)
              throw Error("Choose a task outcome");
            if (!disposition) throw Error("Choose the next arrangement");
            if(completedIds.length&&(!requestData||requestLoadFailed||taskRequests.some(r=>!handledRequests.includes(r.id))))throw Error('Choose the requests handled by this result');
            if(disposition==='schedule'&&!reviewTask){
              if(!nextCommand)throw Error('Choose how this relates to existing tasks');
              if(nextCommand==='replace'&&!sameMatter)throw Error('Confirm replacement of the same matter');
            }
            if (disposition === "none" && !changeReason.trim())
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
                handledRequests:taskRequests.filter(r=>handledRequests.includes(r.id)).map(r=>({id:r.id,version:r.version})),
                ...(disposition==='schedule'&&!reviewTask?{nextTaskChange:{command:nextCommand,taskId:nextTarget||undefined,revision:tasks.find(v=>v.id===nextTarget)?.revision,relationDecision:nextCommand==='create'?'separate':undefined,sameMatterConfirmed:sameMatter}}:{}),
                processingTaskId: selectedTask || null,
                taskOutcome: selectedTask ? taskOutcome : undefined,
                expectedTaskRevision: boundRevision.current,
                disposition,
                noNextReason: reason,
                nextAction: action,
                nextPurpose: !reviewTask&&nextCommand==='create'?undefined:nextPurpose,
                nextTaskNotes: !reviewTask&&nextCommand==='create'?purpose:undefined,
                nextFollowUpAt,
                channel: recordKind === "closure" && !customerReplied ? undefined : channel,
                customerReplied: recordKind === "closure" && customerReplied ? true : undefined,
                customerReplySequenceRevision: customerReplied ? (lead.noResponseSequence?.revision || 0) : undefined,
                recordKind,
                sourceMessageId: sourceMessage?.id,
                sourceConversationId: sourceMessage?.conversation_id,
                connectStatus: recordKind === "closure" ? undefined : contact,
                newStage: stage !== originalStage.current ? stage : undefined,
                expectedStage: originalStage.current,
                expectedStageRevision: originalStageRevision.current,
                expectedArrangementVersion: arrangementVersion.current,
                sourceMessageAnswered: sourceMessage && recordKind!=='closure' && contact==='Connected' ? messageAnswered : undefined,
                ...(disposition==='schedule'&&reviewTask?{reviewPlan:{reason:nextPurpose,blockBefore,version:arrangementVersion.current}}:cancelReview&&disposition!=='record_only'?{reviewPlan:{cancel:true,reason:changeReason,version:arrangementVersion.current}}:{}),
                ...(disposition!=='record_only'&&(disposition==='none'||(arrangement==='active'&&originalArrangement.current!=='active'))?{contactArrangement:{state:disposition==='none'?'stopped':'active',reason:changeReason,version:arrangementVersion.current}}:{}),
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
      {boundView&&<div className="crm-sales-task-summary"><strong>{boundView.action}</strong><div>{boundView.times.map((v:any,i:number)=><span key={i} data-tone={v.tone}>{v.label} · {boundView.formatTime(v.value)}</span>)}</div></div>}
      <div className="crm-sales-editor-layout crm-sales-editor-compact">
        {(sourceMessage||lead.followUpLogs?.length>0)&&<CrmDisclosure className="crm-sales-background" heading={t("View background","Lihat latar belakang","查看背景")}>
          {sourceMessage&&<section><h4>{t("Linked customer message","Pesan pelanggan terkait","已关联客户消息")}</h4><p className="crm-sales-original">{sourceMessage.content}</p></section>}
          {lead.followUpLogs?.length>0&&<section><h4>{t("Latest saved note","Catatan tersimpan terakhir","最近记录")}</h4><p className="crm-sales-original">{[...lead.followUpLogs].sort((a:any,b:any)=>Date.parse(b.timestamp)-Date.parse(a.timestamp))[0]?.summary}</p></section>}
        </CrmDisclosure>}
        <fieldset disabled={busy || unknown} className="crm-sales-fields">
          <section className="crm-sales-step">
            <h4>{t("This result", "Hasil kali ini", "本次结果")}</h4>
            {(selectedTask || !administrative) && (
              <div
                className="crm-sales-segments"
                role="group"
                aria-label={t("Record type", "Jenis catatan", "记录类型")}
              >
                {[
                  [
                    "contact",
                    t("Record contact", "Catat kontak", "记录联系"),
                  ],
                  [
                    "closure",
                    t("Record work result", "Catat hasil pekerjaan", "记录工作结果"),
                  ],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={recordKind === value}
                    onClick={() => {setRecordKind(value);if(value!=="closure")setCustomerReplied(false);}}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {recordKind === "closure" && <CrmDisclosure heading={t("Record an external customer reply","Catat balasan pelanggan di luar sistem","补记客户主动回复")} open={customerReplied}>
              <label><input type="checkbox" checked={customerReplied} onChange={e=>setCustomerReplied(e.target.checked)}/>{t("Customer replied outside CRM; record the channel and evidence","Pelanggan membalas di luar CRM; catat kanal dan buktinya","客户已在CRM之外回复，须记录渠道与依据")}</label>
            </CrmDisclosure>}
            {(recordKind === "contact" || customerReplied) && (
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
                {recordKind === "contact" && select(
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
              {pureArrangement ? t("Reason for adjustment (required)","Alasan perubahan (wajib)","调整原因（必填）") : recordKind === "closure"
                ? t(
                    "Work result (required)",
                    "Hasil pekerjaan (wajib)",
                    "工作结果（必填）",
                  )
                : t("Contact summary (required)", "Ringkasan kontak (wajib)", "沟通记录（必填）")}
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
              {boundTask&&taskOutcome==='complete'&&<p className="crm-task-outcome-guidance">{taskCompletionGuidance(boundTask,lang)}</p>}
              <CrmTaskOverlap tasks={tasks} focusId={selectedTask} lang={lang} timezone={timezone}/>
              {taskOutcome==="complete"&&recordKind==="contact"&&["No Response","Wrong Number"].includes(contact)&&<p className="crm-work-muted">{t("This contact outcome alone does not prove the task is finished. Keep unfinished work open or use cancellation/replacement with a reason.","Hasil kontak ini saja tidak membuktikan tugas selesai. Biarkan pekerjaan yang belum selesai terbuka atau batalkan/ganti dengan alasan.","本次联系结果本身不能证明任务已完成；未完成的工作请保持待处理，或说明原因后取消／替代。")}</p>}
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
              {taskOutcome==='complete'&&(!requestData||requestLoadFailed)&&<p role="alert">{t('Request information unavailable. Reopen this form before completing the task.','Informasi permintaan tidak tersedia. Buka kembali formulir sebelum menyelesaikan tugas.','请求依据尚不可用，请重新打开表单后再完成任务。')}</p>}
              {taskOutcome&&taskRequests.length>0&&<CrmDisclosure className="crm-request-completion" heading={taskOutcome==='complete'?t('Confirm requests handled','Konfirmasi permintaan yang ditangani','确认已处理的客户请求'):t('Requests handled this time (optional)','Permintaan yang ditangani kali ini (opsional)','本次已处理的请求（选填）')} open={taskOutcome==='complete'}>{taskRequests.map(r=><label key={r.id}><input type="checkbox" checked={handledRequests.includes(r.id)} onChange={e=>setHandledRequests(v=>e.target.checked?[...v,r.id]:v.filter(id=>id!==r.id))}/><span>{r.data.text||t('Customer request','Permintaan pelanggan','客户请求')} · {formatCrmOperatingTime(r.data.dueAt,timezone)}</span></label>)}</CrmDisclosure>}

            </section>
          )}
          <section className="crm-sales-step">
            <h4>
              {t("Next arrangement", "Pengaturan berikutnya", "下一步安排")}
            </h4>
            {select(t("After saving","Setelah menyimpan","保存后如何继续"),nextChoice,chooseNext,[
              ["",t("Choose the next arrangement","Pilih pengaturan berikutnya","请选择后续安排")],
              ...(!completed.length&&!handledRequests.length?[["record_only",t("Record only; keep arrangements","Catat saja; pertahankan pengaturan","不调整安排，仅保存记录")]]:[]),
              ["keep",t("Continue existing tasks","Lanjutkan tugas yang ada","继续已有任务")],
              ["create",t("Add a new task","Tambah tugas baru","新增独立任务")],
              ...(tasks.some(v=>!completedIds.includes(v.id)&&v.kind!=="contact_review")?[["change",t("Adjust an existing task","Ubah tugas yang ada","调整已有任务")]]:[]),
              ["review",t("Schedule a review","Jadwalkan peninjauan","安排稍后复查")],
              ["none",t("Stop proactive contact","Hentikan kontak proaktif","停止主动联系")],
              ...(["Enrolled","Lost"].includes(stage)?[["closed",t("Customer closed","Pelanggan ditutup","客户已成交或关闭")]]:[])
            ])}
            {disposition==='keep'&&<div className="crm-kept-task-summary">{tasks.filter(v=>!completedIds.includes(v.id)).map(v=><p key={v.id}>{presentFollowUpTask(v,lang,timezone).action}</p>)}</div>}
            {disposition === "schedule" && (
              <>
                {reviewTask&&<label><input type="checkbox" checked={blockBefore} onChange={e=>setBlockBefore(e.target.checked)}/>{t('Customer agreed: do not initiate contact before this review time','Disepakati dengan pelanggan: jangan menghubungi sebelum waktu tinjauan ini','与客户明确约定：复查时间前不主动联系')}</label>}
                {!reviewTask&&nextCommand!=='create'&&<>
                  {select(t('Adjustment','Perubahan','调整方式'),nextCommand,v=>{setNextCommand(v);setNextTarget('');setSameMatter(false);},[['',t('Choose an operation','Pilih tindakan','请选择操作')],['supplement',t('Add task information','Tambah informasi tugas','补充信息')],['reschedule',t('Reschedule task','Ubah jadwal tugas','改期')],['replace',t('Replace task','Ganti tugas','替代')]])}
                  {['supplement','reschedule','replace'].includes(nextCommand)&&select(t('Target task','Tugas tujuan','目标任务'),nextTarget,setNextTarget,[['',t('Choose a task','Pilih tugas','请选择任务')],...tasks.filter(v=>!completedIds.includes(v.id)&&v.kind!=='contact_review').map(v=>[v.id,presentFollowUpTask(v,lang,timezone).action])])}
                  {nextCommand==='replace'&&<label><input type="checkbox" required checked={sameMatter} onChange={e=>setSameMatter(e.target.checked)}/>{t('Cancel the selected old task and create its replacement.','Batalkan tugas lama yang dipilih dan buat penggantinya.','取消选定的原任务，并建立替代任务。')}</label>}
                </>}
                {(reviewTask||["create","replace"].includes(nextCommand))&&<label>
                  {t("Task content (required)", "Isi tugas (wajib)", "任务内容（必填）")}
                  <input
                    required={reviewTask||["create","replace"].includes(nextCommand)}
                    disabled={!reviewTask&&["supplement","reschedule"].includes(nextCommand)}
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                  />
                </label>}
                {!reviewTask&&nextCommand==='create'?<details className="crm-task-optional-note"><summary>{t('Additional notes (optional)','Catatan tambahan (opsional)','补充说明（选填）')}</summary><label>{t('Only add information not covered by the task content.','Tambahkan hanya informasi yang belum tercakup dalam isi tugas.','仅填写任务内容未涵盖的信息。')}<textarea aria-label={t('Additional notes (optional)','Catatan tambahan (opsional)','补充说明（选填）')} value={purpose} onChange={e=>setPurpose(e.target.value)}/></label></details>:!pureArrangement&&(reviewTask||["supplement","reschedule","replace"].includes(nextCommand))&&<label>
                  {purposeLabel}
                  <input
                    required
                    aria-label={purposeLabel}
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                  />
                  {reuseRecord(setPurpose)}
                </label>}
                {(reviewTask||['create','replace','reschedule'].includes(nextCommand))&&<>
                <button
                  type="button"
                  className="crm-work-link"
                  onClick={() => {
                    const day = new Intl.DateTimeFormat("en-CA", {
                      timeZone: workCalendar.timezone || "Asia/Jakarta",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    }).format(new Date(Date.now() + 86400000));
                    const c = {
                      timezone: workCalendar.timezone || "Asia/Jakarta",
                      days: workCalendar.workDays,
                      start: workCalendar.startTime,
                      end: workCalendar.endTime,
                    };
                    const d = nextWork(
                      calendarSample(day, c.start, c.timezone),
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
                  {reviewTask?t("Review time (required)","Waktu peninjauan (wajib)","复查时间（必填）"):nextCommand==='reschedule'?t("New agreed execution time","Waktu pelaksanaan baru","新约定执行时间"):t("Task time (required)","Waktu tugas (wajib)","任务时间（必填）")} · {timezone}
                  <input
                    required
                    type="datetime-local"
                    disabled={!reviewTask&&nextCommand==="supplement"}
                    value={date}
                    onInput={(e) => setDate(e.currentTarget.value)}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                </>}
              </>
            )}
            {(lead.contactReview||['waiting','nurture'].includes(lead.contactArrangement?.state))&&disposition&&disposition!=='record_only'&&!(disposition==='schedule'&&reviewTask)&&<CrmDisclosure heading={t('Change the previous review agreement (optional)','Ubah kesepakatan tinjauan sebelumnya (opsional)','调整原复查约定（选填）')} open={cancelReview}>
              <label><input type="checkbox" checked={cancelReview} onChange={e=>setCancelReview(e.target.checked)}/>{t('Explicitly end the previous review agreement','Akhiri kesepakatan tinjauan sebelumnya secara tegas','明确结束原复查约定')}</label>
            </CrmDisclosure>}
            {sourceMessage&&recordKind!=='closure'&&contact==='Connected'&&<label><input type="checkbox" checked={messageAnswered} onChange={e=>setMessageAnswered(e.target.checked)}/>{t('This customer question was actually answered','Pertanyaan pelanggan ini benar-benar telah dijawab','本次已实际答复所关联的客户问题')}</label>}
            {disposition !== "none" && disposition !== "record_only" &&
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

                </>
              )}
            {!pureArrangement&&(disposition==='none'||(disposition!=='record_only'&&(cancelReview||(arrangement==='active'&&originalArrangement.current!=='active'))))&&<div className="crm-arrangement-reason">
              <label>{disposition==='none'?t('Reason for stopping contact (required)','Alasan menghentikan kontak (wajib)','停止联系原因（必填）'):t('Arrangement change reason (required)','Alasan perubahan pengaturan (wajib)','联系安排变更原因（必填）')}<textarea required value={arrangementReason} onChange={e=>setArrangementReason(e.target.value)}/></label>
              {reuseRecord(setArrangementReason)}
            </div>}
          </section>
        </fieldset>
      </div>
      <footer className="crm-sales-editor-footer">
        <div className="crm-sales-effect">
          {recordKind === "closure"
            ? t(
                "Save one work record",
                "Simpan satu catatan pekerjaan",
                "保存一条工作记录",
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
            {["Operation not found","Request changed; refresh and review","Choose the requests handled by this result","Confirm that this is a separate matter","Confirm replacement of the same matter","Choose how this relates to existing tasks","Use the contact arrangement to change this review task","Handle or move the linked requests before cancelling"].includes(error)
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
