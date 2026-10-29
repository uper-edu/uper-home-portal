import { createPortal } from "react-dom";
import { useEffect, useId, useRef, type ReactNode } from "react";
/** A short operation stays in context; the parent owns dirty-draft confirmation. */
export function CrmSalesDialog({
  title,
  description,
  children,
  onClose,
  suspended,
  busy,
  isLight,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  suspended?: boolean;
  busy?: boolean;
  isLight: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const ref = useRef<HTMLElement>(null),
    id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement;
    const overflow=document.documentElement.style.overflow,padding=document.body.style.paddingRight,x=window.scrollX,y=window.scrollY;
    const gap=window.innerWidth-document.documentElement.clientWidth;if(gap)document.body.style.paddingRight=(parseFloat(getComputedStyle(document.body).paddingRight)+gap)+"px";
    document.documentElement.style.overflow="hidden";dialog.current?.showModal();
    ref.current?.querySelector<HTMLElement>("h3")?.focus({preventScroll:true});
    return () => {
      document.documentElement.style.overflow=overflow;document.body.style.paddingRight=padding;window.scrollTo({left:x,top:y,behavior:"instant"});
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog data-admin-form="" ref={dialog} aria-labelledby={id} aria-describedby={description?id+"-description":undefined} onCancel={e=>{e.preventDefault();if(!busy&&!suspended)closeRef.current();}}
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
          {description&&<p id={id+"-description"} className="crm-sales-dialog-description">{description}</p>}
        </header>
        {children}
      </section>
    </dialog>,
    document.body,
  );
}
