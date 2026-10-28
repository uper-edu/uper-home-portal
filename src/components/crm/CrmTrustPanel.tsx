import {CrmIdentityAction} from './CrmIdentityAction';
import {AdminRequiredNote} from '../AdminForm';
import {useCrmUiText} from './CrmUiLanguage';
import {AdminFieldLabel} from '../AdminForm';
import {salesProgressStages,isSalesProgressStage,progressDefinition} from '../../utils/crmSalesProgress';
import {CrmSalesProgressHistory,progressSourceText,progressSourceTiming,CrmProgressSourceBody} from './CrmSalesProgressHistory';
import {CrmSimpleAttention} from './CrmSimpleAttention';
export function CrmTrustPanel(props:any){return props.mode==='identity'?<LegacyCrmTrustPanel {...props}/>:<CrmSimpleAttention {...props}/>;}
import {contactRestriction} from '../../utils/crmContact';
import {CrmContactRestriction} from './CrmFollowupContext';
import {CrmTaskOverlap} from './CrmTaskOverlap';
import {prepareTaskInput} from '../../utils/crmTaskInput';
import { confirmCrmOperation, confirmedStageLead } from "../../utils/crmOperationResult";
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
  lead, lang, isLight, onSaved, disabled, onDirty, onBusy, initialBasisId, inDrawer=false, onClose, request = fetch,
}: any) {
 const ui=useCrmUiText(lang);

  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  const currentStage = lead.currentStage || "New";
  const [baseStage,setBaseStage]=useState(currentStage),[baseRevision,setBaseRevision]=useState(lead.stageRevision||0);
  const [stageContext,setStageContext]=useState<any>(null),[contextError,setContextError]=useState(''),[basisRefs,setBasisRefs]=useState<any[]>([]),[enrollmentConfirmed,setEnrollmentConfirmed]=useState(false);
  const loadContext=async()=>{try{const r=await request('/api/crm/leads/'+lead.id+'/stage-context');const d=await r.json();if(!r.ok||d.leadId!==lead.id)throw Error();setStageContext(d);setContextError('');}catch{setContextError('阶段依据与历史暂不可用，请重试加载');}};
  useEffect(()=>{setStageContext(null);void loadContext();},[lead.id,lead.stageRevision]);

  const [stage, setStage] = useState(inDrawer?'':currentStage),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [reasonInvalid, setReasonInvalid] = useState(false),
    [busy, setBusy] = useState(false),
    [busyAction, setBusyAction] = useState<"save" | "query">("save"),
    [unknown, setUnknown] = useState(false),
    [retryAllowed, setRetryAllowed] = useState(false),
    [savedStage, setSavedStage] = useState<string | null>(null);
  const pending = useRef<any>(null), inFlight = useRef(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null),enrollmentRef=useRef<HTMLInputElement>(null), id = useId();
  const changed = Boolean(stage)&&stage !== baseStage;
  const draftDirty=changed||unknown||!!reason.trim()||enrollmentConfirmed||JSON.stringify(basisRefs)!==JSON.stringify(initialBasisId?[{type:'sales_record',id:initialBasisId}]:[]);
  const latestStage=stageContext?.current&&(stageContext.current.version>=(lead.stageRevision||0))?stageContext.current:{stage:currentStage,version:lead.stageRevision||0};
  const versionConflict=latestStage.version!==baseRevision||latestStage.stage!==baseStage;
  useEffect(() => {
    setStage(inDrawer?'':currentStage);setBaseStage(currentStage);setBaseRevision(lead.stageRevision||0);
    setReason("");setBasisRefs(initialBasisId?[{type:'sales_record',id:initialBasisId}]:[]);setEnrollmentConfirmed(false);
    setReasonInvalid(false);
  }, [lead.id]);
  useEffect(()=>{if(!changed&&!pending.current){setStage(inDrawer?'':currentStage);setBaseStage(currentStage);setBaseRevision(lead.stageRevision||0);}},[currentStage,lead.stageRevision]);
  useEffect(() => { onDirty?.(draftDirty); }, [draftDirty]);
  const finish = (data: any) => {
    confirmedStageLead(data, lead.id, pending.current?.newStage);
    pending.current = null;
    setUnknown(false);
    setError("");
    setReasonInvalid(false);
    setReason("");
    setStage(data.lead.currentStage || "New");setBaseStage(data.lead.currentStage||'New');setBaseRevision(data.lead.stageRevision||0);
    setBasisRefs(initialBasisId?[{type:'sales_record',id:initialBasisId}]:[]);setEnrollmentConfirmed(false);
    setSavedStage(data.lead.currentStage || "New");
    onDirty?.(false);
    onSaved(data.lead);
  };
  const save = async () => {
    if (disabled || inFlight.current || (unknown&&!retryAllowed) || (!changed&&!pending.current)) return;
    if(!pending.current){
      if(!reason.trim()&&!basisRefs.length){setReasonInvalid(true);reasonRef.current?.focus();return;}
      setReasonInvalid(false);
      if(stage==='progress:enrolled'&&!enrollmentConfirmed){setError('请明确确认报名已成立');enrollmentRef.current?.focus();return;}
    }
    const body = pending.current || (pending.current = {
      requestId: crypto.randomUUID(), newStage: stage,
      expectedStage: baseStage, expectedStageRevision: baseRevision,
      reason,basisRefs,...(stage==='progress:enrolled'?{enrollmentScope:'course'}:{}),effectiveTimeMode:'now',effectiveAt:null,enrollmentConfirmed,
    });
    inFlight.current = true;
    setRetryAllowed(false);
    setBusyAction("save"); setBusy(true); onBusy?.(true); setError("");
    let failure = "stage_save_unconfirmed";
    try {
      const r = await request("/api/crm/leads/" + lead.id + "/stage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000), body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status < 500) {
          if (!String(d.error).startsWith("Request context conflict")) pending.current = null;
          failure = d.error || "stage_save_failed";
        }
        throw Error(failure);
      }
      finish(d);
    } catch {
      if(failure==='Stage changed; refresh and review')void loadContext();
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
      if (!r.ok) { if (r.status === 404) {failure = "stage_result_not_found";setRetryAllowed(true);} throw Error(failure); }
      finish(d);
    } catch { setError(failure); }
    finally { inFlight.current = false; setBusy(false); onBusy?.(false); }
  };
  const errorText = error === "stage_save_unconfirmed"
    ? t("The save result is not confirmed. Your draft is kept; query the result before retrying.", "Hasil penyimpanan belum terkonfirmasi. Draf tetap tersedia; periksa hasil sebelum mengulangi penyimpanan.", "保存结果尚未确认，草稿已保留，请先查询结果。")
    : error === "stage_query_unavailable"
      ? t("The result could not be checked. Your draft is kept. Try querying again.", "Hasil belum dapat diperiksa. Draf tetap tersedia. Coba periksa lagi.", "暂时无法查询保存结果，草稿已保留，请重试查询。")
      : error === "stage_result_not_found"
        ? t("No saved result was found for this request. You can retry the original save.", "Hasil tersimpan untuk permintaan ini belum ditemukan. Anda dapat mengulangi penyimpanan awal.", "尚未找到该请求的保存结果，可重试原保存。")
        : error === "stage_save_failed"
          ? t("The stage was not saved. Your draft is kept.", "Tahap belum tersimpan. Draf tetap tersedia.", "阶段未保存，草稿已保留。") : trustError(error, lang);
  const options:Array<{value:string,label:string}> = salesProgressStages.map(([value,zh,en,id])=>({value,label:lang==='zh'?zh:lang==='id'?id:en}));
  const chosen=salesProgressStages.find(v=>v[0]===stage);
  if(!isSalesProgressStage(currentStage))options.unshift({value:currentStage as any,label:crmValue(currentStage,lang)+'（旧阶段，待确认）'});
  const actions=(<div className={inDrawer?"crm-editor-actions crm-stage-drawer-actions":"crm-stage-actions"}>
          <button type="button" className="crm-work-button crm-editor-primary" data-primary="true" disabled={disabled || busy || (unknown&&!retryAllowed) || (!changed&&!unknown) || (versionConflict&&!unknown)} onClick={save}>
            {busy && busyAction === "save" ? t("Saving…", "Menyimpan…", "保存中…") : unknown ? t("Retry original save", "Ulangi penyimpanan awal", "重试原保存") : t('Save','Simpan','保存')}
          </button>
          {!unknown && <button type="button" className="crm-work-button" disabled={busy} onClick={()=>{if(inDrawer){onClose?.();return;}setStage(currentStage);setReason('');setBasisRefs([]);setEnrollmentConfirmed(false);}}>{!inDrawer&&savedStage&&!changed ? ui("完成") : ui("取消")}</button>}

          {unknown && <button type="button" className="crm-work-button" disabled={busy} onClick={query}>{busy && busyAction === "query" ? t("Checking…", "Memeriksa…", "查询中…") : t("Query save result", "Periksa hasil penyimpanan", "查询保存结果")}</button>}
        </div>);
  return (
    <div id="crm-sales-stage-editor" tabIndex={-1} className={`crm-stage-editor${inDrawer?' crm-editor-compose crm-stage-drawer':''}`} aria-busy={busy}>
      <div className={inDrawer?'crm-editor-scroll':undefined}>
      {inDrawer&&<AdminRequiredNote lang={lang}/>}
      {!isSalesProgressStage(currentStage)&&<p className="crm-stage-help">{ui("旧阶段保留为“")}{crmValue(currentStage,lang)}{ui("”，未自动映射。请选择符合实际的新阶段并明确保存。")}</p>}
      {inDrawer?<fieldset className="crm-stage-options"><legend>{ui("选择新阶段 *")}</legend>{salesProgressStages.map(([value,zh,en,id,definition])=><label key={value} data-selected={stage===value} data-current={currentStage===value}><input type="radio" required aria-required="true" name={`stage-${lead.id}`} value={value} checked={stage===value} disabled={disabled||busy||unknown||currentStage===value} onChange={()=>{setStage(value);setSavedStage(null);setError('');setReasonInvalid(false);}}/><span><strong>{lang==='zh'?zh:lang==='id'?id:en}{currentStage===value ? ui("（当前）") : ''}</strong><small>{progressDefinition(value,lang)}</small></span></label>)}</fieldset>:(
      <CrmSingleSelect
        label={t("Update sales stage", "Ubah tahap penjualan", "修改销售阶段")}
        value={stage}
        onChange={(value) => { setStage(value); setError(""); setReasonInvalid(false); setSavedStage(null); if (value === currentStage) setReason(""); }}
        disabled={disabled || busy || unknown} options={options} lang={lang} isLight={isLight}
      />)}

      {changed&&versionConflict&&<p role="alert">{ui("服务端阶段已变化，草稿仍保留。最新：")}{crmValue(latestStage.stage,lang)}。<button type="button" disabled={busy||unknown} onClick={()=>{setBaseStage(latestStage.stage);setBaseRevision(latestStage.version);}}>{ui("保留草稿并采用已核对的最新基准")}</button></p>}
      {!inDrawer&&chosen&&<p className="crm-stage-help">{progressDefinition(chosen[0],lang)}</p>}
      {!inDrawer&&!disabled && <p className="crm-stage-help">{t("Stage changes are saved manually. Choose a stage, link evidence or describe the facts, then save.", "Perubahan tahap disimpan secara manual. Pilih tahap, isi alasan wajib, lalu simpan.", "阶段变更需手动保存：选择阶段，关联依据或填写事实说明后保存。")}</p>}
      {(changed || unknown) && <div className="crm-stage-draft">
        <label htmlFor={id}><AdminFieldLabel required={!basisRefs.length}>{t("Facts supporting the stage", "Fakta pendukung tahap", "具体事实说明")}</AdminFieldLabel></label>
        <p id={id + "-help"} className="crm-stage-help">{t("Describe the facts supporting this stage. Example: the customer confirmed a Saturday assessment booking.", "Jelaskan fakta yang mendukung tahap ini. Contoh: pelanggan mengonfirmasi jadwal asesmen hari Sabtu.", "请说明支持新阶段的事实。例如：客户已确认预约周六的测评。")}</p>
        <textarea id={id} ref={reasonRef} rows={3} required={!basisRefs.length} aria-required={!basisRefs.length} aria-invalid={reasonInvalid}
          aria-describedby={id + "-help" + (reasonInvalid ? " " + id + "-error" : "")}
          disabled={disabled || busy || unknown} value={reason}
          onChange={e => { setReason(e.target.value); if (e.target.value.trim()) setReasonInvalid(false); }} />
        {reasonInvalid && <p id={id + "-error"} role="alert" className="crm-stage-error">{t("Enter the reason for this stage change before saving.", "Isi alasan perubahan tahap sebelum menyimpan.", "请关联依据或填写事实说明，已报名还须明确确认报名成立。")}</p>}
        <p className="crm-stage-help">{ui("可关联原始记录，也可填写具体事实说明；无需重复抄写已关联原文。")}</p>
        {contextError&&<p role="alert">{contextError}<button type="button" onClick={()=>void loadContext()}>{ui("重新加载依据")}</button></p>}
        <details className="crm-stage-source-picker" open={Boolean(initialBasisId)}><summary>{ui("关联原始依据（已选")}{basisRefs.length}{ui("，最多5条）")}</summary>{stageContext?.sources.map((source:any)=>{const checked=basisRefs.some(s=>s.type===source.type&&s.id===source.id);return <div key={source.type+source.id}><label><input type="checkbox" disabled={busy||unknown||(!checked&&basisRefs.length>=5)} checked={checked} onChange={()=>setBasisRefs(v=>checked?v.filter(s=>s.type!==source.type||s.id!==source.id):[...v,{type:source.type,id:source.id}])}/>{ui(source.label)} · {progressSourceTiming(source,lang)}</label><CrmProgressSourceBody source={source} lang={lang}/></div>;})}{stageContext&&!stageContext.sources.length&&<p>{ui("没有可关联的原始记录，请填写具体事实说明。")}</p>}</details>
        {stage==='progress:enrolled'&&<label><input ref={enrollmentRef} type="checkbox" required aria-required="true" disabled={busy||unknown} checked={enrollmentConfirmed} onChange={e=>{setEnrollmentConfirmed(e.target.checked);setError('');}}/>{ui("确认正式课程报名已成立（不含试听预约）；依据须说明具体课程及确认事实 *")}</label>}


      </div>}
      {(busy || unknown || savedStage === currentStage) && <p role="status" className="crm-stage-status">
        {busy ? (busyAction === "query" ? t("Checking save result…", "Memeriksa hasil penyimpanan…", "正在查询保存结果…") : t("Saving stage…", "Menyimpan tahap…", "正在保存阶段…"))
          : unknown ? t("Save result unknown; draft retained.", "Hasil penyimpanan belum diketahui; draf dipertahankan.", "保存结果未知，草稿已保留。")
            : t("Stage saved", "Tahap tersimpan", "阶段已保存")}
      </p>}
      {error && <p role="alert" className="crm-stage-error">{errorText}</p>}
      {!inDrawer&&stageContext&&<CrmSalesProgressHistory context={stageContext} lang={lang}/>}
      {!stageContext&&contextError&&<p role="alert">{contextError}<button type="button" onClick={()=>void loadContext()}>{ui("重新加载")}</button></p>}
      </div>
      {(inDrawer||changed||unknown)&&actions}
    </div>
  );
}
function LegacyCrmTrustPanel({
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
  const [sameMatterConfirmed,setSameMatterConfirmed]=useState(false);
  const [formNow,setFormNow]=useState(Date.now);
  const dateInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(!editor)return;setFormNow(Date.now());const timer=setInterval(()=>setFormNow(Date.now()),15000);return()=>clearInterval(timer);},[editor]);
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
            timing !== (editor.kind==='create'?'response':'') ||
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
      (pending.current.path !== path || JSON.stringify(pending.current.body) !== JSON.stringify(body))
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
        if (r.status < 500 && !String(d.error).startsWith("Request context conflict")) pending.current = null;
        throw Error(d.error);
      }
      confirmCrmOperation(d, lead.id, p.path);
      pending.current = null;
      setUnknown(false);
      setNote("");
      setNoteOpen(false);
      setEditor(null);
      setSaved(
        p.path === "information" ? "note" : p.body.command || "identity",
      );
      await refresh().catch(()=>setError(t("Saved, but refreshing tasks failed. Reload the tasks.","Tersimpan, tetapi tugas gagal dimuat ulang. Muat ulang tugas.","已保存，但任务刷新失败，请重新加载任务。")));
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
      confirmCrmOperation(d, lead.id, p.path);
      pending.current = null;
      setUnknown(false);
      setEditor(null);
      setNote("");
      setNoteOpen(false);
      setSaved("confirmed");
      await refresh().catch(()=>setError(t("Saved, but refreshing tasks failed. Reload the tasks.","Tersimpan, tetapi tugas gagal dimuat ulang. Muat ulang tugas.","已保存，但任务刷新失败，请重新加载任务。")));
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
    setTiming(command.kind==='create'?'response':'');
    if(command.kind==='edit'){
      setAction(command.task.details?.action||taskLabel(command.task));
      const currentTime=command.task.scheduled_at||command.task.due_at;
      const local=currentTime?formatCrmOperatingTime(currentTime,timezone).slice(0,16).replace(' ','T'):'';
      initialDate.current=local;setDate(local);
    }
    setChoice("");setSameMatterConfirmed(false);
    if(command.kind==='create_request'){
      setAction(describeFollowUpTask({id:command.task.id,kind:command.task.data.action,status:'open',ownerId:lead.owner,dueAt:command.task.data.dueAt},lang,timezone).action);
    }
    requestAnimationFrame(() => {
      const area = document.getElementById(
        command.kind === "note"
          ? "crm-information-editor"
          : "crm-followup-processing",
      );
      if(command.kind === "note")area?.scrollIntoView({ block: "start" });
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
      create_request:t('Create a separate task','Buat tugas terpisah','另建任务'),
      link_request:t('Add to an existing task','Tambahkan ke tugas yang ada','补充到已有任务'),
      request_linked:t('Request linked','Permintaan ditautkan','请求已关联'),
      request_evidence: t("Request evidence", "Bukti permintaan", "请求依据"),
      create: t("New task", "Tugas baru", "新增任务"),
      edit: t("Edit task","Edit tugas","编辑任务"),
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
      evidence={data?.requests?.filter((r:any)=>r.task_id===task.id).length>0?<details className="crm-task-evidence"><summary>{t('Request evidence','Bukti permintaan','请求依据')} ({data.requests.filter((r:any)=>r.task_id===task.id).length})</summary>{data.requests.filter((r:any)=>r.task_id===task.id).map((r:any)=><div key={r.id}><p>{r.data.text||t('Structured customer request','Permintaan terstruktur pelanggan','客户明确请求')}</p><small>{r.state==='dismissed'?t('Terminated','Dihentikan','已终止'):r.state==='handled'?t('Handled','Ditangani','已处理'):t('Not yet handled','Belum ditangani','尚未处理')} · {t('Response deadline','Batas respons','响应截止')} {time(r.data.dueAt)}</small><button type="button" className="crm-work-link" onClick={()=>onSource?.({details:{sourceConversationId:r.data.conversationId,sourceMessageId:r.data.messageId}})}>{t('View original message','Lihat pesan asli','查看原文')}</button></div>)}</details>:null}
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
            onChange={(kind) => kind === "close_task" ? onProcess?.(task,"close") : kind === "review_arrangement" ? onArrange?.() : open(kind, task)}
            options={[
              {value:task.kind==="contact_review"?"review_arrangement":"edit",label:t("Edit task","Edit tugas","编辑任务")},
              {value:"close_task",label:t("Close task","Tutup tugas","关闭任务")}
            ]}
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
    lead.currentStage,Date.now(),timezone,
  );
  const processingTaskId = workflowOpen ? workflowTask : editor?.task?.id;

  return (
    <section
      className="crm-trust-panel"
      aria-label={t("Facts and tasks", "Fakta dan tugas", "事实与任务")}
    >
      {mode !== "identity" && !workflowOpen && <CrmContactRestriction lead={lead} lang={lang} timezone={timezone} onArrange={disabled||busy||unknown?undefined:onArrange}/>}
      {mode !== "identity" && !workflowOpen && (
        <div className="crm-followup-toolbar">
          <h3>
            {t("Follow-up tasks", "Tugas tindak lanjut", "跟进任务")}{data?` (${pendingTasks.length})`:""}
          </h3>
          <div className="crm-followup-entry-actions">
            {data&&<button type="button" className="crm-work-button" disabled={disabled||busy||unknown} onClick={()=>open('create')}><Plus size={15} aria-hidden="true"/>{kindLabel('create')}</button>}
            <button
              type="button"
              className="crm-work-button"
              data-primary="true"
              disabled={disabled || busy || unknown}
              onClick={onRecord}
            >
              <MessageSquarePlus size={17} aria-hidden="true" />
              {t("Add progress", "Tambah progres", "添加进展")}
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
              : `${kindLabel(saved)} · ${t("Saved", "Tersimpan", "已保存")}`}
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
      {data && mode !== "identity" && !workflowOpen && (
        <section
          id="crm-followup-tasks"
          tabIndex={-1}
          className="crm-unified-task-list"
          aria-label={t("Follow-up tasks", "Tugas tindak lanjut", "跟进任务")}
        >
          {lead.identityReview?.pending&&<CrmIdentityAction lang={lang} onClick={onIdentity}/>}
          {data.requests?.some((r:any)=>r.state==='pending')&&<section className="crm-pending-requests" aria-label={t('New requests to assign','Permintaan baru untuk ditautkan','待确认关联的新请求')}><h4>{t('New requests to assign','Permintaan baru untuk ditautkan','待确认关联的新请求')} ({data.requests.filter((r:any)=>r.state==='pending').length})</h4><p>{t('Check whether this is the same matter or a separate task. The response deadline starts from receipt.','Periksa apakah urusannya sama atau tugas terpisah. Tenggat respons dihitung sejak diterima.','请确认是已有事项的补充，还是另一件事；响应期限从收到请求起计算。')}</p>{data.requests.filter((r:any)=>r.state==='pending').map((r:any)=><article key={r.id}><strong>{describeFollowUpTask({id:r.id,kind:r.data.action,status:'open',ownerId:lead.owner,dueAt:r.data.dueAt},lang,timezone).action}</strong><p>{r.data.text||t('Structured customer request','Permintaan terstruktur pelanggan','客户明确请求')}</p><p className="crm-request-deadline" data-overdue={Date.parse(r.data.dueAt)<Date.now()||undefined}>{t('Response deadline','Batas respons','响应截止')} · {time(r.data.dueAt)}</p><div className="crm-trust-actions"><button type="button" disabled={disabled||busy||unknown} onClick={()=>open('link_request',r)}>{kindLabel('link_request')}</button><button type="button" disabled={disabled||busy||unknown} onClick={()=>open('create_request',r)}>{kindLabel('create_request')}</button><button type="button" className="crm-work-link" onClick={()=>onSource?.({details:{sourceConversationId:r.data.conversationId,sourceMessageId:r.data.messageId}})}>{t('View original message','Lihat pesan asli','查看原文')}</button></div></article>)}</section>}

          <CrmTaskOverlap tasks={pendingTasks} lang={lang} timezone={timezone}/>
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
              emptyFollowUpLabel(lead, lang)&&<p className="crm-work-muted">{emptyFollowUpLabel(lead, lang)}</p>
            )}
          </div>
        </section>
      )}
      {mode !== "identity" && !workflowOpen && (
        <section className="crm-followup-zone crm-followup-current">
          <div className="crm-followup-zone-heading">
            <h3>
              {t("Recent communication", "Komunikasi terakhir", "最近沟通")}
            </h3>
            {!contactRestriction(lead)&&<button
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
            </button>}
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
                "Identity needs review · Compare records",
                "Identitas perlu ditinjau · Bandingkan catatan",
                "身份待核实 · 比较客户记录",
              )}
            </button>
          )}
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
            description={editor.kind==='create'?t('Create a separate task. Existing tasks and deadlines stay unchanged. To add information or change a time for the same matter, use the original task menu.','Buat tugas terpisah. Tugas dan tenggat yang ada tetap. Untuk menambah informasi atau mengubah waktu urusan yang sama, gunakan menu tugas awal.','新增独立事项，已有任务及期限保持不变。同一事项的补充或改期，请从原任务菜单操作。'):undefined}
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
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if(busy||disabled||unknown)return;
                const prepared=prepareTaskInput({command:editor.kind,action,purpose,reason,timing,date,originalDate:initialDate.current},timezone);
                if(prepared.error){
                  setError(trustError(prepared.error,lang));
                  if(prepared.field==='date')dateInput.current?.focus();
                  return;
                }
                // Selecting New task and saving explicitly chooses a separate matter.
                const bodyReason=reason.trim();
                let body: any = { command: editor.kind, reason:bodyReason,relationDecision:editor.kind==='create'?"separate":undefined,sameMatterConfirmed };
                let path = "task-actions";
                if (["create", "replace", "create_request"].includes(editor.kind))
                  Object.assign(body, {
                    action,
                    ...(editor.kind==="replace"?{purpose}:{}),
                    timingKind: timing,
                    dueAt: prepared.dueAt,
                  });
                if (editor.kind === "reschedule") body.scheduledAt=prepared.dueAt;
                if(editor.kind==='edit'){body.action=action;if(prepared.dueAt)body.scheduledAt=prepared.dueAt;}
                if(['create_request','link_request'].includes(editor.kind)){
                  Object.assign(body,{requestEvidenceId:editor.task.id,requestEvidenceVersion:editor.task.version});
                  if(editor.kind==='link_request'){const target=data.tasks.find((v:any)=>v.id===choice);Object.assign(body,{taskId:choice,revision:target?.revision});}
                }else if (editor.task)
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
                  !["link", "dismiss", "identity", "create_request", "link_request"].includes(editor.kind) && (
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
                {['create_request','link_request'].includes(editor.kind)&&<div className="crm-sales-task-context"><strong>{t('New customer request','Permintaan pelanggan baru','新的客户请求')}</strong><p>{editor.task.data.text}</p><p>{t('Original response deadline','Tenggat respons awal','原响应截止')} · {time(editor.task.data.dueAt)}</p></div>}

                {editor.kind==='replace'&&<label><input type="checkbox" required checked={sameMatterConfirmed} onChange={e=>setSameMatterConfirmed(e.target.checked)}/>{t('The earlier work for this matter is no longer needed. Cancel it and create the replacement; keep its history.','Pekerjaan sebelumnya untuk urusan ini tidak diperlukan lagi. Batalkan dan buat pengganti; riwayat tetap.','同一事项的原工作已不再需要：取消原任务并建立替代任务，保留原期限及逾期历史。')}</label>}
                {["create", "replace", "create_request", "edit"].includes(editor.kind) && (
                  <>
                    <label>
                      {["create","create_request"].includes(editor.kind)?t("Task content (required)","Isi tugas (wajib)","任务内容（必填）"):t("Action", "Tindakan", "具体动作")}
                      <input
                        required
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                      />
                    </label>
                    {editor.kind==="replace"&&<label>
                      {t("Purpose", "Tujuan", "用途")}
                      <input
                        required
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                      />
                    </label>}
                    {!["create_request","edit"].includes(editor.kind)&&<CrmSingleSelect
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
                    />}
                  </>
                )}
                {["create", "replace", "reschedule", "edit"].includes(editor.kind) && (
                  <label>
                    <span className="crm-task-current-time">{t('Current time','Waktu saat ini','当前时间')} · {formatCrmOperatingTime(new Date(formNow).toISOString(),timezone)}</span>
                    {editor.kind === "reschedule"
                      ? editor.task?.timing_kind === "review" || editor.task?.kind === "contact_review"
                        ? t("Revised review time", "Waktu peninjauan baru", "新复查时间")
                        : t("New agreed execution time", "Waktu pelaksanaan baru", "新约定执行时间")
                      : editor.kind==="create" ? t("Task time (required)","Waktu tugas (wajib)","任务时间（必填）")+" · "+label(timing) : timing ? label(timing) : t("Time", "Waktu", "时间")}{" "}

                    <input
                      required
                      ref={dateInput}
                      aria-invalid={error===trustError("Choose a future time in the operating timezone",lang)||error===trustError("Choose a task date and time",lang)}
                      type="datetime-local"
                      min={formatCrmOperatingTime(new Date(formNow).toISOString(),timezone).slice(0,16).replace(' ','T')}
                      value={date}
                      onInput={(e) => {setDate(e.currentTarget.value);setError("");}}
                      onChange={(e) => {setDate(e.target.value);setError("");}}
                    />
                  </label>
                )}
                {["link","link_request"].includes(editor.kind) && (
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
                          ["open", "overdue"].includes(v.status)&&v.kind!=="contact_review",
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
                {editor.kind === "identity" && <p>{lead.fullName} ↔ {editor.task.name} · {editor.task.email||editor.task.whatsapp} · {t('Compare the original records and confirm with evidence. Same contact details do not prove the same person.','Bandingkan catatan asli dan konfirmasi dengan bukti. Kontak sama tidak membuktikan orang yang sama.','请对照原记录并填写核实依据；相同联系方式不证明属于同一人。')}</p>}
                {editor.kind === "identity" && (
                  <CrmSingleSelect
                    label={t("Decision", "Keputusan", "判断")}
                    value={choice}
                    onChange={setChoice}
                    options={[
                      { value: "", label: t("Choose", "Pilih", "请选择") },
                      {value:"shared",label:t("Shared contact, different people","Kontak bersama, orang berbeda","共用联系方式，属于不同人")},
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
                {(["create","create_request"].includes(editor.kind)||(editor.kind==='edit'&&date===initialDate.current))?<details className="crm-task-optional-note">
                  <summary>{t("Additional notes (optional)","Catatan tambahan (opsional)","补充说明（选填）")}</summary>
                  <label>{t("Only add information not covered by the task content.","Tambahkan hanya informasi yang belum tercakup dalam isi tugas.","仅填写任务内容未涵盖的信息。")}
                    <textarea aria-label={t("Additional notes (optional)","Catatan tambahan (opsional)","补充说明（选填）")} value={reason} onChange={e=>setReason(e.target.value)}/>
                  </label>
                </details>:<label>
                  {editor.kind === "supplement" ? t("Additional information", "Informasi tambahan", "补充内容") : editor.kind === "edit" ? t("Reschedule reason (required)","Alasan perubahan jadwal (wajib)","改期原因（必填）") : t("Reason / evidence", "Alasan / bukti", "原因／依据")}
                  <textarea
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>}

                <div className="crm-sales-dialog-actions">
                  <button disabled={busy || disabled || unknown} type="submit">
                    {editor.kind === "supplement" ? t("Save information", "Simpan informasi", "保存补充") : editor.kind==='create'?t("Save new task","Simpan tugas baru","保存新任务"):t("Confirm and save", "Konfirmasi dan simpan", "确认保存")}
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
          <CrmDisclosure open
            heading={
              <>{t("Identity candidates", "Kandidat identitas", "身份候选")}</>
            }
          >
            <p>
              {t(
                "CRM Managers review matching non-empty contact details. Sales cannot claim or initiate contact before review. A decision records the relationship; it never merges records or transfers owners.",
                "CRM Manager memverifikasi kecocokan kontak yang terisi. Sales tidak dapat mengambil atau menghubungi sebelum verifikasi. Keputusan mencatat hubungan; catatan tidak digabung dan penanggung jawab tidak dipindahkan.",
                "CRM Manager核实有效且非空的相同联系方式。核实前Sales不可认领或主动外联。判断仅记录关系，不合并记录、不迁移历史或客户归属。",
              )}
            </p>
            {data.candidates
              .filter((c: any) => c.decision === "pending")
              .map((c: any) => (
                <button
                  key={c.candidate_id}
                  type="button"
                  disabled={disabled || busy || unknown || !c.canConfirm}
                  onClick={() => onIdentity?onIdentity(c.candidate_id):open("identity", c)}
                >
                  {c.name} · {c.email||c.whatsapp} · {kindLabel("identity")}
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
