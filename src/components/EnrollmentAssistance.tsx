import {enrollmentCodeRequestErrors,enrollmentReadinessMessage} from '../utils/enrollmentReadinessCopy';
import {enrollmentCopy,enrollmentClassTitle,type EnrollmentClassIdentity} from '../utils/enrollmentCatalog';
import {useEffect,useEffectEvent,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {enrollmentCodeInput,enrollmentPost,readEnrollmentEmailVerification,requestAssistanceEmailCode,verifyAssistanceEmailCode,watchEnrollmentEmailSession} from '../services/enrollmentSession';
import type {InterestLanguage} from '../utils/enrollmentInterestCopy';
import {formatCurrency} from '../utils/currency';
import {readEnrollmentDraft,writeEnrollmentDraft} from '../services/visitorContact';
import {visitorScope} from '../services/visitorScope';
import {watchReadReconnect} from '../services/readReconnect';
import {maskEnrollmentEmail} from '../utils/enrollmentEmailIdentity';
import {useEnrollmentJourneyState} from './EnrollmentJourneyLink';
import {EnrollmentRecordSummary} from './EnrollmentRecordLayout';
import {EnrollmentEmailIdentity} from './EnrollmentEmailIdentity';

type Offer={classId:string;quote:EnrollmentClassIdentity & {level:string;firstLesson:string;schedule:string;price:number;period:string;format:string};name?:string;phone?:string;email?:string;maskedEmail?:string;orderId?:string};
type AssistanceCodeDraft={challengeId:string};
type VerificationReadback='verified'|'unknown';
function previewReadError(cause:Error&{status?:number}) {
  if(cause.message==='enrollment_verification_required'||(cause.status&&cause.status<500&&cause.status!==408))return cause;
  return Error('enrollment_assistance_read_failed');
}

export function EnrollmentAssistanceForm({hash,language,navigation}:{hash:string;language:InterestLanguage;navigation?:ReactNode}){
  const t=(zh:string,en:string,id:string)=>enrollmentCopy(language,[zh,en,id]);
  const links=new URLSearchParams(hash.slice(1));
  const applicationId=links.get('a')??'';
  const token=links.get('t')??'';
  const lookup=applicationId?{applicationId}:{token};
  const [owner]=useState(visitorScope);
  // The current link contains a public application reference. Keep legacy
  // bearer tokens out of browser storage, including storage keys.
  const codeDraftKey=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(applicationId)
    ? 'assist-code:'+applicationId.toLowerCase() : undefined;
  const navigate=useNavigate();
  const [params]=useSearchParams();
  const journeyState=useEnrollmentJourneyState();
  const [offer,setOffer]=useState<Offer>();
  const [challenge,setChallenge]=useState(()=>{
    const saved=codeDraftKey&&readEnrollmentDraft<AssistanceCodeDraft>(owner,codeDraftKey);
    return saved&&typeof saved.challengeId==='string'?saved.challengeId:'';
  });
  const [code,setCode]=useState('');
  const [previewPending,setPreviewPending]=useState<VerificationReadback>();
  const [previewRetry,setPreviewRetry]=useState(0);
  const [confirmed,setConfirmed]=useState(false);
  const [confirmationResult,setConfirmationResult]=useState<'unknown'|'no-order'>();
  const [priority,setPriority]=useState(true);
  const [busy,setBusy]=useState(false);
  const running=useRef(false);
  const [error,setError]=useState('');
  const mounted=useRef(false);
  useEffect(()=>{
    // Rewrite older drafts without the address. The application now identifies the recipient.
    if(codeDraftKey&&challenge)writeEnrollmentDraft<AssistanceCodeDraft>(owner,codeDraftKey,{challengeId:challenge});
  },[codeDraftKey,owner,challenge]);
  useLayoutEffect(()=>{
    mounted.current=true;
    return ()=>{mounted.current=false;};
  },[]);
  const isCurrent=()=>mounted.current&&location.hash===hash&&visitorScope()===owner;
  const payment=(id:string)=>{
    if(!isCurrent())return;
    const next=new URLSearchParams(params);
    next.set('lang',language);
    next.set('order',id);
    navigate('/enrollment/payment?'+next,{replace:true,state:journeyState});
  };
  const continueToPayment=useEffectEvent(payment);
  function clearCodeDraft(){
    if(codeDraftKey)writeEnrollmentDraft(owner,codeDraftKey);
    setChallenge('');setCode('');
  }
  function removeVerifiedDetails(){
    setOffer(current=>current&&{classId:current.classId,quote:current.quote,
      maskedEmail:current.email?maskEnrollmentEmail(current.email):current.maskedEmail});
    setPreviewPending(undefined);
    setConfirmationResult(undefined);
    setConfirmed(false);clearCodeDraft();
  }
  useEffect(()=>{
    setOffer(undefined);
    if(!token&&!applicationId){setError('enrollment_assistance_unavailable');return;}
    setConfirmed(false);
    const controller=new AbortController();
    const reconnect=watchReadReconnect(()=>void load(),{foregroundOnly:true});
    async function load(){
      if(controller.signal.aborted)return;
      setError('');
      try {
        if(navigator.onLine===false)throw new TypeError('Network unavailable');
        const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]);
        const data:Offer=await enrollmentPost('/api/enrollment/assistance/preview',{...lookup,verified:'if-verified'},undefined,signal);
        if(controller.signal.aborted)return;
        reconnect.stop();
        if(data.email||data.orderId)clearCodeDraft();
        if(data.orderId){continueToPayment(data.orderId);return;}
        setOffer(data);
      } catch(cause) {
        if(controller.signal.aborted)return;
        const error=previewReadError(cause as Error);
        if(error.message==='enrollment_assistance_read_failed'){
          if(reconnect.failed())return;
        }else reconnect.stop();
        setError(error.message);
      }
    }
    void load();
    return ()=>{reconnect.stop();controller.abort();};
  },[token,applicationId,previewRetry]);
  useEffect(()=>{
    if(!offer?.email)return;
    const address=offer.email;
    const check=async(isLatest:()=>boolean,signal:AbortSignal,sessionChanged:boolean)=>{
      const verified=await readEnrollmentEmailVerification(address,signal);
      if(isLatest()&&(verified===false||sessionChanged&&verified===undefined))removeVerifiedDetails();
      return verified!==undefined;
    };
    return watchEnrollmentEmailSession(check);
  },[offer?.email]);
  async function readVerifiedOffer(){
    const verified:Offer=await enrollmentPost('/api/enrollment/assistance/preview',{...lookup,verified:true},undefined,AbortSignal.timeout(15000))
      .catch(cause=>{throw previewReadError(cause);});
    if(!isCurrent())return;
    if(!verified.email)throw Error('enrollment_assistance_read_failed');
    setPreviewPending(undefined);
    clearCodeDraft();
    if(verified.orderId){payment(verified.orderId);return;}
    setOffer(verified);
  }
  async function verifyAndReadOffer(){
    let readback=previewPending;
    if(!readback){
      try{
        await verifyAssistanceEmailCode(lookup,challenge,code);
        readback='verified';
      }catch(cause){
        const status=(cause as {status?:number}).status;
        if(status&&status>=400&&status<500&&status!==408)throw cause;
        readback='unknown';
      }
      if(!isCurrent())return;
      setPreviewPending(readback);
      if(readback==='verified')clearCodeDraft();
    }
    try{
      await readVerifiedOffer();
    }catch(cause){
      if(readback==='unknown'&&['enrollment_verification_required','enrollment_assistance_email'].includes((cause as Error).message)){
        setPreviewPending(undefined);
        throw Error('enrollment_email_verification_unconfirmed');
      }
      throw cause;
    }
  }
  async function readConfirmation(address:string){
    const verified:Offer=await enrollmentPost('/api/enrollment/assistance/preview',
      {...lookup,verified:true},address,AbortSignal.timeout(15000))
      .catch(cause=>{throw previewReadError(cause);});
    if(verified.orderId){payment(verified.orderId);return;}
    if(!verified.name||verified.email!==address)throw Error('enrollment_verification_required');
    setConfirmationResult('no-order');
  }
  async function confirmEnrollment(address:string){
    setConfirmationResult(undefined);
    try {
      const order=await enrollmentPost('/api/enrollment/assistance/confirm',
        {...lookup,termsVersion:1,confirmed,priority},address,AbortSignal.timeout(20000));
      if(typeof order?.id==='string'&&order.id){payment(order.id);return;}
    } catch(cause) {
      const status=(cause as {status?:number}).status;
      if((cause as Error).message==='enrollment_verification_required'||
        status&&status>=400&&status<500&&![408,425,429].includes(status))throw cause;
    }
    // A submitted confirmation may finish after the learner opens another offer.
    if(!isCurrent())return;
    setConfirmationResult('unknown');
    await readConfirmation(address);
  }
  const run=async(action:()=>Promise<void>)=>{
    if(running.current)return;
    running.current=true;
    setBusy(true);setError('');
    try{await action();}catch(cause){
      if(!isCurrent())return;
      const message=(cause as Error).message;
      if(message==='enrollment_verification_required'||message==='enrollment_assistance_email')removeVerifiedDetails();
      if(message==='enrollment_assistance_unavailable'){setOffer(undefined);clearCodeDraft();}
      setError(message);
    }
    finally{running.current=false;setBusy(false);}
  };
  const errors:Record<string,[string,string,string]>={
    ...enrollmentCodeRequestErrors,
    enrollment_assistance_unavailable:['此报名链接已失效，请联系销售获取新链接。','This enrollment link is no longer available. Contact your advisor for a new link.','Tautan ini tidak berlaku. Hubungi tim kami untuk tautan baru.'],
    enrollment_assistance_quote_changed:['班次或学费已更新，请联系销售获取新链接。','The class or fee has changed. Contact your advisor for a new link.','Kelas atau biaya berubah. Hubungi tim kami untuk tautan baru.'],
    enrollment_assistance_email:['请使用与销售确认的报名邮箱。','Use the email address agreed with your advisor.','Gunakan email yang disepakati dengan tim kami.'],
    enrollment_assistance_read_failed:['暂时无法读取报名资料，请重试。','Enrollment details are temporarily unavailable. Try again.','Detail pendaftaran belum tersedia. Silakan coba lagi.'],
    enrollment_invalid_code:['验证码错误或已过期，请核对或重新发送。','The code is incorrect or expired. Check it or request a new one.','Kode salah atau sudah kedaluwarsa. Periksa atau minta kode baru.'],
    enrollment_verification_required:['请验证当前邮箱后继续。','Verify this email address to continue.','Verifikasi alamat email ini untuk melanjutkan.'],
    enrollment_email_verification_unconfirmed:['暂时无法确认邮箱验证结果。请重试验证，或重新获取验证码。','We could not confirm email verification. Try verifying again or request a new code.','Verifikasi email belum dapat dikonfirmasi. Coba verifikasi lagi atau minta kode baru.'],
    enrollment_class_full:['该班次已满。你可以加入候补。','This class is full. You can join the waitlist.','Kelas penuh. Kamu dapat masuk daftar tunggu.'],
    enrollment_assistance_existing_order:['这笔报名已有订单，请到「我的报名」查看。','There is already an order. Find it in My enrollments.','Pesanan sudah ada. Periksa Pendaftaran saya.'],
    enrollment_intake_paused:['新报名暂时暂停，请联系销售。','New applications are paused. Please contact your advisor.','Pendaftaran baru dijeda. Hubungi tim kami.'],
    enrollment_email_unavailable:['目前无法发送验证码，请稍后重试或联系销售。','We could not send your verification code. Try again later or contact your advisor.','Kode verifikasi belum dapat dikirim. Coba lagi nanti atau hubungi tim kami.'],
  };
  return <section className="enrollment-screen enrollment-mine enrollment-apply-screen" data-record-detail="true">
    {navigation}
    <h1>{t('确认课程报名','Confirm course enrollment','Konfirmasi pendaftaran kelas')}</h1>
    {offer?.email&&<EnrollmentEmailIdentity email={offer.email} language={language}>
      <p>{offer.email}</p>
    </EnrollmentEmailIdentity>}
    {error&&<p className="enrollment-form-error" role="alert">{enrollmentReadinessMessage(error.replace(/^enrollment_intake_/,''),language)??enrollmentCopy(language,errors[error]??[
      '暂时无法继续，请核对邮箱、验证码或联系销售。','Check your email and verification code or contact your advisor.','Periksa email dan kode verifikasi, atau hubungi tim kami.'])}</p>}
    {!offer&&error==='enrollment_assistance_read_failed'&&<button type="button" className="enrollment-quiet" onClick={()=>{
      setError('');setPreviewRetry(count=>count+1);
    }}>{t('重新读取报名资料','Reload enrollment details','Muat ulang detail pendaftaran')}</button>}
    {offer&&<><EnrollmentRecordSummary language={language} title={enrollmentClassTitle(offer.quote,language)} schedule={offer.quote.schedule} firstLesson={offer.quote.firstLesson}>
      <p><strong className="enrollment-main-amount">{formatCurrency(offer.quote.price,language)}</strong></p>
      <Link target="_blank" rel="noopener noreferrer" to={'/enrollment/'+encodeURIComponent(offer.classId)+'?view=rules&lang='+language}>
        {t('查看开班与退款说明','Class opening and refund policy','Ketentuan pembukaan kelas dan pengembalian dana')}</Link>
    </EnrollmentRecordSummary>
    {!offer.name?<form className="enrollment-journey-form" onSubmit={event=>{
      event.preventDefault();
      if(previewPending||challenge&&code.length===6)void run(verifyAndReadOffer);
    }}>
      <div className="enrollment-record">
        <p>{t('报名邮箱','Enrollment email','Email pendaftaran')} · <strong>{offer.maskedEmail}</strong></p>
        <p>{t('邮箱有误？请联系课程顾问重新发起申请。','Wrong email? Ask your course advisor to send a new application.','Email salah? Minta tim kami membuat pengajuan baru.')}</p>
      </div>
      {challenge&&!previewPending&&<label className="enrollment-field">{t('邮箱验证码','Email verification code','Kode verifikasi email')}
        <input value={code} inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code"
          disabled={busy} onChange={event=>setCode(enrollmentCodeInput(event.currentTarget.value,code))} required/>
      </label>}
      {previewPending?<div className="enrollment-journey-actions">
        <p role="status">{previewPending==='verified'?t('邮箱已验证。','Email verified.','Email sudah diverifikasi.'):
          t('邮箱验证结果待确认。','Email verification is unconfirmed.','Hasil verifikasi email belum pasti.')}</p>
        <button type="submit" className="enrollment-primary" disabled={busy}>{t('重新读取报名资料','Reload enrollment details','Muat ulang detail pendaftaran')}</button>
      </div>:<div className="enrollment-journey-actions">
        <button type="button" className={challenge?'enrollment-quiet':'enrollment-primary'} disabled={busy||!offer.maskedEmail} onClick={()=>void run(async()=>{
          const challengeId=await requestAssistanceEmailCode(lookup,language);
          if(!isCurrent())return;
          setChallenge(challengeId);
          setCode(current=>current===code?'':current);
        })}>{challenge?t('重新发送验证码','Resend code','Kirim ulang kode'):
          t('发送验证码到报名邮箱','Send code to enrollment email','Kirim kode ke email pendaftaran')}</button>
        {challenge&&<button type="submit" className="enrollment-primary" disabled={busy||code.length!==6}>{t('验证邮箱','Verify email','Verifikasi email')}</button>}
      </div>}
    </form>:<form className="enrollment-journey-form" onSubmit={event=>{
      event.preventDefault();if(!confirmed||confirmationResult==='unknown'||!offer.email)return;
      void run(()=>confirmEnrollment(offer.email!));
    }}>
      <div className="enrollment-record">
        <p>{t('学员姓名','Learner name','Nama siswa')} · {offer.name}</p>
        <p>{t('WhatsApp／手机号','WhatsApp or phone','WhatsApp atau nomor HP')} · {offer.phone}</p>
      </div>
      <label><input type="checkbox" checked={priority} disabled={busy||!!confirmationResult} onChange={event=>setPriority(event.currentTarget.checked)}/> {t('优先安排顺延或同级同班型转班','Prioritize rescheduling or a transfer to the same level and format','Utamakan penjadwalan ulang atau pindah kelas dengan level dan tipe yang sama')}</label>
      <label><input type="checkbox" checked={confirmed} disabled={busy||!!confirmationResult} required onChange={event=>setConfirmed(event.currentTarget.checked)}/> {t('我确认学员资料、班次和学费，已阅读开班与退款说明。','I confirm the learner details, class and fee, and have read the opening and refund policy.','Saya mengonfirmasi data siswa, kelas, dan biaya serta telah membaca ketentuan pembukaan dan pengembalian dana.')}</label>
      <div className="enrollment-journey-actions">
        <p>{t('确认并取得席位后，即可查看转账信息。','Transfer instructions appear after your seat is reserved.','Informasi transfer tampil setelah kursi dipesan.')}</p>
        {confirmationResult&&<>
          <p role="status">{confirmationResult==='unknown'
            ?t('暂时无法确认报名结果，请先查询。','We couldn’t confirm your enrollment. Check the result first.','Pendaftaran belum dapat dikonfirmasi. Periksa hasilnya terlebih dahulu.')
            :t('暂未查到订单，可以用原选项重试。','No order was found. You can retry with the same choices.','Pesanan belum ditemukan. Anda dapat mencoba lagi dengan pilihan yang sama.')}</p>
          <button type="button" className="enrollment-quiet" disabled={busy} onClick={()=>void run(()=>readConfirmation(offer.email!))}>
            {t('查询报名结果','Check enrollment result','Periksa hasil pendaftaran')}
          </button>
        </>}
        {error==='enrollment_class_full'
          ? <Link className="enrollment-primary" to={'/enrollment/'+encodeURIComponent(offer.classId)+'?apply=1&join=1&lang='+language}>{t('加入候补','Join waitlist','Masuk daftar tunggu')}</Link>
          : confirmationResult!=='unknown'&&<button type="submit" className="enrollment-primary" disabled={busy||!confirmed}>
            {confirmationResult==='no-order'?t('用原选项重试','Retry with the same choices','Coba lagi dengan pilihan yang sama'):t('确认报名并继续','Confirm and continue','Konfirmasi dan lanjutkan')}
          </button>}
      </div>
    </form>}</>}
    {!offer&&!error&&<p role="status">{t('正在读取报名信息…','Loading enrollment…','Memuat pendaftaran…')}</p>}
  </section>;
}
