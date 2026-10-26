/** User messages only: never infer a course from self-report or an assistant quote. */
export function consultationPriceContext(profile:any,history:any[]){
 if(profile?.targetHskLevel)return profile;
 for(const m of [...history].reverse()){
  if(m.role!=='user')continue;
  const levels=[...m.content.matchAll(/HSK\s*([1-6])\s*([AB])?/gi)].map((v:any)=>'HSK '+v[1]+(v[2]?.toUpperCase()||''));
  if(!levels.length)continue;
  const price=m.content.match(/HSK\s*([1-6])\s*([AB])?[^。！？!?]{0,12}(?:多少|价格|学费|费用|price|tuition)/i);
  if(price)return {...profile,targetHskLevel:'HSK '+price[1]+(price[2]?.toUpperCase()||'')};
  if(new Set(levels).size===1)return {...profile,targetHskLevel:levels[0]};
  return profile;
 }
 return profile;
}
import catalogue from '../../src/data/crmCoursePrices.json';
export function coursePriceReply(question:string,profile:any,lang='zh'):string|null{
 if(!/价格|学费|费用|总价|每节|预算|\b(?:Rp|IDR|price|tuition|fee|biaya|harga)\b/i.test(question)||/不(?:想|用|要)?(?:问|讨论|了解)?(?:价格|学费)/.test(question))return null;
 const match=question.match(/HSK\s*([1-6])\s*([AB])?/i);const target=match?'HSK '+match[1]+(match[2]?.toUpperCase()||''):profile?.targetHskLevel;
 const row=catalogue.courses.find(c=>c.id===target);
 if(!row)return lang==='zh'?'请先确认需要查询的课程级别；目前不能据此确定课程总价、优惠或排期。':lang==='id'?'Mohon pastikan level kursus terlebih dahulu; harga, diskon dan jadwal belum dapat dipastikan.':'Please confirm the course level first; a total, discount or schedule cannot yet be confirmed.';
 const num=(n:number)=>n.toLocaleString('id-ID');
 return lang==='zh'?`${row.id}现有资料价目：${row.sessions}节课，课程总价 Rp ${num(row.total)}；每节 Rp ${num(catalogue.perSession)}。这是课程总价与单节单价的区别；不表示已预约、已缴费或有可用名额。具体开班与适用优惠需要另行确认。`:lang==='id'?`${row.id}: ${row.sessions} pertemuan, total Rp ${num(row.total)}; Rp ${num(catalogue.perSession)} per pertemuan. Jadwal, ketersediaan dan diskon perlu dikonfirmasi; ini bukan konfirmasi pemesanan.`:`${row.id}: ${row.sessions} sessions, course total IDR ${num(row.total)}; IDR ${num(catalogue.perSession)} per session. Schedule, availability and discounts require confirmation; this is not a booking confirmation.`;
}
export function protectGeneratedReply(reply:string,question:string,profile:any,lang:string){
 if(/(?:Rp\.?|IDR|USD|\$|人民币|学费|总价|每节)[\s:：]*[\d.,]+/i.test(reply))return coursePriceReply(question,profile,lang)||(lang==='zh'?'您的补充已保留。具体价格需要先确认想了解的课程级别；请问您想先了解课程内容还是上课安排？':lang==='id'?'Informasi Anda telah disimpan. Pastikan level kursus sebelum membahas harga. Ingin mengetahui isi kursus atau jadwal?':'Your update is saved. Please confirm the course level before discussing prices. Would you like course content or schedule information?');
 return reply;
}
