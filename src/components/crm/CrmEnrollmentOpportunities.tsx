import {AdminRefreshAction} from '../admin/AdminRefreshAction';
import {AdminDisclosure} from '../admin/AdminDisclosure';
import {AdminListState,AdminListTable} from '../admin/AdminList';
import {AdminRecordHeader} from '../admin/AdminRecordHeader';
import {useAdminRecordSidebarLayout} from '../admin/AdminRecordWorkspace';
import {AdminRecordEntry,AdminRowAction} from '../admin/AdminListControl';
import { GraduationCap, NotebookPen } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {containPaneKeys, revealRecord} from '../adminScroll';
import {CrmDetailActions, CrmRecordFilters, CrmRecordRow, CrmRecordSearch, CrmRecordSidebar, CrmRecordTitle} from './CrmRecordWorkspace';
import { CrmListFilters, CrmListSearch, CrmListStatus, CrmListTable, enrollmentListTone, CrmListViews } from './CrmList';
import { enrollmentClassManagementPath } from '../../utils/crmEnrollmentManagement';
import { useEffect, useMemo, useRef, useState, type MouseEventHandler } from 'react';
import { AdminPageHeader } from '../admin/AdminPageHeader';
import { AdminPageAction } from '../admin/AdminPageAction';
import { CrmSalesStage } from './CrmSalesStage';
import { CrmIdentityStatus } from './CrmCurrentSalesState';
import { assistanceMailLabel, CrmEnrollmentAssistance, type AssistanceResult } from './CrmEnrollmentAssistance';
import type { PurchaseIntentResult } from './CrmOpenEnrollmentOpportunity';
import { AdminSingleSelect } from '../admin/AdminSingleSelect';
import type { CrmLanguage } from '../../utils/crmLanguage';
import { crmInstant, formatCrmEventTime, formatCrmSummaryTime, validateLocalInstant, viewerTimeZone } from '../../utils/crmOperatingTime';
import type {PrivateLessonRegistration} from '../../utils/enrollmentInterestRecords';
import { formatCurrency } from '../../utils/currency';
import { progressLabel, salesProgressStages } from '../../utils/crmSalesProgress';
import { interestOption } from '../../utils/enrollmentInterestCopy';
import {enrollmentStatuses} from '../../utils/enrollmentOrderStatus';
import { CrmOperationLayer } from './CrmOperationLayer';
import { AdminField, AdminFieldLabel, AdminForm, AdminRequiredNote } from '../AdminForm';
import { AdminFormActions, AdminFormFeedback, AdminSavedReadError } from '../AdminFormLayout';
import { describeFollowUpTask } from '../../utils/crmFollowUp';
import { CrmSimpleWorkflow } from './CrmSimpleWorkflow';
import { CrmSaveFeedback, useCrmShellHeight, useRecordScrollMode } from './CrmDetailWorkspace';
import { AdminDiscardDialog } from '../admin/AdminDiscardDialog';
import { opportunityFilterDefaults as filterDefaults,opportunityListPath,type OpportunityFilters as Filters } from '../../utils/crmEnrollmentOpportunityRoute';
import { contactEmailText, validContactEmail } from '../../utils/contactEmail';
import { CrmEnrollmentReviewDeadline } from './CrmEnrollmentReviewDeadline';
import { CrmOpportunitySourceLink } from './CrmOpportunitySources';
import type { OpportunitySource } from '../../utils/crmOpportunitySources';

type Copy = readonly [string,string,string];
type CourseRecord = {
  id:string; kind:'order'|'waitlist'|'demand'; opportunityId:string|null; state:string; createdAt?:string|null;
  class:{id?:string;level:string;firstLesson:string;schedule:string;opened:boolean}|null;
  criteria:{level:string;period:string;format:string;notes:string}|null;
  price:number|null;received:number|null;learnerName?:string|null;paymentDueAt?:string|null;firstReviewDueAt?:string|null;
  attribution?:{entry:string;via?:string;source?:string;campaign?:string;campaignId?:string;promotionId?:string;promotionName?:string;verified:boolean}|null;
  latestNotice?:string;
  enrollmentEmail?:string;
  canLinkOpportunity?:boolean;
  appointment?:{confirmation:NonNullable<PrivateLessonRegistration['confirmation']>|null};
};
type EnrollmentEmail = {id:string;orderId:string;kind:string;state:string;subject:string|null;language:string|null;recordedAt:string};
type OpportunityFollowup = {kind:'agreement'|'task';id:string;type?:string;action?:string;at?:string;date?:string};
type Opportunity = {
  id:string; level:string;customerId:string;customerName:string;businessNumber:string;owner:string|null;identityPending:boolean;
  state:'enrolled'|'aftercare'|'applying'|'waiting'|'interest'|'closed';records:CourseRecord[];salesStage:string;revision:number;
  emails?:EnrollmentEmail[];assistanceDueAt?:string;canAssist?:boolean;
  chatEvidence?:OpportunitySource[];
  assistance?:{email:string;phone:string;allowed:boolean};
  assistanceHistory?:AssistanceResult&{classId:string;orderId?:string;actor:string;createdAt:string;confirmedAt?:string;active:number};
  progress?:{id:string;actor:string;stage:string;note:string;createdAt:string;factId?:string;sources?:OpportunitySource[]}[];canProgress?:boolean;canInitiateFollowup?:boolean;followup?:OpportunityFollowup|null;
};
type OpportunityList = {opportunities:Opportunity[];customer?:{id:string;name:string}};

function opportunityDisplayName(row:Opportunity) {
  return [...row.records].reverse().find(record=>record.learnerName?.trim())?.learnerName?.trim()||row.customerName;
}

function opportunityTitle(row:Opportunity) {
  return `${opportunityDisplayName(row)} · ${row.level}`;
}

function comparisonText(value:string) {
  return value.normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase();
}

/** Distinguish homonyms in the authorized list even when a local filter hides another match. */
function opportunityReferences(rows:Opportunity[]) {
  const groups=new Map<string,Opportunity[]>();
  for(const row of rows){
    const title=comparisonText(opportunityTitle(row));
    const group=groups.get(title);
    if(group)group.push(row);
    else groups.set(title,[row]);
  }
  const references=new Map<string,string>();
  for(const group of groups.values()){
    if(group.length<2)continue;
    const shortCounts=new Map<string,number>();
    for(const {id} of group){
      const shortId=id.slice(-8);
      shortCounts.set(shortId,(shortCounts.get(shortId)??0)+1);
    }
    for(const {id} of group){
      const shortId=id.slice(-8);
      references.set(id,shortCounts.get(shortId)===1?shortId:id);
    }
  }
  return references;
}

const base = '/api/crm/opportunities';
const t = (lang:CrmLanguage,copy:Copy) => copy[lang==='zh'?0:lang==='id'?2:1];
const kinds:Record<CourseRecord['kind'],Copy> = {
  order:['报名申请','Enrollment application','Permohonan pendaftaran'],
  waitlist:['班次候补','Class waitlist','Daftar tunggu kelas'],
  demand:['选课需求','Course preferences','Preferensi kursus'],
};
const states:Record<string,Copy> = {
  awaiting_payment:['待付款','Awaiting payment','Menunggu pembayaran'],
  proof_review:['凭证待核实','Proof awaiting review','Bukti menunggu pemeriksaan'],
  partial:['部分到账','Partially paid','Dibayar sebagian'],paid:['报名成功','Enrollment confirmed','Pendaftaran berhasil'],
  paid_cancelled:enrollmentStatuses.paid_cancelled,
  recovered:['已恢复报名','Enrollment restored','Pendaftaran dipulihkan'],
  expired:['订单已终止','Order expired','Pesanan kedaluwarsa'],
  ended:enrollmentStatuses.ended,
  refunding:['退款处理中','Refund in progress','Pengembalian diproses'],
  refunded:['退款已完成','Refund complete','Pengembalian selesai'],
  waiting:['候补中','On waitlist','Dalam daftar tunggu'],
  converted:['已转申请','Converted to application','Menjadi permohonan'],
  withdrawn:['已撤回','Withdrawn','Ditarik'],closed:['已结束','Closed','Ditutup'],
  active:['有效','Active','Aktif'],
  awaiting_confirmation:['待学员确认','Awaiting learner confirmation','Menunggu konfirmasi siswa'],
  purchase_intent:['购课意向','Purchase intent','Minat membeli kursus'],
};
const next:Record<Opportunity['state'],Copy> = {
  enrolled:['已报名','Enrolled','Terdaftar'], applying:['办理报名','Complete enrollment','Selesaikan pendaftaran'],
  aftercare:['处理转班或退款','Arrange transfer or refund','Tangani pindah kelas atau pengembalian'],
  waiting:['等待班次空位','Wait for a seat','Menunggu kursi'],
  interest:['跟进选课需求','Follow up on course preferences','Tindak lanjuti preferensi kursus'],
  closed:['已结束','Closed','Ditutup'],
};
const enrollmentStatus:Record<Opportunity['state'],string> = {
  enrolled:'paid',aftercare:'paid_cancelled',applying:'awaiting_payment',waiting:'waiting',interest:'active',closed:'closed',
};
const requiresPaymentReview=(record:CourseRecord)=>record.state==='proof_review'||record.state==='partial';
function currentStatus(row:Opportunity) {
  if(row.assistanceDueAt&&['interest','waiting'].includes(row.state)&&!ended(row))return 'awaiting_confirmation';
  if(row.state==='applying') return row.records.find(requiresPaymentReview)?.state??'awaiting_payment';
  if(row.state==='closed') return row.records.at(-1)?.state??'closed';
  if(row.state==='interest'&&!row.records.length)return 'purchase_intent';
  return enrollmentStatus[row.state];
}
function ended(row:Opportunity) {
  return ['enrolled','closed'].includes(row.state)||row.salesStage==='progress:closed';
}

