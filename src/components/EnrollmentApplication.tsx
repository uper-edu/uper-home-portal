import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { formatCurrency } from '../utils/currency';
import type { PublicEnrollmentClass } from '../utils/enrollmentCatalog';
import { EnrollmentPayment, type EnrollmentOrder as Order } from './EnrollmentPayment';
import { EnrollmentDemandForm, interestOption, waitlistStates, type DemandItem, type Interests } from './EnrollmentInterests';

type Language = 'zh' | 'en' | 'id';
type Copy = readonly [string, string, string];
export const enrollmentStatuses: Record<string, Copy> = {
  awaiting_payment: ['待付款', 'Awaiting payment', 'Menunggu pembayaran'],
  proof_review: ['凭证待财务核实', 'Proof awaiting verification', 'Bukti menunggu verifikasi'],
  partial: ['部分到账', 'Partially paid', 'Pembayaran sebagian'],
  paid: ['报名成功', 'Enrollment confirmed', 'Pendaftaran berhasil'],
  paid_cancelled: ['已到账 · 原班不开班', 'Paid · Original class cancelled', 'Sudah dibayar · Kelas asal dibatalkan'],
  expired: ['订单已终止', 'Order expired', 'Pesanan kedaluwarsa'],
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
type Aftercare = {
  originalClassState:string; transfers:{id:string;firstLesson:string;schedule:string}[];
  currentClass:{firstLesson:string;schedule:string};
  invitations:{id:string;targetClassId:string;state:string;expiresAt:string;firstLesson:string;schedule:string}[];
  transferHistory:{source_class_id:string;target_class_id:string;created_at:string}[];
  refundProgress?:{expected:number;refunded:number};
  refund:{mode:string};
};
type OrderSummary = Order & { level: string; firstLesson: string };
type ApplicationClass = { title: string; schedule: string; price: number; detailsPath: string };
type InterestRecord = { kind: 'waitlist' | 'demands'; id: string };

export function EnrollmentApplication({ classId, language, full = false, demandOnly = false, paymentClasses, applicationClass, mineClasses, record }: {
  classId?: string; language: Language; full?: boolean; demandOnly?: boolean; paymentClasses?: PublicEnrollmentClass[];
  applicationClass?: ApplicationClass; mineClasses?: PublicEnrollmentClass[]; record?: InterestRecord;
}) {
  const t = (text: Copy) => enrollmentCopy(language,text);
  const [params,setParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = record ? null : params.get('order');
  const [order,setOrder] = useState<Order>();
  const [loadingPayment,setLoadingPayment] = useState(!!paymentClasses && !!orderId);
  const [aftercare,setAftercare] = useState<Aftercare>();
  const [open,setOpen] = useState(!!orderId || !classId || params.get('apply') === '1');
  const [orders,setOrders] = useState<OrderSummary[]>();
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
  const applicationHeading = useRef<HTMLHeadingElement>(null);
  const currentEmail = email.trim().toLowerCase();
  const emailConfirmed = verifiedEmail === currentEmail && !!currentEmail;
  const [verified,setVerified] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  const [file,setFile] = useState<File>();
  const base = '/api/enrollment';
  async function getOrder(id:string) {
    const response = await fetch(base+'/orders/'+encodeURIComponent(id),{cache:'no-store'});
    if (!response.ok) throw Error(response.status===401?'enrollment_verification_required':'enrollment_order_not_found');
    setOrder(await response.json());
    const options=await fetch(base+'/orders/'+encodeURIComponent(id)+'/aftercare',{cache:'no-store'});
    if(options.ok) setAftercare(await options.json());
    else setAftercare(undefined);
  }
  async function getOrders() {
    const response = await fetch(base+'/orders',{cache:'no-store'});
    if (response.status === 401) {
      setVerified(false);
      setOrders(undefined);
      setInterests(undefined);
      return;
    }
    if (!response.ok) throw Error('enrollment_failed');
    setOrders((await response.json()).orders);
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
    if (open && !paymentClasses && !applicationClass) {
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
      if (message==='enrollment_class_full') setHasNoSeat(true);
      if (message==='enrollment_seat_available') setHasNoSeat(false);
      if (message==='enrollment_verification_required' && applicationClass) {
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
  function verifyApplication() {
    return run(async () => {
      if (!emailConfirmed) {
        await enrollmentPost(base+'/email/verify',{email,challengeId:challenge,code});
        setVerifiedEmail(currentEmail);
        setVerified(true);
      }
      await submitApplication();
    });
  }
  function editEmail(value: string) {
    setEmail(value);
    setChallenge(undefined);
    setCode('');
    setError('');
  }
  function upload() {
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
      await enrollmentPost(path+'/finish',{uploadId:started.uploadId,mime:file.type,encoded});
      setFile(undefined);
      await getOrder(order.id);
    });
  }
  const join = () => run(async () => {
    await enrollmentPost(base+'/waitlist',{classId,phone,name,source:sourceQuery()});
    setJoined(true);
  });
  function savePreferences(data: Parameters<React.ComponentProps<typeof EnrollmentDemandForm>['onSave']>[0]) {
    void run(async () => {
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
    enrollment_invalid_code:['验证码无效或已过期。','The code is invalid or expired.','Kode tidak berlaku atau kedaluwarsa.'],
    enrollment_verification_required:['请验证邮箱后查看报名。','Verify your email to view the order.','Verifikasi email untuk melihat pesanan.'],
    enrollment_order_not_found:['找不到这条报名。','This enrollment could not be found.','Pendaftaran ini tidak ditemukan.'],
    enrollment_invalid_application:['请检查学员姓名和带区号的电话号码。','Check the learner name and phone number with country code.','Periksa nama siswa dan nomor telepon beserta kode negara.'],
    enrollment_class_unavailable:['此班次已停止接受报名。','This class is no longer accepting applications.','Pendaftaran kelas ini sudah ditutup.'],
    enrollment_invalid_proof:['凭证上传失败。请检查文件后重试。','Upload failed. Check the file and retry.','Unggahan gagal. Periksa file dan coba lagi.'],
  };
  const message=errors[error] || ['操作未完成，请核对后重试。','The action could not be completed. Please review and retry.','Tindakan belum selesai. Periksa dan coba lagi.'];
  function transfer(targetClassId:string,decision:'accept'|'decline',invitationId?:string) {
    if(!order) return;
    void run(async()=>{
      await enrollmentPost(base+'/orders/'+order.id+'/transfer',{classId:order.classId,targetClassId,decision,invitationId,requestId:crypto.randomUUID()});
      await getOrder(order.id);
    });
  }
  const paymentPath = (id: string) => {
    const next = new URLSearchParams(params);
    next.delete('apply');
    next.set('order', id);
    return '/enrollment/payment?' + next.toString();
  };
  const canUpload = order && !['paid','paid_cancelled','refunding','refunded'].includes(order.status) && !order.restored;
  const status = order && t(order.restored ? ['已恢复原班报名','Enrollment restored','Pendaftaran dipulihkan'] : enrollmentStatuses[order.status]);
  const emailLabel=t(['电子邮箱','Email address','Alamat email']);
  const sendLabel=t(challenge?['重发验证码','Resend code','Kirim ulang kode']:['发送验证码','Send code','Kirim kode']);
  const verifiedHint=t(['验证码已发出，请查收邮件。','Code sent. Check your inbox.','Kode dikirim. Periksa kotak masuk Anda.']);
  const learnerLabel=t(['学员姓名','Learner name','Nama siswa']);
  const phoneLabel=t(['WhatsApp／手机号','WhatsApp or phone','WhatsApp atau nomor HP']);
  if (applicationClass && !hasNoSeat) return <div>
    {verificationStep
      ? <button type="button" className="enrollment-back" onClick={()=>{setVerificationStep(false);setError('');}} disabled={busy}>
        <ArrowLeft size={15} aria-hidden="true"/>{t(['返回申请表','Back to application','Kembali ke formulir'])}
      </button>
      : <Link className="enrollment-back" to={applicationClass.detailsPath}>
        <ArrowLeft size={15} aria-hidden="true"/>{t(['返回班次详情','Back to class details','Kembali ke detail kelas'])}
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
      {emailConfirmed ? <p role="status">{t(['邮箱已验证。','Email verified.','Email sudah diverifikasi.'])}</p> :
        <div className="enrollment-code-field">
          <label className="enrollment-field" htmlFor="enrollment-verification-code">{t(['邮箱验证码','Email verification code','Kode verifikasi email'])}</label>
          <div className="enrollment-code-input">
            <input id="enrollment-verification-code" type="text" autoComplete="one-time-code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required
              value={code} onChange={event=>setCode(event.target.value.replace(/[^0-9]/g,''))}
              placeholder={t(['输入 6 位验证码','Enter 6-digit code','Masukkan kode 6 digit'])}/>
            <button type="button" className="enrollment-quiet" disabled={busy} onClick={()=>void sendCode()}>{sendLabel}</button>
          </div>
        </div>}
      {challenge && !emailConfirmed && <p className="enrollment-code-feedback" role="status">{verifiedHint}</p>}
      <div className="enrollment-journey-actions">
        <p>{t(['取得席位后进入「转账与凭证」。','Once a seat is reserved, you’ll go to Transfer & proof.','Setelah mendapat kursi, Anda akan masuk ke Transfer dan bukti.'])}</p>
        <button className="enrollment-primary" type="submit" disabled={busy || (!emailConfirmed && (!challenge || code.length!==6))}>
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
            '原班不开课且你已付清学费时，我们会优先寻找最近开课的同级别、同班型班次。有合适席位时先为你保留，再请你确认。若原班顺延，也会先征求你的意见。',
            'If your original class will not open and you have paid in full, we’ll look for the next class at the same level and in the same format. We’ll hold an available seat and ask you to confirm. We’ll also ask before moving you to a later start date.',
            'Jika kelas awal tidak dibuka dan biaya sudah lunas, kami akan mencari kelas berikutnya dengan level dan jenis yang sama. Jika ada kursi, kami akan menahannya sambil menunggu konfirmasi Anda. Kami juga akan meminta persetujuan jika jadwal kelas awal mundur.',
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
    const course = mineClasses?.find(row=>row.id===id);
    const format = course && interestOption(language,course.format);
    const date = displayDate(firstLesson);
    const dateText = date && (course?.opened===false
      ? t(['预计 '+date+'开课','Expected '+date,'Perkiraan '+date])
      : t([date+'开课','Starts '+date,'Mulai '+date]));
    return [level,format,dateText].filter(Boolean).join(' · ');
  }
  function paymentDeadline(value: string) {
    const date = new Date(value);
    if (!Number.isFinite(date.valueOf())) return '';
    const time = new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Jakarta'}).format(date);
    return t([dayFormat.format(date)+' '+time+' WIB 截止','Due '+dayFormat.format(date)+' at '+time+' WIB','Batas '+dayFormat.format(date)+' pukul '+time+' WIB']);
  }
  const orderIsActive = (row: OrderSummary) => row.restored || !['expired','refunded'].includes(row.status);
  const orderCards = (orders ?? []).filter(()=>tab==='all'||tab==='orders').map(row => {
    const course = mineClasses?.find(item=>item.id===row.classId);
    const status = row.restored ? t(['已恢复原班报名','Enrollment restored','Pendaftaran dipulihkan']) : t(enrollmentStatuses[row.status]);
    const active = orderIsActive(row);
    const payable = row.status==='awaiting_payment'||row.status==='partial';
    const action = t(payable ? ['查看转账与凭证','View transfer & proof','Lihat transfer dan bukti']
      : row.status==='expired'&&!row.restored ? ['查看原订单','View original order','Lihat pesanan asal']
      : ['查看报名','View enrollment','Lihat pendaftaran']);
    return {key:'order-'+row.id,active,card:<article className="enrollment-record">
      <header><small>{t(['报名申请','Application','Pendaftaran'])}</small>
        <span className="enrollment-status" data-state={!active?'full':row.status==='paid'||row.restored?'confirmed':'pending'}>{status}</span></header>
      <h2>{classTitle(row.level,row.firstLesson,row.classId)}</h2>
      {row.status==='awaiting_payment' && <p>{paymentDeadline(row.deadline)}</p>}
      {row.status==='expired'&&!row.restored && <p>{t(['付款凭证未按时提交','Proof was not submitted by the deadline','Bukti tidak dikirim sebelum batas waktu'])}</p>}
      {row.status==='paid' && course?.schedule && <p>{[course.opened&&t(['已确认开班','Class confirmed','Kelas dikonfirmasi']),course.schedule].filter(Boolean).join(' · ')}</p>}
      {row.learnerName&&<p>{row.learnerName}</p>}
      {payable ? <Link className="enrollment-record-link" to={paymentPath(row.id)}>{action}<ChevronRight size={15} aria-hidden="true"/></Link>
        : <button type="button" className="enrollment-record-link" onClick={()=>selectOrder(row.id)}>{action}<ChevronRight size={15} aria-hidden="true"/></button>}
    </article>};
  });
  const mineParams = new URLSearchParams(params);
  mineParams.delete('order');
  const listPath = '/enrollment/mine?' + mineParams.toString();
  function recordPath(kind: InterestRecord['kind'], id: string) {
    return '/enrollment/mine/' + kind + '/' + encodeURIComponent(id) + '?' + mineParams.toString();
  }
  const catalogParams = new URLSearchParams(mineParams);
  catalogParams.delete('tab');
  catalogParams.delete('apply');
  const catalogPath = '/enrollment?' + catalogParams.toString();
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
        {available ? <Link className="enrollment-primary" to={'/enrollment/'+encodeURIComponent(row.classId)+'?'+catalogParams.toString()+'&apply=1'}>{applyText}</Link>
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
          <Link className="enrollment-record-link" to={'/enrollment/'+encodeURIComponent(match.id)+'?'+catalogParams.toString()}>
            {t(['查看匹配班次','View matching class','Lihat kelas yang cocok'])}<ChevronRight size={15} aria-hidden="true"/>
          </Link>
        </article>)}
        {active&&<div className="enrollment-interest-actions">
          <button type="button" className="enrollment-quiet" disabled={busy} onClick={()=>remove('demands',row.id)}>{t(['撤回需求','Withdraw request','Tarik permintaan'])}</button>
          <button type="button" className="enrollment-primary" disabled={busy||editDemand?.id===row.id} onClick={()=>setEditDemand(row)}>{t(['修改需求','Edit preferences','Ubah preferensi'])}</button>
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
    key:'waitlist-'+row.id, active:row.state==='waiting', card:<article className="enrollment-record">
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
    key:'demand-'+row.id, active:row.state==='active', card:<article className="enrollment-record">
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
  const records = [...orderCards,...waitlistCards,...demandCards];
  const activeRecords = records.filter(record=>record.active);
  const pastRecords = records.filter(record=>!record.active);
  if (!open) return <button className="enrollment-action" type="button" onClick={()=>setOpen(true)}>{hasNoSeat?joinText:applyText}</button>;
  return <section className={mineClasses && !order ? "enrollment-application enrollment-mine-content" : order && paymentClasses ? "enrollment-application enrollment-payment-content" : "enrollment-card enrollment-application"}>
    {error && <p role="alert">{t(message)}</p>}
    {checkingRecords || loadingPayment ? <p role="status">{t(['正在读取报名…','Loading enrollment…','Memuat pendaftaran…'])}</p> : order ? <>
      {paymentClasses ? <EnrollmentPayment order={order} course={paymentClasses.find(row => row.id === order.classId)}
        schedule={aftercare?.currentClass.schedule} language={language} status={status ?? ''} canUpload={!!canUpload}
        file={file} busy={busy} setFile={setFile} upload={() => void upload()}/> : <>
      {!classId && <button type="button" onClick={()=>{selectOrder(); void run(getOrders);}}>
        {t(['返回报名列表','Back to enrollments','Kembali ke daftar pendaftaran'])}
      </button>}
      <h2>{status}</h2>
      {order.learnerName&&<p>{t(['学员姓名','Learner name','Nama siswa'])} · {order.learnerName}</p>}
      <p>{t(['报名编号','Order number','Nomor pendaftaran'])} {order.id}</p>
      <p>{t(['应付','Amount due','Tagihan'])} {formatCurrency(order.price,language)} · {t(['实际到账','Verified receipts','Dana terverifikasi'])} {formatCurrency(order.received,language)}</p>
      {order.status==='awaiting_payment' && <p>{t(['付款截止','Payment deadline','Batas pembayaran'])} {new Intl.DateTimeFormat(language==='zh'?'zh-CN':language,{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(order.deadline))} WIB</p>}
      {canUpload && <Link className="enrollment-action" to={paymentPath(order.id)}>
        {t(['转账与凭证','Transfer & proof','Transfer dan bukti'])}
      </Link>}
      </>}
      {aftercare?.originalClassState==='cancelled' && <p>{t(['原班已确认不开班。','The original class will not open.','Kelas asal tidak dibuka.'])}</p>}
      {!!aftercare?.transferHistory.length && aftercare.originalClassState!=='cancelled' && <>
        <p>{t(['已确认转班，原实收已用于目标班。','Transfer confirmed. Your payment was applied to the new class.','Pindah kelas dikonfirmasi. Pembayaran digunakan untuk kelas baru.'])}</p>
        <p>{aftercare.currentClass.firstLesson.replace('T',' ')} WIB · {aftercare.currentClass.schedule}</p>
      </>}
      {aftercare?.invitations.filter(item=>['offered','expired'].includes(item.state)).map(item=><article key={item.id} className="enrollment-card">
        {item.state==='offered' ? <>
          <h3>{t(['转班邀请','Transfer invitation','Undangan pindah kelas'])}</h3>
          <p>{item.firstLesson.replace('T',' ')} WIB · {item.schedule}</p>
          <p>{t(['答复截止','Reply by','Batas jawaban'])} {new Intl.DateTimeFormat(language==='zh'?'zh-CN':language,{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(item.expiresAt))} WIB</p>
          <button type="button" className="enrollment-action" disabled={busy} onClick={()=>transfer(item.targetClassId,'accept',item.id)}>{t(['确认转班','Confirm transfer','Konfirmasi pindah kelas'])}</button>
          <button type="button" disabled={busy} onClick={()=>transfer(item.targetClassId,'decline',item.id)}>{t(['拒绝邀请','Decline invitation','Tolak undangan'])}</button>
        </> : item.state==='expired' ? <p>{t(['转班邀请已到期','Transfer invitation expired','Undangan pindah kelas kedaluwarsa'])}</p> : null}
      </article>)}
      {aftercare?.transfers.map(item=><article key={item.id} className="enrollment-card">
        <p>{item.firstLesson.replace('T',' ')} WIB · {item.schedule}</p>
        <button className="enrollment-action" type="button" disabled={busy} onClick={()=>transfer(item.id,'accept')}>{t(['转到这个班','Transfer to this class','Pindah ke kelas ini'])}</button>
      </article>)}
      {aftercare?.refundProgress ? <p>{t(['累计已原路退款','Total refunded to original payment','Total dikembalikan ke pembayaran asal'])} {formatCurrency(aftercare.refundProgress.refunded,language)} / {formatCurrency(aftercare.refundProgress.expected,language)}</p>
        : aftercare?.refund.mode==='contact_support' && <Link to={'/contact?lang='+language}>{t(['联系销售客服申请退款','Contact support to request a refund','Hubungi layanan pelanggan untuk meminta pengembalian'])}</Link>}
      {aftercare?.refund.mode==='special_review' && !aftercare.refundProgress && <p>{t([
        '班次已确认开班。因特殊情况需要退出，请联系销售客服核实。',
        'This class is confirmed. Contact support if exceptional circumstances require you to withdraw.',
        'Kelas sudah dikonfirmasi. Hubungi layanan pelanggan jika harus mengundurkan diri karena keadaan khusus.',
      ])} <Link to={'/contact?lang='+language}>{t(['联系销售客服','Contact support','Hubungi layanan pelanggan'])}</Link></p>}
      {(!paymentClasses || !order.bank) && <button type="button" onClick={()=>void run(()=>getOrder(order.id))}>{t(['刷新状态','Refresh status','Muat ulang status'])}</button>}
    </> : !verified ? <form className={mineClasses ? 'enrollment-mine-login' : undefined} onSubmit={event=>{event.preventDefault();void (challenge?verify():sendCode());}}>
      <h2>{t(['验证邮箱','Verify your email','Verifikasi email'])}</h2>
      {mineClasses&&<p>{t(['验证后即可查看该邮箱下的报名、候补和选课需求。','Verify your email to view its enrollments, waitlist entries, and course preferences.','Verifikasi email untuk melihat pendaftaran, daftar tunggu, dan preferensi kursus.'])}</p>}
      <label>{t(['电子邮箱','Email','Email'])}<input type="email" autoComplete="email" required value={email} readOnly={!!challenge} onChange={event=>setEmail(event.target.value)}/></label>
      {challenge && <label>{t(['六位验证码','Six-digit code','Kode enam digit'])}<input autoComplete="one-time-code" required pattern="[0-9]{6}" inputMode="numeric" value={code} onChange={event=>setCode(event.target.value)}/></label>}
      <button className="enrollment-action" type="submit" disabled={busy}>{t(challenge?['验证','Verify','Verifikasi']:['发送验证码','Send code','Kirim kode'])}</button>
      {challenge && <button type="button" disabled={busy} onClick={()=>void sendCode()}>{t(['重发验证码','Resend code','Kirim ulang'])}</button>}
    </form> : paymentClasses ? null : demandOnly ? savedDemand ? <><p role="status">{t(['选课需求已保存。','Course preferences saved.','Preferensi kursus disimpan.'])}</p>
      <Link to={mineLink+'&tab=demands'}>{t(['查看我的需求','See my preferences','Lihat preferensi saya'])}</Link></>
      : <EnrollmentDemandForm language={language} busy={busy} onSave={savePreferences}/>
    : record ? waitlistDetail ? renderWaitlistDetail(waitlistDetail)
      : demandDetail ? renderDemandDetail(demandDetail)
      : interests ? <p>{t(['这条记录无法查看。','This record is not available.','Catatan ini tidak tersedia.'])}</p>
      : <button type="button" className="enrollment-quiet" disabled={busy} onClick={()=>void run(getOrders)}>{t(['重试','Try again','Coba lagi'])}</button>
    : !classId ? <div className="enrollment-records">
      <div className="enrollment-record-tabs" role="group" aria-label={t(['记录类别','Activity type','Jenis aktivitas'])}>
        {([
          ['all', ['全部','All','Semua'], undefined],
          ['orders',['申请','Applications','Pendaftaran'],orders?.filter(orderIsActive).length],
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
