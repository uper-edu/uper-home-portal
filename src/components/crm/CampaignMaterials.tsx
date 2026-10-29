import {CrmFormSection} from './CrmFormLayout';
import {AdminFormActions} from '../AdminFormLayout';
import {AdminField} from '../AdminForm';
import { campaignUi } from "../../utils/campaignI18n";
import { CrmSaveFeedback, CrmDiscardDialog } from "./CrmDetailWorkspace";
import React, { useRef, useState, useEffect } from "react";
import type { CrmCampaignRecord } from "../../types/crmCampaign";
import {
  campaignText,
  campaignAssetKeys,
  campaignAssetLabel,
  type CampaignLanguage,
  type CampaignDraft,
  type CampaignAssetKey,
} from "../../utils/campaignWorkspace";
import { CrmSelect } from "./CrmSelect";
export function CampaignMaterials({
  campaign,
  lang,
  isLight,
  canEdit,
  onSaved,
  onStateChange,
}: {
  campaign: CrmCampaignRecord;
  lang: CampaignLanguage;
  isLight: boolean;
  canEdit: boolean;
  onSaved: (c: CrmCampaignRecord) => void;
  onStateChange: (dirty: boolean, busy: boolean) => void;
}) {
  const u = campaignUi(lang);
  const t = (en: string, id: string, zh: string) =>
    campaignText(lang, en, id, zh);
  const [language, setLanguage] = useState<CampaignLanguage>(
    campaign.boundUtm.defaultLang || "id",
  );
  const [promotionLinkId, setPromotionLinkId] = useState("");
  const [asset, setAsset] = useState<CampaignAssetKey>("whatsappInvitation");
  const [drafts, setDrafts] = useState<
    Partial<Record<CampaignLanguage, CampaignDraft>>
  >(campaign.aiAssets.templateDrafts || {});
  const changed = useRef<Set<CampaignLanguage>>(new Set());
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    onStateChange(changed.current.size > 0, busy);
  }, [drafts, busy]);
  useEffect(() => () => onStateChange(false, false), []);
  const value = drafts[language]?.[asset] || "";
  const generation = useRef(0);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (changed.current.size) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      generation.current++;
      window.removeEventListener("beforeunload", warn);
    };
  }, []);
  const feedback = (m: string, error = false) => {
    setMessage(m);
    setFailed(error);
  };
  async function generate(force = false) {
    if (value && !force) {
      setConfirmReplace(true);
      return;
    }
    const token = ++generation.current;
    setBusy(true);
    feedback("");
    try {
      const r = await fetch(
        `/api/crm/campaigns/${encodeURIComponent(campaign.id)}/templates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lang: language,
            promotionLinkId: promotionLinkId || undefined,
          }),
        },
      );
      if (!r.ok) throw Error();
      const data = await r.json();
      if (token !== generation.current) return;
      changed.current.add(language);
      setDrafts((old) => ({
        ...old,
        [language]: { ...old[language], [asset]: data.draft[asset] || "" },
      }));
      feedback("Template prepared. Review and save it.");
    } catch {
      feedback("Template unavailable. Your existing draft is unchanged.", true);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    feedback("");
    try {
      const updates = Object.fromEntries(
        [...changed.current].map((l) => [l, drafts[l]]),
      );
      const r = await fetch(
        `/api/crm/campaigns/${encodeURIComponent(campaign.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: campaign.name,
            aiAssets: { templateDrafts: updates },
          }),
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!r.ok) throw Error();
      const data = await r.json();
      changed.current.clear();
      onSaved(data.campaign);
      feedback(
        "Drafts saved. No message was sent or welcome message activated.",
      );
    } catch {
      feedback(
        "Save not confirmed. Your drafts remain here; retry saving.",
        true,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section data-admin-form=""
      className="campaign-materials"
      aria-label={t("Marketing materials", "Materi promosi", "推广物料")}
    >
      <h4 className="font-semibold text-base">
        {t("Template drafts", "Draf templat", "模板草稿")}
      </h4>
      <p className="campaign-hint">
        {t(
          "Templates assemble saved campaign facts; they do not use AI or translate your text. Review dates and claims before sharing.",
          "Templat menyusun fakta kampanye tersimpan; tidak menggunakan AI atau menerjemahkan teks Anda. Periksa tanggal dan klaim sebelum membagikan.",
          "模板依据已保存的活动信息拼装，不调用AI，也不翻译您输入的原文。对外使用前请核对日期和内容。",
        )}
      </p>
      <CrmFormSection name="materialSetup" lang={lang}>
      {(campaign.promotionModel === "multiple" ||
        !!campaign.promotionLinks?.length) && (
        <div className="my-4">
          <CrmSelect
            label={u("Link to include in the template")}
            lang={lang}
            isLight={isLight}
            value={promotionLinkId}
            onChange={setPromotionLinkId}
            disabled={busy}
          >
            <option value="" disabled>
              {u("Select a promotion link")}
            </option>
            {(campaign.promotionLinks || []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </CrmSelect>
          <p className="campaign-hint">
            {u(
              "Choose the saved link for this placement. Existing drafts keep their original content and links until you replace them.",
            )}
          </p>
        </div>
      )}
      <div
        role="group"
        aria-label={t("Material language", "Bahasa materi", "物料语言")}
        className="flex gap-2 flex-wrap"
      >
        {(["en", "id", "zh"] as const).map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={l === language}
            className={l === language ? "campaign-primary" : ""}
            disabled={busy}
            onClick={() => {
              setLanguage(l);
              feedback("");
            }}
          >
            {u({ en: "English", id: "Bahasa Indonesia", zh: "Chinese" }[l])}
          </button>
        ))}
      </div>
      <div className="my-4">
        <CrmSelect
          label={t("Content type", "Jenis konten", "内容类型")}
          lang={lang}
          isLight={isLight}
          value={asset}
          onChange={(v) => {
            setAsset(v as CampaignAssetKey);
            feedback("");
          }}
          disabled={busy}
        >
          {campaignAssetKeys.map((k) => (
            <option key={k} value={k}>
              {campaignAssetLabel(k, lang)}
            </option>
          ))}
        </CrmSelect>
      </div>
      </CrmFormSection>
      <CrmFormSection name="materialContent" lang={lang}>
      {!value && (
        <p className="campaign-hint">
          {t(
            "No draft in this language yet.",
            "Belum ada draf dalam bahasa ini.",
            "此语言暂无草稿。",
          )}
        </p>
      )}
      <AdminField className="campaign-field">
        <span>{campaignAssetLabel(asset, lang)}</span>
        <textarea
          readOnly={!canEdit}
          disabled={busy}
          value={value}
          onChange={(e) => {
            changed.current.add(language);
            setDrafts((old) => ({
              ...old,
              [language]: { ...old[language], [asset]: e.target.value },
            }));
            feedback("");
          }}
        />
      </AdminField>
      </CrmFormSection>
      <AdminFormActions role="group" className="crm-material-actions" aria-label={t("Draft actions", "Tindakan draf", "草稿操作")}>
        {canEdit && (
          <button
            type="button"
            onClick={() => void generate()}
            disabled={
              busy ||
              (campaign.promotionModel === "multiple" && !promotionLinkId)
            }
          >
            {t("Prepare template", "Siapkan templat", "准备模板草稿")}
          </button>
        )}
        <button
          type="button"
          disabled={busy || !value}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              feedback("Copied. This does not send a message.");
            } catch {
              feedback("Copy failed. Select and copy the text manually.", true);
            }
          }}
        >
          {t("Copy text", "Salin teks", "复制文案")}
        </button>
        {canEdit && (
          <button
            className="campaign-primary"
            type="button"
            disabled={busy || !changed.current.size}
            onClick={save}
          >
            {busy
              ? t("Working…", "Memproses…", "处理中…")
              : t("Save drafts", "Simpan draf", "保存草稿")}
          </button>
        )}
      </AdminFormActions>
      {(busy || changed.current.size > 0) && (
        <CrmSaveFeedback lang={lang} state={busy ? "saving" : "dirty"} />
      )}
      {message && (
        <CrmSaveFeedback lang={lang} state={failed ? "error" : "saved"}>
          {u(message)}
        </CrmSaveFeedback>
      )}
      {confirmReplace && (
        <CrmDiscardDialog
          lang={lang}
          isLight={isLight}
          title={u("Replace this draft?")}
          description={u(
            "Replace only the selected material with a template using the saved campaign facts and promotion link. Other materials stay unchanged.",
          )}
          keepLabel={u("Keep draft")}
          discardLabel={u("Replace with template")}
          onKeep={() => setConfirmReplace(false)}
          onDiscard={() => {
            setConfirmReplace(false);
            void generate(true);
          }}
        />
      )}
      <p className="campaign-hint">
        {t(
          "Drafts are not refreshed automatically when campaign information changes. Recheck them before reuse.",
          "Draf tidak diperbarui otomatis saat informasi kampanye berubah. Periksa kembali sebelum digunakan.",
          "活动信息变化不会自动改写已保存草稿，复用前请重新核对。",
        )}
      </p>
      {campaignAssetKeys.some(
        (k) =>
          campaign.aiAssets[k] ||
          campaign.aiAssets.idAssets?.[k] ||
          campaign.aiAssets.enAssets?.[k],
      ) && (
        <details>
          <summary>
            {t(
              "Earlier materials · original text, language unverified",
              "Materi lama · teks asli, bahasa belum diverifikasi",
              "历史物料 · 原文保留，语言未核实",
            )}
          </summary>
          {[
            ["Original", "Asli", "原始内容", campaign.aiAssets],
            [
              "Previously labelled Indonesian",
              "Sebelumnya berlabel Indonesia",
              "历史印尼文标记",
              campaign.aiAssets.idAssets,
            ],
            [
              "Previously labelled English",
              "Sebelumnya berlabel Inggris",
              "历史英文标记",
              campaign.aiAssets.enAssets,
            ],
          ].map(
            ([en, id, zh, record], i) =>
              record && (
                <details key={i}>
                  <summary>
                    {t(en as string, id as string, zh as string)}
                  </summary>
                  {campaignAssetKeys.map(
                    (k) =>
                      (record as CampaignDraft)[k] && (
                        <div key={k}>
                          <strong>{campaignAssetLabel(k, lang)}</strong>
                          <pre>{(record as CampaignDraft)[k]}</pre>
                        </div>
                      ),
                  )}
                </details>
              ),
          )}
        </details>
      )}
    </section>
  );
}
