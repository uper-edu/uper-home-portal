import {useCrmUiText} from './CrmUiLanguage';
import {ArrowRight} from 'lucide-react';
/** Prior values were valid historical information, not crossed-out errors. */
export function CrmProfileValueChange({before,after}:{before:string;after:string}){
 const ui=useCrmUiText();

 return <span className="crm-profile-value-change"><span className="crm-profile-value-before"><small>{ui("原值")}</small>{before}</span><ArrowRight size={14} aria-hidden="true"/><span className="crm-profile-value-after"><small>{ui("当前值")}</small>{after}</span></span>;
}
