import type {CrmLanguage} from './crmLanguage';

export const facultyEndpoint='/api/crm/enrollment/faculty';
export const facultyLanguages=['zh','en','id'] as const;
export const facultyIdPattern=/^[a-z0-9-]{1,64}$/;
export const facultyFields={
  positions:['现任／曾任职务','Current / former positions','Jabatan saat ini / sebelumnya'],
  qualification:['最高学历','Highest qualification','Kualifikasi tertinggi'],
  education:['教育背景','Education','Pendidikan'],
  teachingExperience:['从教经验','Teaching experience','Pengalaman mengajar'],
  chineseTeachingExperience:['中文教学经验','Chinese teaching experience','Pengalaman mengajar Mandarin'],
  internationalExperience:['海外教学／国际经历','International experience','Pengalaman internasional'],
  leadershipExperience:['管理经验','Leadership experience','Pengalaman kepemimpinan'],
  practicalExperience:['实践经历','Practical experience','Pengalaman praktik'],
  chineseProficiency:['中文水平','Chinese proficiency','Kemahiran Mandarin'],
  languages:['掌握语言','Languages','Bahasa'],
  researchAreas:['研究方向','Research areas','Bidang penelitian'],
  academicAchievements:['科研成果','Academic achievements','Pencapaian akademik'],
  publications:['教材／著作','Textbooks and publications','Buku ajar dan publikasi'],
  teachingExpertise:['主要授课方向','Teaching expertise','Bidang pengajaran'],
  strengths:['专业优势','Professional strengths','Keunggulan profesional'],
  teachingHighlights:['教学成果／特色','Teaching highlights','Pencapaian pengajaran'],
  teachingFeatures:['教学特点','Teaching features','Ciri pengajaran'],
  cv:['简历说明','CV notes','Catatan CV'],
} as const;
export type FacultyBio=Partial<Record<'name'|keyof typeof facultyFields,string>>;
export type FacultyType='local'|'foreign';
export type FacultyFileKind='photo'|'cv';
export const facultyFileLimits={photo:8*1024*1024,cv:2*1024*1024};
export type FacultyFile={name:string;type:string;size:number};
export type FacultyFileInput={name:string;type:string;data:string};
export type FacultyChoice={id:string;category:FacultyType;active:boolean;names:Partial<Record<CrmLanguage,string>>};
export type FacultyProfile=Omit<FacultyChoice,'names'>&{
  revision:number;content:Partial<Record<CrmLanguage,FacultyBio>>;files:Partial<Record<FacultyFileKind,FacultyFile>>;
};
export type FacultyCurrency='IDR'|'CNY';
export type FacultyTerm={
  contractStart:string;monthsAfterStart:number;kind:'lesson'|'monthly';
  currency:FacultyCurrency|null;amountMinor:number|null;note:string;
};
export type FacultyRateChange={revision:number;actor:string;at:string;reason:string;before:FacultyTerm[];after:FacultyTerm[]};
export type FacultyRates={revision:number;terms:FacultyTerm[];source:string;history?:FacultyRateChange[]};

export const facultyTeacherLabels={
  local:['本土教师','Local teacher','Pengajar lokal'],
  foreign:['中国教师','Teacher from China','Pengajar dari Tiongkok'],
} as const;
export const facultyText=(lang:CrmLanguage,copy:readonly [string,string,string])=>copy[lang==='zh'?0:lang==='id'?2:1];
export const facultyName=(names:FacultyChoice['names'],lang:CrmLanguage)=>[names[lang],names.zh,names.en,names.id].find(name=>name?.trim())?.trim()??'';
export const facultyDateValid=(date:string)=>{
  if(!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date))return false;
  const parsed=new Date(date+'T00:00:00Z');
  return Number.isFinite(+parsed)&&parsed.toISOString().slice(0,10)===date;
};
export function facultyEffectiveDate(term:Pick<FacultyTerm,'contractStart'|'monthsAfterStart'>){
  const date=new Date(term.contractStart+'T00:00:00Z'),day=date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth()+term.monthsAfterStart+1,0);
  date.setUTCDate(Math.min(day,date.getUTCDate()));
  return date.toISOString().slice(0,10);
}
export function facultyRateOn(terms:readonly FacultyTerm[],date:string){
  const contract=terms.filter(term=>term.contractStart<=date).reduce((latest,term)=>term.contractStart>latest?term.contractStart:latest,'');
  if(!contract)return undefined;
  return terms.filter(term=>term.contractStart===contract&&facultyEffectiveDate(term)<=date)
    .sort((a,b)=>b.monthsAfterStart-a.monthsAfterStart)[0];
}
export function facultyMinorAmount(value:string,currency:FacultyCurrency){
  if(!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)||currency==='IDR'&&value.includes('.'))return null;
  const [whole,cents='']=value.split('.');
  return currency==='CNY'?Number(whole)*100+Number(cents.padEnd(2,'0')):Number(whole);
}
export function facultyAmount(minor:number,currency:FacultyCurrency){
  return currency==='CNY'?(minor/100).toFixed(2):String(minor);
}
