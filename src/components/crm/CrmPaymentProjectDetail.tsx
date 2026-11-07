import {formatCurrency} from '../../utils/currency';
import {AdminFormSection} from '../AdminFormLayout';
import {formatCrmEventTime} from '../../utils/crmOperatingTime';
import {paymentSummary,type PaymentLedger,type PaymentProject} from '../../utils/crmPayments';
import {paymentEntryFact,paymentRemainingTone} from '../../utils/crmPaymentPresentation';
import {paymentMethodLabel} from '../../utils/crmPaymentMethods';
import {paymentVerificationForm,paymentReceiptForm,paymentRefundForm} from '../../utils/crmPaymentWorklist';
import {CrmPaymentSavedImages} from './CrmPaymentImages';
import {CrmPaymentStatus} from './CrmPaymentStatus';
import {CrmPaymentMoreActions} from './CrmPaymentMoreActions';
export {paymentDetailStateLabel} from './CrmPaymentStatus';
/** Read-only purchase and receipt facts; commands are explicitly chosen by the parent. */
export function CrmPaymentProjectDetail({project:p,ledger,leadId,ownerName='',people={},lang,canVerify=false,canSubmit=false,canReviseProject=false,canTerminate=false,verificationOnly=false,focusEntryId,disabled=false,onChoose}: {project:PaymentProject;ledger:PaymentLedger;leadId:string;ownerName?:string;people?:Record<string,string>;lang:string;canVerify?:boolean;canSubmit?:boolean;canReviseProject?:boolean;canTerminate?:boolean;verificationOnly?:boolean;focusEntryId?:string;disabled?:boolean;onChoose:(form:any)=>void}){
 const t=(zh:string,en:string,id:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const money=(n:number|null)=>n===null?t('未确定','Not agreed','Belum ditetapkan'):formatCurrency(n,lang);
 const s=paymentSummary(ledger,p),entries=ledger.entries.filter(e=>e.projectId===p.id&&(!focusEntryId||e.id===focusEntryId)).sort((a,b)=>String(paymentEntryFact(b).at||b.createdAt).localeCompare(String(paymentEntryFact(a).at||a.createdAt))||b.createdAt.localeCompare(a.createdAt));
 const person=(id:string)=>people[id]||id;
 const pendingReceipt=ledger.entries.some(e=>e.projectId===p.id&&e.kind==='receipt'&&e.state==='pending');
 const pendingRefund=ledger.entries.some(e=>e.projectId===p.id&&e.kind==='refund'&&e.state==='pending');
 const submittedRecord=(id:string)=>ledger.history.find(h=>h.action==='verify'&&(h.before as any)?.id===id)?.before as any;
 return <AdminFormSection className="crm-payment-project-detail" title={<><span className="crm-payment-course-title">{p.course}{p.priceSnapshot?.sessions&&<span className="crm-payment-course-meta"> · {p.priceSnapshot.sessions} {t('课时','sessions','pertemuan')}</span>}</span><CrmPaymentStatus state={s.state} lang={lang}/></>} actions={<>
  {canVerify&&!focusEntryId&&s.state!=='paid'&&s.state!=='nocharge'&&<button type="button" className="crm-work-button" data-primary disabled={disabled||pendingReceipt} onClick={()=>onChoose(paymentReceiptForm(p.id))}>{t('核验收款','Verify payment','Verifikasi pembayaran')}</button>}
  {canSubmit&&!verificationOnly&&<button type="button" className="crm-work-button" disabled={disabled} onClick={()=>onChoose({action:'submit',projectId:p.id,kind:'receipt',amount:'',time:'',method:'',evidence:''})}>{t('登记付款','Record payment','Catat pembayaran')}</button>}
  {canVerify&&!focusEntryId&&<CrmPaymentMoreActions label={t('更多操作','More actions','Tindakan lain')} disabled={disabled}>
   {(s.state==='paid'||s.state==='nocharge')&&<button type="button" className="crm-work-link" disabled={disabled||pendingReceipt} onClick={()=>onChoose(paymentReceiptForm(p.id))}>{t('登记额外到账','Record additional receipt','Catat penerimaan tambahan')}</button>}
   <button type="button" className="crm-work-link" disabled={disabled||s.net<=0||pendingRefund} onClick={()=>onChoose(paymentRefundForm(p.id))}>{t('登记已退款项','Record completed refund','Catat pengembalian selesai')}</button>
   {(pendingRefund||s.net<=0)&&<p className="crm-work-muted">{pendingRefund?t('请先核对下方待核验退款。','Review the pending refund below first.','Periksa pengembalian menunggu di bawah dahulu.'):t('暂无可退款的已核实收款。','No verified funds are available for refund.','Belum ada penerimaan terverifikasi untuk dikembalikan.')}</p>}
  </CrmPaymentMoreActions>}
  {canReviseProject&&!verificationOnly&&!p.priceSnapshot&&!p.termination&&<button type="button" className="crm-work-button" disabled={disabled} onClick={()=>onChoose({action:'revise_project',projectId:p.id,course:p.course,expected:p.expected??'',reason:''})}>{t('更正项目','Correct project','Koreksi proyek')}</button>}
  {canTerminate&&!verificationOnly&&!p.termination&&<button type="button" className="crm-work-button" disabled={disabled}
    onClick={()=>onChoose({action:'terminate',projectId:p.id,time:'',reason:''})}>{t('终止报名','Terminate enrollment','Hentikan pendaftaran')}</button>}
  {canReviseProject&&!verificationOnly&&p.termination&&<button type="button" className="crm-work-button" disabled={disabled}
    onClick={()=>onChoose({action:'settle',projectId:p.id,amount:p.settlement?.amount??'',reason:''})}>
    {p.settlement?t('更正结算','Correct settlement','Koreksi penyelesaian'):t('确认结算','Confirm settlement','Konfirmasi penyelesaian')}
  </button>}
 </>}>
 {p.termination&&s.settlement&&<div className="crm-payment-purchase-meta">
  <p>{t('终止生效','Termination effective','Berlaku sejak')}：{formatCrmEventTime(p.termination.effectiveAt)} · {person(p.termination.actor)}</p>
  <p>{t('终止原因','Termination reason','Alasan penghentian')}：{p.termination.reason}</p>
  <p><CrmPaymentStatus state={'settlement_'+s.settlement.state} lang={lang}/>
    {s.settlement.state==='collect'&&<> · {money(s.settlement.due)}</>}
    {s.settlement.state==='refund'&&<> · {money(s.settlement.refund)}</>}
    {p.settlement&&<> · {t('最终应结','Final amount due','Jumlah akhir')} {money(p.settlement.amount)}</>}
  </p>
  {p.settlement&&<p>{t('结算依据','Settlement basis','Dasar penyelesaian')}：{p.settlement.basis}</p>}
 </div>}
 {canVerify&&!focusEntryId&&pendingReceipt&&<p className="crm-work-muted">{t('已有待核验付款，请核对下方原记录。','Review the pending payment below first.','Periksa pembayaran menunggu di bawah terlebih dahulu.')}</p>}
 <div className="crm-payment-purchase-meta"><p>{t('销售负责人','Sales owner','Penanggung jawab')}：<strong>{ownerName||t('未分配','Unassigned','Belum ditugaskan')}</strong> · {t('报名确认','Enrolled','Pendaftaran')}：{formatCrmEventTime(p.createdAt)}{p.createdBy&&person(p.createdBy)!==ownerName&&<> · {t('报名经办人','Enrollment recorded by','Pencatat pendaftaran')}：{person(p.createdBy)}</>}</p>{p.priceSnapshot&&<p>{t('标准价','Standard price','Harga standar')}：{money(p.priceSnapshot.standardPrice)} · {t('优惠','Discount','Diskon')}：{money(p.priceSnapshot.discountAmount)}</p>}</div>
 <dl className="crm-payment-summary"><div><dt>{s.settlement?t('原合同应收','Original contract amount','Tagihan kontrak awal'):t('应收','Amount due','Tagihan')}</dt><dd>{money(p.expected)}</dd></div><div><dt>{t('累计到账','Total receipts','Total penerimaan')}</dt><dd>{money(s.received)}</dd></div><div><dt>{t('已退款','Refunded','Dikembalikan')}</dt><dd>{money(s.refunded)}</dd></div><div><dt>{s.settlement?t('净实收','Net receipts','Penerimaan bersih'):t('剩余应收','Remaining','Sisa tagihan')}</dt><dd className="crm-payment-balance" data-tone={paymentRemainingTone(s)}>{money(s.settlement?s.net:s.remaining)}</dd></div></dl>
 {(s.pending>0||s.overpaid>0||s.refunded>0)&&<div className="crm-payment-summary-notes">
  {s.pending>0&&<span className="crm-payment-status" data-tone="warning">{t('待核验','Pending verification','Menunggu verifikasi')} · {s.pending}</span>}
  {s.overpaid>0&&<span className="crm-payment-status" data-tone="warning">{t('超收','Overpayment','Kelebihan pembayaran')} · {money(s.overpaid)}</span>}
  {s.refunded>0&&!s.settlement&&<><p className="crm-work-muted">{t('净收款','Net receipts','Penerimaan bersih')}：{money(s.received)} − {money(s.refunded)} = {money(s.net)}</p><p className="crm-work-muted">{t('退款不自动调整约定应收；退课或合同变更需另行确认。','Refunds do not adjust the agreed amount due. Course cancellations or contract changes require separate confirmation.','Pengembalian tidak mengubah tagihan yang disepakati. Pembatalan kursus atau perubahan kontrak perlu dikonfirmasi terpisah.')}</p></>}
 </div>}
 <h4 className="crm-payment-records-title">{t('支付历史','Payment history','Riwayat pembayaran')} · {entries.length}</h4>
 {!entries.length&&<p className="crm-work-muted">{t('暂无付款或退款记录','No payments or refunds yet','Belum ada pembayaran atau pengembalian')}</p>}
 {entries.map(e=>{const fact=paymentEntryFact(e),original=submittedRecord(e.id)||e,voidHistory=[...ledger.history].reverse().find(h=>h.action==='void'&&(h.after as any)?.id===e.id);
  return <article key={e.id} data-payment-entry={e.id} className="crm-payment-entry"><header><strong>{e.kind==='receipt'?t('付款','Payment','Pembayaran'):t('退款','Refund','Pengembalian')} · {money(fact.amount)}</strong><CrmPaymentStatus state={e.state} lang={lang}/></header>
   <p className="crm-work-muted">{fact.verified?(e.kind==='refund'?t('退款','Refunded','Dikembalikan'):t('到账','Received','Diterima')):(e.kind==='refund'?t('登记退款','Reported refund','Pengembalian dilaporkan'):t('登记付款','Reported payment','Pembayaran dilaporkan'))} {formatCrmEventTime(fact.at)} · {paymentMethodLabel(e,lang)}{e.provider&&` · ${e.provider}`}</p>
   {e.state==='void'&&<p className="crm-work-muted">{t('已作废，不计入汇总','Voided; excluded from totals','Dibatalkan; tidak dihitung dalam total')}</p>}
   <div className="crm-payment-record-tools"><details className="crm-payment-evidence"><summary>{t('详情与凭证','Details & evidence','Detail & bukti')}</summary><div>
    <p>{t('原登记金额','Original reported amount','Jumlah laporan asli')}：{money(e.amount)} · {formatCrmEventTime(e.reportedAt)}</p>
    {e.evidence&&<p>{t('原始备注','Original notes','Catatan asli')}：{e.evidence}</p>}
    {e.verifiedAmount!==undefined&&(e.verifiedAmount!==e.amount||e.receivedAt!==e.reportedAt)&&<p>{t('核实金额','Verified amount','Jumlah terverifikasi')}：{money(e.verifiedAmount)} · {formatCrmEventTime(e.receivedAt)}</p>}
    {e.verificationEvidence&&e.verificationEvidence!==e.evidence&&<p>{t('核验备注','Verification notes','Catatan verifikasi')}：{e.verificationEvidence}</p>}
    {(original.account||original.reference)&&(e.verifiedAmount===undefined||original.account!==e.account||original.reference!==e.reference)&&<p>{t('原登记账户与流水','Original account and reference','Rekening dan referensi asli')}：{original.account} · {original.reference}</p>}
    {e.verifiedAmount!==undefined&&<p>{e.accountRole==='refund_destination'?t('退款去向与流水','Refund destination and reference','Tujuan dan referensi pengembalian'):e.accountRole==='company_receiving'?t('公司收款账户与流水','Company receiving account and reference','Rekening penerima perusahaan dan referensi'):t('核实账户与流水（原记录）','Verified account and reference (original record)','Rekening dan referensi terverifikasi (catatan asli)')}：{e.account} · {e.reference}</p>}
    <CrmPaymentSavedImages images={[...(e.images||[]),...(e.verificationImages||[])]} leadId={leadId} lang={lang}/>
    {e.reason&&<p>{t('原因','Reason','Alasan')}：{e.reason}</p>}
    <p className="crm-work-muted">{t('登记','Recorded','Dicatat')}：{person(e.createdBy)} · {formatCrmEventTime(e.createdAt)}{e.verifiedBy&&` / ${e.state==='rejected'?t('退回','Returned','Dikembalikan'):t('核验','Verified','Diverifikasi')}：${person(e.verifiedBy)} · ${formatCrmEventTime(e.verifiedAt)}`}</p>
    {voidHistory&&<p className="crm-work-muted">{t('作废','Voided','Dibatalkan')}：{person(voidHistory.actor)} · {formatCrmEventTime(voidHistory.at)}</p>}
   </div></details>
   {canVerify&&e.state==='verified'&&<CrmPaymentMoreActions label={t('更多操作','More actions','Tindakan lain')} disabled={disabled}><button type="button" className="crm-work-link" disabled={disabled} onClick={()=>onChoose({action:'void',entryId:e.id,reason:''})}>{t('作废误记','Void mistaken entry','Batalkan catatan keliru')}</button></CrmPaymentMoreActions>}
   </div>
   {canVerify&&e.state==='pending'&&<div className="crm-payment-entry-actions"><button type="button" className="crm-work-button" data-primary disabled={disabled} onClick={()=>onChoose(paymentVerificationForm(e))}>{e.kind==='refund'?t('核实退款','Verify refund','Verifikasi pengembalian'):t('核实到账','Verify receipt','Verifikasi penerimaan')}</button><button type="button" className="crm-work-button" disabled={disabled} onClick={()=>onChoose({action:'reject',entryId:e.id,reason:''})}>{t('退回','Return','Kembalikan')}</button></div>}
  </article>;
 })}
 </AdminFormSection>;
}
