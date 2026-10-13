import { useRef } from "react";
import { Globe } from "lucide-react";
import type { CrmLanguage } from "../../utils/crmLanguage";
const languages: Array<{ value: CrmLanguage; label: string; short: string }> = [
  { value: "en", label: "English", short: "EN" },
  { value: "id", label: "Bahasa Indonesia", short: "ID" },
  { value: "zh", label: "中文", short: "中文" },
];
/** Three visible language choices are a preference, not a lead filter. */
export function CrmLanguageSelect({
  lang,
  onChange,
  isLight = true,
}: {
  lang: CrmLanguage;
  onChange: (value: CrmLanguage) => void;
  isLight?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const label =
    lang === "zh"
      ? "界面语言"
      : lang === "id"
        ? "Bahasa antarmuka"
        : "Interface language";
  return (
    <div
      className="crm-language-switch"
      data-theme={isLight ? "light" : "dark"}
    >
      <Globe size={14} className="crm-language-symbol" aria-hidden="true" />
      <div
        ref={root}
        role="radiogroup"
        aria-label={label}
        className="crm-language-choices"
        onKeyDown={(event) => {
          const current = languages.findIndex(
            (choice) => choice.value === lang,
          );
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? languages.length - 1
                : ["ArrowRight", "ArrowDown"].includes(event.key)
                  ? (current + 1) % languages.length
                  : ["ArrowLeft", "ArrowUp"].includes(event.key)
                    ? (current + languages.length - 1) % languages.length
                    : -1;
          if (next < 0) return;
          event.preventDefault();
          onChange(languages[next].value);
          root.current
            ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
            [next]?.focus();
        }}
      >
        {languages.map((choice) => (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-label={choice.label}
            title={choice.label}
            aria-checked={lang === choice.value}
            tabIndex={lang === choice.value ? 0 : -1}
            className="crm-language-choice"
            onClick={() => onChange(choice.value)}
          >
            {choice.short}
          </button>
        ))}
      </div>
    </div>
  );
}
