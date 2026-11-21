import {enrollmentFormats,enrollmentLevels,enrollmentPeriods,enrollmentSessionStart,enrollmentWeekdays,type PublicEnrollmentClass} from './enrollmentCatalog';
import {promotionJourneyUrl} from './promotionNavigation';

export type EnrollmentGuideLanguage='zh'|'en'|'id';
export function enrollmentReplyLanguage(value:unknown,fallback:EnrollmentGuideLanguage):EnrollmentGuideLanguage{
  return value==='zh'||value==='en'||value==='id'?value:fallback;
}
const consultationQuestions=['starting_point','apply','reserve','period_unit','quoted_price_unit','group_overview','compare_classes','price_difference','matching_tuition','private_seat_counts','clarify_timezone','clarify_local_timezone','clarify_local_schedule','compare_waitlist','appointment','view_without_contact',
  'advisor_question','advisor_send_status','link_only','records_location','unpaid_enrollment_status','cancel_unpaid','expired_unpaid','proof_after_cancellation','avoid_duplicate_payment','original_transfer_proof','cancelled_transfer_payment_and_proof','payment_verification','refund'] as const;
type ConsultationQuestion=typeof consultationQuestions[number];
const levels:readonly string[]=enrollmentLevels;
const periods:readonly string[]=enrollmentPeriods;
const formats:readonly string[]=enrollmentFormats;
const quoteFormats=[...formats,'one-on-one'];
type EnrollmentGuideClass=Pick<PublicEnrollmentClass,'id'|'level'|'courseName'|'batchNumber'|'period'|'format'|
  'firstLesson'|'weeklySchedule'|'schedule'|'minutes'|'price'|'availability'> &
  Partial<Pick<PublicEnrollmentClass,'sessions'|'teacherType'|'standardPrice'|'opened'|'material'|'learningOutcomes'|'teacher'|'classSize'>>;

export type EnrollmentGuideAction={
  kind:'catalog'|'class'|'waitlist'|'demand'|'unavailable'|'paused'|'advisor'|'appointment'|'quote'|'records'|'viewing';
  level?:string;
  period?:string;
  format?:string;
  classId?:string;
  rows?:EnrollmentGuideClass[];
  linkOnlyClassIds?:string[];
  replyLanguage?:EnrollmentGuideLanguage;
  explicitDemand?:boolean;
  quoteMissing?:boolean;
  quotes?:EnrollmentQuote[];
  offline?:boolean;
  inspection?:boolean;
  referenceUnavailable?:boolean;
  missingClassLevels?:string[];
  requestedPeriods?:number;
  detailFields?:string[];
  question?:ConsultationQuestion;
  maximumTotal?:number;
  intakePaused?:boolean;
  readinessReasons?:string[];
  recordsAvailable?:boolean;
  levelUnavailable?:boolean;
  scheduleConfirmed?:boolean;
  firstDateConflict?:boolean;
  scheduleConflict?:{day:number;start:string;end:string};
  preferredSchedule?:DayWindow[];
  requestedLevel?:string;
};
export type EnrollmentQuote={
  id:string;level:string;format:string;period?:string;batchNumber?:number;
  periods:number;minutes:number;actual:number;standard?:number;unitPriced:boolean;
  course?:string;teacherType?:'local'|'foreign';
  classSize?:PublicEnrollmentClass['classSize'];
};
export const enrollmentGuideText=(lang:EnrollmentGuideLanguage,zh:string,en:string,id:string)=>({zh,en,id})[lang];
export const enrollmentAppointmentRequested=(action:EnrollmentGuideAction)=>action.kind==='appointment'||
  (action.kind==='quote'&&(action.question==='appointment'||action.detailFields?.includes('appointment')));

