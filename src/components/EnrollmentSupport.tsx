import {useState,type MouseEventHandler,type ReactNode} from 'react';
import {EnrollmentJourneyLink} from './EnrollmentJourneyLink';
import { interestOption, interestText, type InterestLanguage } from '../utils/enrollmentInterestCopy';
import { SocialProfileIcon, socialProfiles } from './SocialProfileIcon';
import { enrollmentFixedLessonDuration,enrollmentInstant,enrollmentPrivateLessonTitle,enrollmentTeacherLabel } from '../utils/enrollmentCatalog';
import {formatCurrency} from '../utils/currency';
import type {PublicEnrollmentAppointment} from '../services/enrollmentClassDetails';
import {EnrollmentClassName} from './EnrollmentClassName';
import {EnrollmentCourseOverview} from './EnrollmentCourseOverview';
import {EnrollmentDetailFields,EnrollmentPriceActions} from './EnrollmentRecordLayout';
import {PublicSingleSelect} from './PublicSingleSelect';

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
    title: ['一对一约课','Schedule one-to-one lessons','Atur jadwal kelas privat'],
    instructions: [
      '通过 WhatsApp 告诉顾问你的 HSK 级别和方便上课的时间。',
      'Tell an advisor your HSK level and preferred lesson times on WhatsApp.',
      'Sampaikan level HSK dan waktu yang cocok kepada konsultan melalui WhatsApp.',
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
  ])}{' '}<EnrollmentJourneyLink className="enrollment-quiet" stepEntry="enrollment-joining-help" to={enrollmentSupportPath('advisor',language)}>{interestText(language,[
    '联系销售确认上课安排','Contact our team to confirm how to join','Hubungi tim kami untuk memastikan cara bergabung',
  ])}</EnrollmentJourneyLink></p>;
}

