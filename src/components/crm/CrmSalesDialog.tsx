import {createPortal} from 'react-dom';
import {useId,type ReactNode} from 'react';
import {AdminDialog} from '../admin/AdminDialog';

/** Keeps existing CRM form layouts and lets their callers decide whether to close. */
export function CrmSalesDialog({title,description,children,onClose,suspended,busy,isLight}:{
  title:string;description?:ReactNode;children:ReactNode;onClose:()=>void;
  suspended?:boolean;busy?:boolean;isLight:boolean;
}){
  const id=useId();
  const content=<AdminDialog data-admin-form="" aria-labelledby={id} aria-describedby={description?id+'-description':undefined}
    className="crm-customer-workspace crm-sales-dialog-backdrop" light={isLight} busy={busy}
    onRequestClose={()=>{if(!suspended)onClose();}} closeOnBackdrop={!suspended}>
    <section className="crm-sales-dialog">
      <header>
        <h3 id={id} tabIndex={-1}>{title}</h3>
        {description&&<p id={id+'-description'} className="crm-sales-dialog-description">{description}</p>}
      </header>
      {children}
    </section>
  </AdminDialog>;
  return typeof document==='undefined'?content:createPortal(content,document.body);
}
