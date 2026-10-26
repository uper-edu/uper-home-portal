import {crmValue,crmLocale} from './crmLanguage';
/** Presentation only: no inferred old value, new signal, task or priority. */
export function listLeadHint(lead:any,lang:any='zh'){
 const hints=lead.informationHints||[];
 const meaningful=hints.find((h:any)=>['difference','contact','source'].includes(h.kind));
 if(meaningful)return meaningful.text;
 return null;
}
export function budgetPresentation(lead:any,lang:any='zh'){
 const t=(zh:string,en:string,id:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const has=(v:any)=>v!==undefined&&v!==null&&(typeof v!=='string'||v.trim()!=='');
 if(!has(lead.budgetMin)&&!has(lead.budgetMax))return null;
 const currency=String(lead.budgetCurrency||'').trim();
 const amount=(v:any)=>{const n=Number(v);const value=Number.isFinite(n)?new Intl.NumberFormat(crmLocale(lang),{maximumFractionDigits:20}).format(n):String(v);return currency==='IDR'?'Rp'+value:currency?value+' '+currency:value;};
 const label=has(lead.budgetMin)&&has(lead.budgetMax)?t('预算区间','Budget range','Rentang anggaran'):has(lead.budgetMax)?t('预算上限','Budget ceiling','Batas atas anggaran'):t('预算下限','Budget minimum','Batas bawah anggaran');
 const period=({course:t('整门课程','whole course','seluruh kursus'),month:t('每月','per month','per bulan'),hour:t('每小时','per hour','per jam')} as any)[lead.budgetPeriod]||(lead.budgetPeriod&&lead.budgetPeriod!=='unspecified'?String(lead.budgetPeriod):t('周期未明确','Period unspecified','Periode belum jelas'));
 const value=has(lead.budgetMin)&&has(lead.budgetMax)?`${amount(lead.budgetMin)}—${amount(lead.budgetMax)}`:amount(has(lead.budgetMax)?lead.budgetMax:lead.budgetMin);
 return {label,value:value+(currency?'':t(' · 币种未记录',' · Currency not recorded',' · Mata uang belum tercatat'))+' · '+period};
}

/** Current learning needs belong in the needs column, independent of change hints. */
export function listLearningNeeds(lead:any,lang:any='zh'){
 const t=(zh:string,en:string,id:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const rows:Array<{label:string,value:string}>=[];
 for(const [field,label] of [['availability',t('上课时段','Class availability','Waktu belajar')],['preferredStart',t('计划开始','Planned start','Rencana mulai')],['concerns',t('顾虑','Learning concerns','Kekhawatiran belajar')]]){
  const raw=lead[field];const values=(Array.isArray(raw)?raw:[raw]).filter(v=>v!=null&&String(v).trim()!=='').map(v=>crmValue(String(v),lang));
  if(values.length)rows.push({label,value:values.join('、')});
 }
 const budget=budgetPresentation(lead,lang);if(budget){const concerns=rows.findIndex(r=>r.label===t('顾虑','Learning concerns','Kekhawatiran belajar'));rows.splice(concerns<0?rows.length:concerns,0,budget);}
 return rows;
}

/** Short list wording only; the evidence presenter still owns all assessment decisions. */
export function listAssessmentConclusion(conclusion:string,lang:any='zh'){
 if(lang!=='zh')return conclusion;
 return conclusion.replace(/^建议起点：/, '建议起点 ').replace(/^达到本卷 (HSK [1-6]) 设定标准$/, '本卷达到 $1 标准').replace(/^未达到本卷 /, '未达本卷 ').replace(/^结果待复核$/, '待复核').replace(/^起点建议待复核$/, '起点待复核');
}
