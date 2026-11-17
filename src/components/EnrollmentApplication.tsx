import { enrollmentClassTitle } from '../utils/enrollmentCatalog';
import { allowsEnrollmentProof } from '../utils/enrollmentOrderStatus';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { formatCurrency } from '../utils/currency';
import type { PublicEnrollmentClass } from '../utils/enrollmentCatalog';
import { EnrollmentOrderAftercare, type EnrollmentAftercare } from './EnrollmentOrderAftercare';
import { enrollmentSupportPath } from './EnrollmentSupport';
import { EnrollmentOrderResult } from './EnrollmentOrderResult';
import { EnrollmentPayment, type EnrollmentOrder as Order } from './EnrollmentPayment';
import { EnrollmentDemandForm, interestOption, waitlistStates, type DemandItem, type Interests } from './EnrollmentInterests';
import { sortEnrollmentRecords } from '../utils/enrollmentRecordOrder';
import { enrollmentAssistancePath } from '../utils/enrollmentAssistance';

type Language = 'zh' | 'en' | 'id';
type Copy = readonly [string, string, string];
export const enrollmentStatuses: Record<string, Copy> = {
  awaiting_payment: ['待付款', 'Awaiting payment', 'Menunggu pembayaran'],
  proof_review: ['凭证待财务核实', 'Proof awaiting verification', 'Bukti menunggu verifikasi'],
  partial: ['部分到账', 'Partially paid', 'Pembayaran sebagian'],
  paid: ['报名成功', 'Enrollment confirmed', 'Pendaftaran berhasil'],
  paid_cancelled: ['已到账 · 原班不开班', 'Paid · Original class cancelled', 'Sudah dibayar · Kelas asal dibatalkan'],
  expired: ['订单已终止 · 付款超时', 'Order expired · Payment deadline passed', 'Pesanan kedaluwarsa · Tenggat pembayaran terlewati'],
  ended: ['报名已结束', 'Enrollment ended', 'Pendaftaran telah berakhir'],
  refunding: ['退款处理中','Refund in progress','Pengembalian diproses'],
  refunded: ['退款已完成','Refund complete','Pengembalian selesai'],
};
export function enrollmentCopy(language: Language, text: Copy) {
  return text[language === 'zh' ? 0 : language === 'id' ? 2 : 1];
}
export async function enrollmentPost(path: string, body: unknown) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw Error(data.error);
  return data;
}
type OrderSummary = Order & {level:string;firstLesson:string;classCancelled?:boolean;updatedAt?:string;needsPayment?:boolean;invitation?:{id:string;deadline:string}};
type AssistedApplication={id:string;name:string;quote:{level:string;format:string;firstLesson:string;schedule:string;price:number};
  createdAt:string;expiresAt:string;active:boolean};
type ApplicationClass = { title: string; schedule: string; price: number; detailsPath: string; listPath: string; fromWaitlist?: string };
type InterestRecord = { kind: 'waitlist' | 'demands'; id: string };

