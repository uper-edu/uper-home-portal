import {enrollmentReadinessMessage} from '../../src/utils/enrollmentReadinessCopy.ts';
import { readPublicEnrollmentAppointments, readPublicEnrollmentClasses } from './enrollmentCatalog.ts';
import { enrollmentReadiness } from './enrollmentApplication.ts';
import { formatCurrency } from '../../src/utils/currency.ts';
import {
  enrollmentClassSizeText, enrollmentClassTitle, enrollmentInstant, enrollmentTeacherLabel, enrollmentWeeklyScheduleText, enrollmentWeekdays,
} from '../../src/utils/enrollmentCatalog.ts';
import {
  enrollmentAppointmentRequested, enrollmentClassComparison, enrollmentClassMatchesTiming, enrollmentFirstDateMatches, enrollmentGuideRows, enrollmentGuideText, enrollmentLevelMatches, enrollmentPreferenceScheduleText, enrollmentScheduleConflict, matchEnrollmentGuidance,
  normalizeEnrollmentIntent, sharedEnrollmentComparison, type ConsultationConstraints, type EnrollmentGuideAction, type EnrollmentGuideLanguage, type EnrollmentQuote,
} from '../../src/utils/enrollmentGuidance.ts';

export const chatEnrollmentInstruction = `
For any UPER Mandarin course or Enrollment request, use the optional "enrollment" field in your JSON response. It takes priority over "catalogue", which is only for non-Enrollment programmes. Set catalogue:null for Enrollment. Choose the action that resolves the current task:
- For concrete class suggestions, a known HSK level and a first-class date or date window are enough for recommend. A learner does not need to supply weekly availability first. When the learner asks for one standard and one small-group option, set kind:"recommend", level, formats:["standard","small"], and maxRecommendations:2. Do not set format or a single-class limit for a request of one per format.
- When the learner switches to a different person, emit classCriteria with subjectChanged:true, exact evidence for the switch, and that person's known criteria (including their complete weekly windows), even if enrollment is null or you need to clarify the level. Do not carry over the previous person's schedule, course, budget, assessment, or class references. Do not store a suggested learning level as confirmed.
- Emit a top-level "classCriteria" when the current learner turn adds, corrects, or explicitly narrows class facts or matching criteria, including in an inspect or tuition turn. Include "evidence" with an exact quote from this turn and only the changed fields. A weekday availability change must include complete updated "windows", retaining days and hours that still apply. For a stated first-class boundary, emit "firstSession":{"bound":"on_or_after","date":"YYYY-MM-DD"} for "at least next month" or "not before"; calculate the first day in WIB. Use "on_or_before" for a deadline and "on" for an exact date. For a request to find one class, including after an assessment, emit "count":1. For a weekday or weekend price request include "period" even when prices happen to be the same. Keep any referenced class IDs in the enrollment action. Current constraints override earlier restrictions and do not disappear merely because you choose inspect or quote.
- quote: current tuition, a cost breakdown, or a PRICE comparison by class type. "levels":["HSK 1"], "formats":["standard","small","one-on-one"]. Use "level" for a single target; no level means all levels only if the learner asked for general prices. Use "requestedPeriods" for a private lesson quantity the learner explicitly asks about. One-to-one price questions use quote, not appointment. A learning-experience comparison is not a price request; answer it directly without replacing it with a price list.
 If the learner asks what classes fit their stated availability and roughly how much, including a short price follow-up about that person's options, use question:"matching_tuition". Apply that person's saved weekly windows. Use a reasonable level from context as the scope to check, without claiming placement. Do not substitute a private lesson quote for checking group classes unless the learner specifically asks for private lessons.
 When the learner asks which amount just quoted is the total and which is per period, set kind:"quote", question:"quoted_price_unit". An unqualified reference to the prior prices includes every previously quoted option, including one-to-one. Leave referenceIds empty in that case. Only when the learner expressly narrows the price question to specific quoted options, set their referenceIds and quoteReferenceEvidence to an exact excerpt from this turn that identifies those options. Evaluate the price question and scheduling question separately. If the learner also asks whether private lessons can be booked as a fixed class or how to arrange them, include "appointment" in fields even when the price question covers all options. Include the appointment's level when known. Use question:"period_unit" for a general question about the billing unit without referring to a prior amount. Omit fields for a standalone question about the unit. If the same turn also asks for current amounts or a cost breakdown, include "price" in fields.
 If the learner asks how many people and how much a small group or standard class generally costs, use quote with question:"group_overview" and the requested format. Keep the target level if known from the current discussion. Do not select a batch unless the learner refers to a specific class. This is a format question even if classes were shown earlier. The server will answer the size and verified price before offering a filtered catalogue link.
- recommend: recommend real classes, check concrete availability, or update a recommendation after preferences changed. For example {"kind":"recommend","level":"HSK 3","format":"standard","windows":[{"day":5,"earliest":"19:00"},{"day":6,"earliest":"15:00","latestEnd":"17:00"}]}. Days are ISO Monday=1 to Sunday=7. All confirmed times are WIB. earliest/latest refer to start; latestEnd refers to when the student must leave. windows lists ALL currently available days when day-specific constraints are known. Use the latest learner-stated constraints, including corrections. Set anyTime only for explicitly flexible timing. Use needsReview only when an unresolved constraint genuinely affects the recommendation (e.g. unknown timezone, unresolved level); do not use it for representable multi-day availability.
 For a hard total budget in Indonesian rupiah set maximumTotal (an integer); for a latest or earliest allowed first class, use latestDate or earliestDate (YYYY-MM-DD in WIB). Never imply that an out-of-budget class matches.
 Use the published schedule's WIB for ordinary browsing and confirmed Jakarta preferences. If the learner gives an availability time and says they are elsewhere, or says it is their local time, and you don't know whether that time is WIB or which timezone applies, return kind:"browse", question:"clarify_timezone". If the learner has already confirmed it is their local time but the city or timezone is still unknown, use question:"clarify_local_timezone" instead. Ask about the city or timezone before promising to filter or recommending a class. Once a learner's local timezone is known, send the UNCONVERTED local time and days to the server. Use top-level localSchedule: {"timeZone":"Asia/Tokyo","zoneEvidence":"exact learner quote identifying the city or time zone","availabilityEvidence":"exact learner quote stating their original availability","windows":[{"day":6,"earliest":"15:00","latestStart":"15:00"},{"day":7,"earliest":"15:00","latestStart":"15:00"}]}. Day numbers are Monday 1 to Sunday 7, in the learner's own zone. Reuse the relevant learner messages if the current turn only supplies their location. Use IANA zones. Do not calculate or write the WIB conversion, and do not filter by a WIB weekday or period at this stage. Set catalogue:null and kind:"recommend", or kind:"quote" with question:"matching_tuition" if tuition is also requested. Keep the known level or leave it unset to check all levels. For a statement of an exact starting time, include equal earliest and latestStart. The server converts the day and time and uses the same result in the reply and match. If a previously known local schedule is explicitly withdrawn or the learner gives a new time explicitly in WIB, use the new conditions normally and omit localSchedule. An ordinary enquiry without any indication of a different timezone can use the published WIB schedule. Valid period values are weekend, weekday-evening or mixed; express "afternoon" etc. in time windows. When a beginner explicitly asks to find a class and has no conflicting placement, HSK 1 is a suggested starting point.
 Only set format or formats as a filter when the learner specifically requests those class types. For example, wanting to speak more does not mean they can only accept a small group. If the learner has multiple acceptable types use formats rather than choosing one for them. Never replace known hard restrictions in a follow-up that only asks for details or a reason. To replace any existing constraint, include constraintEvidence as an exact quote from the CURRENT learner message that changes the requirement and supply the full revised constraints, including those unchanged.
- inspect: answer a follow-up about actual fees, dates, schedules, duration, or seats for classes previously shown. Put their IDs (in the order asked) in "referenceIds". Use ONLY IDs provided in the previous recommendation context. For a singular "that class", "same class" or ordinal reference, set "maxRecommendations":1 and use its single ID. If the singular reference has no unique focus but the shown classes have the same requested facts, use the first shown ID; otherwise ask which class. Keep that class when availability changes. A recent focus on one class must not hide the original pair when the learner asks about the two classes. Choose "fields" from price, duration, first, weekly, seats, materials, teacher, class_size, outcomes. Use recommend for changed constraints when finding new options; for a named or referenced class being rechecked, use inspect and provide the new classCriteria.
 If the learner asks why the two shown classes cost different amounts, use inspect with question:"price_difference", both referenceIds, and fields:["price","class_size"]. The server explains the difference from verified periods and tuition. When asked about both classes' size, use kind:"inspect", question:"compare_classes", both referenceIds, and fields:["class_size"]. For other comparisons of previously shown classes, use kind:"inspect", question:"compare_classes", and both referenceIds from the relevant pair. Do not carry forward a single-class limit from a previous turn. When it only asks about first class dates, set fields:["first"]; do not add application instructions.
- specifications: look up official textbook, teaching outcomes, number of periods or teacher type when the learner asks for those facts in the current turn. Include the requested level, optional levels array, format and period, or supplied referenceIds for specific classes. Do not guess the textbook or staffing. A follow-up asking which of two levels suits them is a learning advice question, not another request for textbook or teacher facts. Explain the trade-off in reply (starting from scratch versus already comfortable with basic Mandarin) and ask about their foundation if unknown. Do not infer the language of instruction, amount of speaking practice or individual feedback from teacher type or call previously supplied Enrollment facts unverified merely because the current question asks for advice. For advice without a concrete fact or class request, use enrollment:null or browse if a browsing link would help.
 In a class or tuition comparison, a bare "小班具体有多少人？", "how many people in a small group?" or "berapa orang di kelas kecil?" means the published class size. Use class_size, not seats. When asked about the other class following a size question, keep class_size. For a question about class size or maximum, the named teacher, or learning outcomes, use inspect with known referenceIds, or specifications with the requested level, format, period, batchNumber or exact first date (equal earliestDate and latestDate). Only include the fields asked for: class_size, teacher, outcomes, or seats. When the current turn asks for actual occupied seats, paid learner counts, or the minimum to confirm opening, set question:"private_seat_counts", include "seats" in fields, and put the exact words explicitly asking about current occupancy, paid learners or opening thresholds in enrollment.privateCountEvidence. A bare how-many question is not explicit evidence. Do this even if the learner asks for availability as a fallback. Answer with the public availability status only. Omit any mention of the internal figures or their disclosure policy. Seat status gives approximate availability, never exact remaining seats or occupancy. Distinguish the advertised group size from the current number of learners.
- demand: the learner requests the existing course preference form or wants to register what they need without enrolling. Return demand even with missing fields, even if no class has been checked. Also use it when recommendation explicitly concludes that a preference form is their best next step. Use safe known level, period, and format filters. When the learner explicitly asks for just the link, set question:"link_only". Do not say the form does not exist. It does not reserve a seat or take payment.
- advisor: the learner explicitly requests a person, asks how or what to ask an advisor, asks whether this chat sent an advisor message, or wants an offline option that requires validation. Include the level, format, and period already known from the conversation. For offline set "offline":true. When asked how or what to ask, or when the learner updates their course or schedule while arranging a handoff, set question:"advisor_question" and put practical wording the learner can send in reply, using their known constraints and asking the advisor to confirm unverified details. For a send-status question, set question:"advisor_send_status" and leave reply empty so the server can answer directly. Leave reply empty for other advisor handoffs. The server provides the contact button. This chat does not send messages to advisors.
- appointment: the learner asks how to arrange private lessons, or wants to book a time. Include level and preferred period if known. Use fields:["price"] only when they ask for the price in this turn. If the same turn explicitly asks both price and how to arrange it, use appointment with that field, or quote with question:"appointment".
  For any one-to-one booking link, set top-level appointmentTime with period (weekend, weekday-evening or mixed) and evidence (an exact quote from the current learner message) only if they expressly state that time preference for one-to-one lessons. If the preference concerned a group class, or if the current private lesson request gives no time preference, omit appointmentTime. The server will only pass a verified one-to-one preference to the advisor.
- records: the learner asks about their own enrollment, cancelling an unpaid order, uploading a receipt, payment verification, or a refund. They must verify their email. Set question to the most specific current situation. If the learner says they selected a class or started enrollment but have not transferred money or submitted proof, and are not asking to cancel or about the deadline, use "unpaid_enrollment_status", even if they just state their situation without an explicit question. If this turn only asks where or how to open their order, payment status or refund status, set question:"records_location". If the learner reports a previous transfer and this turn asks whether or where to pay again, including to keep the seat while verification is pending, use "avoid_duplicate_payment" whether or not cancellation was mentioned. Do not use it for an explicitly unpaid balance after a partial payment has already been verified. Use "proof_after_cancellation" if the learner has already transferred and says the class or order may be cancelled, expired, or closed. For follow-ups in that context use "original_transfer_proof" when it asks what evidence to provide or how to prove the transfer, and "cancelled_transfer_payment_and_proof" if it asks both about paying again and providing proof. Use "payment_verification" only for an ordinary or partial-payment verification question. Use "cancel_unpaid" for whether an unpaid order can be cancelled, "expired_unpaid" for what happens when an unpaid order passes its deadline, or "refund" for refund eligibility, processing or timing questions.
- A learner saying "someone helped me apply for a refund" is reporting a pending refund request, even without a question mark. For that turn, and any refund approval, timing, or processing question, emit top-level "policyTopic":"refund" and enrollment:{"kind":"records","question":"refund"}. Only if they just ask where to look, use "records_location". The server gives the approval prerequisite and verified order entry. Do not generate or infer an approval in reply.
- viewing: asks whether browsing requires a phone or email, or explicitly wants to see details without applying. Use this even if the learner mentions a previously shown schedule and their main question is whether they need to leave contact information. The server already states that browsing needs no contact details. Put any other substantive answer in reply, such as suitability for beginners, differences between class types or criteria to compare. If the learner only asks about contact details or a link, use an empty reply. If they also explicitly ask for the exact current schedule, use inspect or recommend with question:"view_without_contact" and fields:["weekly"]. Include level if known. For an explicitly unrestricted catalogue request, use browse instead. Never infer consent.
 For demand or viewing, preserve the current learner's verified preferences. If the learner changes or withdraws criteria or changes the learner, include classCriteria with evidence from this turn and the changes, using null to clear withdrawn fields. When changing the weekly schedule, include the complete remaining allowed days and bounds.
 A question about whether studying HSK 1 guarantees fluent conversation is learning advice. Set top-level learningAdvice:"fluency_expectations", enrollment:null and catalogue:null for that question. Answer the guarantee and offer a practice suggestion. A question about the published learning outcomes of a specific class still uses its official facts.
- browse: discovery without enough constraints for a specific recommendation. On a saved assessment introduction, always include a browsing entry for the suggested level unless the learner explicitly declined; preserve your brief learning recommendation in reply.
Treat negation, quoted past questions, hypotheticals and deferral according to the current context, not as action confirmations. A refusal to enroll does not prevent answering a price or comparison question. Use enrollment:null when there is no desired or relevant action. A request for a clear next step is not consent to a submission.
 If the learner explicitly names an out-of-catalogue level, keep that exact level in the structured action. Do not suggest a different level unless asked. Answer substantive learning questions even when the learner chooses only to browse. The server will explain which enrollment data is actually available.
 For quote, inspect, or recommend, mark the current question as "period_unit" when the learner asks whether price is per period or per multi-period session, "reserve" when asking if chat can hold a seat, or "apply" when they ask whether they can enroll now or how to apply, even with no level or time preference. For this question, return kind:"browse" with question:"apply" when there are no specific class constraints; the server checks current registration availability. Do not assert that registration is open in the prose. Set "starting_point" whenever a beginner or a learner with a saved assessment asks which level or class to start with, including when they also give their schedule. For a compound question include the requested facts in fields (e.g. ["duration","price"] for reference prices and lesson length or ["weekly"] for the two days' exact times). Set maxRecommendations to 1 when the current learner asks for only one recommendation. On a recommendation use referenceIds only when the current request explicitly points to a previously shown class. Resolve ordinal references using the ordered previous recommendation and resolve an unambiguous singular reference using the last focused class if there is one. If a singular reference could mean either of two previously recommended classes, keep both only to answer a requested fact they share. If the facts differ, ask which class the learner means instead of guessing. Never replace the referenced class with another option unless the learner asks for alternatives. A limit on recommendations alone does not weaken earlier time restrictions. Compare every weekly session, including its end time. Leave off question if no such guidance is needed. Never treat these questions as a booking or write request.
Say what answers the question first, or give useful decision advice. For a choice between an incompatible waitlist and course preferences, use kind:"demand", question:"compare_waitlist". Avoid repeating earlier explanations unless needed for the current question. Use one clarifying question only if it changes the recommendation. Leave current prices, durations, class schedules, IDs, seats and links to the server. Do not say a fact is unavailable just because you did not receive it; return the right structured action so the server can check. Never ask for phone or email merely to view a course. Reply naturally and briefly; facts and links will be added by the server. Do not infer an official HSK level or guarantee an outcome.`;

