import {useEffect,useRef} from "react";
import type {LucideIcon} from "lucide-react";

export interface AdminDetailTab {
  id: string;
  label: string;
  icon?: LucideIcon;
}
export function AdminDetailTabs({
  id,
  value,
  tabs,
  label,
  contentId,
  disabled=false,
  onChange,
}: {
  id: string;
  value: string;
  tabs: AdminDetailTab[];
  label: string;
  contentId: string;
  disabled?: boolean;
  onChange: (value: string, keyboard: boolean) => void;
}) {
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (pendingFocus.current === value) {
      document
        .getElementById(`${id}-tab-${value}`)
        ?.focus({ preventScroll: true });
      pendingFocus.current = null;
    }
  }, [value, id]);
  return (
    <div className="crm-content-tabs crm-detail-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, i) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            id={`${id}-tab-${tab.id}`}
            className="crm-content-tab"
            role="tab"
            aria-selected={value === tab.id}
            aria-controls={contentId}
            disabled={disabled}
            tabIndex={value === tab.id ? 0 : -1}
            onClick={() => {
              pendingFocus.current = null;
              onChange(tab.id, false);
            }}
            onKeyDown={(e) => {
              const next =
                e.key === "ArrowRight"
                  ? tabs[(i + 1) % tabs.length]
                  : e.key === "ArrowLeft"
                    ? tabs[(i + tabs.length - 1) % tabs.length]
                    : e.key === "Home"
                      ? tabs[0]
                      : e.key === "End"
                        ? tabs[tabs.length - 1]
                        : undefined;
              if (next) {
                e.preventDefault();
                pendingFocus.current = next.id;
                if (next.id === value) e.currentTarget.focus();
                else onChange(next.id, true);
              }
            }}
          >
            {Icon&&<Icon size={17} aria-hidden="true" />}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
