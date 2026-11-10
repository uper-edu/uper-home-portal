import {crmInstant,formatCrmEventTime} from '../../utils/crmOperatingTime';
import {INSTAGRAM_BIO_CAMPAIGN,isInstagramBioPromotion} from '../../utils/instagramBioCampaign';
import evergreenLinks from '../../data/evergreenPromotionLinks.json';
import {promotionLandingPaths, promotionKindForMedium, promotionCodePattern} from '../../utils/promotionNavigation';
import {CrmFormSection} from './CrmFormLayout';
import {AdminFormActions} from '../AdminFormLayout';
import {AdminField,AdminRequiredNote,AdminForm} from '../AdminForm';
import { campaignUi, campaignUiError } from "../../utils/campaignI18n";
import { CrmSaveFeedback, CrmDiscardDialog } from "./CrmDetailWorkspace";
import { useEffect, useRef, useState } from "react";
import type {
  CampaignPromotionLink,
  CrmCampaignRecord,
} from "../../types/crmCampaign";
import {
  campaignPromotionShortUrl,
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
  onDelete,
}: {
  lang: "en" | "id" | "zh";
  campaign: CrmCampaignRecord;
  link: CampaignPromotionLink;
  isLight: boolean;
  onDelete?: () => void;
}) {
  const u = campaignUi(lang);
  const createdAt = crmInstant(link.createdAt);
  const isPreset = (campaign.id === "social-bio" && evergreenLinks.some(preset => preset.id === link.id))
    || (campaign.id === INSTAGRAM_BIO_CAMPAIGN && isInstagramBioPromotion(link, link.language));
  const url = campaignPromotionUrl(link, window.location.origin, campaign.code);
  const shortUrl = campaignPromotionShortUrl(link.id, window.location.origin, link.shortCode);
  const [qrOpen, setQrOpen] = useState(false);
  const qr = useCampaignQr(qrOpen ? shortUrl : null);
  const [feedback, setFeedback] = useState("");
  const [fullLinkFeedback, setFullLinkFeedback] = useState("");
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
                  await navigator.clipboard.writeText(shortUrl);
                  setFeedback("Short link copied.");
                } catch {
                  setFeedback(
                    "Copy unavailable. Select the short link and copy it manually.",
                  );
                }
              }}
            >
              {u("Copy short link")}
            </button>
            <button type="button" className="campaign-workspace-action" onClick={() => setQrOpen(true)}>
              {u("QR code")}
            </button>
            <a
              className="campaign-workspace-action"
              href={shortUrl}
              target="_blank"
              rel="noreferrer"
            >
              {u("Preview entry")}
            </a>
            {!isPreset && onDelete && (
              <button type="button" className="campaign-workspace-action" onClick={onDelete}
                aria-label={u("Delete promotion link: {name}", {name:link.name})}>
                {u("Delete promotion link")}
              </button>
            )}
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
          <span>{u("Short link")}</span>
          <input
            aria-label={u("Short link: {name}", { name: link.name })}
            readOnly
            value={shortUrl}
            onFocus={(e) => e.target.select()}
          />
        </AdminField>
        <p role="status">{feedback && u(feedback)}</p>
        <details>
          <summary>{u("Tracking details")}</summary>
          <AdminField className="campaign-field">
            <span>{u("Full link")}</span>
            <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
          </AdminField>
          <button type="button" className="crm-work-button" onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setFullLinkFeedback("Full link copied.");
            } catch {
              setFullLinkFeedback("Copy unavailable. Select and copy the link above.");
            }
          }}>{u("Copy full link")}</button>
          <p role="status">{fullLinkFeedback && u(fullLinkFeedback)}</p>
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
            <p className="campaign-promotion-qr-url">{shortUrl}</p>
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
  canManage,
  lang = "en",
}: {
  lang?: "en" | "id" | "zh";
  campaign: CrmCampaignRecord;
  isLight: boolean;
  adding: boolean;
  onCloseForm: () => void;
  onSaved: (c: CrmCampaignRecord) => void;
  onStateChange: (state: { dirty: boolean; busy: boolean }) => void;
  canManage: boolean;
}) {
  const u = campaignUi(lang);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CampaignPromotionLink | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteUnknown, setDeleteUnknown] = useState(false);
  const list = useRef<HTMLElement>(null);
  const deleting = useRef(false);
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
    onStateChange({ dirty, busy: busy || deleteBusy });
    return () => onStateChange({ dirty: false, busy: false });
  }, [dirty, busy, deleteBusy, onStateChange]);
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
  async function removeLink(checkOnly = false) {
    if (!deleteTarget || deleting.current) return;
    const linkId = deleteTarget.id;
    const base = `/api/crm/campaigns/${encodeURIComponent(campaign.id)}`;
    deleting.current = true;
    setDeleteBusy(true);
    try {
      const response = await fetch(checkOnly ? base : `${base}/links/${encodeURIComponent(linkId)}`, {
        ...(checkOnly ? {cache:"no-store"} : {method:"DELETE", headers:{"Content-Type":"application/json"}, body:"{}"}),
        signal:AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (checkOnly) {
        if (!response.ok || result.campaign?.id !== campaign.id) throw Error("Unknown result");
        if (result.campaign.promotionLinks?.some((link:CampaignPromotionLink)=>link.id===linkId)) {
          setDeleteError("The link is still listed. Refresh before trying again.");
          setDeleteUnknown(false);
          return;
        }
        onSaved(result.campaign);
      } else {
        if (!response.ok && response.status < 500) {
          setDeleteError(result.error || "Could not delete the promotion link.");
          return;
        }
        if (!response.ok || result.success !== true) throw Error("Unknown result");
        onSaved({...campaign,promotionLinks:campaign.promotionLinks?.filter(link=>link.id!==linkId)});
      }
      setNotice("Promotion link deleted.");
      setDeleteTarget(null);
      requestAnimationFrame(()=>list.current?.focus({preventScroll:true}));
    } catch {
      setDeleteUnknown(true);
      setDeleteError("Deletion result unknown. Check whether the link is still listed.");
    } finally {
      deleting.current = false;
      setDeleteBusy(false);
    }
  }
  return (
    <section className="campaign-promotion" aria-label={u("Promotion links")} ref={list} tabIndex={-1}>
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
          <AdminForm lang={lang} onSubmit={save} className="crm-editor-compose crm-promotion-editor">
            <div className="crm-editor-scroll">
              <AdminRequiredNote lang={lang} />
              {(dirty || busy) && !error && (
                <CrmSaveFeedback lang={lang} state={busy ? "saving" : "dirty"} />
              )}
              {error && (
                <CrmSaveFeedback lang={lang} state={unknown ? "unknown" : "error"}>
                  {campaignUiError(lang, error)}
                </CrmSaveFeedback>
              )}
              <fieldset disabled={busy || unknown}>
                <CrmFormSection name="promotion" lang={lang}
                  description={u("Use a separate link for each placement you want to distinguish.")}>
                  <AdminField>
                    {u("Link name · optional")}
                    <input
                      maxLength={120}
                      value={v.name}
                      placeholder={u("e.g. Instagram October ad")}
                      onChange={(e) => setV({ ...v, name: e.target.value })}
                    />
                    <small>{u("Display name in CRM.")}</small>
                  </AdminField>
                  <div className="crm-form-grid">
                    <AdminField as="div" required>
                      <label>{u("Source *")}</label>
                      <div className="admin-field-control">
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
                        <small>
                          {u(
                            "Link parameter: utm_source. Use a consistent code for the same source.",
                          )}
                        </small>
                      </div>
                    </AdminField>
                    <AdminField as="div" required>
                      <label>{u("Delivery medium")}</label>
                      <div className="admin-field-control">
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
                        <small>{u("Link parameter: utm_medium.")}</small>
                      </div>
                    </AdminField>
                    {customSource && (
                      <AdminField className="crm-promotion-custom-source">
                        {u("Source code *")}
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
                    <AdminField as="div" required>
                      <label>{u("Landing page")}</label>
                      <div className="admin-field-control">
                        <CrmSelect required label={u("Landing page")} value={v.landingPath} lang={lang} isLight={isLight}
                          disabled={busy || unknown} onChange={(landingPath) => setV({ ...v, landingPath })}>
                          {promotionLandingPaths.map(path => <option key={path} value={path}>{path}</option>)}
                        </CrmSelect>
                        <small>{u("Sets the link path.")}</small>
                      </div>
                    </AdminField>
                    <AdminField as="div" required>
                      <label>{u("Promotion type")}</label>
                      <div className="admin-field-control">
                        <CrmSelect required label={u("Promotion type")} value={v.promotionKind} lang={lang} isLight={isLight}
                          disabled={busy || unknown || promotionKindForMedium(v.medium) !== "unclassified"}
                          onChange={(promotionKind) => setV({ ...v, promotionKind })}>
                          <option value="" disabled>{u("Select promotion type")}</option>
                          <option value="unpaid">{u("Unpaid promotion")}</option>
                          <option value="paid">{u("Paid promotion")}</option>
                        </CrmSelect>
                        <small>{u("CRM reporting category.")}</small>
                      </div>
                    </AdminField>
                    <AdminField as="div" required>
                      <label>{u("Customer language *")}</label>
                      <div className="admin-field-control">
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
                        <small>{u("Link parameter: lang.")}</small>
                      </div>
                    </AdminField>
                  </div>
                  <div className="crm-promotion-placement">
                    <AdminField>
                      {u("Placement or creative code")}
                      <input maxLength={80} pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}" value={v.content}
                        onChange={event => setV({ ...v, content: event.target.value })} />
                      <small>{u("Optional. When filled, adds utm_content to compare placements or creatives in reports.")}</small>
                    </AdminField>
                    {!!suggestedPlacements.length && (
                      <div className="campaign-placement-suggestions" role="group" aria-label={u("Suggested placement codes")}>
                        {suggestedPlacements.map(([code, label]) => (
                          <button key={code} type="button" className="crm-work-button" aria-pressed={v.content === code}
                            onClick={() => setV({ ...v, content: code })}>
                            {u(label)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="admin-form-guide" aria-live="polite">
                    <h3>{u("Entry experience")}</h3>
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
        <LinkCard isLight={isLight} lang={lang} key={link.id} campaign={campaign} link={link}
          onDelete={canManage ? () => {
            setDeleteError("");
            setDeleteUnknown(false);
            setDeleteTarget(link);
          } : undefined} />
      ))}
      {deleteTarget && (
        <CrmDiscardDialog lang={lang} isLight={isLight} tone="danger" busy={deleteBusy} announceDescription
          title={u("Delete {name}?", {name:deleteTarget.name})}
          description={deleteError ? campaignUiError(lang,deleteError) : u("Shared short links and QR codes will stop working after deletion.")}
          keepLabel={deleteError ? u("Close") : u("Cancel")}
          discardLabel={u(deleteBusy ? "Working…" : deleteUnknown ? "Check deletion result" : "Delete promotion link")}
          onKeep={()=>setDeleteTarget(null)}
          onDiscard={deleteError && !deleteUnknown ? undefined : ()=>void removeLink(deleteUnknown)} />
      )}

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
