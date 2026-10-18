import { createPortal } from "react-dom";
import { useEffect, useId, useRef, type ReactNode } from "react";
/** A short operation stays in context; the parent owns dirty-draft confirmation. */
export function CrmSalesDialog({
  title,
  children,
  onClose,
  suspended,
  busy,
  isLight,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  suspended?: boolean;
  busy?: boolean;
  isLight: boolean;
}) {
  const ref = useRef<HTMLElement>(null),
    id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>("h3")?.focus();
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div
      className="crm-customer-workspace crm-sales-dialog-backdrop"
      data-theme={isLight ? "light" : "dark"}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy && !suspended)
          closeRef.current();
      }}
    >
      <section
        ref={ref}
        className="crm-sales-dialog"
        role="dialog"
        aria-modal={!suspended}
        aria-labelledby={id}
        onKeyDown={(e) => {
          if (suspended) return;
          // Select popovers own their keyboard navigation and Escape.
          if (document.querySelector(".crm-filter-popover")) return;
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            if (!busy) closeRef.current();
          }
          if (e.key === "Tab") {
            const nodes = Array.from(
              ref.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
              ) || [],
            ).filter((n) => n.getClientRects().length);
            const first = nodes[0],
              last = nodes.at(-1);
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement?.tagName === "H3")
            ) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <h3 id={id} tabIndex={-1}>
            {title}
          </h3>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
