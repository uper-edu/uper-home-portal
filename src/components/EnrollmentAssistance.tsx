import {enrollmentClassTitle,type EnrollmentClassIdentity} from '../utils/enrollmentCatalog';
import {useEffect,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {enrollmentCopy,enrollmentPost} from './EnrollmentApplication';
import {interestOption,type InterestLanguage} from './EnrollmentInterests';
import {formatCurrency} from '../utils/currency';

type Offer={classId:string;quote:EnrollmentClassIdentity & {level:string;firstLesson:string;schedule:string;price:number;period:string;format:string};name?:string;phone?:string;email?:string;orderId?:string};

export function EnrollmentAssistance({language}:{language:InterestLanguage}){
  const t=(zh:string,en:string,id:string)=>enrollmentCopy(language,[zh,en,id]);
  const {hash}=useLocation();
  const links=new URLSearchParams(hash.slice(1));
  const applicationId=links.get('a')??'';
  const token=links.get('t')??'';
  const lookup=applicationId?{applicationId}:{token};
  const navigate=useNavigate();
  const [offer,setOffer]=useState<Offer>();
  const [email,setEmail]=useState('');
  const [challenge,setChallenge]=useState('');
  const [code,setCode]=useState('');
  const [confirmed,setConfirmed]=useState(false);
  const [priority,setPriority]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    let cancelled=false;
    setOffer(undefined);setError('');
    if(!token&&!applicationId){setError('enrollment_assistance_unavailable');return;}
    setChallenge('');setCode('');setConfirmed(false);
    void enrollmentPost('/api/enrollment/assistance/preview',lookup).then(async data=>{
      const verified:Offer|undefined=await enrollmentPost('/api/enrollment/assistance/preview',{...lookup,verified:true}).catch(()=>undefined);
      if(!cancelled){
        if(verified?.orderId){payment(verified.orderId);return;}
        setOffer(verified??data);
      }
    })
      .catch(cause=>{if(!cancelled)setError(cause.message);});
    return ()=>{cancelled=true;};
  },[token,applicationId,language]);
  const payment=(id:string)=>navigate('/enrollment/payment?'+new URLSearchParams({lang:language,order:id}),{replace:true});
  const run=async(action:()=>Promise<void>)=>{
    if(busy)return;
    setBusy(true);setError('');
    try{await action();}catch(cause){setError((cause as Error).message);}
    finally{setBusy(false);}
  };
  const errors:Record<string,[string,string,string]>={
    enrollment_assistance_unavailable:['此报名链接已失效，请联系销售获取新链接。','This enrollment link is no longer available. Contact your advisor for a new link.','Tautan ini tidak berlaku. Hubungi tim kami untuk tautan baru.'],
    enrollment_assistance_quote_changed:['班次或学费已更新，请联系销售获取新链接。','The class or fee has changed. Contact your advisor for a new link.','Kelas atau biaya berubah. Hubungi tim kami untuk tautan baru.'],
    enrollment_assistance_email:['请使用与销售确认的报名邮箱。','Use the email address agreed with your advisor.','Gunakan email yang disepakati dengan tim kami.'],
    enrollment_class_full:['该班次已满。你可以加入候补。','This class is full. You can join the waitlist.','Kelas penuh. Kamu dapat masuk daftar tunggu.'],
    enrollment_assistance_existing_order:['这笔报名已有订单，请到「我的报名」查看。','There is already an order. Find it in My enrollments.','Pesanan sudah ada. Periksa Pendaftaran saya.'],
  };
  return <section className="enrollment-screen enrollment-apply-screen">
    <h1>{t('确认课程报名','Confirm course enrollment','Konfirmasi pendaftaran kelas')}</h1>
    {error&&<p className="enrollment-form-error" role="alert">{enrollmentCopy(language,errors[error]??[
      '暂时无法继续，请核对邮箱、验证码或联系销售。','Check your email and verification code or contact your advisor.','Periksa email dan kode verifikasi, atau hubungi tim kami.'])}</p>}
    {offer&&<><article className="enrollment-record">
      <h2>{enrollmentClassTitle(offer.quote,language)}</h2>
      <p>{offer.quote.firstLesson.replace('T',' ')} WIB</p><p>{offer.quote.schedule}</p><p><strong>{formatCurrency(offer.quote.price,language)}</strong></p>
      <Link target="_blank" rel="noopener noreferrer" to={'/enrollment/'+encodeURIComponent(offer.classId)+'?view=rules&lang='+language}>
        {t('查看开班与退款说明','Class opening and refund policy','Ketentuan pembukaan kelas dan pengembalian dana')}</Link>
    </article>
    {!offer.name?<form className="enrollment-journey-form" onSubmit={event=>{
      event.preventDefault();
      void run(async()=>{
        await enrollmentPost('/api/enrollment/email/verify',{email,challengeId:challenge,code});
        const verified:Offer=await enrollmentPost('/api/enrollment/assistance/preview',{...lookup,verified:true});
        if(verified.orderId){payment(verified.orderId);return;}
        setOffer(verified);
      });
    }}>
      <label className="enrollment-field">{t('报名邮箱','Enrollment email','Email pendaftaran')}
        <input type="email" required autoComplete="email" value={email} onChange={event=>{setEmail(event.currentTarget.value);setChallenge('');setCode('');}}/>
      </label>
      {challenge&&<label className="enrollment-field">{t('邮箱验证码','Email verification code','Kode verifikasi email')}
        <input value={code} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" autoComplete="one-time-code"
          onChange={event=>setCode(event.currentTarget.value.replace(/\D/g,''))} required/>
      </label>}
      <div className="enrollment-journey-actions">
        <button type="button" className={challenge?'enrollment-quiet':'enrollment-primary'} disabled={busy||!email} onClick={()=>void run(async()=>{
          const next=await enrollmentPost('/api/enrollment/email/request',{email,purpose:'apply',language});setChallenge(next.challengeId);
        })}>{t('发送验证码','Send code','Kirim kode')}</button>
        {challenge&&<button type="submit" className="enrollment-primary" disabled={busy||code.length!==6}>{t('验证邮箱','Verify email','Verifikasi email')}</button>}
      </div>
    </form>:<form className="enrollment-journey-form" onSubmit={event=>{
      event.preventDefault();if(!confirmed)return;
      void run(async()=>{const order=await enrollmentPost('/api/enrollment/assistance/confirm',{...lookup,termsVersion:1,confirmed,priority});payment(order.id);});
    }}>
      <div className="enrollment-record">
        <p>{t('学员姓名','Learner name','Nama siswa')} · {offer.name}</p>
        <p>{t('报名邮箱','Enrollment email','Email pendaftaran')} · {offer.email}</p>
        <p>{t('WhatsApp／手机号','WhatsApp or phone','WhatsApp atau nomor HP')} · {offer.phone}</p>
      </div>
      <label><input type="checkbox" checked={priority} onChange={event=>setPriority(event.currentTarget.checked)}/> {t('优先安排顺延或同级同班型转班','Prioritize rescheduling or a transfer to the same level and format','Utamakan penjadwalan ulang atau pindah kelas dengan level dan tipe yang sama')}</label>
      <label><input type="checkbox" checked={confirmed} required onChange={event=>setConfirmed(event.currentTarget.checked)}/> {t('我确认学员资料、班次和学费，已阅读开班与退款说明。','I confirm the learner details, class and fee, and have read the opening and refund policy.','Saya mengonfirmasi data siswa, kelas, dan biaya serta telah membaca ketentuan pembukaan dan pengembalian dana.')}</label>
      <div className="enrollment-journey-actions">
        <p>{t('确认并取得席位后，即可查看转账信息。','Transfer instructions appear after your seat is reserved.','Informasi transfer tampil setelah kursi dipesan.')}</p>
        {error==='enrollment_class_full'
          ? <Link className="enrollment-primary" to={'/enrollment/'+encodeURIComponent(offer.classId)+'?apply=1&join=1&lang='+language}>{t('加入候补','Join waitlist','Masuk daftar tunggu')}</Link>
          : <button type="submit" className="enrollment-primary" disabled={busy||!confirmed}>{t('确认报名并继续','Confirm and continue','Konfirmasi dan lanjutkan')}</button>}
      </div>
    </form>}</>}
    {!offer&&!error&&<p role="status">{t('正在读取报名信息…','Loading enrollment…','Memuat pendaftaran…')}</p>}
  </section>;
}
