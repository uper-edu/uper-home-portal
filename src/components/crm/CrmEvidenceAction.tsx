import {useCrmUiText} from './CrmUiLanguage';
import {useId,useState} from 'react';
import {FileSearch,MessageSquareText,NotebookText} from 'lucide-react';
/** Compact source navigation; business callbacks and permissions stay with the caller. */
export function CrmEvidenceAction({kind='evidence',description,onClick}:{kind?:'evidence'|'conversation'|'record';description:string;onClick:()=>void}){
 const ui=useCrmUiText();
 const id=useId(),[dismissed,setDismissed]=useState(false),Icon=kind==='conversation'?MessageSquareText:kind==='record'?NotebookText:FileSearch;
 const label=kind==='conversation'?'对话':kind==='record'?'记录':'依据';
 return <span className="crm-evidence-action" data-dismissed={dismissed||undefined} onMouseEnter={()=>setDismissed(false)}><button type="button" className="crm-evidence-action-button" aria-label={description} aria-describedby={id} onClick={onClick} onFocus={()=>setDismissed(false)} onBlur={()=>setDismissed(false)} onKeyDown={e=>{if(e.key==='Escape'){setDismissed(true);e.stopPropagation();}}}><Icon size={16} aria-hidden="true"/><span>{ui(label)}</span></button><span className="crm-evidence-tooltip" id={id} role="tooltip">{description}</span></span>;
}
