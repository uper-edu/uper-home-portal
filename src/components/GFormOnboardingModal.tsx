import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {chooseText,type HskLanguage} from '../data/hskAssessment';
import {trackEvent} from '../utils/analytics';
import {questionnaireOptions} from '../utils/crmQuestionnaire';
import {validContactPhone,contactPhoneText,CONTACT_PHONE_ERROR} from '../utils/contactPhone';
import {validContactEmail,contactEmailText,CONTACT_EMAIL_ERROR} from '../utils/contactEmail';
import {hasPendingRegistration,pendingRegistrationDraft,RegistrationSaveError,registrationSaveText} from '../services/registrationSave';
import {readVisitorContact,subscribeVisitorContact} from '../services/visitorContact';
import {visitorScope} from '../services/visitorScope';
import {
  chatRegistrationAnswers,chatRegistrationStepForPending,readChatRegistrationDraft,withoutChatRegistrationContact,writeChatRegistrationDraft,
  type ChatRegistrationDraft,type ChatRegistrationStep,
} from '../services/chatRegistrationDraft';
import {StandaloneChatDialog} from './StandaloneChatChrome';
import {ContactPhoneInput} from './ContactPhoneInput';
import type {LeadProfile} from '../types/leadSystem';

type RegistrationOptions={queryOnly?:boolean;retryOriginal?:boolean};
type Props={
  isOpen:boolean;
  initialLang?:HskLanguage;
  profile?:LeadProfile|null;
  onConsultFirst?:(language:HskLanguage)=>void;
  onComplete:(answers:object,language:HskLanguage,options:RegistrationOptions,step:ChatRegistrationStep)=>void|Promise<void>;
};
type OptionKey=keyof typeof questionnaireOptions;
const translatedOptions:Record<OptionKey,readonly (readonly [string,string])[]>={
  currentStatus:[['职场在职员工','Karyawan'],['应届毕业生','Lulusan baru'],['在读大学生','Mahasiswa'],
    ['高中在读学生','Siswa SMA'],['教师或学校员工','Guru atau staf sekolah'],['其他','Lainnya']],
  goal:[['赴中国工作','Bekerja di Tiongkok'],['在印尼中资或合资企业工作','Bekerja di perusahaan Tiongkok atau usaha patungan di Indonesia'],
    ['赴华留学或申请奖学金','Kuliah di Tiongkok atau beasiswa'],['准备 HSK 考试','Persiapan ujian HSK'],
    ['提高中文沟通能力','Meningkatkan kemampuan Mandarin'],['其他','Lainnya']],
  reportedLevel:[['零基础','Pemula dari nol'],['学过一点','Pemula'],['不确定','Belum yakin'],
    ['HSK 1','HSK 1'],['HSK 2','HSK 2'],['HSK 3','HSK 3'],['HSK 4+','HSK 4+']],
  city:[['雅加达','Jakarta'],['其他城市','Kota lain']],
  mode:[['线下','Tatap muka'],['线上','Online'],['不确定','Belum yakin']],
  buyingSignal:[['学费','Biaya kursus'],['上课时间','Jadwal kelas'],['适合的级别','Level yang sesuai'],['暂无','Belum ada']],
};

export default function GFormOnboardingModal({isOpen,...props}:Props) {
  return isOpen?<ChatRegistrationForm {...props}/>:null;
}

