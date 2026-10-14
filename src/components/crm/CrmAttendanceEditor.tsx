import { useEffect, useRef, useState } from "react";
import { CrmSingleSelect } from "./CrmSingleSelect";
import { crmError, type CrmLanguage } from "../../utils/crmLanguage";
import { formatCrmOperatingTime } from "../../utils/crmOperatingTime";
import { draftsFor } from "../../utils/crmDrafts";
export function CrmAttendanceEditor({
  lead,
  lang,
  isLight,
  timezone,
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
    [campaignId, setCampaign] = useState(
      draft.campaignId || lead.campaignId || "",
    ),
    [mode, setMode] = useState(draft.mode || ""),
    [reason, setReason] = useState(draft.reason || ""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [failed, setFailed] = useState(false);
  const request = useRef(draft.requestId || crypto.randomUUID()),
    errorFocus = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/crm/campaigns")
      .then(async (r) => {
        if (!r.ok) throw Error("Failed to fetch");
        const d = await r.json();
        if (alive) {
          setCampaigns(d.campaigns || []);
          const first = (d.campaigns || []).find((c) =>
            [c.id, c.code].includes(lead.campaignId),
          );
          setCampaign((current) =>
            (d.campaigns || []).some((c) => c.id === current)
              ? current
              : first?.id || "",
          );
        }
      })
      .catch((e) => {
        if (alive) {
          setFailed(true);
          setStatus(e.message);
        }
      });
    return () => {
      alive = false;
    };
  }, [lead.id]);
  useEffect(() => {
    if (failed) errorFocus.current?.focus();
  }, [failed, status]);
  useEffect(() => {
    const dirty = Boolean(mode || reason.trim());
    if (dirty)
      cache[lead.id] = { campaignId, mode, reason, requestId: request.current };
    else delete cache[lead.id];
    onDirty?.(dirty);
  }, [campaignId, mode, reason]);
  const save = async (confirmed: boolean) => {
    setBusy(true);
    onBusy?.(true);
    setStatus("");
    setFailed(false);
    try {
      const r = await fetch(`/api/crm/leads/${lead.id}/attendance`, {
        method: "POST",
        signal: AbortSignal.timeout(20000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: request.current,
          campaignId,
          mode,
          reason,
          confirmed,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      onUpdated(d.lead);
      request.current = crypto.randomUUID();
      delete cache[lead.id];
      setReason("");
      setMode("");
      onDirty?.(false);
      setStatus(
        confirmed
          ? t("Participation recorded", "Partisipasi dicatat", "已记录参与确认")
          : t("Confirmation withdrawn", "Konfirmasi ditarik", "已撤销确认"),
      );
    } catch (e) {
      setFailed(true);
      setStatus(
        ["TimeoutError", "AbortError"].includes((e as Error).name)
          ? "Save outcome unknown; retry unchanged draft"
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  };
  const record = lead.attendanceRecords?.find(
    (a) => a.campaignId === campaignId,
  );
  return (
    <details className="crm-attendance-editor">
      <summary>
        {t(
          "Confirm campaign participation",
          "Konfirmasi partisipasi kampanye",
          "确认活动参与",
        )}
      </summary>
      <p className="crm-work-muted">
        {t(
          "Use check-in or meeting evidence; questionnaire, assessment and trial stage do not confirm campaign attendance.",
          "Gunakan bukti check-in atau pertemuan; kuesioner, asesmen, dan tahap uji coba tidak mengonfirmasi kehadiran kampanye.",
          "以签到或会议记录为依据；问卷、测评和试听阶段不自动证明活动出席。",
        )}
      </p>
      <CrmSingleSelect
        label={t("Campaign", "Kampanye", "活动")}
        value={campaignId}
        onChange={(v) => {
          setCampaign(v);
          request.current = crypto.randomUUID();
        }}
        options={[
          {
            value: "",
            label: t("Choose campaign", "Pilih kampanye", "请选择活动"),
          },
          ...campaigns.map((c) => ({
            value: c.id,
            label: lang === "en" ? c.nameEn || c.name : c.name || c.nameEn,
          })),
        ]}
        lang={lang}
        isLight={isLight}
        searchable
      />
      <CrmSingleSelect
        label={t("Participation mode", "Mode partisipasi", "参与方式")}
        value={mode}
        onChange={(v) => {
          setMode(v);setFailed(false);setStatus("");
          request.current = crypto.randomUUID();
        }}
        options={[
          { value: "", label: t("Choose mode", "Pilih mode", "请选择方式") },
          { value: "onsite", label: t("Onsite", "Di lokasi", "现场") },
          { value: "online", label: t("Online", "Daring", "线上") },
        ]}
        lang={lang}
        isLight={isLight}
      />
      <label>
        {t("Evidence / reason", "Bukti / alasan", "确认依据／原因")}
        <textarea
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);setFailed(false);setStatus("");
            request.current = crypto.randomUUID();
          }}
          rows={3}
        />
      </label>
      {record && (
        <p className="crm-work-muted">
          {record.confirmed
            ? t("Confirmed", "Terkonfirmasi", "已确认")
            : t("Withdrawn", "Ditarik", "已撤销")}{" "}
          ·{" "}
          {record.mode === "onsite"
            ? t("Onsite", "Di lokasi", "现场")
            : t("Online", "Daring", "线上")}{" "}
          · {record.actor} · {t("Recorded", "Dicatat", "记录时间")}{" "}
          {formatCrmOperatingTime(record.recordedAt, timezone)} ({timezone}) ·{" "}
          {record.reason}
        </p>
      )}
      {status && (
        <p ref={errorFocus} tabIndex={-1} role={failed ? "alert" : "status"}>
          {failed ? crmError(status, lang) : status}
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        <button
          className="crm-work-button"
          data-primary="true"
          type="button"
          disabled={busy}
          onClick={() => save(true)}
        >
          {t("Confirm participation", "Konfirmasi partisipasi", "确认参与")}
        </button>
        {record?.confirmed && (
          <button
            className="crm-work-button"
            type="button"
            disabled={busy}
            onClick={() => save(false)}
          >
            {t("Withdraw confirmation", "Tarik konfirmasi", "撤销确认")}
          </button>
        )}
      </div>
    </details>
  );
}
