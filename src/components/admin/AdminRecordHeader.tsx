import {ArrowLeft} from 'lucide-react';
import type {ReactNode} from 'react';

export type AdminBackTarget={label:string;href:string}|{label:string;onClick:()=>void;disabled?:boolean};

export function AdminRecordBack({target}:{target:AdminBackTarget}){
  const label=<><ArrowLeft size={16} aria-hidden="true"/>{target.label}</>;
  return 'href' in target
    ? <a className="admin-record-back" href={target.href}>{label}</a>
    : <button className="admin-record-back" type="button" disabled={target.disabled} onClick={target.onClick}>{label}</button>;
}

export function AdminRecordHeader({back,title,actions}:{
  back:AdminBackTarget;title:ReactNode;actions?:ReactNode;
}){
  return <header className="crm-detail-header admin-record-header">
    <AdminRecordBack target={back}/>
    {title}
    {actions}
  </header>;
}
