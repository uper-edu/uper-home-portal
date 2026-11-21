import {enrollmentWeeklyScheduleText,type EnrollmentWeeklySchedule} from '../../src/utils/enrollmentCatalog.ts';
import { enrollmentRuleDefaults } from '../../src/utils/enrollmentRules.ts';
import { formatCurrency } from '../../src/utils/currency.ts';
import { enrollmentPreviewOrigin } from '../../src/utils/enrollmentAssistance.ts';
export { enrollmentPreviewOrigin };

export function portalPublicOrigin(env=process.env){
  const configured=env.PORTAL_PUBLIC_ORIGIN;
  if(!configured)return undefined;
  try {
    const url=new URL(configured);
    if (url.username||url.password||url.pathname!=='/'||url.search||url.hash) return undefined;
    if (url.protocol==='https:'||env.PORTAL_ENV==='dev'&&url.origin===enrollmentPreviewOrigin) return url.origin;
  } catch {
    return undefined;
  }
}
type Copy = readonly [string,string,string];
export const enrollmentEmailSubjects = {
  otp_apply:['验证报名邮箱','Verify your email','Verifikasi email pendaftaran'],
  otp_mine:['我的报名验证码','My Enrollments verification code','Kode verifikasi Pendaftaran Saya'],
  seat_reserved:['已为您暂留席位','Your seat is reserved','Kursi Anda telah direservasi sementara'],
  assistance_confirmation:['请确认报名申请','Confirm your enrollment application','Konfirmasi pengajuan pendaftaran'],
  proof_received:['转账凭证已收到','Proof of transfer received','Bukti transfer diterima'],
  payment_confirmed:['报名成功','Enrollment confirmed','Pendaftaran dikonfirmasi'],
  class_cancelled:['班次无法如期开课','Your class will not start as scheduled','Kelas tidak dapat dimulai sesuai jadwal'],
  transfer_invitation:['请查看转班邀请','Class transfer invitation','Undangan pindah kelas'],
  refund_accepted:['退款已获批','Refund approved','Pengembalian dana disetujui'],
  refund_recorded:['本次退款已发出','Refund payment sent','Pengembalian dana telah dikirim'],
  waitlist_vacancy:['候补班次有空位','Seat available in your waitlisted class','Ada kursi di kelas yang Anda tunggu'],
  demand_match:['符合需求的班次有空位','A matching class has an open seat','Ada kursi di kelas yang sesuai preferensi Anda'],
} as const;
export type EnrollmentEmailKind = keyof typeof enrollmentEmailSubjects;
export function enrollmentOrderEmailPath(kind:EnrollmentEmailKind,language:string,orderId:string,invitationId=''){
  const query=new URLSearchParams({lang:language,order:orderId});
  if(kind==='transfer_invitation'&&invitationId){
    query.set('view','invitation');
    query.set('target',invitationId);
  }
  if(kind==='refund_accepted'||kind==='refund_recorded')query.set('view','refund');
  return (kind==='seat_reserved'?'/enrollment/payment':'/enrollment/mine')+'?'+query;
}
type Facts = {language:unknown; salutation?:string; class?:string; firstLesson?:string; schedule?:string; code?:string; codeMinutes?:number;
  deadline?:string; url?:string; orderId?:string; price?:number; received?:number; expected?:number; refunded?:number;
  format?:string; period?:string; installment?:number; targetClass?:string; targetFirstLesson?:string;
  weeklySchedule?:EnrollmentWeeklySchedule; minutes?:number;
  targetWeeklySchedule?:EnrollmentWeeklySchedule; targetMinutes?:number;
  targetFormat?:string; targetPeriod?:string; targetSchedule?:string; replyBy?:string; sendBy?:string; orderState?:string};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const official='https://uperedu.com';
const supportWhatsApp='https://wa.me/6281116612062';

