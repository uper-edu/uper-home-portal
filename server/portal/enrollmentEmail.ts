import { enrollmentRuleDefaults } from '../../src/utils/enrollmentRules.ts';
import { formatCurrency } from '../../src/utils/currency.ts';
import { enrollmentPreviewOrigin } from '../../src/utils/enrollmentAssistance.ts';
export { enrollmentPreviewOrigin };

export function portalPublicOrigin(env=process.env){
  const configured=env.PORTAL_PUBLIC_ORIGIN ?? env.PORTAL_ENROLLMENT_PUBLIC_ORIGIN;
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
  otp_apply:['UPER 课程报名验证码','Your UPER enrollment code','Kode verifikasi pendaftaran UPER'],
  otp_mine:['UPER「我的报名」验证码','UPER verification code for My Enrollments','Kode verifikasi Pendaftaran Saya di UPER'],
  seat_reserved:['UPER 已为您保留席位','UPER has reserved your seat','Tempat Anda di UPER sudah dipesan'],
  assistance_confirmation:['请确认您的 UPER 报名申请','Confirm your UPER enrollment application','Konfirmasi pengajuan pendaftaran UPER'],
  proof_received:['已收到转账凭证，等待财务核实','Proof of transfer received, awaiting finance verification','Bukti transfer diterima, menunggu verifikasi keuangan'],
  payment_confirmed:['报名成功，财务已核实足额到账','Enrollment confirmed. Full payment verified.','Pendaftaran berhasil. Pembayaran penuh terverifikasi.'],
  class_cancelled:['UPER 班次无法如期开课','Your UPER class will not start as scheduled','Kelas UPER Anda tidak dimulai sesuai jadwal'],
  transfer_invitation:['UPER 转班邀请','Your UPER class transfer invitation','Undangan pindah kelas UPER'],
  refund_accepted:['UPER 报名已取消，退款申请已受理','UPER canceled your enrollment and accepted your refund request','UPER membatalkan pendaftaran Anda dan menerima pengajuan pengembalian dana'],
  refund_recorded:['UPER 退款已发出','UPER has sent a refund payment','UPER telah mengirim pengembalian dana'],
  waitlist_vacancy:['候补班次有空位','An opening in the class you’re waitlisted for','Ada tempat di kelas yang Anda tunggu'],
  demand_match:['符合您需求的班次有空位','A class matching your preferences has an open seat','Ada tempat di kelas yang sesuai dengan pilihan Anda'],
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
    return Number.isNaN(parsed.getTime())?'':new Intl.DateTimeFormat(language,{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(parsed)+' WIB';
  };
  const when=(value?:string)=>value?asWib(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)?value+'+07:00':value):'';
  const detail=(label:Copy,value?:string)=>value?.trim()?tr(label)+' · '+value.trim():'';
  const classIdentity=(level?:string,format?:string,period?:string)=>[
    level?.trim(),
    format==='standard'?tr(['标准班','Standard class','Kelas standar']):format==='small'?tr(['小班','Small group','Kelas kecil']):'',
    period==='weekend'?tr(['周末','Weekend','Akhir pekan']):period==='weekday-evening'?tr(['工作日晚课','Weekday evening','Malam hari kerja']):'',
  ].filter(Boolean).join(' · ');
  const className=classIdentity(facts.class,facts.format,facts.period);
  const name=facts.salutation?.replace(/\s+/g,' ').trim();
  const greeting=name?tr([name+'，您好！','Dear '+name+',','Halo '+name+',']):tr(['您好！','Hello,','Halo,']);
  const actions:Partial<Record<EnrollmentEmailKind,Copy>>={
    assistance_confirmation:['确认报名申请','Confirm application','Konfirmasi pengajuan'],
    seat_reserved:['查看转账信息','View payment instructions','Lihat petunjuk transfer'],
    transfer_invitation:['查看转班邀请','Review transfer invitation','Lihat undangan pindah kelas'],
    refund_accepted:['查看退款进度','Track refund','Lihat status pengembalian dana'],
    refund_recorded:['查看退款进度','Track refund','Lihat status pengembalian dana'],
    waitlist_vacancy:['查看班次与余位','Check class availability','Cek ketersediaan kelas'],
    demand_match:['查看班次详情','View class details','Lihat detail kelas'],
  };
  const action=tr(actions[kind]??['查看报名详情','View enrollment details','Lihat detail pendaftaran']);
  const otp=kind==='otp_apply'||kind==='otp_mine';
  const topic=tr(enrollmentEmailSubjects[kind]);
  const brandedTopic=/\bUPER\b/.test(topic)?topic:'UPER · '+topic;
  const subject=brandedTopic+(!otp&&facts.class?.trim()?' · '+facts.class.trim():'');
  const firstClassLabel:Copy=kind==='class_cancelled'||kind==='transfer_invitation'
    ?['原定首课','Originally scheduled first class','Jadwal awal pertemuan pertama']
    :['计划首课','Scheduled first class','Jadwal pertemuan pertama'];
  const classDetails=otp?[]:[
    detail(kind==='transfer_invitation'?['原班次','Original class','Kelas asal']:['班次','Class','Kelas'],className),
    detail(firstClassLabel,when(facts.firstLesson)),
    detail(['每周课表','Weekly schedule','Jadwal mingguan'],facts.schedule),
  ];
  const cancellation=facts.orderState==='paid'||facts.orderState==='recovered'
    ? tr(['可继续等待、查看可转班次，或联系销售客服申请退款。','You can keep waiting, review transfer options, or contact support to request a refund.','Anda dapat tetap menunggu, melihat opsi pindah kelas, atau menghubungi layanan pelanggan untuk mengajukan pengembalian dana.'])
    : facts.orderState==='partial'||facts.orderState==='proof_review'
      ? tr(['财务会继续核对原记录的转账。','Finance will continue reviewing the payment on the original record.','Tim keuangan akan tetap memeriksa pembayaran pada catatan awal.'])
      : tr(['请勿再转账。已经转账的学员仍可从原记录补交凭证。','Please do not transfer funds. If you already paid, you can submit your proof on the original record.','Jangan transfer dana. Jika sudah membayar, Anda tetap dapat mengirim bukti melalui catatan pendaftaran awal.']);
  const intro:Record<EnrollmentEmailKind,Copy> = {
    otp_apply:['请使用以下验证码验证您的报名邮箱。',
      'Use the code below to verify your enrollment email.',
      'Gunakan kode berikut untuk memverifikasi email pendaftaran Anda.'],
    otp_mine:['请使用以下验证码验证邮箱并查看「我的报名」。',
      'Use the code below to verify your email and open My Enrollments.',
      'Gunakan kode berikut untuk memverifikasi email dan membuka Pendaftaran Saya.'],
    assistance_confirmation:['UPER 课程顾问已协助提交您的报名申请，请核对信息并确认。',
      'Your UPER advisor submitted an application for you. Please review and confirm it.',
      'Tim UPER telah membantu mengajukan pendaftaran Anda. Silakan periksa dan konfirmasi.'],
    seat_reserved:['我们已为您保留席位，请在截止前完成转账并提交凭证。',
      'Your seat is reserved. Please transfer the amount due and submit your proof of transfer by the deadline.',
      'Tempat Anda sudah dipesan. Silakan transfer dan unggah bukti sebelum batas waktu.'],
    proof_received:['我们已收到您的转账凭证，接下来由财务核实到账。',
      'We received your proof of transfer. Our finance team will now verify the payment.',
      'Bukti transfer Anda sudah kami terima. Tim keuangan akan memverifikasi dana yang masuk.'],
    payment_confirmed:['财务已核实足额到账，您的报名已成功。',
      'We’ve verified full payment and confirmed your enrollment.',
      'Pembayaran penuh telah terverifikasi dan pendaftaran Anda berhasil.'],
    class_cancelled:['很遗憾，您报名的班次无法如期开课。',
      'We’re sorry that your class will not start as scheduled.',
      'Mohon maaf, kelas Anda tidak dapat dimulai sesuai jadwal.'],
    transfer_invitation:['您收到了转班邀请，请核对新班课表，并在截止前答复。',
      'You’ve received a class transfer invitation. Please review the new schedule and respond by the deadline.',
      'Anda menerima undangan pindah kelas. Silakan periksa jadwal kelas tujuan dan jawab sebelum batas waktu.'],
    refund_accepted:facts.expected===0
      ?['您的报名已取消，退款申请已处理。本次核算的退款金额为零。',
        'Your enrollment was canceled. We reviewed your refund request and calculated a refund amount of zero.',
        'Pendaftaran Anda telah dibatalkan. Pengajuan pengembalian dana sudah ditinjau dan jumlah yang dapat dikembalikan adalah nol.']
      :['您的报名已取消，UPER 已受理您的退款申请。',
        'Your enrollment was canceled, and UPER has accepted your refund request.',
        'Pendaftaran Anda telah dibatalkan dan UPER telah menerima pengajuan pengembalian dana Anda.'],
    refund_recorded:['UPER 已将本次退款发出，您可以查看金额和处理进度。',
      'UPER has sent a refund payment. You can review the amount and status below.',
      'UPER telah mengirim pengembalian dana. Silakan lihat jumlah dan statusnya di bawah.'],
    waitlist_vacancy:['您候补的班次已有空位，现在可以申请报名。',
      'A seat has opened up in the class you’re waitlisted for. You can submit an application.',
      'Kini ada tempat di kelas yang Anda tunggu. Anda dapat mengajukan pendaftaran.'],
    demand_match:['我们找到了符合您选课需求且有空位的班次，您可以查看详情并申请。',
      'We found a class with an open seat that matches your course preferences. You can review the details and apply.',
      'Kami menemukan kelas yang sesuai dengan pilihan Anda dan masih memiliki tempat. Anda dapat melihat detailnya dan mendaftar.'],
  };
  const remainingRefund=facts.expected!==undefined&&facts.refunded!==undefined
    ? Math.max(0,facts.expected-facts.refunded):undefined;
  const details:Record<EnrollmentEmailKind,string[]> = {
    otp_apply:[tr(['回到申请、候补或选课需求页面输入验证码。','Enter this code on the application, waitlist, or course preferences page.','Masukkan kode ini di halaman pendaftaran, daftar tunggu, atau minat kelas.'])],
    otp_mine:[tr(['返回「我的报名」输入验证码。','Return to My Enrollments and enter the code.','Kembali ke Pendaftaran Saya dan masukkan kode ini.'])],
    assistance_confirmation:[
      detail(['学费','Tuition','Biaya kursus'],amount(facts.price)),
      detail(['确认截止','Confirmation deadline','Batas konfirmasi'],asWib(facts.deadline)),
      ...classDetails,
      tr(['验证邮箱并确认取得席位后，即可查看转账信息。',
        'Verify your email and confirm your application. Once you have a seat, you can view the transfer instructions.',
        'Verifikasi email dan konfirmasi pengajuan. Setelah mendapat tempat, Anda dapat melihat petunjuk transfer.']),
    ],
    seat_reserved:[
      detail(['待付金额','Amount due','Jumlah yang harus dibayar'],amount(facts.price)),
      detail(['付款及提交凭证截止','Payment and proof deadline','Batas pembayaran dan pengiriman bukti'],asWib(facts.deadline)),
      ...classDetails,
      tr(['财务核实足额到账后，报名才算成功。','Enrollment is complete once full payment is verified.','Pendaftaran selesai setelah pembayaran penuh terverifikasi.']),
    ],
    proof_received:[...classDetails,
      tr(['您可以在「我的报名」查看进度，暂时无需重复提交凭证。',
        'You can track the status in My Enrollments. There’s no need to submit the same proof again.',
        'Cek statusnya di Pendaftaran Saya. Anda tidak perlu mengunggah bukti yang sama lagi.'])],
    payment_confirmed:[
      detail(['已核实到账','Verified payment','Pembayaran terverifikasi'],amount(facts.received)),
      detail(['班次','Class','Kelas'],className),
      tr(['UPER 团队会在首课前联系您，确认具体上课安排。',
        'The UPER team will contact you before your first lesson to confirm the arrangements.',
        'Tim UPER akan menghubungi Anda sebelum pertemuan pertama untuk mengonfirmasi jadwal dan pengaturan kelas.']),
    ],
    class_cancelled:[cancellation,...classDetails],
    transfer_invitation:[
      detail(['答复截止','Reply deadline','Batas waktu menjawab'],asWib(facts.replyBy)),
      detail(['可转入班次','New class','Kelas tujuan'],classIdentity(facts.targetClass,facts.targetFormat,facts.targetPeriod)),
      detail(['新班首课','New class first lesson','Pertemuan pertama kelas tujuan'],when(facts.targetFirstLesson)),
      detail(['新班每周课表','New class weekly schedule','Jadwal mingguan kelas tujuan'],facts.targetSchedule),
      ...classDetails,
      tr(['如接受转班，原班已付金额将转入新班。',
        'If you accept the transfer, your payment will carry over to the new class.',
        'Jika Anda menerima undangan, pembayaran akan dialihkan ke kelas tujuan.']),
    ],
    refund_accepted:[
      detail(['退款金额','Refund amount','Jumlah pengembalian dana'],amount(facts.expected)),
      detail(['预计发出时间','Expected refund transfer date','Perkiraan tanggal transfer pengembalian dana'],asWib(facts.sendBy)),
      ...(facts.expected===0?[]:[tr(['退款将按原付款方式退回。','The refund will go back to your original payment method.','Dana akan dikembalikan melalui metode pembayaran awal.'])]),
      ...classDetails,
    ],
    refund_recorded:[
      detail(['本次退款金额','Refund sent this time','Jumlah pengembalian kali ini'],amount(facts.installment)),
      detail(['累计已发出退款金额','Total refunded so far','Total yang sudah dikirim'],amount(facts.refunded)),
      detail(['尚待发出的退款金额','Remaining refund amount','Sisa yang belum dikirim'],amount(remainingRefund)),
      tr(['实际到账时间以银行处理为准。','Your bank determines when the funds appear.','Waktu dana masuk mengikuti proses bank.']),
      ...classDetails,
    ],
    waitlist_vacancy:[...classDetails,
      tr(['请打开班次页查看实时余位。席位以成功提交申请时的余位为准。',
        'Check current availability on the class page. A seat is secured when your application succeeds.',
        'Cek ketersediaan terkini di halaman kelas. Tempat ditetapkan setelah pengajuan berhasil.'])],
    demand_match:[...classDetails,
      tr(['请先核对课表、学费和实时余位，再决定是否报名。',
        'Review the schedule, tuition, and current availability before applying.',
        'Periksa jadwal, biaya, dan ketersediaan terkini sebelum mendaftar.'])],
  };
  const closing=tr(['谢谢！','Best regards,','Salam hormat,']);
  const signing=tr(['UPER Education 课程报名团队','UPER Education Enrollment Team','Tim Pendaftaran UPER Education']);
  const supportMessage=[
    tr(['您好，我想咨询 UPER 的课程报名。','Hello, I’d like help with UPER enrollment.','Halo, saya ingin bertanya tentang pendaftaran UPER.']),
    detail(['邮件事项','Email topic','Topik email'],topic),
    ...(!otp?[
      detail(['班次','Class','Kelas'],className),
      kind==='payment_confirmed'?'':detail(['首课时间','First class','Pertemuan pertama'],when(facts.firstLesson)),
      detail(['报名编号','Enrollment reference','Nomor pendaftaran'],facts.orderId),
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
    ...(otp?[tr([`验证码 ${codeMinutes} 分钟内有效，请勿转发。若非本人操作，可忽略。`,`The code expires in ${codeMinutes} ${codeMinutes===1?'minute':'minutes'}. Keep it private. If you did not request it, ignore this email.`,`Kode berlaku ${codeMinutes} menit. Jangan bagikan. Abaikan email jika Anda tidak memintanya.`])]:[]),
    ...details[kind], ...(!otp?[detail(['报名编号','Enrollment reference','Nomor pendaftaran'],facts.orderId)]:[]),
  ].filter(Boolean);
  const code=otp?facts.code:undefined;
  const opening=tr(intro[kind]);
  const text=[greeting,opening,code,...paragraphs,url? action+' '+url:'',closing+'\n'+signing,...foot.map(([label,link])=>label+' '+link)].filter(Boolean).join('\n\n');
  const html=`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#f2f7f6;color:#17263d;font:16px/1.55 Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 12px"><table role="presentation" width="100%" style="max-width:580px;background:#fff;border:1px solid #dbe7e3;border-radius:16px"><tr><td style="padding:26px"><p style="color:#08776a;font-size:20px;font-weight:bold;margin:0">UPER Education</p><p style="margin:20px 0 14px">${escape(greeting)}</p><p>${escape(opening)}</p>${code?`<p style="font-size:30px;letter-spacing:5px;font-weight:bold">${escape(code)}</p>`:''}${paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}${url?`<p style="margin:26px 0"><a href="${escape(url)}" style="display:inline-block;padding:11px 18px;background:#08776a;color:#fff;border-radius:8px;text-decoration:none">${escape(action)}</a></p>`:''}<p>${escape(closing)}<br>${escape(signing)}</p><p style="border-top:1px solid #dbe7e3;padding-top:12px;font-size:13px">${foot.map(([label,link])=>`<a style="color:#08776a" href="${escape(link)}">${escape(label)}</a>`).join(' &nbsp;·&nbsp; ')}</p></td></tr></table></td></tr></table></body></html>`;
  return {subject,html,text,language};
}
