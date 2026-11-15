import { useEffect, useRef, useState } from 'react';
import { CrmPageIdentity } from './CrmPageIdentity';
import { CrmSingleSelect } from './CrmSingleSelect';
import { crmLocale, type CrmLanguage } from '../../utils/crmLanguage';
import { formatCrmEventTime, formatCrmSummaryTime, viewerTimeZone } from '../../utils/crmOperatingTime';
import { formatCurrency } from '../../utils/currency';
import { progressLabel, salesProgressStages } from '../../utils/crmSalesProgress';
import { interestOption } from '../EnrollmentInterests';
import { enrollmentStatuses } from '../EnrollmentApplication';
import { CrmOperationLayer } from './CrmOperationLayer';
import { AdminField, AdminForm, AdminRequiredNote } from '../AdminForm';
import { AdminFormActions } from '../AdminFormLayout';
import { describeFollowUpTask } from '../../utils/crmFollowUp';
import { CrmSimpleWorkflow } from './CrmSimpleWorkflow';
import { CrmDisclosure } from './CrmDisclosure';
import { CrmDiscardDialog, CrmSaveFeedback } from './CrmDetailWorkspace';
import { opportunityFilterDefaults as filterDefaults,opportunityListPath,type OpportunityFilters as Filters } from '../../utils/crmEnrollmentOpportunityRoute';
import { contactEmailText, validContactEmail } from '../../utils/contactEmail';
import { CrmEnrollmentReviewDeadline } from './CrmEnrollmentReviewDeadline';
import { CrmOpportunitySourceLink } from './CrmOpportunitySources';
import type { OpportunitySource } from '../../utils/crmOpportunitySources';