function ChatRegistrationForm({initialLang='en',profile,onConsultFirst,onComplete}:Omit<Props,'isOpen'>) {
  const [owner]=useState(visitorScope);
  const [pending]=useState(()=>{try{return pendingRegistrationDraft(owner,sessionStorage);}catch{return null;}});
  const [lang,setLang]=useState<HskLanguage>(()=>pending?.language==='zh'||pending?.language==='en'||pending?.language==='id'?pending.language:initialLang);
  const [step,setStep]=useState<ChatRegistrationStep>(()=>pending?chatRegistrationStepForPending(pending):profile?'preferences':'contact');
  const [draft,setDraft]=useState<ChatRegistrationDraft>(()=>pending??{...readVisitorContact(owner),...readChatRegistrationDraft(owner)});
  useEffect(()=>{
    if(step!=='contact'||pending)return;
    return subscribeVisitorContact(owner,contact=>{
      const saved=readChatRegistrationDraft(owner);
      setDraft(current=>({...current,fullName:contact.fullName,email:contact.email,whatsapp:contact.whatsapp,...saved}));
    });
  },[owner,step,pending]);
  const [submitting,setSubmitting]=useState(false);
  const [saveUnknown,setSaveUnknown]=useState(()=>{
    try{return hasPendingRegistration(owner,sessionStorage);}catch{return hasPendingRegistration(owner);}
  });
  const [error,setError]=useState<RegistrationSaveError['state']>();
  const [phoneRejected,setPhoneRejected]=useState(false);
  const [emailRejected,setEmailRejected]=useState(false);
  const [phoneTouched,setPhoneTouched]=useState(false);
  const [emailTouched,setEmailTouched]=useState(false);
  const phone=useRef<HTMLInputElement>(null),email=useRef<HTMLInputElement>(null);
  const inflight=useRef(false);
  const started=useRef(false);
  useEffect(()=>{trackEvent('questionnaire_view',{language:lang});},[]);
  useEffect(()=>{trackEvent('questionnaire_step_view',{step:step==='contact'?1:2,language:lang});},[step]);
  const id=useId();
  const t=(zh:string,en:string,id:string)=>chooseText(lang,zh,en,id);
  const phoneCopy=contactPhoneText(lang),emailCopy=contactEmailText(lang);
  const invalidPhone=phoneRejected||phoneTouched&&!validContactPhone(draft.whatsapp??'');
  const invalidEmail=emailRejected||emailTouched&&!validContactEmail(draft.email??'');
  const optional=t('选填','Optional','Opsional');

  function change(patch:Partial<ChatRegistrationDraft>){
    if(!started.current){
      started.current=true;
      trackEvent('questionnaire_start',{step:step==='contact'?1:2,language:lang});
    }
    const next={...draft,...patch};
    setDraft(next);
    writeChatRegistrationDraft(owner,{...readChatRegistrationDraft(owner),...patch});
  }
  function toggle(field:'goals'|'buyingSignals',value:string){
    const current=draft[field]??[];
    const next=(current as string[]).includes(value)?current.filter(item=>item!==value):[...current,value];
    if(field==='buyingSignals'&&value==='None yet')change({buyingSignals:(next.includes(value)?[value]:[])});
    else change({[field]:field==='buyingSignals'?next.filter(item=>item!=='None yet'):next});
  }
  async function submit(options:RegistrationOptions={}){
    if(inflight.current||owner!==visitorScope())return;
    if(step==='contact'&&!options.queryOnly&&!options.retryOriginal){
      if(!validContactPhone(draft.whatsapp??'')||phoneRejected){setPhoneTouched(true);phone.current?.focus();return;}
      if(!validContactEmail(draft.email??'')||emailRejected){setEmailTouched(true);email.current?.focus();return;}
    }
    inflight.current=true;setSubmitting(true);setError(undefined);
    trackEvent('questionnaire_submit',{step:step==='contact'?1:2,status:'attempt',language:lang});
    try{
      await onComplete(chatRegistrationAnswers(draft,step),lang,options,step);
      setSaveUnknown(false);
      if(step==='contact'){
        const remaining=withoutChatRegistrationContact(readChatRegistrationDraft(owner));
        setDraft(remaining);
        writeChatRegistrationDraft(owner,remaining);
        setStep('preferences');
      }else writeChatRegistrationDraft(owner,{});
    }catch(cause){
      if(cause instanceof Error&&cause.message===CONTACT_PHONE_ERROR){
        setSaveUnknown(false);setPhoneRejected(true);phone.current?.focus();
      }else if(cause instanceof Error&&cause.message===CONTACT_EMAIL_ERROR){
        setSaveUnknown(false);setEmailRejected(true);email.current?.focus();
      }else{
        const status=cause instanceof RegistrationSaveError?cause.state:'unknown';
        setSaveUnknown(status!=='failed');setError(status);
        trackEvent('questionnaire_save_result',{operation:'registration',status});
      }
    }finally{inflight.current=false;setSubmitting(false);}
  }
  function select(field:'reportedLevel'|'currentStatus'|'city'|'mode',label:string){
    return <label className="chat-profile-field">{label}
      <select value={draft[field]??''} onChange={event=>change({[field]:event.target.value||undefined})}>
        <option value="">{t('请选择','Select','Pilih')}</option>
        {questionnaireOptions[field].map((value,index)=><option key={value} value={value}>
          {t(translatedOptions[field][index][0],value,translatedOptions[field][index][1])}
        </option>)}
      </select>
    </label>;
  }
  function choices(field:'goal'|'buyingSignal',label:string){
    const key=field==='goal'?'goals':'buyingSignals';
    return <fieldset className="chat-profile-choices"><legend>{label}</legend>
      {questionnaireOptions[field].map((value,index)=><label key={value}>
        <input type="checkbox" checked={(draft[key] as string[]|undefined)?.includes(value)===true} onChange={()=>toggle(key,value)}/>
        {t(translatedOptions[field][index][0],value,translatedOptions[field][index][1])}
      </label>)}
    </fieldset>;
  }
  const title=step==='contact'?t('留下联系方式','Add contact details','Tambahkan kontak'):t('补充学习资料','Add learning preferences','Tambahkan preferensi belajar');
  const returnLabel=step==='contact'?t('先咨询','Chat first','Konsultasi dulu'):t('以后再补','Add later','Isi nanti');
  const close=()=>onConsultFirst?.(lang);
  const handleSubmit=(event:FormEvent)=>{event.preventDefault();void submit();};
  const hasPreferences=Object.values(withoutChatRegistrationContact(draft)).some(value=>Array.isArray(value)?value.length>0:Boolean(value));

  return <StandaloneChatDialog title={title} closeLabel={t('关闭资料登记','Close registration','Tutup pendaftaran')} onClose={close}
    locked={submitting} wide>
    <div translate="no" lang={lang==='zh'?'zh-CN':lang} className="notranslate chat-profile" data-chat-registration={step}>
      <div className="chat-profile-intro">
        <p>{step==='contact'?t('保存联系方式后可继续咨询。你也可以先提问。','Save your contact details to continue with your profile, or ask a question first.','Simpan kontak untuk melanjutkan profil, atau tanyakan dulu.'):
          t('按需补充，帮助我们给出更合适的建议。','Add anything that would help us tailor our advice.','Tambahkan informasi agar saran kami lebih sesuai.')}</p>
        {step==='contact'&&<div className="chat-profile-languages" aria-label={t('语言','Language','Bahasa')}>
          {(['en','id','zh'] as const).map(value=><button key={value} type="button" onClick={()=>setLang(value)} aria-pressed={lang===value}>
            {value==='zh'?'中文':value.toUpperCase()}
          </button>)}
        </div>}
      </div>
      {(error||saveUnknown)&&<p className="chat-assessment-review" role="status">{registrationSaveText(error??'unknown',lang)}</p>}
      <form onSubmit={handleSubmit}>
        <fieldset disabled={submitting||saveUnknown} className="chat-profile-fields">
          {step==='contact'? <>
            <label className="chat-profile-field">{t('姓名','Full name','Nama lengkap')}
              <input name="fullName" required autoComplete="name" maxLength={200} value={draft.fullName??''} onChange={event=>change({fullName:event.target.value})}/>
            </label>
            <div className="chat-profile-field">
              <label htmlFor={id+'-phone-input'}>{t('WhatsApp 号码','WhatsApp number','Nomor WhatsApp')}</label>
              <ContactPhoneInput id={id+'-phone-input'} language={lang} name="whatsapp" required ref={phone} value={draft.whatsapp??''}
                onBlur={()=>setPhoneTouched(true)} aria-invalid={invalidPhone} aria-describedby={id+'-phone'}
                onValueChange={whatsapp=>{setPhoneRejected(false);change({whatsapp});}}/>
              <small id={id+'-phone'} role={invalidPhone?'alert':undefined}>{invalidPhone?phoneCopy.error:t('可输入本地号码或粘贴完整国际号码。','Enter a local number or paste a full international number.','Masukkan nomor lokal atau tempel nomor internasional lengkap.')}</small>
            </div>
            <label className="chat-profile-field">{t('邮箱','Email','Email')}
              <input name="email" required type="email" ref={email} autoComplete="email" maxLength={254} value={draft.email??''}
                onBlur={()=>setEmailTouched(true)} aria-invalid={invalidEmail} aria-describedby={id+'-email'}
                onChange={event=>{setEmailRejected(false);change({email:event.target.value});}}/>
              <small id={id+'-email'} role={invalidEmail?'alert':undefined}>{invalidEmail?emailCopy.error:emailCopy.help}</small>
            </label>
          </>:<>
            {choices('goal',t('学习目标','Learning goals','Tujuan belajar'))}
            {select('reportedLevel',t('中文基础','Mandarin level','Level Mandarin'))}
            {select('mode',t('上课方式','Class format','Cara belajar'))}
            <details className="chat-profile-extra" open={draft.buyingSignals?.length||draft.city||draft.currentStatus?true:undefined}>
              <summary>{t('更多学习偏好','More preferences','Preferensi tambahan')} <small>{optional}</small></summary>
              {choices('buyingSignal',t('想了解什么？','What would you like to know?','Apa yang ingin Anda ketahui?'))}
              {select('currentStatus',t('当前身份','Current status','Status saat ini'))}
              {draft.currentStatus==='High school student'&&<label className="chat-profile-field">{t('家长联系方式','Parent contact','Kontak orang tua')}
                <input maxLength={160} value={draft.parentContact??''} onChange={event=>change({parentContact:event.target.value})}/></label>}
              {select('city',t('所在城市','City','Kota'))}
              {draft.city==='Other'&&<label className="chat-profile-field">{t('城市名称','City name','Nama kota')}
                <input maxLength={160} value={draft.cityDetail??''} onChange={event=>change({cityDetail:event.target.value})}/></label>}
            </details>
          </>}
        </fieldset>
        <div className="chat-dialog-actions">
          <button type="button" onClick={close} disabled={submitting}>{returnLabel}</button>
          {saveUnknown?<><button type="button" disabled={submitting} onClick={()=>void submit({queryOnly:true})}>{t('核对保存结果','Check save result','Periksa hasil simpan')}</button>
            {pendingRegistrationDraft(owner)&&<button type="button" className="chat-primary" disabled={submitting} onClick={()=>void submit({retryOriginal:true})}>{t('重试原提交','Retry original submission','Coba kembali kiriman awal')}</button>}</>:
            <button className="chat-primary" type="submit" disabled={submitting||step==='preferences'&&!hasPreferences}>
              {submitting?t('保存中…','Saving…','Menyimpan…'):step==='contact'?t('保存联系方式','Save contact details','Simpan kontak'):
                t('保存学习资料','Save learning preferences','Simpan preferensi')}
            </button>}
        </div>
      </form>
    </div>
  </StandaloneChatDialog>;
}
