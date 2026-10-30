import {Ban,Clock3,ShieldQuestion} from 'lucide-react';
import {contactRestriction} from '../../utils/crmContact';
import {formatCrmOperatingTime,viewerTimeZone} from '../../utils/crmOperatingTime';
import {useCrmUiText} from './CrmUiLanguage';
import {CrmSalesStage,CrmStopContact} from './CrmSalesStage';

/** Current authorized lead values only. Historical events and contact evidence never set a stage. */
export function CrmIdentityStatus({lead,lang='zh',explain=false}:{lead:any;lang?:string;explain?:boolean}){
 const ui=useCrmUiText(lang);
 if(!lead.identityReview?.pending)return null;
 return <><span className="crm-current-restriction" data-restriction="identity"><ShieldQuestion size={14} aria-hidden="true"/>{ui('身份待核实')}</span>{explain&&!lead.identityReview.canReview&&<span className="crm-current-state-label">{ui('核实后可认领和联系')}</span>}</>;
}
export function CrmCurrentSalesState({lead,lang='zh',compact=false,ownerName,explainIdentity=false,now=Date.now()}:{lead:any;lang?:string;compact?:boolean;ownerName?:string;explainIdentity?:boolean;now?:number}){
 const ui=useCrmUiText(lang),restriction=contactRestriction(lead,now),at=lead.contactReview?.reviewAt;
 return <section className={'crm-current-sales-state'+(compact?' is-compact':'')} aria-label={ui('当前销售阶段与联系限制')}>
  {(lead.currentStage?.trim()||!lead.identityReview?.pending)&&<div className="crm-current-stage"><span className="crm-current-state-label">{ui('当前阶段')}</span><CrmSalesStage stage={lead.currentStage} lang={lang}/></div>}
  {ownerName!==undefined&&<span className="crm-current-owner"><span className="crm-current-state-label">{ui('负责人')}</span>{ownerName}</span>}
  <CrmIdentityStatus lead={lead} lang={lang} explain={explainIdentity}/>
  {restriction==='stopped'&&<span className="crm-current-restriction" data-restriction="stopped"><CrmStopContact lead={lead} lang={lang}/></span>}
  {restriction==='legacy'&&<span className="crm-current-restriction" data-restriction="legacy" title={lead.contactArrangement?.reason||undefined}><Ban size={14} aria-hidden="true"/>{ui('原联系安排待核对')}</span>}
  {restriction==='until'&&<span className="crm-current-restriction" data-restriction="until" title={lead.contactReview?.reason||undefined}><Clock3 size={14} aria-hidden="true"/>{ui('约定时间前不主动联系')}{at&&Number.isFinite(Date.parse(at))?<time dateTime={at}>{formatCrmOperatingTime(at,viewerTimeZone())}</time>:<span>{ui('时间待核对')}</span>}</span>}
 </section>;
}
