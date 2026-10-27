import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ChevronRight } from "lucide-react";

type Props = Omit<ComponentPropsWithoutRef<"details">, "title"> & {
  heading: ReactNode;
  hideChevron?: boolean;
};

/** Native disclosure semantics, shared presentation. No exclusive accordion group:
 * opening one section never closes another section or discards a form draft. */
export function CrmDisclosure({
  heading,
  children,
  className = "",
  hideChevron = false,
  ...props
}: Props) {
  return (
    <details {...props} className={`crm-disclosure ${className}`.trim()}>
      <summary className="crm-disclosure-heading">
        <span className="crm-disclosure-label">{heading}</span>
        {!hideChevron && <ChevronRight
          className="crm-disclosure-chevron"
          size={16}
          aria-hidden="true"
          focusable="false"
        />}
      </summary>
      <div className="crm-disclosure-body">{children}</div>
    </details>
  );
}