export function EnrollmentSupport({topic,language,level,appointment:selection,appointmentState,onAppointmentRetry,period,format,offline,returnAction,backAction,registrationLink}:{
  topic:string;language:InterestLanguage;level?:string;appointment?:PublicEnrollmentAppointment;
  appointmentState?:'loading'|'failed'|'unavailable';onAppointmentRetry?:()=>void;
  period?:string;format?:string;offline?:boolean;returnAction?:ReactNode;backAction:ReactNode;
  registrationLink?:{to:string;state:unknown;onClick:MouseEventHandler<HTMLAnchorElement>};
}) {
  const t = (value: Copy) => interestText(language,value);
  const info = Object.hasOwn(topics,topic) ? topics[topic as keyof typeof topics] : undefined;
  const appointment=topic==='one-on-one';
  const appointmentCourse=selection?.level??(level?'HSK '+level:'');
  const whatsapp=new URL(socialProfiles.whatsapp.url);
  const timeOptions=[
    {value:'',label:t(['暂未确定','No preference yet','Belum ada pilihan'])},
    {value:'weekday-evening',label:t(['工作日晚间','Weekday evenings','Malam hari kerja'])},
    {value:'weekend',label:t(['周末','Weekends','Akhir pekan'])},
    {value:'mixed',label:t(['工作日与周末','Weekdays and weekends','Hari kerja dan akhir pekan'])},
  ];
  const [selectedPeriod,setSelectedPeriod]=useState<string>();
  const time=(appointment?selectedPeriod??period:period)||'';
  const preferredTime=time?timeOptions.find(option=>option.value===time)?.label??'':'';
  const formatLabel=format==='standard'||format==='small'||format==='one-on-one'?interestOption(language,format):'';
  if(appointment) {
    const course=appointmentCourse?t([`${appointmentCourse} 的一对一约课`,`one-to-one lessons for ${appointmentCourse}`,`kelas privat untuk ${appointmentCourse}`]):
      t(['一对一约课','one-to-one lessons','kelas privat']);
    const teacher=selection?enrollmentTeacherLabel(selection.teacherType,language):'';
    const message=t([
      `你好，我想咨询${course}${teacher?'（'+teacher+'）':''}。${preferredTime?'我方便的时段是'+preferredTime+'。':''}`,
      `Hello, I'd like to schedule ${course}${teacher?' ('+teacher+')':''}.${preferredTime?' My preferred time is '+preferredTime.toLowerCase()+'.':''}`,
      `Halo, saya ingin menjadwalkan ${course}${teacher?' ('+teacher+')':''}.${preferredTime?' Waktu pilihan saya: '+preferredTime.toLowerCase()+'.':''}`,
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
  const whatsappAction=<a className="enrollment-primary enrollment-whatsapp-action" href={whatsapp.toString()} target="_blank" rel="noopener noreferrer">
    <SocialProfileIcon platform="whatsapp" className="size-4"/>
    {appointmentState==='unavailable'?t(['咨询其他一对一课程','Ask about other private lessons','Tanya kelas privat lainnya']):
      appointment?t(['WhatsApp 约课','Open WhatsApp','Buka WhatsApp']):
      t(['通过 WhatsApp 联系','Contact on WhatsApp','Hubungi via WhatsApp'])}
  </a>;
  const timePreference=<PublicSingleSelect label={t(['方便的时段（选填）','Preferred times (optional)','Waktu pilihan (opsional)'])}
    value={time} options={timeOptions} onChange={setSelectedPeriod}/>;
  if(appointment&&selection) return <section className="enrollment-screen enrollment-detail enrollment-private-detail">
    {returnAction}
    {backAction}
    <header className="enrollment-title-row enrollment-detail-title">
      <h1>{t(['一对一约课','Private lessons','Kelas privat'])}</h1>
      <a className="enrollment-quiet enrollment-consult-action" href={whatsapp.toString()} target="_blank" rel="noopener noreferrer"
        aria-label={t(['WhatsApp 咨询','Ask on WhatsApp','Tanya via WhatsApp'])}>
        <SocialProfileIcon platform="whatsapp" className="size-4"/>
        WhatsApp
      </a>
    </header>
    <div className="enrollment-detail-layout">
      <aside className="enrollment-detail-aside">
        <div className="enrollment-class-detail">
          <div className="enrollment-detail-heading"><h2 className="enrollment-class-heading">
            <EnrollmentClassName title={enrollmentPrivateLessonTitle(selection.level,language)}/>
          </h2></div>
          <section className="enrollment-detail-section">
            <h3 className="enrollment-record-section-title">{t(['课程信息','Course information','Informasi kursus'])}</h3>
            <EnrollmentDetailFields fields={[
              [t(['授课教师','Teacher','Pengajar']),enrollmentTeacherLabel(selection.teacherType,language)],
              [t(['上课时间','Schedule','Jadwal']),t(['与顾问确认','Confirm with an advisor','Dikonfirmasi bersama konsultan'])],
              [t(['课时安排','Lesson duration','Durasi pelajaran']),enrollmentFixedLessonDuration(selection.lessons,selection.minutes,language)],
              [t(['每节价格','Price per lesson','Harga per sesi']),formatCurrency(selection.price,language)],
              [t(['教材','Course material','Buku ajar']),selection.material],
            ]}/>
          </section>
          <section className="enrollment-detail-section enrollment-private-contact">
            <p>{t(['登记后可在「我的报名」查看。','Track your request in My enrollments.','Lacak permintaan di Pendaftaran Saya.'])}</p>
          </section>
        </div>
        <EnrollmentPriceActions hideLabel label={t(['课程总价','Total tuition','Total biaya'])} language={language}
          amount={selection.price*selection.lessons} standardPrice={selection.standardPrice*selection.lessons}>
          {registrationLink?<EnrollmentJourneyLink className="enrollment-primary" {...registrationLink}>
            {t(['登记约课','Request lessons','Ajukan jadwal'])}
          </EnrollmentJourneyLink>:whatsappAction}
        </EnrollmentPriceActions>
      </aside>
      {(selection.introduction?.[language]||selection.introduction?.en)&&<section className="enrollment-course">
        <h2>{t(['课程介绍','Course introduction','Tentang kursus'])}</h2>
        <EnrollmentCourseOverview introduction={selection.introduction} language={language}/>
      </section>}
    </div>
  </section>;
  return <section className="enrollment-screen enrollment-apply-screen enrollment-support">
    {returnAction}
    {backAction}
    {info ? <>
      <h1>{t(info.title)}</h1>
      <article className="enrollment-record">
        <h2>{appointment&&appointmentCourse?appointmentCourse+' · '+t(['一对一','One-to-one','Kelas privat']):t(['联系说明','How to get help','Cara mendapatkan bantuan'])}</h2>
        <p>{t(info.instructions)}</p>
      </article>
      <div className="enrollment-journey-actions">
        {appointmentState==='loading'?<p role="status">{t(['正在读取预约资料…','Loading appointment details…','Memuat detail janji…'])}</p>
          : appointmentState==='failed'?<div role="status">
            <p>{t(['暂时无法读取所选课程，请重试。','The selected course could not load. Try again.','Kelas yang dipilih belum dapat dimuat. Coba lagi.'])}</p>
            <button type="button" className="enrollment-quiet" onClick={onAppointmentRetry}>{t(['重试','Try again','Coba lagi'])}</button>
          </div>:<>
          {appointmentState==='unavailable'&&<p role="status">{t(['所选课程当前不可预约。','The selected course is unavailable for booking.','Kelas yang dipilih tidak tersedia untuk dipesan.'])}</p>}
          {appointment&&appointmentState!=='unavailable'&&timePreference}
          {whatsappAction}</>}
      </div>
    </> : <h1>{t(['此帮助页面不可用。','This help page is unavailable.','Halaman bantuan ini tidak tersedia.'])}</h1>}
  </section>;
}
