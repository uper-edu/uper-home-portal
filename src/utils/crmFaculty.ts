import type {CrmLanguage} from './crmLanguage';

export const facultyEndpoint='/api/crm/enrollment/faculty';
export const facultyLanguages=['zh','en','id'] as const;
export const facultyIdPattern=/^[a-z0-9-]{1,64}$/;
export const facultyProfessionalTitleLimit=120;
export const facultyFields={
  professionalTitle:['职称','Professional title','Jabatan profesional'],
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
export const facultyEmploymentTypes={
  'full-time':['全职','Full-time','Penuh waktu'],
  'part-time':['兼职','Part-time','Paruh waktu'],
} as const;
export type FacultyEmploymentType=keyof typeof facultyEmploymentTypes;
export type FacultyFileKind='photo'|'cv';
export const facultyFileLimits={photo:8*1024*1024,cv:2*1024*1024};
export type FacultyFile={name:string;type:string;size:number};
export type FacultyFileInput={name:string;type:string;data:string};
export type FacultyChoice={id:string;category:FacultyType;active:boolean;names:Partial<Record<CrmLanguage,string>>};
type FacultyTitleTexts=Partial<Record<CrmLanguage,string>>;
export type FacultyDirectoryEntry=FacultyChoice&{
  professionalTitles?:FacultyTitleTexts;
  employmentType?:FacultyEmploymentType;
  billingMethod?:{kind:FacultyTerm['kind'];status:'effective'|'undated'|'scheduled'}|null;
};
export type FacultyProfile=Omit<FacultyChoice,'names'>&{
  revision:number;content:Partial<Record<CrmLanguage,FacultyBio>>;files:Partial<Record<FacultyFileKind,FacultyFile>>;
  employmentType?:FacultyEmploymentType;
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
const facultyNameLanguage=(names:FacultyChoice['names'],lang:CrmLanguage)=>[lang,...facultyLanguages].find(code=>names[code]?.trim());
export function facultyName(names:FacultyChoice['names'],lang:CrmLanguage){
  const source=facultyNameLanguage(names,lang);
  return source?names[source]?.trim()??'':'';
}
export const facultyTitlePresets={
  professor:['教授','Professor','Profesor'],
  associateProfessor:['副教授','Associate Professor','Profesor madya'],
  assistantProfessor:['助理教授','Assistant Professor','Asisten profesor'],
  seniorLecturer:['高级讲师','Senior Lecturer','Dosen senior'],
  lecturer:['讲师','Lecturer','Dosen'],
  seniorTeacher:['高级教师','Senior Teacher','Guru senior'],
  teachingAssistant:['助教','Teaching Assistant','Asisten pengajar'],
} as const;
type FacultyTitlePreset=keyof typeof facultyTitlePresets;
const titleAliases:Partial<Record<string,FacultyTitlePreset>>={
  'prof':'professor','prof.':'professor','guru besar':'professor','assoc. prof.':'associateProfessor',
  'assoc. prof':'associateProfessor','assoc prof':'associateProfessor',
};
const titleCodes=Object.keys(facultyTitlePresets) as FacultyTitlePreset[];
function titlePreset(value:string):FacultyTitlePreset|undefined{
  const text=value.trim().toLowerCase().replace(/\s+/g,' ');
  return (Object.hasOwn(titleAliases,text)?titleAliases[text]:undefined)??
    titleCodes.find(code=>facultyTitlePresets[code].some(label=>label.toLowerCase()===text));
}
export function facultyTitles(content:FacultyProfile['content']={}):FacultyTitleTexts{
  return Object.fromEntries(facultyLanguages.map(lang=>[lang,content[lang]?.professionalTitle]).filter(([,value])=>value?.trim()));
}
export function facultyTitleSelection(titles:FacultyTitleTexts):FacultyTitlePreset|'legacy'|''{
  const choices=new Set(Object.values(titles).filter(value=>value?.trim()).map(value=>titlePreset(value)??'legacy'));
  if(choices.size>1)return 'legacy';
  return choices.values().next().value??'';
}
export function facultyTitleLabel(titles:FacultyTitleTexts,lang:CrmLanguage){
  const choice=facultyTitleSelection(titles);
  return choice&&choice!=='legacy'?facultyText(lang,facultyTitlePresets[choice]):facultyName(titles,lang);
}
export function facultyTitleOptions(lang:CrmLanguage){
  return titleCodes.map(value=>({value,label:facultyText(lang,facultyTitlePresets[value])}));
}
export function withFacultyTitles(content:FacultyProfile['content'],titles:FacultyTitleTexts):FacultyProfile['content']{
  const next={...content};
  for(const lang of facultyLanguages){
    const bio={...content[lang]};
    if(titles[lang])bio.professionalTitle=titles[lang];
    else delete bio.professionalTitle;
    if(Object.keys(bio).length)next[lang]=bio;
    else delete next[lang];
  }
  return next;
}
export function facultyPresetTitles(value:string):FacultyTitleTexts{
  const preset=titleCodes.find(code=>code===value);
  return preset?Object.fromEntries(facultyLanguages.map(lang=>[lang,facultyText(lang,facultyTitlePresets[preset])])):{};
}

// Use known title forms only to offer an explicit edit to an existing name.
export function facultyTitleSuggestion(bio?:FacultyBio):{name:string;professionalTitle:string}|undefined{
  const existing=bio?.professionalTitle?.trim();
  const matches=(title:string)=>{
    if(!existing||existing===title)return true;
    const preset=titlePreset(title);
    return !!preset&&preset===titlePreset(existing);
  };
  const fullName=bio?.name?.trim();
  if(!fullName)return;
  const prefix=fullName.match(/^(Associate Professor|Assistant Professor|Distinguished Professor|Emeritus Professor|Senior Teacher|Senior Lecturer|Assoc\.?\s+Prof\.?|Professor|Prof\.?|Lecturer|Guru Besar|Guru Senior|Dosen Senior|Lektor Kepala|Profesor)\s+([\p{L}\p{M}][\p{L}\p{M} .’'·-]*)$/iu);
  if(prefix&&matches(prefix[1]))return {name:prefix[2].trim(),professionalTitle:prefix[1]};
  const suffix=fullName.match(/特聘教授|荣誉教授|助理教授|副教授|教授|高级教师|高级讲师|讲师/u);
  if(!suffix||suffix.index===undefined||suffix.index+suffix[0].length!==fullName.length||!matches(suffix[0]))return;
  const name=fullName.slice(0,suffix.index).replace(/[\s,，·]+$/u,'');
  if(/^\p{Script=Han}{2,}(?:[·・ ]\p{Script=Han}+)*$/u.test(name))return {name,professionalTitle:suffix[0]};
}

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
export function facultyBillingMethod(terms:readonly FacultyTerm[],date:string):NonNullable<FacultyDirectoryEntry['billingMethod']>|null{
  const current=facultyRateOn(terms,date);
  if(current)return {kind:current.kind,status:'effective'};
  const undated=terms.find(term=>!term.contractStart&&term.monthsAfterStart===0);
  if(undated)return {kind:undated.kind,status:'undated'};
  const future=terms.find(term=>term.contractStart>date);
  return future?{kind:future.kind,status:'scheduled'}:null;
}
export function facultyMinorAmount(value:string,currency:FacultyCurrency){
  if(!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)||currency==='IDR'&&value.includes('.'))return null;
  const [whole,cents='']=value.split('.');
  return currency==='CNY'?Number(whole)*100+Number(cents.padEnd(2,'0')):Number(whole);
}
export function facultyAmount(minor:number,currency:FacultyCurrency){
  return currency==='CNY'?(minor/100).toFixed(2):String(minor);
}
