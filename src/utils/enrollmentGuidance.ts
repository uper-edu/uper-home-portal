import {enrollmentFormats,enrollmentLevels,enrollmentPeriods,enrollmentSessionStart,type PublicEnrollmentClass} from './enrollmentCatalog';
import {promotionJourneyUrl} from './promotionNavigation';

export type EnrollmentGuideLanguage='zh'|'en'|'id';
const consultationQuestions=['starting_point','apply','reserve','period_unit','appointment','view_without_contact',
  'link_only','records_location','cancel_unpaid','expired_unpaid','proof_after_cancellation','payment_verification','refund'] as const;
type ConsultationQuestion=typeof consultationQuestions[number];
const levels:readonly string[]=enrollmentLevels;
const periods:readonly string[]=enrollmentPeriods;
const formats:readonly string[]=enrollmentFormats;
const quoteFormats=[...formats,'one-on-one'];
type EnrollmentGuideClass=Pick<PublicEnrollmentClass,'id'|'level'|'courseName'|'batchNumber'|'period'|'format'|
  'firstLesson'|'weeklySchedule'|'schedule'|'minutes'|'price'|'availability'> &
  Partial<Pick<PublicEnrollmentClass,'sessions'|'teacherType'|'standardPrice'|'opened'|'material'|'learningOutcomes'>>;

export type EnrollmentGuideAction={
  kind:'catalog'|'class'|'waitlist'|'demand'|'unavailable'|'paused'|'advisor'|'appointment'|'quote'|'records'|'viewing';
  level?:string;
  period?:string;
  format?:string;
  classId?:string;
  rows?:EnrollmentGuideClass[];
  explicitDemand?:boolean;
  quoteMissing?:boolean;
  quotes?:EnrollmentQuote[];
  offline?:boolean;
  inspection?:boolean;
  referenceUnavailable?:boolean;
  requestedPeriods?:number;
  detailFields?:string[];
  question?:ConsultationQuestion;
  maximumTotal?:number;
  intakePaused?:boolean;
  levelUnavailable?:boolean;
  scheduleConflict?:{day:number;start:string;end:string};
};
export type EnrollmentQuote={
  id:string;level:string;format:string;period?:string;batchNumber?:number;
  periods:number;minutes:number;actual:number;standard?:number;unitPriced:boolean;
  course?:string;teacherType?:'local'|'foreign';
};
export const enrollmentGuideText=(lang:EnrollmentGuideLanguage,zh:string,en:string,id:string)=>({zh,en,id})[lang];
export const enrollmentAppointmentRequested=(action:EnrollmentGuideAction)=>action.kind==='appointment'||
  (action.kind==='quote'&&(action.question==='appointment'||action.detailFields?.includes('appointment')));

export function enrollmentGuideHref(action:EnrollmentGuideAction,lang:EnrollmentGuideLanguage,via:'ai_chat'|'whatsapp',source=new URLSearchParams()){
  const {kind,classId,level,period,format}=action;
  const query=new URLSearchParams({lang,enrollment_via:via});
  if(level&&levels.includes(level))query.set('level',level.slice(4,5));
  else if(level==='other'&&kind==='demand')query.set('level','other');
  else if(kind==='catalog'||kind==='paused'||kind==='unavailable')query.set('level','all');
  if(period&&periods.includes(period))query.set('period',period);
  if(format&&(formats.includes(format)||format==='one-on-one'))query.set('format',format);
  let path='/enrollment';
  if((kind==='class'||kind==='waitlist')&&classId){
    path+='/'+encodeURIComponent(classId);
    if(kind==='waitlist')query.set('apply','1');
  }
  if(kind==='demand')path+='/interest';
  if(kind==='advisor')path+='/help/consultation';
  if(kind==='advisor'&&action.offline)query.set('mode','offline');
  if(kind==='records')path+='/mine';
  if(enrollmentAppointmentRequested(action)){
    query.set('format','one-on-one');
    if(via==='ai_chat'){
      path+='/help/one-on-one';
      const privateQuotes=action.quotes?.filter(quote=>quote.unitPriced);
      if(privateQuotes?.length===1)query.set('appointment',privateQuotes[0].id);
    }
  }else if(kind==='quote'&&classId)path+='/'+encodeURIComponent(classId);
  return promotionJourneyUrl(path+'?'+query,source);
}

