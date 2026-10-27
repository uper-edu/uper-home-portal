import {useCrmUiLanguage} from './CrmUiLanguage';
import {Ban} from 'lucide-react';
import {crmStageValue,crmValue} from '../../utils/crmLanguage';
import {isSalesProgressStage} from '../../utils/crmSalesProgress';
/** Colour describes current progress, never predicted intent or contact permission. */
export function salesStageTone(stage?:string){return stage==='progress:enrolled'?'enrolled':stage==='progress:registration'?'registration':['progress:discovery','progress:proposal'].includes(stage||'')?'active':stage==='progress:paused'?'paused':stage==='progress:closed'?'closed':'neutral';}
export function CrmSalesStage({stage,lang:requested,historical=false}:{stage?:string;lang?:any;historical?:boolean}){
 const lang=useCrmUiLanguage(requested);
 const legacy=Boolean(stage&&!isSalesProgressStage(stage)),label=historical?crmValue(stage||'',lang):crmStageValue(stage,lang);
 return <span className="crm-sales-stage" data-stage-tone={salesStageTone(stage)}>{legacy&&!historical?<span className="crm-legacy-stage-hint" tabIndex={0} title={label} aria-label={label}>{lang==='zh'?'阶段待确认':lang==='id'?'Tahap perlu dikonfirmasi':'Stage needs confirmation'}</span>:label}</span>;
}
/** A separate restriction, even while a stage remains active or enrolled. */
export function CrmStopContact({lead,lang='zh'}:any){if(lead.contactArrangement?.state!=='stopped')return null;const label=lang==='zh'?'已停止主动联系':lang==='id'?'Kontak proaktif dihentikan':'Proactive contact stopped';return <span className="crm-stop-contact" title={lead.contactArrangement.reason||label}><Ban size={13} aria-hidden="true"/>{label}</span>;}

/** Historical stage labels keep their exact meaning; legacy values are never mapped to a new stage. */
export function CrmSalesStageChange({before,after,lang}:any){return <span className="crm-sales-stage-change">{before!=null&&<><CrmSalesStage stage={before} lang={lang} historical/><span className="crm-stage-change-arrow">→</span></>}<CrmSalesStage stage={after} lang={lang} historical/></span>;}