export function withExplicitChatAppointmentTime(action:EnrollmentGuideAction|undefined,value:unknown,learnerMessage:string){
  if(!action||!enrollmentAppointmentRequested(action))return action;
  const preference=value&&typeof value==='object'?value as Record<string,unknown>:undefined;
  const evidence=typeof preference?.evidence==='string'?preference.evidence.trim():'';
  const period=typeof preference?.period==='string'&&periods.includes(preference.period)&&
    evidence.length>=2&&learnerMessage.includes(evidence)?preference.period:undefined;
  return {...action,period};
}

export function enrollmentGuideHref(action:EnrollmentGuideAction,lang:EnrollmentGuideLanguage,via:'ai_chat'|'whatsapp',source=new URLSearchParams()){
  const {kind,classId,level,period,format}=action;
  const query=new URLSearchParams({lang,enrollment_via:via});
  if(level&&levels.includes(level))query.set('level',level.slice(4,5));
  else if(level==='other'&&kind==='demand')query.set('level','other');
  else if(kind==='catalog'||kind==='paused'||kind==='unavailable')query.set('level','all');
  if(period&&(periods.includes(period)||kind==='demand'&&period==='weekday-day'))query.set('period',period);
  if(format&&(formats.includes(format)||format==='one-on-one'))query.set('format',format);
  let path='/enrollment';
  if((kind==='class'||kind==='waitlist')&&classId){
    path+='/'+encodeURIComponent(classId);
    if(kind==='waitlist')query.set('apply','1');
  }
  if(kind==='demand'){
    path+='/interest';
    if(action.preferredSchedule?.length)query.set('schedule',JSON.stringify(action.preferredSchedule));
    const requested=unlistedLevel(action.requestedLevel);
    if(level==='other'&&requested)query.set('requestedLevel',requested);
  }
  if(kind==='advisor')path+='/help/consultation';
  if(kind==='advisor'&&action.offline)query.set('mode','offline');
  if(kind==='records'||kind==='paused'&&action.recordsAvailable)path+='/mine';
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

export function enrollmentDemandPrefill(params:URLSearchParams,lang:EnrollmentGuideLanguage='zh'){
  const level=params.get('level'),period=params.get('period'),format=params.get('format');
  const raw=params.get('schedule');
  let schedule:unknown;
  if(raw&&raw.length<=650)try{schedule=JSON.parse(raw);}catch{/* An invalid URL has no schedule prefill. */}
  const windows=normalizeEnrollmentIntent({kind:'demand',windows:schedule})?.windows;
  const requested=level==='other'?unlistedLevel(params.get('requestedLevel')):undefined;
  return {
    level:level==='1'?'HSK 1':level==='2'?'HSK 2':level==='3'?'HSK 3':level==='4'?'HSK 4':level==='other'?'other':'unsure',
    period:period==='weekend'||period==='weekday-evening'||period==='weekday-day'||period==='mixed'?period:'any',
    format:format==='standard'||format==='small'||format==='one-on-one'?format:'any',
    notes:[requested,enrollmentPreferenceScheduleText(windows,lang)].filter(Boolean).join('\n'),phone:'',
  } as const;
}

const validClock=(value:unknown):value is string=>typeof value==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const unlistedLevel=(value:unknown)=>typeof value==='string'&&/^HSK [1-9][AB]?$/.test(value)&&!levels.includes(value)?value:undefined;
const minuteOfDay=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3));
const endOfSession=(start:string,duration:number)=>{
  const end=minuteOfDay(start)+duration;
  return [Math.floor(end/60),end%60].map(n=>String(n).padStart(2,'0')).join(':');
};
const intentKinds=['recommend','browse','advisor','appointment','demand','quote','inspect','specifications','records','viewing'] as const;
type EnrollmentIntentKind=typeof intentKinds[number];
type DayWindow={day:number;earliest?:string;latestStart?:string;latestEnd?:string};