export function enrollmentDemandPrefill(params:URLSearchParams){
  const level=params.get('level'),period=params.get('period'),format=params.get('format');
  return {
    level:level==='1'?'HSK 1':level==='2'?'HSK 2':level==='3'?'HSK 3':level==='4'?'HSK 4':level==='other'?'other':'unsure',
    period:period==='weekend'||period==='weekday-evening'||period==='mixed'?period:'any',
    format:format==='standard'||format==='small'||format==='one-on-one'?format:'any',
    notes:'',phone:'',
  } as const;
}

const validClock=(value:unknown):value is string=>typeof value==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const minuteOfDay=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3));
const endOfSession=(start:string,duration:number)=>{
  const end=minuteOfDay(start)+duration;
  return [Math.floor(end/60),end%60].map(n=>String(n).padStart(2,'0')).join(':');
};
const intentKinds=['recommend','browse','advisor','appointment','demand','quote','inspect','specifications','records','viewing'] as const;
type EnrollmentIntentKind=typeof intentKinds[number];
type DayWindow={day:number;earliest?:string;latestStart?:string;latestEnd?:string};
function normalizeWindow(value:unknown):DayWindow|undefined{
  if(!value||typeof value!=='object')return undefined;
  const {day,earliest,latestStart,latestEnd,latest}=value as Record<string,unknown>;
  if(typeof day!=='number'||!Number.isInteger(day)||day<1||day>7)return undefined;
  if([earliest,latestStart,latestEnd,latest].some(time=>time!=null&&!validClock(time)))return undefined;
  const start=validClock(earliest)?earliest:undefined;
  const startLimit=validClock(latestStart)?latestStart:validClock(latest)?latest:undefined;
  const endLimit=validClock(latestEnd)?latestEnd:undefined;
  if(start&&((startLimit&&start>startLimit)||(endLimit&&start>=endLimit)))return undefined;
  return {day,earliest:start,latestStart:startLimit,latestEnd:endLimit};
}
export function normalizeEnrollmentIntent(value:unknown){
  if(!value||typeof value!=='object')return undefined;
  const data=value as Record<string,unknown>;
  const pick=(v:unknown,allowed:readonly string[])=>typeof v==='string'&&allowed.includes(v)?v:undefined;
  const time=(v:unknown)=>validClock(v)?v:undefined;
  const kind=pick(data.kind,intentKinds) as EnrollmentIntentKind|undefined;
  if(!kind)return undefined;
  const days=Array.isArray(data.days)&&data.days.length>0&&data.days.length<=7&&
    data.days.every(d=>Number.isInteger(d)&&d>=1&&d<=7)?data.days as number[]:undefined;
  const earliest=time(data.earliest),latest=time(data.latest),latestEnd=time(data.latestEnd);
  const windows=Array.isArray(data.windows)&&data.windows.length>0&&data.windows.length<=7
    ?data.windows.map(normalizeWindow).filter((entry):entry is DayWindow=>!!entry):undefined;
  const validWindows=!!windows&&windows.length===(data.windows as unknown[]).length&&new Set(windows.map(w=>w.day)).size===windows.length;
  const invalidSchedule=(data.days!=null&&!days)||(data.earliest!=null&&!earliest)||(data.latest!=null&&!latest)||
    (data.latestEnd!=null&&!latestEnd)||(data.windows!=null&&!validWindows)||
    (!!earliest&&((!!latest&&earliest>latest)||(!!latestEnd&&earliest>=latestEnd)));
  const pickMany=(value:unknown,allowed:readonly string[])=>Array.isArray(value)
    ?[...new Set(value.filter((item):item is string=>!!pick(item,allowed)))]:[];
  const positiveInteger=(value:unknown,max:number)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0&&value<=max?value:undefined;
  const maximumTotal=positiveInteger(data.maximumTotal,1_000_000_000);
  const requestedPeriods=positiveInteger(data.requestedPeriods,1000);
  const date=(value:unknown)=>{
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return undefined;
    const parsed=new Date(value+'T00:00:00Z');
    return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value?value:undefined;
  };
  const earliestDate=date(data.earliestDate),latestDate=date(data.latestDate);
  const invalidLevel=(data.level!=null&&!pick(data.level,levels))||
    (Array.isArray(data.levels)&&data.levels.some(level=>!pick(level,levels)));
  return {
    kind,level:pick(data.level,levels),period:pick(data.period,periods),format:pick(data.format,quoteFormats),
    quoteLevels:pickMany(data.levels,levels),quoteFormats:pickMany(data.formats,quoteFormats),
    detailFields:pickMany(data.fields,kind==='quote'?['price','duration','appointment']:['price','duration','first','weekly','seats','materials','teacher']),
    question:pick(data.question,consultationQuestions) as ConsultationQuestion|undefined,
    referenceIds:Array.isArray(data.referenceIds)?[...new Set(data.referenceIds.filter((id):id is string=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(id)))].slice(0,2):[],
    maximumTotal,requestedPeriods,earliestDate,latestDate,
    invalidLevel,
    days,earliest,latest,latestEnd,windows:validWindows?windows:undefined,anyTime:data.anyTime===true,
    needsReview:data.needsReview===true||invalidSchedule||
      (data.maximumTotal!=null&&!maximumTotal)||(data.earliestDate!=null&&!earliestDate)||(data.latestDate!=null&&!latestDate)||
      (!!earliestDate&&!!latestDate&&earliestDate>latestDate)||
      (data.period!=null&&!pick(data.period,periods))||(data.format!=null&&!pick(data.format,quoteFormats)),
  };
}

