import {crmInstant,formatCrmEventTime} from '../../utils/crmOperatingTime';
import {INSTAGRAM_BIO_CAMPAIGN,isInstagramBioPromotion} from '../../utils/instagramBioCampaign';
import evergreenLinks from '../../data/evergreenPromotionLinks.json';
import {promotionLandingPaths, promotionKindForMedium, promotionCodePattern} from '../../utils/promotionNavigation';
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
  PROMOTION_SOURCES,
  PROMOTION_MEDIA,
  PROMOTION_MEDIUM_LABELS,
} from "../../utils/campaignPromotion";
import { CrmSelect } from "./CrmSelect";
import { CrmOperationLayer } from "./CrmOperationLayer";
import { CrmSalesDialog } from "./CrmSalesDialog";
import { CampaignQrImage } from "./CampaignQrImage";
import { useCampaignQr } from "./useCampaignQr";

const newPromotionDraft = {
  name: "",
  source: "",
  medium: "",
  language: "id",
  experience: PROMOTION_EXPERIENCE,
  landingPath: "/chat",
  promotionKind: "",
  content: "",
};

const landingExperience: Record<(typeof promotionLandingPaths)[number], string> = {
  "/chat": "Opens the consultation entry directly. Assessment depends on eligibility.",
  "/link": "Opens Link Hub. Visitors can choose online consultation, the handbook, or the community.",
  "/": "Opens the UPER homepage. Visitors can browse the site or choose an online consultation.",
  "/hsk": "Opens the HSK page for course and exam information.",
  "/csca": "Opens the CSCA page for assessment and preparation information.",
  "/consultancy": "Opens the study abroad advisory page.",
  "/tours": "Opens the study tours page for programme information.",
};

function placementSuggestions(source: string, medium: string, promotionKind: string) {
  if (promotionKind === "paid") return [["ad-01", "Ad"], ["creative-01", "Creative"]];
  if (medium === "social") {
    return source === "youtube"
      ? [["channel-description", "Channel description"], ["video-description", "Video description"]]
      : [["profile-bio", "Profile bio"], ["organic-post", "Organic post"]];
  }
  if (medium === "messaging" || medium === "group_message") {
    return [["group-post", "Group post"], ["broadcast", "Broadcast"]];
  }
  if (medium === "email") return [["newsletter", "Newsletter"]];
  if (medium === "poster") return [["poster-01", "Poster"]];
  if (medium === "flyer") return [["flyer-01", "Flyer"]];
  if (medium === "table_card") return [["table-card-01", "Table card"]];
  return [];
}

