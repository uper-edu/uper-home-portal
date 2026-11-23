import type {ReactNode} from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { interestOption, interestText, type InterestLanguage } from '../utils/enrollmentInterestCopy';
import { SocialProfileIcon, socialProfiles } from './SocialProfileIcon';
import { enrollmentInstant,enrollmentTeacherLabel } from '../utils/enrollmentCatalog';

type Copy = readonly [string,string,string];
const topics = {
  consultation:{
    title:['联系 UPER 咨询课程','Ask UPER about classes','Tanyakan kursus kepada UPER'],
    instructions:['请告诉我们你想学的内容、上课方式和方便的时间。','Tell us what you want to learn, how you prefer to attend, and when you’re available.','Sampaikan tujuan belajar, pilihan cara belajar, dan waktu yang cocok.'],
  },
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

export function EnrollmentSupport({topic,language,level,appointment:selection,period,format,catalogPath,offline,returnAction,navigationState}:{
  topic:string;language:InterestLanguage;level?:string;appointment?:{course:string;teacherType:'local'|'foreign'};period?:string;format?:string;catalogPath?:string;offline?:boolean;returnAction?:ReactNode;navigationState?:unknown;
}) {
  const t = (value: Copy) => interestText(language,value);
  const info = Object.hasOwn(topics,topic) ? topics[topic as keyof typeof topics] : undefined;
  const appointment=topic==='one-on-one';
  const appointmentCourse=selection?[selection.course,enrollmentTeacherLabel(selection.teacherType,language)].join(' · '):level?'HSK '+level:'';
  const whatsapp=new URL(socialProfiles.whatsapp.url);
  const preferredTime=period==='weekend' ? t(['周末','weekends','akhir pekan'])
    : period==='mixed' ? t(['工作日与周末','weekdays & weekends','hari kerja & akhir pekan'])
    : period==='weekday-evening' ? t(['工作日晚间','weekday evenings','malam hari kerja']) : '';
  const formatLabel=format==='standard'||format==='small'||format==='one-on-one'?interestOption(language,format):'';
  if(appointment) {
    const course=appointmentCourse?t([`${appointmentCourse} 的一对一约课`,`one-to-one lessons for ${appointmentCourse}`,`kelas privat untuk ${appointmentCourse}`]):
      t(['一对一约课','one-to-one lessons','kelas privat']);
    const message=t([
      `你好，我想咨询${course}。${preferredTime?'我方便的时段是'+preferredTime+'。':''}`,
      `Hello, I'd like to schedule ${course}.${preferredTime?' My preferred time is '+preferredTime+'.':''}`,
      `Halo, saya ingin menjadwalkan ${course}.${preferredTime?' Saya lebih suka '+preferredTime+'.':''}`,
    ]);
    whatsapp.searchParams.set('text',message);
  } else if(topic==='consultation'&&offline) {
    const course=appointmentCourse||t(['中文课','Mandarin classes','kelas Mandarin']);
    whatsapp.searchParams.set('text',t([
      `你好，我想咨询雅加达的 ${course} 线下课。${preferredTime?'我方便的时段是'+preferredTime+'。':''}`,
      `Hello, I'd like to ask about in-person ${course} in Jakarta.${preferredTime?' My preferred time is '+preferredTime+'.':''}`,
      `Halo, saya ingin bertanya tentang kelas tatap muka ${course} di Jakarta.${preferredTime?' Waktu yang saya inginkan: '+preferredTime+'.':''}`,
    ]));
  } else if(topic==='consultation') {
    const context=[appointmentCourse,formatLabel,preferredTime].filter(Boolean).join(' · ');
    if(context)whatsapp.searchParams.set('text',t([
      `你好，我想咨询中文课程。我在找 ${context} 的课程。`,
      `Hello, I'd like to ask about Mandarin classes. I'm looking for ${context}.`,
      `Halo, saya ingin bertanya tentang kursus Mandarin. Saya mencari kelas dengan pilihan berikut (${context}).`,
    ]));
  }
  return <section className="enrollment-screen enrollment-apply-screen enrollment-support">
    {returnAction}
    <Link className="enrollment-back" to={appointment?catalogPath??'/enrollment?lang='+language:'/enrollment/mine?lang='+language} state={navigationState}><ArrowLeft size={15} aria-hidden="true"/>
      {appointment?t(['返回课程报名','Back to course enrollment','Kembali ke pendaftaran kursus']):t(['返回我的报名','Back to my enrollments','Kembali ke pendaftaran saya'])}</Link>
    {info ? <>
      <h1>{t(info.title)}</h1>
      <article className="enrollment-record">
        <h2>{appointment&&appointmentCourse?appointmentCourse+' · '+t(['一对一','One-to-one','Kelas privat']):t(['联系说明','How to get help','Cara mendapatkan bantuan'])}</h2>
        <p>{t(info.instructions)}</p>
      </article>
      <div className="enrollment-journey-actions">
        <a className="enrollment-primary enrollment-whatsapp-action" href={whatsapp.toString()} target="_blank" rel="noopener noreferrer">
          <SocialProfileIcon platform="whatsapp" className="size-4"/>
          {t(['通过 WhatsApp 联系','Contact on WhatsApp','Hubungi via WhatsApp'])}
        </a>
      </div>
    </> : <h1>{t(['此帮助页面不可用。','This help page is unavailable.','Halaman bantuan ini tidak tersedia.'])}</h1>}
  </section>;
}
