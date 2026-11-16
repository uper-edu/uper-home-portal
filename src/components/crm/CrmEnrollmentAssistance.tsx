import {AdminCopyAction} from '../admin/AdminRecordActions';
import {useEffect,useState} from 'react';
import {AdminField,AdminForm,AdminRequiredNote} from '../AdminForm';
import {AdminFormActions,AdminFormFeedback,type AdminFeedbackState} from '../AdminFormLayout';
import {enrollmentCopy,enrollmentPost} from '../EnrollmentApplication';
import {CrmOperationLayer} from './CrmOperationLayer';
import {CrmDiscardDialog} from './CrmDetailWorkspace';
import {CrmSingleSelect} from './CrmSingleSelect';
import {interestOption} from '../EnrollmentInterests';
import {formatCrmEventTime} from '../../utils/crmOperatingTime';
import {formatCurrency} from '../../utils/currency';
import type {CrmLanguage} from '../../utils/crmLanguage';
import type {PublicEnrollmentClass} from '../../utils/enrollmentCatalog';
import {enrollmentAssistancePath,enrollmentPreviewOrigin,type EnrollmentAssistanceMail} from '../../utils/enrollmentAssistance';

export type AssistanceResult={id:string;expiresAt:string;lang:string;mail?:EnrollmentAssistanceMail};
export const assistanceMailLabel=(lang:CrmLanguage,mail?:EnrollmentAssistanceMail)=>enrollmentCopy(lang,
  mail?.state==='simulated'?['确认邮件已模拟发送','Confirmation email simulated','Email konfirmasi disimulasikan']:
    mail?.state==='failed'?['确认邮件发送失败','Confirmation email failed','Email konfirmasi gagal']:
      ['确认邮件未发送','Confirmation email not sent','Email konfirmasi belum dikirim']);

