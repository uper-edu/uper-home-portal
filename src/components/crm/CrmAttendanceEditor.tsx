import {AdminField} from '../AdminForm';
import { CrmDisclosure } from "./CrmDisclosure";
import { useEffect, useRef, useState } from "react";
import { CrmSingleSelect } from "./CrmSingleSelect";
import { crmError, type CrmLanguage } from "../../utils/crmLanguage";
import { draftsFor } from "../../utils/crmDrafts";
import { supportsParticipationRecord } from "../../utils/crmParticipation";
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
    if (!expanded || loaded) return;
    let alive = true;
    setLoading(true);
    setFailed(false);
    setStatus("");
    fetch("/api/crm/campaigns")
      .then(async (r) => {
        if (!r.ok) throw Error("Failed to fetch");
        const d = await r.json();
        if (alive) {
          setLoading(false);
          setCampaigns(d.campaigns || []);
          setLoaded(true);
          const available = (d.campaigns || []).filter(
            (c) =>
              supportsParticipationRecord(c) ||
              (lead.attendanceRecords || []).some((r) => r.campaignId === c.id),
          );
          const first = available.find((c) =>
            [c.id, c.code].includes(lead.campaignId),
          );
          setCampaign((current) =>
            available.some((c) => c.id === current) ? current : first?.id || "",
          );
        }
      })
      .catch((e) => {
        if (alive) {
          setFailed(true);
          setStatus(e.message);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [lead.id, expanded, loaded, retry]);
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
  const selected = campaigns.find((c) => c.id === campaignId);
  const eligible = campaigns.filter(supportsParticipationRecord);
  const available = campaigns.filter(
    (c) =>
      supportsParticipationRecord(c) ||
      (lead.attendanceRecords || []).some((r) => r.campaignId === c.id),
  );
  return (
    <>
      <CrmDisclosure
        heading={
          <>
            {t(
              "Record event participation (optional)",
              "Catat partisipasi acara (opsional)",
              "记录活动参与（可选）",
            )}
          </>
        }
        className="crm-attendance-editor"
        open={expanded}
        onToggle={(event) => {
          if (event.target === event.currentTarget)
            setExpanded(event.currentTarget.open);
        }}
      >
        <p className="crm-work-muted">
          {t(
            "Optional, for seminars, webinars, roadshows or fairs. Record only known participation; campaign format and acquisition attribution do not confirm attendance.",
            "Opsional, untuk seminar, webinar, roadshow, atau pameran. Catat hanya partisipasi yang diketahui; format dan atribusi kampanye tidak membuktikan kehadiran.",
            "仅在需要时记录宣讲、讲座、路演或展会参与；活动形式与获客归因不自动证明个人出席。",
          )}
        </p>
        {loading && (
          <p role="status">
            {t("Loading events…", "Memuat acara…", "正在加载活动…")}
          </p>
        )}
        {loaded && !eligible.length && (
          <p className="crm-work-muted">
            {t(
              "No event campaigns available for participation records.",
              "Belum ada kampanye acara untuk catatan partisipasi.",
              "暂无可记录参与的活动类 Campaign。",
            )}
          </p>
        )}
        {!loading && available.length > 0 && (
          <>
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
                ...available.map((c) => ({
                  value: c.id,
                  label:
                    lang === "id"
                      ? c.nameId || c.nameEn || c.code || c.id
                      : lang === "en"
                        ? c.nameEn || c.code || c.id
                        : c.name || c.code || c.id,
                })),
              ]}
              lang={lang}
              isLight={isLight}
              searchable
            />
            {selected && (
              <>
                <CrmSingleSelect
                  label={t(
                    "Participation mode",
                    "Mode partisipasi",
                    "参与方式",
                  )}
                  value={mode}
                  onChange={(v) => {
                    setMode(v);
                    setFailed(false);
                    setStatus("");
                    request.current = crypto.randomUUID();
                  }}
                  options={[
                    {
                      value: "",
                      label: t("Choose mode", "Pilih mode", "请选择方式"),
                    },
                    {
                      value: "onsite",
                      label: t("Onsite", "Di lokasi", "现场"),
                    },
                    { value: "online", label: t("Online", "Daring", "线上") },
                  ]}
                  lang={lang}
                  isLight={isLight}
                />
                <AdminField>
                  {t("Evidence / reason", "Bukti / alasan", "确认依据／原因")}
                  <textarea
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setFailed(false);
                      setStatus("");
                      request.current = crypto.randomUUID();
                    }}
                    rows={3}
                  />
                </AdminField>
                {!supportsParticipationRecord(selected) && (
                  <p className="crm-work-muted">
                    {t(
                      "This campaign has a historical participation record. You can withdraw its confirmation, but cannot create a new event confirmation here.",
                      "Kampanye ini memiliki catatan partisipasi historis. Konfirmasi dapat ditarik, tetapi konfirmasi acara baru tidak dapat dibuat di sini.",
                      "此 Campaign 仅保留历史参与记录，可撤销确认，不在此新增活动确认。",
                    )}
                  </p>
                )}
                <div className="flex gap-2 flex-wrap">
                  {supportsParticipationRecord(selected) && (
                    <button
                      className="crm-work-button"
                      data-primary="true"
                      type="button"
                      disabled={busy || !mode || !reason.trim()}
                      onClick={() => save(true)}
                    >
                      {t(
                        "Confirm participation",
                        "Konfirmasi partisipasi",
                        "确认参与",
                      )}
                    </button>
                  )}
                  {record?.confirmed && (
                    <button
                      className="crm-work-button"
                      type="button"
                      disabled={busy || !mode || !reason.trim()}
                      onClick={() => save(false)}
                    >
                      {t(
                        "Withdraw confirmation",
                        "Tarik konfirmasi",
                        "撤销确认",
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </CrmDisclosure>
      {status && (
        <p ref={errorFocus} tabIndex={-1} role={failed ? "alert" : "status"}>
          {failed ? crmError(status, lang) : status}
        </p>
      )}
      {failed && !loaded && !loading && (
        <button
          className="crm-work-button"
          type="button"
          onClick={() => {
            setExpanded(true);
            setRetry((v) => v + 1);
          }}
        >
          {t("Retry", "Coba lagi", "重试")}
        </button>
      )}
    </>
  );
}