export function renderEnrollmentEmail(kind:EnrollmentEmailKind,facts:Facts) {
  const language=facts.language==='zh'||facts.language==='id'?facts.language:'en';
  const tr=(copy:Copy)=>copy[language==='zh'?0:language==='id'?2:1];
  const amount=(value?:number)=>value===undefined?'':formatCurrency(value,language);
  const asWib=(value?:string)=>{
    if(!value)return '';
    const parsed=new Date(value);
    return Number.isNaN(parsed.getTime())?'':new Intl.DateTimeFormat(language==='en'?'en-GB':language==='id'?'id-ID':'zh-CN',{dateStyle:'medium',timeStyle:'short',hourCycle:'h23',timeZone:'Asia/Jakarta'}).format(parsed)+' WIB';
  };
  const when=(value?:string)=>value?asWib(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)?value+'+07:00':value):'';
  const detail=(label:Copy,value?:string)=>value?.trim()?tr(label)+' · '+value.trim():'';
  const classIdentity=(level?:string,format?:string,period?:string)=>[
    level?.trim(),
    format==='standard'?tr(['标准班','Standard class','Kelas standar']):format==='small'?tr(['小班','Small group','Kelas kecil']):'',
    period==='mixed'?tr(['工作日与周末','Weekdays & weekends','Hari kerja & akhir pekan']):period==='weekend'?tr(['周末','Weekend','Akhir pekan']):period==='weekday-evening'?tr(['工作日晚课','Weekday evening','Malam hari kerja']):'',
  ].filter(Boolean).join(' · ');
  const className=classIdentity(facts.class,facts.format,facts.period);
  const name=facts.salutation?.replace(/\s+/g,' ').trim();
  const greeting=name?tr([name+'，您好！','Dear '+name+',','Halo '+name+',']):tr(['您好！','Hello,','Halo,']);
  const actions:Partial<Record<EnrollmentEmailKind,Copy>>={
    assistance_confirmation:['确认报名申请','Confirm application','Konfirmasi pengajuan'],
    seat_reserved:['查看转账信息','View bank transfer instructions','Lihat petunjuk transfer bank'],
    transfer_invitation:['查看转班邀请','Review class transfer invitation','Lihat undangan pindah kelas'],
    refund_accepted:['查看退款进度','Track refund','Lihat status pengembalian dana'],
    refund_recorded:['查看退款进度','Track refund','Lihat status pengembalian dana'],
    waitlist_vacancy:['查看班次与余位','Check class availability','Periksa ketersediaan kelas'],
    demand_match:['查看班次详情','View class details','Lihat detail kelas'],
  };
  const action=tr(actions[kind]??['查看报名详情','View enrollment details','Lihat detail pendaftaran']);
  const otp=kind==='otp_apply'||kind==='otp_mine';
  const topic=kind==='refund_accepted'&&facts.expected===0
    ?tr(['退款核算已完成','Refund assessment completed','Perhitungan pengembalian dana selesai'])
    :tr(enrollmentEmailSubjects[kind]);
  const brandedTopic='UPER · '+topic;
  const subject=brandedTopic+(!otp&&facts.class?.trim()?' · '+facts.class.trim():'');
  const firstClassLabel:Copy=kind==='class_cancelled'||kind==='transfer_invitation'
    ?['原定首课','Original first session','Jadwal awal pertemuan pertama']
    :['计划首课','Scheduled first session','Jadwal pertemuan pertama'];
  const schedule=enrollmentWeeklyScheduleText(facts.weeklySchedule,facts.minutes??45,language)||facts.schedule;
  const targetSchedule=enrollmentWeeklyScheduleText(facts.targetWeeklySchedule,facts.targetMinutes??45,language)||facts.targetSchedule;
  const classDetails=otp?[]:[
    detail(kind==='transfer_invitation'?['原班次','Original class','Kelas asal']:['班次','Class','Kelas'],className),
    detail(firstClassLabel,when(facts.firstLesson)),
    detail(['每周课表','Weekly schedule','Jadwal mingguan'],schedule),
  ];
  const cancellation=facts.orderState==='paid'||facts.orderState==='recovered'
    ? tr(['可继续等待、查看可转班次，或联系销售客服申请退款。','You can keep waiting, review class transfer options, or contact support to request a refund.','Anda dapat tetap menunggu, melihat opsi pindah kelas, atau menghubungi layanan pelanggan untuk mengajukan pengembalian dana.'])
    : facts.orderState==='partial'||facts.orderState==='proof_review'
      ? tr(['财务会继续核对原记录的转账。','Finance will continue reviewing the payment on the original record.','Tim keuangan akan tetap memeriksa pembayaran pada catatan awal.'])
      : tr(['请勿再转账。已经转账的学员仍可从原记录补交凭证。','Please do not transfer funds. If you already paid, you can submit your proof on the original record.','Jangan transfer dana. Jika sudah membayar, Anda tetap dapat mengirim bukti melalui catatan pendaftaran awal.']);
  const intro:Record<EnrollmentEmailKind,Copy> = {
    otp_apply:['请使用以下验证码验证您的报名邮箱。',
      'Use the code below to verify your email address for UPER enrollment.',
      'Gunakan kode berikut untuk memverifikasi email pendaftaran Anda.'],
    otp_mine:['请使用以下验证码验证邮箱并查看「我的报名」。',
      'Use the code below to verify your email and open My Enrollments.',
      'Gunakan kode berikut untuk memverifikasi email dan membuka Pendaftaran Saya.'],
    assistance_confirmation:['UPER 课程顾问已协助提交您的报名申请，请核对信息并确认。',
      'Your UPER enrollment advisor has submitted an application on your behalf. Please review and confirm it.',
      'Konsultan pendaftaran UPER telah mengajukan pendaftaran atas nama Anda. Silakan periksa dan konfirmasi.'],
    seat_reserved:['我们已为您暂留席位，请在截止前完成银行转账并提交转账凭证。',
      'Your seat is temporarily reserved. Please transfer the amount due and upload your proof of transfer by the deadline.',
      'Kursi Anda telah kami reservasi sementara. Silakan lakukan transfer bank dan unggah bukti transfer sebelum batas waktu.'],
    proof_received:['我们已收到您的转账凭证，接下来由财务核实到账。',
      'We have received your proof of transfer. Our finance team will now verify the payment.',
      'Bukti transfer Anda sudah kami terima. Tim keuangan akan memverifikasi pembayaran Anda.'],
    payment_confirmed:['财务已核实足额到账，您的报名已成功。',
      'We have verified your full payment and confirmed your enrollment.',
      'Pembayaran penuh Anda telah diverifikasi dan pendaftaran Anda telah dikonfirmasi.'],
    class_cancelled:['很遗憾，您报名的班次无法如期开课。',
      'We are sorry that your class will not start as scheduled.',
      'Mohon maaf, kelas Anda tidak dapat dimulai sesuai jadwal.'],
    transfer_invitation:['您收到了转班邀请，请核对新班课表，并在截止前答复。',
      'You have received a class transfer invitation. Please review the new schedule and respond by the deadline.',
      'Anda mendapat undangan pindah kelas. Silakan periksa jadwal kelas baru dan berikan jawaban sebelum batas waktu.'],
    refund_accepted:facts.expected===0
      ?['您的报名已取消，退款申请已处理。本次核算的退款金额为零。',
        'Your enrollment was canceled. We reviewed your refund request and calculated a refund amount of zero.',
        'Pendaftaran Anda telah dibatalkan. Pengajuan pengembalian dana sudah ditinjau dan jumlah yang dapat dikembalikan adalah nol.']
      :['您的报名已取消，UPER 已批准您的退款申请。',
        'Your enrollment has been canceled, and your refund request has been approved.',
        'Pendaftaran Anda telah dibatalkan dan UPER telah menyetujui pengajuan pengembalian dana Anda.'],
    refund_recorded:['UPER 已将本次退款发出，您可以查看金额和处理进度。',
      'UPER has sent a refund payment. You can review the amount and status below.',
      'UPER telah mengirim pengembalian dana. Silakan lihat jumlah dan statusnya di bawah.'],
    waitlist_vacancy:['您候补的班次已有空位，现在可以申请报名。',
      'A seat is now available in the class on your waitlist. You can submit an application.',
      'Kini tersedia kursi di kelas yang Anda tunggu. Anda dapat mengajukan pendaftaran.'],
    demand_match:['我们找到了符合您选课需求且有空位的班次，您可以查看详情并申请。',
      'We found a class with an open seat that matches your course preferences. You can review the details and apply.',
      'Kami menemukan kelas yang sesuai dengan preferensi kelas Anda dan masih memiliki tempat. Anda dapat melihat detailnya dan mendaftar.'],
  };
  const remainingRefund=facts.expected!==undefined&&facts.refunded!==undefined
    ? Math.max(0,facts.expected-facts.refunded):undefined;
  const details:Record<EnrollmentEmailKind,string[]> = {
    otp_apply:[tr(['请返回刚才的页面输入验证码。','Return to the page you were using and enter this code.','Silakan kembali ke halaman sebelumnya dan masukkan kode ini.'])],
    otp_mine:[tr(['返回「我的报名」输入验证码。','Return to My Enrollments and enter the code.','Kembali ke Pendaftaran Saya dan masukkan kode ini.'])],
    assistance_confirmation:[
      detail(['学费','Tuition','Biaya kursus'],amount(facts.price)),
      detail(['确认截止','Confirmation deadline','Batas konfirmasi'],asWib(facts.deadline)),
      ...classDetails,
      tr(['验证邮箱并确认取得席位后，即可查看转账信息。',
        'Verify your email and confirm your application. Once your seat is reserved, you can view the bank transfer instructions.',
        'Silakan verifikasi email Anda dan konfirmasi pengajuan. Setelah kursi Anda direservasi, Anda dapat melihat petunjuk transfer bank.']),
    ],
    seat_reserved:[
      detail(['待付金额','Amount due','Jumlah yang harus dibayar'],amount(facts.price)),
      detail(['付款及提交凭证截止','Payment and proof-of-transfer deadline','Batas pembayaran dan unggah bukti transfer'],asWib(facts.deadline)),
      ...classDetails,
      tr(['财务核实足额到账后，报名才算成功。','Enrollment is complete once full payment is verified.','Pendaftaran selesai setelah pembayaran penuh terverifikasi.']),
    ],
    proof_received:[...classDetails,
      tr(['您可以在「我的报名」查看进度，暂时无需重复上传同一份凭证。',
        'You can track the status in My Enrollments. You do not need to upload the same proof again.',
        'Periksa statusnya di Pendaftaran Saya. Anda tidak perlu mengunggah bukti yang sama lagi.'])],
    payment_confirmed:[
      detail(['已核实到账','Verified payment','Pembayaran terverifikasi'],amount(facts.received)),
      detail(['班次','Class','Kelas'],className),
      tr(['UPER 团队会在首课前联系您，确认具体上课安排。',
        'The UPER team will contact you before your first session to confirm your class arrangements.',
        'Tim UPER akan menghubungi Anda sebelum pertemuan pertama untuk mengonfirmasi jadwal dan pengaturan kelas.']),
    ],
    class_cancelled:[cancellation,...classDetails],
    transfer_invitation:[
      detail(['答复截止','Reply deadline','Batas waktu menjawab'],asWib(facts.replyBy)),
      detail(['可转入班次','New class','Kelas baru'],classIdentity(facts.targetClass,facts.targetFormat,facts.targetPeriod)),
      detail(['新班首课','New first session','Pertemuan pertama kelas baru'],when(facts.targetFirstLesson)),
      detail(['新班每周课表','New class weekly schedule','Jadwal mingguan kelas baru'],targetSchedule),
      detail(['原班次','Original class','Kelas asal'],className),
      detail(['原定首课','Original first session','Jadwal awal pertemuan pertama'],when(facts.firstLesson)),
      ...(schedule!==targetSchedule?[detail(['原班每周课表','Original weekly schedule','Jadwal mingguan kelas asal'],schedule)]:[]),
      tr(['如接受转班，原班已付金额将转入新班。',
        'If you accept the transfer, your payment will carry over to the new class.',
        'Jika Anda menyetujui perpindahan kelas, pembayaran Anda akan dialihkan ke kelas baru.']),
    ],
    refund_accepted:[
      detail(['退款金额','Refund amount','Jumlah pengembalian dana'],amount(facts.expected)),
      ...(facts.expected===0?[]:[detail(['预计发出时间','Expected refund dispatch by','Perkiraan batas waktu pengiriman dana'],asWib(facts.sendBy))]),
      ...(facts.expected===0?[]:[tr(['退款将退回原付款账户。','The refund will be returned to the account used for the original payment.','Dana akan dikembalikan ke rekening yang digunakan untuk pembayaran awal.'])]),
      detail(['班次','Class','Kelas'],className),
    ],
    refund_recorded:[
      detail(['本次退款金额','Refund amount sent','Jumlah pengembalian dana yang dikirim'],amount(facts.installment)),
      detail(['累计已发出退款金额','Total refund amount sent','Total pengembalian dana yang telah dikirim'],amount(facts.refunded)),
      detail(['尚待发出的退款金额','Remaining refund amount','Sisa pengembalian dana'],amount(remainingRefund)),
      tr(['实际到账时间以银行处理为准。','The time it takes for the funds to reach your account depends on bank processing.','Waktu dana masuk bergantung pada proses bank.']),
      detail(['班次','Class','Kelas'],className),
    ],
    waitlist_vacancy:[...classDetails,
      tr(['请打开班次页查看实时余位。申请成功时才能取得席位，请在获席后页面显示的截止时间前完成付款并上传凭证。',
        'Seats are allocated when an application is successfully submitted, subject to availability. Please complete payment and upload proof of transfer by the deadline shown after your seat is reserved.',
        'Kursi dialokasikan setelah pengajuan berhasil dikirim, sesuai ketersediaan. Silakan selesaikan pembayaran dan unggah bukti transfer sebelum batas waktu yang ditampilkan setelah kursi direservasi.'])],
    demand_match:[...classDetails,
      detail(['当前报名学费','Current tuition','Biaya pendaftaran saat ini'],amount(facts.price)),
      tr(['请先核对课表、学费和实时余位，再决定是否报名。最新价格与余位以班次页面为准。',
        'Review the schedule, tuition, and availability before applying. The class page shows the latest price and availability.',
        'Periksa jadwal, biaya, dan ketersediaan sebelum mendaftar. Harga dan ketersediaan terbaru ditampilkan di halaman kelas.'])],
  };
  const closing=tr(['谢谢！','Best regards,','Salam hormat,']);
  const signing=tr(['UPER Education 课程报名团队','UPER Education Enrollment Team','Tim Pendaftaran UPER Education']);
  const supportMessage=[
    tr(['您好，我想咨询 UPER 的课程报名。','Hello, I’d like help with UPER enrollment.','Halo, saya ingin bertanya tentang pendaftaran UPER.']),
    detail(['邮件事项','Email topic','Topik email'],topic),
    ...(!otp?[
      detail(['班次','Class','Kelas'],className),
      kind==='payment_confirmed'?'':detail(['首课时间','First session','Pertemuan pertama'],when(facts.firstLesson)),
      detail(['报名编号','Enrollment reference','Kode pendaftaran'],facts.orderId),
    ]:[]),
  ].filter(Boolean).join('\n');
  const contactUrl=supportWhatsApp+'?text='+encodeURIComponent(supportMessage);
  const foot=[
    [tr(['官网','Website','Situs web']),official],
    [tr(['课程报名','Course enrollment','Pendaftaran kelas']),official+'/enrollment?lang='+language],
    [tr(['WhatsApp 联系我们','Contact us on WhatsApp','Hubungi kami via WhatsApp']),contactUrl],
  ];
  const url=!otp&&facts.url?.startsWith('/')&&!facts.url.startsWith('//')?(portalPublicOrigin()??enrollmentPreviewOrigin)+facts.url:undefined;
  const codeMinutes=facts.codeMinutes??enrollmentRuleDefaults.emailCodeMinutes;
  const paragraphs=[
    ...(otp?[tr([`验证码 ${codeMinutes} 分钟内有效，请勿转发。若非本人操作，可忽略。`,`The code expires in ${codeMinutes} ${codeMinutes===1?'minute':'minutes'}. Keep it private. If you did not request it, ignore this email.`,`Kode berlaku ${codeMinutes} menit. Jangan bagikan kode ini kepada siapa pun. Abaikan email ini jika Anda tidak memintanya.`])]:[]),
    ...details[kind], ...(!otp?[detail(['报名编号','Enrollment reference','Kode pendaftaran'],facts.orderId)]:[]),
  ].filter(Boolean);
  const code=otp?facts.code:undefined;
  const opening=tr(intro[kind]);
  const text=[greeting,opening,code,...paragraphs,url? action+' '+url:'',closing+'\n'+signing,...foot.map(([label,link])=>label+' '+link)].filter(Boolean).join('\n\n');
  const html=`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#f2f7f6;color:#17263d;font:16px/1.55 Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 12px"><table role="presentation" width="100%" style="max-width:580px;background:#fff;border:1px solid #dbe7e3;border-radius:16px"><tr><td style="padding:26px"><p style="color:#08776a;font-size:20px;font-weight:bold;margin:0">UPER Education</p><p style="margin:20px 0 14px">${escape(greeting)}</p><p>${escape(opening)}</p>${code?`<p style="font-size:30px;letter-spacing:5px;font-weight:bold">${escape(code)}</p>`:''}${paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}${url?`<p style="margin:26px 0"><a href="${escape(url)}" style="display:inline-block;padding:11px 18px;background:#08776a;color:#fff;border-radius:8px;text-decoration:none">${escape(action)}</a></p>`:''}<p>${escape(closing)}<br>${escape(signing)}</p><p style="border-top:1px solid #dbe7e3;padding-top:12px;font-size:13px">${foot.map(([label,link])=>`<a style="color:#08776a" href="${escape(link)}">${escape(label)}</a>`).join(' &nbsp;·&nbsp; ')}</p></td></tr></table></td></tr></table></body></html>`;
  return {subject,html,text,language};
}
