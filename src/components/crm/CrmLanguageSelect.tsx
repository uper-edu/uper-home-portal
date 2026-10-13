import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CrmLanguage } from "../../utils/crmLanguage";
import "./crm-lead-filters.css";
const languages: Array<{ value: CrmLanguage; label: string }> = [
  { value: "en", label: "English" },
  { value: "id", label: "Bahasa Indonesia" },
  { value: "zh", label: "中文" },
];
export function CrmLanguageSelect({
  lang,
  onChange,
  isLight = true,
}: {
  lang: CrmLanguage;
  onChange: (value: CrmLanguage) => void;
  isLight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const label =
    lang === "zh"
      ? "界面语言"
      : lang === "id"
        ? "Bahasa antarmuka"
        : "Interface language";
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !menu.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const place = () => {
      const bounds = trigger.current?.getBoundingClientRect();
      if (bounds)
        setPosition({
          top: Math.min(bounds.bottom + 5, window.innerHeight - 150),
          left: Math.max(
            8,
            Math.min(bounds.right - 190, window.innerWidth - 198),
          ),
        });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", dismiss);
    menu.current
      ?.querySelector<HTMLButtonElement>(
        '[role="option"][aria-selected="true"]',
      )
      ?.focus();
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  return (
    <div
      ref={root}
      className="crm-filter-area crm-language-select"
      data-theme={isLight ? "light" : "dark"}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget as Node) &&
          !menu.current?.contains(event.relatedTarget as Node)
        )
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (!open) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
          return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
          return;
        const items = Array.from(
          menu.current?.querySelectorAll<HTMLButtonElement>(
            '[role="option"]',
          ) || [],
        );
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
        event.preventDefault();
        items[next]?.focus();
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="crm-filter-dimension-button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (!open && ["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="crm-filter-dimension-value">
          {languages.find((option) => option.value === lang)?.label}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            className="crm-filter-area crm-language-menu"
            data-theme={isLight ? "light" : "dark"}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: 190,
              zIndex: 100,
            }}
            onBlur={(event) => {
              if (
                event.relatedTarget &&
                !event.currentTarget.contains(event.relatedTarget as Node) &&
                event.relatedTarget !== trigger.current
              )
                setOpen(false);
            }}
          >
            <div className="crm-filter-popover">
              <div
                role="listbox"
                aria-label={label}
                className="crm-filter-options"
              >
                {languages.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={option.value === lang}
                    className="crm-filter-option crm-filter-single-option"
                    onClick={() => {
                      onChange(option.value);
                      close();
                    }}
                  >
                    <span
                      className="crm-filter-selection-mark"
                      aria-hidden="true"
                    >
                      {option.value === lang ? "✓" : ""}
                    </span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