function opportunityNextStep(row:Opportunity,lang:CrmLanguage,prioritizePaymentReview:boolean) {
  if(ended(row))return {kind:'text',label:t(lang,next[row.state==='enrolled'?'enrolled':'closed'])} as const;
  if(row.identityPending)return {kind:'text',label:t(lang,['待核实身份','Identity review pending','Identitas menunggu verifikasi'])} as const;
  const review=row.state==='applying'?row.records.find(requiresPaymentReview):undefined;
  if(review&&prioritizePaymentReview)return {kind:'review',record:review} as const;
  const due=row.records.find(record=>record.state==='awaiting_payment')?.paymentDueAt;
  if(row.followup){
    const followup=row.followup;
    const name=followup.action||describeFollowUpTask({
      id:followup.id,kind:followup.type||'',dueAt:followup.at||'',ownerId:row.owner||'',status:'pending',
    },lang,viewerTimeZone()).action;
    const label=due?t(lang,['跟进付款','Follow up on payment','Tindak lanjuti pembayaran']):name;
    return {kind:'followup',followup,label,name} as const;
  }
  if(currentStatus(row)==='awaiting_confirmation')return {kind:'confirm',due:row.assistanceDueAt!} as const;
  if(review)return {kind:'review',record:review} as const;
  if(due)return {kind:'payment',due} as const;
  if(row.state==='interest'&&!row.records.length)
    return {kind:'text',label:t(lang,['跟进购课意向','Follow up on purchase intent','Tindak lanjuti minat membeli kursus'])} as const;
  return {kind:'text',label:t(lang,next[row.state])} as const;
}

function stage(row:Opportunity,lang:CrmLanguage) {
  if (row.identityPending) return t(lang,['身份待核实','Identity review pending','Identitas menunggu verifikasi']);
  return progressLabel(row.salesStage,lang);
}
function read<T>(path:string,signal:AbortSignal):Promise<T> {
  return fetch(path,{signal,cache:'no-store'}).then(async response=>{
    if (!response.ok) throw Error(String(response.status));
    return response.json();
  });
}
function crmHref(values:Record<string,string>) {
  return '/crm?'+new URLSearchParams(values).toString();
}

function CustomerOpportunityNextStep({row,lang,recordHref,onNavigate}:{
  row:Opportunity;lang:CrmLanguage;recordHref:string;onNavigate:MouseEventHandler<HTMLAnchorElement>;
}) {
  const step=opportunityNextStep(row,lang,true);
  switch(step.kind){
    case 'review': return <AdminRowAction href={recordHref+'&'+new URLSearchParams({enrollmentRecord:step.record.id})} onClick={onNavigate}>
      {t(lang,['查看核验进度','View verification progress','Lihat status verifikasi'])}
    </AdminRowAction>;
    case 'followup': return <>{step.label}{(step.followup.at||step.followup.date)&&
      <small><time dateTime={step.followup.at||step.followup.date}>
        {step.followup.at?formatCrmSummaryTime(step.followup.at):step.followup.date}
      </time></small>}</>;
    case 'payment': return <>{t(lang,['等待学员付款','Wait for learner payment','Tunggu pembayaran siswa'])}
      <small><time dateTime={step.due}>{formatCrmSummaryTime(step.due)}</time></small></>;
    case 'confirm': return <>{t(lang,['等待学员确认','Wait for learner confirmation','Tunggu konfirmasi siswa'])}
      <small><time dateTime={step.due}>{formatCrmSummaryTime(step.due)}</time></small></>;
    default: return step.label;
  }
}

export function CrmCustomerOpportunities({customerId,actorId,lang,refreshVersion,onNavigate,onRegister,registerBusy,purchaseIntentNotice}:{
  customerId:string;actorId:string;lang:CrmLanguage;refreshVersion:number;
  onNavigate:MouseEventHandler<HTMLAnchorElement>;onRegister?:()=>void;registerBusy:boolean;
  purchaseIntentNotice?:PurchaseIntentResult;
}) {
  const [retry,setRetry]=useState(0);
  const scope=JSON.stringify([actorId,customerId]);
  const [result,setResult]=useState<{scope:string;rows?:Opportunity[];failure?:'denied'|'error'}>();
  const current=result?.scope===scope?result:undefined;
  useEffect(()=>{
    const controller=new AbortController();
    setResult(previous=>previous?.scope===scope&&!previous.failure?previous:undefined);
    void read<OpportunityList>(base+'?'+new URLSearchParams({customerId}),controller.signal).then(
      data=>{if(!controller.signal.aborted)setResult({scope,rows:data.opportunities});},
      (error:Error)=>{
        if(!controller.signal.aborted)setResult({scope,failure:['401','403','404'].includes(error.message)?'denied':'error'});
      });
    return ()=>controller.abort();
  },[customerId,scope,refreshVersion,retry]);
  const rows=current?.rows;
  const active=rows?.filter(row=>!ended(row))??[];
  const history=rows?.filter(ended)??[];
  const references=opportunityReferences(rows??[]);
  const listPath=opportunityListPath({...filterDefaults,opportunityOwner:'all',opportunityStatus:'all'},customerId);
  const label=t(lang,['商机','Opportunity','Peluang']);
  const activeLabel=t(lang,['进行中商机','Active opportunities','Peluang berlangsung']);
  const historyLabel=t(lang,[`历史商机（${history.length}）`,`Past opportunities (${history.length})`,`Riwayat peluang (${history.length})`]);
  const statusLabel=t(lang,['当前状态','Current status','Status saat ini']);
  const table=(entries:Opportunity[],historical:boolean)=><AdminListTable
    className="crm-customer-opportunity-table" label={historical?historyLabel:activeLabel}
    headers={historical?[label,statusLabel]:[label,statusLabel,t(lang,['下一步','Next step','Langkah berikutnya'])]}>
    {entries.map(row=>{
      const href=listPath+'&'+new URLSearchParams({opportunity:row.id});
      const status=currentStatus(row);
      const showSalesStage=status==='purchase_intent'&&['progress:discovery','progress:proposal','progress:registration','progress:paused'].includes(row.salesStage);
      const reference=references.get(row.id);
      const title=opportunityTitle(row);
      const referenceLabel=reference?t(lang,[`商机编号 ${reference}`,`Opportunity ID ${reference}`,`ID peluang ${reference}`]):undefined;
      const statusLabelCopy=row.state==='enrolled'?t(lang,next.enrolled):
        status==='active'&&row.records.some(record=>record.kind==='demand'&&record.state==='active')
          ?t(lang,['待匹配班次','Awaiting a matching class','Menunggu kelas yang sesuai'])
          :states[status]?t(lang,states[status]):status;
      return <tr key={row.id}>
        <td><AdminRecordEntry href={href} onClick={onNavigate} aria-label={referenceLabel?`${title} · ${referenceLabel}`:undefined}>{title}</AdminRecordEntry>
          {referenceLabel&&<small>{referenceLabel}</small>}</td>
        <td>{showSalesStage
          ? <CrmSalesStage stage={row.salesStage} lang={lang}/>
          : <CrmListStatus tone={enrollmentListTone(status)}>{statusLabelCopy}</CrmListStatus>}</td>
        {!historical&&<td><CustomerOpportunityNextStep row={row} lang={lang} recordHref={href} onNavigate={onNavigate}/></td>}
      </tr>;
    })}
  </AdminListTable>;
  return <section className="crm-customer-opportunities" aria-labelledby="crm-customer-opportunities">
    <header>
      <h3 id="crm-customer-opportunities">{activeLabel}</h3>
      <div className="crm-trust-actions">
        {!!rows?.length&&<AdminRowAction href={listPath} onClick={onNavigate}>{t(lang,['查看全部商机','View all opportunities','Lihat semua peluang'])}</AdminRowAction>}
        {onRegister&&<button type="button" className="crm-work-button" disabled={registerBusy} onClick={onRegister}>
          {t(lang,['登记购课意向','Record course purchase intent','Catat minat membeli kursus'])}
        </button>}
      </div>
    </header>
    {purchaseIntentNotice&&<AdminFormFeedback state="saved" lang={lang}>
      {purchaseIntentNotice.created?t(lang,['已创建商机。','Opportunity created.','Peluang baru dibuat.']):
        t(lang,[`已记入 ${purchaseIntentNotice.level} 商机。`,`Intent recorded on the ${purchaseIntentNotice.level} opportunity.`,`Minat dicatat pada peluang ${purchaseIntentNotice.level}.`])}
    </AdminFormFeedback>}
    {current?.failure?<AdminListState lang={lang} state={current.failure}
      onRetry={()=>setRetry(value=>value+1)}/>:
      !rows?<AdminListState lang={lang} state="loading"/>:
      active.length?table(active,false):
        <AdminListState lang={lang} state="empty"
          message={t(lang,['暂无进行中的商机。','No active opportunities.','Belum ada peluang yang berlangsung.'])}/>}
    {!!history.length&&<AdminDisclosure heading={historyLabel} density="compact">{table(history,true)}</AdminDisclosure>}
  </section>;
}
const emailKind:Record<string,Copy> = {
  seat_reserved:['已获席','Seat reserved','Kursi dipesan'],
  proof_received:['凭证回执','Proof receipt','Tanda terima bukti'],
  payment_confirmed:['报名成功','Enrollment confirmed','Pendaftaran berhasil'],
  payment_and_opening:['报名与开班确认','Enrollment and class confirmation','Konfirmasi pendaftaran dan kelas'],
  class_confirmed:['开班确认','Class confirmation','Konfirmasi kelas'],
  class_cancelled:['不开班通知','Class cancellation','Pembatalan kelas'],
  transfer_invitation:['转班邀请','Transfer invitation','Undangan pindah kelas'],
  refund_accepted:['退款受理','Refund accepted','Pengembalian diterima'],
  refund_recorded:['退款进度','Refund progress','Kemajuan pengembalian'],
};
const emailDelivery:Record<string,Copy> = {
  simulated:['模拟记录','Simulated record','Catatan simulasi'],
  queued:['待发送／等待额度','Queued / waiting for quota','Dalam antrean / menunggu kuota'],
  accepted:['SMTP 已接收','SMTP accepted','Diterima SMTP'],
  unknown:['结果待核对','Outcome unknown','Hasil belum pasti'],
  delivered:['已送达','Delivered','Terkirim'],
  failed:['投递失败','Delivery failed','Pengiriman gagal'],
};
const emailLocale:Record<string,Copy> = {
  zh:['中文','Chinese','Mandarin'],en:['英文','English','Inggris'],id:['印尼文','Indonesian','Indonesia'],
};
function OrderEmailHistory({rows,lang,open}:{rows:EnrollmentEmail[];lang:CrmLanguage;open:boolean}) {
  return <AdminDisclosure heading={t(lang,['邮件记录','Email history','Riwayat email'])} open={open}>
    {rows.length===0?<p className="crm-work-muted">{t(lang,['暂无邮件记录。','No email history.','Belum ada riwayat email.'])}</p>:
      <ol className="crm-enrollment-email-history">{rows.map(mail=><li key={mail.id}>
        <strong>{mail.subject||'—'}</strong>
        <div className="crm-work-muted">
          {emailKind[mail.kind]?t(lang,emailKind[mail.kind]):mail.kind} · {mail.language&&emailLocale[mail.language]?t(lang,emailLocale[mail.language]):'—'} · {emailDelivery[mail.state]?t(lang,emailDelivery[mail.state]):t(lang,['状态待核对','Status unconfirmed','Status belum dikonfirmasi'])} · <time dateTime={mail.recordedAt}>{formatCrmEventTime(mail.recordedAt)}</time>
        </div>
      </li>)}</ol>}
  </AdminDisclosure>;
}
function sourceLabel(attribution:CourseRecord['attribution'],lang:CrmLanguage) {
  if(!attribution) return '—';
  const entry=attribution.entry==='linkhub'?'UPER Links':attribution.entry==='website'
    ?t(lang,['官网','Website','Situs web']):t(lang,['直接访问','Direct','Langsung']);
  return [entry,attribution.verified?attribution.source:null,attribution.campaign].filter(Boolean).join(' · ');
}
function CourseRecordAttribution({ attribution, lang }: {
  attribution:NonNullable<CourseRecord['attribution']>;
  lang:CrmLanguage;
}) {
  const promotion = attribution.verified && attribution.promotionId;
  const guidance = attribution.via === 'ai_chat' ? 'AI Chat' : attribution.via === 'whatsapp' ? 'WhatsApp' : null;
  return <>
    <p>{t(lang,['报名来源','Enrollment source','Sumber pendaftaran'])} · {sourceLabel(attribution,lang)}</p>
    {attribution.campaignId && <p>{t(lang,['活动编码','Campaign code','Kode kampanye'])} · {attribution.campaignId}</p>}
    {promotion && <p>{t(lang,['推广链接','Promotion link','Tautan promosi'])} · {attribution.promotionName
      ? `${attribution.promotionName} (${promotion})` : promotion}</p>}
    {guidance && <p>{t(lang,['报名引导','Enrollment guidance','Panduan pendaftaran'])} · {guidance}</p>}
  </>;
}
function CourseRecords({ records, link, lang, emails, targetRecord, paymentHref, onChangeEmail, onLinkOpportunity,onConfirmLesson }: {
  records:CourseRecord[];link:boolean;lang:CrmLanguage;emails?:EnrollmentEmail[];assistanceDueAt?:string;canAssist?:boolean;targetRecord?:string|null;
  paymentHref?:(row:CourseRecord)=>string;
  onChangeEmail?:(row:CourseRecord)=>void;
  onLinkOpportunity?:(row:CourseRecord)=>void;
  onConfirmLesson?:(row:CourseRecord)=>void;
}) {
  if(!records.length) return <p className="crm-work-muted">{t(lang,['暂无课程记录。','No course records.','Belum ada catatan kursus.'])}</p>;
  return <ol className="crm-course-records">
    {records.map(row=>{
      const raw=typeof row.createdAt==='string'?row.createdAt.trim():'';
      const recordedAt=crmInstant(raw)?.toISOString();
      return <li key={row.kind+row.id} id={link?undefined:'enrollment-record-'+row.id}>
      <div className="crm-opportunity-record-heading">
        <div><strong>{t(lang,row.appointment?['一对一约课','One-to-one request','Permintaan kelas privat']:kinds[row.kind])}{row.class&&<> · {row.class.id?<a className="crm-work-link" href={enrollmentClassManagementPath(row.class.id)}>{row.class.level}</a>:row.class.level}</>}</strong> <span>{row.appointment&&row.state==='active'
          ?t(lang,row.appointment.confirmation?['约课已确认','Lessons confirmed','Jadwal dikonfirmasi']:['待约课','Schedule pending','Menunggu jadwal'])
          :states[row.state]?t(lang,states[row.state]):row.state}</span></div>
        {paymentHref&&row.kind==='order'&&requiresPaymentReview(row)&&<AdminRowAction href={paymentHref(row)}>
          {t(lang,['核对到账','Verify payment','Verifikasi pembayaran'])}</AdminRowAction>}
      </div>
      <div className="crm-work-muted">{recordedAt
        ?<time dateTime={recordedAt}>{formatCrmEventTime(recordedAt).slice(0,16)}</time>
        :raw?t(lang,['时间待核对','Time needs review','Waktu perlu diperiksa']):
          t(lang,['未记录时间','Time not recorded','Waktu belum tercatat'])} · {row.id}</div>
      {row.class&&<p>{row.class.firstLesson.replace('T',' ')} WIB · {row.class.schedule}{row.class.opened?' · '+t(lang,['已确认开班','Class confirmed','Kelas dikonfirmasi']):''}</p>}
      {row.criteria&&<p>{[row.criteria.level,row.criteria.period,row.criteria.format].map(value=>interestOption(lang,value)).join(' · ')}{row.criteria.notes?' — '+row.criteria.notes:''}</p>}
      {row.appointment?.confirmation&&<p>{row.appointment.confirmation.teacher} · {formatCrmEventTime(row.appointment.confirmation.firstLessonAt).slice(0,16)}{row.appointment.confirmation.schedule?' · '+row.appointment.confirmation.schedule:''}</p>}
      {onConfirmLesson&&row.appointment&&!row.appointment.confirmation&&row.state==='active'&&
        <button type="button" className="crm-work-link" onClick={()=>onConfirmLesson(row)}>{t(lang,['确认约课','Confirm schedule','Konfirmasi jadwal'])}</button>}
      {row.price!==null&&row.received!==null&&<p>{t(lang,['核实实收／应收','Verified receipts / amount due','Dana terverifikasi / tagihan'])} {formatCurrency(row.received,lang)} / {formatCurrency(row.price,lang)}</p>}
      {row.firstReviewDueAt&&<CrmEnrollmentReviewDeadline dueAt={row.firstReviewDueAt} lang={lang}/>}
      {row.attribution&&<CourseRecordAttribution attribution={row.attribution} lang={lang}/>}
      {link&&row.latestNotice&&<p>{t(lang,['最近一封邮件记录','Latest email record','Catatan email terakhir'])} · {row.latestNotice}</p>}
      {link&&row.opportunityId&&<a className="crm-work-link" href={crmHref({tab:'opportunities',opportunity:row.opportunityId,enrollmentRecord:row.id})}>{t(lang,['查看商机','View opportunity','Lihat peluang'])}</a>}
      {onLinkOpportunity&&row.canLinkOpportunity&&<p><button type="button" className="crm-work-link" onClick={()=>onLinkOpportunity(row)}>
        {t(lang,['关联商机','Link opportunity','Tautkan peluang'])}</button></p>}
      {onChangeEmail&&row.enrollmentEmail&&<p><button type="button" className="crm-work-link" onClick={()=>onChangeEmail(row)}>
        {t(lang,['更改报名邮箱','Change enrollment email','Ubah email pendaftaran'])}</button></p>}
      {emails&&row.kind==='order'&&<OrderEmailHistory lang={lang} rows={emails.filter(mail=>mail.orderId===row.id)} open={targetRecord===row.id}/>}
    </li>;
    })}
  </ol>;
}

