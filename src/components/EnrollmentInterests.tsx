import { useState } from 'react';
import { PublicSingleSelect } from './PublicSingleSelect';
import { demandFormats, demandLevels, demandPeriods, parseDemand, type DemandCriteria } from '../utils/enrollmentInterests';

export type InterestLanguage = 'zh'|'en'|'id';
type Copy = readonly [string,string,string];
export type WaitlistItem = { id:string; classId:string; state:string; orderId?:string; available:boolean; level:string; firstLesson:string };
export type DemandItem = { id:string; revision:number; state:string; criteria:DemandCriteria; matches:{id:string;level:string;firstLesson:string}[] };
export type Interests = { waitlist:WaitlistItem[]; demands:DemandItem[] };

const words:Record<string,Copy> = {
  'weekday-day':['工作日白天','Weekday daytime','Siang hari kerja'],
  'weekday-evening':['工作日晚间','Weekday evening','Malam hari kerja'],
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

export function EnrollmentDemandForm({ language, initial, onSave, busy }: {
  language:InterestLanguage; initial?:DemandItem;
  onSave:(record:{id:string;revision:number;criteria:DemandCriteria})=>void;
  busy:boolean;
}) {
  const t=(text:Copy)=>interestText(language,text);
  const [id]=useState(initial?.id||crypto.randomUUID());
  const [criteria,setCriteria]=useState<DemandCriteria>(initial?.criteria ?? {level:'unsure',period:'any',format:'any',notes:'',phone:''});
  const notesRequired=[criteria.level,criteria.period,criteria.format].includes('other');
  const [invalid,setInvalid]=useState(false);
  const fields=[
    ['level',['级别','Level','Level'],demandLevels],
    ['period',['时段','Preferred time','Waktu pilihan'],demandPeriods],
    ['format',['班型','Class type','Jenis kelas'],demandFormats],
  ] as const;
  return <form onSubmit={event=>{
    event.preventDefault();
    const value=parseDemand({...criteria});
    if (!value) {setInvalid(true);return;}
    setInvalid(false);onSave({id,revision:initial?.revision??0,criteria:value});
  }}>
    <h2>{t(initial?['修改选课需求','Edit course preferences','Ubah preferensi kursus']:['告诉我们你想上的课','Tell us what you want to study','Sampaikan kursus yang Anda inginkan'])}</h2>
    {fields.map(([key,label,options])=><PublicSingleSelect key={key} label={t(label)} value={criteria[key]}
      options={options.map(value=>({value,label:interestOption(language,value)}))}
      onChange={value=>setCriteria(current=>({...current,[key]:value}))}/>)}
    <label>{t(notesRequired?['补充说明（必填）','Additional details (required)','Rincian tambahan (wajib)']:['补充说明（选填）','Additional details (optional)','Rincian tambahan (opsional)'])}
      <textarea required={notesRequired} maxLength={1000} value={criteria.notes} onChange={event=>setCriteria({...criteria,notes:event.target.value})}/></label>
    <label>{t(['WhatsApp／手机号','WhatsApp or phone','WhatsApp atau nomor HP'])}
      <input type="tel" required maxLength={26} value={criteria.phone} onChange={event=>setCriteria({...criteria,phone:event.target.value})}/></label>
    {invalid && <p role="alert">{t(['请检查联系方式和补充说明。','Check your phone number and additional details.','Periksa nomor telepon dan rincian tambahan.'])}</p>}
    <button className="enrollment-action" type="submit" disabled={busy}>{t(['保存需求','Save preferences','Simpan preferensi'])}</button>
  </form>;
}
