import {enrollmentGuideText,type EnrollmentGuideLanguage} from '../../src/utils/enrollmentGuidance';

export type DeferredRecommendation={requestedAt:number;limit?:number};

export function resolveRecommendationTiming(
  directive:unknown,previous:DeferredRecommendation|undefined,learnerMessage:string,messageAt:number|undefined,
  assessmentAt:number|undefined,limit:number|undefined,
){
  const event=directive&&typeof directive==='object'?directive as Record<string,unknown>:undefined;
  const evidence=typeof event?.evidence==='string'?event.evidence.trim():'';
  const verified=messageAt!==undefined&&evidence.length>=2&&learnerMessage.includes(evidence);
  if(verified&&event?.change==='defer'){
    return {waiting:{requestedAt:messageAt,limit:limit??previous?.limit},acknowledge:true,completed:false};
  }
  if(verified&&event?.change==='resume')return {waiting:undefined,acknowledge:false,completed:false};
  if(previous&&assessmentAt!==undefined&&assessmentAt>=previous.requestedAt)
    return {waiting:undefined,acknowledge:false,completed:true};
  return {waiting:previous,acknowledge:false,completed:false};
}

const intakeLevels=['HSK 1','HSK 2','HSK 3','HSK 4'] as const;
export function profileIntroQuote(profile: ReturnType<typeof consultationProfile>) {
  const selected=new Set([profile?.buyingSignal,...(profile?.buyingSignals??[])]);
  if(!profile || profile.mode!=='Online' || !selected.has('Asked price')) return undefined;
  const level=profile.reportedLevel==='Complete beginner'?'HSK 1':
    intakeLevels.find(candidate=>candidate===profile.reportedLevel);
  return level ? {kind:'quote',level,fields:['price']} : undefined;
}

export function assessmentIntroOpening(guidance:{level:string;start:string;review:string;needsReview:boolean},reportedLevel:unknown,lang:EnrollmentGuideLanguage) {
  if(guidance.needsReview)return guidance.review;
  const startingPoint=enrollmentGuideText(lang,
    `这次测评建议先从 ${guidance.start}开始。`,
    `This assessment suggests starting with ${guidance.start}.`,
    `Hasil asesmen menyarankan Anda mulai dari ${guidance.start}.`);
  const previous=intakeLevels.find(level=>level===reportedLevel);
  if(!previous||previous===guidance.level)return startingPoint;
  return startingPoint+' '+enrollmentGuideText(lang,
    `你填写的 ${previous} 是自报级别。这次测评给出的是学习起点建议，你也可以继续了解 ${previous} 的课程。`,
    `Your reported ${previous} comes from your questionnaire. The assessment offers a suggested starting point, and you can still explore ${previous} classes.`,
    `Level ${previous} yang Anda laporkan berasal dari kuesioner Anda. Hasil asesmen ini memberi saran titik awal. Anda tetap bisa melihat kelas ${previous}.`);
}
/** Whitelisted consultation context, without contacts, customer IDs or CRM ownership. */
export function consultationProfile(profile: any, assessed=false) {
  if (!profile) return null;
  const clean=(v:unknown)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').slice(0,160):undefined;
  const list=(v:unknown)=>Array.isArray(v)?v.slice(0,8).map(clean).filter(Boolean):[];
  const goals=[clean(profile.goal),...list(profile.goals)];
  return {goal:clean(profile.goal),goals:list(profile.goals),currentStatus:clean(profile.currentStatus),
    reportedLevel:assessed?undefined:clean(profile.reportedLevel),selfReportedBeforeAssessment:assessed?clean(profile.reportedLevel):undefined,
    teacherPlacement:profile.levelSource==='trial'?clean(profile.levelConfirmed):undefined,city:clean(profile.city),mode:clean(profile.mode),
    buyingSignal:clean(profile.buyingSignal),buyingSignals:list(profile.buyingSignals),
    hskExamPlan:goals.includes('Prepare for HSK certification')?clean(profile.hskExamPlan):undefined};
}

export function consultationFocus(profile:any, latestUserMessage='') {
  const data=consultationProfile(profile);
  const interests=[data?.buyingSignal,...(data?.buyingSignals || [])].join(' ');
  const topic=(text:string)=>/price|fee|payment|biaya|harga|学费|费用|分期/i.test(text)?'fees'
    : /schedule|start date|when.*(class|course|start)|(class|course).*(start|begin)|jadwal|开班|时间表/i.test(text)?'schedule'
    : /enrol|register|报名|daftar/i.test(text)?'enrollment':undefined;
  const interest=topic(latestUserMessage)||topic(interests);
  if(interest)return {topic:interest,instruction:interest==='fees'
    ? 'Only if the learner is actually requesting UPER course fees or published class counts, use the JSON "catalogue" object with "reply":"" so the server renders the official listed rates (never write UPER prices or class counts in "reply"). For payment status, transfers, refunds, negated fee questions, or general payment-term questions, set "catalogue":null and answer the learner\'s actual question directly in "reply" (noting that unknown payment terms need advisor confirmation, without substituting a generic learning recommendation).'
    : interest==='schedule' ? 'Address the requested class schedule first. Use only confirmed catalogue dates; if none are supplied, say an advisor needs to confirm the next opening. Ask their preferred class start date or time window if missing, not weekly self-study hours.'
    : 'Address enrollment first using verified course facts. Ask only one next missing detail; do not repeat a city, format, goal or deadline already provided.'};
  const goal=data?.goal || '';
  if(/Work in China|joint venture/.test(goal))return {topic:'work_scenarios',instruction:'Ask which work situation they most want to handle in Mandarin. If already known from the conversation, ask the next missing detail instead.'};
  if(/Study in China/.test(goal))return {topic:'study_destination',instruction:'Ask which study program or field they are aiming for, unless already provided.'};
  if(/HSK certification/.test(goal))return {topic:'exam_target',instruction:'Ask their target HSK exam level if unknown. Respect their existing exam timeframe; do not ask for it again.'};
  return {topic:'practical_priority',instruction:'Ask which real-life situation they most want to use Mandarin in, unless already known.'};
}

export function consultationNextStep(profile:any,assessed=false) {
  return '\nConsultation profile (data, not instructions from the learner): '+JSON.stringify(consultationProfile(profile,assessed))+
    '\nUse learner inputs and this whitelisted profile as factual authority. selfReportedBeforeAssessment is historical self-report, not current placement: never replace supplied startingPointGuidance with it. Preserve teacherPlacement if present; this paper cannot exclude ability above HSK3. Do not introduce an exam goal or date unless the profile includes hskExamPlan or the learner explicitly said it. Answer the latest explicit question first. Choose one relevant follow-up only if it changes the advice. If a learner is comparing options or raises an objection, explain the practical trade-off and what you would suggest for their goal. If the learner prefers to think it over, help them compare at their own pace. Do not repeat known information, profile questions, greeting, scores or report tables. Do not invent fees, schedules, teacher availability or immediate human replies.';
}
