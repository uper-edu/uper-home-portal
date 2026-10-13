import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { crmId } from "../../utils/crmIndonesian";
import type { CrmLanguage } from "../../utils/crmLanguage";
export interface CrmChoice {
  value: string;
  label: string;
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
  disabled = false,
}: {
  label: string;
  value: string;
  options: CrmChoice[];
  onChange: (value: string) => void;
  lang: CrmLanguage;
  isLight: boolean;
  searchable?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0, width: 240 });
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const selected = options.find((option) => option.value === value);
  const visible = options.filter(
    (option) =>
      !searchable ||
      option.label
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
  }, [open, query]);
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
      popup.current?.querySelector<HTMLElement>('[aria-selected="true"]') ||
      popup.current?.querySelector<HTMLElement>('[role="option"]')
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
      popup.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ||
        [],
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
      className="crm-filter-area crm-detail-choice"
      data-theme={isLight ? "light" : "dark"}
    >
      <button
        ref={trigger}
        type="button"
        className="crm-filter-dimension-button"
        aria-label={label}
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
          {selected?.label || value || t("Unavailable option", "选项已失效")}
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
                className="crm-filter-options"
              >
                {visible.map((option) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    key={option.value}
                    className="crm-filter-option crm-filter-single-option"
                    onClick={() => {
                      if (option.value !== value) onChange(option.value);
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
              {!visible.length && (
                <p className="crm-filter-no-options" role="status">
                  {t("No matching options", "无匹配选项")}
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
