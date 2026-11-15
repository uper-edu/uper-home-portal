import {ArrowLeft, ChevronDown, PanelLeftClose, PanelLeftOpen, Search, SlidersHorizontal} from 'lucide-react';
import {useEffect, useId, useLayoutEffect, useRef, type MouseEventHandler, type ReactNode, type Ref, useState} from 'react';
import type {CrmLanguage} from '../../utils/crmLanguage';
import {containPaneKeys, revealRecord} from '../adminScroll';

export function CrmRecordNavigation({label, back, tools}: {
  label: string;
  back: {label: string; href: string} | {label: string; onClick: () => void; disabled?: boolean};
  tools?: ReactNode;
}) {
  const content=<><ArrowLeft size={16} aria-hidden="true"/>{back.label}</>;
  return <nav className="crm-record-navigation" aria-label={label}>
    {'href' in back?<a className="crm-work-link" href={back.href}>{content}</a>:
      <button type="button" className="crm-work-link" onClick={back.onClick} disabled={back.disabled}>{content}</button>}
    {tools&&<div className="crm-record-nav-tools">{tools}</div>}
  </nav>;
}

export function CrmRecordSidebarToggle({controls, expanded, label, onClick}: {
  controls: string; expanded: boolean; label: string; onClick: () => void;
}) {
  const Icon=expanded?PanelLeftClose:PanelLeftOpen;
  return <button type="button" className="crm-work-button crm-record-sidebar-toggle"
    aria-expanded={expanded} aria-controls={controls} onClick={onClick}>
    <Icon size={16} aria-hidden="true"/>{label}
  </button>;
}

export function CrmRecordTitle({title, status, meta}: {
  title: ReactNode; status?: ReactNode; meta?: ReactNode;
}) {
  return <div className="crm-record-identity">
    <h1 className="crm-record-title" tabIndex={-1}>{title}</h1>
    {status&&<div className="crm-record-title-status">{status}</div>}
    {meta&&<div className="crm-record-title-meta">{meta}</div>}
  </div>;
}

export function CrmDetailActions({label, secondary, primary}: {
  label: string; secondary?: ReactNode; primary?: ReactNode;
}) {
  return <div className="crm-record-actions" role="group" aria-label={label}>{secondary}{primary}</div>;
}

export function CrmRecordSidebar({id, title, count, selectedId, busy, busyLabel, hidden, filters, note, empty, children}: {
  id: string; title: string; count?: number; selectedId?: string; busy?: boolean; busyLabel: string; hidden?: boolean;
  filters: ReactNode; note?: string; empty?: ReactNode; children?: ReactNode;
}) {
  const rows=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const pane=rows.current, selected=pane?.querySelector<HTMLElement>('[aria-current="true"], [aria-current="page"]');
    if(selectedId&&pane&&selected&&!hidden&&getComputedStyle(pane).overflowY==='auto') revealRecord(pane,selected);
  },[selectedId,hidden]);
  return <aside id={id} className="crm-record-sidebar" aria-labelledby={id+'-heading'} hidden={hidden}>
    <div className="crm-record-sidebar-heading">
      <h2 id={id+'-heading'}>{title}{count!==undefined&&<span> · {count}</span>}</h2>
      <span className="crm-record-sidebar-updating" role="status" style={{visibility:busy?'visible':'hidden'}}>{busyLabel}</span>
    </div>
    {filters}
    {note&&<p className="crm-record-sidebar-note" role="status">{note}</p>}
    <div className="crm-record-sidebar-rows" ref={rows} data-admin-scroll="records"
      aria-busy={busy} tabIndex={children?0:undefined} onKeyDown={containPaneKeys}>
      {empty??<ul>{children}</ul>}
    </div>
  </aside>;
}

export function CrmRecordRow({selected, name, title, href, onClick, meta, extra}: {
  selected: boolean; name: string; title: string; href?: string;
  onClick?: MouseEventHandler<HTMLElement>; meta: ReactNode; extra?: ReactNode;
}) {
  const label=<strong>{name}</strong>;
  const control=href?
    <a href={href} aria-current={selected?'page':undefined} onClick={onClick} aria-label={title}>{label}</a>:
    <button type="button" aria-current={selected||undefined} onClick={onClick} aria-label={title}>{label}</button>;
  return <li className="crm-record-row" data-selected={selected}>
    {control}<div className="crm-record-row-meta">{meta}</div>{extra}
  </li>;
}

export function CrmRecordSearch({label, placeholder, value, onChange, inputRef}: {
  label: string; placeholder: string; value: string; onChange: (value: string) => void; inputRef?: Ref<HTMLInputElement>;
}) {
  return <div className="crm-record-search">
    <Search size={16} aria-hidden="true"/>
    <input ref={inputRef} type="search" maxLength={200} aria-label={label} placeholder={placeholder}
      value={value} onChange={event=>onChange(event.target.value)}/>
  </div>;
}

export function CrmRecordFilters({lang, count, search, children}: {
  lang: CrmLanguage; count: number; search: ReactNode; children: ReactNode;
}) {
  const label=lang==='zh'?'筛选':lang==='id'?'Filter':'Filters';
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null), panel=useRef<HTMLDivElement>(null), toggle=useRef<HTMLButtonElement>(null);
  const id=useId();
  useLayoutEffect(()=>{
    if(!open)return;
    const measure=()=>{
      if(panel.current) panel.current.style.maxHeight=`${Math.min(680,Math.max(96,window.innerHeight-panel.current.getBoundingClientRect().top-16))}px`;
    };
    measure();
    window.addEventListener('resize',measure);
    window.addEventListener('scroll',measure,true);
    return ()=>{window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
  },[open]);
  useEffect(()=>{
    if(!open)return;
    const dismiss=(event:PointerEvent)=>{
      const target=event.target;
      if(target instanceof Element&&!root.current?.contains(target)&&!target.closest('.crm-detail-choice-popup'))setOpen(false);
    };
    document.addEventListener('pointerdown',dismiss);
    return ()=>document.removeEventListener('pointerdown',dismiss);
  },[open]);
  return <div className="crm-record-filters" ref={root} data-expanded={open} onKeyDown={event=>{
    if(open&&event.key==='Escape'&&!event.defaultPrevented){
      event.preventDefault();event.stopPropagation();setOpen(false);toggle.current?.focus();
    }
  }}>
    <div className="crm-record-filter-controls">{search}
      <button type="button" className="crm-work-button crm-record-filter-toggle" ref={toggle} aria-expanded={open}
        aria-controls={id} onClick={()=>setOpen(value=>!value)}>
        <SlidersHorizontal size={15} aria-hidden="true"/>{label}{count>0&&<span>({count})</span>}
        {open&&<ChevronDown size={14} aria-hidden="true"/>}
      </button>
    </div>
    <section id={id} aria-label={label} className="crm-record-filter-panel" ref={panel} hidden={!open}>{open&&children}</section>
  </div>;
}
