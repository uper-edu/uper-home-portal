import { readPublicEnrollmentAppointments, readPublicEnrollmentClasses } from './enrollmentCatalog.ts';
import { enrollmentReadiness } from './enrollmentApplication.ts';
import { formatCurrency } from '../../src/utils/currency.ts';
import {
  enrollmentClassSizeText, enrollmentClassTitle, enrollmentTeacherLabel, enrollmentWeeklyScheduleText, enrollmentWeekdays,
} from '../../src/utils/enrollmentCatalog.ts';
import {
  enrollmentAppointmentRequested, enrollmentGuideRows, enrollmentGuideText, enrollmentLevelMatches, enrollmentScheduleConflict, matchEnrollmentGuidance,
  normalizeEnrollmentIntent, type ConsultationConstraints, type EnrollmentGuideAction, type EnrollmentGuideLanguage, type EnrollmentQuote,
} from '../../src/utils/enrollmentGuidance.ts';

export const chatEnrollmentInstruction = `
For any UPER Mandarin course or Enrollment request, use the optional "enrollment" field in your JSON response. It takes priority over "catalogue", which is only for non-Enrollment programmes. Set catalogue:null for Enrollment. Choose the action that resolves the current task:
- quote: current tuition, a cost breakdown, or a PRICE comparison by class type. "levels":["HSK 1"], "formats":["standard","small","one-on-one"]. Use "level" for a single target; no level means all levels only if the learner asked for general prices. Use "requestedPeriods" for a private lesson quantity the learner explicitly asks about. One-to-one price questions use quote, not appointment. A learning-experience comparison is not a price request; answer it directly without replacing it with a price list.
 When the current question asks what a price covers, use question:"period_unit". Omit fields for a standalone question about the unit. If this same turn also asks for amounts or a cost breakdown, add "price" to fields. If it also asks whether or how the learner can register or arrange private lessons, add "appointment" to fields. Include both fields if both are asked.
- recommend: recommend real classes, check concrete availability, or update a recommendation after preferences changed. For example {"kind":"recommend","level":"HSK 3","format":"standard","windows":[{"day":5,"earliest":"19:00"},{"day":6,"earliest":"15:00","latestEnd":"17:00"}]}. Days are ISO Monday=1 to Sunday=7. All confirmed times are WIB. earliest/latest refer to start; latestEnd refers to when the student must leave. windows lists ALL currently available days when day-specific constraints are known. Use the latest learner-stated constraints, including corrections. Set anyTime only for explicitly flexible timing. Use needsReview only when an unresolved constraint genuinely affects the recommendation (e.g. unknown timezone, unresolved level); do not use it for representable multi-day availability.
 For a hard total budget in Indonesian rupiah set maximumTotal (an integer); for a latest or earliest allowed first class, use latestDate or earliestDate (YYYY-MM-DD in WIB). Never imply that an out-of-budget class matches.
 Use the published schedule's WIB for ordinary browsing and confirmed Jakarta preferences. When a learner explicitly means a different or unresolved local timezone, clarify it or convert if known; don't treat an unstated timezone as a conflict in every Indonesian course enquiry. Valid period values are weekend, weekday-evening or mixed; express "afternoon" etc. in time windows. When a beginner explicitly asks to find a class and has no conflicting placement, HSK 1 is a suggested starting point.
 Only set format or formats as a filter when the learner specifically requests those class types. For example, wanting to speak more does not mean they can only accept a small group. If the learner has multiple acceptable types use formats rather than choosing one for them. Never replace known hard restrictions in a follow-up that only asks for details or a reason. To replace any existing constraint, include constraintEvidence as an exact quote from the CURRENT learner message that changes the requirement and supply the full revised constraints, including those unchanged.
- inspect: answer a follow-up about actual fees, dates, schedules, duration, or seats for classes previously shown. Put their IDs (in the order asked) in "referenceIds". Use ONLY IDs provided in the previous recommendation context. A recent focus on one class must not hide the original pair when the learner asks about the two classes. Choose "fields" from price, duration, first, weekly, seats, materials, teacher, class_size, outcomes. Use recommend for new constraints, even if "referenceIds" also names the class the learner wants to verify.
- specifications: look up official textbook, teaching outcomes, number of periods or teacher type when the learner asks for those facts in the current turn. Include the requested level, optional levels array, format and period, or supplied referenceIds for specific classes. Do not guess the textbook or staffing. A follow-up asking which of two levels suits them is a learning advice question, not another request for textbook or teacher facts. Explain the trade-off in reply (starting from scratch versus already comfortable with basic Mandarin) and ask about their foundation if unknown. Do not infer the language of instruction from teacher type or call previously supplied Enrollment facts unverified merely because the current question asks for advice. For advice without a concrete fact or class request, use enrollment:null or browse if a browsing link would help.
 For a question about class size or maximum, the named teacher, or learning outcomes, use inspect with known referenceIds, or specifications with the requested level, format, period, batchNumber or exact first date (equal earliestDate and latestDate). Only include the fields asked for: class_size, teacher, outcomes, or seats. For actual enrollment or paid counts, say these are not public and offer the seats status instead. Seat status gives approximate availability, never exact remaining seats or occupancy. Distinguish the advertised group size from the current number of learners.
- demand: the learner requests the existing course preference form or wants to register what they need without enrolling. Return demand even with missing fields, even if no class has been checked. Also use it when recommendation explicitly concludes that a preference form is their best next step. Use safe known level, period, and format filters. When the learner explicitly asks for just the link, set question:"link_only". Do not say the form does not exist. It does not reserve a seat or take payment.
- advisor: the learner explicitly requests a person, or wants an offline option that requires validation. Include the level, format, and period already known from the conversation so the contact handoff can carry them. For offline set "offline":true. Explain what the advisor needs to confirm. Use the server's contact button rather than writing phone numbers, addresses, or URLs. Never promise a call, a date, or a place.
- appointment: the learner asks how to arrange private lessons, or wants to book a time. Include level and preferred period if known. Use fields:["price"] only when they ask for the price in this turn. If the same turn explicitly asks both price and how to arrange it, use appointment with that field, or quote with question:"appointment".
- records: the learner asks about their own enrollment, cancelling an unpaid order, uploading a receipt, payment verification, or a refund. They must verify their email. Set question to the most specific current situation. If this turn only asks where or how to open their order, payment status or refund status, set question:"records_location". Use "proof_after_cancellation" if the learner has already transferred and says the class or order may be cancelled, expired, or closed. This includes follow-ups asking whether to pay a different account or how to prove the original transfer, even if they don't repeat that context. Use "payment_verification" only for an ordinary or partial-payment verification question. Use "cancel_unpaid" for whether an unpaid order can be cancelled, "expired_unpaid" for what happens when an unpaid order passes its deadline, or "refund" for refund eligibility, processing or timing questions.
- viewing: asks whether browsing requires a phone or email, or explicitly wants to see details without applying. Use this even if the learner mentions a previously shown schedule and their main question is whether they need to leave contact information. If they also explicitly ask for the exact current schedule, use inspect or recommend with question:"view_without_contact" and fields:["weekly"]. Include level if known. Never infer consent.
- browse: discovery without enough constraints for a specific recommendation. On a saved assessment introduction, always include a browsing entry for the suggested level unless the learner explicitly declined; preserve your brief learning recommendation in reply.
Treat negation, quoted past questions, hypotheticals and deferral according to the current context, not as action confirmations. A refusal to enroll does not prevent answering a price or comparison question. Use enrollment:null when there is no desired or relevant action. A request for a clear next step is not consent to a submission.
 If the learner explicitly names an out-of-catalogue level, keep that exact level in the structured action. Do not suggest a different level unless asked. Answer substantive learning questions even when the learner chooses only to browse. The server will explain which enrollment data is actually available.
 For quote, inspect, or recommend, mark the current question as "period_unit" when the learner asks whether price is per period or per multi-period session, "reserve" when asking if chat can hold a seat, or "apply" for an explicit question about the next registration step. Set "starting_point" whenever a beginner or a learner with a saved assessment asks which level or class to start with, including when they also give their schedule. For a compound question include the requested facts in fields (e.g. ["duration","price"] for reference prices and lesson length or ["weekly"] for the two days' exact times). On a recommendation use referenceIds only when the current request explicitly points to a previously shown class. Leave off question if no such guidance is needed. Never treat these questions as a booking or write request.
Say what answers the question first, or give useful decision advice. Use one clarifying question only if it changes the recommendation. Leave current prices, durations, class schedules, IDs, seats and links to the server. Do not say a fact is unavailable just because you did not receive it; return the right structured action so the server can check. Never ask for phone or email merely to view a course. Reply naturally and briefly; facts and links will be added by the server. Do not infer an official HSK level or guarantee an outcome.`;

