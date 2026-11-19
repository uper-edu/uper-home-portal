import {useLayoutEffect,useRef,type ComponentPropsWithRef,type RefObject} from 'react';

let lockCount=0;
let restorePageScroll:(()=>void)|undefined;

function lockPageScroll(){
  if(lockCount++===0){
    const root=document.documentElement,body=document.body;
    const overflow=root.style.overflow,padding=body.style.paddingRight;
    const {scrollX,scrollY}=window;
    const gutter=window.innerWidth-root.clientWidth;
    if(gutter>0)body.style.paddingRight=(parseFloat(getComputedStyle(body).paddingRight)+gutter)+'px';
    root.style.overflow='hidden';
    restorePageScroll=()=>{
      root.style.overflow=overflow;
      body.style.paddingRight=padding;
      if(window.scrollX!==scrollX||window.scrollY!==scrollY)window.scrollTo({left:scrollX,top:scrollY,behavior:"instant"});
    };
  }
  return ()=>{
    if(--lockCount===0){restorePageScroll?.();restorePageScroll=undefined;}
  };
}

const focusable='button,input,textarea,select,summary,a[href],[tabindex],[contenteditable=true]';

type Props=Omit<ComponentPropsWithRef<'dialog'>,'open'|'onCancel'|'ref'> & {
  onRequestClose:()=>void;
  busy?:boolean;
  light:boolean;
  closeOnBackdrop?:boolean;
  dialogRef?:RefObject<HTMLDialogElement|null>;
  initialFocus?:'heading'|'first';
};

export function AdminDialog({
  onRequestClose,busy=false,light,closeOnBackdrop=false,dialogRef,initialFocus='heading',
  className='',onKeyDown,onClick,onPointerDown,children,...props
}:Props){
  const local=useRef<HTMLDialogElement>(null),ref=dialogRef??local;
  const outside=useRef(false);
  useLayoutEffect(()=>{
    const panel=ref.current!;
    const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const unlock=lockPageScroll();
    panel.showModal();
    if(initialFocus==='heading'){
      document.getElementById(panel.getAttribute('aria-labelledby')??'')?.focus({preventScroll:true});
    }else{
      panel.querySelector<HTMLElement>('[data-admin-initial-focus]')?.focus({preventScroll:true});
    }
    return ()=>{
      panel.close();
      unlock();
      if(opener?.isConnected)opener.focus({preventScroll:true});
      // Parent and confirmation may both close in the same React commit.
      if(opener?.isConnected&&document.activeElement!==opener)queueMicrotask(()=>{
        if(opener.isConnected&&document.activeElement===document.body)opener.focus({preventScroll:true});
      });
    };
  },[ref,initialFocus]);

  return <dialog {...props} ref={ref} className={`admin-dialog ${className}`.trim()}
    data-theme={light?'light':'dark'}
    aria-busy={busy||undefined}
    onCancel={event=>{event.preventDefault();event.stopPropagation();if(!busy)onRequestClose();}}
    onPointerDown={event=>{
      onPointerDown?.(event);
      const box=event.currentTarget.getBoundingClientRect();
      outside.current=event.target===event.currentTarget&&
        (event.clientX<box.left||event.clientX>=box.right||event.clientY<box.top||event.clientY>=box.bottom);
    }}
    onClick={event=>{
      onClick?.(event);
      if(closeOnBackdrop&&outside.current&&event.target===event.currentTarget&&!busy)onRequestClose();
      outside.current=false;
    }}
    onKeyDown={event=>{
      onKeyDown?.(event);
      if(event.defaultPrevented||event.key!=='Tab'||!event.currentTarget.contains(event.target as Node))return;
      const panel=event.currentTarget;
      const controls=Array.from(panel.querySelectorAll<HTMLElement>(focusable)).filter(element=>
        element.tabIndex>=0&&!element.matches(':disabled')&&!element.closest('[inert]')&&
        element.getClientRects().length>0&&getComputedStyle(element).visibility==='visible'
      );
      const active=document.activeElement as HTMLElement;
      const edge=event.shiftKey?controls.at(-1):controls[0];
      if(!controls.length||!controls.includes(active)||active===(event.shiftKey?controls[0]:controls.at(-1))){
        event.preventDefault();
        (edge??panel).focus();
      }
    }}
  >{children}</dialog>;
}
