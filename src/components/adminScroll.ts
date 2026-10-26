import type { KeyboardEvent } from 'react';

export function scrollKeyTarget(key:string,current:number,maximum:number,page:number){
 const amount=key==='ArrowDown'?40:key==='ArrowUp'?-40:key==='PageDown'?page:key==='PageUp'?-page:0;
 return Math.max(0,Math.min(maximum,key==='Home'?0:key==='End'?maximum:current+amount));
}
/** Local keyboard scrolling complements CSS overscroll containment. Never intercept control keys. */
export function containPaneKeys(e:KeyboardEvent<HTMLElement>){
 if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||!['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key))return;
 const target=e.target as HTMLElement;
 if(target.closest('input,textarea,select,[contenteditable="true"],[role="combobox"],[role="listbox"],[role="menu"],[role="tablist"],[role="slider"],[role="spinbutton"]'))return;
 const pane=target.closest<HTMLElement>('[data-admin-scroll]');
 if(!pane||!e.currentTarget.contains(pane)||!['auto','scroll'].includes(getComputedStyle(pane).overflowY))return;
 e.preventDefault();pane.scrollTop=scrollKeyTarget(e.key,pane.scrollTop,Math.max(0,pane.scrollHeight-pane.clientHeight),Math.max(40,pane.clientHeight-40));
}
/** Reveal a selected record without scrolling its sticky container or the document. */
export function revealRecord(pane:HTMLElement,item:HTMLElement){
 const bounds=pane.getBoundingClientRect(),row=item.getBoundingClientRect(),top=bounds.top+pane.clientTop,bottom=top+pane.clientHeight;
 if(row.top<top||row.height>pane.clientHeight)pane.scrollTop+=row.top-top;
 else if(row.bottom>bottom)pane.scrollTop+=row.bottom-bottom;
}
export function recordScrollMode(width:number,viewport:number,header:number){return width>=1120&&viewport-header-24>=360?'independent':'page';}
