import React, { type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Shared page-level actions; permission checks remain at each call site. */
export function CrmPageAction({
  label,
  icon: Icon,
  variant = "secondary",
  iconOnly = false,
  loading = false,
  disabled = false,
  href,
  onClick,
  id,
  title,
  description,
  className = "",
  children,
}: {
  label: string;
  icon: LucideIcon;
  variant?: "primary" | "secondary";
  iconOnly?: boolean;
  loading?: boolean;
  disabled?: boolean;
  href?: string;
  onClick?: () => void;
  id?: string;
  title?: string;
  description?: string;
  className?: string;
  children?: ReactNode;
}) {
  const tipId = React.useId();
  const [dismissed, setDismissed] = React.useState(false);
  const props = {
    id,
    className:
      `crm-page-action crm-page-action--${variant}${iconOnly ? " crm-page-action--icon" : ""} ${className}`.trim(),
    title: description ? undefined : title || label,
    "aria-describedby": description ? tipId : undefined,
    "aria-label": iconOnly ? label : undefined,
    "aria-busy": loading || undefined,
  };
  const content = (
    <>
      <Icon
        size={16}
        aria-hidden="true"
        className={loading ? "crm-page-action-spinner" : undefined}
      />
      {!iconOnly && <span>{label}</span>}
      {children}
    </>
  );
  const action =
    href && !disabled && !loading ? (
      <a {...props} href={href}>
        {content}
      </a>
    ) : (
      <button
        {...props}
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
      >
        {content}
      </button>
    );
  return description ? (
    <span
      className="crm-page-action-hint"
      data-dismissed={dismissed || undefined}
      onMouseEnter={() => setDismissed(false)}
      onFocus={() => setDismissed(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setDismissed(true);
          event.stopPropagation();
        }
      }}
    >
      {action}
      <span id={tipId} role="tooltip">
        {description}
      </span>
    </span>
  ) : (
    action
  );
}
