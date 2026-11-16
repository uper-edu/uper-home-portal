import {AdminDialog} from '../admin/AdminDialog';
import {CrmCustomer360Button} from './CrmCustomer360Button';
import {CrmHistoryAccess} from './CrmHistoryAccess';
import {X} from 'lucide-react';
import {createPortal} from 'react-dom';
import {useId,useContext,type ReactNode} from 'react';
/** Native modal keeps the workspace inert and leaves its layout and scroll position intact. */
export function CrmOperationLayer({title,context,headerSummary,navigation,lang,isLight,onClose,children,wide=false,history=false,busy=false,progress=false,compose=false,customerContext=true,className=''}: {title:ReactNode;context?:ReactNode;headerSummary?:ReactNode;navigation?:ReactNode;lang:string;isLight:boolean;onClose:()=>void;children:ReactNode;wide?:boolean;history?:boolean;busy?:boolean;progress?:boolean;compose?:boolean;customerContext?:boolean;className?:string}){
  const openHistory=useContext(CrmHistoryAccess);
  const id=useId();
  const content=<AdminDialog data-admin-form="" className={`crm-customer-workspace crm-operation-layer${wide?' crm-operation-page':''}${history?' crm-operation-history':''}${progress?' crm-operation-progress':''}${compose?' crm-operation-compose':''} ${className}`}
    light={isLight} busy={busy} aria-labelledby={id} onRequestClose={onClose}>
    <header className="crm-operation-heading"><div><h2 data-admin-form-title tabIndex={-1} id={id}>{title}</h2>{context&&<div className="crm-operation-context">{context}</div>}</div><div className="crm-operation-heading-actions">{navigation}{openHistory&&customerContext&&!history&&<CrmCustomer360Button lang={lang} onClick={()=>openHistory({})}/>}<button type="button" className="crm-operation-close" aria-label={lang==='zh'?'关闭':lang==='id'?'Tutup':'Close'} disabled={busy} onClick={onClose}>{<X size={20}/>}</button></div></header>
    {headerSummary&&<div className="crm-operation-current-state">{headerSummary}</div>}
    <div className="crm-operation-content">{children}</div>
  </AdminDialog>;
  return typeof document==='undefined'?content:createPortal(content,document.body);
}