type Copy = readonly [string,string,string];
type CourseRecord = {
  id:string; kind:'order'|'waitlist'|'demand'; opportunityId:string|null; state:string; createdAt:string;
  class:{level:string;firstLesson:string;schedule:string;opened:boolean}|null;
  criteria:{level:string;period:string;format:string;notes:string}|null;
  price:number|null;received:number|null;learnerName?:string|null;paymentDueAt?:string|null;firstReviewDueAt?:string|null;
  attribution?:{entry:string;source?:string;campaign?:string;verified:boolean}|null;
  latestNotice?:string;
  enrollmentEmail?:string;
};
type EnrollmentEmail = {id:string;orderId:string;kind:string;state:string;subject:string|null;language:string|null;recordedAt:string};
type OpportunityFollowup = {kind:'agreement'|'task';id:string;type?:string;action?:string;at?:string;date?:string};
type Opportunity = {
  id:string; level:string;customerId:string;customerName:string;businessNumber:string;owner:string|null;identityPending:boolean;
  state:'enrolled'|'aftercare'|'applying'|'waiting'|'interest'|'closed';records:CourseRecord[];salesStage:string;revision:number;
  emails?:EnrollmentEmail[];
  progress?:{id:string;actor:string;stage:string;note:string;createdAt:string;factId?:string;sources?:OpportunitySource[]}[];canProgress?:boolean;canInitiateFollowup?:boolean;followup?:OpportunityFollowup|null;
};
type OpportunityList = {opportunities:Opportunity[];customer?:{id:string;name:string}};
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
  if(row.state==='applying') return row.records.find(requiresPaymentReview)?.state??'awaiting_payment';
  if(row.state==='closed') return row.records.at(-1)?.state??'closed';
  return enrollmentStatus[row.state];
}
function ended(row:Opportunity) {
  return ['enrolled','closed'].includes(row.state)||row.salesStage==='progress:closed';
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
  delivered:['已送达','Delivered','Terkirim'],
  failed:['投递失败','Delivery failed','Pengiriman gagal'],
};
const emailLocale:Record<string,Copy> = {
  zh:['中文','Chinese','Mandarin'],en:['英文','English','Inggris'],id:['印尼文','Indonesian','Indonesia'],
};
function OrderEmailHistory({rows,lang,open}:{rows:EnrollmentEmail[];lang:CrmLanguage;open:boolean}) {
  return <CrmDisclosure heading={t(lang,['邮件记录','Email history','Riwayat email'])} open={open}>
    {rows.length===0?<p className="crm-work-muted">{t(lang,['暂无邮件记录。','No email history.','Belum ada riwayat email.'])}</p>:
      <ol className="crm-enrollment-email-history">{rows.map(mail=><li key={mail.id}>
        <strong>{mail.subject||'—'}</strong>
        <div className="crm-work-muted">
          {emailKind[mail.kind]?t(lang,emailKind[mail.kind]):mail.kind} · {mail.language&&emailLocale[mail.language]?t(lang,emailLocale[mail.language]):'—'} · {emailDelivery[mail.state]?t(lang,emailDelivery[mail.state]):t(lang,['状态待核对','Status unconfirmed','Status belum dikonfirmasi'])} · <time dateTime={mail.recordedAt}>{formatCrmEventTime(mail.recordedAt)}</time>
        </div>
      </li>)}</ol>}
  </CrmDisclosure>;
}
function sourceLabel(attribution:CourseRecord['attribution'],lang:CrmLanguage) {
  if(!attribution) return '—';
  const entry=attribution.entry==='linkhub'?'UPER Links':attribution.entry==='website'
    ?t(lang,['官网','Website','Situs web']):t(lang,['直接访问','Direct','Langsung']);
  return [entry,attribution.verified?attribution.source:null,attribution.campaign].filter(Boolean).join(' · ');
}
function CourseRecords({ records, link, lang, emails, targetRecord, onChangeEmail }: {
  records:CourseRecord[];link:boolean;lang:CrmLanguage;emails?:EnrollmentEmail[];targetRecord?:string|null;
  onChangeEmail?:(row:CourseRecord)=>void;
}) {
  if(!records.length) return <p className="crm-work-muted">{t(lang,['暂无课程记录。','No course records.','Belum ada catatan kursus.'])}</p>;
  return <ol className="crm-course-records">
    {records.map(row=><li key={row.kind+row.id} id={link?undefined:'enrollment-record-'+row.id}>
      <strong>{t(lang,kinds[row.kind])}{row.class?' · '+row.class.level:''}</strong> <span>{states[row.state]?t(lang,states[row.state]):row.state}</span>
      <div className="crm-work-muted"><time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleDateString(crmLocale(lang))}</time> · {row.id}</div>
      {row.class&&<p>{row.class.firstLesson.replace('T',' ')} WIB · {row.class.schedule}{row.class.opened?' · '+t(lang,['已确认开班','Class confirmed','Kelas dikonfirmasi']):''}</p>}
      {row.criteria&&<p>{[row.criteria.level,row.criteria.period,row.criteria.format].map(value=>interestOption(lang,value)).join(' · ')}{row.criteria.notes?' — '+row.criteria.notes:''}</p>}
      {row.price!==null&&row.received!==null&&<p>{t(lang,['核实实收／应收','Verified receipts / amount due','Dana terverifikasi / tagihan'])} {formatCurrency(row.received,lang)} / {formatCurrency(row.price,lang)}</p>}
      {row.firstReviewDueAt&&<CrmEnrollmentReviewDeadline dueAt={row.firstReviewDueAt} lang={lang}/>}
      {row.attribution&&<p>{t(lang,['报名来源','Enrollment source','Sumber pendaftaran'])} · {sourceLabel(row.attribution,lang)}</p>}
      {link&&row.latestNotice&&<p>{t(lang,['最近一封邮件记录','Latest email record','Catatan email terakhir'])} · {row.latestNotice}</p>}
      {link&&row.opportunityId&&<a className="crm-work-link" href={crmHref({tab:'opportunities',opportunity:row.opportunityId,enrollmentRecord:row.id})}>{t(lang,['查看商机','View opportunity','Lihat peluang'])}</a>}
      {onChangeEmail&&row.enrollmentEmail&&<p><button type="button" className="crm-work-link" onClick={()=>onChangeEmail(row)}>
        {t(lang,['更改报名邮箱','Change enrollment email','Ubah email pendaftaran'])}</button></p>}
      {emails&&row.kind==='order'&&<OrderEmailHistory lang={lang} rows={emails.filter(mail=>mail.orderId===row.id)} open={targetRecord===row.id}/>}
    </li>)}
  </ol>;
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
    {discard&&<CrmDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)} onDiscard={onClose}/>}
  </>;
}

