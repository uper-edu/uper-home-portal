import {useEnrollmentPhoneField} from '../useEnrollmentPhoneField';
import * as phoneValidation from '../../utils/contactPhone';
import {AdminCopyAction} from '../admin/AdminRecordActions';
import {useEffect,useState} from 'react';
import {AdminField,AdminForm,AdminRequiredNote} from '../AdminForm';
import {AdminFormActions,AdminFormFeedback,AdminFormGrid,type AdminFeedbackState} from '../AdminFormLayout';
import {enrollmentCopy,type PublicEnrollmentClass} from '../../utils/enrollmentCatalog';
import {enrollmentPost} from '../../services/enrollmentSession';
import {CrmOperationLayer} from './CrmOperationLayer';
import { AdminDiscardDialog } from '../admin/AdminDiscardDialog';
import {AdminSingleSelect} from '../admin/AdminSingleSelect';
import {interestOption} from '../../utils/enrollmentInterestCopy';
import {formatCrmEventTime} from '../../utils/crmOperatingTime';
import {formatCurrency} from '../../utils/currency';
import type {CrmLanguage} from '../../utils/crmLanguage';
import {canRetryEnrollmentAssistanceMail,type EnrollmentAssistanceMail} from '../../utils/enrollmentAssistance';

export type AssistanceResult={id:string;expiresAt:string;lang:string;confirmationUrl?:string;mail?:EnrollmentAssistanceMail};
const mailLabels={
  simulated:['确认邮件已模拟发送','Confirmation email simulated','Email konfirmasi disimulasikan'],
  accepted:['SMTP 已接收确认邮件，无需重发。','SMTP accepted the confirmation email. No resend needed.','Email konfirmasi telah diterima SMTP. Tidak perlu dikirim ulang.'],
  queued:['确认邮件正在排队投递。','Confirmation email is queued for delivery.','Email konfirmasi dalam antrean pengiriman.'],
  unknown:['确认邮件投递结果待确认。','Confirmation email delivery is unconfirmed.','Hasil pengiriman email konfirmasi belum pasti.'],
  failed:['确认邮件发送失败。','Confirmation email failed to send.','Pengiriman email konfirmasi gagal.'],
  cancelled:['确认邮件投递已取消。','Confirmation email delivery was cancelled.','Pengiriman email konfirmasi dibatalkan.'],
} as const satisfies Record<EnrollmentAssistanceMail['state'],readonly [string,string,string]>;
export const assistanceMailLabel=(lang:CrmLanguage,mail?:EnrollmentAssistanceMail)=>enrollmentCopy(lang,
  (mail&&mailLabels[mail.state])??['暂无确认邮件投递记录。','No confirmation email delivery record yet.','Belum ada catatan pengiriman email konfirmasi.']);

