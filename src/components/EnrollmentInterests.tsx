import {useEnrollmentPhoneField} from './useEnrollmentPhoneField';
import { useState, type ReactNode } from 'react';
import { PublicSingleSelect } from './PublicSingleSelect';
import { demandFormats, demandLevels, demandPeriods, parseDemand, type DemandCriteria } from '../utils/enrollmentInterests';

export type InterestLanguage = 'zh'|'en'|'id';
type Copy = readonly [string,string,string];
export type WaitlistItem = { id:string; classId:string; learnerName?:string; state:string; orderId?:string; available:boolean; level:string; firstLesson:string; updatedAt?:string };
export type DemandItem = { id:string; revision:number; state:string; criteria:DemandCriteria; matches:{id:string;level:string;firstLesson:string}[]; updatedAt?:string };
export type Interests = { waitlist:WaitlistItem[]; demands:DemandItem[] };

const words:Record<string,Copy> = {
  'weekday-day':['工作日白天','Weekday daytime','Siang hari kerja'],
  'weekday-evening':['工作日晚间','Weekday evening','Malam hari kerja'],
  mixed:['工作日与周末','Weekdays & weekends','Hari kerja & akhir pekan'],
  weekend:['周末','Weekend','Akhir pekan'],
  standard:['标准班','Standard class','Kelas standar'],
  small:['小班','Small group','Kelompok kecil'],
  'one-on-one':['一对一','One-to-one','Satu lawan satu'],
  unsure:['不确定我的级别','Not sure about my level','Belum yakin level saya'],
  any:['不限','Any','Bebas'],
  other:['其他','Other','Lainnya'],
};
export function interestText(language:InterestLanguage,text:Copy) {
  return text[language==='zh'?0:language==='id'?2:1];
}
export function interestOption(language:InterestLanguage,value:string) {
  return words[value] ? interestText(language,words[value]) : value;
}
export const waitlistStates:Record<string,Copy>={
  waiting:['候补中','On waitlist','Dalam daftar tunggu'],
  converted:['已转申请','Converted to an application','Menjadi pendaftaran'],
  withdrawn:['已取消候补','Waitlist entry cancelled','Daftar tunggu dibatalkan'],
  closed:['候补已结束','Waitlist closed','Daftar tunggu ditutup'],
};

export function EnrollmentDemandForm({ language, initial, onSave, busy, verification, awaitingCode }: {
  language:InterestLanguage; initial?:DemandItem;
  onSave:(record:{id:string;revision:number;criteria:DemandCriteria;name?:string})=>void;
  busy:boolean; verification?:{email:ReactNode; code:ReactNode}; awaitingCode?:boolean;
}) {
  const t=(text:Copy)=>interestText(language,text);
  const [id]=useState(initial?.id||crypto.randomUUID());
  const [name,setName]=useState('');
  const [criteria,setCriteria]=useState<DemandCriteria>(initial?.criteria ?? {level:'unsure',period:'any',format:'any',notes:'',phone:''});
  const phoneField = useEnrollmentPhoneField(language,criteria.phone);
  const notesRequired=[criteria.level,criteria.period,criteria.format].includes('other');
  const [invalid,setInvalid]=useState(false);
  const fields=[
    ['level',['级别','Level','Level'],demandLevels],
    ['period',['时段','Preferred time','Waktu pilihan'],demandPeriods],
    ['format',['班型','Class type','Jenis kelas'],demandFormats],
  ] as const;
  return <form className={verification ? "enrollment-journey-form enrollment-demand-form" : undefined} onSubmit={event=>{
    event.preventDefault();
    if(!phoneField.check())return;
    const value=parseDemand({...criteria});
    if (!value) {setInvalid(true);return;}
    setInvalid(false);onSave({id,revision:initial?.revision??0,criteria:value,name:initial?undefined:name.trim()});
  }}>
    {!verification&&<h2>{t(initial?['修改选课需求','Edit course preferences','Ubah preferensi kursus']:['告诉我们你想上的课','Tell us what you want to study','Sampaikan kursus yang Anda inginkan'])}</h2>}
    <div className={verification ? 'enrollment-demand-filters' : undefined}>
    {fields.map(([key,label,options])=><PublicSingleSelect key={key} label={t(label)} value={criteria[key]}
      options={options.map(value=>({value,label:interestOption(language,value)}))}
      onChange={value=>setCriteria(current=>({...current,[key]:value}))}/>)}
    </div>
    {verification&&<p className="enrollment-journey-note">{t([
      '「不限」表示该项都可以。「其他」表示现有选项不合适，请补充具体需求。',
      'Choose “Any” if you have no preference. If none of the options fit, choose “Other” and add details.',
      'Pilih “Bebas” jika tidak ada preferensi. Jika tidak ada pilihan yang cocok, pilih “Lainnya” dan tambahkan rincian.',
    ])}</p>}
    <label className={verification?'enrollment-field':undefined}>{t(notesRequired?['补充说明（必填）','Additional details (required)','Rincian tambahan (wajib)']:['补充说明（选填）','Additional details (optional)','Rincian tambahan (opsional)'])}
      <textarea required={notesRequired} maxLength={1000} value={criteria.notes} onChange={event=>setCriteria({...criteria,notes:event.target.value})}/></label>
    {!initial&&<label className={verification?'enrollment-field':undefined}>{t(['学员姓名','Learner name','Nama siswa'])}
      <input required autoComplete="name" maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label>}
    {verification?.email}
    <label className={verification?'enrollment-field':undefined}>{t(['WhatsApp／手机号','WhatsApp or phone','WhatsApp atau nomor HP'])}
      <input type="tel" autoComplete="tel" required {...phoneField.inputProps} value={criteria.phone} onChange={event=>setCriteria({...criteria,phone:event.target.value})}/>
      {phoneField.error&&<small className="enrollment-form-error" role="alert" id={phoneField.errorId}>{phoneField.error}</small>}</label>
    {verification?.code}
    {invalid && <p role="alert">{t(['请检查联系方式和补充说明。','Check your phone number and additional details.','Periksa nomor telepon dan rincian tambahan.'])}</p>}
    {verification ? <div className="enrollment-journey-actions">
      <p>{t(['有合适班次时，我们会通过可用渠道通知你。','We’ll let you know when we find a suitable class.','Kami akan memberi kabar jika ada kelas yang sesuai.'])}</p>
      <button className="enrollment-primary" type="submit" disabled={busy||awaitingCode}>{t(['验证并保存需求','Verify and save preferences','Verifikasi dan simpan preferensi'])}</button>
    </div> : <button className="enrollment-action" type="submit" disabled={busy}>{t(['保存需求','Save preferences','Simpan preferensi'])}</button>}
  </form>;
}