function LinkCard({
  campaign,
  link,
  lang,
  isLight,
}: {
  lang: "en" | "id" | "zh";
  campaign: CrmCampaignRecord;
  link: CampaignPromotionLink;
  isLight: boolean;
}) {
  const u = campaignUi(lang);
  const createdAt = crmInstant(link.createdAt);
  const isPreset = (campaign.id === "social-bio" && evergreenLinks.some(preset => preset.id === link.id))
    || (campaign.id === INSTAGRAM_BIO_CAMPAIGN && isInstagramBioPromotion(link, link.language));
  const url = campaignPromotionUrl(link, window.location.origin, campaign.code);
  const [qrOpen, setQrOpen] = useState(false);
  const qr = useCampaignQr(qrOpen ? url : null);
  const [feedback, setFeedback] = useState("");
  return (
    <article className="campaign-promotion-card">
      <div>
        <div className="campaign-link-heading">
          <h3 className="campaign-preset-heading">
            {link.name}
            {isPreset && (
              <span className="campaign-preset-badge">{u("System preset")}</span>
            )}
          </h3>
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
            <button type="button" className="campaign-workspace-action" onClick={() => setQrOpen(true)}>
              {u("QR code")}
            </button>
            <a
              className="campaign-workspace-action"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              {u("Preview entry")}
            </a>
          </div>
        </div>
        <p>
          {link.source} ·{" "}
          {u(PROMOTION_MEDIUM_LABELS[link.medium] || link.medium)} ·{" "}
          {u(
            { en: "English", id: "Bahasa Indonesia", zh: "Chinese" }[
              link.language
            ],
          )}
        </p>
        <p className="campaign-hint">
          {u("Created:")} {createdAt
            ? <time dateTime={createdAt.toISOString()}>{formatCrmEventTime(link.createdAt).slice(0,16)}</time>
            : u(link.createdAt ? "Time needs review" : "Time not recorded")}
        </p>
        <AdminField className="campaign-field">
          <span>{u("Promotion link")}</span>
          <input
            aria-label={u("Promotion link: {name}", { name: link.name })}
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
          />
        </AdminField>
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
      {qrOpen && (
        <CrmSalesDialog
          title={u("QR code for {name}", { name: link.name })}
          description={u("QR encodes the exact link shown.")}
          onClose={() => setQrOpen(false)}
          isLight={isLight}
        >
          <div className="campaign-promotion-qr">
            <CampaignQrImage qr={qr} lang={lang} alt={u("QR code for {name}", { name: link.name })} className="campaign-promotion-qr-image" />
            <p className="campaign-promotion-qr-url">{url}</p>
          </div>
          <div className="crm-sales-editor-footer">
            <button type="button" className="campaign-workspace-action" onClick={() => setQrOpen(false)}>
              {u("Close")}
            </button>
            {qr.ready && (
              <a tabIndex={0} className="campaign-workspace-action campaign-primary"
                download={campaign.code + "-" + link.id + ".png"} href={qr.dataUrl}>
                {u("Download QR")}
              </a>
            )}
          </div>
        </CrmSalesDialog>
      )}
    </article>
  );
}
export function CampaignPromotionLinks({
  campaign,
  isLight,
  adding,
  onCloseForm,
  onSaved,
  onStateChange,
  lang = "en",
}: {
  lang?: "en" | "id" | "zh";
  campaign: CrmCampaignRecord;
  isLight: boolean;
  adding: boolean;
  onCloseForm: () => void;
  onSaved: (c: CrmCampaignRecord) => void;
  onStateChange: (state: { dirty: boolean; busy: boolean }) => void;
}) {
  const u = campaignUi(lang);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [customSource, setCustomSource] = useState(false);
  const [v, setV] = useState(newPromotionDraft);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [unknown, setUnknown] = useState(false),
    [notice, setNotice] = useState("");
  const suggestedPlacements = placementSuggestions(v.source, v.medium, v.promotionKind);
  const pending = useRef<any>(null),
    saving = useRef(false);
  const dirty =
    adding &&
    (!!v.name || !!v.source || !!v.medium || v.language !== "id" || v.landingPath !== "/chat" || !!v.promotionKind || !!v.content || unknown);
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
    onCloseForm();
    setV(newPromotionDraft);
    setCustomSource(false);
    pending.current = null;
    setUnknown(false);
    setError("");
    setConfirmCancel(false);
  }
  function requestClose() {
    if (busy) return;
    if (dirty) setConfirmCancel(true);
    else closeForm();
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving.current) return;
    if (!v.promotionKind) { setError("Select promotion type"); return; }
    const content = v.content.trim();
    if (content && !promotionCodePattern.test(content)) {
      setError("Use letters, numbers, hyphens or underscores for the placement code. Start with a letter or number.");
      return;
    }
    pending.current ||= { ...v, content, requestId: crypto.randomUUID() };
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
      onCloseForm();
      setCustomSource(false);
      setV(newPromotionDraft);
      onSaved(d.campaign);
      setNotice(
        "Promotion link saved. Copy the link or open its QR code.",
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
  return (
    <section className="campaign-promotion" aria-label={u("Promotion links")}>
      <header>
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
      {adding && (
        <CrmOperationLayer compose customerContext={false}
          title={u("Add promotion link")}
          context={<>{campaign.name} · {u("Link parameter: utm_campaign.")} <code>{campaign.code}</code></>}
          lang={lang} isLight={isLight}
          busy={busy} onClose={requestClose}>
          <AdminForm lang={lang} onSubmit={save} className="crm-editor-compose">
            <div className="crm-editor-scroll" data-admin-stack="">
              <AdminRequiredNote lang={lang} />
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
                  <small className="crm-simple-help">{u("Display name in CRM.")}</small>
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
                        "Link parameter: utm_source. Use a consistent code for the same source.",
                      )}
                    </small>
                  </div>
                  <div className="campaign-field">
                    <AdminFieldLabel required>{u("Delivery medium")}</AdminFieldLabel>
                    <CrmSelect
                      required
                      label={u("Delivery medium")}
                      value={v.medium}
                      lang={lang}
                      isLight={isLight}
                      disabled={busy || unknown}
                      onChange={(medium) => {
                        const kind = promotionKindForMedium(medium);
                        setV({ ...v, medium, promotionKind: kind === "unclassified" ? "" : kind });
                      }}
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
                    <small className="crm-simple-help">{u("Link parameter: utm_medium.")}</small>
                  </div>
                  <div className="campaign-field">
                    <AdminFieldLabel required>{u("Landing page")}</AdminFieldLabel>
                    <CrmSelect required label={u("Landing page")} value={v.landingPath} lang={lang} isLight={isLight}
                      disabled={busy || unknown} onChange={(landingPath) => setV({ ...v, landingPath })}>
                      {promotionLandingPaths.map(path => <option key={path} value={path}>{path}</option>)}
                    </CrmSelect>
                    <small className="crm-simple-help">{u("Sets the link path.")}</small>
                  </div>
                  <div className="campaign-field">
                    <AdminFieldLabel required>{u("Promotion type")}</AdminFieldLabel>
                    <CrmSelect required label={u("Promotion type")} value={v.promotionKind} lang={lang} isLight={isLight}
                      disabled={busy || unknown || promotionKindForMedium(v.medium) !== "unclassified"}
                      onChange={(promotionKind) => setV({ ...v, promotionKind })}>
                      <option value="" disabled>{u("Select promotion type")}</option>
                      <option value="unpaid">{u("Unpaid promotion")}</option>
                      <option value="paid">{u("Paid promotion")}</option>
                    </CrmSelect>
                    <small className="crm-simple-help">{u("CRM reporting category.")}</small>
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
                    <small className="crm-simple-help">{u("Link parameter: lang.")}</small>
                  </div>
                </div>
                <AdminField className="campaign-field">
                  <AdminFieldLabel>{u("Placement or creative code")}</AdminFieldLabel>
                  <input maxLength={80} pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}" value={v.content}
                    onChange={event => setV({ ...v, content: event.target.value })} />
                  <small className="crm-simple-help">{u("Optional. When filled, adds utm_content to compare placements or creatives in reports.")}</small>
                </AdminField>
                {!!suggestedPlacements.length && (
                  <div className="campaign-promotion-actions campaign-placement-suggestions" role="group" aria-label={u("Suggested placement codes")}>
                    {suggestedPlacements.map(([code, label]) => (
                      <button key={code} type="button" className="crm-work-button" aria-pressed={v.content === code}
                        onClick={() => setV({ ...v, content: code })}>
                        {u(label)}
                      </button>
                    ))}
                  </div>
                )}
                <div className="campaign-field" aria-live="polite">
                  <span>{u("Entry experience")}</span>
                  <p>{u(landingExperience[v.landingPath as keyof typeof landingExperience])}</p>
                </div>
                </CrmFormSection>
              </fieldset>
            </div>
            <AdminFormActions className="crm-editor-actions">
              <button type="button" className="crm-work-button" disabled={busy} onClick={requestClose}>
                {u("Cancel")}
              </button>
              <button type="submit" className="crm-work-button crm-editor-primary" disabled={busy}>
                {busy ? u("Saving…") : unknown ? u("Retry original request") : u("Create promotion link & QR")}
              </button>
            </AdminFormActions>
          </AdminForm>
        </CrmOperationLayer>
      )}
      {(campaign.promotionLinks || []).map((link) => (
        <LinkCard isLight={isLight} lang={lang} key={link.id} campaign={campaign} link={link} />
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
