import {CrmOperationLayer} from './CrmOperationLayer';
import {CrmFactLedger} from './CrmFactLedger';
import {useCrmExtractions} from './useCrmExtractions';
import {useCrmUiText} from './CrmUiLanguage';
import {CrmCurrentSalesState} from './CrmCurrentSalesState';
import {CrmSaveFeedback} from './CrmDetailWorkspace';
/** One viewer; the underlying customer workspace stays mounted and retains its drafts. */
export function CrmCustomerHistoryWindow({lead,ownerName,request,lang,isLight,timezone,onClose,onOpen,onBack,onConversation,onAmendSalesRecord,amendmentNotice,suspended}:any){
 const ui=useCrmUiText(lang),extraction=useCrmExtractions(lead.id,lead.simpleRevision,undefined,undefined);
 return <CrmOperationLayer history title={ui('客户全景')} context={lead.fullName} headerSummary={<CrmCurrentSalesState lead={lead} lang={lang} ownerName={ownerName}/>} {...{lang,isLight,onClose}}>
  <div className="crm-customer-history-window">{amendmentNotice&&<CrmSaveFeedback state="saved" lang={lang}>{amendmentNotice}</CrmSaveFeedback>}{onBack&&<button type="button" className="crm-work-link" onClick={onBack}>{ui("返回上一条依据")}</button>}<div className="crm-history-lane-labels"><strong>{ui("客户提供")}</strong><span>{ui("时间轴")}</span><strong>{ui("员工记录")}</strong></div><CrmFactLedger key={lead.id} leadId={lead.id} lead={lead} revision={lead.simpleRevision} {...{lang,isLight,timezone,onAmendSalesRecord,suspended}} disabled hideHeading windowMode focusRequest={request.id?{...request,token:request.token,mode:'view'}:undefined} extractions={extraction.rows} extractionLoading={extraction.loading} extractionError={extraction.error} onReloadExtraction={extraction.reload} onSource={onConversation}/></div>
 </CrmOperationLayer>;
}
