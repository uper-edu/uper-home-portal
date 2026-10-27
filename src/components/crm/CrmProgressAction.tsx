import {useId,type ReactNode} from 'react';
import type {ProgressActionState} from '../../utils/crmProgressAction';
export function CrmProgressAction({state,busy=false,lang='zh',primary=true,icon,onClick}:{state:ProgressActionState;busy?:boolean;lang?:string;primary?:boolean;icon?:ReactNode;onClick:()=>void}){
 const id=useId();if(state==='hidden')return null;
 const reason=lang==='zh'?'请先自己认领':lang==='id'?'Klaim pelanggan ini terlebih dahulu':'Claim this customer first';
 const label=busy?(lang==='zh'?'保存中…':lang==='id'?'Menyimpan…':'Saving…'):(lang==='zh'?'记录进展':lang==='id'?'Catat perkembangan':'Record progress');
 const button=<button type="button" className="crm-work-button" data-primary={primary&&state==='enabled'} disabled={busy||state==='claim'} aria-describedby={state==='claim'?id:undefined} onClick={onClick}>{icon}{label}</button>;
 return state==='claim'?<span className="crm-progress-action-group">{button}<span id={id} className="crm-progress-action-reason">{reason}</span></span>:button;
}
