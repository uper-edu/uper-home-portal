import {useEffect,useRef,type ReactNode} from 'react';
import {packHistoryLanes} from '../../utils/crmHistoryPacking';
/** Measured staggered lanes retain DOM order, keyboard order, and full-width expanded reading. */
export function CrmHistoryStream({children,enabled}:{children:ReactNode;enabled:boolean}){
 const root=useRef<HTMLDivElement>(null),pendingReveal=useRef<HTMLDetailsElement|null>(null);
 useEffect(()=>{
  const node=root.current;if(!node)return;const rows=Array.from(node.children) as HTMLElement[];let frame=0;
  const layout=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   if(!enabled||window.innerWidth<=760){rows.forEach(row=>row.style.marginTop='');node.style.paddingBottom='';return;}
   const items=rows.map(row=>{const card=row.querySelector<HTMLDetailsElement>(':scope>.crm-history-node'),box=row.getBoundingClientRect();return {lane:row.dataset.historyLane||'system',height:box.height,inset:card?card.getBoundingClientRect().top-box.top:0,dayStart:!!row.querySelector(':scope>.crm-history-date'),expanded:!!card?.open};});
   const packed=packHistoryLanes(items);rows.forEach((row,i)=>row.style.marginTop=packed.margins[i]+'px');node.style.paddingBottom=packed.bottomSpace+'px';
   // Reveal only after the stagger has settled; never scroll the underlying workspace.
   const card=pendingReveal.current;pendingReveal.current=null;
   if(card?.isConnected&&card.open){
    const pane=node.closest<HTMLElement>('.crm-operation-content'),toolbar=node.parentElement?.querySelector<HTMLElement>('.crm-history-toolbar');
    if(pane){const view=pane.getBoundingClientRect(),box=card.getBoundingClientRect(),safeTop=Math.max(view.top,toolbar?.getBoundingClientRect().bottom||view.top)+12;
     if(box.top<safeTop||box.bottom>view.bottom-12)pane.scrollTop+=box.top-safeTop;
    }
   }
  });};
  const observer=new ResizeObserver(layout);rows.forEach(row=>observer.observe(row));window.addEventListener('resize',layout);layout();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',layout);};
 },[children,enabled]);
 return <div className={enabled?'crm-history-card-stream':undefined} ref={root} onClickCapture={enabled?event=>{const target=event.target;if(!(target instanceof Element))return;const card=target.closest('.crm-history-node');if(card instanceof HTMLDetailsElement&&!card.open&&!target.closest('button,a,input,textarea,select,[contenteditable="true"]'))pendingReveal.current=card;}:undefined}>{children}</div>;
}
