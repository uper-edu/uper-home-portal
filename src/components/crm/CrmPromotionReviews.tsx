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
import {
  PROMOTION_SOURCES,
  PROMOTION_MEDIA,
  PROMOTION_MEDIUM_LABELS,
  PROMOTION_EXPERIENCE,
  PROMOTION_EXPERIENCE_LABEL,
  campaignPromotionUrl,
} from "../../utils/campaignPromotion";

export function CrmPromotionReviews({
  isLight,
  onChanged,
  onLead,
  reloadToken,
  onCount,
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
  reloadToken: number;
  onCount: (count: number | null) => void;
  onStateChange?: (state: { dirty: boolean; busy: boolean }) => void;
}) {
  const u = campaignUi(lang);
  const [rows, setRows] = useState<any[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [history, setHistory] = useState(false),
    [receipt, setReceipt] = useState<any>(null);
  async function load() {
    setLoading(true);
    setError("");
    onCount(null);
    try {
      const r = await fetch("/api/crm/campaigns/sources/promotions");
      if (!r.ok) throw Error();
      const data = await r.json();
      setRows(data.reviews);
      onCount(
        data.reviews.filter((r: any) =>
          ["pending", "deferred"].includes(r.status),
        ).length,
      );
    } catch {
      onCount(null);
      setError("Promotion review data unavailable. Retry.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [reloadToken]);
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
      aria-label={u("Promotion link verification")}
      className="space-y-3"
    >
      <div className="flex flex-wrap gap-3 items-center">
        <h2 className="font-bold">{u("Unverified promotion entries")}</h2>
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
      <p>
        {u(
          "Known campaign, unverified or mismatched p. Review one customer at a time; missing p on a legacy campaign-only link is not an error. Unknown campaigns must be verified in Unknown campaign codes first.",
        )}
      </p>
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
      <details className="campaign-review-action-guide">
        <summary>{u("Actions and typical scenarios")}</summary>
        {promotionReviewActions.map((a) => (
          <div key={a.value}>
            <h3>{u(a.label)}</h3>
            <p>
              <strong>{u("Typical scenario:")}</strong> {u(a.scenario)}
            </p>
            <p>
              <strong>{u("Result:")}</strong> {u(a.effect)}
            </p>
          </div>
        ))}
      </details>
      <p className="campaign-hint">
        {u(
          "All actions apply only to the selected customer. No batch approval, future alias, task completion or notification replay.",
        )}
      </p>
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
            ? u("Promotion entry manually verified.")
            : receipt.status === "deferred"
              ? u("Left unconfirmed; remains in Needs review.")
              : u(
                  "Promotion attribution marked invalid; customer retained.",
                )}{" "}
          {receipt.createdLink ? u("New promotion entry created. ") : ""}
          {u(
            "Original parameters retained; future incorrect links are not approved.",
          )}
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
            isLight={isLight}
            onLead={onLead}
            onStateChange={(state) => report(row.leadId, state)}
            onSaved={(result) => {
              setReceipt({ ...result, name: row.name });
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
  isLight,
  onLead,
  onSaved,
  onStateChange,
  lang,
}: {
  lang: "en" | "id" | "zh";
  row: any;
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
    [entry, setEntry] = useState({
      name: "",
      source: "",
      medium: "",
      language: "",
      experience: PROMOTION_EXPERIENCE,
    }),
    [custom, setCustom] = useState(false),
    [busy, setBusy] = useState(false),
    [unknown, setUnknown] = useState(false),
    [error, setError] = useState("");
  const pending = useRef<any>(null),
    baseline = useRef<any>(null),
    trigger = useRef<HTMLButtonElement>(null),
    saving = useRef(false);
  const endpoint =
    "/api/crm/campaigns/sources/promotions/" + encodeURIComponent(row.leadId);
  const choice = promotionReviewActions.find((a) => a.value === action);
  const dirty = Boolean(
    action ||
    reason ||
    target ||
    entry.name ||
    entry.source ||
    entry.medium ||
    entry.language,
  );
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
    setCustom(false);
    setAction("");
    setTarget("");
    setReason("");
    setEntry({
      name: "",
      source: "",
      medium: "",
      language: "",
      experience: PROMOTION_EXPERIENCE,
    });
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
      linkId: target,
      entry: { ...entry },
      reason,
      ...(baseline.current || {
        revision: row.revision,
        campaignId: row.campaignId,
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
            ? u("Manually verified")
            : row.status === "deferred"
              ? u("Left unconfirmed")
              : row.status === "invalid"
                ? u("Invalid promotion attribution")
                : u("Needs review")}
        </span>
      </header>
      <p>
        {u("Campaign:")} {row.campaignName} · <code>{row.rawCode}</code>
      </p>
      <p>
        {u("Original p:")}{" "}
        <code className="break-all">{row.rawPromotionLinkId}</code>
      </p>
      {row.resolution && (
        <p>
          {u("Latest decision:")} {row.resolution.reason} ·{" "}
          {row.resolution.actor} ·{" "}
          {new Date(row.resolution.at).toLocaleString(campaignUiLocale(lang), {
            timeZone: "Asia/Jakarta",
          })}{" "}
          {u("(Asia/Jakarta)")}
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
      {row.resolution?.snapshot && (
        <p className="campaign-hint">
          {u("Verified promotion link:")}{" "}
          <a
            className="underline break-all"
            href={campaignPromotionUrl(
              row.campaignCode,
              row.resolution.snapshot,
              window.location.origin,
            )}
            target="_blank"
            rel="noreferrer"
          >
            {campaignPromotionUrl(
              row.campaignCode,
              row.resolution.snapshot,
              window.location.origin,
            )}
          </a>
        </p>
      )}
      <button
        type="button"
        ref={trigger}
        className="campaign-workspace-action"
        disabled={busy}
        aria-expanded={open}
        aria-controls={"promotion-review-" + row.leadId}
        onClick={() => {
          if (!open && !dirty)
            baseline.current = {
              revision: row.revision,
              campaignId: row.campaignId,
              rawCode: row.rawCode,
              rawPromotionLinkId: row.rawPromotionLinkId,
            };
          setOpen((v) => !v);
        }}
      >
        {row.revision ? u("Review again") : u("Review promotion entry")}{" "}
        <span aria-hidden="true">{open ? "⌃" : "⌄"}</span>
      </button>
      {open && (
        <form
          id={"promotion-review-" + row.leadId}
          onSubmit={save}
          className="campaign-source-review border rounded-xl p-4 space-y-3"
          aria-label={u("Review promotion entry for {name}", {
            name: row.name,
          })}
        >
          <CampaignSourceEvidence
            lang={lang}
            source={{
              ...row,
              promotionIssue: true,
              leads: [
                {
                  id: row.leadId,
                  name: row.name,
                  rawCode: row.rawCode,
                  evidence: row.evidence,
                },
              ],
            }}
            onLead={onLead}
          />
          <h3 className="font-bold">
            {u("Review decision · this customer only")}
          </h3>
          {error && (
            <CrmSaveFeedback lang={lang} state={unknown ? "unknown" : "error"}>
              {campaignUiError(lang, error)}
            </CrmSaveFeedback>
          )}
          <fieldset disabled={busy || unknown} className="space-y-3">
            <CrmSingleSelect
              label={u("Review action")}
              value={action}
              options={[
                { value: "", label: u("Choose an action"), disabled: true },
                ...promotionReviewActions.map((a) => ({
                  value: a.value,
                  label: u(a.label),
                })),
              ]}
              onChange={setAction}
              lang={lang}
              isLight={isLight}
            />
            {choice && (
              <div className="campaign-review-action-context">
                <p>
                  <strong>{u("Typical scenario:")}</strong> {u(choice.scenario)}
                </p>
                <p>
                  <strong>{u("What this action does:")}</strong>{" "}
                  {u(choice.effect)}
                </p>
              </div>
            )}
            {action === "link" && (
              <CrmSingleSelect
                label={u("Existing promotion entry")}
                searchable
                value={target}
                options={[
                  {
                    value: "",
                    label: u("Choose an entry from this campaign"),
                    disabled: true,
                  },
                  ...row.links.map((l: any) => ({
                    value: l.id,
                    label:
                      l.name +
                      " · " +
                      l.source +
                      " / " +
                      u(PROMOTION_MEDIUM_LABELS[l.medium] || l.medium) +
                      " · " +
                      u(
                        (
                          {
                            en: "English",
                            id: "Bahasa Indonesia",
                            zh: "Chinese",
                          } as Record<string, string>
                        )[l.language] || l.language,
                      ),
                  })),
                ]}
                onChange={setTarget}
                lang={lang}
                isLight={isLight}
              />
            )}
            {action === "link" && !row.links.length && (
              <p>
                {u(
                  "This campaign has no saved promotion entries. Create one only if the placement is supported by evidence.",
                )}
              </p>
            )}
            {action === "create" && (
              <div className="campaign-fields-grid">
                <label className="campaign-field">
                  <span>{u("Entry name · optional")}</span>
                  <input
                    maxLength={120}
                    value={entry.name}
                    onChange={(e) =>
                      setEntry({ ...entry, name: e.target.value })
                    }
                  />
                </label>
                <div className="campaign-field">
                  <span>{u("Source *")}</span>
                  <CrmSingleSelect
                    label={u("New entry source")}
                    value={custom ? "custom" : entry.source}
                    options={[
                      {
                        value: "",
                        label: u("Choose a source"),
                        disabled: true,
                      },
                      ...PROMOTION_SOURCES.map((value) => ({
                        value,
                        label: value,
                      })),
                      {
                        value: "custom",
                        label: u("Other platform / institution"),
                      },
                    ]}
                    onChange={(v) => {
                      setCustom(v === "custom");
                      setEntry({ ...entry, source: v === "custom" ? "" : v });
                    }}
                    lang={lang}
                    isLight={isLight}
                  />
                  {custom && (
                    <label>
                      {u("Source code *")}
                      <input
                        required
                        maxLength={80}
                        pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}"
                        value={entry.source}
                        onChange={(e) =>
                          setEntry({ ...entry, source: e.target.value })
                        }
                      />
                    </label>
                  )}
                </div>
                <CrmSingleSelect
                  label={u("New entry medium")}
                  value={entry.medium}
                  options={[
                    { value: "", label: u("Choose a medium"), disabled: true },
                    ...PROMOTION_MEDIA.map((value) => ({
                      value,
                      label: u(PROMOTION_MEDIUM_LABELS[value]),
                    })),
                  ]}
                  onChange={(medium) => setEntry({ ...entry, medium })}
                  lang={lang}
                  isLight={isLight}
                />
                <CrmSingleSelect
                  label={u("New entry customer language")}
                  value={entry.language}
                  options={[
                    {
                      value: "",
                      label: u("Choose a customer language"),
                      disabled: true,
                    },
                    { value: "en", label: u("English") },
                    { value: "id", label: u("Bahasa Indonesia") },
                    { value: "zh", label: u("Chinese") },
                  ]}
                  onChange={(language) => setEntry({ ...entry, language })}
                  lang={lang}
                  isLight={isLight}
                />
                <p>
                  {u("Entry experience:")} {u(PROMOTION_EXPERIENCE_LABEL)}
                </p>
              </div>
            )}
            <label className="campaign-field">
              <span>{u("Review reason / evidence *")}</span>
              <textarea
                required
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </fieldset>
          <p className="campaign-hint">
            {u(
              "Applies to {name} only. Original c/p and first-touch fields stay unchanged. No future alias, campaign move, task completion or notification replay.",
              { name: row.name },
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="campaign-workspace-action campaign-primary"
              disabled={
                busy ||
                !action ||
                !reason.trim() ||
                (action === "link" && !target) ||
                (action === "create" &&
                  (!entry.source || !entry.medium || !entry.language))
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
          </div>
        </form>
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
                    ?.label || h.action,
                )}{" "}
                · {h.actor} ·{" "}
                {new Date(h.at).toLocaleString(campaignUiLocale(lang), {
                  timeZone: "Asia/Jakarta",
                })}{" "}
                {u("(Asia/Jakarta)")}
              </p>
              <p>{h.after.reason}</p>
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