function PrivateLessonConfirmation({opportunityId,row,lang,isLight,onClose,onSaved}:{
  opportunityId:string;row:CourseRecord;lang:CrmLanguage;isLight:boolean;onClose:()=>void;onSaved:(refreshed?:Opportunity)=>void;
}) {
  const [busy,setBusy]=useState(false);
  const [pending,setPending]=useState<NonNullable<PrivateLessonRegistration['confirmation']>>();
  const unknown=!!pending;
  const [message,setMessage]=useState('');
  const title=t(lang,['确认约课','Confirm schedule','Konfirmasi jadwal']);
  const failed=t(lang,['暂未保存，请核对记录和权限。','Could not save. Check the record and your access.','Belum tersimpan. Periksa catatan dan akses.']);
  const base='/api/crm/opportunities/'+encodeURIComponent(opportunityId);
  async function save(data:FormData){
    if(busy||unknown)return;
    const local=String(data.get('firstLessonAt')??'');
    let firstLessonAt:string;
    try{firstLessonAt=validateLocalInstant(local,new Date(local),viewerTimeZone()).toISOString();}
    catch{setMessage(t(lang,['请核对首课日期和时间。','Check the first lesson date and time.','Periksa tanggal dan waktu sesi pertama.']));return;}
    const submitted={firstLessonAt,teacher:String(data.get('teacher')??'').trim(),schedule:String(data.get('schedule')??'').trim()};
    setBusy(true);setMessage('');
    try{
      const response=await fetch(base+'/private-lessons/'+encodeURIComponent(row.id),{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(submitted),signal:AbortSignal.timeout(15000)});
      if(response.ok){onSaved();return;}
      if(response.status>=500||response.status===408)setPending(submitted);else setMessage(failed);
    }catch{setPending(submitted);}finally{setBusy(false);}
  }
  async function check(){
    if(busy||!pending)return;
    setBusy(true);setMessage('');
    try{
      const result=await read<Opportunity>(base,AbortSignal.timeout(12000));
      const saved=result.records.find(item=>item.id===row.id)?.appointment?.confirmation;
      if(saved?.firstLessonAt===pending.firstLessonAt&&saved.teacher===pending.teacher&&saved.schedule===pending.schedule){
        onSaved(result);return;
      }
      setPending(undefined);
      setMessage(saved?t(lang,['这条约课已有其他确认安排，请核对详情。','This request has a different confirmed schedule. Check the details.','Permintaan ini memiliki jadwal terkonfirmasi yang berbeda. Periksa detailnya.']):failed);
    }catch{setMessage(t(lang,['暂时无法查询结果。','The result could not be checked.','Hasil belum dapat diperiksa.']));}
    finally{setBusy(false);}
  }
  return <CrmOperationLayer compose title={<>{title}<AdminRequiredNote inline lang={lang}/></>} context={row.learnerName||row.criteria?.level}
    lang={lang} isLight={isLight} customerContext={false} busy={busy||unknown} onClose={onClose}>
    <AdminForm lang={lang} className="crm-editor-compose crm-course-editor" onSubmit={(event:React.FormEvent<HTMLFormElement>)=>{
      event.preventDefault();void save(new FormData(event.currentTarget));
    }}>
      <div className="crm-editor-scroll">
        <p>{t(lang,['与学员确认上课安排后再保存。','Save after agreeing on the schedule with the learner.','Simpan setelah jadwal disepakati dengan siswa.'])}</p>
        <AdminField required>{t(lang,['首课时间','First lesson','Sesi pertama'])}<input name="firstLessonAt" type="datetime-local" required disabled={busy||unknown}/></AdminField>
        <AdminField required>{t(lang,['授课教师','Teacher','Pengajar'])}<input name="teacher" required maxLength={120} disabled={busy||unknown}/></AdminField>
        <AdminField>{t(lang,['上课安排','Lesson schedule','Jadwal kelas'])}<textarea name="schedule" maxLength={600} disabled={busy||unknown}/></AdminField>
        {unknown&&<CrmSaveFeedback state="unknown" lang={lang}/>}
        {message&&<p role="alert">{message}</p>}
      </div>
      <AdminFormActions className="crm-editor-actions">
        {unknown?<button type="button" className="crm-work-button" disabled={busy} onClick={()=>void check()}>{t(lang,['查询保存结果','Check save result','Periksa hasil simpan'])}</button>:<>
          <button type="button" className="crm-work-button" disabled={busy} onClick={onClose}>{t(lang,['取消','Cancel','Batal'])}</button>
          <button type="submit" className="crm-work-button" data-primary disabled={busy}>{t(lang,['保存','Save','Simpan'])}</button>
        </>}
      </AdminFormActions>
    </AdminForm>
  </CrmOperationLayer>;
}

