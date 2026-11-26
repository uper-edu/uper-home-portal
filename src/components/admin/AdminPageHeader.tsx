import type {ReactNode,Ref} from 'react';

/** The heading and page-scoped actions for an admin workspace or collection. */
export function AdminPageHeader({title,subtitle,actions,headingRef,headingId,className}:{
  title:ReactNode;
  subtitle:string;
  actions?:ReactNode;
  headingRef?:Ref<HTMLHeadingElement>;
  headingId?:string;
  className?:string;
}){
  return <header className={['admin-page-header',className].filter(Boolean).join(' ')}>
    <div className="admin-page-identity">
      <h1 ref={headingRef} id={headingId} tabIndex={headingRef?-1:undefined}>{title}</h1>
      <p>{subtitle}</p>
    </div>
    {actions&&<div className="admin-page-actions">{actions}</div>}
  </header>;
}
