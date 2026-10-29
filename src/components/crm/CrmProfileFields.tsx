import {CrmFormSection} from './CrmFormLayout';
import {AdminFormActions} from '../AdminFormLayout';
import { useCrmUiText, useCrmUiLanguage } from "./CrmUiLanguage";
import { CrmOperationLayer } from "./CrmOperationLayer";
import { CrmDiscardDialog } from "./CrmDetailWorkspace";
import { AdminField, AdminRequiredNote } from "../AdminForm";
import { CrmProfileSaveResult } from "./CrmProfileSaveResult";
import {
  sameProfileValue,
  compatibleProfileValue,
} from "../../utils/crmFieldValues";
import { Fragment, useState, useRef, useId } from "react";
import { Plus, ChevronDown, Pencil } from "lucide-react";
import { createPortal } from "react-dom";
import {
  profileFields,
  profileSourceLabels,
  manualProfileFields,
  validateProfileUpdates,
} from "../../utils/crmDynamicProfile";
import { budgetPresentation } from "../../utils/crmLeadPresentation";
import { CrmEvidenceAction } from "./CrmEvidenceAction";
import {
  fieldEvidenceDetails,
  linkedProfileEvidence,
  profileChangeReason,
  visibleProfileNeedsGroups,
} from "../../utils/crmProfileEvidence";
import { CrmAiIndicator } from "./CrmAiIndicator";
import { CrmSingleSelect } from "./CrmSingleSelect";
import { crmValue } from "../../utils/crmLanguage";
import {
  formatCrmOperatingTime,
  viewerTimeZone,
} from "../../utils/crmOperatingTime";
export function CrmProfileFields({
  lead,
  updates,
  versions,
  onChange,
  disabled,
  isLight = true,
  timezone = "Asia/Jakarta",
  scope = "needs",
}: any) {
  const lang = useCrmUiLanguage();
  const ui = useCrmUiText();

  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerId = useId(),
    pickerTrigger = useRef<HTMLButtonElement>(null);
  const closePicker = () => {
    setPickerOpen(false);
    requestAnimationFrame(() => pickerTrigger.current?.focus());
  };
  const groups: [string, string[]][] =
    scope === "basic"
      ? [
          ["基本资料", ["fullName", "currentStatus", "parentContact", "city"]],
          ["联系偏好", ["communicationLanguage", "preferredChannel"]],
        ]
      : [
          ["学习目标", ["goal", "goals", "targetHskLevel", "hskExamPlan"]],
          ["学习安排", ["preferredStart", "mode", "availability"]],
          ["预算与顾虑", ["budgetAmount", "concerns"]],
        ];
  const edit = (key: string, value: any) =>
    onChange(
      { ...updates, [key]: value },
      {
        ...versions,
        [key]: versions?.[key] ?? lead.profileFieldMeta?.[key]?.revision ?? 0,
      },
    );
  const remove = (key: string) => {
    const next = { ...updates },
      rev = { ...versions };
    delete next[key];
    delete rev[key];
    onChange(next, rev);
  };
  return (
    <div data-admin-form="" className="crm-profile-batch">
      <div className="crm-profile-picker-heading">
        <button
          ref={pickerTrigger}
          type="button"
          className="crm-work-button"
          disabled={disabled}
          aria-expanded={pickerOpen}
          aria-controls={pickerId}
          onClick={() => setPickerOpen(!pickerOpen)}
        >
          <Plus size={16} aria-hidden="true" />
          {ui(pickerOpen ? "收起字段选择" : "添加修改字段")}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        {Object.keys(updates || {}).length > 0 && (
          <span className="crm-simple-help">
            {ui("已选")}
            {Object.keys(updates).length}
            {ui("项")}
          </span>
        )}
      </div>
      {pickerOpen && (
        <div
          id={pickerId}
          className="crm-profile-picker-panel"
          role="group"
          aria-label={ui("选择修改字段")}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !e.defaultPrevented) {
              e.preventDefault();
              e.stopPropagation();
              closePicker();
            }
          }}
        >
          <div className="crm-profile-picker-groups">
            {groups.map(([heading, keys]) => (
              <fieldset key={heading} className="crm-profile-field-picker">
                <legend>{ui(heading)}</legend>
                <div>
                  {keys.map((key) => (
                    <AdminField key={key}>
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={Object.hasOwn(updates || {}, key)}
                        onChange={(e) =>
                          e.target.checked
                            ? edit(
                                key,
                                lead[key] ??
                                  (["goals", "concerns"].includes(key)
                                    ? []
                                    : ""),
                              )
                            : remove(key)
                        }
                      />
                      {ui(manualProfileFields[key])}
                    </AdminField>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      )}
      <div className="crm-profile-batch-fields">
        {Object.entries(updates || {}).map(([key, value]: any) => {
          const meta = lead.profileFieldMeta?.[key];
          return (
            <section key={key} className="crm-profile-field-editor">
              <div className="crm-profile-field-title">
                <strong>
                  {ui(manualProfileFields[key])}
                  {value !== null && !["goals", "concerns"].includes(key) && (
                    <span className="admin-required-star" aria-hidden="true">
                      {" "}
                      *
                    </span>
                  )}
                </strong>
                <button
                  type="button"
                  className="crm-work-link"
                  disabled={disabled}
                  aria-label={ui("不修改") + (lang==='zh'?'':' ') + ui(manualProfileFields[key])}
                  onClick={() => remove(key)}
                >
                  {ui("移除")}
                </button>
              </div>
              {["mode", "communicationLanguage"].includes(key) ? (
                <CrmSingleSelect
                  label={ui(manualProfileFields[key])}
                  required={value !== null}
                  lang={lang}
                  isLight={isLight}
                  value={value ?? ""}
                  disabled={disabled || value === null}
                  options={(key === "mode"
                    ? [
                        ["Online", "线上"],
                        ["Offline", "线下"],
                        ["Not sure", "尚未确定"],
                      ]
                    : [
                        ["zh", "中文"],
                        ["en", "English"],
                        ["id", "Bahasa Indonesia"],
                        ["unknown", "未指定"],
                      ]
                  ).map(([value, label]) => ({ value, label: ui(label) }))}
                  onChange={(v) => edit(key, v)}
                />
              ) : (
                <span
                  className={
                    key === "budgetAmount"
                      ? "crm-course-budget-input"
                      : undefined
                  }
                >
                  {key === "budgetAmount" && <span aria-hidden="true">Rp</span>}
                  <input
                    aria-label={ui(manualProfileFields[key])}
                    disabled={disabled || value === null}
                    type={key === "budgetAmount" ? "number" : "text"}
                    min={0}
                    step={key === "budgetAmount" ? "any" : undefined}
                    required={
                      value !== null && !["goals", "concerns"].includes(key)
                    }
                    value={
                      value === null
                        ? ""
                        : Array.isArray(value)
                          ? value.join("；")
                          : value
                    }
                    placeholder={
                      ["goals", "concerns"].includes(key)
                        ? ui("多项内容用分号分隔")
                        : undefined
                    }
                    onChange={(e) =>
                      edit(
                        key,
                        key === "budgetAmount"
                          ? e.target.value === ""
                            ? ""
                            : Number(e.target.value)
                          : ["goals", "concerns"].includes(key)
                            ? e.target.value
                                .split(/[；;]/)
                                .map((v) => v.trim())
                                .filter(Boolean)
                            : e.target.value,
                      )
                    }
                  />
                </span>
              )}
              <p className="crm-simple-help">
                {ui("当前值：")}
                {Array.isArray(lead[key])
                  ? lead[key].join("、")
                  : crmValue(lead[key], lang) || ui("未填写")}
              </p>
              <details className="crm-profile-field-source">
                <summary>{ui("原值来源与清空选项")}</summary>
                <p>
                  {ui(
                    profileSourceLabels[meta?.sourceType] ||
                      "既有资料，来源待补充",
                  )}
                  {meta?.effectiveAt
                    ? " · " +
                      formatCrmOperatingTime(meta.effectiveAt, viewerTimeZone())
                    : ""}
                </p>
                <AdminField>
                  <input
                    type="checkbox"
                    disabled={disabled || key === "fullName"}
                    checked={value === null}
                    onChange={(e) =>
                      edit(key, e.target.checked ? null : (lead[key] ?? ""))
                    }
                  />
                  {ui("明确清空此字段")}
                </AdminField>
              </details>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function profileSourceName(type?: string) {
  return type === "ai_customer_text"
    ? "客户对话"
    : type === "ai_sales_text"
      ? "销售记录"
      : profileSourceLabels[type || ""] || "来源未记录";
}

export function CrmCurrentField({
  lead,
  field,
  onEdit,
  disabled,
  timezone,
}: any) {
  const lang = useCrmUiLanguage(),
    ui = useCrmUiText(),
    m = lead.profileFieldMeta?.[field];
  const value = (v: any) =>
    v === null
      ? ui("已明确清空")
      : Array.isArray(v)
        ? v.map((x) => crmValue(x, lang) || x).join("、")
        : field === "communicationLanguage"
          ? ui(
              (
                {
                  zh: "中文",
                  en: "英语",
                  id: "印尼语",
                  unknown: "未确认",
                } as any
              )[v] || String(v ?? ""),
            )
          : field === "budgetAmount"
            ? budgetPresentation({ budgetAmount: v }, lang)?.value ||
              String(v ?? "")
            : crmValue(v, lang) || String(v ?? "");
  const differences = (m?.pendingDifferences || []).filter(
    (d: any) =>
      d.effective !== false &&
      !d.supersededBy &&
      !compatibleProfileValue(field, lead[field], d.value),
  );
  if (
    (lead[field] === undefined ||
      lead[field] === null ||
      lead[field] === "" ||
      (Array.isArray(lead[field]) && !lead[field].length)) &&
    !m
  )
    return null;
  const source = profileSourceName(m?.sourceType);
  return (
    <div className="crm-current-field">
      <dt>
        <span>{ui(manualProfileFields[field] || field)}</span>
        {onEdit && !disabled && (
          <button
            type="button"
            className="crm-work-link"
            aria-label={ui("调整") + (lang==='zh'?'':' ') + ui(manualProfileFields[field] || field)}
            onClick={() => onEdit(field)}
          >
            <Pencil size={13} aria-hidden="true" />
            {ui("调整")}
          </button>
        )}
      </dt>
      <dd>
        <div className="crm-current-field-value">
          {value(lead[field]) || ui("未填写")}
        </div>
        <div className="crm-current-field-source">
          <span>{ui(source)}</span>
          {m?.sourceType?.startsWith("ai_") && <CrmAiIndicator />}
          {m?.effectiveAt && (
            <time dateTime={m.effectiveAt}>
              {formatCrmOperatingTime(m.effectiveAt, viewerTimeZone())}
            </time>
          )}
          {m?.sourceFactIds?.length > 0 && (
            <ProfileSource
              key={lead.id + ":" + field + ":" + m.sourceFactIds.join(",")}
              leadId={lead.id}
              ids={m.sourceFactIds}
              field={field}
            />
          )}
        </div>
        {differences.length > 0 && (
          <details className="crm-profile-difference">
            <summary>
              {ui("有不同记录")} · {differences.length}
            </summary>
            {differences.map((d: any, i: number) => (
              <div key={i}>
                <p>
                  {value(d.value)} ·{" "}
                  {ui(profileSourceLabels[d.sourceType] || "来源未记录")}
                  {d.effectiveAt
                    ? " · " +
                      formatCrmOperatingTime(d.effectiveAt, viewerTimeZone())
                    : " · " + ui("发生时间未注明")}
                </p>
                {d.sourceFactId && (
                  <ProfileSource
                    key={lead.id + ":" + field + ":" + d.sourceFactId}
                    leadId={lead.id}
                    ids={[d.sourceFactId]}
                    field={field}
                  />
                )}
              </div>
            ))}
          </details>
        )}
        {m?.valueState === "correction_pending" && (
          <p className="crm-profile-difference">
            {ui("原依据已有修正，请对照原文")}
          </p>
        )}
      </dd>
    </div>
  );
}
export function CrmProfileEvidence({ lead, timezone }: any) {
  return (
    <dl>
      {Object.keys(profileFields).map((field) => (
        <CrmCurrentField key={field} {...{ lead, field, timezone }} />
      ))}
    </dl>
  );
}
export function CrmProfileEditor({
  lead,
  onSaved,
  onDirty,
  disabled,
  timezone,
  isLight,
  onBusy,
  actionTarget,
  basicTarget,
  contactTarget,
}: any) {
  const lang = useCrmUiLanguage();
  const ui = useCrmUiText();

  const [scope, setScope] = useState("needs"),
    [basisIds, setBasisIds] = useState<string[]>([]),
    [availableFacts, setAvailableFacts] = useState<any[]>([]);
  const openEditor = (nextScope: string, key?: string) => {
    setScope(nextScope);
    if (key) {
      setUpdates({ [key]: lead[key] ?? "" });
      setVersions({ [key]: lead.profileFieldMeta?.[key]?.revision || 0 });
      onDirty?.(true);
    }
    setOpen(true);
  };
  const formRef = useRef<HTMLDivElement>(null);
  const [conflict, setConflict] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [success, setSuccess] = useState(""),
    [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false),
    [updates, setUpdates] = useState<any>({}),
    [versions, setVersions] = useState<any>({}),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [request, setRequest] = useState<any>(null),
    [unknown, setUnknown] = useState(false);
  async function save(query = false) {
    if (busy) return;
    if (!query) {
      try {
        validateProfileUpdates(updates, scope === "basic");
        if (!reason.trim() || !Object.keys(updates).length)
          throw Error("请填写修改内容及信息来源与说明");
      } catch (e) {
        setError((e as Error).message);
        formRef.current?.querySelector<HTMLElement>(":invalid")?.focus();
        return;
      }
    }
    setBusy(true);
    onBusy?.(true);
    setError("");
    setConflict(false);
    setSuccess("");
    setResults([]);
    let body = request;
    let knownFailure = false;
    try {
      if (!query) {
        body = body || {
          requestId: crypto.randomUUID(),
          updates,
          versions,
          reason,
          scope,
          basisFactIds: basisIds,
          occurredAt: null,
        };
        setRequest(body);
      }
      const r = await fetch(
        `/api/crm/leads/${lead.id}/${query ? "operations/" + body.requestId : "profile-fields"}`,
        query
          ? {}
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: AbortSignal.timeout(15000),
            },
      );
      const d = await r.json();
      if (!r.ok) {
        setConflict(r.status === 409);
        if (r.status === 404 && query) {
          setRequest(null);
          setUnknown(false);
          throw Error("未查到保存结果，可以明确重试");
        }
        if (r.status < 500 && !query) {
          knownFailure = true;
          setRequest(null);
          setUnknown(false);
        } else setUnknown(true);
        throw Error(d.error || "保存尚未确认");
      }
      setUnknown(false);
      setUpdates({});
      setVersions({});
      setReason("");
      setBasisIds([]);
      setRequest(null);
      onDirty?.(false);
      setOpen(false);
      setSuccess(
        scope === "needs"
          ? "已保存"
          : "已更新" +
              (d.profileFieldResults || []).filter(
                (r: any) => r.status === "applied",
              ).length +
              "项客户资料，请查看各字段结果。",
      );
      setResults(scope === "needs" ? [] : d.profileFieldResults || []);
      onSaved(d.lead);
    } catch (e) {
      if (!knownFailure && !(e as Error).message.includes("未查到"))
        setUnknown(true);
      setError((e as Error).message + "；输入保留。");
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }
  const close = () =>
    unknown
      ? setError("保存结果尚未确认，请先查询保存结果，输入已保留。")
      : Object.keys(updates).length || reason || basisIds.length
        ? setConfirm(true)
        : setOpen(false);
  const editAction = (kind: string, label: string) =>
    !disabled && (
      <button
        type="button"
        className="crm-work-button crm-profile-edit-action"
        disabled={busy || open}
        onClick={() => openEditor(kind)}
      >
        <Pencil size={16} aria-hidden="true" />
        {ui(label)}
      </button>
    );
  const basicAction = editAction("basic", "编辑基本资料");
  return (
    <section className="crm-current-needs">
      {basicTarget && createPortal(basicAction, basicTarget)}
      {contactTarget &&
        createPortal(
          <CrmContactPreferences
            lead={lead}
            timezone={timezone}
            disabled={disabled || open}
            onEdit={(key: string) => openEditor("basic", key)}
          />,
          contactTarget,
        )}
      <header className="crm-profile-section-heading">
        <h3 id="crm-profile-learning-needs" tabIndex={-1}>
          {ui("学习背景与需求")}
        </h3>
        {editAction("needs", "调整学习需求")}
      </header>
      {success && <p role="status">{success}</p>}
      <CrmProfileSaveResult results={results} />
      <div className="crm-profile-needs-group">
        <dl>
          {lead.reportedLevel && (
            <div>
              <dt>{ui("客户自报水平")}</dt>
              <dd>{crmValue(lead.reportedLevel, lang)}</dd>
            </div>
          )}
          {visibleProfileNeedsGroups(lead).map(({ title, fields: keys }) => (
            <Fragment key={title}>
              {keys.map((field: string) => (
                <CrmCurrentField
                  key={field}
                  {...{ lead, field, disabled: disabled || open, timezone }}
                  onEdit={(key: string) => openEditor("needs", key)}
                />
              ))}
            </Fragment>
          ))}
        </dl>
      </div>
      {open && (
        <CrmOperationLayer
          compose
          title={ui(scope === "basic" ? "编辑基本资料" : "调整学习需求")}
          context={lead.fullName}
          lang={lang}
          isLight={isLight}
          busy={busy}
          onClose={close}
        >
          <div className="crm-editor-compose">
            <div className="crm-editor-scroll" data-admin-stack="" ref={formRef}>
              <AdminRequiredNote lang={lang} />
              <CrmFormSection name="changes" lang={lang}>
              <CrmProfileFields
                scope={scope}
                lead={lead}
                updates={updates}
                versions={versions}
                disabled={busy || unknown}
                isLight={isLight}
                timezone={timezone}
                onChange={(u: any, v: any) => {
                  setUpdates(u);
                  setVersions(v);
                  if (error === "预算必须是有效非负数" && typeof u.budgetAmount === "number" && Number.isFinite(u.budgetAmount) && u.budgetAmount >= 0 && u.budgetAmount <= 1e12) setError("");
                  onDirty?.(
                    Object.keys(u).length > 0 ||
                      !!reason ||
                      basisIds.length > 0,
                  );
                }}
              />
              </CrmFormSection>
              <CrmFormSection name="evidence" lang={lang}>
              <details className="crm-profile-basis">
                <summary
                  onClick={() => {
                    if (!availableFacts.length)
                      void fetch(`/api/crm/leads/${lead.id}/facts`)
                        .then((r) => {
                          if (!r.ok) throw Error("依据暂不可用");
                          return r.json();
                        })
                        .then((d) =>
                          setAvailableFacts(
                            d.events
                              .filter(
                                (e: any) =>
                                  e.original &&
                                  !e.eventId.startsWith("message:") &&
                                  !e.eventId.startsWith("assessment:"),
                              )
                              .slice(0, 30),
                          ),
                        )
                        .catch((e) => setError(e.message));
                  }}
                >
                  {ui("关联已有记录")}
                </summary>
                {availableFacts.map((f: any) => (
                  <AdminField key={f.eventId}>
                    <input
                      type="checkbox"
                      checked={basisIds.includes(f.eventId)}
                      disabled={busy || unknown}
                      onChange={(e) => {
                        setBasisIds(
                          e.target.checked
                            ? [...basisIds, f.eventId]
                            : basisIds.filter((id) => id !== f.eventId),
                        );
                        onDirty?.(
                          e.target.checked ||
                            basisIds.length > 1 ||
                            Object.keys(updates).length > 0 ||
                            !!reason,
                        );
                      }}
                    />
                    {String(f.original).slice(0, 160)}
                  </AdminField>
                ))}
              </details>
              <AdminField>
                {ui("信息来源与说明（必填）")}
                <textarea
                  aria-label={ui("信息来源与说明")}
                  placeholder={ui(
                    "例如：客户在WhatsApp中说明，下个月开始学习，每周六晚上有空。",
                  )}
                  value={reason}
                  disabled={busy || unknown}
                  onChange={(e) => {
                    setReason(e.target.value);
                    onDirty?.(
                      !!e.target.value ||
                        Object.keys(updates).length > 0 ||
                        basisIds.length > 0,
                    );
                  }}
                />
              </AdminField>
              </CrmFormSection>
              {error && <p role="alert">{error}</p>}
            </div>
            <AdminFormActions className="crm-editor-actions">
              <button
                className="crm-work-button"
                disabled={busy || unknown}
                onClick={close}
              >
                {ui("取消")}
              </button>
              <button
                className="crm-work-button crm-editor-primary"
                disabled={
                  busy ||
                  (!unknown && (!reason.trim() || !Object.keys(updates).length))
                }
                onClick={() => void save(unknown)}
              >
                {busy
                  ? ui("正在保存…")
                  : unknown
                    ? ui("查询保存结果")
                    : ui("保存")}
              </button>
              {conflict && !unknown && (
                <button
                  onClick={async () => {
                    try {
                      const r = await fetch(`/api/crm/leads/${lead.id}`);
                      const d = await r.json();
                      if (!r.ok) throw Error();
                      const p = d.lead || d;
                      setVersions(
                        Object.fromEntries(
                          Object.keys(updates).map((k) => [
                            k,
                            p.profileFieldMeta?.[k]?.revision || 0,
                          ]),
                        ),
                      );
                      setError(
                        "版本已读取，请对照当前来源及不同记录后再保存。",
                      );
                      onSaved(p);
                    } catch {
                      setError("最新资料暂不可用，输入保留。");
                    }
                  }}
                >
                  {ui("加载最新资料，保留输入")}
                </button>
              )}
            </AdminFormActions>
          </div>
          {confirm && (
            <CrmDiscardDialog
              isLight={isLight}
              title={ui("放弃未保存的资料修改？")}
              description={ui("已保存资料保持不变。")}
              keepLabel={ui("继续编辑")}
              discardLabel={ui("放弃修改")}
              onKeep={() => setConfirm(false)}
              onDiscard={() => {
                if (unknown) return;
                setOpen(false);
                setConfirm(false);
                setUpdates({});
                setVersions({});
                setReason("");
                setBasisIds([]);
                onDirty?.(false);
              }}
            />
          )}
        </CrmOperationLayer>
      )}
    </section>
  );
}

export function CrmProfileSourceContent({
  data,
  field,
  fields = [field],
}: {
  data: any[];
  field: string;
  fields?: string[];
}) {
  const lang = useCrmUiLanguage(),
    ui = useCrmUiText();
  const show = (value: any, key = field): string =>
    Array.isArray(value)
      ? value.map((item) => crmValue(item, lang) || item).join("、")
      : value == null
        ? ui("未填写")
        : key === "budgetAmount"
          ? budgetPresentation({ budgetAmount: value }, lang)?.value ||
            String(value)
          : crmValue(value, lang) || String(value);
  // Only deduplicate a derived observation when its explicit linked change covers that value.
  const focused = data
    .flatMap((event) => {
      const entries = fields
        .flatMap((key) =>
          fieldEvidenceDetails([event], key).map((entry) => {
            const observations = entry.observations.filter(
              (observation: any) =>
                !data.some(
                  (other) =>
                    other.payload?.basisFactIds?.includes(event.eventId) &&
                    other.payload?.changes?.some(
                      (change: any) =>
                        change.field === key &&
                        sameProfileValue(
                          key,
                          change.applied === false
                            ? change.observation
                            : change.after,
                          observation.value,
                        ),
                    ),
                ),
            );
            const linked = data
              .filter(
                (other) =>
                  other.eventId === event.eventId ||
                  event.payload?.basisFactIds?.includes(other.eventId),
              )
              .flatMap((other) => other.payload?.observations || []);
            return { ...entry, field: key, observations, linked };
          }),
        )
        .filter(
          (entry) =>
            entry.hasAnswer ||
            entry.changes.length ||
            entry.observations.length,
        );
      return entries.length ? [{ event, entries }] : [];
    })
    .sort(
      (a, b) =>
        Number(b.entries.some((entry) => entry.hasAnswer)) -
        Number(a.entries.some((entry) => entry.hasAnswer)),
    );
  const shownQuotes = new Set<string>();
  const stamp = (event: any) => (
    <small>
      {event.actor === "ai" ? ui("AI整理") : event.actor} ·{" "}
      {event.recordedAt
        ? formatCrmOperatingTime(event.recordedAt, viewerTimeZone())
        : ui("记录时间未注明")}
    </small>
  );
  const reasonText = (reason: string) =>
    [
      "明确的当前信息；按来源时间和字段版本采用",
      "销售直接编辑，明确采用该值",
      "采用客户问卷原始答案",
    ].includes(reason)
      ? ""
      : reason;
  const blocks = focused.map(({ event, entries }) => {
    const quotes = new Set<string>();
    const decisions: { field: string; status: string; reason: string }[] = [];
    const values = entries.map((entry) => {
      const {
        field: key,
        hasAnswer,
        answer,
        changes,
        observations,
        linked,
      } = entry;
      const label = ui(manualProfileFields[key] || key);
      const rows: any[] = [
        ...changes.map((change: any) => ({
          value: change.applied === false ? change.observation : change.after,
          before: change.before,
          status:
            change.applied === true
              ? "当次已采用"
              : change.applied === false
                ? "当次未采用"
                : "采用状态未记录",
          reason: profileChangeReason(change, entry.event, linked),
          quotes: linked
            .filter(
              (item: any) =>
                item.kind === "field" &&
                item.field === key &&
                sameProfileValue(
                  key,
                  item.value,
                  change.applied === false ? change.observation : change.after,
                ),
            )
            .map((item: any) => item.quote)
            .filter(Boolean),
        })),
        ...observations
          .filter(
            (observation: any) =>
              !changes.some((change: any) =>
                sameProfileValue(
                  key,
                  change.applied === false ? change.observation : change.after,
                  observation.value,
                ),
              ),
          )
          .map((observation: any) => ({
            value: observation.value,
            status:
              observation.decision === "apply"
                ? "当次已采用"
                : observation.decision === "difference"
                  ? "当次未采用"
                  : "保留为依据",
            reason: observation.reason || "",
            quotes: observation.quote ? [observation.quote] : [],
          })),
      ];
      const answerText = hasAnswer ? show(answer, key) : null;
      if (typeof answer === "string" && answer === answerText)
        shownQuotes.add(answer);
      return (
        <Fragment key={key}>
          {hasAnswer && (
            <p>
              <strong>
                {fields.length > 1 ? label + " · " : ""}
                {ui("原始答案")}：
              </strong>
              {answerText}
            </p>
          )}
          {rows.map((row, index) => {
            const before = row.before;
            const hasBefore =
              before != null &&
              before !== "" &&
              (!Array.isArray(before) || before.length > 0);
            const changed =
              hasBefore && !sameProfileValue(key, before, row.value);
            const valueText = show(row.value, key);
            row.quotes.forEach((quote: string) => {
              if (quote !== answerText) quotes.add(quote);
            });
            decisions.push({
              field: label,
              status: row.status,
              reason: reasonText(row.reason),
            });
            // Exact repeats add no business information. Distinct old values and conflicting values remain visible.
            return changed ||
              (valueText !== answerText && !row.quotes.includes(valueText)) ? (
              <p key={index}>
                <strong>{label}：</strong>
                {changed && <>{show(before, key)} → </>}
                {valueText}
              </p>
            ) : null;
          })}
        </Fragment>
      );
    });
    quotes.forEach((quote) => shownQuotes.add(quote));
    const uniqueDecisions = decisions.filter(
      (item, index) =>
        decisions.findIndex(
          (other) =>
            other.status === item.status && other.reason === item.reason,
        ) === index,
    );
    return (
      <article key={event.eventId}>
        {values}
        {Array.from(quotes).map((quote) => (
          <blockquote key={quote}>{quote}</blockquote>
        ))}
        {uniqueDecisions.map((item, index) => (
          <p key={index} className="crm-profile-adoption">
            {uniqueDecisions.length > 1 && (
              <>
                {decisions
                  .filter(
                    (other) =>
                      other.status === item.status &&
                      other.reason === item.reason,
                  )
                  .map((other) => other.field)
                  .filter((value, index, all) => all.indexOf(value) === index)
                  .join("、")}
                ：{" "}
              </>
            )}
            {ui(item.status)}
            {item.reason && <> · {ui(item.reason)}</>}
          </p>
        ))}
        {stamp(event)}
      </article>
    );
  });
  // Complete originals stay available. The second layer contains only information not already shown above.
  const extra = data
    .map((event, index) => ({
      event,
      original:
        event.original &&
        !shownQuotes.has(event.original) &&
        !data.slice(0, index).some((other) => other.original === event.original)
          ? event.original
          : null,
      answers: Object.entries(event.payload?.answers || {}).filter(
        ([key, value]) =>
          !fields.includes(key) &&
          Object.hasOwn(manualProfileFields, key) &&
          value != null &&
          value !== "",
      ),
      changes: (event.payload?.changes || []).filter(
        (change: any) => !fields.includes(change.field),
      ),
    }))
    .filter(
      (item) => item.original || item.answers.length || item.changes.length,
    );
  return (
    <>
      <div className="crm-profile-field-evidence">
        {blocks.length ? (
          blocks
        ) : (
          <p>{ui("该依据未单独保存此字段的原始答案，请查看完整原文。")}</p>
        )}
      </div>
      {extra.length > 0 && (
        <details className="crm-profile-full-source">
          <summary>{ui("完整原文与关联记录")}</summary>
          {extra.map(({ event, original, answers, changes }) => (
            <article key={event.eventId}>
              {original && <blockquote>{original}</blockquote>}
              {answers.length > 0 && (
                <dl>
                  {answers.map(([key, value]) => (
                    <div key={key}>
                      <dt>{ui(manualProfileFields[key])}</dt>
                      <dd>{show(value, key)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {changes.map((change: any, index: number) => (
                <p key={index}>
                  {ui(manualProfileFields[change.field] || change.field)}：
                  {show(change.before, change.field)} →{" "}
                  {show(
                    change.applied === false
                      ? change.observation
                      : change.after,
                    change.field,
                  )}
                </p>
              ))}
              {stamp(event)}
            </article>
          ))}
        </details>
      )}
    </>
  );
}
function ProfileSource({ leadId, ids, field, fields, availableEvents }: any) {
  const ui = useCrmUiText(),
    contentId = useId();
  const [data, setData] = useState<any[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="crm-profile-source">
      <CrmEvidenceAction
        description={
          ui("查看") +
          ui(manualProfileFields[field] || field) +
          ui("的原始依据")
        }
        expanded={data !== null || busy || !!error}
        controls={contentId}
        onClick={async () => {
          if (busy) return;
          if (data) {
            setData(null);
            return;
          }
          setError("");
          setBusy(true);
          try {
            let events = availableEvents;
            if (!events) {
              const response = await fetch(
                `/api/crm/leads/${encodeURIComponent(leadId)}/facts`,
              );
              if (!response.ok) throw Error("原始依据暂不可用，请重试");
              events = (await response.json()).events;
            }
            if (!Array.isArray(events)) throw Error("原始依据暂不可用，请重试");
            const selected = linkedProfileEvidence(events, ids, leadId);
            if (!selected.length) throw Error("原始依据暂不可用，请重试");
            setData(selected);
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <div
        id={contentId}
        hidden={!data && !busy && !error}
        className={
          data || busy || error ? "crm-profile-source-content" : undefined
        }
      >
        {busy && <p role="status">{ui("正在加载依据…")}</p>}
        {error && <p role="alert">{ui(error)}</p>}
        {data && (
          <CrmProfileSourceContent data={data} field={field} fields={fields} />
        )}
      </div>
    </div>
  );
}

export function CrmContactPreferences({
  lead,
  timezone,
  disabled,
  onEdit,
}: any) {
  if (
    !["communicationLanguage", "preferredChannel"].some(
      (k) => lead[k] || lead.profileFieldMeta?.[k],
    )
  )
    return null;
  return (
    <section className="crm-profile-contact-preferences">
      <dl className="crm-profile-basic-fields">
        {["communicationLanguage", "preferredChannel"].map((field) => (
          <CrmCurrentField
            key={field}
            lead={lead}
            field={field}
            timezone={timezone}
            disabled={disabled}
            onEdit={onEdit}
          />
        ))}
      </dl>
    </section>
  );
}
