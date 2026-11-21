import type {ReactNode,Ref} from 'react';

/** A configuration topic heading with its own actions and feedback. */
export function AdminTopicHeader({title,subtitle,actions,isLight,headingRef,actionClassName='admin-edit-actions',children}:{
  title:ReactNode;
  subtitle:string;
  actions?:ReactNode;
  isLight:boolean;
  headingRef?:Ref<HTMLHeadingElement>;
  actionClassName?:string;
  children?:ReactNode;
}){
  return <header className="admin-edit-header admin-topic-header" data-theme={isLight?'light':'dark'}>
    <div className="admin-edit-title">
      <h2 ref={headingRef} tabIndex={headingRef?-1:undefined}>{title}</h2>
      <p>{subtitle}</p>
    </div>
    {actions&&<div className={actionClassName}>{actions}</div>}
    {children}
  </header>;
}
