import {salesProgressStages,progressLabel} from './crmSalesProgress.ts';
export type DailyDigestInput={jobId?:string;language:'zh'|'en'|'id';date?:string;timezone?:string;counts:unknown;filtered?:boolean};
/** Existing query: customers created on the reporting date, grouped by current stage. */
export function dailyDigestPreview(input:DailyDigestInput){
 const t=(zh:string,en:string,id:string)=>({zh,en,id})[input.language];
 const rows:{label:string;value:string}[]=[];const counts=new Map<string,number>();
 let valid=Array.isArray(input.counts);
 if(valid)for(const row of input.counts as any[]){const n=Number(row?.count);if(row?.count===null||row?.count===undefined||row?.count===''||!Number.isSafeInteger(n)||n<0){valid=false;continue;}const stage=salesProgressStages.some(s=>s[0]===row?.stage)?row.stage:'other';counts.set(stage,(counts.get(stage)||0)+n);}
 if(input.date&&/^\d{4}-\d{2}-\d{2}$/.test(input.date))rows.push({label:t('统计日期','Reporting date','Tanggal laporan'),value:input.date+(input.timezone?' · '+input.timezone:'')});
 if(valid){rows.push({label:t('当日新增客户','New customers that day','Pelanggan baru hari tersebut'),value:String([...counts.values()].reduce((a,b)=>a+b,0))});
 for(const stage of [...salesProgressStages.map(s=>s[0]),'other'])if(counts.get(stage))rows.push({label:stage==='other'?t('阶段未明确','Stage unspecified','Tahap belum jelas'):progressLabel(stage,input.language),value:String(counts.get(stage))});}
 return {title:t('每日新增客户概况','Daily new customer overview','Ringkasan pelanggan baru harian'),rows,note:!valid?t('统计数据不完整，请在CRM核对','Incomplete statistics; check CRM','Statistik belum lengkap; periksa CRM'):input.filtered?t('按本通知规则筛选；阶段为汇总时状态，不代表当日阶段推进。','Filtered by this rule; stages reflect the summary time, not stage transitions that day.','Sesuai filter aturan; tahap saat ringkasan, bukan perpindahan tahap hari itu.'):t('仅统计当日新增客户；阶段为汇总时状态，不代表当日阶段推进。','Customers created that day only; stages reflect the summary time, not stage transitions that day.','Hanya pelanggan yang dibuat hari itu; tahap saat ringkasan, bukan perpindahan tahap hari itu.')};
}
