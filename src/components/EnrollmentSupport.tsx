import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { interestText, type InterestLanguage } from './EnrollmentInterests';
import { SocialProfileIcon, socialProfiles } from './SocialProfileIcon';
import { enrollmentInstant } from '../utils/enrollmentCatalog';

type Copy = readonly [string,string,string];
const topics = {
  account: {
    title: ['找回报名邮箱','Recover your enrollment email','Temukan email pendaftaran'],
    instructions: [
      '请联系工作人员核对报名身份。核对后，工作人员会告诉你如何继续验证。',
      'Ask support to verify your enrollment identity. They will explain how to continue once they have checked it.',
      'Hubungi petugas untuk memeriksa identitas pendaftaran. Setelah pemeriksaan, petugas akan menjelaskan cara melanjutkan verifikasi.',
    ],
  },
  payment: {
    title: ['联系销售运营核对转账','Contact sales operations about a transfer','Hubungi tim penjualan untuk memeriksa transfer'],
    instructions: [
      '请提供报名编号和转账时间。销售运营会协助财务在收款系统中查找这笔转账。',
      'Have your order number and transfer time ready. Sales operations can help Finance find the transfer in the payment system.',
      'Siapkan nomor pendaftaran dan waktu transfer. Tim penjualan dapat membantu tim keuangan mencari transfer di sistem penerimaan dana.',
    ],
  },
  refund: {
    title: ['查询已提交的退款','Ask about a refund already requested','Tanyakan pengembalian dana yang sudah diajukan'],
    instructions: [
      '请提供报名编号。客服会查询已登记的退款并跟进原申请。',
      'Share your order number. Support can look up the recorded refund and follow up on your existing request.',
      'Berikan nomor pendaftaran. Tim layanan pelanggan dapat memeriksa pengembalian dana tercatat dan menindaklanjuti pengajuan Anda.',
    ],
  },
  'one-on-one': {
    title: ['联系销售客服约课','Schedule one-to-one lessons','Atur jadwal kelas privat'],
    instructions: [
      '告诉客服你的 HSK 级别和方便上课的时段，由客服和你确认时间及课次。',
      'Share your HSK level and preferred times. Our team will confirm the schedule and number of lessons with you.',
      'Sampaikan level HSK dan waktu yang cocok. Tim kami akan mengonfirmasi jadwal dan jumlah sesi bersama Anda.',
    ],
  },
  advisor: {
    title: ['联系课程顾问','Contact a course advisor','Hubungi konsultan kursus'],
    instructions: [
      '如已报名，请提供报名编号。也请说明你想咨询的班次或上课安排。',
      'If you have enrolled, have your order number ready. Tell us which class or schedule you would like to ask about.',
      'Jika sudah mendaftar, siapkan nomor pendaftaran. Sampaikan kelas atau jadwal yang ingin Anda tanyakan.',
    ],
  },
} satisfies Record<string,{title:Copy;instructions:Copy}>;

export function enrollmentSupportPath(topic: keyof typeof topics, language: InterestLanguage) {
  return '/enrollment/help/'+topic+'?lang='+language;
}

export function EnrollmentJoiningNote({firstLesson,now,language}:{
  firstLesson?:string;now:number;language:InterestLanguage;
}) {
  const lessonTime=enrollmentInstant(firstLesson);
  if(!lessonTime||now<lessonTime.valueOf())return null;
  return <p>{interestText(language,[
    '已到原定首课时间。','The scheduled first lesson time has arrived.','Waktu sesi pertama yang dijadwalkan sudah tiba.',
  ])}{' '}<Link className="enrollment-quiet" to={enrollmentSupportPath('advisor',language)}>{interestText(language,[
    '联系销售确认上课安排','Contact our team to confirm how to join','Hubungi tim kami untuk memastikan cara bergabung',
  ])}</Link></p>;
}

export function EnrollmentSupport({topic,language,level,period,catalogPath}:{
  topic:string;language:InterestLanguage;level?:string;period?:string;catalogPath?:string;
}) {
  const t = (value: Copy) => interestText(language,value);
  const info = Object.hasOwn(topics,topic) ? topics[topic as keyof typeof topics] : undefined;
  const appointment=topic==='one-on-one';
  const whatsapp=new URL(socialProfiles.whatsapp.url);
  if(appointment&&level) {
    const preferredTime=period==='weekend' ? t(['周末','weekends','akhir pekan'])
      : period==='weekday-evening' ? t(['工作日晚间','weekday evenings','malam hari kerja']) : '';
    const message=t([
      `你好，我想咨询 HSK ${level} 一对一约课。${preferredTime?'我方便的时段是'+preferredTime+'。':''}`,
      `Hello, I'd like to schedule HSK ${level} one-to-one lessons.${preferredTime?' My preferred time is '+preferredTime+'.':''}`,
      `Halo, saya ingin menjadwalkan kelas privat HSK ${level}.${preferredTime?' Saya lebih suka '+preferredTime+'.':''}`,
    ]);
    whatsapp.searchParams.set('text',message);
  }
  return <section className="enrollment-screen enrollment-apply-screen enrollment-support">
    <Link className="enrollment-back" to={appointment?catalogPath??'/enrollment?lang='+language:'/enrollment/mine?lang='+language}><ArrowLeft size={15} aria-hidden="true"/>
      {appointment?t(['返回课程报名','Back to course enrollment','Kembali ke pendaftaran kursus']):t(['返回我的报名','Back to my enrollments','Kembali ke pendaftaran saya'])}</Link>
    {info ? <>
      <h1>{t(info.title)}</h1>
      <article className="enrollment-record">
        <h2>{appointment&&level?'HSK '+level+' · '+t(['一对一','One-to-one','Kelas privat']):t(['联系说明','How to get help','Cara mendapatkan bantuan'])}</h2>
        <p>{t(info.instructions)}</p>
      </article>
      <div className="enrollment-journey-actions">
        <a className="enrollment-primary enrollment-whatsapp-action" href={appointment?whatsapp.toString():socialProfiles.whatsapp.url} target="_blank" rel="noopener noreferrer">
          <SocialProfileIcon platform="whatsapp" className="size-4"/>
          {t(['通过 WhatsApp 联系','Contact on WhatsApp','Hubungi via WhatsApp'])}
        </a>
      </div>
    </> : <h1>{t(['此帮助页面不可用。','This help page is unavailable.','Halaman bantuan ini tidak tersedia.'])}</h1>}
  </section>;
}
