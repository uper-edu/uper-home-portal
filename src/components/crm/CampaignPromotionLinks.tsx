import {CrmFormLayoutScope} from '../AdminForm';
import {CrmFormSection} from './CrmFormLayout';
import {AdminFormActions} from '../AdminFormLayout';
import {AdminField,AdminRequiredNote,AdminFieldLabel,AdminForm} from '../AdminForm';
import { campaignUi, campaignUiError } from "../../utils/campaignI18n";
import { CrmSaveFeedback, CrmDiscardDialog } from "./CrmDetailWorkspace";
import { useEffect, useRef, useState } from "react";
import type {
  CampaignPromotionLink,
  CrmCampaignRecord,
} from "../../types/crmCampaign";
import {
  campaignPromotionUrl,
  PROMOTION_EXPERIENCE,
  PROMOTION_EXPERIENCE_LABEL,
  PROMOTION_SOURCES,
  PROMOTION_MEDIA,
  PROMOTION_MEDIUM_LABELS,
} from "../../utils/campaignPromotion";
import { campaignChatLink } from "../../utils/crmCampaignLink";
import { CrmSelect } from "./CrmSelect";
import { CampaignQrImage } from "./CampaignQrImage";
import { useCampaignQr } from "./useCampaignQr";

function LinkCard({
  campaign,
  link,
  lang,
}: {
  lang: "en" | "id" | "zh";
  campaign: CrmCampaignRecord;
  link: CampaignPromotionLink;
}) {
  const u = campaignUi(lang);
  const url = campaignPromotionUrl(campaign.code, link, window.location.origin),
    qr = useCampaignQr(url);
  const [feedback, setFeedback] = useState("");
  return (
    <article className="campaign-promotion-card">
      <div>
        <h3>{link.name}</h3>
        <p>
          {link.source} ·{" "}
          {u(PROMOTION_MEDIUM_LABELS[link.medium] || link.medium)} ·{" "}
          {u(
            { en: "English", id: "Bahasa Indonesia", zh: "Chinese" }[
              link.language
            ],
          )}
        </p>
        <p className="campaign-hint">{u(PROMOTION_EXPERIENCE_LABEL)}</p>
        <AdminField className="campaign-field">
          <span>{u("Promotion link")}</span>
          <input
            aria-label={u("Promotion link: {name}", { name: link.name })}
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
          />
        </AdminField>
        <div className="campaign-promotion-actions">
          <button
            type="button"
            className="campaign-workspace-action campaign-primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setFeedback("Link copied.");
              } catch {
                setFeedback(
                  "Copy unavailable. Select and copy the link above.",
                );
              }
            }}
          >
            {u("Copy link")}
          </button>
          <a
            className="campaign-workspace-action"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            {u("Preview entry")}
          </a>
          {qr.status === "ready" && (
            <a
              className="campaign-workspace-action"
              download={`${campaign.code}-${link.id}.png`}
              href={qr.dataUrl}
            >
              {u("Download QR")}
            </a>
          )}
        </div>
        <p role="status">{feedback && u(feedback)}</p>
        <details>
          <summary>{u("Tracking details")}</summary>
          <p>
            {u("Campaign:")} {campaign.code}
          </p>
          <p>
            {u("Entry ID:")} {link.id}
          </p>
          <p>
            {u("UTM source:")} {link.source} {u("· medium:")} {link.medium}
          </p>
          <p>
            {u(
              "Saved settings are fixed to keep existing links and attribution consistent. Add another link for a different placement.",
            )}
          </p>
        </details>
      </div>
      <div className="campaign-promotion-qr">
        <CampaignQrImage
          qr={qr}
          lang={lang}
          alt={u("QR code for {name}", { name: link.name })}
        />
        <p>{u("QR encodes the exact link shown.")}</p>
      </div>
    </article>
  );
}
function LegacyCampaignLink({
  campaign,
  lang,
}: {
  lang: "en" | "id" | "zh";
  campaign: CrmCampaignRecord;
}) {
  const u = campaignUi(lang);
  const url = campaignChatLink(campaign.code),
    qr = useCampaignQr(url),
    [feedback, setFeedback] = useState("");
  return (
    <article className="campaign-promotion-card">
      <div>
        <h3>{u("Existing campaign-only link")}</h3>
        <p className="campaign-hint">
          {u(
            "Retained for this legacy campaign. It attributes customers to the campaign without a separate promotion entry. Use a new promotion entry when you need independent source, medium and language settings.",
          )}
        </p>
        <AdminField className="campaign-field">
          <span>{u("Campaign link")}</span>
          <input
            readOnly
            value={url}
            aria-label={u("Legacy campaign link")}
            onFocus={(e) => e.target.select()}
          />
        </AdminField>
        <div className="campaign-promotion-actions">
          <button
            type="button"
            className="campaign-workspace-action campaign-primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setFeedback("Link copied.");
              } catch {
                setFeedback(
                  "Copy unavailable. Select and copy the link above.",
                );
              }
            }}
          >
            {u("Copy link")}
          </button>
          <a
            className="campaign-workspace-action"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            {u("Preview entry")}
          </a>
          {qr.ready && (
            <a
              className="campaign-workspace-action"
              download={campaign.code + "-legacy.png"}
              href={qr.dataUrl}
            >
              {u("Download QR")}
            </a>
          )}
        </div>
        <p role="status">{feedback && u(feedback)}</p>
      </div>
      <div className="campaign-promotion-qr">
        <CampaignQrImage
          qr={qr}
          lang={lang}
          alt={u("QR for legacy campaign {name}", { name: campaign.name })}
          className="w-40 h-40"
        />
      </div>
    </article>
  );
}
function CampaignPromotionLinksBody({
  campaign,
  isLight,
  canManage,
  onSaved,
  onStateChange,
  lang = "en",
}: {
  lang?: "en" | "id" | "zh";
  campaign: CrmCampaignRecord;
  isLight: boolean;
  canManage: boolean;
  onSaved: (c: CrmCampaignRecord) => void;
  onStateChange: (state: { dirty: boolean; busy: boolean }) => void;
}) {
  const u = campaignUi(lang);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [customSource, setCustomSource] = useState(false);
  const [adding, setAdding] = useState(
    !campaign.promotionLinks?.length &&
      canManage &&
      campaign.promotionModel === "multiple",
  );
  const [v, setV] = useState({
    name: "",
    source: "",
    medium: "",
    language: "id",
    experience: PROMOTION_EXPERIENCE,
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [unknown, setUnknown] = useState(false),
    [notice, setNotice] = useState("");
  const pending = useRef<any>(null),
    saving = useRef(false);
  const dirty =
    adding &&
    (!!v.name || !!v.source || !!v.medium || v.language !== "id" || unknown);
  useEffect(() => {
    onStateChange({ dirty, busy });
    return () => onStateChange({ dirty: false, busy: false });
  }, [dirty, busy, onStateChange]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function closeForm() {
    setAdding(false);
    setV({
      name: "",
      source: "",
      medium: "",
      language: "id",
      experience: PROMOTION_EXPERIENCE,
    });
    setCustomSource(false);
    pending.current = null;
    setUnknown(false);
    setError("");
    setConfirmCancel(false);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving.current) return;
    pending.current ||= { ...v, requestId: crypto.randomUUID() };
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        `/api/crm/campaigns/${encodeURIComponent(campaign.id)}/links`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending.current),
          signal: AbortSignal.timeout(20000),
        },
      );
      const d = await r.json();
      if (!r.ok) {
        if (r.status < 500) {
          pending.current = null;
          setUnknown(false);
        } else setUnknown(true);
        setError(d.error || "Could not save promotion link.");
        return;
      }
      if (!d.link?.id || !d.campaign) throw Error("Invalid result");
      pending.current = null;
      setUnknown(false);
      setAdding(false);
      setCustomSource(false);
      setV({
        name: "",
        source: "",
        medium: "",
        language: "id",
        experience: PROMOTION_EXPERIENCE,
      });
      onSaved(d.campaign);
      setNotice(
        "Promotion link saved. Copy the link or download its matching QR code below.",
      );
    } catch {
      setUnknown(true);
      setError(
        "Save outcome unknown. Retry the same request to retrieve the saved link; do not create it again.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const legacy = campaign.promotionModel !== "multiple";
  return (
    <section className="campaign-promotion" aria-label={u("Promotion links")}>
      <header>
        {!campaign.promotionLinks?.length && !legacy && (
          <h3>{u("Step 2 · Add your first promotion link")}</h3>
        )}
        <p>
          {u(
            "One campaign can have multiple links for ads, groups, posters and other placements. Each link has its own source, medium and customer language.",
          )}
        </p>
      </header>
      {notice && (
        <CrmSaveFeedback lang={lang} state="saved">
          {u(notice)}
        </CrmSaveFeedback>
      )}
      {!campaign.promotionLinks?.length && !legacy && (
        <p className="campaign-hint">
          {u(
            "Campaign saved. Add an entry to record a source, medium and customer language.",
          )}
        </p>
      )}
      {legacy && <LegacyCampaignLink lang={lang} campaign={campaign} />}
      {!adding && canManage && (
        <button
          className="campaign-workspace-action campaign-primary"
          onClick={() => setAdding(true)}
        >
          {campaign.promotionLinks?.length
            ? u("Add another promotion link")
            : u("Add promotion link")}
        </button>
      )}
      {adding && (
        <AdminForm lang={lang} onSubmit={save} className="campaign-promotion-form">
<AdminRequiredNote lang={lang}/>


          <p className="campaign-hint">
            {u(
              "Use a separate link for each placement you want to distinguish.",
            )}
          </p>
          {(dirty || busy) && !error && (
            <CrmSaveFeedback lang={lang} state={busy ? "saving" : "dirty"} />
          )}
          {error && (
            <CrmSaveFeedback lang={lang} state={unknown ? "unknown" : "error"}>
              {campaignUiError(lang, error)}
            </CrmSaveFeedback>
          )}
          <fieldset disabled={busy || unknown}>
            <CrmFormSection name="promotion" lang={lang}>
            <AdminField className="campaign-field">
              <span>{u("Link name · optional")}</span>
              <input
                maxLength={120}
                value={v.name}
                placeholder={u("e.g. Instagram October ad")}
                onChange={(e) => setV({ ...v, name: e.target.value })}
              />
            </AdminField>
            <div className="campaign-fields-grid" data-admin-grid="">
              <div className="campaign-field">
                <AdminFieldLabel required>{u("Source *")}</AdminFieldLabel>
                <CrmSelect
                  required
                  label={u("Source")}
                  value={customSource ? "custom" : v.source}
                  lang={lang}
                  isLight={isLight}
                  disabled={busy || unknown}
                  onChange={(source) => {
                    setCustomSource(source === "custom");
                    setV({ ...v, source: source === "custom" ? "" : source });
                  }}
                >
                  <option value="" disabled>
                    {u("Select platform or institution")}
                  </option>
                  {PROMOTION_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s === "uper_newsletter"
                        ? u("UPER newsletter")
                        : s === "whatsapp"
                          ? u("WhatsApp")
                          : s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                  <option value="custom">
                    {u("Other platform / institution")}
                  </option>
                </CrmSelect>
                {customSource && (
                  <AdminField className="campaign-field">
                    <AdminFieldLabel required>{u("Source code *")}</AdminFieldLabel>
                    <input
                      required
                      maxLength={80}
                      pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}"
                      value={v.source}
                      placeholder={u("e.g. campus_jakarta_a")}
                      onChange={(e) => setV({ ...v, source: e.target.value })}
                    />
                  </AdminField>
                )}
                <small>
                  {u(
                    "Use the same source code for the same institution across links.",
                  )}
                </small>
              </div>
              <div className="campaign-field">
                <AdminFieldLabel required>{u("Medium *")}</AdminFieldLabel>
                <CrmSelect
                  required
                  label={u("Medium")}
                  value={v.medium}
                  lang={lang}
                  isLight={isLight}
                  disabled={busy || unknown}
                  onChange={(medium) => setV({ ...v, medium })}
                >
                  <option value="" disabled>
                    {u("Select delivery method")}
                  </option>
                  {PROMOTION_MEDIA.map((m) => (
                    <option key={m} value={m}>
                      {u(PROMOTION_MEDIUM_LABELS[m])}
                    </option>
                  ))}
                </CrmSelect>
              </div>
              <div className="campaign-field">
                <AdminFieldLabel required>{u("Customer language *")}</AdminFieldLabel>
                <CrmSelect
                  required
                  label={u("Customer language")}
                  value={v.language}
                  lang={lang}
                  isLight={isLight}
                  disabled={busy || unknown}
                  onChange={(language) => setV({ ...v, language })}
                >
                  <option value="en">{u("English")}</option>
                  <option value="id">{u("Bahasa Indonesia")}</option>
                  <option value="zh">{u("Chinese")}</option>
                </CrmSelect>
              </div>
            </div>
            <div className="campaign-field">
              <span>{u("Entry experience")}</span>
              <p>{u(PROMOTION_EXPERIENCE_LABEL)}</p>
              <small>
                {u(
                  "This is the currently supported flow. Assessment eligibility follows existing rules; this does not book a class or promise materials.",
                )}
              </small>
            </div>
            </CrmFormSection>
          </fieldset>
          <AdminFormActions className="campaign-promotion-actions">
            <button
              type="submit"
              className="campaign-workspace-action campaign-primary"
              disabled={busy}
            >
              {busy
                ? u("Saving…")
                : unknown
                  ? u("Retry original request")
                  : u("Create promotion link & QR")}
            </button>
            <button
              type="button"
              className="campaign-workspace-action"
              disabled={busy}
              onClick={() => {
                if (dirty) setConfirmCancel(true);
                else closeForm();
              }}
            >
              {u("Add later / cancel")}
            </button>
          </AdminFormActions>
        </AdminForm>
      )}
      {(campaign.promotionLinks || []).map((link) => (
        <LinkCard lang={lang} key={link.id} campaign={campaign} link={link} />
      ))}

      <p className="campaign-hint">
        {u("Environment:")} {window.location.origin}
        {u(
          ". Link labels describe configured distribution, not proof of where a visitor actually clicked.",
        )}
      </p>
      {confirmCancel && (
        <CrmDiscardDialog
          lang={lang}
          isLight={isLight}
          title={unknown ? u("Save outcome unknown") : u("Unsaved changes")}
          description={
            unknown
              ? u(
                  "Closing does not cancel the request. Check saved links before creating another promotion link.",
                )
              : u(
                  "Discard the unsaved promotion link details? Saved links stay unchanged.",
                )
          }
          onKeep={() => setConfirmCancel(false)}
          onDiscard={closeForm}
        />
      )}
    </section>
  );
}

export function CampaignPromotionLinks(props:Parameters<typeof CampaignPromotionLinksBody>[0]){return <CrmFormLayoutScope><CampaignPromotionLinksBody {...props}/></CrmFormLayoutScope>;}
