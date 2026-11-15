import { Search } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import './crm-list.css';

export function CrmListFilters({ label, children }: {label:string; children:ReactNode}) {
  return <div className="crm-list-filters" role="group" aria-label={label}>{children}</div>;
}

export function CrmListSearch({label,placeholder,value,onChange,inputRef}:{
  label:string;placeholder:string;value:string;onChange:(value:string)=>void;inputRef?:Ref<HTMLInputElement>;
}) {
  return <label className="crm-list-search">
    <Search size={16} aria-hidden="true"/>
    <input ref={inputRef} type="search" aria-label={label} placeholder={placeholder} value={value}
      onChange={event=>onChange(event.currentTarget.value)}/>
  </label>;
}

export function CrmListViews({label,children}:{label:string;children:ReactNode}){
  return <div className="crm-list-views" role="group" aria-label={label}>{children}</div>;
}

export function CrmListTable({label,headers,children,busy,viewportRef}:{
  label:string;headers:(string|{label:string;numeric:true})[];children:ReactNode;busy?:boolean;viewportRef?:Ref<HTMLDivElement>;
}) {
  return <div className="crm-list-table" ref={viewportRef} aria-busy={busy}>
    <table aria-label={label}>
      <thead><tr>{headers.map(header=>typeof header==='string'?<th key={header} scope="col">{header}</th>:
        <th key={header.label} scope="col" className="crm-list-number">{header.label}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  </div>;
}

export function CrmListStatus({tone,children}:{tone?:'success'|'warning'|'info'|'danger';children:ReactNode}) {
  return <span className="crm-payment-status" data-tone={tone}>{children}</span>;
}


export function enrollmentListTone(state:string){
  switch(state){
    case 'paid':case 'recovered':return 'success';
    case 'awaiting_confirmation':case 'proof_review':case 'paid_cancelled':return 'warning';
    case 'awaiting_payment':case 'partial':case 'waiting':return 'info';
    default:return undefined;
  }
}
