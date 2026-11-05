import {AdminFormSection,AdminFormActions} from '../AdminFormLayout';
import {AdminField,AdminRequiredNote,AdminForm} from '../AdminForm';
import {
  campaignUi,
  campaignUiLocale,
  campaignUiError,
} from "../../utils/campaignI18n";
import React, { useEffect, useRef, useState } from "react";
import { CrmSingleSelect } from "./CrmSingleSelect";
import { CrmSaveFeedback } from "./CrmDetailWorkspace";
import { CampaignSourceEvidence } from "./CampaignSourceEvidence";
import { promotionReviewActions } from "../../utils/promotionReviewActions";
import { PROMOTION_MEDIUM_LABELS } from "../../utils/campaignPromotion";
import type { CrmCampaignRecord } from "../../types/crmCampaign";

export function CrmPromotionReviews({
  isLight,
  onChanged,
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
  onLead?: (id: string) => void;
  campaigns: CrmCampaignRecord[];
  onStateChange?: (state: { dirty: boolean; busy: boolean }) => void;
}) {
  const u = campaignUi(lang);
  const [rows, setRows] = useState<any[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [history, setHistory] = useState(false),
    [receipt, setReceipt] = useState<any>(null);
  const loadRevision = useRef(0);
  async function load() {
    const revision = ++loadRevision.current;
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/crm/campaigns/sources/promotions");
      if (!r.ok) throw Error();
      const data = await r.json();
      if (revision === loadRevision.current) setRows(data.reviews);
    } catch {
      if (revision === loadRevision.current) setError("Promotion review data unavailable. Retry.");
    } finally {
      if (revision === loadRevision.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const draftStates = useRef(
    new Map<string, { dirty: boolean; busy: boolean }>(),
  );
  const report = (id: string, state: { dirty: boolean; busy: boolean }) => {
    draftStates.current.set(id, state);
    onStateChange?.({
      dirty: [...draftStates.current.values()].some((s) => s.dirty),
      busy: [...draftStates.current.values()].some((s) => s.busy),
    });
  };
  useEffect(() => () => onStateChange?.({ dirty: false, busy: false }), []);
  const visible = rows.filter(
    (r) =>
      (!campaignFilter || r.campaignId === campaignFilter.id) &&
      (history
        ? r.history.length > 0
        : ["pending", "deferred"].includes(r.status)),
  );
  return (
    <section
      aria-label={u("Promotion exception list")}
      className="space-y-3"
    >
      <div className="flex flex-wrap gap-3 items-center">
        <button
          type="button"
          className="underline"
          onClick={() => setHistory((v) => !v)}
        >
          {history ? u("Needs review") : u("Review history")}
        </button>
        <button type="button" className="underline" onClick={() => void load()}>
          {u("Refresh promotion reviews")}
        </button>
      </div>
      <p>{u("Review customers whose promotion link could not be identified.")}</p>
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
      {loading && <p role="status">{u("Loading promotion reviews…")}</p>}
      {error && (
        <p role="alert">
          {campaignUiError(lang, error)}{" "}
          <button onClick={() => void load()}>{u("Retry")}</button>
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
                )}{" "}

        </CrmSaveFeedback>
      )}
      {!loading && !error && !visible.length && (
        <p>{u("No promotion entries in this view.")}</p>
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
    trigger.current?.focus({ preventScroll: true });
  };
  const finish = (result: any) => {
    reset();
    onSaved(result);
  };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving.current) return;
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
    if (!pending.current || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        endpoint + "/results/" + encodeURIComponent(pending.current.requestId),
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
      setBusy(false);
    }
  }
  return (
    <article
      className="campaign-source-card border rounded-xl p-3 space-y-2"
      data-review-open={open}
      aria-label={u("Promotion issue: {name}", { name: row.name })}
    >
      <header className="flex flex-wrap justify-between gap-3">
        <strong>{row.name}</strong>
        <span>
          {row.status === "linked"
            ? u("Manually confirmed")
            : row.status === "deferred"
              ? u("Left unconfirmed")
              : row.status === "invalid"
                ? u("Invalid promotion attribution")
                : u("Needs review")}
        </span>
      </header>
      <p>
        {u("Original p:")} <code className="break-all">{row.rawPromotionLinkId || u("(empty value)")}</code>
        {" · "}{u(row.exception === 'invalid_p' ? 'Invalid promotion ID' : row.exception === 'unknown_p' ? 'Unknown promotion ID' : 'Unverified promotion')}
      </p>
      <p>{row.campaignName ? <>{u("Campaign:")} {row.campaignName}</> : u("No campaign assigned")}</p>
      {row.resolution && (
        <p>
          {u("Latest decision:")} {row.resolution.reason} ·{" "}
          {row.resolution.actor} ·{" "}
          {new Date(row.resolution.at).toLocaleString(campaignUiLocale(lang), {

          })}{" "}

        </p>
      )}
      {row.resolution?.snapshot && (
        <p>
          {u("Verified entry:")} {row.resolution.snapshot.name} ·{" "}
          {row.resolution.snapshot.source} /{" "}
          {u(
            PROMOTION_MEDIUM_LABELS[row.resolution.snapshot.medium] ||
              row.resolution.snapshot.medium,
          )}{" "}
          · <code>{row.resolution.linkId}</code>
        </p>
      )}
      <button
        type="button"
        ref={trigger}
        className="campaign-workspace-action"
        disabled={busy||row.canReview===false}
        title={row.canReview===false?u("CRM Manager review required by policy"):undefined}
        aria-expanded={open}
        aria-controls={"promotion-review-" + row.leadId}
        onClick={() => {
          if (!open && !dirty) {
            setCampaignId(row.campaignId ?? "");
            baseline.current = {
              revision: row.revision,
                rawCode: row.rawCode,
              rawPromotionLinkId: row.rawPromotionLinkId,
            };
          }
          setOpen((v) => !v);
        }}
      >
        {row.revision ? u("Review again") : u("Review promotion entry")}{" "}
        <span aria-hidden="true">{open ? "⌃" : "⌄"}</span>
      </button>
      {open && (
        <AdminForm lang={lang}
          id={"promotion-review-" + row.leadId}
          onSubmit={save}
          className="campaign-source-review crm-form-layout border rounded-xl p-4"
          aria-label={u("Review promotion entry for {name}", {
            name: row.name,
          })}
        >
<h3 data-admin-form-title className="crm-source-review-heading">{u("Review promotion entry for {name}",{name:row.name})}</h3>
<AdminRequiredNote lang={lang}/>

          <CampaignSourceEvidence lang={lang} leadId={row.leadId} evidence={row.evidence} onLead={onLead} />
          <AdminFormSection className="crm-form-section" title={u("Review decision · this customer only")}>
          {error && (
            <CrmSaveFeedback lang={lang} state={unknown ? "unknown" : "error"}>
              {campaignUiError(lang, error)}
            </CrmSaveFeedback>
          )}
          <fieldset disabled={busy || unknown || row.canReview===false} className="space-y-3">
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
          <p className="campaign-hint">{u("This decision applies only to this customer.")}</p>
          </AdminFormSection>
          <AdminFormActions className="crm-source-review-actions flex flex-wrap gap-2">
            <button
              type="submit"
              className="campaign-workspace-action campaign-primary"
              disabled={
                busy ||
                !action ||
                !reason.trim() ||
                (needsCampaign && !campaign) ||
                (action === "link" && !target)
              }
            >
              {busy
                ? u("Saving…")
                : unknown
                  ? u("Retry original request")
                  : u("Save review")}
            </button>
            {unknown && (
              <button
                type="button"
                className="campaign-workspace-action"
                disabled={busy}
                onClick={() => void checkResult()}
              >
                {u("Check saved result")}
              </button>
            )}
            <button
              type="button"
              className="campaign-workspace-action"
              disabled={busy || unknown}
              onClick={() => {
                if (dirty) setOpen(false);
                else reset();
              }}
            >
              {u("Keep draft & close")}
            </button>
          </AdminFormActions>
        </AdminForm>
      )}
      {!!row.history.length && (
        <details>
          <summary>
            {u("Decision history ({count})", { count: row.history.length })}
          </summary>
          {row.history.map((h: any) => (
            <div key={h.requestId} className="campaign-review-history-item">
              <p>
                {u(
                  promotionReviewActions.find((a) => a.value === h.action)
                    ?.label || (h.action === "create" ? "Create promotion entry and link" : h.action),
                )}{" "}
                · {h.actor} ·{" "}
                {new Date(h.at).toLocaleString(campaignUiLocale(lang), {

                })}{" "}

              </p>
              <p>{h.after.reason}</p>
              {h.after.campaignName && <p>{u("Campaign:")} {h.after.campaignName}</p>}
              <p>
                {u("Original:")} <code>{h.after.rawPromotionLinkId}</code>{" "}
                {u("· Verified entry:")}{" "}
                <code>{h.after.linkId || u("None")}</code>{" "}
                {u("· This customer only")}
              </p>
            </div>
          ))}
        </details>
      )}
    </article>
  );
}
