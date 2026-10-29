import {CrmCustomer360Button} from './CrmCustomer360Button';
import {CrmHistoryAccess} from './CrmHistoryAccess';
import {X} from 'lucide-react';
import {createPortal} from 'react-dom';
import {useEffect,useId,useRef,useContext,type ReactNode} from 'react';
/** Native modal keeps the workspace inert and leaves its layout and scroll position intact. */
export function CrmOperationLayer({title,context,lang,isLight,onClose,children,wide=false,history=false,busy=false,progress=false,compose=false}: {title:string;context?:ReactNode;lang:string;isLight:boolean;onClose:()=>void;children:ReactNode;wide?:boolean;history?:boolean;busy?:boolean;progress?:boolean;compose?:boolean}){
  const openHistory=useContext(CrmHistoryAccess);
  const dialog=useRef<HTMLDialogElement>(null),heading=useRef<HTMLHeadingElement>(null),id=useId(),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    const opener=document.activeElement as HTMLElement,root=document.documentElement,body=document.body;
    const overflow=root.style.overflow,padding=body.style.paddingRight,x=window.scrollX,y=window.scrollY;
    const gap=window.innerWidth-root.clientWidth;
    if(gap)body.style.paddingRight=(parseFloat(getComputedStyle(body).paddingRight)+gap)+'px';
    root.style.overflow='hidden';dialog.current?.showModal();heading.current?.focus({preventScroll:true});
    return()=>{dialog.current?.close();root.style.overflow=overflow;body.style.paddingRight=padding;window.scrollTo({left:x,top:y,behavior:'instant'});if(opener?.isConnected)opener.focus({preventScroll:true});};
  },[]);
  const content=<dialog data-admin-form="" ref={dialog} className={`crm-customer-workspace crm-operation-layer${wide?' crm-operation-page':''}${history?' crm-operation-history':''}${progress?' crm-operation-progress':''}${compose?' crm-operation-compose':''}`} data-theme={isLight?'light':'dark'} aria-labelledby={id} onCancel={e=>{e.preventDefault();if(!busy)close.current();}}>
    <header className="crm-operation-heading"><div><h2 data-admin-form-title ref={heading} tabIndex={-1} id={id}>{title}</h2>{context&&<div className="crm-operation-context">{context}</div>}</div><div className="crm-operation-heading-actions">{openHistory&&!history&&<CrmCustomer360Button lang={lang} onClick={()=>openHistory({})}/>}<button type="button" className="crm-operation-close" aria-label={lang==='zh'?'关闭':lang==='id'?'Tutup':'Close'} disabled={busy} onClick={onClose}>{<X size={20}/>}</button></div></header>
    <div className="crm-operation-content">{children}</div>
  </dialog>;
  return typeof document==='undefined'?content:createPortal(content,document.body);
}
