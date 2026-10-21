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
  className?: string;
  children?: ReactNode;
}) {
  const props = {
    id,
    className:
      `crm-page-action crm-page-action--${variant}${iconOnly ? " crm-page-action--icon" : ""} ${className}`.trim(),
    title: title || label,
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
  return href && !disabled && !loading ? (
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
}