export function CrmCustomerCourseRecords({id,lang,isLight}:{id:string;lang:CrmLanguage;isLight:boolean}) {
  const [records,setRecords]=useState<CourseRecord[]>();
  const [error,setError]=useState(false);
  const [canChangeEmail,setCanChangeEmail]=useState(false);
  const [editingEmail,setEditingEmail]=useState<CourseRecord>();
  const [saved,setSaved]=useState(false);
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
    const timer=window.setTimeout(()=>setSaved(false),3500);
    return ()=>window.clearTimeout(timer);
  },[saved]);
  if(!records?.length&&!error) return null;
  return <section className="crm-opportunity-records" aria-label={t(lang,['课程报名记录','Course enrollment records','Catatan pendaftaran kursus'])}>
    <h3>{t(lang,['课程报名记录','Course enrollment records','Catatan pendaftaran kursus'])}</h3>
    {error?<p role="alert">{t(lang,['暂时无法读取课程记录。','Course records could not be loaded.','Catatan kursus belum dapat dimuat.'])}</p>:
      <CourseRecords records={records??[]} link lang={lang} onChangeEmail={canChangeEmail?setEditingEmail:undefined}/>}
    {editingEmail&&<EnrollmentEmailChange path={path+'/email'} row={editingEmail} lang={lang} isLight={isLight}
      onClose={()=>setEditingEmail(undefined)} onSaved={email=>{
        setRecords(current=>current?.map(row=>row.id===editingEmail.id&&row.kind===editingEmail.kind?{...row,enrollmentEmail:email}:row));
        setEditingEmail(undefined);setSaved(true);
      }}/>}
    {saved&&<span className="crm-opportunity-feedback" role="status">{t(lang,['报名邮箱已更新，请用新邮箱重新验证。',
      'Enrollment email updated. Verify the new address.','Email pendaftaran diperbarui. Verifikasi alamat baru.'])}</span>}
  </section>;
}

