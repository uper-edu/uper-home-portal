import {useEffect,useState} from 'react';
import {AdminField,AdminForm,AdminRequiredNote} from '../AdminForm';
import {AdminFormActions} from '../AdminFormLayout';
import {enrollmentCopy,enrollmentPost} from '../EnrollmentApplication';
import {CrmOperationLayer} from './CrmOperationLayer';
import {CrmDiscardDialog} from './CrmDetailWorkspace';
import {CrmSingleSelect} from './CrmSingleSelect';
import {interestOption} from '../EnrollmentInterests';
import {formatCrmEventTime} from '../../utils/crmOperatingTime';
import {formatCurrency} from '../../utils/currency';
import type {CrmLanguage} from '../../utils/crmLanguage';
import type {PublicEnrollmentClass} from '../../utils/enrollmentCatalog';

export function CrmEnrollmentAssistance({opportunityId,level,customerName,contacts,lang,isLight,onDone,onClose}:{
  opportunityId:string;level:string;customerName:string;contacts:{email:string;phone:string};
  lang:CrmLanguage;isLight:boolean;onDone:()=>void;onClose:()=>void;
}){
  const t=(zh:string,en:string,id:string)=>enrollmentCopy(lang,[zh,en,id]);
  const [classes,setClasses]=useState<PublicEnrollmentClass[]>();
  const [classId,setClassId]=useState('');
  const [result,setResult]=useState<{link:string;expiresAt:string}>();
  const [copied,setCopied]=useState(false);
  const [busy,setBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [discard,setDiscard]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    void fetch('/api/enrollment/classes',{cache:'no-store',signal:controller.signal}).then(async response=>{
      if(!response.ok)throw Error();
      const data=await response.json();
      if(!controller.signal.aborted)setClasses(data.classes.filter((row:PublicEnrollmentClass)=>row.level===level&&row.availability!=='full'));
    }).catch(()=>{if(!controller.signal.aborted)setError(t('暂时无法读取可报名班次。','Available classes could not be loaded.','Kelas yang tersedia belum dapat dimuat.'));});
    return ()=>controller.abort();
  },[level]);
  const close=()=>{if(!busy){if(dirty)setDiscard(true);else onClose();}};
  const chosen=classes?.find(row=>row.id===classId);
  return <>
    <CrmOperationLayer compose customerContext={false}
      title={result?t('报名确认链接','Enrollment confirmation link','Tautan konfirmasi pendaftaran'):
        <>{t('协助报名','Assist enrollment','Bantu pendaftaran')} <AdminRequiredNote inline lang={lang}/></>}
      context={customerName+' · '+level} lang={lang} isLight={isLight} onClose={close} busy={busy}>
      {result?<div className="crm-editor-compose crm-course-editor">
        <div className="crm-editor-scroll">
          <p>{t('把此链接发给学员。学员验证邮箱、确认班次和费用后，系统才会分配席位。','Share this link with the learner. A seat is allocated after they verify their email and confirm the class and fee.','Bagikan tautan ini. Kursi dialokasikan setelah siswa memverifikasi email dan mengonfirmasi kelas serta biaya.')}</p>
          <AdminField>{t('报名确认链接','Enrollment confirmation link','Tautan konfirmasi pendaftaran')}
            <input readOnly value={result.link} onFocus={event=>event.currentTarget.select()}/>
          </AdminField>
          <p>{t('链接有效至','Link expires','Tautan berlaku hingga')} · {formatCrmEventTime(result.expiresAt).slice(0,16)}</p>
          {copied&&<span role="status">{t('已复制链接。','Link copied.','Tautan disalin.')}</span>}
        </div>
        <AdminFormActions className="crm-editor-actions">
          <button type="button" className="crm-work-button" onClick={onClose}>{t('关闭','Close','Tutup')}</button>
          <button type="button" className="crm-work-button" data-primary onClick={()=>void navigator.clipboard.writeText(result.link).then(()=>setCopied(true)).catch(()=>setCopied(false))}>
            {t('复制链接','Copy link','Salin tautan')}</button>
        </AdminFormActions>
      </div>:<AdminForm lang={lang} className="crm-editor-compose crm-course-editor" onChange={()=>setDirty(true)} onSubmit={async event=>{
        event.preventDefault();if(busy||!classId)return;
        const data=new FormData(event.currentTarget);
        const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
        setBusy(true);setError('');
        try{
          const saved=await enrollmentPost('/api/crm/opportunities/'+encodeURIComponent(opportunityId)+'/enrollment-assistance',{
            requestId:crypto.randomUUID(),token,lang,classId,name:data.get('name'),email:data.get('email'),phone:data.get('phone'),
          });
          setResult({link:window.location.origin+'/enrollment/assist?lang='+lang+'#t='+token,expiresAt:saved.expiresAt});
          setDirty(false);onDone();
        }catch(cause){
          setError((cause as Error).message==='enrollment_assistance_identity'?
            t('资料与当前客户不一致或关联到其他客户，请先核实身份。','The details do not match this customer or match another record. Review their identity first.','Data tidak cocok atau terkait dengan pelanggan lain. Verifikasi identitas terlebih dahulu.'):
            t('未能生成链接，请核对班次余位和商机状态后重试。','The link could not be created. Check class availability and the opportunity before retrying.','Tautan belum dibuat. Periksa kursi dan status peluang sebelum mencoba lagi.'));
        }finally{setBusy(false);}
      }}>
        <div className="crm-editor-scroll">
          {error&&<p role="alert">{error}</p>}
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
          <p>{t('生成新链接会关闭这个商机此前尚未确认的链接。','A new link closes any unconfirmed link for this opportunity.','Tautan baru menutup tautan peluang ini yang belum dikonfirmasi.')}</p>
        </div>
        <AdminFormActions className="crm-editor-actions">
          <button type="button" className="crm-work-button" onClick={close}>{t('取消','Cancel','Batal')}</button>
          <button type="submit" className="crm-work-button" data-primary disabled={busy||!classId}>{t('生成确认链接','Create confirmation link','Buat tautan konfirmasi')}</button>
        </AdminFormActions>
      </AdminForm>}
    </CrmOperationLayer>
    {discard&&<CrmDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)} onDiscard={onClose}/>}
  </>;
}