type Client=Parameters<typeof readPublicEnrollmentClasses>[0];
type Intent=NonNullable<ReturnType<typeof normalizeEnrollmentIntent>>;

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
  const classQuotes=classes.filter(row=>qualifies(row)&&(!intent.period||row.period===intent.period))
    .map(row=>({id:row.id,level:row.level,format:row.format,period:row.period,batchNumber:row.batchNumber,
      periods:row.sessions,minutes:row.minutes,actual:row.price,standard:row.standardPrice,unitPriced:false}));
  const privateQuotes:EnrollmentQuote[]=appointments.map(row=>({
    id:row.id,level:row.level,format:'one-on-one',course:row.course,teacherType:row.teacherType,
    periods:row.lessons,minutes:row.minutes,actual:row.price,standard:row.standardPrice,unitPriced:true,
  })).filter(qualifies);
  // Identical group tuition needs one representative; differing quotes retain their own class.
  const used=new Set<string>();
  return [...classQuotes,...privateQuotes].filter(row=>{
    if(!(row.actual>0&&row.periods>0&&row.minutes>0))return false;
    const key=row.unitPriced?row.id:JSON.stringify([row.level,row.format,row.actual,row.standard,row.periods,row.minutes]);
    if(used.has(key))return false;
    used.add(key);
    return true;
  }).sort((a,b)=>a.level.localeCompare(b.level,'en',{numeric:true}));
}

