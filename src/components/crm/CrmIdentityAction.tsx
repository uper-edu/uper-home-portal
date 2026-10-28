import {ShieldQuestion} from 'lucide-react';
/** Highest-priority review action. Amber means identity awaits a decision, not overdue. */
export function CrmIdentityAction({lang,onClick,disabled=false,children}:{lang:string;onClick:()=>void;disabled?:boolean;children?:React.ReactNode}){
 return <button type="button" className="crm-work-button crm-identity-action" data-identity-priority="true" disabled={disabled} onClick={onClick}>
  <ShieldQuestion size={16} aria-hidden="true"/>{children||(lang==='zh'?'核实身份':lang==='id'?'Verifikasi identitas':'Review identity')}
 </button>;
}