function EnrollmentEmailChange({path,row,lang,isLight,onClose,onSaved}:{
  path:string;row:CourseRecord;lang:CrmLanguage;isLight:boolean;onClose:()=>void;onSaved:(email:string)=>void;
}) {
  const [requestId]=useState(()=>crypto.randomUUID());
  const [busy,setBusy]=useState(false);
  const [unknown,setUnknown]=useState(false);
  const [message,setMessage]=useState('');
  const [dirty,setDirty]=useState(false);
  const [discard,setDiscard]=useState(false);
  const close=()=>{if(!busy&&!unknown){if(dirty)setDiscard(true);else onClose();}};
  const label=t(lang,['更改报名邮箱','Change enrollment email','Ubah email pendaftaran']);
  async function save(form:FormData) {
    if(busy||unknown)return;
    const email=String(form.get('email')??'').trim();
    if(!validContactEmail(email)){setMessage(contactEmailText(lang).error);return;}
    if(email.toLowerCase()===row.enrollmentEmail){
      setMessage(t(lang,['请输入与原邮箱不同的新地址。','Enter an address different from the current one.','Masukkan alamat yang berbeda dari alamat saat ini.']));return;
    }
    setBusy(true);setMessage('');
    try{
      const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        requestId,kind:row.kind,recordId:row.id,previousEmail:row.enrollmentEmail,email,reason:form.get('reason'),confirmed:form.has('confirmed'),
      })});
      if(response.status>=500){setUnknown(true);return;}
      const result=await response.json();
      if(response.ok){onSaved(result.email);return;}
      setMessage(result.error==='enrollment_email_changed'
        ? t(lang,['原邮箱已变化，请关闭并重新打开客户全景后核对。','The email has changed. Reopen the customer overview and check the record.','Email telah berubah. Buka kembali ringkasan pelanggan dan periksa catatan.'])
        : t(lang,['未保存。请核对填写内容和办理权限。','Changes were not saved. Check the details and your access.','Perubahan belum tersimpan. Periksa data dan akses Anda.']));
    }catch{setUnknown(true);}finally{setBusy(false);}
  }
  async function checkResult() {
    setBusy(true);setMessage('');
    try{
      const response=await fetch(path+'/results/'+requestId,{cache:'no-store'});
      if(response.ok){onSaved((await response.json()).email);return;}
      if(response.status===404)setUnknown(false);
      setMessage(t(lang,['未找到已保存结果，可以重新核对记录。','No saved result was found. Check the record before trying again.','Hasil tersimpan tidak ditemukan. Periksa catatan sebelum mencoba lagi.']));
    }catch{setMessage(t(lang,['暂时无法查询结果。','The result could not be checked.','Hasil belum dapat diperiksa.']));}
    finally{setBusy(false);}
  }
  return <>
    <CrmOperationLayer compose title={<>{label}<AdminRequiredNote inline lang={lang}/></>}
      context={t(lang,kinds[row.kind])+' · '+(row.learnerName||row.id)} lang={lang} isLight={isLight}
      customerContext={false} busy={busy||unknown} onClose={close}>
      <AdminForm lang={lang} className="crm-editor-compose crm-course-editor" onChange={()=>setDirty(true)} onSubmit={event=>{
        event.preventDefault();void save(new FormData(event.currentTarget));
      }}>
        <div className="crm-editor-scroll">
          <p>{t(lang,['当前邮箱','Current email','Email saat ini'])} · {row.enrollmentEmail}</p>
          <p>{t(lang,['只更改这条记录。请让学员用新邮箱重新验证。','This changes only the selected record. Ask the learner to verify the new address.','Hanya catatan yang dipilih yang berubah. Minta siswa memverifikasi alamat baru.'])}</p>
          <AdminField required>{t(lang,['新邮箱','New email','Email baru'])}<input name="email" type="email" required maxLength={254} disabled={busy||unknown}/></AdminField>
          <AdminField required>{t(lang,['身份核对说明','Identity verification note','Catatan verifikasi identitas'])}
            <textarea name="reason" required maxLength={500} disabled={busy||unknown}/></AdminField>
          <label className="admin-field admin-field--choice"><input name="confirmed" type="checkbox" required disabled={busy||unknown}/><span>
            {t(lang,['已核实申请人身份和这条记录的访问授权','I verified the requester’s identity and right to access this record','Saya telah memverifikasi identitas dan hak akses pemohon untuk catatan ini'])} *
          </span></label>
          {unknown&&<CrmSaveFeedback state="unknown" lang={lang}/>}
          {message&&<p role="alert">{message}</p>}
        </div>
        <AdminFormActions className="crm-editor-actions">
          {unknown?<button type="button" className="crm-work-button" disabled={busy} onClick={()=>void checkResult()}>
            {t(lang,['查询保存结果','Check save result','Periksa hasil simpan'])}</button>:<>
            <button type="button" className="crm-work-button" disabled={busy} onClick={close}>{t(lang,['取消','Cancel','Batal'])}</button>
            <button type="submit" className="crm-work-button" data-primary disabled={busy}>{t(lang,['保存','Save','Simpan'])}</button>
          </>}
        </AdminFormActions>
      </AdminForm>
    </CrmOperationLayer>
    {discard&&<AdminDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)} onDiscard={onClose}/>}
  </>;
}

type LinkChoices={opportunityId:string|null;opportunities:{id:string;level:string;stage:string;createdAt:string;
  class:CourseRecord['class'];criteria:CourseRecord['criteria']}[]};
function EnrollmentOpportunityLink({leadId,row,lang,isLight,onClose,onSaved}:{
  leadId:string;row:CourseRecord;lang:CrmLanguage;isLight:boolean;onClose:()=>void;onSaved:(opportunityId:string)=>void;
}) {
  const base='/api/crm/leads/'+encodeURIComponent(leadId);
  const path=base+'/enrollment-records/'+row.kind+'/'+encodeURIComponent(row.id)+'/opportunity';
  const [requestId]=useState(()=>crypto.randomUUID());
  const [choices,setChoices]=useState<LinkChoices>();
  const [reload,setReload]=useState(0);
  const [loadFailed,setLoadFailed]=useState(false);
  const [selected,setSelected]=useState('');
  const [busy,setBusy]=useState(false);
  const [unknown,setUnknown]=useState(false);
  const [message,setMessage]=useState('');
  const [discard,setDiscard]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    setLoadFailed(false);
    read<LinkChoices>(path,controller.signal).then(setChoices,cause=>{if(cause.name!=='AbortError')setLoadFailed(true);});
    return ()=>controller.abort();
  },[path,reload]);
  const close=()=>{if(!busy&&!unknown){if(selected)setDiscard(true);else onClose();}};
  const title=t(lang,['关联商机','Link opportunity','Tautkan peluang']);
  const label=t(lang,['商机','Opportunity','Peluang']);
  async function save(check=false) {
    if(busy||(!check&&(!selected||unknown)))return;
    setBusy(true);setMessage('');
    try{
      const response=await fetch(check?base+'/operations/'+requestId:path,check?{cache:'no-store'}:{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,opportunityId:selected}),
      });
      if(response.status>=500)throw Error();
      if(check&&response.status===404){
        setUnknown(false);setMessage(t(lang,['未查到保存结果，可以再次保存。','No saved result found. You can save again.','Hasil simpan belum ditemukan. Anda dapat menyimpan kembali.']));return;
      }
      const result=await response.json();
      if(!response.ok){
        setMessage(t(lang,['未能关联，请重新读取并核对候选商机。','Could not link. Reload and review the available opportunities.','Tidak dapat menautkan. Muat ulang dan periksa peluang.']));
        if(!check){setSelected('');setChoices(undefined);setReload(value=>value+1);}
        return;
      }
      if(result.leadId!==leadId||result.operationKind!==`enrollment.opportunity.link.${row.kind}:${row.id}`||result.opportunityId!==selected)throw Error();
      onSaved(result.opportunityId);
    }catch{setUnknown(true);}finally{setBusy(false);}
  }
  return <>
    <CrmOperationLayer compose title={<>{title}<AdminRequiredNote inline lang={lang}/></>} context={t(lang,kinds[row.kind])+' · '+(row.learnerName||row.id)}
      lang={lang} isLight={isLight} customerContext={false} busy={busy||unknown} onClose={close}>
      <AdminForm lang={lang} className="crm-editor-compose crm-course-editor" onSubmit={event=>{event.preventDefault();void save();}}>
        <div className="crm-editor-scroll">
          {loadFailed?<p role="alert">{t(lang,['无法读取商机。','Could not load opportunities.','Peluang belum dapat dimuat.'])} <button type="button" className="crm-work-link" onClick={()=>setReload(value=>value+1)}>{t(lang,['重试','Retry','Coba lagi'])}</button></p>:
            !choices?<p role="status">{t(lang,['正在读取商机…','Loading opportunities…','Memuat peluang…'])}</p>:
            choices.opportunityId?<p>{t(lang,['这条记录已经关联。','This record is already linked.','Catatan ini sudah ditautkan.'])} <a className="crm-work-link" href={crmHref({tab:'opportunities',opportunity:choices.opportunityId,enrollmentRecord:row.id})}>{t(lang,['查看商机','View opportunity','Lihat peluang'])}</a></p>:
            choices.opportunities.length?<div className="crm-simple-select-field"><p><AdminFieldLabel required>{label}</AdminFieldLabel></p>
              <AdminSingleSelect required label={label} lang={lang} isLight={isLight} value={selected} onChange={setSelected} disabled={busy||unknown}
                options={[{value:'',label:t(lang,['选择对应商机','Select the matching opportunity','Pilih peluang yang sesuai'])},...choices.opportunities.map(option=>({value:option.id,
                  label:[option.level,progressLabel(option.stage,lang),option.class?.schedule??(option.criteria&&[option.criteria.period,option.criteria.format]
                    .map(value=>interestOption(lang,value)).join(' · ')),formatCrmSummaryTime(option.createdAt),option.id.slice(-8)].filter(Boolean).join(' · ')}))]}/>
              </div>:<p>{t(lang,['没有同级别、进行中的商机。','There are no active opportunities at this level.','Tidak ada peluang aktif pada level ini.'])}</p>}
          {unknown&&<CrmSaveFeedback state="unknown" lang={lang}/>}
          {message&&<p role="alert">{message}</p>}
        </div>
        <AdminFormActions className="crm-editor-actions">
          {unknown?<button type="button" className="crm-work-button" disabled={busy} onClick={()=>void save(true)}>{t(lang,['查询保存结果','Check save result','Periksa hasil simpan'])}</button>:<>
            <button type="button" className="crm-work-button" disabled={busy} onClick={close}>{t(lang,['取消','Cancel','Batal'])}</button>
            {!!choices?.opportunities.length&&<button type="submit" className="crm-work-button" data-primary disabled={busy}>{t(lang,['保存','Save','Simpan'])}</button>}
          </>}
        </AdminFormActions>
      </AdminForm>
    </CrmOperationLayer>
    {discard&&<AdminDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)} onDiscard={onClose}/>}
  </>;
}

