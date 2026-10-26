import {containPaneKeys,scrollKeyTarget} from './adminScroll';
import React,{useLayoutEffect,useRef,useState} from 'react';

/** Only reveal an obscured heading; never align an already visible heading. */
export function topicRevealDelta(top:number,bottom:number,header:number,viewport:number){
 const edge=header+16;
 return top<edge ? top-edge : bottom>viewport ? bottom-viewport+16 : 0;
}
/** Keyboard scrolls stay local, including at either boundary. */
export const directoryScrollTarget=scrollKeyTarget;
/** Presentation only: changing selection does not remount business forms. */
export function AdminTopicFrame({navigation,children,label,selection}:{navigation:React.ReactNode;children:React.ReactNode;label:string;selection:string}){
 const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);const previous=useRef(selection);const toggle=useRef<HTMLButtonElement>(null);const source=useRef<'pointer'|'keyboard'>('pointer');const nav=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{const header=document.querySelector('[data-admin-header],[data-crm-header]');const measure=()=>root.current?.style.setProperty('--admin-shell-height',`${header?.getBoundingClientRect().height||116}px`);measure();if(!header)return;const observer=new ResizeObserver(measure);observer.observe(header);return()=>observer.disconnect();},[]);
 useLayoutEffect(()=>{
  if(previous.current===selection)return;previous.current=selection;
  const narrow=window.matchMedia('(max-width:1023px)').matches;
  const directoryScroll=nav.current?.scrollTop||0;
  setOpen(false);
  const frame=requestAnimationFrame(()=>{
   if(nav.current&&!narrow)nav.current.scrollTop=directoryScroll;
   const h=Array.from(root.current?.querySelectorAll<HTMLElement>('.admin-topic-main h2,.admin-topic-main h3')||[]).find(el=>el.getClientRects().length>0);
   if(!h)return;
   if(narrow||source.current==='keyboard'){h.setAttribute('tabindex','-1');h.focus({preventScroll:true});}
   const header=document.querySelector('[data-admin-header],[data-crm-header]')?.getBoundingClientRect().height||0;
   const bounds=h.getBoundingClientRect();const delta=topicRevealDelta(bounds.top,bounds.bottom,header,window.innerHeight);
   if(delta)window.scrollBy({top:delta,left:0,behavior:'instant'});
  });return()=>cancelAnimationFrame(frame);
 },[selection]);
 return <div className="admin-workspace admin-topic" ref={root} data-directory-open={open}><button ref={toggle} type="button" className="admin-directory-toggle" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{label}</button><div ref={nav} className="admin-topic-directory" data-admin-scroll="directory" role="region" aria-label={label} tabIndex={0} onClickCapture={e=>{source.current=e.detail===0?'keyboard':'pointer';}} onKeyDownCapture={e=>{if(['Enter',' '].includes(e.key))source.current='keyboard';}} onKeyDown={e=>{
 containPaneKeys(e);
 if(e.key==='Escape'){setOpen(false);toggle.current?.focus({preventScroll:true});}}}>{navigation}</div><div className="admin-topic-main">{children}</div></div>;
}
