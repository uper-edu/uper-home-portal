import {ChevronDown} from 'lucide-react';
import {useRef,type ReactNode} from 'react';

/** Opening is presentation only; only an explicit clear discards this section's draft. */
export function CrmProgressSection({id,title,summary,open,onToggle,onClear,changed,incomplete,disabled,clearDisabled,lang,children}:any & {children:ReactNode}) {
  const clear=lang==='zh'?'清除本次修改':lang==='id'?'Hapus perubahan ini':'Clear these changes';
  const missing=lang==='zh'?'待补全':lang==='id'?'Belum lengkap':'Incomplete';
  const toggle=useRef<HTMLButtonElement>(null);
  return <section className="crm-progress-section" aria-label={title}>
    <div className="crm-progress-section-heading">
      <button ref={toggle} type="button" className="crm-progress-section-toggle" aria-label={title} aria-describedby={`${summary?id+'-summary ':''}${incomplete?id+'-missing':''}`.trim()||undefined} aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span className="crm-progress-section-title">{title}</span>
        {summary&&<span id={id+'-summary'} className="crm-progress-section-summary" title={summary}>{summary}</span>}
        {incomplete&&<span id={id+'-missing'} className="crm-progress-section-incomplete">{missing}</span>}
        <span className="crm-progress-section-clear-space" aria-hidden="true">{clear}</span>
        <ChevronDown size={16} aria-hidden="true" className={open?'is-open':''}/>
      </button>
      {changed&&<button type="button" className="crm-progress-section-clear" aria-label={`${clear} · ${title}`} disabled={disabled||clearDisabled} onClick={()=>{onClear();toggle.current?.focus();}}>{clear}</button>}
    </div>
    <fieldset id={id} className="crm-progress-section-panel" hidden={!open} disabled={disabled}>
      {children}
    </fieldset>
  </section>;
}
