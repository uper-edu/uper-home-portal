import { crmId } from "../../utils/crmIndonesian";
import { useEffect, useRef, useState } from "react";
import {
  defaultLeadFilters,
  dimensions,
  filterDimensions,
  taskOptions,
  type Dimension,
  type LeadFilters,
} from "../../utils/crmLeadFilters";
import "./crm-lead-filters.css";
import type { CustomerView } from "../../utils/crmWorkspace";
type SingleField = "owner" | "task" | "sort" | "columns";
interface Props {
  value: LeadFilters;
  onChange: (value: LeadFilters) => void;
  lang: "zh" | "en" | "id";
  scope: string;
  isLight?: boolean;
  owners: Array<{
    id: string;
    label: string;
  }>;
  count: number;
  loading: boolean;
  timezone: string;
  viewMode: CustomerView;
  onViewMode: (mode: CustomerView) => void;
}
export function CrmLeadFilters({
  value: f,
  onChange,
  lang,
  scope,
  isLight = true,
  owners,
  count,
  loading,
  timezone,
  viewMode,
  onViewMode,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<Dimension | SingleField | null>(null);
  const [ownerSearch, setOwnerSearch] = useState("");
  const activeField = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const update = (patch: Partial<LeadFilters>) => onChange({ ...f, ...patch });
  const dimLabel = (k: Dimension) =>
    t(filterDimensions[k].en, filterDimensions[k].zh);
  const optionLabel = (k: Dimension, v: string) => {
    const o = filterDimensions[k].options.find((o) => o[0] === v);
    return o ? t(o[1], o[2]) : v;
  };
  const toggle = (k: Dimension, v: string) =>
    update({
      [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v],
    });
  const selectedDimensions = dimensions.filter((k) => f[k].length).length;
  const reset = () => {
    onChange(defaultLeadFilters(scope));
    setOpen(null);
    setOwnerSearch("");
  };
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!activeField.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", dismiss);
    const popup = activeField.current?.querySelector(".crm-filter-popover");
    const initialFocus =
      popup?.querySelector<HTMLElement>("input") ??
      popup?.querySelector<HTMLElement>(
        '[role="option"][aria-selected="true"]',
      ) ??
      popup?.querySelector<HTMLElement>('[role="option"]');
    initialFocus?.focus();
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  useEffect(() => setOwnerSearch(""), [lang]);
  const singleSelect = ({
    id,
    label,
    accessibleLabel = label,
    title,
    value,
    options,
    onSelect,
  }: {
    id: SingleField;
    label: string;
    accessibleLabel?: string;
    title?: string;
    value: string;
    options: Array<{
      value: string;
      label: string;
    }>;
    onSelect: (value: string) => void;
  }) => {
    const isOpen = open === id;
    const selected = options.find((option) => option.value === value);
    const visibleOptions =
      id === "owner"
        ? options.filter((option) =>
            option.label
              .toLocaleLowerCase()
              .includes(ownerSearch.trim().toLocaleLowerCase()),
          )
        : options;
    const close = () => {
      setOpen(null);
      trigger.current?.focus();
    };
    return (
      <div
        className={"crm-filter-single crm-filter-" + id}
        ref={isOpen ? activeField : undefined}
        onBlur={(event) => {
          if (
            isOpen &&
            event.relatedTarget &&
            !event.currentTarget.contains(event.relatedTarget as Node)
          )
            setOpen(null);
        }}
        onKeyDown={(event) => {
          if (!isOpen) return;
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
          }
          const inSearch = event.target instanceof HTMLInputElement;
          if (
            !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) ||
            (inSearch && ["Home", "End"].includes(event.key))
          )
            return;
          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              '[role="option"]',
            ),
          );
          if (!items.length) return;
          event.preventDefault();
          const current = items.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? items.length - 1
                : event.key === "ArrowDown"
                  ? (current + 1) % items.length
                  : (current <= 0 ? items.length : current) - 1;
          items[next].focus();
        }}
      >
        <button
          ref={isOpen ? trigger : undefined}
          type="button"
          className="crm-filter-dimension-button"
          aria-label={
            accessibleLabel +
            t(": ", "：") +
            (selected?.label ?? t("Unavailable option", "选项已失效"))
          }
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={"lead-options-" + id}
          title={title}
          onClick={() => {
            setOpen(isOpen ? null : id);
            setOwnerSearch("");
          }}
          onKeyDown={(event) => {
            if (!isOpen && ["ArrowDown", "ArrowUp"].includes(event.key)) {
              event.preventDefault();
              setOpen(id);
              setOwnerSearch("");
            }
          }}
        >
          <span className="crm-filter-dimension-name">{label}</span>
          <span className="crm-filter-dimension-value" title={selected?.label}>
            {selected?.label ?? t("Unavailable option", "选项已失效")}
          </span>
          <span aria-hidden="true">⌄</span>
        </button>
        {isOpen && (
          <div
            id={"lead-options-" + id}
            role="dialog"
            aria-label={accessibleLabel + t(" options", "选项")}
            className="crm-filter-popover"
          >
            {id === "owner" && (
              <input
                type="search"
                className="crm-filter-option-search"
                aria-label={t("Search ", "搜索") + accessibleLabel}
                placeholder={t("Find options…", "搜索选项…")}
                value={ownerSearch}
                onChange={(event) => setOwnerSearch(event.target.value)}
              />
            )}
            <div
              className="crm-filter-options"
              role="listbox"
              aria-label={accessibleLabel}
            >
              {visibleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className="crm-filter-option crm-filter-single-option"
                  onClick={() => {
                    onSelect(option.value);
                    close();
                  }}
                >
                  <span
                    className="crm-filter-selection-mark"
                    aria-hidden="true"
                  >
                    {option.value === value ? "✓" : ""}
                  </span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
            {!visibleOptions.length && (
              <p className="crm-filter-no-options" role="status">
                {t("No matching options", "无匹配选项")}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="crm-filter-area" data-theme={isLight ? "light" : "dark"}>
      <section
        aria-label={t("Lead filters", "客户筛选")}
        className="crm-filter-panel"
      >
        <div className="crm-filter-main">
          <input
            type="search"
            maxLength={200}
            className="crm-filter-search"
            aria-label={t("Search customers", "搜索客户")}
            placeholder={t(
              "Name, phone, email or lead number…",
              "姓名、电话、邮箱或业务编号…",
            )}
            value={f.search}
            onChange={(e) => update({ search: e.target.value })}
          />
          {singleSelect({
            id: "owner",
            label: t("Owner", "负责人"),
            value: f.ownership === "person" ? "person:" + f.owner : f.ownership,
            options: [
              {
                value: "all",
                label:
                  scope === "all"
                    ? t("All owners", "全部负责人")
                    : t("All accessible leads", "全部可见客户"),
              },
              { value: "mine", label: t("Owned by me", "我负责的") },
              { value: "unassigned", label: t("Unassigned", "未分配") },
              ...(scope !== "own"
                ? owners.map((o) => ({
                    value: "person:" + o.id,
                    label: o.label,
                  }))
                : []),
            ],
            onSelect: (value) =>
              update(
                value.startsWith("person:")
                  ? { ownership: "person", owner: value.slice(7) }
                  : { ownership: value as LeadFilters["ownership"], owner: "" },
              ),
          })}
          {singleSelect({
            id: "task",
            label: t("Tasks", "跟进"),
            accessibleLabel: t("Follow-up tasks", "跟进任务"),
            title: t("Dates use ", "日期采用 ") + timezone,
            value: f.task,
            options: taskOptions.map((o) => ({
              value: o[0],
              label: t(o[1], o[2]),
            })),
            onSelect: (value) => update({ task: value }),
          })}
          <label className="crm-filter-unread">
            <input
              type="checkbox"
              checked={f.unread}
              onChange={(e) => update({ unread: e.target.checked })}
            />
            {t("Unread by me", "仅我未读")}
          </label>
          <button
            type="button"
            className="crm-filter-more"
            aria-expanded={expanded}
            aria-controls="lead-more-filters"
            onClick={() => {
              setExpanded(!expanded);
              setOpen(null);
            }}
          >
            {t("More filters", "更多筛选")}
            {selectedDimensions ? ` (${selectedDimensions})` : ""}
            <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
          </button>
          <button type="button" className="crm-filter-reset" onClick={reset}>
            {t("Reset filters", "重置筛选")}
          </button>
        </div>

        {expanded && (
          <div id="lead-more-filters" className="crm-filter-dimensions">
            {dimensions.map((k) => {
              const isOpen = open === k;
              const selected = f[k];
              const summary =
                selected.length === 0
                  ? t("Any", "不限")
                  : selected.length === 1
                    ? optionLabel(k, selected[0])
                    : t(
                        `${selected.length} selected`,
                        `已选 ${selected.length} 项`,
                      );
              const options = filterDimensions[k].options;
              return (
                <div
                  key={k}
                  className="crm-filter-dimension"
                  ref={isOpen ? activeField : undefined}
                  onBlur={(e) => {
                    if (
                      isOpen &&
                      e.relatedTarget &&
                      !e.currentTarget.contains(e.relatedTarget as Node)
                    )
                      setOpen(null);
                  }}
                  onKeyDown={(e) => {
                    if (isOpen && e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpen(null);
                      trigger.current?.focus();
                    }
                  }}
                >
                  <button
                    ref={isOpen ? trigger : undefined}
                    type="button"
                    className={
                      "crm-filter-dimension-button" +
                      (selected.length ? " is-selected" : "")
                    }
                    aria-label={dimLabel(k) + t(": ", "：") + summary}
                    aria-haspopup="dialog"
                    aria-expanded={isOpen}
                    aria-controls={"lead-options-" + k}
                    onClick={() => {
                      setOpen(isOpen ? null : k);
                      setOwnerSearch("");
                    }}
                  >
                    <span className="crm-filter-dimension-name">
                      {dimLabel(k)}
                    </span>
                    <span
                      className="crm-filter-dimension-value"
                      title={selected
                        .map((v) => optionLabel(k, v))
                        .join(t(", ", "、"))}
                    >
                      {summary}
                    </span>
                    <span aria-hidden="true">⌄</span>
                  </button>
                  {isOpen && (
                    <div
                      id={"lead-options-" + k}
                      role="dialog"
                      aria-label={dimLabel(k) + t(" options", "选项")}
                      className="crm-filter-popover"
                    >
                      <div className="crm-filter-options">
                        {options.map((o) => (
                          <label key={o[0]} className="crm-filter-option">
                            <input
                              type="checkbox"
                              checked={selected.includes(o[0])}
                              onChange={() => toggle(k, o[0])}
                            />
                            <span>{t(o[1], o[2])}</span>
                          </label>
                        ))}
                      </div>
                      <div className="crm-filter-popover-footer">
                        <span>
                          {t(
                            `${selected.length} selected`,
                            `已选 ${selected.length} 项`,
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(null);
                            trigger.current?.focus();
                          }}
                        >
                          {t("Done", "完成")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!expanded && selectedDimensions > 0 && (
          <div
            aria-label={t("Applied additional filters", "已选附加条件")}
            className="crm-filter-chips"
          >
            {dimensions.flatMap((k) =>
              f[k].map((v) => (
                <button
                  type="button"
                  key={k + ":" + v}
                  className="crm-filter-chip"
                  aria-label={
                    t("Remove ", "移除") +
                    dimLabel(k) +
                    t(": ", "：") +
                    optionLabel(k, v)
                  }
                  onClick={() => toggle(k, v)}
                >
                  {dimLabel(k)}
                  {t(": ", "：")}
                  {optionLabel(k, v)} <span aria-hidden="true">×</span>
                </button>
              )),
            )}
          </div>
        )}
      </section>

      <div
        aria-label={t("Customer list controls", "客户列表工具栏")}
        className="crm-filter-results"
      >
        <p role="status" aria-live="polite">
          {loading
            ? t("Updating results…", "正在更新结果…")
            : lang === "id"
              ? `${count} pelanggan cocok`
              : t(
                  `${count} ${count === 1 ? "customer matches" : "customers match"}`,
                  `匹配 ${count} 位客户`,
                )}
        </p>
        {singleSelect({
          id: "sort",
          label: t("Sort", "排序"),
          value: f.sort,
          options: [
            { value: "newest", label: t("Newest customer", "最近登记") },
            { value: "activity", label: t("Latest activity", "最新动态") },
            {
              value: "deadline",
              label: t("Earliest deadline", "截止时间最早"),
            },
          ],
          onSelect: (value) => update({ sort: value }),
        })}
        {singleSelect({
          id: "columns",
          label: t("View", "视图"),
          value: viewMode,
          options: [
            { value: "worklist", label: t("Worklist", "工作列表") },
            { value: "table", label: t("Data table", "字段表") },
          ],
          onSelect: (value) => onViewMode(value as CustomerView),
        })}
      </div>
    </div>
  );
}