type Client=Parameters<typeof readPublicEnrollmentClasses>[0];
type Intent=NonNullable<ReturnType<typeof normalizeEnrollmentIntent>>;

export function refundConsultationIntent(topic:unknown,enrollment:unknown){
  // The model identifies the topic. The server decides what can be said about approval.
  if(topic!=='refund')return undefined;
  const action=normalizeEnrollmentIntent(enrollment);
  return {kind:'records',question:action?.kind==='records'&&action.question==='records_location'?'records_location':'refund'};
}

export function enrollmentQuoteRows(
  intent:Intent,
  classes:Awaited<ReturnType<typeof readPublicEnrollmentClasses>>,
  appointments:Awaited<ReturnType<typeof readPublicEnrollmentAppointments>>,
):EnrollmentQuote[]{
  const levels=intent.quoteLevels.length?intent.quoteLevels:intent.level?[intent.level]:[];
  const formats=intent.quoteFormats.length?intent.quoteFormats:intent.format?[intent.format]:intent.kind==='appointment'?['one-on-one']:[];
  const qualifies=(row:{level:string;format:string})=>
    (!levels.length||levels.some(level=>enrollmentLevelMatches(level,row.level)))&&
    (!formats.length||formats.includes(row.format));
  const classQuotes=classes.filter(row=>qualifies(row)&&(!intent.period||row.period===intent.period)&&
    (!intent.referenceIds.length||intent.referenceIds.includes(row.id))&&enrollmentClassMatchesTiming(intent,row))
    .map(row=>({id:row.id,level:row.level,format:row.format,period:row.period,batchNumber:row.batchNumber,
      periods:row.sessions,minutes:row.minutes,actual:row.price,standard:row.standardPrice,unitPriced:false,classSize:row.classSize}));
  const privateQuotes:EnrollmentQuote[]=appointments.map(row=>({
    id:row.id,level:row.level,format:'one-on-one',course:row.course,teacherType:row.teacherType,
    periods:row.lessons,minutes:row.minutes,actual:row.price,standard:row.standardPrice,unitPriced:true,
  })).filter(qualifies);
  // Identical group tuition needs one representative; differing quotes retain their own class.
  const used=new Set<string>();
  return [...classQuotes,...privateQuotes].filter(row=>{
    if(!(row.actual>0&&row.periods>0&&row.minutes>0))return false;
    const key=row.unitPriced?row.id:JSON.stringify([row.level,row.format,row.actual,row.standard,row.periods,row.minutes,row.classSize]);
    if(used.has(key))return false;
    used.add(key);
    return true;
  }).sort((a,b)=>a.level.localeCompare(b.level,'en',{numeric:true}));
}

