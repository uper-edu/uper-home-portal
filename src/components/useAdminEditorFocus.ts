import {useEffect,useRef,type RefObject} from 'react';
/** UI-only lifecycle for custom editors; native CRM dialogs retain their existing lifecycle. */
export function useAdminEditorFocus(open:boolean,ref:RefObject<HTMLElement|null>,onClose:()=>void){
 const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const panel=ref.current;if(!open||!panel)return;
  const opener=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';panel.focus({preventScroll:true});
  const keys=(event:KeyboardEvent)=>{
   // A nested native confirmation owns its own keyboard interaction.
   if(document.querySelector('dialog[open]'))return;
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();}
   if(event.key==='Tab'){
    const controls=Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')).filter(e=>e.getClientRects().length>0&&e.tabIndex>=0);
    if(!controls.length){event.preventDefault();panel.focus();return;}
    const first=controls[0],last=controls.at(-1)!;
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel)){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===panel)){event.preventDefault();first.focus();}
   }
  };
  panel.addEventListener('keydown',keys);
  return()=>{panel.removeEventListener('keydown',keys);document.body.style.overflow=overflow;if(opener?.isConnected)opener.focus({preventScroll:true});};
 },[open,ref]);
}