export function CrmEnrollmentOpportunities({lang,isLight,employees,actorId,canReviewIdentity,canFinance}: {
  lang:CrmLanguage;isLight:boolean;employees:{id:string;displayName?:string}[];actorId:string;canReviewIdentity:boolean;canFinance:boolean;
}) {
  const params=new URLSearchParams(window.location.search);
  const id=params.get('opportunity');
  const customerId=params.get('customerId');
  const [result,setResult]=useState<OpportunityList>();
  const list=result?.opportunities;
  const [detail,setDetail]=useState<Opportunity>();
  const [error,setError]=useState('');
  const targetRecord=params.get('enrollmentRecord');
  const resumeList=params.get('resumeOpportunityList')==='1';
  const [filters,setFilters]=useState<Filters>(()=>Object.fromEntries(
    Object.entries(filterDefaults).map(([key,fallback])=>[key,params.get(key)??fallback]),
  ) as Filters);
  const changeFilter=(key:keyof Filters,value:string)=>setFilters(current=>({...current,[key]:value}));
  const [progress,setProgress]=useState<{lead:any;opportunity:Opportunity;agreementId?:string}|null>(null);
  const [progressDirty,setProgressDirty]=useState(false);
  const [confirmDiscard,setConfirmDiscard]=useState(false);
  const [busy,setBusy]=useState(false);
  const [saveError,setSaveError]=useState(false);
  const [notice,setNotice]=useState(false);
  const tableScroll=useRef<HTMLDivElement>(null);
  const searchField=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const controller=new AbortController();
    const failure=(cause:Error)=>{if(cause.name!=='AbortError')setError(cause.message);};
    if(id) void read<Opportunity>(base+'/'+encodeURIComponent(id),controller.signal).then(setDetail,failure);
    else void read<OpportunityList>(base+(customerId?'?'+new URLSearchParams({customerId}):''),controller.signal).then(setResult,failure);
    return ()=>controller.abort();
  },[id,customerId]);
  useEffect(()=>{
    if(id) return;
    const url=new URL(window.location.href);
    if(url.searchParams.get('tab')!=='opportunities') return;
    for(const key of Object.keys(filterDefaults) as (keyof Filters)[]) {
      if(filters[key]===filterDefaults[key]) url.searchParams.delete(key);
      else url.searchParams.set(key,filters[key]);
    }
    window.history.replaceState(null,'',url);
  },[filters,id]);
  useEffect(()=>{
    if(detail&&targetRecord) document.getElementById('enrollment-record-'+targetRecord)?.scrollIntoView({block:'nearest'});
  },[detail,targetRecord]);
  const listRoute={tab:'opportunities',...filters,...(customerId?{customerId}: {})};
  const listPath=opportunityListPath(filters,customerId);
  const back=listPath+'&resumeOpportunityList=1';
  const positionKey='uper_crm_opportunity_position:'+actorId+':'+listPath;
  const rememberListPosition=(opportunityId:string)=>{
    if(id)return;
    try{
      sessionStorage.setItem(positionKey,JSON.stringify({opportunityId,top:window.scrollY,left:tableScroll.current?.scrollLeft??0}));
    }catch{/* Navigation still works when storage is unavailable. */}
  };
  useEffect(()=>{
    if(id||!resumeList||!list)return;
    try{
      const value=sessionStorage.getItem(positionKey);
      if(!value)return;
      const position=JSON.parse(value);
      const frame=requestAnimationFrame(()=>{
        sessionStorage.removeItem(positionKey);
        const row=[...tableScroll.current?.querySelectorAll<HTMLTableRowElement>('[data-opportunity-id]')??[]]
          .find(item=>item.dataset.opportunityId===position.opportunityId);
        (row?.querySelector<HTMLAnchorElement>('a')??searchField.current)?.focus({preventScroll:true});
        if(tableScroll.current)tableScroll.current.scrollLeft=position.left;
        window.scrollTo({top:position.top,behavior:'instant'});
        const url=new URL(window.location.href);
        url.searchParams.delete('resumeOpportunityList');
        window.history.replaceState(window.history.state,'',url);
      });
      return ()=>cancelAnimationFrame(frame);
    }catch{/* An invalid or missing checkpoint does not affect list access. */}
  },[id,list,positionKey,resumeList]);
  const employeeName=(id:string|null)=>employees.find(employee=>employee.id===id)?.displayName||id;
  const owner=(row:Opportunity)=>employeeName(row.owner)||t(lang,['未分配','Unassigned','Belum ditugaskan']);
  const customerLink=(row:Opportunity)=>crmHref({tab:'leads',lead:row.customerId});
  const paymentLink=(record:CourseRecord)=>crmHref({tab:'payments',enrollmentOrder:record.id,opportunityReturn:listPath});
  const openProgress=async(row:Opportunity,agreementId?:string)=>{
    if(busy)return;
    setBusy(true);setSaveError(false);setNotice(false);
    try{
      const lead=await read<any>('/api/crm/leads/'+row.customerId,new AbortController().signal);
      setProgress({lead:lead.lead??lead,opportunity:row,agreementId});
      setProgressDirty(false);
    }catch{setSaveError(true);}finally{setBusy(false);}
  };
  const closeProgress=()=>{
    if(busy)return;
    if(progressDirty)setConfirmDiscard(true);
    else setProgress(null);
  };
  const nextAction=(row:Opportunity)=>{
    if(ended(row))return t(lang,next[row.state==='enrolled'?'enrolled':'closed']);
    if(row.identityPending)return t(lang,['待核实身份','Identity review pending','Identitas menunggu verifikasi']);
    const review=row.records.find(requiresPaymentReview);
    const reviewDue=row.records.flatMap(record=>record.firstReviewDueAt?[record.firstReviewDueAt]:[]).sort()[0];
    const reviewDeadline=reviewDue&&<CrmEnrollmentReviewDeadline dueAt={reviewDue} lang={lang} compact/>;
    if(review&&row.state==='applying'&&canFinance)return <>
      <a className="crm-work-link" href={paymentLink(review)} onClick={()=>rememberListPosition(row.id)}>{t(lang,['核对到账','Verify payment','Verifikasi pembayaran'])}</a>
      {reviewDeadline}</>;
    const due=row.records.find(record=>record.state==='awaiting_payment')?.paymentDueAt;
    const followup=row.followup;
    if(followup){
      const name=followup.action||describeFollowUpTask({id:followup.id,kind:followup.type||'',dueAt:followup.at||''} as any,lang,viewerTimeZone()).action;
      const action=due?t(lang,['跟进付款','Follow up on payment','Tindak lanjuti pembayaran']):name;
      return <>
        {followup.kind==='agreement'?
          <button type="button" className="crm-work-link" disabled={busy} onClick={()=>void openProgress(row,followup.id)} title={name}>{action}</button>:
          <a className="crm-work-link" title={name} href={crmHref({tab:'leads',lead:row.customerId,target:'task',targetId:followup.id})}>{action}</a>}
        {followup.at||followup.date?<div className="crm-work-muted"><time dateTime={followup.at||followup.date}>{followup.at?formatCrmSummaryTime(followup.at):followup.date}</time></div>:null}
        {reviewDeadline}
      </>;
    }
    if(review&&row.state==='applying'){
      const status=t(lang,['待财务核验','Awaiting finance verification','Menunggu verifikasi keuangan']);
      return <>{id===row.id?status:<a className="crm-work-link" href={crmHref({...listRoute,opportunity:row.id,enrollmentRecord:review.id})}
        onClick={()=>rememberListPosition(row.id)}>{status}</a>}{reviewDeadline}</>;
    }
    if(due)return <>{t(lang,states.awaiting_payment)}<div className="crm-work-muted"><time dateTime={due} title={formatCrmEventTime(due)}>{formatCrmSummaryTime(due)}</time></div></>;
    if(row.canInitiateFollowup&&row.state==='interest'&&!id)return <button type="button" className="crm-work-link" disabled={busy} onClick={()=>void openProgress(row)}>{t(lang,['记录进展','Record progress','Catat kemajuan'])}</button>;
    return <>{t(lang,next[row.state])}{reviewDeadline}</>;
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
      [row.level,row.customerName,row.businessNumber,...row.records.map(record=>record.learnerName)].some(value=>value?.toLowerCase().includes(query));
  });
  return <section className="crm-opportunity-workspace" aria-busy={!error&&(id?!detail:!list)}>
    {id&&<a className="crm-work-link" href={back}>{t(lang,['返回商机列表','Back to opportunities','Kembali ke daftar peluang'])}</a>}
    <div className="admin-page-toolbar"><CrmPageIdentity title={detail?detail.customerName+' · '+detail.level:label}/></div>
    {error?<p role="alert">{error==='404'?t(lang,['找不到此商机，或当前账号无权查看。','This opportunity is unavailable or outside your access.','Peluang tidak tersedia atau di luar akses Anda.']):t(lang,['暂时无法读取商机。','Opportunities could not be loaded.','Peluang belum dapat dimuat.'])}</p>:id?
      detail?<><dl className="crm-opportunity-summary">
        <div><dt>{t(lang,['客户','Customer','Pelanggan'])}</dt><dd><a className="crm-work-link" href={customerLink(detail)}>{detail.customerName} · {detail.businessNumber}</a></dd></div>
        <div><dt>{t(lang,['负责人','Owner','Penanggung jawab'])}</dt><dd>{owner(detail)}</dd></div>
        <div><dt>{t(lang,['销售阶段','Sales stage','Tahap penjualan'])}</dt><dd>{stage(detail,lang)}</dd></div>
        <div><dt>{t(lang,['下一步','Next step','Langkah berikutnya'])}</dt><dd>{nextAction(detail)}</dd></div>
      </dl>
      {detail.identityPending&&canReviewIdentity&&<a className="crm-work-link" href={crmHref({tab:'leads',lead:detail.customerId,identityLead:detail.customerId})}>{t(lang,['核实身份','Review identity','Verifikasi identitas'])}</a>}
      {detail.canProgress&&<button type="button" className="crm-work-button justify-self-start" disabled={busy}
        onClick={()=>void openProgress(detail)}>{t(lang,['记录商机进展','Record opportunity progress','Catat kemajuan peluang'])}</button>}
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
      <CourseRecords records={detail.records} link={false} lang={lang} emails={detail.emails} targetRecord={targetRecord}/></>:null
    : <>
      {result?.customer&&<div className="crm-opportunity-filters">
        <span className="crm-work-muted">{t(lang,['客户','Customer','Pelanggan'])} · <a className="crm-work-link"
          href={crmHref({tab:'leads',lead:result.customer.id})}>{result.customer.name}</a></span>
        <a className="crm-work-link" href={crmHref({tab:'opportunities',...filters})}>{t(lang,['清除客户筛选','Clear customer filter','Hapus filter pelanggan'])}</a>
      </div>}
      <div className="crm-opportunity-filters">
        <input ref={searchField} type="search" aria-label={t(lang,['搜索商机','Search opportunities','Cari peluang'])} placeholder={t(lang,['姓名、客户编号或级别','Name, customer number, or level','Nama, nomor pelanggan, atau level'])} value={filters.opportunityQuery} onChange={event=>changeFilter('opportunityQuery',event.currentTarget.value)}/>
        <CrmSingleSelect label={t(lang,['商机范围','Opportunity scope','Cakupan peluang'])} value={filters.opportunityStatus} lang={lang} isLight={isLight} onChange={value=>changeFilter('opportunityStatus',value)} options={[
          {value:'active',label:t(lang,['进行中','In progress','Berlangsung'])},{value:'closed',label:t(lang,['已结束','Ended','Berakhir'])},{value:'all',label:allLabel},
        ]}/>
        <CrmSingleSelect label={t(lang,['负责人','Owner','Penanggung jawab'])} value={filters.opportunityOwner} lang={lang} isLight={isLight} onChange={value=>changeFilter('opportunityOwner',value)} options={[
          {value:'mine',label:t(lang,['我的商机','My opportunities','Peluang saya'])},{value:'all',label:t(lang,['权限内商机','Accessible opportunities','Peluang yang dapat diakses'])},
          {value:'unassigned',label:t(lang,['未分配','Unassigned','Belum ditugaskan'])},...ownerOptions.map(value=>({value,label:employeeName(value)||value})),
        ]}/>
        <CrmSingleSelect label={t(lang,['级别','Level','Level'])} value={filters.opportunityLevel} lang={lang} isLight={isLight} onChange={value=>changeFilter('opportunityLevel',value)}
          options={[{value:'',label:allLabel},...levels.map(value=>({value,label:value}))]}/>
        <CrmSingleSelect label={t(lang,['销售阶段','Sales stage','Tahap penjualan'])} value={filters.opportunityStage} lang={lang} isLight={isLight} onChange={value=>changeFilter('opportunityStage',value)}
          options={[{value:'',label:allLabel},...salesProgressStages.map(([value])=>({value,label:progressLabel(value,lang)}))]}/>
        <CrmSingleSelect label={t(lang,['业务状态','Enrollment status','Status pendaftaran'])} value={filters.opportunityState} lang={lang} isLight={isLight} onChange={value=>changeFilter('opportunityState',value)}
          options={[{value:'',label:allLabel},...businessStates.map(value=>({value,label:states[value]?t(lang,states[value]):value}))]}/>
      </div>
      {visible?.length===0?<p className="crm-work-muted">{t(lang,['当前没有符合条件的商机。','No opportunities match.','Tidak ada peluang yang sesuai.'])}</p>:visible&&
        <div ref={tableScroll} className="crm-opportunity-table"><table>
          <thead><tr>{([
            ['商机','Opportunity','Peluang'],['学员','Learner','Siswa'],['负责人','Owner','Penanggung jawab'],
            ['销售阶段','Sales stage','Tahap penjualan'],['业务状态','Enrollment status','Status pendaftaran'],
            ['下一步','Next step','Langkah berikutnya'],['本次来源','Opportunity source','Sumber peluang'],
          ] as const).map(copy=><th scope="col" key={copy[0]}>{t(lang,copy)}</th>)}</tr></thead>
          <tbody>{visible.map(row=>{
            const status=currentStatus(row);
            const attribution=[...row.records].reverse().find(record=>record.attribution)?.attribution;
            return <tr key={row.id} data-opportunity-id={row.id}>
              <td><a className="crm-work-link" href={crmHref({...listRoute,opportunity:row.id})} onClick={()=>rememberListPosition(row.id)}>{row.level}</a></td>
              <td><a className="crm-work-link" href={customerLink(row)}>{[...row.records].reverse().find(record=>record.learnerName)?.learnerName||row.customerName}</a></td>
              <td>{owner(row)}</td><td>{stage(row,lang)}</td><td>{states[status]?t(lang,states[status]):status}</td>
              <td>{nextAction(row)}</td>
              <td>{sourceLabel(attribution,lang)}</td>
            </tr>;
          })}</tbody>
        </table></div>}
    </>}
    {notice&&<span className="crm-opportunity-feedback" role="status">{t(lang,['商机进展已保存','Opportunity progress saved','Kemajuan peluang tersimpan'])}</span>}
    {saveError&&<p role="alert">{t(lang,['暂时无法读取最新记录，请刷新后查看。','The latest record could not be loaded. Refresh to view it.','Catatan terbaru belum dapat dimuat. Muat ulang untuk melihatnya.'])}</p>}
    {progress&&<CrmOperationLayer progress customerContext={false} lang={lang} isLight={isLight} busy={busy}
      context={progress.opportunity.customerName} title={t(lang,['记录商机进展','Record opportunity progress','Catat kemajuan peluang'])} onClose={closeProgress}>
      <CrmSimpleWorkflow lead={progress.lead} fixedOpportunity={progress.opportunity} lang={lang} isLight={isLight} timezone={viewerTimeZone()}
        initialDraft={progress.agreementId?{simple:{agreementIntent:'update',commitmentChange:{id:progress.agreementId,status:''}}}:undefined}
        onDirty={setProgressDirty} onBusy={setBusy} onCancel={closeProgress}
        onSaved={async()=>{
          setProgress(null);setNotice(true);
          try{
            const signal=new AbortController().signal;
            if(id)setDetail(await read<Opportunity>(base+'/'+id,signal));
            else setResult(await read<OpportunityList>(base+(customerId?'?'+new URLSearchParams({customerId}):''),signal));
          }catch{setSaveError(true);}
        }}/>
    </CrmOperationLayer>}
    {confirmDiscard&&<CrmDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setConfirmDiscard(false)}
      onDiscard={()=>{setProgress(null);setConfirmDiscard(false);}}/>}
  </section>;
}