export function matchingEnrollmentTuition(
  intent:Intent,classes:Awaited<ReturnType<typeof readPublicEnrollmentClasses>>,accepting:boolean,
):EnrollmentGuideAction{
  const {level,period,format,question}=intent;
  const filters={level,period,format,question};
  if(intent.needsReview||intent.invalidLevel)return {kind:'unavailable',...filters};
  const candidates=classes.filter(row=>
    (!level||enrollmentLevelMatches(level,row.level))&&
    (!intent.quoteLevels.length||intent.quoteLevels.some(requested=>enrollmentLevelMatches(requested,row.level)))&&
    (!format||row.format===format)&&(!intent.quoteFormats.length||intent.quoteFormats.includes(row.format))&&
    (!period||row.period===period)&&(!intent.maximumTotal||row.price<=intent.maximumTotal));
  const matching=candidates.filter(row=>row.price>0&&enrollmentClassMatchesTiming(intent,row))
    .sort((a,b)=>a.firstLesson.localeCompare(b.firstLesson)||a.id.localeCompare(b.id));
  if(matching.length){
    return {kind:'class',...filters,rows:enrollmentGuideRows(matching,intent.maxRecommendations),inspection:true,
      scheduleConfirmed:!!(intent.period||intent.windows||intent.days||intent.earliest||intent.latest||intent.latestEnd||intent.earliestDate||intent.latestDate),
      detailFields:['weekly','price']};
  }
  if(candidates.some(row=>!row.weeklySchedule?.days.length))return {kind:'unavailable',...filters};
  const general=normalizeEnrollmentIntent({kind:'quote',level,levels:intent.quoteLevels,format,formats:intent.quoteFormats})!;
  const quotes=level||intent.quoteLevels.length?enrollmentQuoteRows(general,classes,[]):[];
  return {kind:accepting?'demand':'catalog',...filters,quotes};
}

export async function chatEnrollmentAction(
  c:Client,value:unknown,assessmentIntroduction:boolean,profileIntroduction:boolean,
  knownReferences:readonly string[]=[],previousConstraints?:ConsultationConstraints,
):Promise<EnrollmentGuideAction|undefined>{
  if(value===null)return undefined;
  const intent=normalizeEnrollmentIntent(value);
  if(!intent)return assessmentIntroduction||profileIntroduction||value!==undefined?{kind:'catalog'}:undefined;
  const asksToApply=intent.question==='apply'||intent.question==='reserve';
  const invalidReference=intent.referenceIds.some(id=>!knownReferences.includes(id));
  if(!asksToApply&&invalidReference){
    if(['inspect','specifications','recommend','quote'].includes(intent.kind))
      return {kind:'unavailable',referenceUnavailable:true,question:intent.question};
    intent.referenceIds=[];
  }
  const {kind,level,format,period,question}=intent;
  if(kind==='advisor'){
    const offline=typeof value==='object'&&value!==null&&'offline' in value&&value.offline===true;
    return {kind,level,period,format,offline,
      ...(question==='advisor_question'||question==='advisor_send_status'?{question}:{})};
  }
  if(!asksToApply&&kind==='browse')return matchEnrollmentGuidance(intent,[]);
  try{
    if(kind==='viewing'){
      const filters=matchEnrollmentGuidance(intent,[]);
      const refs=intent.referenceIds.filter(id=>knownReferences.includes(id));
      if(!refs.length)return filters;
      const rows=await readPublicEnrollmentClasses(c);
      const matching=refs.flatMap(id=>rows.find(row=>row.id===id&&
        (!level||enrollmentLevelMatches(level,row.level))&&(!period||row.period===period)&&
        (!format||row.format===format)&&(!intent.maximumTotal||row.price<=intent.maximumTotal)&&
        enrollmentClassMatchesTiming(intent,row))??[]);
      return {...filters,rows:enrollmentGuideRows(matching),inspection:true};
    }
    if(asksToApply){
      const readiness=await enrollmentReadiness(c);
      if(!readiness.accepting)return {kind:'paused',level,period,format,question,
        readinessReasons:readiness.reasons,recordsAvailable:readiness.servicing};
      if(invalidReference)return {kind:'unavailable',referenceUnavailable:true,question};
      if(format==='one-on-one')return {kind:'appointment',level,period,format,question};
      if(intent.needsReview)return {kind:'unavailable',level,period,format,question};
      const classes=await readPublicEnrollmentClasses(c);
      const selection=matchEnrollmentGuidance({...intent,kind:'recommend'},classes);
      if(selection.kind!=='catalog'||selection.levelUnavailable)return selection;
      // Without enough constraints for a recommendation, verify the filtered directory
      // before offering it as the next step. Explicit references never switch classes.
      const strictSchedule=Boolean(intent.days||intent.windows||intent.earliest||intent.latest||intent.latestEnd||
        intent.earliestDate||intent.latestDate||intent.maximumWeeklySessions);
      const filtered=classes.filter(row=>(!level||enrollmentLevelMatches(level,row.level))&&
        (!period||row.period===period)&&(!format||row.format===format)&&
        (!intent.quoteFormats.length||intent.quoteFormats.includes(row.format))&&
        (!intent.maximumTotal||row.price<=intent.maximumTotal)&&
        enrollmentClassMatchesTiming(intent,row)&&
        (!intent.referenceIds.length||intent.referenceIds.includes(row.id)));
      const available=filtered.filter(row=>row.price>0&&(row.availability==='available'||row.availability==='limited'));
      if(available.length){
        if(intent.referenceIds.length||strictSchedule)return {kind:'class',level,period,format,question,
          detailFields:intent.detailFields,rows:enrollmentGuideRows(available,intent.maxRecommendations)};
        return selection;
      }
      const full=filtered.filter(row=>row.price>0&&row.availability==='full');
      if(full.length)return {kind:'waitlist',level,period,format,question,rows:enrollmentGuideRows(full,intent.maxRecommendations)};
      if(filtered.length||intent.referenceIds.length)return {kind:'unavailable',level,period,format,question,
        referenceUnavailable:!!intent.referenceIds.length&&!filtered.length};
      return {...matchEnrollmentGuidance({...intent,kind:'demand'},[]),explicitDemand:false};
    }
    if(kind==='quote'||kind==='appointment'){
      const formats=intent.quoteFormats.length?intent.quoteFormats:intent.format?[intent.format]:[];
      if(question==='matching_tuition'&&!formats.includes('one-on-one')&&!intent.referenceIds.length){
        const classes=await readPublicEnrollmentClasses(c);
        const readiness=await enrollmentReadiness(c);
        return matchingEnrollmentTuition(intent,classes,readiness.accepting);
      }
      if(intent.invalidLevel&&!level&&!intent.quoteLevels.length)
        return {kind,format,question,detailFields:intent.detailFields,quoteMissing:true,quotes:[]};
      const noGroups=kind==='appointment'||formats.every(format=>format==='one-on-one')&&formats.length>0;
      const quotes=enrollmentQuoteRows(intent,noGroups?[]:await readPublicEnrollmentClasses(c),
        !formats.length||formats.includes('one-on-one')||kind==='appointment'?await readPublicEnrollmentAppointments(c):[]);
      const levels=intent.quoteLevels.length?intent.quoteLevels:level?[level]:[];
      const quoteMissing=intent.invalidLevel||!quotes.length||levels.some(requested=>!quotes.some(row=>enrollmentLevelMatches(requested,row.level)))||
        formats.some(format=>!quotes.some(row=>row.format===format));
      return {kind,level:levels.length===1?levels[0]:level,period,format:formats.length===1?formats[0]:format,question,
        detailFields:intent.detailFields,requestedPeriods:intent.requestedPeriods,
        classId:question!=='group_overview'&&quotes.length===1&&!quotes[0].unitPriced?quotes[0].id:undefined,quotes,quoteMissing};
    }
    if(kind==='inspect'||kind==='specifications'){
      const pairComparison=question==='compare_classes'||question==='price_difference';
      const levels=intent.quoteLevels.length?intent.quoteLevels:level?[level]:[];
      if(pairComparison&&intent.referenceIds.length!==2)return {kind:'unavailable',question};
      if(!intent.referenceIds.length&&(kind==='inspect'||!levels.length))return {kind:'catalog',level,format};
      const classes=await readPublicEnrollmentClasses(c);
      const matched=classes.filter(row=>levels.some(requested=>enrollmentLevelMatches(requested,row.level))&&
        (!format||row.format===format)&&(!period||row.period===period)&&
        (!intent.batchNumber||row.batchNumber===intent.batchNumber)&&
        (!intent.earliestDate||row.firstLesson.slice(0,10)>=intent.earliestDate)&&
        (!intent.latestDate||row.firstLesson.slice(0,10)<=intent.latestDate));
      const specific=intent.batchNumber||intent.earliestDate||intent.latestDate||
        intent.detailFields.some(field=>['class_size','teacher','outcomes','seats'].includes(field));
      const comparison=kind==='specifications'&&!intent.referenceIds.length&&levels.length>1
        ?enrollmentClassComparison(levels,matched):undefined;
      const rows=comparison?.rows??(intent.referenceIds.length?intent.referenceIds.flatMap(id=>classes.filter(row=>row.id===id)):
        specific?matched:[...new Map(matched.map(row=>
          [JSON.stringify([row.level,row.material,row.teacherType,row.sessions,row.minutes]),row])).values()]);
      const missingClassLevels=comparison?.missingClassLevels??(
        !rows.length&&!intent.referenceIds.length&&kind==='specifications'?levels:undefined);
      if(!rows.length)return {kind:'unavailable',level,format,referenceUnavailable:!!intent.referenceIds.length,missingClassLevels,question};
      const compare=kind==='inspect'&&(!intent.detailFields.length||intent.detailFields.includes('weekly'))
        ?normalizeEnrollmentIntent({kind:'recommend',...previousConstraints}):undefined;
      const shown=enrollmentGuideRows(rows,comparison?levels.length:pairComparison?2:intent.maxRecommendations??2);
      const shownRows=rows.slice(0,shown.length);
      const scheduleConflict=compare?shownRows.map(row=>enrollmentScheduleConflict(compare,row)).find(Boolean):undefined;
      const firstDateConflict=!!compare&&shownRows.some(row=>!enrollmentFirstDateMatches(compare,row));
      const scheduleConfirmed=!!compare&&Boolean(compare.windows||compare.days||compare.earliest||compare.latest||compare.latestEnd||compare.earliestDate||compare.latestDate)&&
        !scheduleConflict&&!firstDateConflict&&shownRows.every(row=>enrollmentClassMatchesTiming(compare,row));
      return {kind:'class',level,format,question,rows:shown,inspection:true,missingClassLevels,
        scheduleConflict,firstDateConflict,scheduleConfirmed,
        detailFields:intent.detailFields.length?intent.detailFields:kind==='specifications'?['duration','materials','teacher']:undefined,
        referenceUnavailable:rows.length<intent.referenceIds.length};
    }
    const readiness=await enrollmentReadiness(c);
    if(kind==='records')return readiness.servicing?{kind,question}:{kind:'advisor',question};
    if(!readiness.accepting)return {kind:'paused',level,period,format,question,readinessReasons:readiness.reasons,recordsAvailable:readiness.servicing};
    if(kind==='demand')return matchEnrollmentGuidance(intent,[]);
    return matchEnrollmentGuidance(intent,await readPublicEnrollmentClasses(c));
  }catch{return {kind:'unavailable',level,period,format,question};}
}

