import {Info,LockKeyhole} from 'lucide-react';
import {AdminFormSection,AdminFormActions,AdminFormFeedback} from './AdminFormLayout';
import './admin-form.css';
import './admin-form-layout.css';
import {CrmSingleSelect} from './crm/CrmSingleSelect';
import './crm/crm-lead-filters.css';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {personalNotificationTypes,personalNotificationCategory,normalizePersonalPreferences,type PersonalNotificationPreferences} from '../utils/personalNotificationPreferences';
import type {CrmLanguage} from '../utils/crmLanguage';
const same=(a:PersonalNotificationPreferences,b:PersonalNotificationPreferences)=>a.language===b.language&&JSON.stringify(a.disabledTypes)===JSON.stringify(b.disabledTypes);
export function PersonalNotificationPreferencesForm({initial,systemTypes,visibleTypes,deliveryEnabled,bound,lang,isLight,onDirty,onBusy,onCancel,header}:{initial:PersonalNotificationPreferences;systemTypes:string[];visibleTypes:string[];deliveryEnabled:boolean;bound:boolean;lang:CrmLanguage;isLight:boolean;onDirty:(v:boolean)=>void;onBusy:(v:boolean)=>void;onCancel:()=>void;header?:ReactNode}){
 const t=(zh:string,en:string,id:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const [draft,setDraft]=useState(()=>normalizePersonalPreferences(initial)),[saved,setSaved]=useState(()=>normalizePersonalPreferences(initial)),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState(''),[conflict,setConflict]=useState(false),[unknown,setUnknown]=useState(false);
 const dirty=!same(draft,saved),current=useRef(draft);current.current=draft;
 const canEdit=bound&&deliveryEnabled&&systemTypes.length>0&&visibleTypes.length>0;
 useEffect(()=>{onDirty(dirty);},[dirty,onDirty]);
 const edit=(value:PersonalNotificationPreferences)=>{setDraft(value);onDirty(!same(value,saved));setFeedback('');};
 const action=async(save:boolean)=>{
  setBusy(true);onBusy(true);setFeedback('');
  try{
   let value:PersonalNotificationPreferences;
   if(save){
    const r=await fetch('/api/crm/lark/preferences',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
    if(!r.ok){if(r.status>=400&&r.status<500){const code=(await r.json()).error;setConflict(true);setUnknown(false);setFeedback(code==='notification_preferences_conflict'?t('通知设置已在其他窗口修改。你的修改已保留，请重新打开后核对。','Settings changed. Your draft is retained; close and reopen to review.','Pengaturan berubah. Draf disimpan; tutup dan buka kembali untuk memeriksa.'):t('可接收的通知已调整，本次修改未保存。请重新打开通知设置后再试。','Notification availability changed; your changes were not saved. Close and reopen to review.','Ketersediaan notifikasi berubah; perubahan belum tersimpan. Tutup dan buka kembali.'));return;}throw Error('save');}
    value=normalizePersonalPreferences((await r.json()).preferences);
   }else{const r=await fetch('/api/crm/lark/me',{cache:'no-store'});if(!r.ok)throw Error('read');value=normalizePersonalPreferences((await r.json()).preferences);}
   setSaved(value);setUnknown(false);
   if(same(current.current,value)){setDraft(value);setConflict(false);setFeedback(t('通知偏好已保存。','Notification preferences saved.','Preferensi notifikasi tersimpan.'));}
   else{setConflict(value.revision!==saved.revision);setFeedback(t('已检查保存结果，你的修改仍保留在表单中。','Saved result checked; your draft was retained.','Hasil tersimpan diperiksa; draf tetap disimpan.'));}
  }catch{setUnknown(true);setFeedback(t('暂时无法确认是否保存成功。修改已保留，请先检查结果，避免重复保存。','We could not confirm whether your changes were saved. Your changes are retained; check the result before saving again.','Belum dapat memastikan perubahan tersimpan. Perubahan tetap disimpan di formulir; periksa hasil sebelum menyimpan ulang.'));}
  finally{setBusy(false);onBusy(false);}
 };
 const related=personalNotificationTypes.filter(([key])=>visibleTypes.includes(key));
 const renderType=([key,zh,en,id]:typeof personalNotificationTypes[number],inactive=false)=>{
  const optional=personalNotificationCategory(key)==='optional';
  if(optional&&inactive)return <div key={key} className="admin-personal-type" data-unavailable="true"><span><strong>{t(zh,en,id)}</strong></span><small>{t('暂未开放','Not yet available','Belum tersedia')}</small></div>;
  if(optional)return <label key={key} className="admin-personal-type"><input type="checkbox" role="switch" disabled={busy||!canEdit} checked={!draft.disabledTypes.includes(key)} onChange={e=>edit({...draft,disabledTypes:personalNotificationTypes.map(v=>v[0]).filter(v=>personalNotificationCategory(v)==='optional'&&(v===key?!e.target.checked:draft.disabledTypes.includes(v)))})}/><span><strong>{t(zh,en,id)}</strong></span></label>;
  return <div key={key} className="admin-personal-required-row" data-unavailable={inactive}><span>{t(zh,en,id)}</span><small>{inactive?t('暂未开放','Not yet available','Belum tersedia'):t('必须接收','Required','Wajib')}</small></div>;
 };
 const displayOrder=['handoff.requested','task.overdue','booking.requested','enrollment.requested','commitment.due','ai.failed'];
 const required=related.filter(([key])=>personalNotificationCategory(key)!=='optional').sort((a,b)=>displayOrder.indexOf(a[0])-displayOrder.indexOf(b[0])),optional=related.filter(([key])=>personalNotificationCategory(key)==='optional');
 return <>
 <div className="admin-personal-settings-scroll">{header}
 <section className="admin-personal-preferences" aria-label={t('个人通知偏好','Personal notification preferences','Preferensi notifikasi pribadi')}>
 {(!deliveryEnabled||!bound)&&<div className="admin-personal-availability" role="note"><Info size={18} aria-hidden="true"/><div><strong>{!deliveryEnabled?t('个人通知暂未开放','Personal notifications are not yet available','Notifikasi pribadi belum tersedia'):t('请先绑定Lark','Connect Lark first','Hubungkan Lark terlebih dahulu')}</strong><p>{!deliveryEnabled?t('Lark账号仍可管理，接收偏好将在开放后可修改。','You can still manage your Lark account. Delivery preferences will become editable when available.','Akun Lark tetap dapat dikelola. Preferensi penerimaan dapat diubah setelah tersedia.'):t('绑定后，可选择与你工作相关的通知。','Once connected, choose notifications related to your work.','Setelah terhubung, pilih notifikasi terkait pekerjaan Anda.')}</p></div></div>}
 {related.length>0?<div className="admin-personal-language"><span>{t('通知语言','Notification language','Bahasa notifikasi')}</span><CrmSingleSelect label={t('通知语言','Notification language','Bahasa notifikasi')} value={draft.language} options={[{value:'rule',label:t('跟随公司设置','Organization default','Ikuti pengaturan perusahaan')},{value:'en',label:'English'},{value:'id',label:'Bahasa Indonesia'},{value:'zh',label:'中文'}]} disabled={busy||!canEdit} lang={lang} isLight={isLight} onChange={language=>edit({...draft,language:language as PersonalNotificationPreferences['language']})}/></div>:<p>{t('目前没有需要你接收的个人业务通知。','No personal business notifications apply to your current responsibilities.','Tidak ada notifikasi bisnis pribadi untuk tanggung jawab Anda saat ini.')}</p>}
 {required.length>0&&<AdminFormSection variant="subgroup" className="admin-personal-notification-group" title={t('系统提醒','System reminders','Pengingat sistem')} actions={<span className="admin-personal-managed"><LockKeyhole size={13} aria-hidden="true"/>{t('不可关闭','Always on','Tidak dapat dinonaktifkan')}</span>}><ul className="admin-personal-required-list">{required.map(([key,zh,en,id])=><li key={key}><span>{t(zh,en,id)}</span>{!systemTypes.includes(key)&&<small>{t('暂未开放','Not yet available','Belum tersedia')}</small>}</li>)}</ul></AdminFormSection>}
 {optional.length>0&&<AdminFormSection variant="subgroup" className="admin-personal-notification-group" title={t('可选动态','Optional updates','Pembaruan opsional')}><div className="admin-personal-type-list">{optional.map(row=>renderType(row,!systemTypes.includes(row[0])))}</div></AdminFormSection>}


 <details className="admin-personal-about"><summary>{t('通知范围说明','About notification scope','Tentang cakupan notifikasi')}</summary><p>{t('每日汇总通过群消息发送。系统提醒由公司统一安排。','Daily summaries are sent to groups. System reminders are managed by your organization.','Ringkasan harian dikirim ke grup. Pengingat sistem diatur oleh perusahaan.')}</p></details>
 </section></div>
 <footer className="admin-personal-lark-actions"><div className="admin-personal-save-feedback">{feedback&&<AdminFormFeedback state={unknown?'unknown':conflict?'error':dirty?'dirty':'saved'} lang={lang}>{feedback}</AdminFormFeedback>}{unknown&&<button type="button" disabled={busy} onClick={()=>void action(false)}>{t('检查保存结果','Check saved result','Periksa hasil tersimpan')}</button>}</div><AdminFormActions className="admin-personal-footer-buttons"><button type="button" disabled={busy} onClick={onCancel}>{t('取消','Cancel','Batal')}</button><button className="admin-personal-save-primary" type="button" disabled={busy||!canEdit||!dirty||conflict||unknown} onClick={()=>void action(true)}>{busy?t('保存中…','Saving…','Menyimpan…'):t('保存','Save','Simpan')}</button></AdminFormActions></footer>
 </>;
}
