import {CrmFormSummary} from './CrmFormLayout';
import {AdminFormActions,AdminFormFeedback} from '../AdminFormLayout';
import { CrmDisclosure } from "./CrmDisclosure";
import { useEffect, useRef, useState } from "react";
import { CrmSingleSelect } from "./CrmSingleSelect";
import { AdminFieldLabel } from "../AdminForm";
import { crmError, type CrmLanguage } from "../../utils/crmLanguage";
import { draftsFor } from "../../utils/crmDrafts";
import {
  linkedParticipationCampaign,
  supportsParticipationRecord,
} from "../../utils/crmParticipation";

export function CrmAttendanceFields({
  campaign,
  record,
  mode,
  onMode,
  onSave,
  busy,
  contextChanged,
  lang,
  isLight,
}: any) {
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  const eligible = campaign && supportsParticipationRecord(campaign);
  if (!campaign || (!eligible && !record?.confirmed))
    return (
      <p className="crm-work-muted">
        {t(
          "No eligible source event is linked to this customer.",
          "Tidak ada acara sumber yang sesuai terkait dengan pelanggan ini.",
          "当前客户未关联可记录参与的来源活动。",
        )}
      </p>
    );
  const name = campaign.name || campaign.nameEn || campaign.nameId;
  return (
    <div data-admin-form="" className="crm-attendance-fields crm-form-layout">
      <CrmFormSummary><p className="crm-attendance-event">
        <span>{t("Event", "Acara", "活动")}</span>
        <strong>{name || campaign.code || campaign.id}</strong>
      </p></CrmFormSummary>
      {record && <p role="status" className="crm-work-muted">{record.confirmed
        ? t('Participation confirmed', 'Partisipasi dikonfirmasi', '已确认参与')
        : t('Confirmation withdrawn', 'Konfirmasi ditarik', '已撤销确认')}{record.confirmed && <> · {record.mode === 'onsite' ? t('Onsite', 'Di lokasi', '现场') : t('Online', 'Daring', '线上')}</>}</p>}
      <div className="crm-attendance-mode">
      <AdminFieldLabel required>{t("Participation mode", "Mode partisipasi", "参与方式")}</AdminFieldLabel>
      <CrmSingleSelect
        label={t("Participation mode", "Mode partisipasi", "参与方式")}
        required
        value={mode}
        disabled={busy}
        onChange={onMode}
        lang={lang}
        isLight={isLight}
        options={[
          { value: "", label: t("Choose mode", "Pilih mode", "请选择方式") },
          { value: "onsite", label: t("Onsite", "Di lokasi", "现场") },
          { value: "online", label: t("Online", "Daring", "线上") },
        ]}
      />
      </div>
      {contextChanged && (
        <p role="alert">
          {t(
            "The source event changed. Choose the mode again before saving.",
            "Acara sumber berubah. Pilih kembali mode sebelum menyimpan.",
            "来源活动已变化，请重新选择参与方式后保存。",
          )}
        </p>
      )}
      <AdminFormActions className="crm-attendance-actions">
        {eligible && (
          <button
            className="crm-work-button"
            data-primary="true"
            type="button"
            disabled={busy || !mode || contextChanged || (record?.confirmed && record.mode === mode)}
            onClick={() => onSave(true)}
          >
            {t("Confirm participation", "Konfirmasi partisipasi", "确认参与")}
          </button>
        )}
        {record?.confirmed && (
          <button
            className="crm-work-button"
            type="button"
            disabled={busy || !mode || contextChanged}
            onClick={() => onSave(false)}
          >
            {t("Withdraw confirmation", "Tarik konfirmasi", "撤销确认")}
          </button>
        )}
      </AdminFormActions>
    </div>
  );
}
export function CrmAttendanceEditor({
  lead,
  lang,
  isLight,
  onUpdated,
  staffId,
  onDirty,
  onBusy,
}: {
  lead: any;
  lang: CrmLanguage;
  isLight: boolean;
  timezone: string;
  onUpdated: (lead: any) => void;
  staffId: string;
  onDirty?: (dirty: boolean) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  const cache = draftsFor(staffId, "attendance"),
    draft = cache[lead.id] || {};
  const [campaigns, setCampaigns] = useState<any[]>([]),
    [expanded, setExpanded] = useState(false),
    [loading, setLoading] = useState(false),
    [loaded, setLoaded] = useState(false),
    [retry, setRetry] = useState(0),
    [mode, setMode] = useState(draft.mode || ""),
    [boundCampaignId, setBoundCampaign] = useState(draft.campaignId || ""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [failed, setFailed] = useState(false);
  const [pending,setPending]=useState<{campaignId:string;mode:string;confirmed:boolean}>();
  const request = useRef(draft.requestId || crypto.randomUUID()),
    errorFocus = useRef<HTMLParagraphElement>(null);
  const campaign = linkedParticipationCampaign(lead, campaigns);
  const contextChanged =
    !!mode && !!boundCampaignId && boundCampaignId !== campaign?.id;
  const record = lead.attendanceRecords?.find(
    (record: any) => record.campaignId === campaign?.id,
  );
  const selectedMode = mode || (record?.confirmed ? record.mode : "");
  useEffect(() => {
    if (!expanded || loaded) return;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    setStatus("");
    fetch("/api/crm/campaigns", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error("Failed to fetch");
        const data = await response.json();
        if (!Array.isArray(data.campaigns)) throw Error("Failed to fetch");
        if (!controller.signal.aborted) {
          setCampaigns(data.campaigns);
          setLoaded(true);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setFailed(true);
          setStatus(error.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [lead.id, expanded, retry]);
  useEffect(() => {
    if (failed||pending) errorFocus.current?.focus();
  }, [failed, pending, status]);
  useEffect(() => {
    const dirty = !!mode && mode !== (record?.confirmed ? record.mode : "");
    if (dirty)
      cache[lead.id] = {
        campaignId: boundCampaignId || campaign?.id || "",
        mode,
        requestId: request.current,
      };
    else delete cache[lead.id];
    onDirty?.(dirty);
  }, [mode, boundCampaignId, campaign?.id, record?.confirmed, record?.mode]);
  const complete=(updated:any,message:string)=>{
    if(updated?.id!==lead.id)throw Error();
    onUpdated(updated);
    request.current=crypto.randomUUID();delete cache[lead.id];
    setPending(undefined);setMode('');setBoundCampaign('');setFailed(false);
    onDirty?.(false);setStatus(message);
  };
  const save=async(confirmed:boolean)=>{
    if(busy||pending||!campaign||!selectedMode||contextChanged)return;
    const original={campaignId:campaign.id,mode:selectedMode,confirmed};
    setBusy(true);onBusy?.(true);setStatus('');setFailed(false);
    try{
      const response=await fetch('/api/crm/leads/'+encodeURIComponent(lead.id)+'/attendance',{
        method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json'},
        body:JSON.stringify({requestId:request.current,...original}),
      });
      if(response.status>=400&&response.status<500){
        const data=await response.json().catch(()=>null);
        setFailed(true);setStatus(data?.error||'Save failed');return;
      }
      if(!response.ok)throw Error();
      complete((await response.json()).lead,confirmed?t('Participation recorded','Partisipasi dicatat','已记录参与确认'):
        t('Confirmation withdrawn','Konfirmasi ditarik','已撤销确认'));
    }catch{
      setPending(original);onDirty?.(true);
      setStatus(t('Check the current participation record before submitting again.','Periksa catatan partisipasi sebelum mengirim ulang.','结果待确认，请先核对当前参与记录。'));
    }finally{setBusy(false);onBusy?.(false);}
  };
  const check=async()=>{
    if(busy||!pending)return;
    setBusy(true);onBusy?.(true);
    try{
      const response=await fetch('/api/crm/leads/'+encodeURIComponent(lead.id),{cache:'no-store'});
      if(!response.ok)throw Error();
      const data=await response.json(),current=data.lead??data;
      const found=current.attendanceRecords?.find((row:any)=>row.campaignId===pending.campaignId);
      if(found?.mode!==pending.mode||found?.confirmed!==pending.confirmed){
        setStatus(t('The current record differs from your submission. Your draft is retained.','Catatan saat ini berbeda dari pengajuan Anda. Draf disimpan.','当前记录与提交内容不同，草稿已保留。'));
        return;
      }
      complete(current,t('The current record matches your submission.','Catatan saat ini sesuai dengan pengajuan Anda.','当前参与记录与提交内容一致。'));
    }catch{
      setStatus(t('Unable to check the current record. Your draft is retained.','Catatan saat ini belum dapat diperiksa. Draf disimpan.','暂时无法核对当前记录，草稿已保留。'));
    }finally{setBusy(false);onBusy?.(false);}
  };
  return (
    <>
      <CrmDisclosure
        heading={t(
          "Record event participation (optional)",
          "Catat partisipasi acara (opsional)",
          "记录活动参与（可选）",
        )}
        className="crm-attendance-editor"
        open={expanded}
        onToggle={(event) => {
          if (event.target === event.currentTarget)
            setExpanded(event.currentTarget.open);
        }}
      >
        {loading && (
          <p role="status">
            {t("Loading events…", "Memuat acara…", "正在加载活动…")}
          </p>
        )}
        {!loading && loaded && (
          <CrmAttendanceFields
            campaign={campaign}
            record={record}
            mode={selectedMode}
            busy={busy||!!pending}
            contextChanged={contextChanged}
            lang={lang}
            isLight={isLight}
            onSave={save}
            onMode={(value: string) => {
              setMode(value);
              setBoundCampaign(campaign?.id || "");
              setFailed(false);
              setStatus("");
              request.current = crypto.randomUUID();
            }}
          />
        )}
      </CrmDisclosure>
      {status&&(pending||failed||!expanded)&&<AdminFormFeedback ref={errorFocus} tabIndex={-1} lang={lang}
        state={pending?'unknown':failed?'error':'saved'}>{failed?crmError(status,lang):status}</AdminFormFeedback>}
      {pending&&<button className="crm-work-button" type="button" disabled={busy} onClick={()=>void check()}>
        {t('Check participation record','Periksa catatan partisipasi','核对参与记录')}</button>}
      {failed && !loaded && !loading && (
        <button
          className="crm-work-button"
          type="button"
          onClick={() => {
            setExpanded(true);
            setRetry((value) => value + 1);
          }}
        >
          {t("Retry", "Coba lagi", "重试")}
        </button>
      )}
    </>
  );
}