export function CrmEnrollmentAssistance({opportunityId,level,customerName,contacts,lang,isLight,onDone,onClose,initial}:{
  opportunityId:string;level:string;customerName:string;contacts:{email:string;phone:string};
  lang:CrmLanguage;isLight:boolean;onDone:()=>void;onClose:()=>void;initial?:AssistanceResult;
}){
  const t=(zh:string,en:string,id:string)=>enrollmentCopy(lang,[zh,en,id]);
  const [classes,setClasses]=useState<PublicEnrollmentClass[]>();
  const [classId,setClassId]=useState('');
  const [phone,setPhone]=useState(contacts.phone);
  const phoneField=useEnrollmentPhoneField(lang,phone,phoneValidation);
  const [result,setResult]=useState(initial);
  const [requestId]=useState(()=>crypto.randomUUID());
  const [busy,setBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [discard,setDiscard]=useState(false);
  const [needsMailCheck,setNeedsMailCheck]=useState(false);
  const [mailRetryAllowed,setMailRetryAllowed]=useState(true);
  const [feedback,setFeedback]=useState<{state:AdminFeedbackState;message:string}>();
  const endpoint='/api/crm/opportunities/'+encodeURIComponent(opportunityId)+'/enrollment-assistance';
  useEffect(()=>{
    if(initial)return;
    const controller=new AbortController();
    void fetch('/api/enrollment/classes',{cache:'no-store',signal:controller.signal}).then(async response=>{
      if(!response.ok)throw Error();
      const data=await response.json();
      if(!controller.signal.aborted)setClasses(data.classes.filter((row:PublicEnrollmentClass)=>row.level===level&&row.availability!=='full'));
    }).catch(()=>{if(!controller.signal.aborted)setFeedback({state:'error',message:t('暂时无法读取可报名班次。','Available classes could not be loaded.','Kelas yang tersedia belum dapat dimuat.')});});
    return ()=>controller.abort();
  },[level,initial]);
  const close=()=>{if(!busy){if(dirty)setDiscard(true);else onClose();}};
  const chosen=classes?.find(row=>row.id===classId);
  const link=result?.confirmationUrl;
  const canRetryMail=mailRetryAllowed&&!needsMailCheck&&canRetryEnrollmentAssistanceMail(result?.mail);
  const canCheckMail=needsMailCheck||!result?.mail||result.mail.state==='queued'||result.mail.state==='unknown';
  const messageLanguage=result?.lang==='zh'||result?.lang==='id'?result.lang:'en';
  const message=enrollmentCopy(messageLanguage,[
    `你好，UPER 已协助提交你的 ${level} 报名申请。请打开链接，核对班次和学费后确认报名：`,
    `Hi, UPER has submitted your ${level} application. Open this link to review the class and fee, then confirm:`,
    `Halo, UPER telah membantu mengajukan pendaftaran ${level}. Buka tautan ini untuk memeriksa kelas dan biaya, lalu konfirmasi:`,
  ])+'\n'+link;
  async function retry(){
    if(!result||busy||!canRetryMail)return;
    setBusy(true);
    setFeedback({state:'saving',message:t('正在重发确认邮件…','Retrying confirmation email…','Mengirim ulang email konfirmasi…')});
    try{
      const {mail}=await enrollmentPost(endpoint+'/'+result.id+'/retry',{previousAttempt:result.mail?.id??null});
      setResult({...result,mail});
      setFeedback(mail?.state==='failed'?{state:'error',message:t('最新投递记录仍显示发送失败，可以重试。',
        'The latest delivery record still shows a failure. You can retry.','Catatan pengiriman terbaru masih menunjukkan kegagalan. Anda dapat mencoba lagi.')}:undefined);
      onDone();
    }catch{
      setNeedsMailCheck(true);
      setFeedback({state:'unknown',message:t('发送结果待确认，请先查询原申请。','Check the original application before attempting another send.','Periksa pengajuan awal sebelum mengirim ulang.')});
    }finally{setBusy(false);}
  }
  async function checkMail(){
    if(!result||busy||!canCheckMail)return;
    setBusy(true);
    setFeedback({state:'saving',message:t('正在查询邮件投递结果…','Checking email delivery…','Memeriksa hasil pengiriman email…')});
    try{
      const response=await fetch('/api/crm/opportunities/'+encodeURIComponent(opportunityId),{cache:'no-store'});
      if(!response.ok)throw Error();
      const detail=await response.json();
      const application=detail.assistanceHistory;
      if(application?.id!==result.id)throw Error();
      setResult({...result,mail:application.mail,confirmationUrl:application.confirmationUrl});
      const eligible=Boolean(Number(application.active)&&!application.orderId&&detail.assistance?.allowed);
      setMailRetryAllowed(eligible);
      setNeedsMailCheck(false);setFeedback(undefined);onDone();
    }catch{
      setFeedback({state:'unknown',message:t('暂时无法查询原申请，请稍后核对。','The original application is unavailable. Try checking again later.','Pengajuan awal belum dapat diperiksa. Coba lagi nanti.')});
    }finally{setBusy(false);}
  }
  return <>
    <CrmOperationLayer compose customerContext={false}
      title={result?t('报名确认链接','Enrollment confirmation link','Tautan konfirmasi pendaftaran'):
        <>{t('协助报名','Assist enrollment','Bantu pendaftaran')} <AdminRequiredNote inline lang={lang}/></>}
      context={customerName+' · '+level} lang={lang} isLight={isLight} onClose={close} busy={busy}>
      {result?<div className="crm-editor-compose crm-course-editor">
        <div className="crm-editor-scroll">
          <p>{t('待学员确认','Awaiting learner confirmation','Menunggu konfirmasi siswa')}
            {!needsMailCheck&&<> · <span role="status">{assistanceMailLabel(lang,result.mail)}</span></>}
          </p>
          {feedback&&<AdminFormFeedback state={feedback.state} lang={lang}>{feedback.message}</AdminFormFeedback>}
          {link&&<div className="admin-copy-field">
              <AdminField>{t('报名确认链接','Enrollment confirmation link','Tautan konfirmasi pendaftaran')}
                <input readOnly value={link} onFocus={event=>event.currentTarget.select()}/>
              </AdminField>
              <AdminCopyAction label={t('复制链接','Copy link','Salin tautan')} value={link} lang={lang}/>
          </div>}
          <p>{t('链接有效至','Link expires','Tautan berlaku hingga')} · {formatCrmEventTime(result.expiresAt).slice(0,16)}</p>
          {link?<div className="admin-copy-field">
            <AdminField>{t('WhatsApp 文案','WhatsApp message','Pesan WhatsApp')}
              <textarea readOnly rows={4} aria-label={t('WhatsApp 文案','WhatsApp message','Pesan WhatsApp')}
                value={message} onFocus={event=>event.currentTarget.select()}/>
            </AdminField>
            <AdminCopyAction label={t('复制 WhatsApp 文案','Copy WhatsApp message','Salin pesan WhatsApp')} value={message} lang={lang}/>
          </div>:<p role="status">{t('公开报名地址尚未就绪，暂时无法复制确认链接。',
            'The public enrollment address is unavailable. The confirmation link cannot be copied yet.',
            'Alamat pendaftaran publik belum tersedia. Tautan konfirmasi belum dapat disalin.')}</p>}
        </div>
        <AdminFormActions className="crm-editor-actions">
          <button type="button" className="crm-work-button" disabled={busy} onClick={onClose}>{t('关闭','Close','Tutup')}</button>
          {canCheckMail&&<button type="button" className="crm-work-button" disabled={busy} onClick={()=>void checkMail()}>
            {t('查询发送结果','Check delivery result','Periksa hasil pengiriman')}</button>}
          {canRetryMail&&<button type="button" className="crm-work-button" disabled={busy} onClick={()=>void retry()}>
            {t('重发确认邮件','Retry confirmation email','Kirim ulang email konfirmasi')}</button>}
        </AdminFormActions>
      </div>:<AdminForm lang={lang} className="crm-editor-compose crm-course-editor" onChange={()=>setDirty(true)} onSubmit={async event=>{
        event.preventDefault();if(busy||!classId||!phoneField.check())return;
        const data=new FormData(event.currentTarget);
        setBusy(true);setFeedback(undefined);
        try{
          const saved=await enrollmentPost(endpoint,{
            requestId,lang,classId,name:data.get('name'),email:data.get('email'),phone:data.get('phone'),
          });
          setResult(saved);
          setDirty(false);onDone();
        }catch(cause){
          const identityMismatch=(cause as Error).message==='enrollment_assistance_identity';
          setFeedback({state:identityMismatch?'error':'unknown',message:identityMismatch?
            t('资料与当前客户不一致或关联到其他客户，请先核实身份。','The details do not match this customer or match another record. Review their identity first.','Data tidak cocok atau terkait dengan pelanggan lain. Verifikasi identitas terlebih dahulu.'):
            t('未能确认提交结果。请核对班次余位和商机状态后重试。','Submission could not be confirmed. Check class availability and the opportunity before retrying.','Pengajuan belum dapat dikonfirmasi. Periksa kursi dan status peluang sebelum mencoba lagi.')});
        }finally{setBusy(false);}
      }}>
        <div className="crm-editor-scroll">
          {busy&&<AdminFormFeedback state="saving" lang={lang}/>}
          {feedback&&<AdminFormFeedback state={feedback.state} lang={lang}>{feedback.message}</AdminFormFeedback>}
          {classes?.length===0&&<p>{t('该级别暂无可报名班次。','No classes are available for this level.','Belum ada kelas untuk level ini.')}</p>}
          <AdminField required>{t('班次','Class','Kelas')}
            <AdminSingleSelect required lang={lang} isLight={isLight} label={t('班次','Class','Kelas')} value={classId}
              onChange={value=>{setClassId(value);setDirty(true);}} options={(classes??[]).map(row=>({value:row.id,
                label:[row.level,interestOption(lang,row.period),interestOption(lang,row.format),row.firstLesson.replace('T',' ')+' WIB'].join(' · ')}))}/>
          </AdminField>
          {chosen&&<p>{chosen.schedule} · {formatCurrency(chosen.price,lang)}</p>}
          <AdminField required>{t('学员姓名','Learner name','Nama siswa')}<input name="name" defaultValue={customerName} maxLength={120} required/></AdminField>
          <AdminFormGrid>
            <AdminField required>{t('电子邮箱','Email address','Alamat email')}<input name="email" defaultValue={contacts.email} type="email" maxLength={254} required/></AdminField>
            <AdminField required>{t('WhatsApp／手机号','WhatsApp or phone','WhatsApp atau nomor HP')}<input name="phone" value={phone} onChange={event=>setPhone(event.target.value)} {...phoneField.inputProps} type="tel" required/>
              {phoneField.error&&<small className="admin-required-error" role="alert" id={phoneField.errorId}>{phoneField.error}</small>}
            </AdminField>
          </AdminFormGrid>
          <p>{t('提交后，系统会发送确认邮件。学员确认并取得席位后才开始付款计时。','We email the learner to confirm. Payment time starts when they confirm and receive a seat.','Email konfirmasi akan dikirim. Waktu pembayaran dimulai setelah siswa mengonfirmasi dan mendapat kursi.')}</p>
          <p>{t('新申请会关闭此商机原先尚未确认的申请。','A new application closes any previous unconfirmed application for this opportunity.','Pengajuan baru menutup pengajuan sebelumnya yang belum dikonfirmasi.')}</p>
        </div>
        <AdminFormActions className="crm-editor-actions">
          <button type="button" className="crm-work-button" disabled={busy} onClick={close}>{t('取消','Cancel','Batal')}</button>
          <button type="submit" className="crm-work-button" data-primary disabled={busy||!classId}>{t('提交协助报名','Submit assisted application','Ajukan pendaftaran berbantuan')}</button>
        </AdminFormActions>
      </AdminForm>}
    </CrmOperationLayer>
    {discard&&<AdminDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)} onDiscard={onClose}/>}
  </>;
}