export function enrollmentLevelMatches(requested:string,actual:string){
  return requested===actual||(requested==='HSK 4'&&['HSK 4A','HSK 4B'].includes(actual));
}

export function enrollmentGuideRows(entries:PublicEnrollmentClass[]):EnrollmentGuideClass[]{
  return entries.slice(0,2).map(({
    id,level,courseName,batchNumber,period,format,firstLesson,weeklySchedule,schedule,sessions,minutes,price,availability,teacherType,standardPrice,opened,material,learningOutcomes,
  })=>({id,level,courseName,batchNumber,period,format,firstLesson,weeklySchedule,schedule,sessions,minutes,price,availability,teacherType,standardPrice,opened,material,learningOutcomes}));
}

export function enrollmentScheduleConflict(intent:EnrollmentIntent,row:PublicEnrollmentClass){
  const {days,earliest,latest,latestEnd,windows}=intent;
  const plan=row.weeklySchedule;
  if(!plan||intent.needsReview)return undefined;
  return plan.days.map(day=>{
    const start=enrollmentSessionStart(plan,day);
    if(!validClock(start))return undefined;
    const end=endOfSession(start,row.minutes*plan.lessons);
    const window=windows?.find(entry=>entry.day===day);
    const fits=(!days||days.includes(day))&&(!windows||!!window)&&
      (!earliest||start>=earliest)&&(!window?.earliest||start>=window.earliest)&&
      (!latest||start<=latest)&&(!window?.latestStart||start<=window.latestStart)&&
      (!latestEnd||end<=latestEnd)&&(!window?.latestEnd||end<=window.latestEnd);
    return fits?undefined:{day,start,end};
  }).find(conflict=>!!conflict);
}

type EnrollmentIntent=NonNullable<ReturnType<typeof normalizeEnrollmentIntent>>;
const scheduleKeys=['level','period','format','days','earliest','latest','latestEnd','windows','anyTime','needsReview','maximumTotal','earliestDate','latestDate'] as const;
export type ConsultationConstraints=Partial<Pick<EnrollmentIntent,typeof scheduleKeys[number]>> & {formats?:string[]};

