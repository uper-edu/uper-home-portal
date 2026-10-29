import {CrmFormSection} from './CrmFormLayout';
import {CrmDisclosure} from './CrmDisclosure';
import {X} from 'lucide-react';
import {AdminField,AdminRequiredNote,AdminFieldLabel,AdminForm} from '../AdminForm';
import { campaignUi } from "../../utils/campaignI18n";
import { CrmSaveFeedback, CrmDiscardDialog } from "./CrmDetailWorkspace";
import React, { useEffect, useRef, useState } from "react";
import type { CrmCampaignRecord } from "../../types/crmCampaign";
import {
  CAMPAIGN_TYPE_OPTIONS,
  CAMPAIGN_STATUS_OPTIONS,
} from "../../types/crmCampaign";
import {
  campaignText,
  campaignScheduleError,
  type CampaignLanguage,
} from "../../utils/campaignWorkspace";
import { campaignBudgetFromInput } from "../../utils/campaignBudget";
import { crmError } from "../../utils/crmLanguage";
import { crmId } from "../../utils/crmIndonesian";
import { CrmSelect } from "./CrmSelect";
import { CampaignDateTimeField } from "./CampaignDateTimeField";
import {
  campaignDateTimeValue,
  type CampaignScheduleParts,
} from "../../utils/campaignScheduleInput";
export function CampaignEditor({
  campaign,
  lang,
  isLight,
  onClose,
  onSaved,
}: {
  campaign: CrmCampaignRecord | null;
  lang: CampaignLanguage;
  isLight: boolean;
  onClose: () => void;
  onSaved: (c: CrmCampaignRecord) => void;
}) {
  const u = campaignUi(lang);
  const t = (en: string, id: string, zh: string) =>
    campaignText(lang, en, id, zh);
  const [v, setV] = useState(() => ({
    name: campaign?.name || "",
    type: campaign?.type || "",
    locationType: campaign?.locationType || "",
    status: campaign?.status || "planning",
    organizer: campaign?.organizer || "",
    startDate: campaign?.startDate || "",
    endDate: campaign?.endDate || "",
    startTime: campaign?.startTime || "",
    endTime: campaign?.endTime || "",
    city: campaign?.city || "",
    venue: campaign?.venue || "",
    address: campaign?.address || "",
    onlineLink: campaign?.onlineLink || "",
    scheduleNotes: campaign?.scheduleNotes || "",
    targetAudience: (campaign?.targetAudience || []).join("\n"),
    keyTopics: (campaign?.keyTopics || []).join("\n"),
    budget:
      campaign?.stats?.budgetCost == null
        ? ""
        : String(campaign.stats.budgetCost),
    defaultHook: campaign?.boundUtm?.defaultHook || "hsk_assessment",
    defaultLang: campaign?.boundUtm?.defaultLang || "id",
    utm_source: campaign?.boundUtm?.utm_source || "",
    utm_medium: campaign?.boundUtm?.utm_medium || "",
  }));
  const initial = useRef(v),
    requestId = useRef(crypto.randomUUID()),
    pending = useRef<any>(null),
    savingRef = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null),
    errorRef = useRef<HTMLParagraphElement>(null);
  const [busy, setBusy] = useState(false),
    [unknown, setUnknown] = useState(false),
    [error, setError] = useState("");
  const dirty = JSON.stringify(v) !== JSON.stringify(initial.current);
  const [confirmClose, setConfirmClose] = useState(false);
  const [lookupMiss,setLookupMiss]=useState(false);
  const close = () => {
    if (busy) return;
    if (dirty || unknown) {
      setConfirmClose(true);
      return;
    }
    onClose();
  };
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty || unknown) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, unknown]);
  function update(key: keyof typeof v, value: string) {
    setV((old) => ({ ...old, [key]: value }));
    setError("");
  }
  function updateSchedule(
    endpoint: "start" | "end",
    parts: CampaignScheduleParts,
  ) {
    setV((old) => ({
      ...old,
      [`${endpoint}Date`]: parts.date,
      [`${endpoint}Time`]: parts.time,
    }));
    setError("");
  }
  function chooseType(value: string) {
    setV((old) => ({
      ...old,
      type: value,
      locationType:
        old.locationType ||
        (["social_paid_ad", "webinar_class"].includes(value) ? "online" : ""),
    }));
    setError("");
  }
  const field = (key: keyof typeof v, label: string, type = "text") => (
    <AdminField className="campaign-field" key={key}>
      <AdminFieldLabel>{label}</AdminFieldLabel>
      <input
        name={key}
        type={type}
        step={type === "number" ? "any" : undefined}
        min={type === "number" ? 0 : undefined}
        value={v[key]}
        onChange={(e) => update(key, e.target.value)}
        {...(key === "name"
          ? { required: true, maxLength: 200, autoFocus: true }
          : {})}
      />
    </AdminField>
  );
  const select = (
    key: keyof typeof v,
    label: string,
    options: React.ReactNode,
  ) => (
    <div className="campaign-field">
      <AdminFieldLabel>{label}</AdminFieldLabel>
      <CrmSelect
        label={label}
        value={v[key]}
        onChange={(value) =>
          key === "type" ? chooseType(value) : update(key, value)
        }
        lang={lang}
        isLight={isLight}
        disabled={busy || unknown}
      >
        {options}
      </CrmSelect>
    </div>
  );
  const explainError = (code: string) =>
    code === "campaign_required"
      ? t(
          "Enter a campaign name.",
          "Masukkan nama kampanye.",
          "请输入活动名称。",
        )
      : code === "campaign_budget_invalid"
        ? t(
            "Enter a non-negative budget, or leave it blank if unknown.",
            "Isi anggaran nol atau lebih, atau kosongkan jika belum diketahui.",
            "预算请输入大于或等于0的数字；尚未确定可留空。",
          )
        : code === "campaign_schedule_invalid"
          ? t(
              "Check the dates and times. A time needs a date; the end must not precede the start.",
              "Periksa tanggal dan waktu. Waktu memerlukan tanggal; akhir tidak boleh mendahului awal.",
              "请核对日期和时间：填写时间须有对应日期，结束不得早于开始。",
            )
          : code === "campaign_entry_invalid"
            ? t(
                "Select an entry service and customer language.",
                "Pilih layanan awal dan bahasa pelanggan.",
                "请选择入口服务和客户页面语言。",
              )
            : code === 'campaign_result_missing' ? t('No saved result found. Keep this request and explicitly retry if needed.','Hasil tersimpan belum ditemukan. Pertahankan permintaan ini dan ulangi secara eksplisit bila perlu.','未查到已保存结果。原请求和草稿保留，可明确重试原请求。') : crmError(code, lang);
  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (savingRef.current) return;
    if (!pending.current) {
      if (!v.name.trim()) {
        setError("campaign_required");
        return;
      }
      const budget = campaignBudgetFromInput(v.budget);
      if (budget === undefined) {
        setError("campaign_budget_invalid");
        return;
      }
      if (campaign && campaignScheduleError(v)) {
        setError("campaign_schedule_invalid");
        return;
      }
      const fields: any = { name: v.name.trim(),requestId:requestId.current };
      if (!campaign)
        Object.assign(fields, {
          requestId: requestId.current,
          savePhase: "basics",
          ...(v.type ? { type: v.type } : {}),
          ...(v.locationType ? { locationType: v.locationType } : {}),
        });
      else {
        for (const k of [
          "type",
          "locationType",
          "status",
          "organizer",
          "startDate",
          "endDate",
          "startTime",
          "endTime",
          "city",
          "venue",
          "address",
          "onlineLink",
          "scheduleNotes",
        ] as const)
          if (v[k] !== initial.current[k]) fields[k] = v[k].trim();
        for (const k of ["targetAudience", "keyTopics"] as const)
          if (v[k] !== initial.current[k])
            fields[k] = v[k]
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean);
        if (v.budget !== initial.current.budget)
          fields.stats = { budgetCost: budget };
        for (const k of [
          "defaultHook",
          "defaultLang",
          "utm_source",
          "utm_medium",
        ] as const)
          if (v[k] !== initial.current[k])
            fields.boundUtm = { ...fields.boundUtm, [k]: v[k] };
      }
      pending.current = fields;
    }
    savingRef.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        campaign
          ? `/api/crm/campaigns/${encodeURIComponent(campaign.id)}`
          : "/api/crm/campaigns",
        {
          method: campaign ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending.current),
          signal: AbortSignal.timeout(20000),
        },
      );
      const result = await r.json();
      if (!r.ok) {
        if (r.status < 500) {
          pending.current = null;
          setUnknown(false);
        } else setUnknown(true);
        setError(result.error || "campaign_save_failed");
        return;
      }
      if (!result.campaign?.code) throw Error("Missing save result");
      pending.current = null;
      onSaved(result.campaign);
    } catch {
      setUnknown(true);
      setError("campaign_save_failed");
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }
  async function checkSavedResult(){
    if(busy)return;setBusy(true);setError('');
    try{const r=await fetch('/api/crm/campaign-save-results/'+encodeURIComponent(requestId.current));const d=await r.json();if(!r.ok){setLookupMiss(r.status===404);setError(r.status===404?'campaign_result_missing':'campaign_save_failed');return;}pending.current=null;onSaved(d.campaign);}catch{setError('campaign_save_failed');}finally{setBusy(false);}
  }
  return (
    <>
      <dialog
        ref={dialog}
        className="campaign-editor crm-form-campaign-editor"
        data-theme={isLight ? "light" : "dark"}
        aria-labelledby="campaign-editor-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <AdminForm lang={lang} onSubmit={e=>{if(unknown){e.preventDefault();void checkSavedResult();}else void save(e);}}>

          <header>
            <div>
              <h2 id="campaign-editor-title">
                {campaign
                  ? t(
                      "Edit campaign information",
                      "Edit informasi kampanye",
                      "编辑活动信息",
                    )
                  : t("Create campaign", "Buat kampanye", "创建活动")}
              </h2>
              <p>
                {campaign
                  ? t(
                      "Changes preserve the campaign code and existing attribution.",
                      "Perubahan mempertahankan kode dan atribusi yang ada.",
                      "修改保留活动码和已有归因。",
                    )
                  : t(
                      "Step 1 of 2 · Name the campaign. Next, add a promotion link for each channel or placement.",
                      "Langkah 1 dari 2 · Beri nama kampanye. Berikutnya, tambahkan tautan promosi untuk setiap kanal atau penempatan.",
                      "第1步，共2步 · 填写活动名称，保存后为各渠道或投放位置添加推广链接。",
                    )}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              aria-label={t("Close", "Tutup", "关闭")}
            >
              <X size={20} aria-hidden="true"/>
            </button>
          </header>
          <div className="campaign-editor-body crm-form-layout"><AdminRequiredNote lang={lang}/>
            {(busy || dirty) && !error && (
              <CrmSaveFeedback lang={lang} state={busy ? "saving" : "dirty"} />
            )}
            {error && (
              <p
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="campaign-error"
              >
                {unknown
                  ? t(
                      "Save outcome unknown. Check the saved result first; keep the original request.",
                      "Hasil belum diketahui. Ulangi permintaan yang sama untuk mendapatkan hasil; jangan buat kampanye lain.",
                      "保存结果待确认。请重试原请求查询结果，不要重复创建活动。",
                    )
                  : explainError(error)}
              </p>
            )}
            <fieldset disabled={busy || unknown} className="crm-form-layout">
              <CrmFormSection name="campaign" lang={lang}>
              {field(
                "name",
                t("Campaign name *", "Nama kampanye *", "活动名称 *"),
              )}
              <CrmDisclosure className="crm-form-details" heading={<>{u("Internal campaign details · optional")}</>}>

                <div className="campaign-fields-grid" data-admin-grid="">
                  {select(
                    "type",
                    t(
                      "Campaign type",
                      "Jenis kampanye",
                      "活动类型",
                    ),
                    <>
                      <option value="" disabled>
                        {t("Select type", "Pilih jenis", "请选择类型")}
                      </option>
                      {CAMPAIGN_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {u(o.labelEn)}
                        </option>
                      ))}
                    </>,
                  )}
                  {select(
                    "locationType",
                    t(
                      "Delivery format",
                      "Bentuk penyelenggaraan",
                      "开展形式",
                    ),
                    <>
                      <option value="" disabled>
                        {t("Select format", "Pilih bentuk", "请选择形式")}
                      </option>
                      <option value="offline">
                        {t("On-site", "Tatap muka", "线下")}
                      </option>
                      <option value="online">
                        {t("Online", "Daring", "线上")}
                      </option>
                      <option value="hybrid">
                        {t("Hybrid", "Hibrida", "线上线下混合")}
                      </option>
                    </>,
                  )}
                </div>
              </CrmDisclosure>
              {!campaign && (
                <p className="campaign-hint">
                  {t(
                    "Created as Planning. Budget and schedule remain unrecorded until you add them.",
                    "Dibuat dengan status Perencanaan. Anggaran dan jadwal belum tercatat sampai Anda mengisinya.",
                    "创建为筹备中。预算与排期在补充前保持未填写。",
                  )}
                </p>
              )}
              </CrmFormSection>
              {campaign && (
                <>
                  <CrmDisclosure className="crm-form-details" heading={<>
                      {t(
                        "Contact, status and budget",
                        "Kontak, status, dan anggaran",
                        "联系人、状态及预算",
                      )}
                    </>}>

                    <div className="campaign-fields-grid" data-admin-grid="">
                      {field(
                        "organizer",
                        t(
                          "Organizer / campaign contact",
                          "Penyelenggara / kontak kampanye",
                          "主办方／活动联系人",
                        ),
                      )}
                      {field(
                        "budget",
                        t(
                          "Planned budget (IDR) · blank = unknown",
                          "Anggaran (IDR) · kosong = belum diketahui",
                          "计划预算（IDR）· 留空表示未填写",
                        ),
                        "number",
                      )}
                      {select(
                        "status",
                        t("Campaign status", "Status kampanye", "活动状态"),
                        <>
                          {CAMPAIGN_STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {u(o.labelEn)}
                            </option>
                          ))}
                        </>,
                      )}
                    </div>
                    <p className="campaign-hint">
                      {t(
                        "The campaign contact does not assign customer owners. Names are kept as entered.",
                        "Kontak kampanye tidak menetapkan pemilik pelanggan. Nama dipertahankan sesuai input.",
                        "活动联系人不决定客户Owner。名称按输入原文保存。",
                      )}
                    </p>
                  </CrmDisclosure>
                  <CrmDisclosure className="crm-form-details" heading={<>
                      {t(
                        "Schedule and location",
                        "Jadwal dan lokasi",
                        "时间与地点",
                      )}
                    </>}>


                    <div className="campaign-fields-grid" data-admin-grid="">
                      <>
                        <CampaignDateTimeField
                          lang={lang}
                          name="startDateTime"
                          label={u("Start date and time")}
                          date={v.startDate}
                          time={v.startTime}
                          onChange={(parts) => updateSchedule("start", parts)}
                        />
                        <CampaignDateTimeField
                          lang={lang}
                          name="endDateTime"
                          label={u("End date and time")}
                          date={v.endDate}
                          time={v.endTime}
                          min={campaignDateTimeValue(v.startDate, v.startTime)}
                          onChange={(parts) => updateSchedule("end", parts)}
                        />
                      </>
                      {field("city", t("City", "Kota", "城市"))}
                      {field("venue", t("Venue", "Tempat", "场地"))}
                      {field("address", t("Address", "Alamat", "地址"))}
                      {field(
                        "onlineLink",
                        t(
                          "Online attendance link",
                          "Tautan kehadiran daring",
                          "线上参会链接",
                        ),
                        "url",
                      )}
                      {field(
                        "scheduleNotes",
                        t("Schedule notes", "Catatan jadwal", "日程备注"),
                      )}
                    </div>
                    <p className="campaign-hint">
                      {t(
                        "Attendance links are separate from the campaign registration link.",
                        "Tautan kehadiran berbeda dari tautan pendaftaran kampanye.",
                        "参会链接与活动获客链接相互独立。",
                      )}
                    </p>
                  </CrmDisclosure>
                  <CrmDisclosure className="crm-form-details" heading={<>
                      {t(
                        "Audience and message",
                        "Audiens dan pesan",
                        "受众与活动主张",
                      )}
                    </>}>

                    {(["targetAudience", "keyTopics"] as const).map((k) => (
                      <AdminField className="campaign-field" key={k}>
                        <span>
                          {k === "targetAudience"
                            ? t(
                                "Target audience · one per line",
                                "Audiens sasaran · satu per baris",
                                "目标受众 · 每行一项",
                              )
                            : t(
                                "Confirmed talking points · one per line",
                                "Poin terkonfirmasi · satu per baris",
                                "已确认的活动要点 · 每行一项",
                              )}
                        </span>
                        <textarea
                          rows={3}
                          value={v[k]}
                          onChange={(e) => update(k, e.target.value)}
                        />
                      </AdminField>
                    ))}
                  </CrmDisclosure>
                  {campaign.promotionModel !== "multiple" && (
                    <CrmDisclosure className="crm-form-details" heading={<>
                        {t(
                          "Legacy campaign link defaults",
                          "Pengaturan tautan kampanye lama",
                          "原有活动链接默认设置",
                        )}
                      </>}>

                      <p className="campaign-hint">
                        {t(
                          "Applies to ads, social, email and offline materials. Changing these defaults affects future registrations, not existing attribution.",
                          "Berlaku untuk iklan, media sosial, email, dan materi luring. Perubahan default memengaruhi pendaftaran berikutnya, bukan atribusi yang sudah ada.",
                          "适用于广告、社群、邮件和线下物料。修改默认来源影响后续登记，不改写已有归因。",
                        )}
                      </p>
                      <div className="campaign-fields-grid" data-admin-grid="">
                        {field(
                          "utm_source",
                          t(
                            "Source (utm_source)",
                            "Sumber (utm_source)",
                            "来源（utm_source）",
                          ),
                        )}
                        {field(
                          "utm_medium",
                          t(
                            "Medium (utm_medium)",
                            "Media (utm_medium)",
                            "媒介（utm_medium）",
                          ),
                        )}
                      </div>
                      <p className="campaign-hint">
                        {t(
                          "These defaults apply only to the legacy c-only link. New promotion links keep their own saved settings.",
                          "Pengaturan ini hanya berlaku pada tautan lama yang membawa c saja. Tautan promosi baru memiliki pengaturannya sendiri.",
                          "这些默认设置仅适用于原有只含c的链接；新增推广链接使用各自的独立配置。",
                        )}
                      </p>
                    </CrmDisclosure>
                  )}
                </>
              )}
            </fieldset>
          </div>
          <footer>
            {unknown&&lookupMiss&&<button type="button" disabled={busy} onClick={()=>void save()}>{t('Retry original request','Ulangi permintaan awal','重试原请求')}</button>}
            <button type="button" onClick={close} disabled={busy}>
              {t("Cancel", "Batal", "取消")}
            </button>
            <button className="campaign-primary" type="submit" disabled={busy}>
              {busy
                ? t("Saving…", "Menyimpan…", "保存中…")
                : unknown
                  ? t(
                      "Check saved result",
                      "Periksa hasil tersimpan",
                      "查询保存结果",
                    )
                  : campaign
                    ? t("Save changes", "Simpan perubahan", "保存修改")
                    : t(
                        "Create & add promotion link",
                        "Buat & tambahkan tautan promosi",
                        "创建并添加推广链接",
                      )}
            </button>
          </footer>
        </AdminForm>
      </dialog>
      {confirmClose && (
        <CrmDiscardDialog
          lang={lang}
          isLight={isLight}
          title={unknown ? u("Save outcome unknown") : u("Unsaved changes")}
          description={
            unknown
              ? u(
                  "Closing does not cancel the request. Check the campaign list before creating again; do not submit a second creation request.",
                )
              : u(
                  "Your unsaved campaign information will be discarded. Saved records and links stay unchanged.",
                )
          }
          onKeep={() => setConfirmClose(false)}
          onDiscard={() => {
            setConfirmClose(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