const quoteShowsTuition=(action:EnrollmentGuideAction)=>action.detailFields?.includes('price')||action.requestedPeriods||
  (action.kind==='quote'&&action.question!=='period_unit'&&action.question!=='quoted_price_unit');

export function previousTuition(action:EnrollmentGuideAction|undefined):EnrollmentQuote[]{
  if(!action)return [];
  if((action.kind==='quote'||action.kind==='appointment')&&(quoteShowsTuition(action)||action.question==='group_overview'))
    return (action.quotes??[]).filter(row=>action.question!=='group_overview'||!row.unitPriced);
  if(action.kind!=='class'||(action.detailFields?.length&&!action.detailFields.includes('price'))||
    (!action.detailFields?.includes('price')&&(action.question==='period_unit'||action.question==='reserve'||action.question==='private_seat_counts')))
    return [];
  return (action.rows??[]).flatMap(row=>row.price>0&&row.sessions&&row.minutes>0
    ?[{id:row.id,level:row.level,format:row.format,period:row.period,batchNumber:row.batchNumber,
      actual:row.price,periods:row.sessions,minutes:row.minutes,unitPriced:false}]
    :[]);
}

export function previousTuitionReply(
  previous:EnrollmentGuideAction|undefined, referenceIds:readonly string[], lang:EnrollmentGuideLanguage,
){
  const t=(zh:string,en:string,id:string)=>enrollmentGuideText(lang,zh,en,id);
  const amount=(value:number)=>formatCurrency(value,lang);
  const quotes=previousTuition(previous);
  const selected=referenceIds.length?quotes.filter(row=>referenceIds.includes(row.id)):quotes;
  if(!selected.length)return t(
    '你指的是哪项报价？告诉我班型或贴一下金额，我可以帮你区分总价和单价。',
    'Which quote do you mean? Tell me the class type or paste the amount and I can explain what it covers.',
    'Penawaran mana yang Anda maksud? Sebutkan jenis kelas atau nominalnya agar saya bisa menjelaskan cakupannya.',
  );
  const pricePerPeriod=(row:EnrollmentQuote)=>row.unitPriced?row.actual:Math.round(row.actual/row.periods);
  if(previous?.question==='group_overview'){
    const range=(values:number[])=>{
      const low=Math.min(...values),high=Math.max(...values);
      return low===high?amount(low):`${amount(low)}–${amount(high)}`;
    };
    const total=range(selected.map(row=>row.actual)),unit=range(selected.map(pricePerPeriod));
    const durations=[...new Set(selected.map(row=>row.minutes))];
    const period=durations.length===1?t(`每节 ${durations[0]} 分钟`,`per ${durations[0]}-minute period`,`per jam pelajaran ${durations[0]} menit`)
      :t('每节课','per period','per jam pelajaran');
    return t(`刚才的 ${total} 是整班实付总价，${unit} 是${period}的折合单价。`,
      `The ${total} I quoted is the total tuition for the class. ${unit} is the equivalent price ${period}.`,
      `Biaya ${total} tadi adalah total biaya kelas, sedangkan ${unit} adalah harga setara ${period}.`);
  }
  return selected.map(row=>{
    const unit=amount(pricePerPeriod(row));
    const name=row.unitPriced?[row.course||row.level,t('一对一','One-to-one','Kelas privat')].join(' · '):enrollmentClassTitle(row,lang);
    if(row.unitPriced){
      const total=amount(row.actual*row.periods);
      return t(`${name}：${unit} 是每节 ${row.minutes} 分钟的单价，${total} 是按 ${row.periods} 节估算的整级参考价。实际费用按约定节数计算。`,
        `${name}: ${unit} is the price per ${row.minutes}-minute period. ${total} is the estimate for ${row.periods} periods. The amount due depends on how many periods you arrange.`,
        `${name}: ${unit} adalah harga per jam pelajaran ${row.minutes} menit. ${total} adalah perkiraan untuk ${row.periods} jam pelajaran. Biaya akhir mengikuti jumlah jam yang disepakati.`);
    }
    const total=amount(row.actual),approximate=row.actual%row.periods!==0;
    return t(`${name}：${total} 是整班实付总价（共 ${row.periods} 节），${unit} 是每节 ${row.minutes} 分钟的${approximate?'折合单价，已四舍五入':'单价'}。`,
      `${name}: ${total} is the total tuition for all ${row.periods} periods. ${unit} is the ${approximate?'average ':''}price per ${row.minutes}-minute period.`,
      `${name}: ${total} adalah total biaya untuk ${row.periods} jam pelajaran. ${unit} adalah harga ${approximate?'rata-rata ':''}per jam pelajaran ${row.minutes} menit.`);
  }).join('\n\n');
}

export function previousTuitionFollowUp(
  previous:EnrollmentGuideAction|undefined, intent:Intent, learnerMessage:string, lang:EnrollmentGuideLanguage,
){
  const evidence=intent.quoteReferenceEvidence;
  const referenceIds=evidence&&learnerMessage.includes(evidence)?intent.referenceIds:[];
  const levels=[...new Set(previousTuition(previous).map(row=>row.level))];
  const appointment=intent.detailFields.includes('appointment')
    ?{kind:'appointment',level:intent.level??(levels.length===1?levels[0]:undefined),period:intent.period}
    :undefined;
  return {reply:previousTuitionReply(previous,referenceIds,lang),appointment};
}

