import type {ComponentPropsWithRef,ReactNode} from 'react';
import {ChevronRight} from 'lucide-react';

type DisclosureProps=Omit<ComponentPropsWithRef<'details'>,'title'>&{
  heading:ReactNode;
  hideChevron?:boolean;
  density?:'compact'|'panel';
};

export function AdminDisclosureIndicator({className=''}:{className?:string}){
  return <ChevronRight className={`admin-disclosure-chevron ${className}`.trim()} size={16} aria-hidden="true" focusable="false"/>;
}

export function AdminDisclosureSummary(props:ComponentPropsWithRef<'summary'>){
  return <summary {...props} data-admin-disclosure-summary=""/>;
}

export function AdminDisclosure({heading,children,className='',density,hideChevron=false,...props}:DisclosureProps){
  return <details {...props} className={`crm-disclosure ${className}`.trim()} data-admin-disclosure={density??'default'}>
    <AdminDisclosureSummary className="crm-disclosure-heading">
      <span className="crm-disclosure-label">{heading}</span>
      {!hideChevron&&<AdminDisclosureIndicator className="crm-disclosure-chevron"/>}
    </AdminDisclosureSummary>
    <div className="crm-disclosure-body">{children}</div>
  </details>;
}