export async function chatEnrollmentAction(
  c:Client,value:unknown,assessmentIntroduction:boolean,profileIntroduction:boolean,
  knownReferences:readonly string[]=[],previousConstraints?:ConsultationConstraints,
):Promise<EnrollmentGuideAction|undefined>{
  if(value===null)return undefined;
  const intent=normalizeEnrollmentIntent(value);
  if(!intent)return assessmentIntroduction||profileIntroduction||value!==undefined?{kind:'catalog'}:undefined;
  intent.referenceIds=intent.referenceIds.filter(id=>knownReferences.includes(id));
  const {kind,level,format,period,question}=intent;
  if(kind==='advisor'){
    const offline=typeof value==='object'&&value!==null&&'offline' in value&&value.offline===true;
    return {kind,level,period,format,offline};
  }
  if(kind==='browse'||kind==='viewing')return matchEnrollmentGuidance(intent,[]);
  try{
    if(kind==='quote'||kind==='appointment'){
      const formats=intent.quoteFormats.length?intent.quoteFormats:intent.format?[intent.format]:[];
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
        classId:quotes.length===1&&!quotes[0].unitPriced?quotes[0].id:undefined,quotes,quoteMissing};
    }
    if(kind==='inspect'||kind==='specifications'){
      const levels=intent.quoteLevels.length?intent.quoteLevels:level?[level]:[];
      if(!intent.referenceIds.length&&(kind==='inspect'||!levels.length))return {kind:'catalog',level,format};
      const classes=await readPublicEnrollmentClasses(c);
      const matched=classes.filter(row=>levels.some(requested=>enrollmentLevelMatches(requested,row.level))&&
        (!format||row.format===format)&&(!period||row.period===period)&&
        (!intent.batchNumber||row.batchNumber===intent.batchNumber)&&
        (!intent.earliestDate||row.firstLesson.slice(0,10)>=intent.earliestDate)&&
        (!intent.latestDate||row.firstLesson.slice(0,10)<=intent.latestDate));
      const specific=intent.batchNumber||intent.earliestDate||intent.latestDate||
        intent.detailFields.some(field=>['class_size','teacher','outcomes','seats'].includes(field));
      const rows=intent.referenceIds.length?intent.referenceIds.flatMap(id=>classes.filter(row=>row.id===id)):
        specific?matched:[...new Map(matched.map(row=>
          [JSON.stringify([row.level,row.material,row.teacherType,row.sessions,row.minutes]),row])).values()];
      if(!rows.length)return {kind:'unavailable',level,format,referenceUnavailable:true};
      const compare=kind==='inspect'&&(!intent.detailFields.length||intent.detailFields.includes('weekly'))
        ?normalizeEnrollmentIntent({kind:'recommend',...previousConstraints}):undefined;
      const scheduleConflict=compare?rows.map(row=>enrollmentScheduleConflict(compare,row)).find(conflict=>!!conflict):undefined;
      return {kind:'class',level,format,question,rows:enrollmentGuideRows(rows),inspection:true,
        intakePaused:(question==='apply'||question==='reserve')&&!(await enrollmentReadiness(c)).accepting,
        scheduleConflict,
        detailFields:intent.detailFields.length?intent.detailFields:kind==='specifications'?['duration','materials','teacher']:undefined,
        referenceUnavailable:rows.length<intent.referenceIds.length};
    }
    const readiness=await enrollmentReadiness(c);
    if(kind==='records')return readiness.servicing?{kind,question}:{kind:'advisor'};
    if(!readiness.accepting)return {kind:'paused',level,period,format,question};
    if(kind==='demand')return matchEnrollmentGuidance(intent,[]);
    return matchEnrollmentGuidance(intent,await readPublicEnrollmentClasses(c));
  }catch{return {kind:'unavailable',level,period,format,question};}
}

