import {ScanEye} from 'lucide-react';
import {crmUiText} from '../../utils/crmUiText';
/** Shared read-only panorama entry; accent identifies an action, not an AI result. */
export function CrmCustomer360Button({lang,onClick}:{lang:string;onClick:()=>void}){
 return <button type="button" className="crm-work-button crm-customer360-button" onClick={onClick}><ScanEye size={17} aria-hidden="true"/><span>{crmUiText('客户全景',lang)}</span></button>;
}