export function EnrollmentApplication({ classId, language, full = false, demandOnly = false, paymentClasses, applicationClass, waitlistClass, mineClasses, record }: {
  classId?: string; language: Language; full?: boolean; demandOnly?: boolean; paymentClasses?: PublicEnrollmentClass[];
  applicationClass?: ApplicationClass; waitlistClass?: PublicEnrollmentClass; mineClasses?: PublicEnrollmentClass[]; record?: InterestRecord;
}) {
  const t = (text: Copy) => enrollmentCopy(language,text);
  const [params,setParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = record ? null : params.get('order');
  const [order,setOrder] = useState<Order>();
  const [loadingPayment,setLoadingPayment] = useState(!!paymentClasses && !!orderId);
  const [aftercare,setAftercare] = useState<EnrollmentAftercare>();
  const [open,setOpen] = useState(!!orderId || !classId || params.get('apply') === '1');
  const [orders,setOrders] = useState<OrderSummary[]>();
  const [assistedApplications,setAssistedApplications] = useState<AssistedApplication[]>([]);
  const [interests,setInterests] = useState<Interests>();
  const tab = ['orders','waitlist','demands'].find(value=>value===params.get('tab')) || 'all';
  function selectTab(value: string) {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete('tab');
    else next.set('tab', value);
    setParams(next, { replace: true, preventScrollReset: true });
    setEditDemand(undefined);
  }
  const [editDemand,setEditDemand] = useState<DemandItem>();
  const [joined,setJoined] = useState(false);
  const [stillWaiting,setStillWaiting] = useState(false);
  const [savedDemand,setSavedDemand] = useState(false);
  const [hasNoSeat,setHasNoSeat] = useState(full);
  const [email,setEmail] = useState('');
  const [name,setName] = useState('');
  const [phone,setPhone] = useState('');
  const [priority,setPriority] = useState(true);
  const [challenge,setChallenge] = useState<string>();
  const [code,setCode] = useState('');
  const [verificationStep,setVerificationStep] = useState(false);
  const [verifiedEmail,setVerifiedEmail] = useState('');
  const [checkingRecords,setCheckingRecords] = useState(!!mineClasses);
  const enteredEmailField = useRef<HTMLInputElement>(null);
  const applicationHeading = useRef<HTMLHeadingElement>(null);
  const currentEmail = email.trim().toLowerCase();
  const emailConfirmed = verifiedEmail === currentEmail && !!currentEmail;
  const [verified,setVerified] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  const [file,setFile] = useState<File>();
  const cancelDialog=useRef<HTMLDialogElement>(null);
  const base = '/api/enrollment';
  async function getOrder(id:string) {
    const response = await fetch(base+'/orders/'+encodeURIComponent(id),{cache:'no-store'});
    if (!response.ok) throw Error(response.status===401?'enrollment_verification_required':'enrollment_order_not_found');
    const nextOrder: Order = await response.json();
    const options = await fetch(base+'/orders/'+encodeURIComponent(id)+'/aftercare',{cache:'no-store'}).catch(()=>null);
    setAftercare(options?.ok ? await options.json() : undefined);
    setOrder(nextOrder);
  }
  async function getOrders() {
    const response = await fetch(base+'/orders',{cache:'no-store'});
    if (response.status === 401) {
      setVerified(false);
      setOrders(undefined);
      setAssistedApplications([]);
      setInterests(undefined);
      return;
    }
    if (!response.ok) throw Error('enrollment_failed');
    const data=await response.json();
    setOrders(data.orders);
    setAssistedApplications(data.applications??[]);
    setVerified(true);
    if (!classId && !demandOnly && !paymentClasses) {
      const response=await fetch(base+'/interests',{cache:'no-store'});
      if (!response.ok) throw Error('enrollment_failed');
      setInterests(await response.json());
    }
  }
  useEffect(() => setHasNoSeat(full),[full]);
  useEffect(() => {
    if (orderId) void getOrder(orderId).catch(reason=>setError(reason.message)).finally(()=>setLoadingPayment(false));
  },[orderId]);
  useEffect(() => {
    if (open && !paymentClasses && !applicationClass && !demandOnly && !waitlistClass) {
      void getOrders().catch(reason=>setError(reason.message)).finally(()=>setCheckingRecords(false));
    }
  },[open,classId]);
  useEffect(() => {
    if (!verificationStep) return;
    window.scrollTo(0, 0);
    applicationHeading.current?.focus();
  },[verificationStep]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await action(); } catch (cause) {
      const message=(cause as Error).message || 'enrollment_failed';
      if (message==='enrollment_class_full') {
        if (applicationClass?.fromWaitlist) {
          const response = await fetch(base+'/interests',{cache:'no-store'}).catch(()=>null);
          if (response?.ok) {
            const rows: Interests | undefined = await response.json().catch(()=>undefined);
            setStillWaiting(!!rows?.waitlist.some(row=>row.id===applicationClass.fromWaitlist && row.classId===classId && row.state==='waiting'));
          }
        }
        setHasNoSeat(true);
        window.scrollTo(0,0);
      }
      if (message==='enrollment_seat_available') setHasNoSeat(false);
      if (message==='enrollment_verification_required' && (applicationClass||demandOnly||waitlistClass)) {
        setVerifiedEmail('');
        setChallenge(undefined);
        setCode('');
      }
      setError(message);
    }
    finally { setBusy(false); }
  }
  function sendCode() {
    return run(async () => { const data=await enrollmentPost(base+'/email/request',{email,language,purpose:!classId&&!demandOnly?'mine':'apply'});setChallenge(data.challengeId);setCode(''); });
  }
  function verify() {
    return run(async () => {
      await enrollmentPost(base+'/email/verify',{email,challengeId:challenge,code});
      setVerified(true);
      if (orderId) await getOrder(orderId);
      else if (!classId) await getOrders();
    });
  }
  function sourceQuery() {
    const source=new URLSearchParams(params);
    source.set('lang',language);
    return source.toString();
  }
  async function submitApplication() {
    const result=await enrollmentPost(base+'/applications',{ classId,name,phone,priority,requestId,source:sourceQuery() });
    const next=new URLSearchParams(params);
    next.set('order',result.id);
    next.delete('apply');
    navigate('/enrollment/payment?' + next.toString(), { replace:true });
  }
  const apply = () => run(submitApplication);
  async function verifyEnteredEmail() {
    if (emailConfirmed) return;
    await enrollmentPost(base+'/email/verify',{email,challengeId:challenge,code});
    setVerifiedEmail(currentEmail);
    setVerified(true);
  }
  function verifyApplication() {
    return run(async () => {
      await verifyEnteredEmail();
      await submitApplication();
    });
  }
  function editEmail(value: string) {
    setEmail(value);
    setChallenge(undefined);
    setCode('');
    setError('');
  }
  function upload(transfer:{reportedAmount?:number;bankReference?:string}) {
    if (!order || !file) return;
    return run(async () => {
      const path=base+'/orders/'+encodeURIComponent(order.id)+'/proofs';
      const started=await enrollmentPost(path+'/start',{});
      const encoded=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();
        reader.onerror=reject;
        reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
        reader.readAsDataURL(file);
      });
      await enrollmentPost(path+'/finish',{uploadId:started.uploadId,mime:file.type,encoded,...transfer});
      setFile(undefined);
      await getOrder(order.id);
      if (params.has('proof')) {
        const next = new URLSearchParams(params);
        next.delete('proof');
        setParams(next,{replace:true,preventScrollReset:true});
      }
      window.scrollTo(0,0);
    });
  }
  const join = () => run(async () => {
    if (waitlistClass) await verifyEnteredEmail();
    await enrollmentPost(base+'/waitlist',{classId,phone,name,source:sourceQuery()});
    setJoined(true);
  });
  function savePreferences(data: Parameters<React.ComponentProps<typeof EnrollmentDemandForm>['onSave']>[0]) {
    void run(async () => {
      if (demandOnly) await verifyEnteredEmail();
      await enrollmentPost(base+'/demands',{...data,source:sourceQuery()});
      if (demandOnly) setSavedDemand(true);
      else {setEditDemand(undefined);await getOrders();}
    });
  }
  function remove(group:'waitlist'|'demands',id:string) {
    void run(async () => {
      await enrollmentPost(base+'/'+group+'/'+encodeURIComponent(id)+'/withdraw',{});
      await getOrders();
    });
  }
  const publicQuery = '?lang='+language;
  const mineLink='/enrollment/mine'+publicQuery;
  const joinText=t(['加入候补','Join waitlist','Masuk daftar tunggu']);
  const applyText=t(['申请这个班','Apply for this class','Daftar kelas ini']);
  function selectOrder(id?:string) {
    const next = new URLSearchParams(params);
    next.delete('view');
    next.delete('target');
    if (id) next.set('order', id);
    else {
      next.delete('order');
      setOrder(undefined);
      setAftercare(undefined);
    }
    setError('');
    setParams(next, { replace:true, preventScrollReset:true });
  }
  const errors: Record<string, Copy> = {
    enrollment_invitation_expired:['邀请已到期。请刷新查看可转班次。','This invitation has expired. Refresh to check available classes.','Undangan kedaluwarsa. Muat ulang untuk melihat kelas.'],
    enrollment_aftercare_conflict:['报名状态已变化，请刷新后再操作。','Your enrollment has changed. Refresh before trying again.','Pendaftaran berubah. Muat ulang sebelum melanjutkan.'],
    enrollment_class_full:['最后一个席位已被占用。','The last seat has been taken.','Kursi terakhir sudah diambil.'],
    enrollment_seat_available:['现在有空位，可以申请这个班。','A seat is available. You can apply now.','Ada kursi tersedia. Anda dapat mendaftar.'],
    enrollment_demand_conflict:['这条需求已更新或撤回，请刷新后查看。','This request has changed or been withdrawn. Refresh to review.','Permintaan berubah atau ditarik. Muat ulang.'],
    enrollment_code_wait:['请稍后再申请验证码。','Wait before requesting another code.','Tunggu sebelum meminta kode baru.'],
    enrollment_cancel_not_available:['当前报名无法自行取消。请刷新核对是否已提交凭证、已到账或已超时。','This enrollment can no longer be canceled here. Refresh to check whether a proof was submitted, payment was verified, or the deadline passed.','Pendaftaran ini tidak lagi bisa dibatalkan di sini. Muat ulang untuk memeriksa bukti, pembayaran, atau tenggat.'],
    enrollment_invalid_code:['验证码无效或已过期。','The code is invalid or expired.','Kode tidak berlaku atau kedaluwarsa.'],
    enrollment_verification_required:['请验证邮箱后查看报名。','Verify your email to view the order.','Verifikasi email untuk melihat pesanan.'],
    enrollment_order_not_found:['找不到这条报名。','This enrollment could not be found.','Pendaftaran ini tidak ditemukan.'],
    enrollment_invalid_waitlist:['请检查姓名和带区号的电话号码。','Check the name and phone number with country code.','Periksa nama dan nomor telepon beserta kode negara.'],
    enrollment_already_has_seat:['这位学员已有本班席位。请前往「我的报名」查看。','This learner already has a seat. Check My enrollments.','Siswa ini sudah mendapat kursi. Lihat Pendaftaran saya.'],
    enrollment_invalid_application:['请检查学员姓名和带区号的电话号码。','Check the learner name and phone number with country code.','Periksa nama siswa dan nomor telepon beserta kode negara.'],
    enrollment_class_unavailable:['此班次已停止接受报名。','This class is no longer accepting applications.','Pendaftaran kelas ini sudah ditutup.'],
    enrollment_transfer_unavailable:['该班次目前无法转入，请返回可转班次刷新查看。','This class is no longer available for transfer. Go back and check the list again.','Kelas ini tidak lagi tersedia. Kembali dan periksa daftar kelas.'],
    enrollment_priority_unavailable:['当前报名无法开启优先安排，请刷新核对状态。','Priority arrangements are unavailable for this enrollment. Refresh to check its status.','Pengaturan prioritas tidak tersedia untuk pendaftaran ini. Muat ulang untuk memeriksa status.'],
    enrollment_invalid_proof:['凭证上传失败。请检查文件后重试。','Upload failed. Check the file and retry.','Unggahan gagal. Periksa file dan coba lagi.'],
  };
  const message=errors[error] || ['操作未完成，请核对后重试。','The action could not be completed. Please review and retry.','Tindakan belum selesai. Periksa dan coba lagi.'];
  function transfer(targetClassId:string,decision:'accept'|'decline',invitationId?:string) {
    if(!order) return;
    void run(async()=>{
      await enrollmentPost(base+'/orders/'+encodeURIComponent(order.id)+'/transfer',{classId:order.classId,targetClassId,decision,invitationId,requestId:crypto.randomUUID()});
      await getOrder(order.id);
      if (decision==='accept') {
        const next = new URLSearchParams(params);
        next.delete('view');
        next.delete('target');
        setParams(next,{replace:true,preventScrollReset:true});
      }
      window.scrollTo(0,0);
    });
  }
  function enablePriority() {
    if(!order) return;
    void run(async()=>{
      await enrollmentPost(base+'/orders/'+encodeURIComponent(order.id)+'/priority',{classId:order.classId});
      await getOrder(order.id);
    });
  }
  const paymentPath = (id: string) => {
    const next = new URLSearchParams(params);
    next.delete('apply');
    next.set('order', id);
    return '/enrollment/payment?' + next.toString();
  };
  const canUpload = order && order.status!=='paid_cancelled' && allowsEnrollmentProof(order.status,order.closureReason) && !order.restored;
  const cancelable=order?.status==='awaiting_payment'&&order.received===0;
  const openCancellation=()=>{if(cancelable){setError('');cancelDialog.current?.showModal();}};
  const cancelEnrollment=()=>order&&void run(async()=>{
    await enrollmentPost(base+'/orders/'+encodeURIComponent(order.id)+'/cancel',{});
    cancelDialog.current?.close();
    await getOrder(order.id);
  });
  const status = order && t(order.restored ? ['已恢复原班报名','Enrollment restored','Pendaftaran dipulihkan'] : enrollmentStatuses[order.status]);
  const emailLabel=t(['电子邮箱','Email address','Alamat email']);
  const sendLabel=t(challenge?['重发验证码','Resend code','Kirim ulang kode']:['发送验证码','Send code','Kirim kode']);
  const verifiedHint=t(['验证码已发出，请查收邮件。','Code sent. Check your inbox.','Kode dikirim. Periksa kotak masuk Anda.']);
  const learnerLabel=t(['学员姓名','Learner name','Nama siswa']);
  const phoneLabel=t(['WhatsApp／手机号','WhatsApp or phone','WhatsApp atau nomor HP']);
  const awaitingCode = !emailConfirmed && (!challenge || code.length!==6);
  const codeField = emailConfirmed ? <p role="status">{t(['邮箱已验证。','Email verified.','Email sudah diverifikasi.'])}</p> :
    <div className="enrollment-code-field">
      <label className="enrollment-field" htmlFor="enrollment-verification-code">{t(['邮箱验证码','Email verification code','Kode verifikasi email'])}</label>
      <div className="enrollment-code-input">
        <input id="enrollment-verification-code" type="text" autoComplete="one-time-code" inputMode="numeric" maxLength={6}
          pattern="[0-9]{6}" required value={code} onChange={event=>setCode(event.target.value.replace(/[^0-9]/g,''))}
          placeholder={t(['输入 6 位验证码','Enter 6-digit code','Masukkan kode 6 digit'])}/>
        <button type="button" className="enrollment-quiet" disabled={busy} onClick={()=>{
          if (!enteredEmailField.current || enteredEmailField.current.reportValidity()) void sendCode();
        }}>{sendLabel}</button>
      </div>
      {challenge && <p className="enrollment-code-feedback" role="status">{verifiedHint}</p>}
    </div>;
  const emailField = <label className="enrollment-field">{emailLabel}
    <input ref={enteredEmailField} type="email" required autoComplete="email" value={email} onChange={event=>editEmail(event.target.value)}
      placeholder={t(['输入你的电子邮箱','Enter your email address','Masukkan alamat email'])}/>
  </label>;
  if (applicationClass && error==='enrollment_class_full') {
    const next = new URLSearchParams(params);
    next.set('apply','1');
    next.set('join','1');
    next.delete('waitlist');
    return <div className="enrollment-last-seat">
      <Link className="enrollment-back" to={applicationClass.listPath}><ArrowLeft size={15} aria-hidden="true"/>
        {t(['返回课程报名','Back to classes','Kembali ke daftar kelas'])}</Link>
      <h1>{t(['本班已满','This class is full','Kelas ini penuh'])}</h1>
      <div className="enrollment-result-body">
        <article className="enrollment-record"><h2>{applicationClass.title}</h2><p>{applicationClass.schedule}</p></article>
        <p className="enrollment-result-state" role="alert">{t(['你提交申请时，最后一个席位已被其他学员取得。','The last seat was taken while you were applying.','Kursi terakhir diambil saat Anda mengajukan pendaftaran.'])}</p>
        {stillWaiting&&<p className="enrollment-journey-note">{t(['你的候补仍有效，无需重新加入。','Your waitlist entry is still active. You don’t need to join again.','Posisi daftar tunggu Anda masih aktif. Anda tidak perlu mendaftar ulang.'])}</p>}
      </div>
      <div className="enrollment-journey-actions">
        <Link className="enrollment-quiet" to={applicationClass.listPath}>{t(['查看其他班次','Browse other classes','Lihat kelas lain'])}</Link>
        {stillWaiting ? <Link className="enrollment-primary" to={applicationClass.detailsPath}>{t(['返回候补详情','Back to waitlist entry','Kembali ke detail daftar tunggu'])}</Link>
          : <Link className="enrollment-primary" to={'/enrollment/'+encodeURIComponent(classId ?? '')+'?'+next.toString()}>{joinText}</Link>}
      </div>
    </div>;
  }
  if (applicationClass && !hasNoSeat) return <div>
    {verificationStep
      ? <button type="button" className="enrollment-back" onClick={()=>{setVerificationStep(false);setError('');}} disabled={busy}>
        <ArrowLeft size={15} aria-hidden="true"/>{t(['返回申请表','Back to application','Kembali ke formulir'])}
      </button>
      : <Link className="enrollment-back" to={applicationClass.detailsPath}>
        <ArrowLeft size={15} aria-hidden="true"/>{t(applicationClass.fromWaitlist
          ? ['返回候补详情','Back to waitlist entry','Kembali ke detail daftar tunggu']
          : ['返回班次详情','Back to class details','Kembali ke detail kelas'])}
      </Link>}
    <h1 ref={applicationHeading} tabIndex={-1}>{verificationStep ? t(['验证邮箱','Verify your email','Verifikasi email']) : applyText}</h1>
    {error && <p className="enrollment-form-error" role="alert">{t(message)}</p>}
    {verificationStep ? <form className="enrollment-journey-form" onSubmit={event=>{event.preventDefault();void verifyApplication();}}>
      <p className="enrollment-journey-note">{t([
        '验证后，你可以用这个邮箱查看报名。开班结果、转班邀请等重要消息也会通过邮件发送。',
        'Use this email to check your enrollment. We’ll also email important updates, including class opening decisions and transfer invitations.',
        'Gunakan email ini untuk melihat pendaftaran. Kami juga mengirim kabar penting, termasuk keputusan pembukaan kelas dan undangan pindah kelas.',
      ])}</p>
      <label className="enrollment-field">{emailLabel}<input type="email" value={email} readOnly autoComplete="email"/></label>
      {codeField}
      <div className="enrollment-journey-actions">
        <p>{t(['取得席位后进入「转账与凭证」。','Once a seat is reserved, you’ll go to Transfer & proof.','Setelah mendapat kursi, Anda akan masuk ke Transfer dan bukti.'])}</p>
        <button className="enrollment-primary" type="submit" disabled={busy || awaitingCode}>
          {t(emailConfirmed?['继续提交申请','Continue application','Lanjutkan pendaftaran']:['验证并继续','Verify and continue','Verifikasi dan lanjutkan'])}
        </button>
      </div>
    </form> : <form className="enrollment-journey-form" onSubmit={event=>{event.preventDefault();setError('');setVerificationStep(true);}}>
      <div className="enrollment-payment-summary">
        <h2>{applicationClass.title}</h2>
        <p>{applicationClass.schedule}</p>
      </div>
      <p className="enrollment-tuition">{t(['本班学费','Class tuition','Biaya kelas'])} <strong>{formatCurrency(applicationClass.price,language)}</strong></p>
      <label className="enrollment-field">{learnerLabel}
        <input required maxLength={120} autoComplete="name" value={name} onChange={event=>setName(event.target.value)}
          placeholder={t(['输入学员姓名','Enter learner name','Masukkan nama siswa'])}/>
      </label>
      <label className="enrollment-field">{emailLabel}
        <input type="email" required autoComplete="email" value={email} onChange={event=>editEmail(event.target.value)}
          placeholder={t(['输入你的电子邮箱','Enter your email address','Masukkan alamat email'])}/>
      </label>
      <label className="enrollment-field">{phoneLabel}
        <input type="tel" required autoComplete="tel" value={phone} onChange={event=>setPhone(event.target.value)}
          placeholder={t(['含国家或地区代码','Include country or region code','Sertakan kode negara atau wilayah'])}/>
      </label>
      <label className="enrollment-priority">
        <input type="checkbox" checked={priority} onChange={event=>setPriority(event.target.checked)}/>
        <span><strong>{t(['优先安排 · 可取消','Priority arrangements · Optional','Pengaturan prioritas · Opsional'])}</strong>
          <span>{t([
            '原班不开课且你已付清学费时，我们会优先寻找最近开课的同级别、同班型班次。有合适席位时先为你保留，再请你确认。',
            'If your original class will not open and you have paid in full, we’ll look for the next class at the same level and in the same format. We’ll hold an available seat and ask you to confirm.',
            'Jika kelas awal tidak dibuka dan biaya sudah lunas, kami akan mencari kelas berikutnya dengan level dan jenis yang sama. Jika ada kursi, kami akan menahannya sambil menunggu konfirmasi Anda.',
          ])}</span>
        </span>
      </label>
      <div className="enrollment-journey-actions">
        <p>{t(['财务核实足额到账后，报名才算成功。','Enrollment is confirmed after Finance verifies full payment.','Pendaftaran berhasil setelah pembayaran penuh diverifikasi.'])}</p>
        <button className="enrollment-primary" type="submit">{t(['验证邮箱并继续','Verify email and continue','Verifikasi email dan lanjutkan'])}</button>
      </div>
    </form>}
  </div>;
  const locale = t(['zh-CN','en-GB','id-ID']);
  const dayFormat = new Intl.DateTimeFormat(locale,{month:'long',day:'numeric',timeZone:'Asia/Jakarta'});
  function displayDate(value: string) {
    const date = new Date(value.slice(0,10) + 'T00:00:00+07:00');
    return Number.isFinite(date.valueOf()) ? dayFormat.format(date) : '';
  }
  function classTitle(level: string, firstLesson: string, id: string) {
    const course = waitlistClass?.id===id ? waitlistClass : mineClasses?.find(row=>row.id===id);
    if(course)return enrollmentClassTitle(course,language);
    return [level,displayDate(firstLesson)].filter(Boolean).join(' · ');
  }
  if (waitlistClass || demandOnly) {
    const completed = joined || savedDemand;
    const waitlist = !!waitlistClass;
    return <>
      {error && <p className="enrollment-form-error" role="alert">{t(message)}</p>}
      {completed ? <div className="enrollment-intake-complete">
        <p className="enrollment-result-state" data-paid="true" role="status">{t(waitlist
          ? ['候补已登记。','You joined the waitlist.','Anda masuk daftar tunggu.']
          : ['选课需求已保存。','Course preferences saved.','Preferensi kursus disimpan.'])}</p>
        <Link className="enrollment-primary" to={mineLink+'&tab='+(waitlist?'waitlist':'demands')}>{t(waitlist
          ? ['查看我的候补','View my waitlist','Lihat daftar tunggu saya']
          : ['查看我的需求','See my preferences','Lihat preferensi saya'])}</Link>
      </div> : waitlistClass ? <form className="enrollment-journey-form" onSubmit={event=>{event.preventDefault();void join();}}>
        <article className="enrollment-record">
          <h2>{classTitle(waitlistClass.level,waitlistClass.firstLesson,waitlistClass.id)}</h2>
          <p><span className="enrollment-status" data-state="full">{t(waitlistClass.opened
            ? ['已确认开班 · 满班','Class confirmed · Full','Kelas dikonfirmasi · Penuh']
            : ['满班','Full','Penuh'])}</span></p>
        </article>
        <label className="enrollment-field">{learnerLabel}
          <input autoComplete="name" required maxLength={120} value={name} onChange={event=>setName(event.target.value)}
            placeholder={t(['输入学员姓名','Enter learner name','Masukkan nama siswa'])}/>
        </label>
        {emailField}
        <label className="enrollment-field">{phoneLabel}
          <input autoComplete="tel" type="tel" required value={phone} onChange={event=>setPhone(event.target.value)}
            placeholder={t(['含国家或地区代码','Include country or region code','Sertakan kode negara atau wilayah'])}/>
        </label>
        {codeField}
        <div className="enrollment-journey-actions">
          {hasNoSeat ? <>
            <p>{t(['候补无需付款。有空位时会通知你自行申请。','There is no payment to join the waitlist. We’ll let you know when a seat opens so you can apply.','Daftar tunggu tidak memerlukan pembayaran. Kami akan memberi kabar saat ada kursi agar Anda bisa mendaftar.'])}</p>
            <button type="submit" className="enrollment-primary" disabled={busy||awaitingCode}>
              {t(['验证并加入候补','Verify and join waitlist','Verifikasi dan masuk daftar tunggu'])}
            </button>
          </> : <Link className="enrollment-primary" to={'/enrollment?'+sourceQuery()}>
            {t(['返回课程报名','Back to classes','Kembali ke daftar kelas'])}
          </Link>}
        </div>
      </form> : <EnrollmentDemandForm language={language} busy={busy} onSave={savePreferences}
        verification={{email:emailField,code:codeField}} awaitingCode={awaitingCode}/>}
    </>;
  }
  function paymentDeadline(value: string) {
    const date = new Date(value);
    if (!Number.isFinite(date.valueOf())) return '';
    const time = new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Jakarta'}).format(date);
    return t([dayFormat.format(date)+' '+time+' WIB 截止','Due '+dayFormat.format(date)+' at '+time+' WIB','Batas '+dayFormat.format(date)+' pukul '+time+' WIB']);
  }
  const orderIsActive = (row: OrderSummary) => row.restored || !['expired','ended','refunded'].includes(row.status);
  function transferInvitationPath(id:string,invitationId:string) {
    const query=new URLSearchParams(params);
    query.delete('proof');
    query.set('order',id);
    query.set('view','invitation');
    query.set('target',invitationId);
    return '/enrollment/mine?'+query.toString();
  }
  const orderCards = (orders ?? []).filter(()=>tab==='all'||tab==='orders').map(row => {
    const course = mineClasses?.find(item=>item.id===row.classId);
    const status = row.restored ? t(['已恢复原班报名','Enrollment restored','Pendaftaran dipulihkan']) : t(row.closureReason==='learner_cancelled'?['已取消报名','Enrollment canceled','Pendaftaran dibatalkan']:enrollmentStatuses[row.status]);
    const active = orderIsActive(row);
    const payable = row.status==='awaiting_payment'&&!row.classCancelled;
    const action = t(payable ? ['查看转账与凭证','View transfer & proof','Lihat transfer dan bukti']
      : row.status==='expired'&&!row.restored ? ['查看原订单','View original order','Lihat pesanan asal']
      : ['查看报名','View enrollment','Lihat pendaftaran']);
    return {key:'order-'+row.id,active,updatedAt:row.updatedAt,needsAction:active&&!!(row.needsPayment||row.invitation),card:<article className="enrollment-record">
      <header><small>{t(['报名申请','Application','Pendaftaran'])}</small>
        <span className="enrollment-status" data-state={!active?'full':row.status==='paid'||row.restored?'confirmed':'pending'}>{status}</span></header>
      <h2>{classTitle(row.level,row.firstLesson,row.classId)}</h2>
      {row.invitation&&<p>{t(['待答复转班邀请','Transfer invitation awaiting reply','Undangan pindah kelas menunggu jawaban'])} · {paymentDeadline(row.invitation.deadline)}</p>}
      {payable && <p>{paymentDeadline(row.deadline)}</p>}
      {row.classCancelled&&row.status==='awaiting_payment'&&<p>{t(['原班已停止收款','Payment for the original class is closed','Pembayaran untuk kelas asal ditutup'])}</p>}
      {row.status==='expired'&&!row.restored && <p>{t(['付款凭证未按时提交','Proof was not submitted by the deadline','Bukti tidak dikirim sebelum batas waktu'])}</p>}
      {row.status==='paid' && course?.schedule && <p>{[course.opened&&t(['已确认开班','Class confirmed','Kelas dikonfirmasi']),course.schedule].filter(Boolean).join(' · ')}</p>}
      {row.learnerName&&<p>{row.learnerName}</p>}
      {row.invitation ? <Link className="enrollment-record-link" to={transferInvitationPath(row.id,row.invitation.id)}>
        {t(['查看转班邀请','View transfer invitation','Lihat undangan pindah kelas'])}<ChevronRight size={15} aria-hidden="true"/></Link>
        : payable ? <Link className="enrollment-record-link" to={paymentPath(row.id)}>{action}<ChevronRight size={15} aria-hidden="true"/></Link>
        : <button type="button" className="enrollment-record-link" onClick={()=>selectOrder(row.id)}>{action}<ChevronRight size={15} aria-hidden="true"/></button>}
    </article>};
  });
  const mineParams = new URLSearchParams(params);
  mineParams.delete('order');
  mineParams.delete('proof');
  mineParams.delete('apply');
  mineParams.delete('view');
  mineParams.delete('target');
  const listPath = '/enrollment/mine?' + mineParams.toString();
  function recordPath(kind: InterestRecord['kind'], id: string) {
    return '/enrollment/mine/' + kind + '/' + encodeURIComponent(id) + '?' + mineParams.toString();
  }
  const catalogParams = new URLSearchParams(mineParams);
  catalogParams.delete('tab');
  catalogParams.delete('apply');
  const catalogPath = '/enrollment?' + catalogParams.toString();
  function classFromRecord(classId: string, key: 'waitlist' | 'fromDemand', recordId: string) {
    const query = new URLSearchParams(catalogParams);
    query.set(key,recordId);
    if (key==='waitlist') query.set('apply','1');
    return '/enrollment/'+encodeURIComponent(classId)+'?'+query.toString();
  }
  const waitlistDetail = record?.kind === 'waitlist' ? interests?.waitlist.find(row=>row.id===record.id) : undefined;
  const demandDetail = record?.kind === 'demands' ? interests?.demands.find(row=>row.id===record.id) : undefined;
  const demandTitle = (row: DemandItem) => [row.criteria.level,row.criteria.period,row.criteria.format]
    .map(value=>interestOption(language,value)).join(' · ');
  const demandStatus = (row: DemandItem) => row.state==='withdrawn' ? t(['需求已撤回','Request withdrawn','Permintaan ditarik'])
    : row.matches.length ? t(['有符合你需求的班次','Matching classes available','Ada kelas yang cocok'])
    : t(['已登记 · 等待匹配','Saved · Waiting for a match','Tersimpan · Menunggu kecocokan']);
  function renderWaitlistDetail(row: NonNullable<typeof waitlistDetail>) {
    const course = mineClasses?.find(item=>item.id===row.classId);
    const waiting = row.state==='waiting';
    const available = waiting && row.available;
    const related = new URLSearchParams(mineParams);
    if (row.orderId) related.set('order',row.orderId);
    return <div className="enrollment-interest-detail">
      <article className="enrollment-record">
        <h2>{classTitle(row.level,row.firstLesson,row.classId)}</h2>
        <p><span className="enrollment-status" data-state={available?'confirmed':waiting?'pending':'full'}>
          {t(waitlistStates[row.state])}{waiting&&!available && ' · '+t(['暂无空位','No seats available','Belum ada kursi'])}
        </span></p>
        {course?.schedule && <p>{course.schedule}</p>}
        {row.learnerName&&<p>{row.learnerName}</p>}
      </article>
      {waiting && <p className="enrollment-journey-note">{t(available
        ? ['本班有空位，可申请。席位以提交时为准。','A seat is available. Availability is checked when you apply.','Ada kursi. Ketersediaan diperiksa saat Anda mendaftar.']
        : ['有空位时会通知你。也可以从公开班次详情查看最新情况。','We’ll notify you if a seat opens. You can also check the class page for updates.','Kami akan memberi kabar jika ada kursi. Anda juga dapat memeriksa halaman kelas.'])}</p>}
      {row.state==='withdrawn' && <p role="status" className="enrollment-journey-note">{t(['你已取消候补，之后不会收到本次候补的空位通知。','You cancelled this waitlist entry. You won’t receive availability updates for it.','Anda membatalkan daftar tunggu ini dan tidak akan menerima kabar ketersediaan untuknya.'])}</p>}
      <div className="enrollment-interest-actions">
        {waiting && <button type="button" className="enrollment-quiet" disabled={busy} onClick={()=>remove('waitlist',row.id)}>{t(['取消候补','Cancel waitlist entry','Batalkan daftar tunggu'])}</button>}
        {available ? <Link className="enrollment-primary" to={classFromRecord(row.classId,'waitlist',row.id)}>{applyText}</Link>
          : row.state==='converted'&&row.orderId ? <Link className="enrollment-primary" to={'/enrollment/mine?'+related.toString()}>{t(['查看对应报名','View related application','Lihat pendaftaran terkait'])}</Link>
          : <Link className="enrollment-primary" to={catalogPath}>{t(['查看其他班次','Browse other classes','Lihat kelas lain'])}</Link>}
      </div>
    </div>;
  }
  function renderDemandDetail(row: DemandItem) {
    const active = row.state==='active';
    return <div className="enrollment-interest-detail">
      <p className="enrollment-journey-note" role="status">{demandStatus(row)}</p>
      {row.state!=='withdrawn' ? <>
        <article className="enrollment-record">
          <small>{t(['想上的课','Your preferences','Preferensi Anda'])}</small>
          <h2>{demandTitle(row)}</h2>
          {row.criteria.notes&&<p>{row.criteria.notes}</p>}
        </article>
        {row.matches.map(match=><article className="enrollment-record" key={match.id}>
          <small>{t(['匹配班次','Matching class','Kelas yang cocok'])}</small>
          <h2>{classTitle(match.level,match.firstLesson,match.id)}</h2>
          {mineClasses?.find(item=>item.id===match.id)?.schedule && <p>{mineClasses.find(item=>item.id===match.id)?.schedule}</p>}
          {row.matches.length>1&&<Link className="enrollment-record-link" to={classFromRecord(match.id,'fromDemand',row.id)}>
            {t(['查看匹配班次','View matching class','Lihat kelas yang cocok'])}<ChevronRight size={15} aria-hidden="true"/>
          </Link>}
        </article>)}
        {!!row.matches.length&&<p className="enrollment-journey-note">{t(['申请时以实际空位为准。','Availability is checked when you apply.','Ketersediaan diperiksa saat Anda mendaftar.'])}</p>}
        {active&&<div className="enrollment-interest-actions">
          <button type="button" className={row.matches.length===1?'enrollment-quiet':'enrollment-primary enrollment-demand-edit'} disabled={busy||editDemand?.id===row.id} onClick={()=>setEditDemand(row)}>{t(['修改需求','Edit preferences','Ubah preferensi'])}</button>
          <button type="button" className="enrollment-quiet" disabled={busy} onClick={()=>remove('demands',row.id)}>{t(['撤回需求','Withdraw request','Tarik permintaan'])}</button>
          {row.matches.length===1&&<Link className="enrollment-primary" to={classFromRecord(row.matches[0].id,'fromDemand',row.id)}>
            {t(['查看匹配班次','View matching class','Lihat kelas yang cocok'])}</Link>}
        </div>}
        {editDemand?.id===row.id&&<div className="enrollment-record">
          <EnrollmentDemandForm key={row.id+':'+row.revision} language={language} initial={row} busy={busy} onSave={savePreferences}/>
          <button type="button" className="enrollment-record-link" disabled={busy} onClick={()=>setEditDemand(undefined)}>{t(['取消修改','Cancel editing','Batalkan perubahan'])}</button>
        </div>}
      </> : <>
        <p>{t(['这条需求停止匹配，之后不会收到它的新班通知。','This request is no longer matched and won’t send updates about new classes.','Permintaan ini tidak lagi dicocokkan dan tidak akan mengirim kabar kelas baru.'])}</p>
        <div className="enrollment-interest-actions"><Link className="enrollment-primary" to={listPath}>{t(['返回我的报名','Back to my enrollments','Kembali ke pendaftaran saya'])}</Link></div>
      </>}
    </div>;
  }
  const waitlistCards = (interests?.waitlist ?? []).filter(()=>tab==='all'||tab==='waitlist').map(row => ({
    key:'waitlist-'+row.id, active:row.state==='waiting',updatedAt:row.updatedAt,needsAction:row.state==='waiting'&&row.available, card:<article className="enrollment-record">
      <header><small>{t(['候补','Waitlist','Daftar tunggu'])}</small>
        <span className="enrollment-status" data-state={row.state==='waiting'?'pending':'full'}>{t(waitlistStates[row.state])}</span></header>
      <h2>{classTitle(row.level,row.firstLesson,row.classId)}</h2>
      {row.state==='waiting' && <p>{row.available?t(['有空位可申请','Seats available','Kursi tersedia']):t(['暂无空位','No seats available','Belum ada kursi'])}</p>}
      {row.learnerName&&<p>{row.learnerName}</p>}
      <Link className="enrollment-record-link" to={recordPath('waitlist',row.id)}>
        {t(['查看候补','View waitlist entry','Lihat daftar tunggu'])}<ChevronRight size={15} aria-hidden="true"/>
      </Link>
    </article>,
  }));
  const demandCards = (interests?.demands ?? []).filter(()=>tab==='all'||tab==='demands').map(row => ({
    key:'demand-'+row.id, active:row.state==='active',updatedAt:row.updatedAt,needsAction:row.state==='active'&&!!row.matches.length, card:<article className="enrollment-record">
      <header><small>{t(['选课需求','Course preferences','Preferensi kursus'])}</small>
        <span className="enrollment-status" data-state={row.state==='withdrawn'?'full':row.matches.length?'confirmed':'pending'}>{row.state==='withdrawn'
          ? t(['已撤回','Withdrawn','Ditarik']) : row.matches.length
            ? t(['有匹配班次','Matching classes available','Ada kelas yang cocok']) : t(['等待匹配','Waiting for a match','Menunggu kecocokan'])}</span></header>
      <h2>{[row.criteria.level,row.criteria.period,row.criteria.format].map(value=>interestOption(language,value)).join(' · ')}</h2>
      <Link className="enrollment-record-link" to={recordPath('demands',row.id)}>
        {t(['查看需求','View preferences','Lihat preferensi'])}<ChevronRight size={15} aria-hidden="true"/>
      </Link>
    </article>,
  }));
  const assistedCards=(tab==='all'||tab==='orders'?assistedApplications:[]).map(row=>({
    key:'assistance-'+row.id,active:row.active,updatedAt:row.createdAt,needsAction:row.active,
    card:<article className="enrollment-record">
      <header><small>{t(['销售协助报名','Advisor-assisted application','Pendaftaran dibantu tim UPER'])}</small>
        <span className="enrollment-status" data-state={row.active?'pending':'full'}>{row.active
          ?t(['待学员确认','Awaiting your confirmation','Menunggu konfirmasi kamu'])
          :t(['确认链接已失效','Confirmation link expired','Tautan konfirmasi kedaluwarsa'])}</span></header>
      <h2>{[row.quote.level,interestOption(language,row.quote.format),row.quote.firstLesson.replace('T',' ')+' WIB'].join(' · ')}</h2>
      <p>{row.name} · {formatCurrency(row.quote.price,language)}</p>
      {row.active&&<>
        <p>{t(['确认截止','Confirm by','Konfirmasi sebelum'])} · <time dateTime={row.expiresAt}>{new Intl.DateTimeFormat(language,
          {dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(row.expiresAt))} WIB</time></p>
        <Link className="enrollment-record-link" to={enrollmentAssistancePath(row.id,language)}>
          {t(['确认报名','Confirm enrollment','Konfirmasi pendaftaran'])}<ChevronRight size={15} aria-hidden="true"/>
        </Link>
      </>}
    </article>,
  }));
  const records = sortEnrollmentRecords([...orderCards,...assistedCards,...waitlistCards,...demandCards]);
  const activeRecords = records.filter(record=>record.active);
  const pastRecords = records.filter(record=>!record.active);
  const editingProof = paymentClasses && params.get('proof')==='upload' && !!canUpload;
  const existingTransferOnly = !!(editingProof && order && !order.bank &&
    (order.status==='expired' || order.closureReason==='learner_cancelled' || aftercare?.originalClassState==='cancelled'));
  const originalOrderParams = new URLSearchParams(mineParams);
  if (order) originalOrderParams.set('order',order.id);
  const refundMode = aftercare?.refund.mode;
  const canConsultRefund = refundMode==='contact_support' || refundMode==='special_review';
  const aftercareView = params.get('view');
  const transferred = order && order.status==='paid' && aftercare?.transferHistory.some(row=>row.target_class_id===order.classId);
  const showAftercare = order && !editingProof && (
    ['paid_cancelled','ended','refunding','refunded'].includes(order.status) || (order.status==='expired' && !order.restored)
    || ((aftercareView==='refund'||aftercareView==='refund-contact') && canConsultRefund)
    || aftercare?.originalClassState==='cancelled' || transferred
  );
  const showOrderResult = order && (order.status==='paid' || (['proof_review','partial'].includes(order.status) && !editingProof));
  const orderResultClasses = paymentClasses ?? mineClasses ?? [];
  const resultCourse = order && orderResultClasses.find(row=>row.id===order.classId);
  const refundParams = new URLSearchParams(mineParams);
  if (order) refundParams.set('order',order.id);
  refundParams.set('view','refund');
  const proofParams = new URLSearchParams(mineParams);
  if (order) proofParams.set('order',order.id);
  proofParams.set('proof','upload');
  if (!open) return <button className="enrollment-action" type="button" onClick={()=>setOpen(true)}>{hasNoSeat?joinText:applyText}</button>;
  return <section className={showAftercare || showOrderResult ? "enrollment-application enrollment-order-result-shell" : mineClasses && !order ? "enrollment-application enrollment-mine-content" : order && paymentClasses ? "enrollment-application enrollment-payment-content" : "enrollment-card enrollment-application"}>
    {error && !(paymentClasses && order && ['enrollment_invalid_proof','enrollment_upload_expired'].includes(error)) && <p role="alert">{t(message)}</p>}
    <dialog className="enrollment-cancel-dialog" ref={cancelDialog} aria-labelledby="enrollment-cancel-title" onCancel={event=>{if(busy)event.preventDefault();}}>
      <h2 id="enrollment-cancel-title">{t(['取消这笔报名？','Cancel this enrollment?','Batalkan pendaftaran ini?'])}</h2>
      <p>{t(['取消后，付款入口会关闭，席位会释放。如果你已经转账，请先提交凭证。','Canceling closes the payment link and releases your seat. If you already transferred the money, submit the proof first.','Pembatalan menutup pembayaran dan melepas kursi. Jika sudah transfer, kirim bukti terlebih dahulu.'])}</p>
      {error&&<p role="alert">{t(message)}</p>}
      <div className="enrollment-cancel-actions">
        <button type="button" className="enrollment-quiet" autoFocus disabled={busy} onClick={()=>cancelDialog.current?.close()}>{t(['保留报名','Keep enrollment','Pertahankan pendaftaran'])}</button>
        <button type="button" className="enrollment-primary" disabled={busy} onClick={cancelEnrollment}>{t(['确认取消','Confirm cancellation','Konfirmasi pembatalan'])}</button>
      </div>
    </dialog>
    {checkingRecords || loadingPayment ? <p role="status">{t(['正在读取报名…','Loading enrollment…','Memuat pendaftaran…'])}</p> : order ? <>
      {showAftercare ? <EnrollmentOrderAftercare order={order} details={aftercare} catalog={orderResultClasses} search={params}
        language={language} minePath={listPath} busy={busy} proofPath={canUpload ? '/enrollment/payment?'+proofParams.toString() : undefined}
        onCancel={cancelable?openCancellation:undefined} onTransfer={transfer} onEnablePriority={enablePriority} onRefresh={()=>void run(()=>getOrder(order.id))}/> : showOrderResult ? <EnrollmentOrderResult order={order} course={resultCourse} classInfo={aftercare?.currentClass}
        classState={aftercare?.originalClassState} language={language} backPath={listPath} busy={busy}
        refundPath={canConsultRefund ? '/enrollment/mine?'+refundParams.toString() : undefined}
        balancePath={order.status==='partial' ? '/enrollment/payment?'+proofParams.toString() : undefined}
        uploadPath={canUpload ? '/enrollment/payment?'+proofParams.toString() : undefined}
        onRefresh={()=>void run(()=>getOrder(order.id))}/> : paymentClasses ? <div className={existingTransferOnly ? 'enrollment-order-result enrollment-order-result-shell' : 'contents'}>
        {existingTransferOnly && <>
          <div>
            <Link className="enrollment-back" to={'/enrollment/mine?'+originalOrderParams.toString()}><ArrowLeft size={15} aria-hidden="true"/>
              {t(['返回原订单详情','Back to original order','Kembali ke detail pesanan asal'])}
            </Link>
            <h1>{t(['提交已转账凭证','Submit proof of an existing transfer','Kirim bukti transfer yang sudah dilakukan'])}</h1>
          </div>
        </>}
        <EnrollmentPayment order={order} course={resultCourse} classInfo={aftercare?.currentClass} language={language}
          status={status ?? ''} onCancel={cancelable?openCancellation:undefined} canUpload={!!canUpload} file={file} busy={busy} setFile={setFile}
          upload={transfer=>void upload(transfer)} existingTransferOnly={existingTransferOnly}
          proofUploadFailed={['enrollment_invalid_proof','enrollment_upload_expired'].includes(error)}/>
      </div> : <>
      {!classId && <button type="button" onClick={()=>{selectOrder(); void run(getOrders);}}>
        {t(['返回报名列表','Back to enrollments','Kembali ke daftar pendaftaran'])}
      </button>}
      <h2>{status}</h2>
      {order.learnerName&&<p>{t(['学员姓名','Learner name','Nama siswa'])} · {order.learnerName}</p>}
      <p>{t(['报名编号','Order number','Nomor pendaftaran'])} {order.id}</p>
      <p>{t(['应付','Amount due','Tagihan'])} {formatCurrency(order.price,language)} · {t(['实际到账','Verified receipts','Dana terverifikasi'])} {formatCurrency(order.received,language)}</p>
      {order.status==='awaiting_payment' && <p>{t(['付款截止','Payment deadline','Batas pembayaran'])} {new Intl.DateTimeFormat(language==='zh'?'zh-CN':language,{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(order.deadline))} WIB</p>}
      {cancelable&&<button type="button" className="enrollment-quiet" onClick={openCancellation}>{t(['取消报名','Cancel enrollment','Batalkan pendaftaran'])}</button>}
      {canUpload && <Link className="enrollment-action" to={paymentPath(order.id)}>
        {t(['转账与凭证','Transfer & proof','Transfer dan bukti'])}
      </Link>}
      </>}
      {!showAftercare && !showOrderResult && canConsultRefund && <Link className="enrollment-quiet" to={'/enrollment/mine?'+refundParams.toString()}>
        {t(['退款咨询','Refund assistance','Bantuan pengembalian dana'])}
      </Link>}
      {!showAftercare && !showOrderResult && (!paymentClasses || !order.bank) && <button type="button" onClick={()=>void run(()=>getOrder(order.id))}>{t(['刷新状态','Refresh status','Muat ulang status'])}</button>}
    </> : !verified && mineClasses ? <form className="enrollment-journey-form enrollment-lookup"
      onSubmit={event=>{event.preventDefault();if (!awaitingCode) void verify();}}>
      <p className="enrollment-journey-note">{t([
        '输入报名、候补或登记选课需求时使用的邮箱，获取验证码。',
        'Enter the email you used to enroll, join a waitlist, or save course preferences.',
        'Masukkan email yang digunakan untuk mendaftar, masuk daftar tunggu, atau menyimpan preferensi kursus.',
      ])}</p>
      {emailField}{codeField}
      <div className="enrollment-journey-actions">
        <Link className="enrollment-quiet" to={enrollmentSupportPath('account',language)}>{t(['无法使用原邮箱？联系销售或客服','Can’t use your original email? Contact support','Tidak bisa memakai email awal? Hubungi layanan pelanggan'])}</Link>
        <button type="submit" className="enrollment-primary" disabled={busy||awaitingCode}>
          {t(['验证并查看','Verify and view','Verifikasi dan lihat'])}</button>
      </div>
    </form> : !verified ? <form onSubmit={event=>{event.preventDefault();void (challenge?verify():sendCode());}}>
      <h2>{t(['验证邮箱','Verify your email','Verifikasi email'])}</h2>
      <label>{t(['电子邮箱','Email','Email'])}<input type="email" autoComplete="email" required value={email} readOnly={!!challenge} onChange={event=>setEmail(event.target.value)}/></label>
      {challenge && <label>{t(['六位验证码','Six-digit code','Kode enam digit'])}<input autoComplete="one-time-code" required pattern="[0-9]{6}" inputMode="numeric" value={code} onChange={event=>setCode(event.target.value)}/></label>}
      <button className="enrollment-action" type="submit" disabled={busy}>{t(challenge?['验证','Verify','Verifikasi']:['发送验证码','Send code','Kirim kode'])}</button>
      {challenge && <button type="button" disabled={busy} onClick={()=>void sendCode()}>{t(['重发验证码','Resend code','Kirim ulang'])}</button>}
    </form> : paymentClasses ? null
    : record ? waitlistDetail ? renderWaitlistDetail(waitlistDetail)
      : demandDetail ? renderDemandDetail(demandDetail)
      : interests ? <p>{t(['这条记录无法查看。','This record is not available.','Catatan ini tidak tersedia.'])}</p>
      : <button type="button" className="enrollment-quiet" disabled={busy} onClick={()=>void run(getOrders)}>{t(['重试','Try again','Coba lagi'])}</button>
    : !classId ? <div className="enrollment-records">
      <div className="enrollment-record-tabs" role="group" aria-label={t(['记录类别','Activity type','Jenis aktivitas'])}>
        {([
          ['all', ['全部','All','Semua'], undefined],
          ['orders',['申请','Applications','Pendaftaran'],orders&&orders.filter(orderIsActive).length+assistedApplications.filter(row=>row.active).length],
          ['waitlist',['候补','Waitlist','Daftar tunggu'],interests?.waitlist.filter(row=>row.state==='waiting').length],
          ['demands',['选课需求','Course preferences','Preferensi kursus'],interests?.demands.filter(row=>row.state==='active').length],
        ] as const).map(([key,label,count])=><button type="button" key={key} aria-pressed={tab===key} onClick={()=>selectTab(key)}>
          {t(label)}{count!==undefined&&<span className="enrollment-tab-count">{count}</span>}
        </button>)}
      </div>
      <div className="enrollment-record-toolbar">
        <p>{t(['分类数字为当前有效记录数','Counts show active records','Jumlah menunjukkan catatan aktif'])}</p>
        <button type="button" className="enrollment-record-link" onClick={()=>void run(getOrders)} disabled={busy}>
          <RefreshCw size={14} aria-hidden="true"/>{t(['刷新记录','Refresh','Muat ulang'])}
        </button>
      </div>
      {(!orders||!interests) && !error && <p role="status">{t(['正在读取报名…','Loading enrollments…','Memuat pendaftaran…'])}</p>}
      {activeRecords.map(record=><div key={record.key}>{record.card}</div>)}
      {!!pastRecords.length && <section className="enrollment-records">
        <h2 className="enrollment-history-title">{t(['历史记录','History','Riwayat'])}</h2>
        {pastRecords.map(record=><div key={record.key}>{record.card}</div>)}
      </section>}
      {!!orders&&!!interests&&!records.length &&
        <p className="enrollment-record">{t(['该类别暂无记录。','No records in this category.','Belum ada catatan dalam kategori ini.'])}</p>}
    </div> : joined ? <><p role="status">{t(['候补已登记。','You joined the waitlist.','Anda masuk daftar tunggu.'])}</p>
      <Link to={mineLink+'&tab=waitlist'}>{t(['查看我的候补','View my waitlist','Lihat daftar tunggu saya'])}</Link></>
    : hasNoSeat ? <form onSubmit={event=>{event.preventDefault();void join();}}>
      <h2>{joinText}</h2>
      <label>{t(['学员姓名','Learner name','Nama siswa'])}<input required maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label>
      <label>{t(['WhatsApp／手机号','WhatsApp or phone','WhatsApp atau nomor HP'])}<input type="tel" required value={phone} onChange={event=>setPhone(event.target.value)}/></label>
      <p>{t(['有空位时可以自行申请。','Apply when a seat becomes available.','Daftar saat kursi tersedia.'])}</p>
      <button className="enrollment-action" type="submit" disabled={busy}>{t(['确认加入候补','Confirm waitlist entry','Konfirmasi daftar tunggu'])}</button>
    </form> : <form onSubmit={event=>{event.preventDefault();void apply();}}>
      <h2>{applyText}</h2>
      <label>{t(['学员姓名','Learner name','Nama siswa'])}<input required maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label>
      <label>{t(['WhatsApp／手机号','WhatsApp or phone','WhatsApp atau nomor HP'])}<input type="tel" required value={phone} onChange={event=>setPhone(event.target.value)}/></label>
      <label><input type="checkbox" checked={priority} onChange={event=>setPriority(event.target.checked)}/> {t(['优先安排顺延或转班方案','Prioritize rescheduling or transfer options','Utamakan opsi penjadwalan ulang atau pindah kelas'])}</label>
      <p>{t(['财务核实足额到账后，报名才算成功。','Enrollment is confirmed after Finance verifies full payment.','Pendaftaran berhasil setelah pembayaran penuh diverifikasi.'])}</p>
      <button className="enrollment-action" type="submit" disabled={busy}>{t(['提交申请','Submit application','Kirim pendaftaran'])}</button>
    </form>}
  </section>;
}
