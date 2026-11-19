import { readPublicEnrollmentAppointments, readPublicEnrollmentClasses } from './enrollmentCatalog.ts';
import { enrollmentReadiness } from './enrollmentApplication.ts';
import { formatCurrency } from '../../src/utils/currency.ts';
import {
  enrollmentClassTitle, enrollmentTeacherLabel, enrollmentWeeklyScheduleText, enrollmentWeekdays,
} from '../../src/utils/enrollmentCatalog.ts';
import {
  enrollmentGuideRows, enrollmentGuideText, enrollmentLevelMatches, enrollmentScheduleConflict, matchEnrollmentGuidance,
  normalizeEnrollmentIntent, type ConsultationConstraints, type EnrollmentGuideAction, type EnrollmentGuideLanguage, type EnrollmentQuote,
} from '../../src/utils/enrollmentGuidance.ts';

export const chatEnrollmentInstruction = `
For any UPER Mandarin course or Enrollment request, use the optional "enrollment" field in your JSON response. It takes priority over "catalogue", which is only for non-Enrollment programmes. Set catalogue:null for Enrollment. Choose the action that resolves the current task:
- quote: current tuition, a cost breakdown, or a PRICE comparison by class type. "levels":["HSK 1"], "formats":["standard","small","one-on-one"]. Use "level" for a single target; no level means all levels only if the learner asked for general prices. Use "requestedPeriods" for a private lesson quantity the learner explicitly asks about. One-to-one price questions use quote, not appointment. A learning-experience comparison is not a price request; answer it directly without replacing it with a price list.
- recommend: recommend real classes, check concrete availability, or update a recommendation after preferences changed. For example {"kind":"recommend","level":"HSK 3","format":"standard","windows":[{"day":5,"earliest":"19:00"},{"day":6,"earliest":"15:00","latestEnd":"17:00"}]}. Days are ISO Monday=1 to Sunday=7. All confirmed times are WIB. earliest/latest refer to start; latestEnd refers to when the student must leave. windows lists ALL currently available days when day-specific constraints are known. Use the latest learner-stated constraints, including corrections. Set anyTime only for explicitly flexible timing. Use needsReview only when an unresolved constraint genuinely affects the recommendation (e.g. unknown timezone, unresolved level); do not use it for representable multi-day availability.
 For a hard total budget in Indonesian rupiah set maximumTotal (an integer); for a latest or earliest allowed first class, use latestDate or earliestDate (YYYY-MM-DD in WIB). Never imply that an out-of-budget class matches.
 Use the published schedule's WIB for ordinary browsing and confirmed Jakarta preferences. When a learner explicitly means a different or unresolved local timezone, clarify it or convert if known; don't treat an unstated timezone as a conflict in every Indonesian course enquiry. Valid period values are weekend, weekday-evening or mixed; express "afternoon" etc. in time windows. When a beginner explicitly asks to find a class and has no conflicting placement, HSK 1 is a suggested starting point.
 Only set format or formats as a filter when the learner specifically requests those class types. For example, wanting to speak more does not mean they can only accept a small group. If the learner has multiple acceptable types use formats rather than choosing one for them. Never replace known hard restrictions in a follow-up that only asks for details or a reason. To replace any existing constraint, include constraintEvidence as an exact quote from the CURRENT learner message that changes the requirement and supply the full revised constraints, including those unchanged.
- inspect: answer a follow-up about actual fees, dates, schedules, duration, or seats for classes previously shown. Put their IDs (in the order asked) in "referenceIds". Use ONLY IDs provided in the previous recommendation context. A recent focus on one class must not hide the original pair when the learner asks about the two classes. Choose "fields" from price, duration, first, weekly, seats, materials, teacher. Use recommend for new constraints, even if "referenceIds" also names the class the learner wants to verify.
- specifications: look up official textbook, teaching outcomes, number of periods or teacher type. Include requested level, optional levels array, format and period, or supplied referenceIds for specific classes. Do not guess the textbook or staffing.
- demand: the learner requests the existing course preference form or wants to register what they need without enrolling. Return demand even with missing fields, even if no class has been checked. Also use it when recommendation explicitly concludes that a preference form is their best next step. Use safe known level, period, and format filters. Do not say the form does not exist. It does not reserve a seat or take payment.
- advisor: the learner explicitly requests a person, or wants an offline option that requires validation. For offline set "offline":true and include known level and period. Explain what the advisor needs to confirm. Use the server's contact button rather than writing phone numbers, addresses, or URLs. Never promise a call, a date, or a place.
- appointment: the learner wants to arrange private lessons. Include level and preferred period if known.
- records: the learner wants to check their own enrollment, payment, or refund status. They must verify their email.
- viewing: asks whether browsing requires a phone or email, or explicitly wants to see details without applying. Include level if known. Never infer consent.
- browse: discovery without enough constraints for a specific recommendation. On a saved assessment introduction, always include a browsing entry for the suggested level unless the learner explicitly declined; preserve your brief learning recommendation in reply.
Treat negation, quoted past questions, hypotheticals and deferral according to the current context, not as action confirmations. A refusal to enroll does not prevent answering a price or comparison question. Use enrollment:null when there is no desired or relevant action. A request for a clear next step is not consent to a submission.
 If the learner explicitly names an out-of-catalogue level, keep that exact level in the structured action. Do not suggest a different level unless asked. Answer substantive learning questions even when the learner chooses only to browse. The server will explain which enrollment data is actually available.
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
  const {kind,level,format,period}=intent;
  if(kind==='advisor'){
    const offline=typeof value==='object'&&value!==null&&'offline' in value&&value.offline===true;
    return {kind,level,period,format,offline};
  }
  if(kind==='browse'||kind==='viewing')return matchEnrollmentGuidance(intent,[]);
  try{
    if(kind==='quote'||kind==='appointment'){
      const formats=intent.quoteFormats.length?intent.quoteFormats:intent.format?[intent.format]:[];
      if(intent.invalidLevel&&!level&&!intent.quoteLevels.length)return {kind,format,quoteMissing:true,quotes:[]};
      const noGroups=kind==='appointment'||formats.every(format=>format==='one-on-one')&&formats.length>0;
      const quotes=enrollmentQuoteRows(intent,noGroups?[]:await readPublicEnrollmentClasses(c),
        !formats.length||formats.includes('one-on-one')||kind==='appointment'?await readPublicEnrollmentAppointments(c):[]);
      const levels=intent.quoteLevels.length?intent.quoteLevels:level?[level]:[];
      const quoteMissing=intent.invalidLevel||!quotes.length||levels.some(requested=>!quotes.some(row=>enrollmentLevelMatches(requested,row.level)))||
        formats.some(format=>!quotes.some(row=>row.format===format));
      return {kind,level:levels.length===1?levels[0]:level,period,format:formats.length===1?formats[0]:format,requestedPeriods:intent.requestedPeriods,
        classId:quotes.length===1&&!quotes[0].unitPriced?quotes[0].id:undefined,quotes,quoteMissing};
    }
    if(kind==='inspect'||kind==='specifications'){
      const levels=intent.quoteLevels.length?intent.quoteLevels:level?[level]:[];
      if(!intent.referenceIds.length&&(kind==='inspect'||!levels.length))return {kind:'catalog',level,format};
      const classes=await readPublicEnrollmentClasses(c);
      const rows=intent.referenceIds.length?intent.referenceIds.flatMap(id=>classes.filter(row=>row.id===id)):
        [...new Map(classes.filter(row=>levels.some(requested=>enrollmentLevelMatches(requested,row.level))&&
          (!format||row.format===format)&&(!period||row.period===period)).map(row=>
          [JSON.stringify([row.level,row.material,row.teacherType,row.sessions,row.minutes]),row])).values()];
      if(!rows.length)return {kind:'unavailable',level,format,referenceUnavailable:true};
      const compare=kind==='inspect'&&(!intent.detailFields.length||intent.detailFields.includes('weekly'))
        ?normalizeEnrollmentIntent({kind:'recommend',...previousConstraints}):undefined;
      const scheduleConflict=compare?rows.map(row=>enrollmentScheduleConflict(compare,row)).find(conflict=>!!conflict):undefined;
      return {kind:'class',level,format,rows:enrollmentGuideRows(rows),inspection:true,
        scheduleConflict,
        detailFields:intent.detailFields.length?intent.detailFields:kind==='specifications'?['duration','materials','teacher']:undefined,
        referenceUnavailable:rows.length<intent.referenceIds.length};
    }
    const readiness=await enrollmentReadiness(c);
    if(kind==='records')return {kind:readiness.servicing?'records':'advisor'};
    if(!readiness.accepting)return {kind:'paused',level,period,format};
    if(kind==='demand')return matchEnrollmentGuidance(intent,[]);
    return matchEnrollmentGuidance(intent,await readPublicEnrollmentClasses(c));
  }catch{return {kind:'unavailable',level,period,format};}
}

export function enrollmentReply(action:EnrollmentGuideAction,lang:EnrollmentGuideLanguage){
  const t=(zh:string,en:string,id:string)=>enrollmentGuideText(lang,zh,en,id);
  const amount=(price:number)=>formatCurrency(price,lang);
  const missing=t('部分所询选项暂无可核实的公开报价。','A verified public price is unavailable for some of these options.','Harga resmi untuk sebagian pilihan ini belum dapat dipastikan.');
  const unavailable=t('先前推荐的班次中，有班次已无法从报名目录核实。','Some previously shown classes can no longer be verified in the enrollment directory.','Sebagian kelas yang sebelumnya ditampilkan tidak lagi dapat diverifikasi di katalog.');
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
  const appointment=t('一对一时间与实际购买节数由 UPER 顾问和你确认。','A UPER advisor confirms the one-to-one schedule and number of periods with you.','Tim UPER akan mengonfirmasi jadwal dan jumlah jam pelajaran privat bersama Anda.');
  const conflict=action.scheduleConflict;
  const day=conflict?enrollmentWeekdays[conflict.day-1]:undefined;
  const conflictReason=conflict&&day?t(`冲突在${day[0]}。课表为 ${conflict.start}–${conflict.end} WIB，超出了你提供的可上课时间。`,
    `The conflict is on ${day[1]}. The ${conflict.start}–${conflict.end} WIB session is outside your availability.`,
    `Jadwal pada ${day[2]} pukul ${conflict.start}–${conflict.end} WIB berada di luar waktu yang Anda bisa.`):'';
  switch(action.kind){
    case 'quote':
    case 'appointment':return [
      quoted(action.quotes??[]),action.quoteMissing?missing:'',
      action.kind==='appointment'||action.quotes?.some(row=>row.unitPriced)?appointment:'',
    ].filter(Boolean).join('\n\n');
    case 'class':{
      if(!action.inspection)return t('按 WIB 课表核对，这些班次符合你提供的条件。','These classes match your preferences using the WIB schedules.','Kelas ini sesuai dengan preferensi Anda berdasarkan jadwal WIB.');
      const rows=action.rows??[];
      return [
        conflictReason,
        ...rows.map(row=>{
          const availability=row.availability==='full'?t('已满，可候补','full; waitlist available','penuh; daftar tunggu tersedia'):
            row.availability==='limited'?t('余位不多','limited seats','tempat terbatas'):t('有余位','seats available','tempat tersedia');
          const quantity=t(`${row.sessions} 节 × ${row.minutes} 分钟`,`${row.sessions} periods × ${row.minutes} min`,`${row.sessions} jam pelajaran × ${row.minutes} menit`);
          const teacher=enrollmentTeacherLabel(row.teacherType,lang);
          const material=row.material?t(`教材 ${row.material}`,`textbook: ${row.material}`,`buku: ${row.material}`):'';
          const periods=row.sessions??0;
          const unit=periods>0&&row.price%periods===0
            ?t(`每节 ${amount(row.price/periods)}`,`${amount(row.price/periods)}/period`,`${amount(row.price/periods)}/jam pelajaran`):'';
          const standard=row.standardPrice&&row.standardPrice>row.price?t(`标准总价 ${amount(row.standardPrice)}`,`standard total ${amount(row.standardPrice)}`,`total harga normal ${amount(row.standardPrice)}`):'';
          const details={
            duration:[quantity],price:[amount(row.price),standard,unit],
            first:[`${t('首课','First class','Kelas pertama')} ${row.firstLesson.replace('T',' ')} WIB`],
            weekly:[enrollmentWeeklyScheduleText(row.weeklySchedule,row.minutes,lang)],seats:[availability],
            materials:[material||t('教材待确认','Textbook to be confirmed','Buku perlu dikonfirmasi')],teacher:[teacher],
          };
          const fields=Object.keys(details) as (keyof typeof details)[];
          const requested=fields.filter(field=>!action.detailFields||action.detailFields.includes(field));
          return '- '+[enrollmentClassTitle(row,lang),...requested.flatMap(field=>details[field])].filter(Boolean).join(' · ');
        }),action.referenceUnavailable?unavailable:'',
      ].filter(Boolean).join('\n');
    }
    case 'waitlist':return t('符合条件的班次目前已满，可以加入候补。','The classes that match are full. You can join a waitlist.','Kelas yang sesuai sedang penuh. Anda dapat masuk daftar tunggu.');
    case 'demand':{
      return [conflictReason,action.explicitDemand?'':t('目前没有符合这些条件的班次。','No current class matches these preferences.','Saat ini belum ada kelas yang sesuai.'),
        t('你可以登记选课需求，把具体时间填进备注。登记无需付款，也不会占用席位。','You can submit your course preferences and add specific times in the notes. This does not require payment or reserve a seat.','Anda dapat mengirim preferensi kelas dan menambahkan waktu di kolom catatan. Pengisian ini tidak memerlukan pembayaran atau memesan tempat.')].filter(Boolean).join(' ');
    }
    case 'unavailable':return action.referenceUnavailable?unavailable:t('暂时无法核实公开班次或报价。你可以稍后重试，也可以打开报名页查看。','I couldn’t verify current classes or prices. Try again shortly or check the enrollment page.','Kelas atau harga saat ini belum dapat diperiksa. Coba lagi nanti atau buka halaman pendaftaran.');
    case 'paused':return t('目前暂停接受新报名和新的选课需求。你仍可查看课程，也可以在「我的报名」查看已有记录。','New enrollment and new course preference submissions are paused. You can still browse or check existing records in My Enrollments.','Pendaftaran dan pengiriman preferensi baru sedang dijeda. Anda tetap dapat melihat kelas dan riwayat di Pendaftaran Saya.');
    case 'advisor':return action.offline?t('目前报名目录能核实的是线上课。雅加达线下面授的地点和时间请与 UPER 确认。','The current enrollment catalogue covers online classes. Check in-person availability, location and timing in Jakarta with UPER.','Katalog pendaftaran saat ini memuat kelas online. Konfirmasikan ketersediaan, lokasi, dan jadwal tatap muka di Jakarta kepada UPER.'):
      t('你可以通过下方入口主动联系 UPER 顾问。','Use the link below to contact a UPER advisor.','Gunakan tautan di bawah untuk menghubungi tim UPER.');
    case 'records':return t('请在「我的报名」验证报名邮箱，再查看订单、凭证和核款结果。','Verify your enrollment email in My Enrollments to see the order, proof of transfer, and payment verification.','Verifikasi email pendaftaran di Pendaftaran Saya untuk melihat pesanan, bukti transfer, dan hasil verifikasi pembayaran.');
    case 'viewing':return t('可以。查看公开课表、学费和余位无需填电话或验证邮箱。','Yes. You can check public schedules, fees, and seats without a phone number or email verification.','Bisa. Anda dapat melihat jadwal, biaya, dan ketersediaan tanpa nomor telepon atau verifikasi email.');
    case 'catalog':
      if(action.levelUnavailable)return t('目前的公开报名目录没有你询问的级别。','The requested level is not in the current enrollment catalogue.','Level yang Anda cari belum ada di katalog pendaftaran.');
      return t('你可以按级别、时段和班型查看课程。','Browse classes by level, schedule, and class type.','Lihat kelas berdasarkan level, jadwal, dan jenis kelas.');
    default:return t('你可以按级别、时段和班型查看课程。','Browse classes by level, schedule, and class type.','Lihat kelas berdasarkan level, jadwal, dan jenis kelas.');
  }
}
