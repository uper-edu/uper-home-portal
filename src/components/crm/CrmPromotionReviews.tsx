import {AdminFormSection,AdminFormActions} from '../AdminFormLayout';
import {AdminField,AdminRequiredNote,AdminForm} from '../AdminForm';
import {
  campaignUi,
  campaignUiLocale,
  campaignUiError,
} from "../../utils/campaignI18n";
import React, { useEffect, useRef, useState } from "react";
import { CrmSingleSelect } from "./CrmSingleSelect";
import { ChevronDown, ClipboardCheck, History } from "lucide-react";
import { CrmDetailTabs, CrmSaveFeedback } from "./CrmDetailWorkspace";
import { CrmDisclosure } from "./CrmDisclosure";
import { CampaignSourceEvidence } from "./CampaignSourceEvidence";
import { isPromotionReviewPending, promotionReviewActions } from "../../utils/promotionReviewActions";
import { PROMOTION_MEDIUM_LABELS } from "../../utils/campaignPromotion";
import { formatCrmEventTime } from "../../utils/crmOperatingTime";
import type { CrmCampaignRecord } from "../../types/crmCampaign";

export function CrmPromotionReviews({
  isLight,
  onChanged,
  refreshRevision = 0,
  onLoadingChange,
  onLead,
  campaigns,
  onStateChange,
  campaignFilter,
  onClearCampaignFilter,
  lang = "en",
}: {
  lang?: "en" | "id" | "zh";
  campaignFilter?: { id: string; name: string };
  onClearCampaignFilter?: () => void;
  isLight: boolean;
  onChanged: () => void;
  refreshRevision?: number;
  onLoadingChange?: (loading: boolean) => void;
  onLead?: (id: string) => void;
  campaigns: CrmCampaignRecord[];
  onStateChange?: (state: { dirty: boolean; busy: boolean }) => void;
}) {
  const u = campaignUi(lang);
  const [loadedRows, setRows] = useState<any[] | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [history, setHistory] = useState(false),
    [receipt, setReceipt] = useState<any>(null);
  const loadRevision = useRef(0);
  const draftStates = useRef(new Map<string, { dirty: boolean; busy: boolean }>());
  const [draftViews, setDraftViews] = useState<Record<string, boolean>>({});
  const reportNavigation = () => {
    const states = [...draftStates.current.values()];
    onStateChange?.({
      dirty: states.some(state => state.dirty),
      busy: states.some(state => state.busy),
    });
  };
  async function load() {
    const revision = ++loadRevision.current;
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/crm/campaigns/sources/promotions");
      if ((r.status === 401 || r.status === 403) && revision === loadRevision.current) {
        setRows(null);
        setReceipt(null);
        setDraftViews({});
        draftStates.current.clear();
        reportNavigation();
      }
      if (!r.ok) throw Error();
      const data = await r.json();
      if (!Array.isArray(data.reviews)) throw Error();
      if (revision === loadRevision.current) {
        const visibleIds = new Set(data.reviews.map((row: any) => row.leadId));
        for (const id of draftStates.current.keys()) {
          if (!visibleIds.has(id)) draftStates.current.delete(id);
        }
        setDraftViews(views => Object.fromEntries(Object.entries(views).filter(([id]) => visibleIds.has(id))));
        reportNavigation();
        setRows(data.reviews);
      }
    } catch {
      if (revision === loadRevision.current) setError("Promotion review data unavailable. Retry.");
    } finally {
      if (revision === loadRevision.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => { loadRevision.current++; };
  }, [refreshRevision]);
  useEffect(() => { onLoadingChange?.(loading); }, [loading, onLoadingChange]);
  const report = (id: string, state: { dirty: boolean; busy: boolean }) => {
    if (state.dirty || state.busy) {
      if (!draftStates.current.has(id)) {
        setDraftViews(views => ({ ...views, [id]: history }));
      }
      draftStates.current.set(id, state);
    } else if (draftStates.current.delete(id)) {
      setDraftViews(views => {
        const next = { ...views };
        delete next[id];
        return next;
      });
    }
    reportNavigation();
  };
  useEffect(() => () => onStateChange?.({ dirty: false, busy: false }), []);
  const rows = loadedRows ?? [];
  const scopedRows = campaignFilter ? rows.filter(row => row.campaignId === campaignFilter.id) : rows;
  const pendingRows = scopedRows.filter(row => isPromotionReviewPending(row.status));
  const historyRows = scopedRows.filter(row => row.history.length > 0);
  const visible = scopedRows.filter(row =>
    (history ? row.history.length > 0 : isPromotionReviewPending(row.status)) ||
    draftViews[row.leadId] === history,
  );
  const countLabel = (label: string, count: number) => loadedRows && !error
    ? `${label} (${count.toLocaleString(campaignUiLocale(lang))})` : label;
  return (
    <section aria-label={u("Promotion exception list")} className="campaign-review-workspace">
      <div className="campaign-review-toolbar">
        <CrmDetailTabs
          id="promotion-exceptions"
          value={history ? "history" : "pending"}
          tabs={[
            { id: "pending", label: countLabel(u("Needs review"), pendingRows.length), icon: ClipboardCheck },
            { id: "history", label: countLabel(u("Review history"), historyRows.length), icon: History },
          ]}
          label={u("Promotion exception list")}
          contentId="promotion-exception-records"
          onChange={(value) => setHistory(value === "history")}
        />
      </div>
      <div id="promotion-exception-records" role="tabpanel"
        aria-labelledby={history ? "promotion-exceptions-tab-history" : "promotion-exceptions-tab-pending"}
        aria-busy={loading} className="campaign-review-records">
        {campaignFilter && (
          <p className="campaign-review-filter">
            {u("Showing promotion issues for {name}.", {
              name: campaignFilter.name,
            })}{" "}
            <button
              type="button"
              className="underline"
              onClick={onClearCampaignFilter}
            >
              {u("Show all campaigns")}
            </button>
          </p>
        )}
        {loading && !loadedRows && <p className="campaign-review-message" role="status">{u("Loading promotion reviews…")}</p>}
        {error && (
          <p className="campaign-review-message" role="alert">
            {campaignUiError(lang, error)}{" "}
            <button type="button" className="campaign-workspace-action" onClick={() => void load()}>{u("Retry")}</button>
          </p>
        )}
        {receipt && (
          <CrmSaveFeedback lang={lang} state="saved">
            {u("Review saved for {name}.", { name: receipt.name })}{" "}
            {receipt.status === "linked"
              ? u("Manually confirmed")
              : receipt.status === "deferred"
                ? u("Left unconfirmed; remains in Needs review.")
                : u(
                    "Promotion attribution marked invalid; customer retained.",
                  )}
          </CrmSaveFeedback>
        )}
        {!loading && !error && !visible.length && (
          <p className="campaign-review-message">{u("No promotion entries in this view.")} {u("Review customers whose promotion link could not be identified.")}</p>
        )}
        {rows.map((row) => (
          <div key={row.leadId} hidden={!visible.includes(row)}>
            <PromotionReviewCard
              lang={lang}
              row={row}
              campaigns={campaigns}
              isLight={isLight}
              onLead={onLead}
              onStateChange={(state) => report(row.leadId, state)}
              onSaved={(result) => {
                setReceipt({ ...result, name: row.name });
                void load();
                onChanged();
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
function PromotionReviewCard({
  row,
  campaigns,
  isLight,
  onLead,
  onSaved,
  onStateChange,
  lang,
}: {
  lang: "en" | "id" | "zh";
  row: any;
  campaigns: CrmCampaignRecord[];
  isLight: boolean;
  onLead?: (id: string) => void;
  onSaved: (result: any) => void;
  onStateChange: (state: { dirty: boolean; busy: boolean }) => void;
}) {
  const u = campaignUi(lang);
  const [open, setOpen] = useState(false),
    [action, setAction] = useState(""),
    [target, setTarget] = useState(""),
    [reason, setReason] = useState(""),
    [campaignId, setCampaignId] = useState(""),
    [busy, setBusy] = useState(false),
    [unknown, setUnknown] = useState(false),
    [error, setError] = useState("");
  const pending = useRef<any>(null),
    baseline = useRef<any>(null),
    trigger = useRef<HTMLButtonElement>(null),
    saving = useRef(false);
  const endpoint =
    "/api/crm/campaigns/sources/promotions/" + encodeURIComponent(row.leadId);
  const needsCampaign = action === "link" || action === "campaign";
  const campaign = campaigns.find(item => item.id === campaignId);
  const links = campaign?.promotionLinks || [];
  const dirty = Boolean(action || reason || target);
  useEffect(() => {
    onStateChange({ dirty: dirty || unknown, busy: busy || unknown });
  }, [dirty, busy, unknown]);
  useEffect(() => {
    if (!dirty && !unknown) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, unknown]);
  const reset = () => {
    setOpen(false);
    setAction("");
    setTarget("");
    setReason("");
    setCampaignId("");
    pending.current = null;
    baseline.current = null;
    setUnknown(false);
    setError("");
    requestAnimationFrame(() => {
      const button = trigger.current;
      const focus = button?.getClientRects().length ? button :
        document.querySelector<HTMLButtonElement>('[id^="promotion-exceptions-tab-"][aria-selected="true"]');
      focus?.focus({ preventScroll: true });
    });
  };
  const finish = (result: any) => {
    if (result?.leadId !== row.leadId || result?.requestId !== pending.current?.requestId ||
        !["linked", "deferred", "invalid"].includes(result?.status)) throw Error();
    reset();
    onSaved(result);
  };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving.current || row.canReview === false) return;
    if (!pending.current && (!action || !reason.trim() || (needsCampaign && !campaign) ||
        (action === "link" && !links.some(link => link.id === target)))) return;
    saving.current = true;
    setBusy(true);
    setError("");
    pending.current ||= {
      action,
      linkId: action === "link" ? target : undefined,
      campaignId: needsCampaign ? campaignId : undefined,
      reason,
      ...(baseline.current || {
        revision: row.revision,
        rawCode: row.rawCode,
        rawPromotionLinkId: row.rawPromotionLinkId,
      }),
      requestId: crypto.randomUUID(),
    };
    try {
      const r = await fetch(endpoint + "/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending.current),
        signal: AbortSignal.timeout(20000),
      });
      const data = await r.json();
      if (!r.ok) {
        setUnknown(r.status >= 500);
        if (r.status < 500) pending.current = null;
        setError(
          data.error || "Could not save review. Your input is retained.",
        );
        return;
      }
      finish(data);
    } catch {
      setUnknown(true);
      setError(
        "Save outcome unknown. Check the saved result or retry the original request.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function checkResult() {
    if (!pending.current || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        endpoint + "/results/" + encodeURIComponent(pending.current.requestId),
        { cache: "no-store", signal: AbortSignal.timeout(15000) },
      );
      const data = await r.json();
      if (!r.ok) {
        setError(
          r.status === 404
            ? "No confirmed result yet. Retry the original request; do not create a second one."
            : data.error || "Result lookup unavailable.",
        );
        return;
      }
      finish(data);
    } catch {
      setError("Result lookup unavailable. Keep this request and retry.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const status = row.status === "linked" ? u("Manually confirmed")
    : row.status === "deferred" ? u("Left unconfirmed")
    : row.status === "invalid" ? u("Invalid promotion attribution")
    : u("Needs review");
  const tone = row.status === "linked" ? "success" : row.status === "invalid" ? "danger" : "warning";
  const exception = row.exception === "invalid_p" ? u("Invalid promotion ID")
    : row.exception === "unknown_p" ? u("Unknown promotion ID") : null;
  const collapse = () => {
    if (dirty) {
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    } else {
      reset();
    }
  };
  return (
    <article className="campaign-source-card" data-review-open={open}
      aria-label={u("Promotion issue: {name}", { name: row.name })}>
      <header className="campaign-review-card-header">
        <div className="campaign-review-card-title">
          <h2>{row.name}</h2>
          <span className="admin-status" data-tone={tone}><span className="admin-status-dot" />{status}</span>
        </div>
        <button type="button" ref={trigger} className="campaign-workspace-action"
          disabled={busy || unknown || row.canReview === false}
          title={row.canReview === false ? u("CRM Manager review required by policy") : undefined}
          aria-label={open ? u("Keep draft & close") : undefined}
          aria-expanded={open} aria-controls={open ? "promotion-review-" + row.leadId : undefined}
          onClick={() => {
            if (open) {
              collapse();
              return;
            }
            if (!dirty) {
              setCampaignId(row.campaignId ?? "");
              baseline.current = {
                revision: row.revision,
                rawCode: row.rawCode,
                rawPromotionLinkId: row.rawPromotionLinkId,
              };
            }
            setOpen(true);
          }}>
          {!open && (row.revision ? u("Review again") : u("Review promotion entry"))}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </header>
      <dl className="campaign-review-facts">
        <div>
          <dt>{u("Original promotion ID (p)")}</dt>
          <dd><code>{row.rawPromotionLinkId || u("(empty value)")}</code>{exception && <span>{exception}</span>}</dd>
        </div>
        <div>
          <dt>{u("Campaign")}</dt>
          <dd>{row.campaignName || u("No campaign assigned")}</dd>
        </div>
        {row.resolution?.snapshot && (
          <div>
            <dt>{u("Verified entry:")}</dt>
            <dd>{row.resolution.snapshot.name} · {row.resolution.snapshot.source} /{" "}
              {u(PROMOTION_MEDIUM_LABELS[row.resolution.snapshot.medium] || row.resolution.snapshot.medium)}
              {" · "}<code>{row.resolution.linkId}</code>
            </dd>
          </div>
        )}
      </dl>
      {row.resolution && !row.history.length && (
        <div className="campaign-review-last-decision">
          <div>{u("Latest decision:")} {row.resolution.actor} · {formatCrmEventTime(row.resolution.at)}</div>
          <p>{row.resolution.reason}</p>
        </div>
      )}
      {open && (
        <AdminForm lang={lang}
          id={"promotion-review-" + row.leadId}
          onSubmit={save}
          className="campaign-source-review"
          aria-label={u("Review promotion entry for {name}", {
            name: row.name,
          })}
        >
          <div className="campaign-review-form-grid">
            <CampaignSourceEvidence lang={lang} leadId={row.leadId} evidence={row.evidence}
              originalPromotionId={row.rawPromotionLinkId} onLead={onLead} />
            <AdminFormSection className="crm-form-section"
              title={<span className="campaign-review-form-title">{u("Review decision · this customer only")} <AdminRequiredNote lang={lang} inline /></span>}>
                {error && (
                  <CrmSaveFeedback lang={lang} state={unknown ? "unknown" : "error"}>
                    {campaignUiError(lang, error)}
                  </CrmSaveFeedback>
                )}
                <fieldset disabled={busy || unknown || row.canReview === false}>
                  <AdminField as="div" required>
                    <label>{u("Review action")}</label>
                    <CrmSingleSelect required label={u("Review action")} value={action}
                      options={[
                        { value: "", label: u("Choose an action"), disabled: true },
                        ...promotionReviewActions.map(({value, label}) => ({value, label: u(label)})),
                      ]}
                      onChange={value => {setAction(value); setTarget("");}}
                      lang={lang} isLight={isLight} />
                  </AdminField>
                  {needsCampaign && (
                    <AdminField as="div" required>
                      <label>{u("Campaign")}</label>
                      <CrmSingleSelect required searchable label={u("Campaign")} value={campaignId}
                        options={[
                          { value: "", label: u("Choose a campaign"), disabled: true },
                          ...campaigns.map(item => ({value: item.id, label: item.name + " · " + item.code})),
                        ]}
                        onChange={value => {setCampaignId(value); setTarget("");}}
                        lang={lang} isLight={isLight} />
                    </AdminField>
                  )}
                  {action === "link" && campaign && (
                    <AdminField as="div" required>
                      <label>{u("Existing promotion entry")}</label>
                      <CrmSingleSelect required searchable label={u("Existing promotion entry")} value={target}
                        options={[
                          { value: "", label: u("Choose an entry from this campaign"), disabled: true },
                          ...links.map(link => ({value: link.id, label: link.name + " · " + link.id})),
                        ]}
                        onChange={setTarget} lang={lang} isLight={isLight} />
                      {!links.length && <p className="crm-work-muted">{u("No links in this campaign. Confirm the campaign only if supported by the evidence.")}</p>}
                    </AdminField>
                  )}
                  <AdminField>
                    {u("Review reason / evidence *")}
                    <textarea
                      required
                      maxLength={1000}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </AdminField>
                </fieldset>
            </AdminFormSection>
          </div>
          <AdminFormActions className="crm-source-review-actions">
            {unknown ? <>
              <button type="submit" className="campaign-workspace-action"
                disabled={busy || row.canReview === false}>{u("Retry original request")}</button>
              <button type="button" className="campaign-workspace-action campaign-primary" disabled={busy}
                onClick={() => void checkResult()}>{u("Check saved result")}</button>
            </> : <>
              <button type="button" className="campaign-workspace-action"
                disabled={busy} onClick={collapse}>{u("Keep draft & close")}</button>
              <button type="submit" className="campaign-workspace-action campaign-primary"
                disabled={row.canReview === false || busy || !action || !reason.trim() ||
                  (needsCampaign && !campaign) || (action === "link" && !links.some(link => link.id === target))}>
                {busy ? u("Saving…") : u("Save review")}
              </button>
            </>}
          </AdminFormActions>
        </AdminForm>
      )}
      {!!row.history.length && (
        <CrmDisclosure className="campaign-review-history"
          heading={u("Decision history ({count})", { count: row.history.length })}>
          {row.history.map((h: any) => (
            <div key={h.requestId} className="campaign-review-history-item">
              <p>
                {u(
                  promotionReviewActions.find((a) => a.value === h.action)
                    ?.label || (h.action === "create" ? "Create promotion entry and link" : h.action),
                )}{" "}
                · {h.actor} ·{" "}
                {formatCrmEventTime(h.at)}
              </p>
              <p>{h.after.reason}</p>
              {h.after.campaignName && h.after.campaignName !== row.campaignName && (
                <p>{u("Campaign:")} {h.after.campaignName}</p>
              )}
              {h.after.linkId && h.after.linkId !== row.resolution?.linkId && (
                <p>{u("Verified entry:")} <code>{h.after.linkId}</code></p>
              )}
              {h.after.rawPromotionLinkId !== row.rawPromotionLinkId && (
                <p>{u("Original:")} <code>{h.after.rawPromotionLinkId || u("(empty value)")}</code></p>
              )}
            </div>
          ))}
        </CrmDisclosure>
      )}
    </article>
  );
}
