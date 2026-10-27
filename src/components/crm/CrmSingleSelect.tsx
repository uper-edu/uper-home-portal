import {adminFieldName,useAdminField} from '../AdminForm';
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { crmId } from "../../utils/crmIndonesian";
import type { CrmLanguage } from "../../utils/crmLanguage";
export interface CrmChoice {
  value: string;
  label: string;
  disabled?: boolean;
}
/** Reuses the CRM filter trigger, popover, option and focus styles for editing. */
export function CrmSingleSelect({
  label,
  value,
  options,
  onChange,
  lang,
  isLight,
  searchable = false,
  searchByValue = false,
  disabled = false,
  className = "",
  multiple = false,
  values = [],
  onValuesChange,
  emptyLabel,
  displayValue,
  footer,
  required: ownRequired,
  controlId,
}: {
  required?: boolean;
  controlId?: string;
  label: string;
  value: string;
  options: CrmChoice[];
  onChange: (value: string) => void;
  lang: CrmLanguage;
  isLight: boolean;
  searchable?: boolean;
  searchByValue?: boolean;
  disabled?: boolean;
  className?: string;
  multiple?: boolean;
  values?: string[];
  onValuesChange?: (values: string[]) => void;
  emptyLabel?: string;
  displayValue?: string;
  footer?: (close: () => void) => React.ReactNode;
}) {
  const id = useId(),field=useAdminField(),required=ownRequired??field?.required??false;
  label=adminFieldName(label);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0, width: 240 });
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const selectedValues = multiple ? values : [value];
  const selected = options.find((option) => option.value === value);
  const visible = options.filter(
    (option) =>
      !searchable ||
      (option.label + (searchByValue ? " " + option.value : ""))
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const bounds = trigger.current?.getBoundingClientRect();
      if (!bounds) return;
      const height = popup.current?.offsetHeight || 280;
      const width = Math.min(
        Math.max(bounds.width, 240),
        window.innerWidth - 24,
      );
      setPosition({
        width,
        left: Math.max(
          12,
          Math.min(bounds.left, window.innerWidth - width - 12),
        ),
        top: Math.max(
          8,
          bounds.bottom + height + 5 <= window.innerHeight
            ? bounds.bottom + 5
            : bounds.top - height - 5,
        ),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, query, visible.length]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    (
      popup.current?.querySelector<HTMLElement>("input") ||
      popup.current?.querySelector<HTMLElement>(
        '[aria-selected="true"]:not(:disabled)',
      ) ||
      popup.current?.querySelector<HTMLElement>(
        '[role="option"]:not(:disabled)',
      )
    )?.focus();
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const keyboard = (event: React.KeyboardEvent) => {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (
      !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) ||
      (event.target instanceof HTMLInputElement &&
        ["Home", "End"].includes(event.key))
    )
      return;
    const items = Array.from(
      popup.current?.querySelectorAll<HTMLButtonElement>(
        '[role="option"]:not(:disabled)',
      ) || [],
    );
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? (current + 1) % items.length
            : (current <= 0 ? items.length : current) - 1;
    event.preventDefault();
    items[next]?.focus();
  };
  return (
    <div
      className={"crm-filter-area crm-detail-choice " + className}
      data-theme={isLight ? "light" : "dark"}
    >
      <button
        ref={trigger}
        type="button"
        className="crm-filter-dimension-button"
        id={controlId||field?.id}
        role={required?'combobox':undefined}
        aria-required={required||undefined}
        data-admin-has-value={multiple?values.length>0:!!value}
        aria-label={label}
        aria-description={displayValue}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen(!open);
          setQuery("");
        }}
        onKeyDown={(event) => {
          if (!open && ["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            setQuery("");
            setOpen(true);
          } else keyboard(event);
        }}
      >
        <span className="crm-filter-dimension-value">
          {displayValue ??
            (multiple
              ? values.length
                ? values
                    .map((v) => options.find((o) => o.value === v)?.label || v)
                    .join(lang === "zh" ? "、" : ", ")
                : emptyLabel || t("All", "全部")
              : selected?.label ||
                value ||
                emptyLabel ||
                (value ? t("Unavailable option", "选项已失效") : t("Please select", "请选择")))}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            className="crm-filter-area crm-detail-choice-popup"
            data-theme={isLight ? "light" : "dark"}
            style={{ position: "fixed", ...position, zIndex: 100 }}
            onKeyDown={keyboard}
            onBlur={(event) => {
              if (
                event.relatedTarget &&
                !event.currentTarget.contains(event.relatedTarget as Node) &&
                event.relatedTarget !== trigger.current
              )
                setOpen(false);
            }}
          >
            <div
              id={id}
              role="dialog"
              aria-label={label + t(" options", "选项")}
              className="crm-filter-popover"
            >
              {searchable && (
                <input
                  type="search"
                  className="crm-filter-option-search"
                  aria-label={t("Search ", "搜索") + label}
                  placeholder={t("Find options…", "搜索选项…")}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              )}
              <div
                role="listbox"
                aria-label={label}
                aria-multiselectable={multiple || undefined}
                className="crm-filter-options"
              >
                {visible.map((option) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedValues.includes(option.value)}
                    disabled={option.disabled}
                    key={option.value}
                    className="crm-filter-option crm-filter-single-option"
                    onClick={() => {
                      if (multiple)
                        onValuesChange?.(
                          values.includes(option.value)
                            ? values.filter((v) => v !== option.value)
                            : [...values, option.value],
                        );
                      else {
                        if (option.value !== value) onChange(option.value);
                        close();
                      }
                    }}
                  >
                    {multiple ? (
                      <input
                        type="checkbox"
                        checked={values.includes(option.value)}
                        disabled={option.disabled}
                        readOnly
                        tabIndex={-1}
                        aria-hidden="true"
                        style={{ pointerEvents: "none" }}
                      />
                    ) : (
                      <span
                        className="crm-filter-selection-mark"
                        aria-hidden="true"
                      >
                        {option.value === value ? "✓" : ""}
                      </span>
                    )}
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
              {multiple && (
                <div className="crm-filter-popover-footer">
                  {footer ? (
                    footer(close)
                  ) : (
                    <button type="button" onClick={() => onValuesChange?.([])}>
                      {t("Clear filter (all)", "清除筛选（全部）")}
                    </button>
                  )}
                </div>
              )}
              {!visible.length && (
                <p className="crm-filter-no-options" role="status">
                  {t("No matching options", "无匹配选项")}
                </p>
              )}
            </div>
          </div>,
          trigger.current?.closest("dialog") || document.body,
        )}
    </div>
  );
}
