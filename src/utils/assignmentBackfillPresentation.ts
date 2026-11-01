import type {CrmLanguage} from './crmLanguage';
/** Summarize the actual preview destinations, not all configured staff. */
export function backfillPreviewSummary(preview:{rows:{ownerId:string}[];total:number},lang:CrmLanguage){
 const count=preview.rows.length,owners=new Set(preview.rows.map(row=>row.ownerId).filter(Boolean)).size;
 const scope=count===preview.total?{zh:`${count}位客户`,en:`${count} customers`,id:`${count} pelanggan`}[lang]:{zh:`本次${count}位 / 共${preview.total}位`,en:`${count} of ${preview.total} customers`,id:`${count} dari ${preview.total} pelanggan`}[lang];
 return [scope,{zh:'轮询',en:'Round robin',id:'Bergiliran'}[lang],...(owners?[{zh:`${owners}名接收销售`,en:`${owners} receiving salespeople`,id:`${owners} sales penerima`}[lang]]:[])].join(' · ');
}