export function CrmEnrollmentAssistance({opportunityId,level,customerName,contacts,lang,isLight,onDone,onClose,initial}:{
  opportunityId:string;level:string;customerName:string;contacts:{email:string;phone:string};
  lang:CrmLanguage;isLight:boolean;onDone:()=>void;onClose:()=>void;initial?:AssistanceResult;
}){
  const t=(zh:string,en:string,id:string)=>enrollmentCopy(lang,[zh,en,id]);
  const [classes,setClasses]=useState<PublicEnrollmentClass[]>();
  const [classId,setClassId]=useState('');
  const [result,setResult]=useState(initial);
  const [requestId]=useState(()=>crypto.randomUUID());
  const [busy,setBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [discard,setDiscard]=useState(false);
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
  const link=result?enrollmentPreviewOrigin+enrollmentAssistancePath(result.id,result.lang):'';
  const messageLanguage=result?.lang==='zh'||result?.lang==='id'?result.lang:'en';
  const message=enrollmentCopy(messageLanguage,[
    `你好，UPER 已协助提交你的 ${level} 报名申请。请打开链接，核对班次和学费后确认报名：`,
    `Hi, UPER has submitted your ${level} application. Open this link to review the class and fee, then confirm:`,
    `Halo, UPER telah membantu mengajukan pendaftaran ${level}. Buka tautan ini untuk memeriksa kelas dan biaya, lalu konfirmasi:`,
  ])+'\n'+link;
  async function retry(){
    if(!result||busy)return;
    setBusy(true);setFeedback(undefined);
    try{
      const {mail}=await enrollmentPost(endpoint+'/'+result.id+'/retry',{previousAttempt:result.mail?.id??null});
      setResult({...result,mail});onDone();
    }catch{
      setFeedback({state:'unknown',message:t('暂时无法核对发送结果。请刷新商机后再试。','Check the opportunity for delivery status before retrying.','Muat ulang peluang untuk memeriksa status pengiriman sebelum mencoba lagi.')});
    }finally{setBusy(false);}
  }
  return <>
    <CrmOperationLayer compose customerContext={false}
      title={result?t('报名确认链接','Enrollment confirmation link','Tautan konfirmasi pendaftaran'):
        <>{t('协助报名','Assist enrollment','Bantu pendaftaran')} <AdminRequiredNote inline lang={lang}/></>}
      context={customerName+' · '+level} lang={lang} isLight={isLight} onClose={close} busy={busy}>
      {result?<div className="crm-editor-compose crm-course-editor">
        <div className="crm-editor-scroll">
          <p>{t('待学员确认','Awaiting learner confirmation','Menunggu konfirmasi siswa')} · <span role="status">{assistanceMailLabel(lang,result.mail)}</span></p>
          {feedback&&<AdminFormFeedback state={feedback.state} lang={lang}>{feedback.message}</AdminFormFeedback>}
          <div className="admin-copy-field">
            <AdminField>{t('报名确认链接','Enrollment confirmation link','Tautan konfirmasi pendaftaran')}
              <input readOnly value={link} onFocus={event=>event.currentTarget.select()}/>
            </AdminField>
            <AdminCopyAction label={t('复制链接','Copy link','Salin tautan')} value={link} lang={lang}/>
          </div>
          <p>{t('链接有效至','Link expires','Tautan berlaku hingga')} · {formatCrmEventTime(result.expiresAt).slice(0,16)}</p>
          <div className="admin-copy-field">
            <AdminField>{t('WhatsApp 文案','WhatsApp message','Pesan WhatsApp')}
              <textarea readOnly rows={4} aria-label={t('WhatsApp 文案','WhatsApp message','Pesan WhatsApp')}
                value={message} onFocus={event=>event.currentTarget.select()}/>
            </AdminField>
            <AdminCopyAction label={t('复制 WhatsApp 文案','Copy WhatsApp message','Salin pesan WhatsApp')} value={message} lang={lang}/>
          </div>
        </div>
        <AdminFormActions className="crm-editor-actions">
          <button type="button" className="crm-work-button" disabled={busy} onClick={onClose}>{t('关闭','Close','Tutup')}</button>
          {result.mail?.state!=='simulated'&&<button type="button" className="crm-work-button" disabled={busy} onClick={()=>void retry()}>
            {t('重发确认邮件','Retry confirmation email','Kirim ulang email konfirmasi')}</button>}
        </AdminFormActions>
      </div>:<AdminForm lang={lang} className="crm-editor-compose crm-course-editor" onChange={()=>setDirty(true)} onSubmit={async event=>{
        event.preventDefault();if(busy||!classId)return;
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
            <CrmSingleSelect required lang={lang} isLight={isLight} label={t('班次','Class','Kelas')} value={classId}
              onChange={value=>{setClassId(value);setDirty(true);}} options={(classes??[]).map(row=>({value:row.id,
                label:[row.level,interestOption(lang,row.period),interestOption(lang,row.format),row.firstLesson.replace('T',' ')+' WIB'].join(' · ')}))}/>
          </AdminField>
          {chosen&&<p>{chosen.schedule} · {formatCurrency(chosen.price,lang)}</p>}
          <AdminField required>{t('学员姓名','Learner name','Nama siswa')}<input name="name" defaultValue={customerName} maxLength={120} required/></AdminField>
          <AdminField required>{t('电子邮箱','Email address','Alamat email')}<input name="email" defaultValue={contacts.email} type="email" maxLength={254} required/></AdminField>
          <AdminField required>{t('WhatsApp／手机号','WhatsApp or phone','WhatsApp atau nomor HP')}<input name="phone" defaultValue={contacts.phone} type="tel" required/></AdminField>
          <p>{t('提交后，系统会发送确认邮件。学员确认并取得席位后才开始付款计时。','We email the learner to confirm. Payment time starts when they confirm and receive a seat.','Email konfirmasi akan dikirim. Waktu pembayaran dimulai setelah siswa mengonfirmasi dan mendapat kursi.')}</p>
          <p>{t('新申请会关闭此商机原先尚未确认的申请。','A new application closes any previous unconfirmed application for this opportunity.','Pengajuan baru menutup pengajuan sebelumnya yang belum dikonfirmasi.')}</p>
        </div>
        <AdminFormActions className="crm-editor-actions">
          <button type="button" className="crm-work-button" disabled={busy} onClick={close}>{t('取消','Cancel','Batal')}</button>
          <button type="submit" className="crm-work-button" data-primary disabled={busy||!classId}>{t('提交协助报名','Submit assisted application','Ajukan pendaftaran berbantuan')}</button>
        </AdminFormActions>
      </AdminForm>}
    </CrmOperationLayer>
    {discard&&<CrmDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)} onDiscard={onClose}/>}
  </>;
}