export function enrollmentReply(action:EnrollmentGuideAction,lang:EnrollmentGuideLanguage){
  const t=(zh:string,en:string,id:string)=>enrollmentGuideText(lang,zh,en,id);
  const missingLevels=action.missingClassLevels?.join(lang==='zh'?'、':', ');
  const missingClassNote=missingLevels?t(
    `${missingLevels} 目前没有符合这些条件、可核实的公开班次。`,
    `No matching public class could be verified for ${missingLevels}.`,
    `Belum ada kelas publik yang dapat diverifikasi dan sesuai untuk ${missingLevels}.`):'';
  const amount=(price:number)=>formatCurrency(price,lang);
  const rows=action.rows??[];
  const minutes=[...new Set([...(action.quotes??[]),...rows].map(row=>row.minutes).filter(value=>value>0))];
  const unitAnswer=minutes.length===1?t(`报价按一节 ${minutes[0]} 分钟计算。一次上课如果安排两节，就计两节。`,
    `The unit price covers one ${minutes[0]}-minute period. A session with two periods counts as two.`,
    `Harga satuan berlaku untuk satu jam pelajaran ${minutes[0]} menit. Jika satu sesi terdiri dari dua jam pelajaran, keduanya dihitung.`):
    t('单价按一节课计算。一次上课可以安排多节，计费按实际节数。','The unit price is per period. A session may include several periods, and each period counts toward tuition.','Harga satuan dihitung per jam pelajaran. Satu sesi dapat mencakup beberapa jam pelajaran, dan masing-masing dihitung dalam biaya kursus.');
  const reserve=t('我无法在聊天里帮你锁位。只有申请成功获席后，才会为你预留席位。',
    'I can’t hold a seat in chat. A seat is held only once your application is allocated a place.',
    'Saya tidak dapat menahan tempat melalui chat. Tempat hanya ditahan setelah pengajuan Anda mendapat alokasi tempat.');
  const apply=t('打开所选班次，点「申请这个班」，验证邮箱并提交。确认获席后，订单会显示转账资料和付款截止时间。',
    'Open your chosen class, select “Apply for this class,” verify your email, and submit. Once you have a seat, your order shows the transfer details and payment deadline.',
    'Buka kelas pilihan Anda, pilih “Daftar kelas ini”, verifikasi email, lalu kirim. Setelah mendapat tempat, pesanan akan menampilkan detail transfer dan tenggat pembayaran.');
  const missing=t('部分所询选项暂无可核实的公开报价。','A verified public price is unavailable for some of these options.','Harga resmi untuk sebagian pilihan ini belum dapat dipastikan.');
  const unavailable=t('先前推荐的班次中，有班次已无法从报名目录核实。','Some previously shown classes can no longer be verified in the enrollment directory.','Sebagian kelas yang sebelumnya ditampilkan tidak lagi dapat diverifikasi di katalog.');
  const viewing=t('可以。查看公开课表、学费和余位无需填电话或验证邮箱。',
    'Yes. You can check public schedules, fees, and seats without a phone number or email verification.',
    'Bisa. Anda dapat melihat jadwal, biaya, dan ketersediaan tanpa nomor telepon atau verifikasi email.');
  const quoted=(quotes:EnrollmentQuote[])=>quotes.map((row)=>{
    const total=row.unitPriced?row.actual*row.periods:row.actual;
    const unit=row.unitPriced?row.actual:Math.round(row.actual/row.periods);
    const name=row.unitPriced?[row.course||row.level,t('一对一','One-to-one','Kelas privat'),enrollmentTeacherLabel(row.teacherType,lang)].filter(Boolean).join(' · ')
      :enrollmentClassTitle(row,lang);
    const quantity=t(`${row.periods} 节 × ${row.minutes} 分钟`,`${row.periods} periods × ${row.minutes} min`,`${row.periods} jam pelajaran × ${row.minutes} menit`);
    const estimate=action.requestedPeriods?amount(action.requestedPeriods*row.actual):undefined;
    const actual=row.unitPriced?t(`整级参考 ${amount(total)}${estimate?`，${action.requestedPeriods} 节参考 ${estimate}`:''}`,
      `full-level estimate ${amount(total)}${estimate?`; ${action.requestedPeriods} periods estimated at ${estimate}`:''}`,
      `perkiraan satu level ${amount(total)}${estimate?`; ${action.requestedPeriods} jam pelajaran sekitar ${estimate}`:''}`):
      t(`实付总价 ${amount(total)}`,`current total ${amount(total)}`,`total yang dibayar ${amount(total)}`);
    const standard=row.standard&&row.standard>row.actual
      ?row.unitPriced?t(`（每节标准价 ${amount(row.standard)}）`,` (standard ${amount(row.standard)}/period)`,` (harga normal ${amount(row.standard)}/jam pelajaran)`)
        :t(`（标准总价 ${amount(row.standard)}）`,` (standard total ${amount(row.standard)})`,` (total harga normal ${amount(row.standard)})`)
      :'';
    const exact=row.unitPriced||row.actual%row.periods===0;
    const perPeriod=exact?t(`每节 ${amount(unit)}`,`${amount(unit)}/period`,`${amount(unit)}/jam pelajaran`):
      t(`平均每节约 ${amount(unit)}`,`about ${amount(unit)}/period on average`,`rata-rata sekitar ${amount(unit)}/jam pelajaran`);
    return `- ${name} · ${quantity} · ${actual}${standard} · ${perPeriod}`;
  }).join('\n');
  const appointment=t('一对一由 UPER 顾问约课，不能直接选固定班报名。打开下方入口，告诉我们你方便的日期和时间，再和顾问确认上课安排及购买节数。',
    'Private lessons are arranged individually with a UPER advisor. Use the link below to share your availability and confirm the schedule and number of periods.',
    'Kelas privat dijadwalkan secara individual bersama tim UPER. Buka tautan di bawah untuk menyampaikan waktu yang tersedia dan mengonfirmasi jadwal serta jumlah jam pelajaran.');
  if(action.question==='clarify_timezone')return t(
    '你说的时间是雅加达时间（WIB），还是你当地的时间？如果是当地时间，告诉我你所在的城市或时区，我可以帮你换算并核对课表。',
    'Is that Jakarta time (WIB) or your local time? If it’s local, tell me your city or time zone so I can convert it and check the schedule.',
    'Apakah itu waktu Jakarta (WIB) atau waktu setempat? Jika waktu setempat, beri tahu kota atau zona waktu Anda agar saya bisa menyesuaikannya dan memeriksa jadwal.',
  );
  if(action.question==='clarify_local_schedule')return t(
    '我还不能可靠地把这个时间换算成 WIB。请告诉我你方便的雅加达时间（WIB），我再核对班次。',
    'I can’t reliably convert that schedule to WIB yet. Share your availability in Jakarta time (WIB) so I can check.',
    'Jadwal itu belum bisa dikonversi ke WIB dengan pasti. Beri tahu waktu yang sesuai dalam waktu Jakarta (WIB) agar saya bisa memeriksa kelas.',
  );
  if(action.question==='clarify_local_timezone')return t(
    '你在哪个城市或时区？我可以把你的当地时间换算成雅加达时间，再核对课表。',
    'Which city or time zone are you in? I can convert your local time to Jakarta time and check class schedules.',
    'Anda berada di kota atau zona waktu mana? Saya bisa mengonversi waktu setempat ke waktu Jakarta, lalu memeriksa jadwal kelas.',
  );
  const conflict=action.scheduleConflict;
  const day=conflict?enrollmentWeekdays[conflict.day-1]:undefined;
  const conflictReason=conflict&&day?t(`冲突在${day[0]}。课表为 ${conflict.start}–${conflict.end} WIB，超出了你提供的可上课时间。`,
    `The conflict is on ${day[1]}. The ${conflict.start}–${conflict.end} WIB session is outside your availability.`,
    `Jadwal pada ${day[2]} pukul ${conflict.start}–${conflict.end} WIB berada di luar waktu yang Anda bisa.`):'';
  const refundApproval=t('提交退款申请后，须先由 CRM 管理者批准，财务才会按原支付渠道处理。我无法确认这笔退款是否已获批、金额或到账日期。',
    'Submitting a refund request starts an approval review. Finance can refund the original payment method only after the CRM Manager approves it. I can’t confirm approval, an amount, or an arrival date.',
    'Pengajuan refund harus disetujui Manajer CRM sebelum tim Keuangan mengembalikan dana melalui metode pembayaran awal. Saya tidak dapat memastikan persetujuan, jumlah, atau tanggal dana masuk.');
  const noSecondTransfer=t('不用再付，也不要转到另一个账户。','Do not pay again or transfer to a different account.','Jangan membayar lagi atau mentransfer ke rekening lain.');
  const checkOriginalTransfer=t('如果核款还没完成，请凭原转账记录核对，无需为保留席位重复转账。',
    'If verification is still pending, check the original transfer. A second transfer is not needed to keep your seat.',
    'Jika verifikasi masih berlangsung, periksa transfer semula. Anda tidak perlu transfer ulang untuk mempertahankan tempat.');
  if(action.question==='matching_tuition'&&(action.kind==='catalog'||action.kind==='demand')){
    const level=action.level?(` ${action.level}`):'';
    const noMatch=t(`目前没有符合这些上课时间的${level} 班课。`,
      `No current${level} group class matches those hours.`,
      `Saat ini belum ada kelas grup${level} yang sesuai dengan waktu tersebut.`);
    const general=(action.quotes??[]).map(row=>({...row,batchNumber:undefined,period:undefined}));
    const reference=general.length?[t('以下是同级班课的现行报价，供预算参考。','For budgeting, here is current tuition for group classes at that level.',
      'Sebagai acuan anggaran, berikut biaya kelas grup pada level tersebut.'),quoted(general)].join('\n\n'):'';
    const next=action.kind==='demand'?t('可以登记选课需求，把能上课的日期和时间填进备注。',
      'Submit course preferences and add the days and hours you can attend.','Kirim preferensi kursus dan cantumkan hari serta jam yang sesuai.'):'';
    return [noMatch,reference,next].filter(Boolean).join('\n\n');
  }
  switch(action.kind){
    case 'quote':
    case 'appointment':{
      if(action.question==='group_overview'){
        const groups=(action.quotes??[]).filter(row=>!row.unitPriced);
        if(!groups.length)return missing;
        const range=(values:number[])=>{
          const low=Math.min(...values),high=Math.max(...values);
          return low===high?amount(low):`${amount(low)}–${amount(high)}`;
        };
        const sizes=[...new Set(groups.map(row=>enrollmentClassSizeText(row.classSize,lang)))];
        const size=sizes.length===1&&sizes[0]?sizes[0]:t('规模以具体班次为准','Size varies by class','Ukuran mengikuti kelas yang dipilih');
        const total=range(groups.map(row=>row.actual));
        const unit=range(groups.map(row=>Math.round(row.actual/row.periods)));
        const title=action.format==='small'?t('小班','Small groups','Kelas kecil'):
          action.format==='standard'?t('标准班','Standard classes','Kelas standar'):t('班课','Group classes','Kelas grup');
        const label=[action.level,title].filter(Boolean).join(' ');
        const detail=t(`${label}${sizes.length===1&&sizes[0]?'为':'，'}${size}。当前公开班次的实付总价为 ${total}，折合每节约 ${unit}。`,
          `${label}: ${size}. Current published tuition totals ${total}, or about ${unit} per period.`,
          `${label}: ${size}. Total biaya kelas yang tersedia adalah ${total}, atau sekitar ${unit} per jam pelajaran.`);
        return [detail,action.quoteMissing?missing:''].filter(Boolean).join(' ');
      }
      const showPrices=quoteShowsTuition(action);
      const arrange=enrollmentAppointmentRequested(action);
      return [
        action.question==='period_unit'?unitAnswer:'',
        arrange?appointment:'',
        showPrices?quoted(action.quotes??[]):'',
        showPrices&&action.quoteMissing?missing:'',
        showPrices&&action.kind==='quote'&&!arrange&&action.quotes?.some(row=>row.unitPriced)
          ?t('一对一需要单独约课。请与 UPER 顾问确认上课时段和购买节数。','Private lessons are arranged individually. Confirm the schedule and number of periods with a UPER advisor.','Kelas privat dijadwalkan secara individual. Konfirmasikan jadwal dan jumlah jam pelajaran dengan tim UPER.'):'',
      ].filter(Boolean).join('\n\n');
    }
    case 'class':{
      const shared=action.sharedComparison&&sharedEnrollmentComparison(action);
      if(shared){
        const {level,format}=shared.rows[0];
        const title=enrollmentClassTitle({level,format},lang);
        const matches=!action.inspection||action.scheduleConfirmed;
        return [matches?t(`有两期 ${title} 符合你的选班条件。`,`Two ${title} options match your preferences.`,`Ada dua pilihan ${title} yang sesuai dengan preferensi Anda.`):
          t(`可以比较这两期 ${title}。`,`You can compare these two ${title} options.`,`Anda bisa membandingkan dua pilihan ${title} ini.`),
          t('两期课表、课时和学费相同，可以按首课日期选。','Both have the same weekly schedule, number of lessons and tuition. You can choose by the first session date.','Jadwal mingguan, jumlah jam pelajaran, dan biayanya sama. Anda bisa memilih berdasarkan tanggal kelas pertama.')].join('\n\n');
      }
      const question=action.question;
      const hasRoom=rows.some(row=>row.availability==='available'||row.availability==='limited');
      const requested=question==='price_difference'?['price','duration','class_size']:action.detailFields?.length?action.detailFields:question==='reserve'?['seats']:question==='period_unit'?[]:
        action.inspection&&!question?undefined:['weekly','price','first'];
      const maximum=action.maximumTotal;
      const budget=maximum&&rows.length&&rows.every(row=>row.price>0&&row.price<=maximum)?amount(maximum):'';
      const priceBreakdown=action.inspection||question==='period_unit'||action.detailFields?.includes('price');
      const first=rows[0];
      if(rows.length===1&&!action.inspection&&!question&&!action.detailFields?.length&&!maximum&&
        !action.intakePaused&&!action.firstDateConflict&&!action.referenceUnavailable&&!action.missingClassLevels?.length&&!conflict&&
        !action.linkOnlyClassIds?.includes(first.id)&&first.price>0&&hasRoom){
        const starts=enrollmentInstant(first.firstLesson);
        if(starts){
          const date=new Intl.DateTimeFormat({zh:'zh-CN',en:'en-GB',id:'id-ID'}[lang],{
            month:'long',day:'numeric',timeZone:'Asia/Jakarta',
          }).format(starts);
          const title=enrollmentClassTitle(first,lang);
          return t(`建议先看 ${title}。首课是 ${date} ${first.firstLesson.slice(11)} WIB。`,
            `I’d suggest ${title}. The first session is ${date} at ${first.firstLesson.slice(11)} WIB.`,
            `Saya sarankan ${title}. Kelas pertama pada ${date}, pukul ${first.firstLesson.slice(11)} WIB.`);
        }
      }
      const sameClassType=first&&rows.every(row=>row.level===first.level&&row.format===first.format&&row.period===first.period);
      const option=sameClassType&&!action.inspection?enrollmentClassTitle({...first,batchNumber:undefined},lang):'';
      const recommendation=option&&budget?t(`按你的预算，可以先看 ${option}。下方班次的实付总价在 ${budget} 以内。`,
        `For your budget, I’d start with ${option}. The tuition shown below is within ${budget}.`,
        `Untuk anggaran Anda, saya sarankan mulai dari ${option}. Biaya kursus di bawah ini masih dalam anggaran ${budget}.`):
        budget?t(`下方班次的实付总价在 ${budget} 以内。`,`The tuition shown below is within ${budget}.`,`Biaya kursus di bawah ini masih dalam anggaran ${budget}.`):
        (action.scheduleConfirmed||!action.inspection&&action.detailFields?.includes('weekly'))&&rows.length&&!conflict?t(
          action.inspection?'下方班次的上课时间符合你给出的条件。':'下方班次的每周课表符合你给出的时间。',
          'The weekly schedule below fits the hours you shared.','Jadwal mingguan di bawah ini sesuai dengan waktu yang Anda sampaikan.'):
        option&&!action.detailFields?.length?t(`按你给出的条件，可以先看 ${option}。`,`Based on what you’ve told me, I’d start with ${option}.`,
          `Berdasarkan kebutuhan Anda, saya sarankan mulai dari ${option}.`):'';
      const introduction=action.inspection&&conflict?t(
        '按你现在的时间，这个班无法完整参加。下方班次链接可用来核对课表。',
        'With your current availability, you cannot attend this class in full. Use the class link below to check the schedule.',
        'Dengan waktu yang tersedia sekarang, Anda tidak bisa mengikuti seluruh kelas ini. Gunakan tautan kelas di bawah untuk memeriksa jadwal.'):
        question==='apply'&&hasRoom&&!action.intakePaused
        ?t('现在可以报名，下方有可申请的班次。','Yes, you can apply now. The classes below are open.','Bisa, Anda dapat mendaftar sekarang. Kelas di bawah ini masih terbuka.')
        :question==='period_unit'?unitAnswer:question==='reserve'?reserve:question==='view_without_contact'?viewing:
        !budget&&question==='starting_point'&&rows.length&&rows.every(row=>row.level==='HSK 1')
          ?t('如果你从零开始，我建议从 HSK 1 入门。可以先打开一个班次，看看首课和每周时间是否都方便，再决定是否申请。',
            'If you’re starting from scratch, I’d start with HSK 1. Open a class and check that both the first class and the weekly schedule work for you before deciding whether to apply.',
            'Jika Anda mulai dari nol, saya sarankan mulai dari HSK 1. Buka detail kelas dan periksa apakah jadwal kelas pertama dan jadwal mingguannya cocok sebelum memutuskan untuk mendaftar.'):
          recommendation;
      const rowDescriptions=rows.map(row=>{
        const availability=row.availability==='full'?t('已满','full','penuh'):
          row.availability==='limited'?t('余位不多','limited seats','tempat terbatas'):
          row.availability==='available'?t('查询时有余位','Seats available when checked','Tempat tersedia saat diperiksa'):t('余位暂无法核实','Current availability could not be verified','Ketersediaan belum dapat diverifikasi');
        const quantity=row.sessions&&row.minutes?t(`共 ${row.sessions} 节，每节 ${row.minutes} 分钟`,
          `${row.sessions} periods of ${row.minutes} minutes each`,`${row.sessions} jam pelajaran, masing-masing ${row.minutes} menit`):'';
        const teacher=enrollmentTeacherLabel(row.teacherType,lang);
        const material=row.material?t(`教材 ${row.material}`,`textbook: ${row.material}`,`buku: ${row.material}`):'';
        const periods=row.sessions??0;
        const unit=periods>0&&row.price>0?t(row.price%periods===0?`每节 ${amount(row.price/periods)}`:`平均每节约 ${amount(Math.round(row.price/periods))}`,
          `${row.price%periods===0?'':'about '}${amount(Math.round(row.price/periods))}/period`,
          `${row.price%periods===0?'':'sekitar '}${amount(Math.round(row.price/periods))}/jam pelajaran`):'';
        const standard=row.standardPrice&&row.standardPrice>row.price?t(`标准总价 ${amount(row.standardPrice)}`,`standard total ${amount(row.standardPrice)}`,`total harga normal ${amount(row.standardPrice)}`):'';
        const weekly=enrollmentWeeklyScheduleText(row.weeklySchedule,row.minutes,lang);
        const plan=row.weeklySchedule;
        const sessionLength=weekly&&plan&&plan.lessons>1?t(`每次 ${plan.lessons} 节，共 ${plan.lessons*row.minutes} 分钟`,
          `${plan.lessons} periods (${plan.lessons*row.minutes} min) per session`,`${plan.lessons} jam pelajaran (${plan.lessons*row.minutes} menit) per sesi`):'';
        const size=enrollmentClassSizeText(row.classSize,lang);
        const details={
          duration:[quantity,sessionLength],price:row.price>0?[t(`实付总价 ${amount(row.price)}`,`current total ${amount(row.price)}`,`total biaya saat ini ${amount(row.price)}`),
            ...(priceBreakdown?[standard,unit]:[])]:[],
          first:[`${t('首课','First class','Kelas pertama')} ${row.firstLesson.replace('T',' ')} WIB`],
          weekly:[weekly||t('详细周课表暂无法核实','weekly schedule not currently verified','jadwal mingguan belum dapat diverifikasi'),
            ...(requested?.includes('duration')?[]:[sessionLength])],seats:[availability],
          materials:[material||t('教材待确认','Textbook to be confirmed','Buku perlu dikonfirmasi')],teacher:[teacher,row.teacher?.trim()?t(`授课教师 ${row.teacher.trim()}`,`Teacher: ${row.teacher.trim()}`,`Pengajar: ${row.teacher.trim()}`):
            t('老师姓名尚未公布','Teacher name has not been announced','Nama pengajar belum diumumkan')],
          class_size:[size?(row.classSize?.usualMinimum?t(`班级规模 ${size}，上限 ${row.classSize.maximum} 人`,`Class size: ${size}, maximum ${row.classSize.maximum}`,`Ukuran kelas: ${size}, maksimal ${row.classSize.maximum}`):size):
            t('班级人数上限暂未公布','Class capacity has not been published','Kapasitas kelas belum diumumkan')],
          outcomes:[row.learningOutcomes?.trim()?t(`学习成果：${row.learningOutcomes.trim()}`,`Learning outcomes: ${row.learningOutcomes.trim()}`,`Hasil belajar: ${row.learningOutcomes.trim()}`):
            t('学习成果暂未公布','Learning outcomes have not been published','Hasil belajar belum dipublikasikan')],
        };
        const fields=action.question==='private_seat_counts'?[...new Set([...(requested??[]),'seats'])]:requested??Object.keys(details);
        const isDetail=(field:string):field is keyof typeof details=>Object.hasOwn(details,field);
        const facts=fields.filter(isDetail).flatMap(field=>details[field]).filter(Boolean);
        return {name:enrollmentClassTitle(row,lang),facts};
      });
      const sharedFacts=sameClassType&&rowDescriptions.length>1
        ?rowDescriptions[0].facts.filter(fact=>rowDescriptions.every(row=>row.facts.includes(fact))):[];
      const formatFacts=(facts:string[])=>facts.join(lang==='zh'?'；':'. ')+(lang==='zh'?'。':'.');
      const individual=rowDescriptions.map(row=>{
        const facts=row.facts.filter(fact=>!sharedFacts.includes(fact));
        const name=`${rows.length>1?'- ':''}**${row.name}**`;
        return facts.length?`${name}${lang==='zh'?'，':'. '}${formatFacts(facts)}`:sharedFacts.length&&requested?name:'';
      });
      let difference='';
      if(question==='price_difference'&&rows.length===2&&rows.every(row=>row.price>0&&row.sessions>0)){
        const [lower,higher]=[...rows].sort((a,b)=>a.price-b.price);
        const total=amount(higher.price-lower.price);
        const lowerUnit=lower.price/lower.sessions,higherUnit=higher.price/higher.sessions;
        if(lower.price===higher.price){
          difference=t('这两个班的实付总价相同。','The current tuition totals are the same.','Total biaya saat ini sama.');
        }else if(lower.sessions===higher.sessions&&lower.minutes===higher.minutes&&Number.isInteger(lowerUnit)&&Number.isInteger(higherUnit)){
          const perPeriod=amount(higherUnit-lowerUnit);
          const higherName=enrollmentClassTitle(higher,lang);
          difference=t(
            `两班都是 ${lower.sessions} 节，每节 ${lower.minutes} 分钟，差价来自每节定价。「${higherName}」每节贵 ${perPeriod}，整班贵 ${total}。`,
            `Both classes have ${lower.sessions} periods of ${lower.minutes} minutes. ${higherName} costs ${perPeriod} more per period and ${total} more in total.`,
            `Kedua kelas memiliki ${lower.sessions} jam pelajaran, masing-masing ${lower.minutes} menit. ${higherName} lebih mahal ${perPeriod} per jam pelajaran dan ${total} secara total.`);
        }else{
          difference=t(
            `这两班的实付总价相差 ${total}。比较时可以同时看下方的总节数、每节时长和单价。`,
            `The current totals differ by ${total}. Compare the number of periods, their duration and the rate per period below.`,
            `Selisih total biaya saat ini adalah ${total}. Bandingkan jumlah dan durasi jam pelajaran serta tarif per jam pelajaran di bawah.`);
        }
      }
      const gap=action.question==='compare_classes' &&requested?.includes('first')&&rows.length===2
        ?Math.abs(Date.parse(rows[0].firstLesson.slice(0,10))-Date.parse(rows[1].firstLesson.slice(0,10)))/86_400_000:undefined;
      const firstDifference=gap===undefined||!Number.isFinite(gap)?'':gap===0
        ?t('两个班的首课是同一天。','Both classes start on the same date.','Kedua kelas dimulai pada tanggal yang sama.')
        :t(`两个班的首课相隔 ${gap} 天。`,`Their first class dates are ${gap} days apart.`,`Tanggal kelas pertama berjarak ${gap} hari.`);
      return [
        question==='reserve'?introduction:'',
        action.intakePaused?t('现在暂停接受新报名。你仍可查看下方课表。',
          'New applications are currently paused. You can still check the schedule below.','Pendaftaran baru sedang dijeda. Anda tetap dapat melihat jadwal di bawah.'):'',
        question==='reserve'?'':introduction,
        conflictReason,
        action.firstDateConflict?t('这个班次的首课日期超出了你给出的日期范围。','The first class date is outside the range you gave.',
          'Tanggal kelas pertama berada di luar rentang tanggal yang Anda berikan.'):'',
        difference,
        sharedFacts.length?`${t('两班共有的信息','Shared details','Rincian yang sama')}\n\n${sharedFacts.map(fact=>'- '+fact).join('\n')}`:'',
        ...individual,firstDifference,missingClassNote,action.referenceUnavailable?unavailable:'',
        (question==='apply'||question==='reserve')&&!action.intakePaused&&hasRoom?apply:'',
        (question==='apply'||question==='reserve')&&!action.intakePaused&&!hasRoom&&rows.some(row=>row.availability==='full')
          ?t('这班已满，可以打开班次详情加入候补。','This class is full. Open the class details to join the waitlist.','Kelas ini penuh. Buka detail kelas untuk masuk daftar tunggu.'):'',
      ].filter(Boolean).join('\n\n');
    }
    case 'waitlist':return [
      action.detailFields?.some(field=>['class_size','teacher','outcomes'].includes(field))?enrollmentReply({...action,kind:'class'},lang):'',
      action.question==='reserve'?reserve:'',
      conflictReason,t('符合条件的班次目前已满。打开班次可以加入候补，候补无需付款，也不会占用席位。',
        'Matching classes are full. Open a class to join its waitlist. You won’t be charged or hold a seat by joining.',
        'Kelas yang sesuai sedang penuh. Buka kelas untuk masuk daftar tunggu. Daftar tunggu tidak dipungut biaya dan tidak menahan tempat.')].filter(Boolean).join(' ');
    case 'demand':{
      if(action.question==='compare_waitlist')return t(
        '建议登记选课需求。候补只等那个班的空位，课表仍然不合适。登记时可以写明你能上课的时间，无需付款，也不会占位。',
        'Submit your course preferences. A waitlist is for a seat in that particular class, so the schedule would still conflict. Add the times you can attend. There is no payment or seat hold.',
        'Sebaiknya isi formulir preferensi kursus. Daftar tunggu hanya untuk kelas tersebut, jadi jadwalnya tetap bentrok. Cantumkan waktu yang cocok untuk Anda. Pengisian tidak memerlukan pembayaran atau menahan tempat.',
      );
      if(action.explicitDemand&&action.question==='link_only')return t('选课需求表在下方。','The course preferences form is below.','Formulir preferensi kursus tersedia di bawah.');
      const level=action.level && /^HSK [1-6][AB]?$/.test(action.level)?action.level:'';
      const result=level?t(`目前没有符合这些条件的 ${level} 班次。`,`No current ${level} class matches those preferences.`,`Belum ada kelas ${level} yang sesuai.`):
        t('目前没有符合这些条件的班次。','No current class matches these preferences.','Saat ini belum ada kelas yang sesuai.');
      const schedule=enrollmentPreferenceScheduleText(action.preferredSchedule,lang);
      const formatLabel=action.format==='standard'?t('标准班','Standard class','Kelas standar'):
        action.format==='small'?t('小班','Small group','Kelompok kecil'):
        action.format==='one-on-one'?t('一对一','One-to-one','Kelas privat'):'';
      const prefilled=[level||action.requestedLevel,formatLabel,schedule].filter(Boolean).join(' · ');
      const opening=[action.question==='reserve'?reserve:'',action.explicitDemand?'':result,conflictReason].filter(Boolean).join(' ');
      const formInstructions=[
        prefilled?t(`选课需求表已带入：${prefilled}。登记无需付款，也不会占用席位。`,
          `The course preferences form is prefilled: ${prefilled}. Submission requires no payment and does not hold a seat.`,
          `Formulir preferensi sudah terisi: ${prefilled}. Pengisian tidak memerlukan pembayaran dan tidak memesan tempat.`):
          t('你可以登记选课需求，把具体时间填进备注。登记无需付款，也不会占用席位。','You can submit your course preferences and add specific times in the notes. This does not require payment or reserve a seat.','Anda dapat mengirim preferensi kelas dan menambahkan waktu di kolom catatan. Pengisian ini tidak memerlukan pembayaran atau memesan tempat.'),
        action.level==='other'?(action.requestedLevel?t('表单已将级别选为「其他」，并在备注中填写了所需级别。',
          'The form selects “Other” and includes the requested level in the notes.','Formulir memilih “Lainnya” dan mencantumkan level yang diinginkan di kolom catatan.'):
          t('表单已将级别选为「其他」。请在备注填写你想学的级别。',
          'The form is set to “Other.” Add the level you want in the notes.','Formulir sudah memilih “Lainnya”. Tulis level yang Anda inginkan di kolom catatan.')):'',
        action.explicitDemand&&!action.level?t('级别还不确定，可以选「不确定我的级别」。','If you’re unsure of your level, choose “Not sure about my level.”',
          'Jika belum tahu level Anda, pilih “Belum yakin level saya”.'):'',
        action.explicitDemand&&!action.format?t('班型没想好，可以选「不限」。','You can choose “Any” if you’re flexible about class type.',
          'Pilih “Bebas” jika jenis kelasnya fleksibel.'):''].filter(Boolean).join(' ');
      return [opening,formInstructions].filter(Boolean).join('\n\n');
    }
    case 'unavailable':return [action.question==='reserve'?reserve:'',
      (action.question==='compare_classes'||action.question==='price_difference')&&!action.referenceUnavailable
        ?t('请告诉我想比较哪两个班次，我可以分别核对。','Which two classes would you like to compare? I can check both.','Dua kelas mana yang ingin Anda bandingkan? Saya bisa memeriksa keduanya.')
        :
      action.question==='apply'&&!action.referenceUnavailable&&!missingClassNote
        ?t('暂时无法确认现在能否报名。请稍后重试，或打开报名页重新查看。','I couldn’t confirm whether applications are open. Try again shortly or check the enrollment page.','Saya belum dapat memastikan apakah pendaftaran terbuka. Coba lagi nanti atau periksa halaman pendaftaran.')
        :missingClassNote||(action.referenceUnavailable?unavailable:
      t('暂时无法核实公开班次或报价。你可以稍后重试，也可以打开报名页查看。','I couldn’t verify current classes or prices. Try again shortly or check the enrollment page.','Kelas atau harga saat ini belum dapat diperiksa. Coba lagi nanti atau buka halaman pendaftaran.'))].filter(Boolean).join(' ');
    case 'paused':return [
      ...(action.readinessReasons??[]).map(reason=>enrollmentReadinessMessage(reason,lang)),
      action.question==='reserve'?reserve:'',
      action.recordsAvailable?t('如果已经验证邮箱，可以在「我的报名」查看现有订单。','If your email is already verified, you can check existing orders in My enrollments.','Jika email Anda sudah terverifikasi, lihat pesanan di Pendaftaran Saya.'):'',
    ].filter(Boolean).join(' ')||t('目前暂不接受新报名。','New applications are currently unavailable.','Pendaftaran baru belum tersedia.');
    case 'advisor':{
      const status=t('我没有代你向顾问发送消息。你可以通过下方入口自行联系 UPER 顾问。',
        'I haven’t sent a message to an advisor on your behalf. Use the link below to contact a UPER advisor.',
        'Saya belum mengirim pesan kepada tim UPER atas nama Anda. Hubungi tim UPER melalui tautan di bawah.');
      if(action.question==='advisor_send_status')return status;
      const period=action.period==='weekend'?t('周末','weekend','akhir pekan'):
        action.period==='weekday-evening'?t('工作日晚上','weekday evenings','malam hari kerja'):
        action.period==='mixed'?t('工作日和周末','weekdays and weekends','hari kerja dan akhir pekan'):'';
      const preference=!action.offline&&action.question==='advisor_question'&&action.format==='one-on-one'&&action.level&&period
        ?t(`可向顾问说明你想了解 ${action.level} ${period}一对一课程。`,
          `Tell the advisor you’re looking for ${action.level} one-to-one lessons on ${period==='weekend'?'the weekend':period}.`,
          `Sampaikan kepada tim UPER bahwa Anda ingin kelas privat ${action.level} pada ${period}.`)
        :'';
      const context=action.offline?t('公开目录目前列出线上课。雅加达面授班是否可报、地点和时间请由顾问确认。',
        'The public catalogue currently lists online classes. Ask an advisor about in-person availability, location and timing in Jakarta.',
        'Katalog publik saat ini memuat kelas online. Tanyakan kepada tim UPER tentang kelas tatap muka di Jakarta, termasuk lokasi dan jadwalnya.'):
        action.format==='one-on-one'?t('一对一能否安排、具体时段和老师由顾问确认。',
          'Ask the advisor to confirm availability, lesson times and the teacher for one-to-one classes.',
          'Tanyakan kepada tim UPER tentang ketersediaan, jadwal, dan pengajar kelas privat.'):'';
      return [action.question==='refund'?refundApproval:'',action.question==='avoid_duplicate_payment'?noSecondTransfer+' '+checkOriginalTransfer:'',preference,context,status].filter(Boolean).join(' ');
    }
    case 'records':{
      const open=t('进入「我的报名」，验证报名邮箱后打开原订单。','Open My Enrollments, verify your enrollment email, then open the original order.','Buka Pendaftaran Saya, verifikasi email pendaftaran, lalu buka pesanan awal.');
      const proof=t('请用原转账回单或银行交易记录，保留金额、时间和流水号。','Use the original transfer receipt or bank transaction record showing the amount, time, and reference number.','Gunakan bukti transfer asli atau catatan transaksi bank yang mencantumkan jumlah, waktu, dan nomor referensi.');
      const submitProof=t('如果原订单仍可提交凭证，就在那里上传。入口已关闭时，请联系 UPER 核对原流水。','Upload it on the original order if that option is available. If it’s closed, ask UPER to check the original transfer.','Unggah di pesanan awal jika opsinya tersedia. Jika sudah ditutup, minta tim UPER memeriksa transfer semula.');
      switch(action.question){
        case 'avoid_duplicate_payment':return [noSecondTransfer,checkOriginalTransfer,open].join(' ');
        case 'original_transfer_proof':return [proof,open,submitProof].join(' ');
        case 'cancelled_transfer_payment_and_proof':return [noSecondTransfer,proof,open,submitProof].join(' ');
        case 'records_location':return open;
        case 'unpaid_enrollment_status':return t(
          '还没转账、也没上传凭证，报名尚未成功。可在「我的报名」验证报名邮箱，查看是否已有待付款订单。',
          'If you haven’t transferred payment or uploaded proof, your enrollment isn’t complete yet. Verify your enrollment email in My Enrollments to see whether you have an order awaiting payment.',
          'Jika Anda belum transfer dan belum mengunggah bukti pembayaran, pendaftaran Anda belum selesai. Verifikasi email pendaftaran di Pendaftaran Saya untuk memeriksa apakah ada pesanan yang menunggu pembayaran.',
        );
        case 'cancel_unpaid':return t('订单仍在付款期限内、未转账也未交凭证时，可以自行取消。',
          'You can cancel before the deadline if you haven’t transferred money or submitted proof.',
          'Anda dapat membatalkan sebelum tenggat jika belum transfer dan belum mengirim bukti.')+' '+open;
        case 'expired_unpaid':return t('如果没转账也没交凭证，超过付款期限后订单会终止，席位会释放。你仍可在「我的报名」查看订单。',
          'If you haven’t transferred money or submitted proof, your order expires at the deadline and the seat is released. You can still view your order in My Enrollments.',
          'Jika belum transfer atau mengirim bukti, pesanan kedaluwarsa pada tenggat dan tempatnya dilepas. Pesanan tetap dapat dilihat di Pendaftaran Saya.');
        case 'proof_after_cancellation':return t('如果已经转账，请先保留银行凭证，暂勿再次付款。',
          'If you’ve already transferred, keep your bank receipt and don’t pay again.',
          'Jika sudah transfer, simpan bukti bank dan jangan membayar kembali.')+' '+open+' '+
          t('如果订单仍有「提交凭证」入口，可上传原凭证。如果入口已关闭，请联系 UPER 核对原流水。',
            'Upload the original receipt if the option is available on your order. If it’s closed, ask UPER to check the original transfer.',
            'Unggah bukti asli jika opsi tersebut tersedia di pesanan. Jika sudah ditutup, minta tim UPER memeriksa transfer semula.');
        case 'payment_verification':return t('上传凭证后还需要等财务核实。只核实到部分款项时，报名尚未成功。财务确认足额到账后，订单才会显示报名成功。',
          'Finance still needs to verify the transfer after you upload proof. Enrollment is complete only after Finance verifies the full amount.',
          'Setelah bukti diunggah, tim Keuangan masih perlu memverifikasi transfer. Pendaftaran selesai setelah jumlah penuh diverifikasi.')+' '+open;
        case 'refund':return refundApproval+' '+open;
        default:return t('请在「我的报名」验证报名邮箱，再查看订单、凭证和核款结果。','Verify your enrollment email in My Enrollments to see the order, proof of transfer, and payment verification.','Verifikasi email pendaftaran di Pendaftaran Saya untuk melihat pesanan, bukti transfer, dan hasil verifikasi pembayaran.');
      }
    }
    case 'viewing':return action.rows?.length?[viewing,t('可以打开下方班次，直接查看首课和每周课表。',
      'Open one of the classes below to view its first class date and weekly schedule.',
      'Buka salah satu kelas di bawah untuk melihat tanggal kelas pertama dan jadwal mingguan.')].join(' '):viewing;
    case 'catalog':
      if(action.levelUnavailable)return t('目前的公开报名目录没有你询问的级别。','The requested level is not in the current enrollment catalogue.','Level yang Anda cari belum ada di katalog pendaftaran.');
      if(action.question==='apply')return t('现在可以报名。打开班次列表，选班后验证邮箱并提交申请。','Yes, you can apply now. Open the class list, choose a class, then verify your email and submit.','Bisa, Anda dapat mendaftar sekarang. Buka daftar kelas, pilih kelas, lalu verifikasi email dan kirim pendaftaran.');
      if(action.question==='reserve')return [reserve,apply].join(' ');
      return t('你可以按级别、时段和班型查看课程。','Browse classes by level, schedule, and class type.','Lihat kelas berdasarkan level, jadwal, dan jenis kelas.');
    default:return t('你可以按级别、时段和班型查看课程。','Browse classes by level, schedule, and class type.','Lihat kelas berdasarkan level, jadwal, dan jenis kelas.');
  }
}
