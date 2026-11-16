import {AdminSearchField, type AdminSearchFieldProps} from '../admin/AdminSearchField';
import type { ReactNode } from 'react';

export function CrmListFilters({ label, children }: {label:string; children:ReactNode}) {
  return <div className="crm-list-filters" role="group" aria-label={label}>{children}</div>;
}

export function CrmListSearch(props:Omit<AdminSearchFieldProps,'className'>) {
  return <AdminSearchField {...props} className="crm-list-search"/>;
}

export function CrmListViews({label,children}:{label:string;children:ReactNode}){
  return <div className="crm-list-views" role="group" aria-label={label}>{children}</div>;
}

export {AdminListTable as CrmListTable} from '../admin/AdminList';

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
