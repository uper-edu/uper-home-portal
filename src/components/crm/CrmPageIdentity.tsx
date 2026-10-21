import React, { type ReactNode } from "react";

/** Page identity shared by the Campaign and Lead home workspaces. */
export function CrmPageIdentity({
  title,
  subtitle,
  headingRef,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="crm-page-identity">
      <h1 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>
        {title}
      </h1>
      {subtitle && <p className="crm-page-subtitle">{subtitle}</p>}
    </div>
  );
}
