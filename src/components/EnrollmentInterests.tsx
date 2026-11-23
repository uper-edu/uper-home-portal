import {createBrowserUuid} from '../utils/browserUuid';
import {readEnrollmentDraft,writeEnrollmentDraft} from '../services/visitorContact';
import {useEnrollmentPhoneField} from './useEnrollmentPhoneField';
import {ContactPhoneInput} from './ContactPhoneInput';
import * as phoneValidation from '../utils/contactPhone';
import { useState, type ReactNode } from 'react';
import { PublicSingleSelect } from './PublicSingleSelect';
import { demandFormats, demandLevels, demandPeriods, parseDemand, type DemandCriteria, type DemandItem } from '../utils/enrollmentInterests';
import {interestOption,interestText,type InterestLanguage} from '../utils/enrollmentInterestCopy';

export function EnrollmentDemandForm({ language, initial, prefill, onSave, busy, awaitingCode, emailVerified, contact, draft }: {
  language:InterestLanguage; initial?:DemandItem; prefill?:DemandCriteria;
  onSave:(record:{id:string;revision:number;criteria:DemandCriteria;name?:string})=>void;
  contact?:{name:string;phone:string;fields:ReactNode;checkPhone:()=>boolean};
  draft?:{owner:string;key:string};
  busy:boolean; awaitingCode?:boolean; emailVerified?:boolean;
}) {
  const t=(text:readonly [string,string,string])=>interestText(language,text);
  const [id]=useState(initial?.id||createBrowserUuid());
  const [localName,setLocalName]=useState('');
  const [localCriteria,setLocalCriteria]=useState<DemandCriteria>(()=>initial?.criteria ??
    (draft&&readEnrollmentDraft<DemandCriteria>(draft.owner,draft.key)) ?? prefill ??
    {level:'unsure',period:'any',format:'any',notes:'',phone:''});
  const name=contact?.name??localName;
  const criteria=contact?{...localCriteria,phone:contact.phone}:localCriteria;
  function setCriteria(value:DemandCriteria) {
    const next=contact?{...value,phone:''}:value;
    setLocalCriteria(next);
    if(draft)writeEnrollmentDraft(draft.owner,draft.key,next);
  }
  const phoneField = useEnrollmentPhoneField(language,contact ? '' : criteria.phone,phoneValidation);
  const notesRequired=[criteria.level,criteria.period,criteria.format].includes('other');
  const [invalid,setInvalid]=useState(false);
  const fields=[
    ['level',['级别','Level','Level'],demandLevels],
    ['period',['时段','Preferred time','Waktu pilihan'],demandPeriods],
    ['format',['班型','Class type','Jenis kelas'],demandFormats],
  ] as const;
  return <form className={contact ? "enrollment-journey-form enrollment-demand-form" : undefined} onSubmit={event=>{
    event.preventDefault();
    if(!(contact?contact.checkPhone():phoneField.check()))return;
    const value=parseDemand({...criteria});
    if (!value) {setInvalid(true);return;}
    setInvalid(false);onSave({id,revision:initial?.revision??0,criteria:value,name:initial?undefined:name.trim()});
  }}>
    {!contact&&<h2>{t(initial?['修改选课需求','Edit course preferences','Ubah preferensi kursus']:['告诉我们你想上的课','Tell us what you want to study','Sampaikan kursus yang Anda inginkan'])}</h2>}
    <div className={contact ? 'enrollment-demand-filters' : undefined}>
    {fields.map(([key,label,options])=><PublicSingleSelect key={key} label={t(label)} value={criteria[key]}
      options={options.map(value=>({value,label:interestOption(language,value)}))}
      onChange={value=>setCriteria({...criteria,[key]:value})}/>)}
    </div>
    {contact&&<p className="enrollment-journey-note">{t([
      '「不限」表示该项都可以。「其他」表示现有选项不合适，请补充具体需求。',
      'Choose “Any” if you have no preference. If none of the options fit, choose “Other” and add details.',
      'Pilih “Bebas” jika tidak ada preferensi. Jika tidak ada pilihan yang cocok, pilih “Lainnya” dan tambahkan rincian.',
    ])}</p>}
    <label className={contact?'enrollment-field':undefined}>{t(notesRequired?['补充说明（必填）','Additional details (required)','Rincian tambahan (wajib)']:['补充说明（选填）','Additional details (optional)','Rincian tambahan (opsional)'])}
      <textarea required={notesRequired} maxLength={1000} value={criteria.notes} onChange={event=>setCriteria({...criteria,notes:event.target.value})}/></label>
    {contact ? contact.fields : <>
      {!initial&&<label>{t(['学员姓名','Learner name','Nama siswa'])}
        <input required autoComplete="name" maxLength={120} value={name} onChange={event=>setLocalName(event.target.value)}/></label>}
      <div className="enrollment-field">
        <label htmlFor={phoneField.errorId+'-input'}>{t(['WhatsApp／手机号','WhatsApp or phone','WhatsApp atau nomor HP'])}</label>
        <ContactPhoneInput {...phoneField.inputProps} id={phoneField.errorId+'-input'} language={language} required
          value={criteria.phone} onValueChange={phone=>setCriteria({...criteria,phone})}/>
        {phoneField.error&&<small className="enrollment-form-error" role="alert" id={phoneField.errorId}>{phoneField.error}</small>}
      </div>
    </>}
    {invalid && <p role="alert">{t(['请检查联系方式和补充说明。','Check your phone number and additional details.','Periksa nomor telepon dan rincian tambahan.'])}</p>}
    {contact ? <div className="enrollment-journey-actions">
      <p>{t(['有合适班次时，我们会通过可用渠道通知你。','We’ll let you know when we find a suitable class.','Kami akan memberi kabar jika ada kelas yang sesuai.'])}</p>
      <button className="enrollment-primary" type="submit" disabled={busy||awaitingCode}>{t(emailVerified
        ?['保存选课需求','Save course preferences','Simpan preferensi kursus']
        :['验证并保存需求','Verify and save preferences','Verifikasi dan simpan preferensi'])}</button>
    </div> : <button className="enrollment-action" type="submit" disabled={busy}>{t(['保存需求','Save preferences','Simpan preferensi'])}</button>}
  </form>;
}