export function CrmCustomerCourseRecords({id,lang,isLight}:{id:string;lang:CrmLanguage;isLight:boolean}) {
  const [records,setRecords]=useState<CourseRecord[]>();
  const [error,setError]=useState(false);
  const [canChangeEmail,setCanChangeEmail]=useState(false);
  const [editingEmail,setEditingEmail]=useState<CourseRecord>();
  const [linking,setLinking]=useState<CourseRecord>();
  const [saved,setSaved]=useState<'email'|'link'>();
  const path='/api/crm/leads/'+encodeURIComponent(id)+'/enrollment-records';
  useEffect(()=>{
    const controller=new AbortController();
    read<{records:CourseRecord[];canChangeEmail?:boolean}>(path,controller.signal)
      .then(data=>{setRecords(data.records);setCanChangeEmail(data.canChangeEmail===true);})
      .catch(cause=>{if(cause.name!=='AbortError'&&cause.message!=='404')setError(true);});
    return ()=>controller.abort();
  },[path]);
  useEffect(()=>{
    if(!saved)return;
    const timer=window.setTimeout(()=>setSaved(undefined),3500);
    return ()=>window.clearTimeout(timer);
  },[saved]);
  if(!records?.length&&!error) return null;
  return <section className="crm-opportunity-records" aria-label={t(lang,['课程报名记录','Course enrollment records','Catatan pendaftaran kursus'])}>
    <h3>{t(lang,['课程报名记录','Course enrollment records','Catatan pendaftaran kursus'])}</h3>
    {error?<p role="alert">{t(lang,['暂时无法读取课程记录。','Course records could not be loaded.','Catatan kursus belum dapat dimuat.'])}</p>:
      <CourseRecords records={records??[]} link lang={lang} onChangeEmail={canChangeEmail?setEditingEmail:undefined} onLinkOpportunity={setLinking}/>}
    {editingEmail&&<EnrollmentEmailChange path={path+'/email'} row={editingEmail} lang={lang} isLight={isLight}
      onClose={()=>setEditingEmail(undefined)} onSaved={email=>{
        setRecords(current=>current?.map(row=>row.id===editingEmail.id&&row.kind===editingEmail.kind?{...row,enrollmentEmail:email}:row));
        setEditingEmail(undefined);setSaved('email');
      }}/>}
    {linking&&<EnrollmentOpportunityLink leadId={id} row={linking} lang={lang} isLight={isLight} onClose={()=>setLinking(undefined)} onSaved={opportunityId=>{
      setRecords(current=>current?.map(row=>row.id===linking.id&&row.kind===linking.kind?{...row,opportunityId,canLinkOpportunity:false}:row));
      setLinking(undefined);setSaved('link');
    }}/>}
    {saved&&<span className="crm-opportunity-feedback" role="status">{saved==='link'?t(lang,['已关联商机。','Opportunity linked.','Peluang ditautkan.']):t(lang,['报名邮箱已更新，请用新邮箱重新验证。',
      'Enrollment email updated. Verify the new address.','Email pendaftaran diperbarui. Verifikasi alamat baru.'])}</span>}
  </section>;
}

