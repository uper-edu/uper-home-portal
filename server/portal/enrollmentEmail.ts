import { enrollmentRuleDefaults } from '../../src/utils/enrollmentRules.ts';
import { formatCurrency } from '../../src/utils/currency.ts';

type Copy = readonly [string,string,string];
export const enrollmentEmailSubjects = {
  otp_apply:['UPER 课程报名验证码','Your UPER enrollment code','Kode verifikasi pendaftaran UPER'],
  otp_mine:['UPER「我的报名」验证码','Your UPER My Enrollments code','Kode verifikasi Pendaftaran Saya di UPER'],
  seat_reserved:['UPER 已为你保留席位','UPER has reserved your seat','Tempatmu di UPER sudah dipesan'],
  proof_received:['已收到转账凭证，等待财务核实','Transfer proof received, awaiting finance verification','Bukti transfer diterima, menunggu verifikasi keuangan'],
  payment_confirmed:['报名成功，财务已核实足额到账','Enrollment confirmed. Full payment verified.','Pendaftaran berhasil. Pembayaran penuh terverifikasi.'],
  payment_and_opening:['报名成功，班次已确认开班','Enrollment confirmed and class confirmed','Pendaftaran berhasil dan kelas dikonfirmasi'],
  class_confirmed:['UPER 已确认开班','Your UPER class is confirmed','Kelas UPER kamu sudah dikonfirmasi'],
  class_cancelled:['UPER 开班更新','UPER class update','Informasi kelas UPER'],
  transfer_invitation:['收到转班邀请，请查看目标班和答复期限','Transfer invitation. Review the new class and reply deadline.','Undangan pindah kelas. Periksa kelas tujuan dan batas jawaban.'],
  refund_accepted:['UPER 已登记你的退款申请','UPER has recorded your refund request','Pengajuan pengembalian dana UPER sudah dicatat'],
  refund_recorded:['UPER 退款进度已更新','UPER refund progress updated','Kemajuan pengembalian UPER diperbarui'],
  waitlist_vacancy:['候补班次有空位，请查看实时余位','A seat opened in your waitlisted class','Ada tempat di kelas daftar tunggu'],
  demand_match:['有班次符合你登记的选课需求','A class matches your preferences','Ada kelas yang sesuai dengan pilihanmu'],
} as const;
export type EnrollmentEmailKind = keyof typeof enrollmentEmailSubjects;
type Facts = {language:unknown; salutation?:string; class?:string; firstLesson?:string; schedule?:string; code?:string; codeMinutes?:number;
  deadline?:string; url?:string; orderId?:string; price?:number; received?:number; expected?:number; refunded?:number;
  installment?:number; targetClass?:string; targetFirstLesson?:string; replyBy?:string; sendBy?:string; orderState?:string};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const official='https://uperedu.com';
export const enrollmentPreviewOrigin='http://localhost:3000';