export function enrollmentPreferenceScheduleText(windows:DayWindow[]|undefined,lang:EnrollmentGuideLanguage){
  if(!windows?.length)return '';
  const index=lang==='zh'?0:lang==='en'?1:2;
  const t=(zh:string,en:string,id:string)=>enrollmentGuideText(lang,zh,en,id);
  const entries=windows.map(({day,earliest,latestStart,latestEnd})=>{
    const label=enrollmentWeekdays[day-1][index];
    const limits=earliest&&earliest===latestStart?[earliest]:[
      earliest&&t(`从 ${earliest} 起`,`from ${earliest}`,`mulai ${earliest}`),
      latestStart&&t(`最晚 ${latestStart} 开始`,`start by ${latestStart}`,`mulai paling lambat ${latestStart}`),
    ];
    if(latestEnd)limits.push(t(`最晚 ${latestEnd} 下课`,`finish by ${latestEnd}`,`selesai paling lambat ${latestEnd}`));
    return [label,...limits.filter(Boolean)].join(' ');
  });
  return entries.join(lang==='zh'?'；':'; ')+(windows.some(window=>window.earliest||window.latestStart||window.latestEnd)?' WIB':'');
}
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
  const question=pick(data.question,consultationQuestions) as ConsultationQuestion|undefined;
  const referenceIds=Array.isArray(data.referenceIds)
    ?[...new Set(data.referenceIds.filter((id):id is string=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(id)))]:[];
  return {
    kind,level:pick(data.level,levels),requestedLevel:unlistedLevel(data.level??data.requestedLevel),
    period:pick(data.period,periods),format:pick(data.format,quoteFormats),
    quoteLevels:pickMany(data.levels,levels),quoteFormats:pickMany(data.formats,quoteFormats),
    detailFields:pickMany(data.fields,kind==='quote'?['price','duration','appointment']:['price','duration','first','weekly','seats','materials','teacher','class_size','outcomes']),
    question,
    timeConversion:(kind==='recommend'||kind==='quote'&&question==='matching_tuition')&&typeof data.timeConversion==='string'
      ?data.timeConversion.trim():undefined,
    referenceIds:question==='quoted_price_unit'?referenceIds:referenceIds.slice(0,2),
    quoteReferenceEvidence:question==='quoted_price_unit'&&typeof data.quoteReferenceEvidence==='string'
      ?data.quoteReferenceEvidence.trim():undefined,
    maximumTotal,requestedPeriods,earliestDate,latestDate,maxRecommendations:positiveInteger(data.maxRecommendations,2),batchNumber:positiveInteger(data.batchNumber,1_000_000),
    maximumWeeklySessions:positiveInteger(data.maximumWeeklySessions,7),
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

export function enrollmentGuideRows(entries:PublicEnrollmentClass[],limit=2):EnrollmentGuideClass[]{
  return entries.slice(0,limit).map(({
    id,level,courseName,batchNumber,period,format,firstLesson,weeklySchedule,schedule,sessions,minutes,price,availability,teacherType,standardPrice,opened,material,learningOutcomes,teacher,classSize,
  })=>({id,level,courseName,batchNumber,period,format,firstLesson,weeklySchedule,schedule,sessions,minutes,price,availability,teacherType,standardPrice,opened,material,learningOutcomes,teacher,classSize}));
}

export function enrollmentClassComparison(levels:readonly string[],entries:PublicEnrollmentClass[]){
  const rows:PublicEnrollmentClass[]=[];
  const missingClassLevels:string[]=[];
  for(const level of levels){
    const match=entries.find(row=>row.level===level)??entries.find(row=>enrollmentLevelMatches(level,row.level));
    if(!match)missingClassLevels.push(level);
    else if(!rows.some(row=>row.id===match.id))rows.push(match);
  }
  return {rows,missingClassLevels};
}

export function repeatedEnrollmentCards(action:EnrollmentGuideAction,history:EnrollmentGuideAction[]){
  return action.rows?.filter(row=>{
    const previous=history.find(item=>item.rows?.some(candidate=>candidate.id===row.id))?.rows?.find(candidate=>candidate.id===row.id);
    return previous&&previous.availability===row.availability&&previous.opened===row.opened&&
      previous.price===row.price&&previous.firstLesson===row.firstLesson;
  }).map(row=>row.id)??[];
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
const scheduleKeys=['level','requestedLevel','period','format','days','earliest','latest','latestEnd','windows','anyTime','needsReview','maximumTotal','earliestDate','latestDate','maximumWeeklySessions'] as const;
export type ConsultationConstraints=Partial<Pick<EnrollmentIntent,typeof scheduleKeys[number]>> & {formats?:string[]};

export function resolveEnrollmentComparison(value:unknown,pair:readonly string[]){
  const intent=normalizeEnrollmentIntent(value);
  if(intent?.kind!=='inspect'||!['compare_classes','price_difference'].includes(intent.question??'')||!value||typeof value!=='object')return value;
  const requested=intent.referenceIds;
  const referenceIds=requested.length===2?requested:
    pair.length===2&&requested.every(id=>pair.includes(id))?pair:[];
  return {...value,referenceIds,maxRecommendations:2};
}

export function hasConsultationEvidence(evidence:unknown,learnerMessage:string){
  if(typeof evidence!=='string')return false;
  const quote=evidence.trim();
  if(quote.length>=2&&learnerMessage.includes(quote))return true;
  const closing:Record<string,string>={'“':'”','‘':'’','"':'"',"'":"'",'「':'」','『':'』'};
  const last=closing[quote[0]];
  if(!last||!quote.endsWith(last))return false;
  const inner=quote.slice(1,-1).trim();
  return inner.length>=2&&learnerMessage.includes(inner);
}

export function resolveConsultationRecommendation(value:unknown,previous:ConsultationConstraints|undefined,learnerMessage:string,criteria?:unknown){
  const hasEvidence=(evidence:unknown)=>hasConsultationEvidence(evidence,learnerMessage);
  const update=criteria&&typeof criteria==='object'&&'evidence' in criteria&&hasEvidence(criteria.evidence)
    ?criteria as Record<string,unknown>:undefined;
  const subjectChanged=update?.subjectChanged===true;
  const intent=normalizeEnrollmentIntent(value);
  const matchingTuition=intent?.kind==='quote'&&intent.question==='matching_tuition';
  const preferenceEntry=intent?.kind==='demand'||intent?.kind==='viewing';
  const admissionEntry=intent?.kind==='browse'&&['apply','reserve'].includes(intent.question??'');
  const supportsCriteria=intent&&(['recommend','inspect','quote','specifications','advisor'].includes(intent.kind)||preferenceEntry||admissionEntry);
  const tracksCriteria=intent?.kind==='recommend'||matchingTuition||!!update||preferenceEntry||admissionEntry;
  if(!tracksCriteria)return {value,constraints:undefined};

  const input=typeof value==='object'&&value!==null?value:{};
  const candidate=intent??normalizeEnrollmentIntent({kind:'browse'})!;
  const changed='constraintEvidence' in input&&hasEvidence(input.constraintEvidence);
  const current=Object.fromEntries(scheduleKeys.map(key=>[key,candidate[key]])) as ConsultationConstraints;
  current.formats=candidate.quoteFormats;
  const inherited=!subjectChanged&&(candidate.kind==='recommend'||candidate.kind==='inspect'||matchingTuition||preferenceEntry||admissionEntry||!supportsCriteria)
    ?previous:undefined;
  const constraints=inherited&&(update||!changed)
    ?{...Object.fromEntries(scheduleKeys.map(key=>[key,inherited[key]])) as ConsultationConstraints,formats:inherited.formats}
    :subjectChanged?{}:current;
  if(update){
    const changes=Object.fromEntries([...scheduleKeys.filter(key=>key!=='requestedLevel'),'formats'].filter(key=>Object.hasOwn(update,key))
      .map(key=>[key,update[key]]));
    // Use one representation of a weekly schedule so superseded days and hours cannot narrow it.
    if(Object.hasOwn(changes,'windows')||Object.hasOwn(changes,'days')||changes.anyTime===true){
      Object.assign(constraints,{days:undefined,windows:undefined,earliest:undefined,latest:undefined,latestEnd:undefined,anyTime:false});
    }
    if(Object.hasOwn(changes,'format'))constraints.formats=[];
    if(Object.hasOwn(changes,'formats'))constraints.format=undefined;
    if(Object.hasOwn(changes,'level'))constraints.requestedLevel=undefined;
    const start=update.firstSession;
    if(Object.hasOwn(update,'firstSession')){
      constraints.earliestDate=inherited?.earliestDate;
      constraints.latestDate=inherited?.latestDate;
      if(start&&typeof start==='object'&&'bound' in start&&'date' in start&&typeof start.date==='string'){
        if(start.bound==='on_or_after'||start.bound==='on')changes.earliestDate=start.date;
        if(start.bound==='on_or_before'||start.bound==='on')changes.latestDate=start.date;
      }
      if(!Object.hasOwn(changes,'earliestDate')&&!Object.hasOwn(changes,'latestDate'))changes.needsReview=true;
    }
    const checked=normalizeEnrollmentIntent({kind:candidate.kind,...constraints,...changes});
    if(!checked) return {value,constraints:undefined};
    Object.assign(constraints,Object.fromEntries(scheduleKeys.map(key=>[key,checked[key]])),{formats:checked.quoteFormats});
  }
  const currentDays=constraints.windows?.map(window=>window.day)??constraints.days;
  if(currentDays?.length){
    const weekendOnly=currentDays.every(day=>day>=6);
    const weekdayOnly=currentDays.every(day=>day<6);
    if(weekendOnly&&constraints.period&&constraints.period!=='weekend')constraints.period='weekend';
    if(weekdayOnly&&(constraints.period==='weekend'||constraints.period==='mixed'))constraints.period=undefined;
  }
  const count=normalizeEnrollmentIntent({kind:candidate.kind,maxRecommendations:update?.count})?.maxRecommendations;
  const unknownLevel=!constraints.level&&candidate.invalidLevel&&(!inherited||changed)&&'level' in input?input.level:undefined;
  const tentativeLevel=candidate.kind==='recommend'&&(!subjectChanged||constraints.windows?.length||constraints.days?.length)
    ?candidate.level:undefined;
  const level=constraints.level??constraints.requestedLevel??tentativeLevel??(matchingTuition?candidate.level:undefined)??unknownLevel;
  return {value:supportsCriteria?{...input,...constraints,maxRecommendations:count??candidate.maxRecommendations,level}:value,
    constraints};
}

export function enrollmentClassMatchesTiming(intent:EnrollmentIntent,row:PublicEnrollmentClass){
  const weekly=Boolean(intent.days||intent.windows||intent.earliest||intent.latest||intent.latestEnd);
  return !intent.needsReview&&enrollmentFirstDateMatches(intent,row)&&
    (!intent.maximumWeeklySessions||Boolean(row.weeklySchedule?.days.length&&row.weeklySchedule.days.length<=intent.maximumWeeklySessions))&&
    (!weekly||Boolean(row.weeklySchedule?.days.length&&
      row.weeklySchedule.days.every(day=>validClock(enrollmentSessionStart(row.weeklySchedule!,day)))&&
      !enrollmentScheduleConflict(intent,row)));
}

export function enrollmentFirstDateMatches({earliestDate,latestDate}:EnrollmentIntent,row:PublicEnrollmentClass){
  const date=row.firstLesson.slice(0,10);
  return (!earliestDate||date>=earliestDate)&&(!latestDate||date<=latestDate);
}

export function matchEnrollmentGuidance(intent:EnrollmentIntent,classes:PublicEnrollmentClass[]):EnrollmentGuideAction{
  const {kind,level,period,format,days,earliest,latest,latestEnd,windows,anyTime,needsReview,maximumTotal,earliestDate,latestDate,maximumWeeklySessions}=intent;
  const filters={level,period,format};
  if(kind==='advisor'||kind==='appointment'||kind==='records'||kind==='viewing')return {kind,...filters};
  const preferredSchedule=intent.needsReview?undefined:windows??days?.map(day=>({day,earliest,latestStart:latest,latestEnd}));
  const includesWeekdays=preferredSchedule?.some(window=>window.day<=5);
  const includesWeekend=preferredSchedule?.some(window=>window.day>=6);
  const demandFilters={...filters,preferredSchedule,format:format??(intent.quoteFormats.length===1?intent.quoteFormats[0]:undefined),period:
    includesWeekend?(includesWeekdays?period??'mixed':'weekend'):
    preferredSchedule?.length&&preferredSchedule.every(window=>window.day<=5&&window.latestEnd&&window.latestEnd<='18:00')?'weekday-day':
    period};
  if(kind==='demand')return {kind,...demandFilters,level:level??(intent.invalidLevel?'other':undefined),
    requestedLevel:intent.requestedLevel,explicitDemand:true,question:intent.question};
  if(intent.invalidLevel&&!level&&!intent.quoteLevels.length)return {kind:'catalog',levelUnavailable:true};
  const convertedSchedule=kind==='recommend'&&intent.timeConversion&&(windows||earliest||latest||latestEnd);
  if(kind==='browse'||(!level&&!convertedSchedule)||needsReview||!(period||days||earliest||latest||latestEnd||windows||anyTime||earliestDate||latestDate||maximumWeeklySessions))return {kind:'catalog',...filters,question:intent.question};
  const candidates=classes.filter(row=>
    (!level||enrollmentLevelMatches(level,row.level))&&
    (!period||row.period===period)&&(!format||row.format===format)&&
    (!intent.quoteFormats.length||intent.quoteFormats.includes(row.format))&&
    (!maximumTotal||row.price<=maximumTotal)&&enrollmentFirstDateMatches(intent,row));
  const verifiable=candidates.filter(row=>row.price>0&&row.availability&&row.weeklySchedule?.days.length&&
    row.weeklySchedule.days.every(day=>validClock(enrollmentSessionStart(row.weeklySchedule!,day))));
  const conflictFor=(row:PublicEnrollmentClass)=>enrollmentScheduleConflict(intent,row);
  const matching=verifiable.filter(row=>enrollmentClassMatchesTiming(intent,row))
    .sort((a,b)=>a.firstLesson.localeCompare(b.firstLesson)||a.id.localeCompare(b.id));
  const requested=intent.referenceIds.flatMap(id=>matching.filter(row=>row.id===id));
  const options=intent.referenceIds.length?requested:matching;
  const available=options.filter(row=>row.availability!=='full');
  const requestedConflict=verifiable.filter(row=>intent.referenceIds.includes(row.id)).map(conflictFor).find(Boolean);
  if(available.length){
    const formats=intent.quoteFormats.filter(format=>format!=='one-on-one');
    const comparison=!intent.referenceIds.length&&formats.length>1;
    const selected=comparison?formats.flatMap(requested=>available.find(row=>row.format===requested)??[]):available;
    return {kind:'class',...filters,question:intent.question,maximumTotal,detailFields:intent.detailFields,
      rows:enrollmentGuideRows(selected,comparison?formats.length:intent.maxRecommendations)};
  }
  if(options.length)return {kind:'waitlist',...filters,question:intent.question,detailFields:intent.detailFields,
    rows:enrollmentGuideRows(options,intent.maxRecommendations)};
  if(intent.referenceIds.length&&!requestedConflict)return {kind:'unavailable',...filters,referenceUnavailable:true,question:intent.question};
  if(candidates.length!==verifiable.length)return {kind:'unavailable',...filters,question:intent.question};
  const referenced=verifiable.find(row=>intent.referenceIds.includes(row.id));
  const commonConflict=verifiable.length?conflictFor(verifiable[0]):undefined;
  const shared=commonConflict&&verifiable.every(row=>JSON.stringify(conflictFor(row))===JSON.stringify(commonConflict))
    ?commonConflict:undefined;
  return {kind:'demand',...demandFilters,question:intent.question,scheduleConflict:referenced?conflictFor(referenced):shared};
}
