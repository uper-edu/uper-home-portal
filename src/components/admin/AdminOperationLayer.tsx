import {AdminDialog} from './AdminDialog';
import {X} from 'lucide-react';
import {createPortal} from 'react-dom';
import {useId,type ReactNode} from 'react';
import {AdminFormActions} from '../AdminFormLayout';
/** Native modal keeps the workspace inert and leaves its layout and scroll position intact. */
export function AdminOperationLayer({title,context,headerSummary,navigation,footer,lang,isLight,onClose,children,wide=false,history=false,busy=false,progress=false,compose=false,className=''}: {title:ReactNode;context?:ReactNode;headerSummary?:ReactNode;navigation?:ReactNode;footer?:ReactNode;lang:string;isLight:boolean;onClose:()=>void;children:ReactNode;wide?:boolean;history?:boolean;busy?:boolean;progress?:boolean;compose?:boolean;className?:string}){
  const id=useId();
  const content=<AdminDialog data-admin-form="" className={`crm-customer-workspace crm-operation-layer${wide?' crm-operation-page':''}${history?' crm-operation-history':''}${progress?' crm-operation-progress':''}${compose?' crm-operation-compose':''} ${className}`}
    light={isLight} busy={busy} aria-labelledby={id} onRequestClose={onClose}>
    <header className="crm-operation-heading"><div><h2 data-admin-form-title tabIndex={-1} id={id}>{title}</h2>{context&&<div className="crm-operation-context">{context}</div>}</div><div className="crm-operation-heading-actions">{navigation}<button type="button" className="crm-operation-close" aria-label={lang==='zh'?'关闭':lang==='id'?'Tutup':'Close'} disabled={busy} onClick={onClose}>{<X size={20}/>}</button></div></header>
    {headerSummary&&<div className="crm-operation-current-state">{headerSummary}</div>}
    <div className="crm-operation-content">{children}</div>
    {footer&&<AdminFormActions className="admin-editor-footer crm-operation-footer">{footer}</AdminFormActions>}
  </AdminDialog>;
  return typeof document==='undefined'?content:createPortal(content,document.body);
}
