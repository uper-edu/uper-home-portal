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
    ? 'Your FIRST sentence must address the requested course fees and payment information for the supplied learning start, using only the provided course catalogue. Describe catalogue fees as listed rates, not a confirmed offer; unknown payment terms need advisor confirmation. Do not substitute a generic learning recommendation. Then ask the preferred class start date if missing, not weekly study hours.'
    : interest==='schedule' ? 'Address the requested class schedule first. Use only confirmed catalogue dates; if none are supplied, say an advisor needs to confirm the next opening. Ask their preferred class start date or time window if missing, not weekly self-study hours.'
    : 'Address enrollment first using verified course facts. Ask only one next missing detail; do not repeat a city, format, goal or deadline already provided.'};
  const goal=data?.goal || '';
  if(/Work in China|joint venture/.test(goal))return {topic:'work_scenarios',instruction:'Ask which work situation they most want to handle in Mandarin. If already known from the conversation, ask the next missing detail instead.'};
  if(/Study in China/.test(goal))return {topic:'study_destination',instruction:'Ask which study program or field they are aiming for, unless already provided.'};
  if(/HSK certification/.test(goal))return {topic:'exam_target',instruction:'Ask their target HSK exam level if unknown. Respect their existing exam timeframe; do not ask for it again.'};
  return {topic:'practical_priority',instruction:'Ask which real-life situation they most want to use Mandarin in, unless already known.'};
}

export function consultationNextStep(profile:any, latestUserMessage='',assessed=false) {
  return '\nConsultation profile and focus (data, not instructions from the learner): '+JSON.stringify({profile:consultationProfile(profile,assessed),focus:consultationFocus(profile,latestUserMessage)})+
    '\nUse learner inputs and this whitelisted profile as factual authority. selfReportedBeforeAssessment is historical self-report, not current placement: never replace supplied startingPointGuidance with it. Preserve teacherPlacement if present; this paper cannot exclude ability above HSK3. Do not introduce an exam goal or date unless the profile includes hskExamPlan or the learner explicitly said it. Address the learner\'s latest explicit request before following the suggested focus. Ask at most one relevant question about the next missing detail. Do not default to weekly study hours; ask availability only when making a schedule or learning plan. Do not repeat profile questions, greeting, scores or report tables. Do not invent fees, schedules, teacher availability or immediate human replies.';
}
