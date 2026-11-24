import {formatCrmOperatingTime,validateLocalInstant} from '../../src/utils/crmOperatingTime';
import {calendarSample} from '../../src/utils/workCalendar';
import {enrollmentGuideText,normalizeEnrollmentIntent,type EnrollmentGuideLanguage} from '../../src/utils/enrollmentGuidance';

const wib='Asia/Jakarta';
const dayNames:Record<EnrollmentGuideLanguage,string[]>={
  zh:['周一','周二','周三','周四','周五','周六','周日'],
  en:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  id:['Sen','Sel','Rab','Kam','Jum','Sab','Min'],
};
const weekDay=(date:Date)=>date.getUTCDay()||7;

export function resolveChatLocalSchedule(value:unknown,userMessages:readonly string[],now:Date,lang:EnrollmentGuideLanguage){
  if(!value||typeof value!=='object')return undefined;
  const {timeZone,zoneEvidence,availabilityEvidence,windows}=value as Record<string,unknown>;
  const supportedEvidence=(quote:unknown)=>typeof quote==='string'&&quote.trim().length>=2&&
    userMessages.some(text=>text.includes(quote.trim()));
  if(typeof timeZone!=='string'||timeZone.length>80||!(timeZone==='UTC'||timeZone.includes('/'))||!supportedEvidence(zoneEvidence)||!supportedEvidence(availabilityEvidence))
    return undefined;
  const input=normalizeEnrollmentIntent({kind:'recommend',windows});
  if(!input?.windows||input.needsReview)return undefined;
  try{
    const localDate=formatCrmOperatingTime(now.toISOString(),timeZone).slice(0,10);
    const anchor=new Date(localDate+'T00:00:00Z');
    // A recurring window needs a stable offset before it can be used to match a WIB schedule.
    const offsets=new Set<number>();
    for(let month=0;month<=12;month++){
      const day=new Date(anchor);day.setUTCMonth(day.getUTCMonth()+month);
      const date=day.toISOString().slice(0,10);
      offsets.add(calendarSample(date,'12:00',timeZone).getTime()-Date.parse(date+'T12:00:00Z'));
    }
    if(offsets.size!==1)return undefined;
    const descriptions:string[]=[];
    const converted=input.windows.map(({day,earliest,latestStart,latestEnd})=>{
      const date=new Date(anchor);date.setUTCDate(anchor.getUTCDate()+(day-weekDay(anchor)+7)%7);
      const ymd=date.toISOString().slice(0,10);
      const convert=(clock:string)=>{
        const instant=validateLocalInstant(ymd+'T'+clock,calendarSample(ymd,clock,timeZone),timeZone);
        const target=formatCrmOperatingTime(instant.toISOString(),wib);
        return {day:weekDay(new Date(target.slice(0,10)+'T00:00:00Z')),clock:target.slice(11,16)};
      };
      const start=earliest&&convert(earliest);
      const endStart=latestStart&&convert(latestStart);
      const end=latestEnd&&convert(latestEnd);
      const found=[start,endStart,end].filter(Boolean) as Array<{day:number;clock:string}>;
      if(!found.length||found.some(item=>item.day!==found[0].day))throw Error('Unsupported multi-day window');
      const clocks=(a?:string,b?:string,c?:string)=>a&&a===b&&!c?a:[
        a&&enrollmentGuideText(lang,`从 ${a}`,`from ${a}`,`mulai ${a}`),
        b&&enrollmentGuideText(lang,`最晚 ${b} 开始`,`starts by ${b}`,`mulai paling lambat ${b}`),
        c&&enrollmentGuideText(lang,`最晚 ${c} 结束`,`ends by ${c}`,`selesai paling lambat ${c}`),
      ].filter(Boolean).join(', ');
      descriptions.push(`${dayNames[lang][day-1]} ${clocks(earliest,latestStart,latestEnd)} → ${dayNames[lang][found[0].day-1]} ${clocks(start?start.clock:undefined,endStart?endStart.clock:undefined,end?end.clock:undefined)} WIB`);
      return {day:found[0].day,earliest:start?start.clock:undefined,latestStart:endStart?endStart.clock:undefined,latestEnd:end?end.clock:undefined};
    });
    const checked=normalizeEnrollmentIntent({kind:'recommend',windows:converted});
    if(!checked?.windows||checked.needsReview)return undefined;
    const zone=new Intl.DateTimeFormat('en',{timeZone}).resolvedOptions().timeZone;
    const city=zone.split('/').at(-1)?.replaceAll('_',' ')??zone;
    const source=lang==='zh'&&city==='Tokyo'?'东京':city;
    return {windows:checked.windows,summary:enrollmentGuideText(lang,`${source}时间换算为雅加达时间（WIB）：${descriptions.join('；')}。`,
      `Converted from ${source} to Jakarta time (WIB): ${descriptions.join('; ')}.`,
      `Konversi dari waktu ${source} ke waktu Jakarta (WIB): ${descriptions.join('; ')}.`)};
  }catch{return undefined;}
}