export function resolveConsultationRecommendation(value:unknown,previous:ConsultationConstraints|undefined,learnerMessage:string){
  if(!value||typeof value!=='object'||!('kind' in value)||value.kind!=='recommend')return {value,constraints:undefined};
  const candidate=normalizeEnrollmentIntent(value);
  if(!candidate)return {value,constraints:undefined};
  const evidence='constraintEvidence' in value?value.constraintEvidence:undefined;
  const changed=typeof evidence==='string'&&evidence.trim().length>=2&&learnerMessage.includes(evidence.trim());
  const current=Object.fromEntries(scheduleKeys.map(key=>[key,candidate[key]])) as ConsultationConstraints;
  current.formats=candidate.quoteFormats;
  // A follow-up may select a particular card without changing the learner's availability.
  const constraints=previous&&!changed
    ?{...Object.fromEntries(scheduleKeys.map(key=>[key,previous[key]])) as ConsultationConstraints,formats:previous.formats}
    :current;
  const unknownLevel=!constraints.level&&candidate.invalidLevel&&(!previous||changed)&&'level' in value?value.level:undefined;
  return {value:{...value,...constraints,level:constraints.level??unknownLevel},constraints};
}

export function matchEnrollmentGuidance(intent:EnrollmentIntent,classes:PublicEnrollmentClass[]):EnrollmentGuideAction{
  const {kind,level,period,format,days,earliest,latest,latestEnd,windows,anyTime,needsReview,maximumTotal,earliestDate,latestDate}=intent;
  const filters={level,period,format};
  if(kind==='advisor'||kind==='appointment'||kind==='records'||kind==='viewing')return {kind,...filters};
  if(kind==='demand')return {kind,...filters,level:level??(intent.invalidLevel?'other':undefined),explicitDemand:true,question:intent.question};
  if(intent.invalidLevel&&!level&&!intent.quoteLevels.length)return {kind:'catalog',levelUnavailable:true};
  if(kind==='browse'||!level||needsReview||!(period||days||earliest||latest||latestEnd||windows||anyTime||earliestDate||latestDate))return {kind:'catalog',...filters,question:intent.question};
  const candidates=classes.filter(row=>
    enrollmentLevelMatches(level,row.level)&&
    (!period||row.period===period)&&(!format||row.format===format)&&
    (!intent.quoteFormats.length||intent.quoteFormats.includes(row.format))&&
    (!maximumTotal||row.price<=maximumTotal)&&(!earliestDate||row.firstLesson.slice(0,10)>=earliestDate)&&
    (!latestDate||row.firstLesson.slice(0,10)<=latestDate));
  const verifiable=candidates.filter(row=>row.price>0&&row.availability&&row.weeklySchedule?.days.length&&
    row.weeklySchedule.days.every(day=>validClock(enrollmentSessionStart(row.weeklySchedule!,day))));
  const conflictFor=(row:PublicEnrollmentClass)=>enrollmentScheduleConflict(intent,row);
  const matching=verifiable.filter(row=>!conflictFor(row))
    .sort((a,b)=>a.firstLesson.localeCompare(b.firstLesson)||a.id.localeCompare(b.id));
  const requested=intent.referenceIds.flatMap(id=>matching.filter(row=>row.id===id));
  const options=requested.length?requested:matching;
  const available=options.filter(row=>row.availability!=='full');
  const requestedConflict=verifiable.filter(row=>intent.referenceIds.includes(row.id)).map(conflictFor).find(Boolean);
  if(available.length)return {kind:'class',...filters,question:intent.question,maximumTotal,detailFields:intent.detailFields,
    rows:enrollmentGuideRows(available),scheduleConflict:requestedConflict};
  if(matching.length)return {kind:'waitlist',...filters,question:intent.question,detailFields:intent.detailFields,
    rows:enrollmentGuideRows(options),scheduleConflict:requestedConflict};
  if(candidates.length!==verifiable.length)return {kind:'unavailable',...filters,question:intent.question};
  const referenced=verifiable.find(row=>intent.referenceIds.includes(row.id));
  const commonConflict=verifiable.length?conflictFor(verifiable[0]):undefined;
  const shared=commonConflict&&verifiable.every(row=>JSON.stringify(conflictFor(row))===JSON.stringify(commonConflict))
    ?commonConflict:undefined;
  return {kind:'demand',...filters,question:intent.question,scheduleConflict:referenced?conflictFor(referenced):shared};
}
