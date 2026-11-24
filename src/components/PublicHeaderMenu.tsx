import {useRef, type ReactNode} from 'react';
import {Globe2, Menu, X} from 'lucide-react';
import {metadataWords, type SiteLanguage} from '../utils/siteMetadata';
import {useDesignStyle} from '../utils/theme';

export const publicHeaderMenuButtonClass = 'public-header-menu-trigger inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-800 active:scale-95 transition-all cursor-pointer';

export function PublicHeaderBrand({eager = false}: {eager?:boolean}) {
  return <span className="public-header-brand inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-sans text-[19px] leading-none font-extrabold tracking-[0.03em] text-slate-800 md:gap-2 md:text-[23px]">
    <img src="/uper-logo-mark.svg" alt="" width="38" height="38" fetchPriority={eager?'high':undefined}
      decoding="async" className="size-7 object-contain md:size-[38px]"/>
    <span className="public-header-wordmark">UPER</span>
  </span>;
}

export function PublicHeaderMenuIcon({open = false}: {open?:boolean}) {
  return <span className="public-header-menu-icon" aria-hidden="true">
    <Menu size={20} className={open?'hidden':'public-header-menu-open'}/>
    <X size={20} className={open?undefined:'public-header-menu-close'}/>
  </span>;
}

export function PublicHeaderMenu({label, children}: {
  label:string; children:(close:()=>void)=>ReactNode;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  function close(returnFocus = false) {
    if (disclosure.current) disclosure.current.open = false;
    if (returnFocus) summary.current?.focus();
  }
  return <details className="public-header-menu" ref={disclosure}
    onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget))close();}}
    onKeyDown={event=>{
      if(event.key==='Escape'&&disclosure.current?.open){event.preventDefault();close(true);}
    }}>
    <summary ref={summary} className={publicHeaderMenuButtonClass} aria-label={label}><PublicHeaderMenuIcon/></summary>
    <div className="public-header-popover" role="group" aria-label={label}>
      {children(()=>close(true))}
    </div>
  </details>;
}

const publicHeaderLanguages = [
  {code:'id', shortLabel:'ID', name:'Bahasa Indonesia'},
  {code:'en', shortLabel:'EN', name:'English'},
  {code:'zh', shortLabel:'中文', name:'简体中文'},
] as const;

export function PublicHeaderLanguage({language, onChange}: {
  language:SiteLanguage; onChange:(language:SiteLanguage)=>void;
}) {
  const {isApple} = useDesignStyle();
  return <div role="group" aria-label={metadataWords(['Page language','Bahasa halaman','页面语言'],language)}
    className="public-header-language flex shrink-0 items-center rounded-full border border-slate-200/90 bg-slate-100/90 p-0.5 font-sans text-sm shadow-xs md:p-1">
    <span aria-hidden="true" className="hidden pl-2.5 pr-1.5 md:flex">
      <Globe2 className="size-3.5 text-slate-500"/>
    </span>
    <div className="flex items-center md:gap-0.5">
      {publicHeaderLanguages.map(({code, shortLabel, name})=>{
        const selected = language===code;
        const tone = selected
          ? isApple?'bg-white text-slate-900 shadow-xs':'bg-primary-600 text-white shadow-xs'
          :'text-slate-500 hover:text-slate-900 md:text-slate-600 md:hover:bg-white/60';
        return <button key={code} type="button" lang={code} title={name} aria-label={name} aria-pressed={selected}
          className={`cursor-pointer rounded-full px-2 py-1 text-[11px] font-bold transition-all md:px-2.5 md:text-xs ${tone}`}
          onClick={()=>onChange(code)}>{shortLabel}</button>;
      })}
    </div>
  </div>;
}
