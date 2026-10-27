import {crmInstant} from './crmOperatingTime';
export function firstContactCountdown(value:string|undefined,now=Date.now(),lang='zh'){
 const date=crmInstant(value);if(!date||date.getTime()<=0)return lang==='zh'?'期限待确认':lang==='id'?'Tenggat belum tersedia':'Deadline unavailable';
 const delta=date.getTime()-now;const minutes=Math.max(1,Math.ceil(Math.abs(delta)/60000)),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),mins=minutes%60;
 const amount=lang==='zh'?`${days?days+'天':''}${hours?hours+'小时':''}${mins?mins+'分钟':''}`:lang==='id'?`${days?days+' hari ':''}${hours?hours+' jam ':''}${mins?mins+' menit':''}`:`${days?days+'d ':''}${hours?hours+'h ':''}${mins?mins+'m':''}`;
 if(delta===0)return lang==='zh'?'已到期':lang==='id'?'Jatuh tempo':'Due now';
 return lang==='zh'?(delta<0?'已逾期':'还剩')+(Math.abs(delta)<60000?'不足1分钟':amount):lang==='id'?(delta<0?'Terlambat ':'Tersisa ')+amount:delta<0?'Overdue '+amount:amount+' remaining';
}