export function CrmEnrollmentOpportunities({lang,isLight,employees,actorId,canReviewIdentity,canFinance}: {
  lang:CrmLanguage;isLight:boolean;employees:{id:string;displayName?:string}[];actorId:string;canReviewIdentity:boolean;canFinance:boolean;
}) {
  useLocation();
  const navigate=useNavigate();
  const params=new URLSearchParams(window.location.search);
  const id=params.get('opportunity');
  const customerId=params.get('customerId');
  const listEndpoint=base+(customerId?'?'+new URLSearchParams({customerId}):'');
  const [listResponse,setResult]=useState<{endpoint:string;actorId:string;data:OpportunityList}>();
  const result=listResponse?.endpoint===listEndpoint&&listResponse.actorId===actorId?listResponse.data:undefined;
  const list=result?.opportunities;
  const [loadedDetail,setDetail]=useState<Opportunity>();
  const detail=loadedDetail?.id===id?loadedDetail:undefined;
  const [listFailed,setListFailed]=useState(false);
  const [listLoading,setListLoading]=useState(true);
  const [listRevision,setListRevision]=useState(0);
  const [detailRevision,setDetailRevision]=useState(0);
  const [lessonToConfirm,setLessonToConfirm]=useState<CourseRecord>();
  const shellHeight=useCrmShellHeight();
  const desktopRail=useRecordScrollMode(shellHeight)==='independent';
  const [showList,setShowList]=useState(false);
  useEffect(()=>setShowList(false),[id]);
  const [assisting,setAssisting]=useState<'new'|'saved'>();
  const [assistanceRevision,setAssistanceRevision]=useState(0);
  const [error,setError]=useState('');
  const targetRecord=params.get('enrollmentRecord');
  const openAssistance=params.get('assistEnrollment')==='1';
  const resumeList=params.get('resumeOpportunityList')==='1';
  const [filters,setFilters]=useState<Filters>(()=>Object.fromEntries(
    Object.entries(filterDefaults).map(([key,fallback])=>[key,params.get(key)??fallback]),
  ) as Filters);
  const changeFilter=(key:keyof Filters,value:string)=>setFilters(current=>({...current,[key]:value}));
  useEffect(()=>{
    const restore=()=>{
      const query=new URLSearchParams(window.location.search);
      if(query.get('tab')==='opportunities')setFilters(Object.fromEntries(
        Object.entries(filterDefaults).map(([key,fallback])=>[key,query.get(key)??fallback]),
      ) as Filters);
    };
    window.addEventListener('popstate',restore);
    return ()=>window.removeEventListener('popstate',restore);
  },[]);
  const [progress,setProgress]=useState<{lead:any;opportunity:Opportunity;agreementId?:string}|null>(null);
  const [progressDirty,setProgressDirty]=useState(false);
  const [confirmDiscard,setConfirmDiscard]=useState(false);
  const [busy,setBusy]=useState(false);
  const progressOpener=useRef<HTMLElement|null>(null);
  const [saveError,setSaveError]=useState(false);
  const [progressReadFailed,setProgressReadFailed]=useState(false);
  const [readingProgress,setReadingProgress]=useState(false);
  const tableScroll=useRef<HTMLDivElement>(null);
  const searchField=useRef<HTMLInputElement>(null);
  const detailBody=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(progress||busy)return;
    progressOpener.current?.focus({preventScroll:true});
    progressOpener.current=null;
  },[progress,busy]);
  useEffect(()=>{
    const controller=new AbortController();
    setListLoading(true);
    setListFailed(false);
    void read<OpportunityList>(listEndpoint,controller.signal).then(data=>{
      if(!controller.signal.aborted)setResult({endpoint:listEndpoint,actorId,data});
    },(cause:Error)=>{
      if(controller.signal.aborted)return;
      if(['401','403','404'].includes(cause.message))setResult(undefined);
      setListFailed(true);
    }).finally(()=>{
      if(!controller.signal.aborted)setListLoading(false);
    });
    return ()=>controller.abort();
  },[listEndpoint,assistanceRevision,actorId,listRevision]);
  useEffect(()=>{
    if(!id)return;
    const controller=new AbortController();
    setError('');
    void read<Opportunity>(base+'/'+encodeURIComponent(id),controller.signal).then(data=>{
      if(!controller.signal.aborted)setDetail(data);
    },(cause:Error)=>{
      if(!controller.signal.aborted){setDetail(undefined);setError(cause.message);}
    });
    return ()=>controller.abort();
  },[id,assistanceRevision,actorId,detailRevision]);
  useEffect(()=>{
    const url=new URL(window.location.href);
    if(url.searchParams.get('tab')!=='opportunities') return;
    for(const key of Object.keys(filterDefaults) as (keyof Filters)[]) {
      if(filters[key]===filterDefaults[key]) url.searchParams.delete(key);
      else url.searchParams.set(key,filters[key]);
    }
    window.history.replaceState(window.history.state,'',url);
  },[filters,id]);
  useEffect(()=>{
    if(detailBody.current) detailBody.current.scrollTop=0;
  },[id]);
  useEffect(()=>{
    if(!detail||!targetRecord)return;
    const record=document.getElementById('enrollment-record-'+targetRecord), body=detailBody.current;
    if(!record||!body?.contains(record))return;
    if(desktopRail)revealRecord(body,record);
    else record.scrollIntoView({block:'nearest'});
  },[detail,targetRecord,desktopRail]);
  const listRoute={tab:'opportunities',...filters,...(customerId?{customerId}: {})};
  const listPath=opportunityListPath(filters,customerId);
  const back=listPath+'&resumeOpportunityList=1';
  const positionKey='uper_crm_opportunity_position:'+actorId+':'+(customerId??'all');
  const rememberListPosition=(opportunityId:string,assist=false)=>{
    if(id)return;
    try{
      sessionStorage.setItem(positionKey,JSON.stringify({opportunityId,assist,top:window.scrollY,left:tableScroll.current?.scrollLeft??0}));
    }catch{/* Navigation still works when storage is unavailable. */}
  };
  useEffect(()=>{
    if(id||!resumeList||!list)return;
    try{
      const value=sessionStorage.getItem(positionKey);
      if(!value)return;
      const position=JSON.parse(value);
      let restoreFrame=0;
      const frame=requestAnimationFrame(()=>{
        restoreFrame=requestAnimationFrame(()=>{
          sessionStorage.removeItem(positionKey);
          const row=[...tableScroll.current?.querySelectorAll<HTMLTableRowElement>('[data-opportunity-id]')??[]]
            .find(item=>item.dataset.opportunityId===position.opportunityId);
          (row?.querySelector<HTMLAnchorElement>(position.assist?'[data-assist-enrollment]':'a')??row?.querySelector('a')??searchField.current)?.focus({preventScroll:true});
          if(tableScroll.current)tableScroll.current.scrollLeft=position.left;
          const url=new URL(window.location.href);
          url.searchParams.delete('resumeOpportunityList');
          window.history.replaceState(window.history.state,'',url);
          window.scrollTo({top:position.top,behavior:'instant'});
        });
      });
      return ()=>{cancelAnimationFrame(frame);cancelAnimationFrame(restoreFrame);};
    }catch{/* An invalid or missing checkpoint does not affect list access. */}
  },[id,list,positionKey,resumeList]);
  const employeeName=(id:string|null)=>employees.find(employee=>employee.id===id)?.displayName||id;
  const owner=(row:Opportunity)=>employeeName(row.owner)||t(lang,['未分配','Unassigned','Belum ditugaskan']);
  const customerLink=(row:Opportunity)=>crmHref({tab:'leads',lead:row.customerId});
  const paymentLink=(record:CourseRecord)=>crmHref({tab:'payments',enrollmentOrder:record.id,opportunityReturn:listPath});
  const openProgress=async(row:Opportunity,agreementId?:string)=>{
    if(busy)return;
    if(document.activeElement instanceof HTMLElement)progressOpener.current=document.activeElement;
    setBusy(true);setSaveError(false);
    try{
      const lead=await read<any>('/api/crm/leads/'+row.customerId,new AbortController().signal);
      setProgress({lead:lead.lead??lead,opportunity:row,agreementId});
      setProgressDirty(false);
    }catch{setSaveError(true);}finally{setBusy(false);}
  };
  const readSavedProgress=async()=>{
    if(readingProgress)return;
    setReadingProgress(true);
    try{
      const signal=new AbortController().signal;
      const [latest,record]=await Promise.all([
        read<OpportunityList>(listEndpoint,signal),
        id?read<Opportunity>(base+'/'+id,signal):undefined,
      ]);
      setResult({endpoint:listEndpoint,actorId,data:latest});
      if(record)setDetail(record);
      setProgressReadFailed(false);
    }catch{setProgressReadFailed(true);}
    finally{setReadingProgress(false);}
  };
  const closeProgress=()=>{
    if(busy)return;
    if(progressDirty)setConfirmDiscard(true);
    else setProgress(null);
  };
  const nextAction=(row:Opportunity)=>{
    const step=opportunityNextStep(row,lang,canFinance);
    if(ended(row)||row.identityPending)return step.kind==='text'?step.label:null;
    const assistanceAction=!id&&row.canAssist&&<AdminRowAction href={crmHref({...listRoute,opportunity:row.id,assistEnrollment:'1'})}
      data-assist-enrollment="" onClick={()=>rememberListPosition(row.id,true)}>
      {t(lang,['协助报名','Assist enrollment','Bantu pendaftaran'])}
    </AdminRowAction>;
    const reviewDue=row.records.flatMap(record=>record.firstReviewDueAt?[record.firstReviewDueAt]:[]).sort()[0];
    const reviewDeadline=id!==row.id&&reviewDue&&<CrmEnrollmentReviewDeadline dueAt={reviewDue} lang={lang} compact/>;
    if(step.kind==='review'&&canFinance)return <>
      {id===row.id?t(lang,['待核对到账','Payment awaiting verification','Pembayaran menunggu verifikasi']):
        <AdminRowAction href={paymentLink(step.record)} onClick={()=>rememberListPosition(row.id)}>{t(lang,['核对到账','Verify payment','Verifikasi pembayaran'])}</AdminRowAction>}
      {reviewDeadline}</>;
    if(step.kind==='followup'){
      const {followup,label,name}=step;
      return <>
        <div className="crm-opportunity-next-actions">{followup.kind==='agreement'?
          <AdminRowAction disabled={busy} onClick={()=>void openProgress(row,followup.id)} title={name}>{label}</AdminRowAction>:
          <AdminRowAction title={name} href={crmHref({tab:'leads',lead:row.customerId,target:'task',targetId:followup.id})}>{label}</AdminRowAction>}{assistanceAction}</div>
        {followup.at||followup.date?<div className="crm-work-muted"><time dateTime={followup.at||followup.date}>{followup.at?formatCrmSummaryTime(followup.at):followup.date}</time></div>:null}
        {reviewDeadline}
      </>;
    }
    if(step.kind==='confirm')return <>
      <span>{t(lang,['等待学员确认','Wait for learner confirmation','Tunggu konfirmasi siswa'])}</span>
      <span className="crm-list-secondary">{t(lang,['确认截止','Confirm by','Batas konfirmasi'])} ·{' '}
        <time dateTime={step.due}>{formatCrmSummaryTime(step.due)}</time></span>
    </>;
    if(step.kind==='review'){
      const status=t(lang,['待财务核验','Awaiting finance verification','Menunggu verifikasi keuangan']);
      return <>{id===row.id?status:<AdminRowAction href={crmHref({...listRoute,opportunity:row.id,enrollmentRecord:step.record.id})}
        onClick={()=>rememberListPosition(row.id)}>{t(lang,['查看核验进度','View verification progress','Lihat status verifikasi'])}</AdminRowAction>}{reviewDeadline}</>;
    }
    if(step.kind==='payment')return <>{t(lang,states.awaiting_payment)}<div className="crm-work-muted"><time dateTime={step.due} title={formatCrmEventTime(step.due)}>{formatCrmSummaryTime(step.due)}</time></div></>;
    if(assistanceAction)return <div className="crm-opportunity-next-actions">
      {assistanceAction}
      {row.canInitiateFollowup&&row.state==='interest'&&<AdminRowAction disabled={busy} onClick={()=>void openProgress(row)}>
        {t(lang,['记录进展','Record progress','Catat kemajuan'])}</AdminRowAction>}
    </div>;
    if(row.canInitiateFollowup&&row.state==='interest'&&!id)return <AdminRowAction disabled={busy} onClick={()=>void openProgress(row)}>{t(lang,['记录进展','Record progress','Catat kemajuan'])}</AdminRowAction>;
    return <>{step.label}{reviewDeadline}</>;
  };
  const label=t(lang,['商机','Opportunities','Peluang']);
  const allLabel=t(lang,['全部','All','Semua']);
  const ownerOptions=[...new Set(list?.flatMap(row=>row.owner&&row.owner!==actorId?[row.owner]:[])??[])];
  const levels=[...new Set(list?.map(row=>row.level)??[])].sort();
  const businessStates=[...new Set(list?.map(currentStatus)??[])];
  const query=filters.opportunityQuery.trim().toLowerCase();
  const visible=list?.filter(row=>{
    return (filters.opportunityStatus==='all'||(filters.opportunityStatus==='closed'?ended(row):!ended(row))) &&
      (filters.opportunityOwner==='all'||(filters.opportunityOwner==='mine'?row.owner===actorId:
        filters.opportunityOwner==='unassigned'?!row.owner:row.owner===filters.opportunityOwner)) &&
      (!filters.opportunityLevel||filters.opportunityLevel===row.level) &&
      (!filters.opportunityStage||filters.opportunityStage===row.salesStage) &&
      (!filters.opportunityState||filters.opportunityState===currentStatus(row)) &&
      (filters.opportunityFollowup==='with'?Boolean(row.followup):filters.opportunityFollowup==='without'?!row.followup:true) &&
      [row.level,row.customerName,row.businessNumber,...row.records.map(record=>record.learnerName)].some(value=>value?.toLowerCase().includes(query));
  }).sort((a,b)=>Number(Boolean(b.followup))-Number(Boolean(a.followup)));
  const references=useMemo(()=>opportunityReferences(detail?(list??[]).filter(row=>row.id!==detail.id).concat(detail):list??[]),[list,detail]);
  const referenceLabel=t(lang,['商机编号','Opportunity ID','ID peluang']);
  const recordReference=(row:Opportunity)=>{
    const reference=references.get(row.id);
    return reference?`${referenceLabel} ${reference}`:undefined;
  };
  const recordPath=(row:Opportunity)=>crmHref({...listRoute,opportunity:row.id});
  const index=visible?.findIndex(row=>row.id===id)??-1;
  const previous=index>0?visible?.[index-1]:undefined;
  const following=index>=0?visible?.[index+1]:undefined;
  const activeRow=list?.find(row=>row.id===id);
  const detailUnavailable=error==='401'||error==='403'||error==='404';
  const headingRecord=detail??(!detailUnavailable?activeRow:undefined);
  const pendingAssistance=Number(detail?.assistanceHistory?.active)===1&&!detail?.assistanceHistory?.confirmedAt;
  const [assistUnavailable,setAssistUnavailable]=useState(false);
  useEffect(()=>{setAssisting(undefined);setAssistUnavailable(false);},[id]);
  useEffect(()=>{
    if(!openAssistance||!detail||error)return;
    const url=new URL(window.location.href);
    if(url.searchParams.get('opportunity')!==detail.id||!url.searchParams.has('assistEnrollment'))return;
    url.searchParams.delete('assistEnrollment');
    window.history.replaceState(window.history.state,'',url);
    if(detail.assistance?.allowed)setAssisting(pendingAssistance?'saved':'new');
    else setAssistUnavailable(true);
  },[detail,error,openAssistance,pendingAssistance]);
  const scopeLabel=t(lang,['商机范围','Opportunity scope','Cakupan peluang']);
  const scopes=[
    {value:'active',label:t(lang,['进行中','In progress','Berlangsung'])},
    {value:'closed',label:t(lang,['已结束','Ended','Berakhir'])},{value:'all',label:allLabel},
  ];
  const searchLabel=t(lang,['搜索商机','Search opportunities','Cari peluang']);
  const searchHint=t(lang,['姓名、客户编号或级别','Name, customer number, or level','Nama, nomor pelanggan, atau level']);
  const filterLabel=t(lang,['商机筛选','Opportunity filters','Filter peluang']);
  const filterCount=Object.entries(filters).filter(([key,value])=>value!==filterDefaults[key as keyof Filters]).length;
  const filterControls=<>
        <AdminSingleSelect label={t(lang,['负责人','Owner','Penanggung jawab'])} value={filters.opportunityOwner} lang={lang} isLight={isLight} onChange={value=>changeFilter('opportunityOwner',value)} options={[
          {value:'mine',label:t(lang,['我的商机','My opportunities','Peluang saya'])},{value:'all',label:t(lang,['权限内商机','Accessible opportunities','Peluang yang dapat diakses'])},
          {value:'unassigned',label:t(lang,['未分配','Unassigned','Belum ditugaskan'])},...ownerOptions.map(value=>({value,label:employeeName(value)||value})),
        ]}/>
        <AdminSingleSelect label={t(lang,['级别','Level','Level'])} value={filters.opportunityLevel} lang={lang} isLight={isLight} onChange={value=>changeFilter('opportunityLevel',value)}
          options={[{value:'',label:t(lang,['全部级别','All levels','Semua level'])},...levels.map(value=>({value,label:value}))]}/>
        <AdminSingleSelect label={t(lang,['销售阶段','Sales stage','Tahap penjualan'])} value={filters.opportunityStage} lang={lang} isLight={isLight} onChange={value=>changeFilter('opportunityStage',value)}
          options={[{value:'',label:t(lang,['全部销售阶段','All sales stages','Semua tahap penjualan'])},...salesProgressStages.map(([value])=>({value,label:progressLabel(value,lang)}))]}/>
        <AdminSingleSelect label={t(lang,['报名状态','Enrollment status','Status pendaftaran'])} value={filters.opportunityState} lang={lang} isLight={isLight} onChange={value=>changeFilter('opportunityState',value)}
          options={[{value:'',label:t(lang,['全部报名状态','All enrollment statuses','Semua status pendaftaran'])},...businessStates.map(value=>({value,label:states[value]?t(lang,states[value]):value}))]}/>
        <AdminSingleSelect label={t(lang,['待办','Follow-up','Tindak lanjut'])} value={filters.opportunityFollowup} lang={lang} isLight={isLight} onChange={value=>changeFilter('opportunityFollowup',value)}
          options={[{value:'',label:t(lang,['全部待办状态','All follow-up statuses','Semua status tindak lanjut'])},{value:'with',label:t(lang,['已有待办','Has follow-up','Ada tindak lanjut'])},
            {value:'without',label:t(lang,['暂无待办','No follow-up','Belum ada tindak lanjut'])}]}/>
  </>;
  const listRefreshLabel=t(lang,['刷新','Refresh','Segarkan']);
  const recordLayout=useAdminRecordSidebarLayout({id:'crm-opportunity-records',lang,persistent:desktopRail,
    listOpen:showList,setListOpen:setShowList,
    back:{label:t(lang,['返回商机列表','Back to opportunities','Kembali ke daftar peluang']),href:back}});
  return <section className="crm-opportunity-workspace" aria-busy={id?!error&&!detail:listLoading}>
    {id?<div className="crm-opportunity-detail-shell crm-detail-root"
      data-sidebar={desktopRail} data-record-scroll={desktopRail?'independent':'page'}
      data-theme={isLight?'light':'dark'} style={{'--crm-shell-height':shellHeight+'px'} as React.CSSProperties}>
      {recordLayout.listNavigation}
      <CrmRecordSidebar {...recordLayout.sidebar} title={label} count={visible?.length}
        selectedId={activeRow?.id} busy={!list&&!listFailed} busyLabel={t(lang,['更新中…','Updating…','Memperbarui…'])}
        filters={<CrmRecordFilters lang={lang} count={filterCount}
          search={<CrmRecordSearch label={searchLabel} placeholder={searchHint} value={filters.opportunityQuery}
            onChange={value=>changeFilter('opportunityQuery',value)}/>}>
          <AdminSingleSelect label={scopeLabel} value={filters.opportunityStatus} options={scopes} lang={lang} isLight={isLight}
            onChange={value=>changeFilter('opportunityStatus',value)}/>
          {filterControls}
          <div className="crm-record-filter-reset">
            {filterCount>0&&<button type="button" className="crm-work-link"
              onClick={()=>setFilters({...filterDefaults,opportunityStatus:'all',opportunityOwner:'all'})}>
              {t(lang,['清空条件','Clear conditions','Hapus filter'])}
            </button>}
            <button type="button" className="crm-work-link" onClick={()=>setFilters({...filterDefaults})}>
              {t(lang,['恢复默认筛选','Restore default filters','Pulihkan filter bawaan'])}
            </button>
          </div>
        </CrmRecordFilters>}
        note={detail&&visible&&index<0?t(lang,[
          '当前商机不在筛选结果中，已打开的详情与草稿保持不变。',
          'The current opportunity is outside these filters. The detail and draft stay open.',
          'Peluang ini di luar hasil filter. Detail dan draf tetap terbuka.',
        ]):undefined}
        empty={!visible?<p className="crm-record-sidebar-message" role={listFailed?'alert':'status'}>{listFailed?
          t(lang,['暂时无法读取商机。','Could not load opportunities.','Peluang belum dapat dimuat.']):
          t(lang,['正在读取商机…','Loading opportunities…','Memuat peluang…'])}</p>:
          !visible.length?<p className="crm-record-sidebar-message">{t(lang,['没有符合筛选条件的商机。','No opportunities match these filters.','Tidak ada peluang yang sesuai.'])}</p>:undefined}>
        {visible?.map(row=>{
          const state=currentStatus(row),title=opportunityTitle(row),reference=recordReference(row);
          return <CrmRecordRow key={row.id} selected={row.id===id} name={title}
            title={reference?`${title} · ${reference}`:title}
            href={recordPath(row)} onClick={event=>{
              if(event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
              event.preventDefault();
              if(row.id!==id||targetRecord)navigate(recordPath(row));
              else if(!desktopRail)setShowList(false);
            }}
            meta={<><CrmListStatus tone={enrollmentListTone(state)}>{states[state]?t(lang,states[state]):state}</CrmListStatus><small>{owner(row)}</small>{reference&&<small>{reference}</small>}</>}/>;
        })}
      </CrmRecordSidebar>
      <div className="crm-opportunity-detail-column crm-detail-panel" hidden={recordLayout.listOnly}>
        <AdminRecordHeader back={recordLayout.headerBack} title={
          <CrmRecordTitle title={headingRecord?opportunityTitle(headingRecord):label}
            status={detail&&!error&&(detail.identityPending
              ?<CrmIdentityStatus lead={{identityReview:{pending:true}}} lang={lang}/>
              :<div className="crm-current-stage"><span className="crm-current-state-label">
                {t(lang,['当前阶段','Current stage','Tahap saat ini'])}</span>
                <CrmSalesStage stage={detail.salesStage} lang={lang}/>
              </div>)}
            meta={detail&&!error&&<>{t(lang,['负责人','Owner','Penanggung jawab'])} {owner(detail)}
              {references.has(detail.id)&&<> · <span>{recordReference(detail)}</span></>}</>}/>}
          actions={
            <CrmDetailActions label={t(lang,['商机操作','Opportunity actions','Tindakan peluang'])}
              secondary={<>
              {!desktopRail&&!recordLayout.listOnly&&<div className="admin-record-browse">
                {previous&&<Link className="admin-row-action" to={recordPath(previous)}>{t(lang,['上一笔','Previous','Sebelumnya'])}</Link>}
                {following&&<Link className="admin-row-action" to={recordPath(following)}>{t(lang,['下一笔','Next','Berikutnya'])}</Link>}
              </div>}
              {recordLayout.browseAction}
              {detail&&!error&&detail.assistance?.allowed&&<AdminPageAction icon={GraduationCap} disabled={busy}
                label={pendingAssistance?t(lang,['查看协助报名','View assisted application','Lihat pendaftaran berbantuan']):
                  t(lang,['协助报名','Assist enrollment','Bantu pendaftaran'])}
                onClick={()=>setAssisting(pendingAssistance?'saved':'new')}/>}</>}
              primary={detail&&!error&&detail.canProgress&&<AdminPageAction icon={NotebookPen} variant="primary" loading={busy}
                label={t(lang,['记录商机进展','Record opportunity progress','Catat kemajuan peluang'])}
                onClick={()=>void openProgress(detail)}/>}/>}/>
        {detail&&!error&&<div className="crm-panel-next">
          <dl className="crm-opportunity-summary">
            <div>
              <dt>{t(lang,['关联客户','Related customer','Pelanggan terkait'])}</dt>
              <dd><a className="crm-work-link" href={customerLink(detail)}>
                {comparisonText(detail.customerName)===comparisonText(opportunityDisplayName(detail))
                  ?detail.businessNumber||t(lang,['查看客户','View customer','Lihat pelanggan'])
                  :[detail.customerName,detail.businessNumber].filter(Boolean).join(' · ')}
              </a></dd>
            </div>
            {(!ended(detail)&&!detail.identityPending||detail.identityPending&&canReviewIdentity)&&<div>
              <dt>{t(lang,['下一步','Next step','Langkah berikutnya'])}</dt>
              <dd>{detail.identityPending
                ?<a className="crm-work-link" href={crmHref({tab:'leads',lead:detail.customerId,identityLead:detail.customerId})}>
                  {t(lang,['核实身份','Review identity','Verifikasi identitas'])}</a>
                :nextAction(detail)}</dd>
            </div>}
          </dl>
        </div>}
        <div className="crm-detail-body crm-opportunity-detail-body" ref={detailBody} data-admin-scroll="detail"
          onKeyDown={containPaneKeys} tabIndex={0}>
        {error?<AdminListState lang={lang} state={detailUnavailable?'denied':'error'}
          message={detailUnavailable
            ?t(lang,['找不到此商机，或当前账号无权查看。','This opportunity is unavailable or outside your access.','Peluang tidak tersedia atau di luar akses Anda.'])
            :t(lang,['暂时无法读取商机。','Opportunity could not be loaded.','Peluang belum dapat dimuat.'])}
          onRetry={()=>{detailBody.current?.focus({preventScroll:true});setDetailRevision(value=>value+1);}}/>:detail?<div className="crm-opportunity-sections">
        {assistUnavailable&&<p role="status">{t(lang,['此商机当前无法协助报名。','Assisted enrollment is unavailable for this opportunity.','Pendaftaran berbantuan tidak tersedia untuk peluang ini.'])}</p>}
        {detail.assistanceHistory&&<section>
          <h2>{t(lang,['协助报名','Assisted enrollment','Pendaftaran berbantuan'])}</h2>
          <p className="crm-work-muted">
            {(detail.identityPending||detail.followup||currentStatus(detail)!=='awaiting_confirmation')&&<>
              {detail.assistanceHistory.confirmedAt?t(lang,['学员已确认','Confirmed by learner','Dikonfirmasi siswa']):
                pendingAssistance?t(lang,['待学员确认','Awaiting learner confirmation','Menunggu konfirmasi siswa']):
                  t(lang,['链接已失效','Link expired','Tautan kedaluwarsa'])}{' · '}
            </>}
            {assistanceMailLabel(lang,detail.assistanceHistory.mail)}
          </p>
        </section>}
        {assisting&&detail.assistance&&<CrmEnrollmentAssistance key={detail.id} opportunityId={detail.id} level={detail.level}
          customerName={detail.customerName} contacts={detail.assistance} lang={lang} isLight={isLight}
          initial={assisting==='saved'?detail.assistanceHistory:undefined}
          onClose={()=>setAssisting(undefined)} onDone={()=>setAssistanceRevision(value=>value+1)}/>}
        {!!detail.progress?.length&&<section>
          <h2>{t(lang,['商机进展','Opportunity progress','Kemajuan peluang'])}</h2>
          <ol className="crm-course-records">{detail.progress.map(entry=><li key={entry.id}>
            <strong>{progressLabel(entry.stage,lang)}</strong> · {employeeName(entry.actor)} · <time dateTime={entry.createdAt}>{formatCrmEventTime(entry.createdAt)}</time>
            <p>{entry.note}</p>
            {entry.factId&&<a className="crm-work-link" href={crmHref({tab:'leads',lead:detail.customerId,target:'fact',targetId:entry.factId})}>
              {t(lang,['查看客户原始记录','View original customer record','Lihat catatan asli pelanggan'])}
            </a>}
            {entry.sources?.map(source=><CrmOpportunitySourceLink key={`${source.type}:${source.id}`} source={source} leadId={detail.customerId} lang={lang}/>)}
          </li>)}</ol>
        </section>}
        {!!detail.chatEvidence?.length&&<section>
          <h2>{t(lang,['报名之前的咨询','Consultation before enrollment','Konsultasi sebelum pendaftaran'])}</h2>
          {detail.chatEvidence.map(source=><CrmOpportunitySourceLink key={source.id} source={source} leadId={detail.customerId} lang={lang}/>)}
        </section>}
        <section>
          <h2>{t(lang,['课程报名记录','Course enrollment records','Catatan pendaftaran kursus'])}</h2>
          <CourseRecords records={detail.records} link={false} lang={lang} emails={detail.emails} targetRecord={targetRecord}
            onConfirmLesson={detail.canProgress?setLessonToConfirm:undefined}
            paymentHref={canFinance&&detail.state==='applying'&&!ended(detail)&&!detail.identityPending?paymentLink:undefined}/>
          {lessonToConfirm&&detail.records.some(row=>row.id===lessonToConfirm.id)&&<PrivateLessonConfirmation
            opportunityId={detail.id} row={lessonToConfirm} lang={lang} isLight={isLight} onClose={()=>setLessonToConfirm(undefined)}
            onSaved={refreshed=>{
              setLessonToConfirm(undefined);
              if(refreshed?.id===detail.id)setDetail(refreshed);
              else setDetailRevision(value=>value+1);
            }}/>}
        </section>
        </div>:<p role="status">{t(lang,['正在读取商机…','Loading opportunity…','Memuat peluang…'])}</p>}
        </div>
      </div>
    </div>:<>
      <AdminPageHeader title={label}
        subtitle={t(lang,['按学员和课程跟踪报名意向、当前进展及下一步。','Track enrollment interest, progress and next steps by learner and course.','Lacak minat pendaftaran, perkembangan, dan langkah berikutnya menurut peserta dan kursus.'])}
        actions={<AdminRefreshAction label={listRefreshLabel} loading={listLoading}
        onClick={()=>setListRevision(value=>value+1)}/>}/>
      {listFailed&&<p role="alert">{list
        ?t(lang,['刷新失败，仍显示上次读取的商机。','Refresh failed. Showing the last loaded opportunities.','Gagal menyegarkan. Peluang yang terakhir dimuat masih ditampilkan.'])
        :t(lang,['暂时无法读取商机。','Opportunities could not be loaded.','Peluang belum dapat dimuat.'])}</p>}
      {result?.customer&&<div className="crm-opportunity-filters">
        <span className="crm-work-muted">{t(lang,['客户','Customer','Pelanggan'])} · <a className="crm-work-link"
          href={crmHref({tab:'leads',lead:result.customer.id})}>{result.customer.name}</a></span>
        <a className="crm-work-link" href={crmHref({tab:'opportunities',...filters})}>{t(lang,['清除客户筛选','Clear customer filter','Hapus filter pelanggan'])}</a>
      </div>}
      <CrmListViews label={scopeLabel}>
        {scopes.map(({value,label})=>
          <button type="button" key={value} aria-pressed={filters.opportunityStatus===value} onClick={()=>changeFilter('opportunityStatus',value)}>{label}</button>)}
      </CrmListViews>
      <CrmListFilters label={filterLabel}>
        <CrmListSearch inputRef={searchField} label={searchLabel} placeholder={searchHint}
          value={filters.opportunityQuery} onChange={value=>changeFilter('opportunityQuery',value)}/>
        {filterControls}
      </CrmListFilters>
      {visible&&<p className="crm-list-meta" role="status">{t(lang,[`匹配 ${visible.length} 笔商机`,`${visible.length} matching opportunities`,`${visible.length} peluang cocok`])}</p>}
      {visible?.length===0?<p className="crm-work-muted">{t(lang,['当前没有符合条件的商机。','No opportunities match.','Tidak ada peluang yang sesuai.'])}</p>:visible&&
        <CrmListTable label={label} viewportRef={tableScroll} headers={([
            ['商机','Opportunity','Peluang'],['负责人','Owner','Penanggung jawab'],
            ['销售阶段','Sales stage','Tahap penjualan'],['报名状态','Enrollment status','Status pendaftaran'],
            ['下一步','Next step','Langkah berikutnya'],['本次来源','Opportunity source','Sumber peluang'],
          ] as const).map(copy=>t(lang,copy))}>
          {visible.map(row=>{
            const status=currentStatus(row);
            const attribution=[...row.records].reverse().find(record=>record.attribution)?.attribution;
            return <tr key={row.id} data-opportunity-id={row.id}>
              <td><AdminRecordEntry href={recordPath(row)} onClick={()=>rememberListPosition(row.id)}>
                {opportunityTitle(row)}</AdminRecordEntry>
                <small>{row.businessNumber}</small>
                {references.has(row.id)&&<small>{recordReference(row)}</small>}</td>
              <td>{owner(row)}</td><td>{stage(row,lang)}</td><td><CrmListStatus tone={enrollmentListTone(status)}>
                {states[status]?t(lang,states[status]):status}</CrmListStatus></td>
              <td>{nextAction(row)}</td>
              <td>{!row.records.length&&row.state==='interest'?t(lang,['销售记录','Sales record','Catatan sales']):sourceLabel(attribution,lang)}</td>
            </tr>;
          })}
        </CrmListTable>}
    </>}
    {saveError&&<AdminFormFeedback state="error" lang={lang} placement="floating">
      {t(lang,['暂时无法打开进展记录，请重试。','Progress could not be opened. Try again.','Catatan kemajuan belum dapat dibuka. Coba lagi.'])}
    </AdminFormFeedback>}
    {progressReadFailed&&<AdminSavedReadError lang={lang} busy={readingProgress} onRetry={()=>void readSavedProgress()}/>}
    {progress&&<CrmOperationLayer progress customerContext={false} lang={lang} isLight={isLight} busy={busy}
      context={progress.opportunity.customerName} title={t(lang,['记录商机进展','Record opportunity progress','Catat kemajuan peluang'])} onClose={closeProgress}>
      <CrmSimpleWorkflow lead={progress.lead} fixedOpportunity={progress.opportunity} lang={lang} isLight={isLight} timezone={viewerTimeZone()}
        initialDraft={progress.agreementId?{simple:{agreementIntent:'update',commitmentChange:{id:progress.agreementId,status:''}}}:undefined}
        onDirty={setProgressDirty} onBusy={setBusy} onCancel={closeProgress}
        onSaved={async()=>{
          setProgress(null);
          await readSavedProgress();
        }}/>
    </CrmOperationLayer>}
    {confirmDiscard&&<AdminDiscardDialog lang={lang} isLight={isLight}
      title={t(lang,['修改尚未保存','Unsaved changes','Perubahan belum disimpan'])}
      description={t(lang,['可以继续编辑，或放弃未保存的修改后继续。','Keep editing or discard your unsaved changes.','Lanjutkan mengedit atau abaikan perubahan yang belum disimpan.'])}
      keepLabel={t(lang,['继续编辑','Keep editing','Lanjutkan mengedit'])}
      discardLabel={t(lang,['放弃并继续','Discard and continue','Abaikan dan lanjutkan'])}
      onKeep={()=>setConfirmDiscard(false)} onDiscard={()=>{setProgress(null);setConfirmDiscard(false);}}/>}
  </section>;
}