export function enrollmentReply(action:EnrollmentGuideAction,lang:EnrollmentGuideLanguage){
  const t=(zh:string,en:string,id:string)=>enrollmentGuideText(lang,zh,en,id);
  const amount=(price:number)=>formatCurrency(price,lang);
  const rows=action.rows??[];
  const minutes=[...new Set([...(action.quotes??[]),...rows].map(row=>row.minutes).filter(value=>value>0))];
  const unitAnswer=minutes.length===1?t(`报价按一节 ${minutes[0]} 分钟计算。一次上课如果安排两节，就计两节。`,
    `The unit price covers one ${minutes[0]}-minute period. A session with two periods counts as two.`,
    `Harga satuan berlaku untuk satu jam pelajaran ${minutes[0]} menit. Jika satu sesi terdiri dari dua jam pelajaran, keduanya dihitung.`):
    t('单价按一节课计算。一次上课可以安排多节，计费按实际节数。','The unit price is per period. A session may include several periods, and each period counts toward tuition.','Harga satuan dihitung per jam pelajaran. Satu sesi dapat mencakup beberapa jam pelajaran, dan masing-masing dihitung dalam biaya kursus.');
  const reserve=t('我无法在聊天里帮你锁位。','I can’t hold a seat in chat.','Saya tidak dapat menahan tempat melalui chat.');
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
  const appointment=t('一对一由 UPER 顾问约课。打开下方入口，告诉我们你方便的日期和时间，再和顾问确认具体安排及购买节数。',
    'To arrange private lessons, open the link below and share when you’re available. A UPER advisor will confirm the schedule and number of periods with you.',
    'Untuk menjadwalkan kelas privat, buka tautan di bawah dan sampaikan waktu yang Anda inginkan. Tim UPER akan mengonfirmasi jadwal dan jumlah jam pelajaran bersama Anda.');
  const conflict=action.scheduleConflict;
  const day=conflict?enrollmentWeekdays[conflict.day-1]:undefined;
  const conflictReason=conflict&&day?t(`冲突在${day[0]}。课表为 ${conflict.start}–${conflict.end} WIB，超出了你提供的可上课时间。`,
    `The conflict is on ${day[1]}. The ${conflict.start}–${conflict.end} WIB session is outside your availability.`,
    `Jadwal pada ${day[2]} pukul ${conflict.start}–${conflict.end} WIB berada di luar waktu yang Anda bisa.`):'';
  switch(action.kind){
    case 'quote':
    case 'appointment':{
      const showPrices=action.detailFields?.includes('price')||action.requestedPeriods||
        (action.kind==='quote'&&action.question!=='period_unit');
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
      const question=action.question;
      const hasRoom=rows.some(row=>row.availability==='available'||row.availability==='limited');
      const requested=action.detailFields?.length?action.detailFields:question==='reserve'?['seats']:question==='period_unit'?[]:
        action.inspection&&!question?undefined:['weekly','price','first'];
      const maximum=action.maximumTotal;
      const budget=maximum&&rows.length&&rows.every(row=>row.price>0&&row.price<=maximum)?amount(maximum):'';
      const priceBreakdown=action.inspection||question==='period_unit'||action.detailFields?.includes('price');
      const first=rows[0];
      const sameClassType=first&&rows.every(row=>row.level===first.level&&row.format===first.format&&row.period===first.period);
      const option=sameClassType&&!action.inspection?enrollmentClassTitle({...first,batchNumber:undefined},lang):'';
      const recommendation=option&&budget?t(`按你的预算，可以先看 ${option}。下方班次的实付总价在 ${budget} 以内。`,
        `For your budget, I’d start with ${option}. The tuition shown below is within ${budget}.`,
        `Untuk anggaran Anda, saya sarankan mulai dari ${option}. Biaya kursus di bawah ini masih dalam anggaran ${budget}.`):
        budget?t(`下方班次的实付总价在 ${budget} 以内。`,`The tuition shown below is within ${budget}.`,`Biaya kursus di bawah ini masih dalam anggaran ${budget}.`):
        !action.inspection&&action.detailFields?.includes('weekly')&&rows.length&&!conflict?t('下方班次的每周课表符合你给出的时间。',
          'The weekly schedule below fits the hours you shared.','Jadwal mingguan di bawah ini sesuai dengan waktu yang Anda sampaikan.'):
        option&&!action.detailFields?.length?t(`按你给出的条件，可以先看 ${option}。`,`Based on what you’ve told me, I’d start with ${option}.`,
          `Berdasarkan kebutuhan Anda, saya sarankan mulai dari ${option}.`):'';
      const introduction=question==='period_unit'?unitAnswer:question==='reserve'?reserve:question==='view_without_contact'?viewing:
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
        const fields=requested??Object.keys(details);
        const isDetail=(field:string):field is keyof typeof details=>Object.hasOwn(details,field);
        const facts=fields.filter(isDetail).flatMap(field=>details[field]).filter(Boolean);
        return {name:enrollmentClassTitle(row,lang),facts};
      });
      const sharedFacts=sameClassType&&rowDescriptions.length>1
        ?rowDescriptions[0].facts.filter(fact=>rowDescriptions.every(row=>row.facts.includes(fact))):[];
      const formatFacts=(facts:string[])=>facts.join(lang==='zh'?'；':'. ')+(lang==='zh'?'。':'.');
      const individual=rowDescriptions.map(row=>{
        const facts=row.facts.filter(fact=>!sharedFacts.includes(fact));
        return facts.length?`${rows.length>1?'- ':''}**${row.name}**${lang==='zh'?'，':'. '}${formatFacts(facts)}`:'';
      });
      return [
        question==='reserve'?introduction:'',
        action.intakePaused?t('现在暂停接受新报名。你仍可查看下方课表。',
          'New applications are currently paused. You can still check the schedule below.','Pendaftaran baru sedang dijeda. Anda tetap dapat melihat jadwal di bawah.'):'',
        question==='reserve'?'':introduction,
        conflictReason,
        sharedFacts.length?t(`两班共有以下信息。${formatFacts(sharedFacts)}`,`For both classes. ${formatFacts(sharedFacts)}`,`Informasi untuk kedua kelas. ${formatFacts(sharedFacts)}`):'',
        ...individual,action.referenceUnavailable?unavailable:'',
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
      if(action.explicitDemand&&action.question==='link_only')return t('选课需求表在下方。','The course preferences form is below.','Formulir preferensi kursus tersedia di bawah.');
      return [action.question==='reserve'?reserve:'',conflictReason,action.explicitDemand?'':t('目前没有符合这些条件的班次。','No current class matches these preferences.','Saat ini belum ada kelas yang sesuai.'),
        t('你可以登记选课需求，把具体时间填进备注。登记无需付款，也不会占用席位。','You can submit your course preferences and add specific times in the notes. This does not require payment or reserve a seat.','Anda dapat mengirim preferensi kelas dan menambahkan waktu di kolom catatan. Pengisian ini tidak memerlukan pembayaran atau memesan tempat.'),
        action.level==='other'?t('表单已将级别选为「其他」。请在备注填写你想学的级别。',
          'The form is set to “Other.” Add the level you want in the notes.','Formulir sudah memilih “Lainnya”. Tulis level yang Anda inginkan di kolom catatan.'):'',
        action.explicitDemand&&!action.level?t('级别还不确定，可以选「不确定我的级别」。','If you’re unsure of your level, choose “Not sure about my level.”',
          'Jika belum tahu level Anda, pilih “Belum yakin level saya”.'):'',
        action.explicitDemand&&!action.format?t('班型没想好，可以选「不限」。','You can choose “Any” if you’re flexible about class type.',
          'Pilih “Bebas” jika jenis kelasnya fleksibel.'):''].filter(Boolean).join(' ');
    }
    case 'unavailable':return [action.question==='reserve'?reserve:'',action.referenceUnavailable?unavailable:
      t('暂时无法核实公开班次或报价。你可以稍后重试，也可以打开报名页查看。','I couldn’t verify current classes or prices. Try again shortly or check the enrollment page.','Kelas atau harga saat ini belum dapat diperiksa. Coba lagi nanti atau buka halaman pendaftaran.')].filter(Boolean).join(' ');
    case 'paused':return [action.question==='reserve'?reserve:'',
      t('目前暂停接受新报名和新的选课需求。你仍可查看课程，也可以在「我的报名」查看已有记录。','New enrollment and new course preference submissions are paused. You can still browse or check existing records in My Enrollments.','Pendaftaran dan pengiriman preferensi baru sedang dijeda. Anda tetap dapat melihat kelas dan riwayat di Pendaftaran Saya.')].filter(Boolean).join(' ');
    case 'advisor':return action.offline?t('目前报名目录能核实的是线上课。雅加达线下面授的地点和时间请与 UPER 确认。','The current enrollment catalogue covers online classes. Check in-person availability, location and timing in Jakarta with UPER.','Katalog pendaftaran saat ini memuat kelas online. Konfirmasikan ketersediaan, lokasi, dan jadwal tatap muka di Jakarta kepada UPER.'):
      t('你可以通过下方入口主动联系 UPER 顾问。','Use the link below to contact a UPER advisor.','Gunakan tautan di bawah untuk menghubungi tim UPER.');
    case 'records':{
      const open=t('进入「我的报名」，验证报名邮箱后打开原订单。','Open My Enrollments, verify your enrollment email, then open the original order.','Buka Pendaftaran Saya, verifikasi email pendaftaran, lalu buka pesanan awal.');
      switch(action.question){
        case 'records_location':return open;
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
        case 'refund':return t('退款须先获批，再由财务按原支付渠道处理。我无法确认你这笔的金额或到账日期。',
          'A refund must be approved before Finance returns the money through the original payment method. I can’t confirm the amount or arrival date for your order.',
          'Refund harus disetujui sebelum tim Keuangan mengembalikan dana melalui metode pembayaran awal. Saya tidak dapat memastikan jumlah atau tanggal dana masuk untuk pesanan Anda.')+' '+open;
        default:return t('请在「我的报名」验证报名邮箱，再查看订单、凭证和核款结果。','Verify your enrollment email in My Enrollments to see the order, proof of transfer, and payment verification.','Verifikasi email pendaftaran di Pendaftaran Saya untuk melihat pesanan, bukti transfer, dan hasil verifikasi pembayaran.');
      }
    }
    case 'viewing':return viewing;
    case 'catalog':
      if(action.levelUnavailable)return t('目前的公开报名目录没有你询问的级别。','The requested level is not in the current enrollment catalogue.','Level yang Anda cari belum ada di katalog pendaftaran.');
      if(action.question==='reserve')return reserve;
      return t('你可以按级别、时段和班型查看课程。','Browse classes by level, schedule, and class type.','Lihat kelas berdasarkan level, jadwal, dan jenis kelas.');
    default:return t('你可以按级别、时段和班型查看课程。','Browse classes by level, schedule, and class type.','Lihat kelas berdasarkan level, jadwal, dan jenis kelas.');
  }
}
