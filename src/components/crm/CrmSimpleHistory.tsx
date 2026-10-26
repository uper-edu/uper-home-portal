import {useCrmUiText} from './CrmUiLanguage';
import {CrmExtractionRows} from './CrmExtractedInformation';
import {extractionsForLog,extractionSummary} from '../../utils/crmFollowupPresentation';
import {CrmProfileSaveResult} from './CrmProfileSaveResult';
import {viewerTimeZone} from '../../utils/crmOperatingTime';
import {contactCorrectionOptions} from '../../utils/crmRecordAmendments';
import {useState} from 'react';
import {progressDetails} from '../../utils/crmProgressDetails';
import {formatCrmOperatingTime} from '../../utils/crmOperatingTime';
import {crmValue} from '../../utils/crmLanguage';
export function CrmSimpleHistory({lead,requests,lang,timezone,onSource,extractions=[],extractionLoading=false,extractionError=false,onReloadExtraction,onViewAssessment,recentSourceId,onAmend,onEvidence,amendDisabled=false,focusSourceId}:any){
 const ui=useCrmUiText(lang);

 timezone=viewerTimeZone();
 const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const [all,setAll]=useState(false);const records=[...(lead.followUpLogs||[])].reverse();
 return <section className="crm-progress-history crm-sales-records" aria-label={ui("跟进记录")}><div className="crm-followup-section-heading"><h3>{t('Progress records','Riwayat perkembangan','跟进记录')}</h3><span className="crm-work-muted">{records.length} {ui("条记录")}</span></div>

 {extractionError&&<p role="alert">{ui("AI整理状态暂不可用，原文记录仍保留。")}<button type="button" className="crm-work-link" onClick={onReloadExtraction}>{ui("重试读取")}</button></p>}

 {!records.length?<p>{t('No progress recorded yet','Belum ada catatan perkembangan','尚无跟进记录')}</p>:(all||records.findIndex((l:any)=>l.id===focusSourceId)>=5?records:records.slice(0,5)).map((log:any,i:number)=><details id={'crm-progress-log-'+log.id} key={log.id||log.at} className="crm-progress-record" open={log.id===recentSourceId||log.id===focusSourceId?true:undefined}>
 <summary><span>{log.id===recentSourceId&&<span className="crm-record-current">{ui("本次记录")}</span>}<strong>{(lead.recordAmendments||[]).some((a:any)=>a.targetLogId===log.id&&a.contactResult) ? ui("原始结果：") : ''}{!['internal','closure'].includes(log.recordKind)&&log.channel?crmValue(log.channel,lang)+' · ':''}{['internal','closure'].includes(log.recordKind)?t('Internal progress','Perkembangan internal','内部进展'):crmValue(log.connectStatus,lang)||t('Contact record','Catatan kontak','联系记录')}</strong><span className="crm-progress-meta">{log.staffName||log.actor||t('Staff not recorded','Staf tidak tercatat','未记录员工')} {ui("· 记录于")}{formatCrmOperatingTime(log.at||log.timestamp,viewerTimeZone())}</span></span><span className="crm-progress-expand"><span className="crm-when-closed">{t('View record','Lihat catatan','查看记录')}</span><span className="crm-when-open">{t('Collapse record','Tutup catatan','收起记录')}</span></span><span className="crm-record-preview">{log.summary}</span><span className="crm-record-ai-preview">{extractionsForLog(extractions,log.id)[0] ? extractionSummary(extractionsForLog(extractions,log.id)[0]) : extractionLoading ? ui("正在读取整理状态…") : ui("未显示AI整理结果，可展开核对")}</span></summary>
 <div className="crm-progress-record-body">{(()=>{const correction=(lead.recordAmendments||[]).filter((a:any)=>a.targetLogId===log.id&&a.contactResult).at(-1);return correction?<p role="note"><strong>{ui("当前采用的联系结果：")}{contactCorrectionOptions.find(o=>o[0]===correction.contactResult)?.[1]}</strong>{ui("。下方保留当时填写的原始内容。")}</p>:null;})()}<h4>{t('Original record','Catatan asli','记录原文')}</h4><p className="crm-progress-original">{log.summary||t('Not recorded','Tidak tercatat','未记录')}</p><dl>{progressDetails(log,lead,requests||[],lang,timezone).map(row=><div key={row.label}><dt>{(lead.recordAmendments||[]).some((a:any)=>a.targetLogId===log.id&&a.contactResult)&&['实际联系结果','首次跟进处理结果'].includes(row.label) ? (ui("原记录中的") + row.label) : row.label}</dt><dd>{row.value}</dd></div>)}</dl><CrmProfileSaveResult results={log.result?.profileFieldResults}/>
 {onSource&&log.sourceMessageId&&log.sourceConversationId&&<button type="button" className="crm-work-link" onClick={()=>onSource({details:log})}>{t('View linked original message','Lihat pesan asli terkait','查看关联客户原文')}</button>}
 {(lead.recordAmendments||[]).filter((a:any)=>a.targetLogId===log.id).map((a:any)=><div key={a.id}><h4>{a.kind==='correction' ? ui("后续修正") : ui("后续补充")} · {formatCrmOperatingTime(a.recordedAt,viewerTimeZone())}</h4><p>{a.text}</p>{a.reason&&<p>{ui("修正原因：")}{a.reason}</p>}{a.contactResult&&<p>{ui("联系结果修正：")}{({'Connected':'已接通／已回复','No Response':'已尝试，尚未回复','Wrong Number':'联系方式无效','Not Occurred':'未实际发生，不计数','Duplicate':'重复登记，不重复计数'}as any)[a.contactResult]}</p>}</div>)}
 <div className="crm-record-source-actions">{onEvidence&&<button type="button" className="crm-work-link" onClick={()=>onEvidence(log.id)}>{ui("查看来源与变更")}</button>}{onAmend&&<button type="button" className="crm-work-link" disabled={amendDisabled} onClick={()=>onAmend(log.id)}>{ui("补充／修正本记录")}</button>}</div>
 {extractionsForLog(extractions,log.id).length>0?<CrmExtractionRows rows={extractionsForLog(extractions,log.id)} allRows={extractions} includeSource={false} onViewAssessment={onViewAssessment}/>:<p className="crm-work-muted">{extractionLoading ? ui("正在读取AI整理状态…") : extractionError ? ui("AI整理状态暂不可用。") : ui("当前返回的整理记录中未找到本条结果；原文已保留。")}{onReloadExtraction&&<button type="button" className="crm-work-link" onClick={onReloadExtraction}>{ui("刷新整理状态")}</button>}</p>}
 </div></details>)}
 {records.length>5&&<button type="button" className="crm-work-link" onClick={()=>setAll(!all)}>{all?t('Show recent 5','Tampilkan 5 terbaru','仅显示最近5条'):t('Show all records','Tampilkan semua catatan','显示全部记录')+` (${records.length})`}</button>}
 </section>;
}
