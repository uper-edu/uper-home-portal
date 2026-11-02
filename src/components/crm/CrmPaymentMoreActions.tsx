import {useEffect,useRef,useState,type ReactNode} from 'react';
/** Same compact disclosure pattern as customer-profile actions, with outside/Esc dismissal. */
export function CrmPaymentMoreActions({label,disabled,children}:{label:string;disabled?:boolean;children:ReactNode}){
 const ref=useRef<HTMLDetailsElement>(null),[open,setOpen]=useState(false);
 useEffect(()=>{if(!open)return;const dismiss=(e:PointerEvent)=>{if(!ref.current?.contains(e.target as Node)&&ref.current)ref.current.open=false;};document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss);},[open]);
 useEffect(()=>{if(disabled&&ref.current)ref.current.open=false;},[disabled]);
 return <details ref={ref} className="crm-payment-more" onToggle={e=>setOpen(e.currentTarget.open)} onBlur={e=>{if(e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget as Node))e.currentTarget.open=false;}} onKeyDown={e=>{if(e.key==='Escape'&&e.currentTarget.open){e.preventDefault();e.stopPropagation();e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();}}}>
  <summary className="crm-work-button" aria-disabled={disabled||undefined} onClick={e=>{if(disabled)e.preventDefault();}}>{label}</summary>
  <div onClick={e=>{if((e.target as HTMLElement).closest('button')&&ref.current)ref.current.open=false;}}>{children}</div>
 </details>;
}