export function renderEnrollmentEmail(kind:EnrollmentEmailKind,facts:Facts) {
  const language=facts.language==='zh'||facts.language==='id'?facts.language:'en';
  const tr=(copy:Copy)=>copy[language==='zh'?0:language==='id'?2:1];
  const amount=(value?:number)=>value===undefined?'':formatCurrency(value,language);
  const asWib=(value?:string)=>{
    if(!value)return '';
    const parsed=new Date(value);
    return Number.isNaN(parsed.getTime())?'':new Intl.DateTimeFormat(language,{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(parsed)+' WIB';
  };
  const when=(value?:string)=>value?asWib(value+'+07:00'):'';
  const summary = [facts.class,when(facts.firstLesson),facts.schedule].filter(Boolean).join(' · ');
  const confirmed=tr(['首课及每周课表','First session and weekly schedule','Pertemuan pertama dan jadwal mingguan'])+' · '+summary;
  const thanks=tr(['你好','Hello','Halo'])+(facts.salutation?' '+facts.salutation:'');
  const action=tr(['查看报名详情','View enrollment details','Lihat detail pendaftaran']);
  const heading=tr(enrollmentEmailSubjects[kind])+(facts.class?' · '+facts.class:'');
  const otp=kind==='otp_apply'||kind==='otp_mine';
  const cancellation=facts.orderState==='paid'||facts.orderState==='recovered'
    ? tr(['可继续等待、查看可转班次，或联系销售客服申请退款。','You can keep waiting, review transfer options, or contact support to request a refund.','Kamu bisa tetap menunggu, melihat opsi pindah kelas, atau menghubungi layanan pelanggan.'])
    : facts.orderState==='partial'||facts.orderState==='proof_review'
      ? tr(['财务会继续核对原记录的转账。','Finance will continue reviewing the payment on the original record.','Tim keuangan akan tetap memeriksa pembayaran pada catatan awal.'])
      : tr(['请勿再转账。已经转账的学员仍可从原记录补交凭证。','Please do not transfer funds. If you already paid, you can submit your proof on the original record.','Jangan transfer dana. Jika sudah membayar, kamu masih bisa mengirim bukti pada catatan awal.']);
  const body:Record<EnrollmentEmailKind,string[]> = {
    otp_apply:[tr(['回到申请、候补或选课需求页面输入验证码。','Enter this code on the application, waitlist, or course preferences page.','Masukkan kode ini di halaman pendaftaran, daftar tunggu, atau preferensi kursus.'])],
    otp_mine:[tr(['回到「我的报名」输入验证码。','Enter this code on My Enrollments.','Masukkan kode ini di Pendaftaran Saya.'])],
    seat_reserved:[tr(['财务核实足额到账后，报名才算成功。','Enrollment is complete once full payment is verified.','Pendaftaran selesai setelah pembayaran penuh terverifikasi.']),
      tr(['应付及提交凭证截止','Amount due and proof deadline','Jumlah tagihan dan batas pengiriman bukti'])+' · '+[amount(facts.price),asWib(facts.deadline)].filter(Boolean).join(' · ')],
    proof_received:[tr(['财务仍需核对银行入账。请到「我的报名」查看进度。','Finance still needs to verify the bank receipt. Track it in My Enrollments.','Tim keuangan masih perlu memeriksa dana masuk. Lihat status di Pendaftaran Saya.'])],
    payment_confirmed:[tr(['财务已核实足额到账','Finance has verified your full payment','Pembayaran penuh telah diverifikasi'])+' · '+amount(facts.received),
      tr(['此班仍待确认开班。','This class is awaiting confirmation.','Kelas ini masih menunggu konfirmasi.'])],
    payment_and_opening:[tr(['财务已核实足额到账','Finance has verified your full payment','Pembayaran penuh telah diverifikasi'])+' · '+amount(facts.received),confirmed],
    class_confirmed:[confirmed],
    class_cancelled:[tr(['原班无法按原计划开课。','The original class will not start as scheduled.','Kelas asal tidak dimulai sesuai jadwal.']),cancellation],
    transfer_invitation:[tr(['接受后，原实收用于新班。请先核对课表，再选择接受或拒绝。','If you accept, your existing payment will go toward the new class. Review the timetable before replying.','Jika diterima, pembayaranmu digunakan untuk kelas baru. Periksa jadwal sebelum menjawab.']),
      [facts.targetClass,when(facts.targetFirstLesson),asWib(facts.replyBy)].filter(Boolean).join(' · ')],
    refund_accepted:[tr(['报名已结束，请查看原路退款的办理进度。','Your enrollment has ended. Track the refund to your original payment method.','Pendaftaran telah berakhir. Lihat status refund melalui metode pembayaran awal.']),
      facts.sendBy?tr(['预计发出时间','Expected send-by date','Perkiraan batas pengiriman'])+' · '+asWib(facts.sendBy):''],
    refund_recorded:[tr(['本次已发出','Refund sent in this installment','Dana dikirim pada tahap ini'])+' · '+amount(facts.installment),
      tr(['累计已发出','Total sent','Total dikirim'])+' · '+amount(facts.refunded),
      tr(['实际到账以银行处理为准。','Your bank determines when the funds appear.','Waktu dana masuk mengikuti proses bank.'])],
    waitlist_vacancy:[tr(['有空位时可自行申请。席位以提交时的结果为准。','Apply while seats are available. Your seat is allocated on successful submission.','Daftar saat kursi tersedia. Kursi diberikan saat pengajuan berhasil.'])],
    demand_match:[tr(['请核对班次课表、学费及实时余位，再决定是否申请。','Check the schedule, fees, and availability before applying.','Periksa jadwal, biaya, dan ketersediaan sebelum mendaftar.'])],
  };
  const signing=tr(['UPER Education｜课程报名团队','UPER Education | Enrollment team','UPER Education | Tim Pendaftaran']);
  const foot=[
    [tr(['官网','Website','Situs web']),official],
    [tr(['课程报名','Course enrollment','Pendaftaran kelas']),official+'/enrollment?lang='+language],
    [tr(['销售客服','Contact support','Hubungi layanan pelanggan']),official+'/contact?lang='+language],
  ];
  const url=facts.url?.startsWith('/')&&!facts.url.startsWith('//')?enrollmentPreviewOrigin+facts.url:undefined;
  const codeMinutes=facts.codeMinutes??enrollmentRuleDefaults.emailCodeMinutes;
  const paragraphs=[
    ...(otp?[tr([`验证码 ${codeMinutes} 分钟内有效，请勿转发。若非本人操作，可忽略。`,`The code expires in ${codeMinutes} ${codeMinutes===1?'minute':'minutes'}. Keep it private. If you did not request it, ignore this email.`,`Kode berlaku ${codeMinutes} menit. Jangan bagikan. Abaikan email jika kamu tidak memintanya.`])]:[]),
    ...body[kind], ...(!otp&&facts.orderId?[tr(['报名编号','Enrollment reference','Nomor pendaftaran'])+' · '+facts.orderId]:[]),
  ].filter(Boolean);
  const code=otp?facts.code:undefined;
  const text=[heading,thanks,code,...paragraphs,url? action+' '+url:'',signing,...foot.map(([label,link])=>label+' '+link)].filter(Boolean).join('\n\n');
  const html=`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#f2f7f6;color:#17263d;font:16px/1.55 Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 12px"><table role="presentation" width="100%" style="max-width:580px;background:#fff;border:1px solid #dbe7e3;border-radius:16px"><tr><td style="padding:26px"><p style="color:#08776a;font-size:20px;font-weight:bold;margin:0">UPER Education</p><h1 style="font-size:23px;line-height:1.28;margin:20px 0 14px">${escape(heading)}</h1><p>${escape(thanks)}</p>${code?`<p style="font-size:30px;letter-spacing:5px;font-weight:bold">${escape(code)}</p>`:''}${paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}${url?`<p style="margin:26px 0"><a href="${escape(url)}" style="display:inline-block;padding:11px 18px;background:#08776a;color:#fff;border-radius:8px;text-decoration:none">${escape(action)}</a></p>`:''}<p>${escape(signing)}</p><p style="border-top:1px solid #dbe7e3;padding-top:12px;font-size:13px">${foot.map(([label,link])=>`<a style="color:#08776a" href="${escape(link)}">${escape(label)}</a>`).join(' &nbsp;·&nbsp; ')}</p></td></tr></table></td></tr></table></body></html>`;
  return {subject:heading,html,text,language};
}
