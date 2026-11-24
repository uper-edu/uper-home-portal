import {EnrollmentClassName} from './EnrollmentClassName';
import {EnrollmentDetailFields} from './EnrollmentRecordLayout';
import {Link} from 'react-router-dom';
import type {MouseEventHandler} from 'react';
import {BookOpen,CalendarDays,ChevronRight,Clock3} from 'lucide-react';
import {formatCurrency} from '../utils/currency';
import {enrollmentDateFormatter} from '../utils/enrollmentDateFormat';
import {enrollmentCopy,enrollmentClassSizeText,enrollmentClassTitle,enrollmentScheduleLabel,enrollmentTeacherLabel,enrollmentWeeklyScheduleGroups,type PublicEnrollmentClass} from '../utils/enrollmentCatalog';
import './enrollment-class-card.css';

type Language='zh'|'en'|'id';
type EnrollmentCardRow=Pick<PublicEnrollmentClass,'level'|'format'|'period'|'batchNumber'|'teacherType'|
  'firstLesson'|'minutes'|'weeklySchedule'|'schedule'|'opened'|'price'|'availability'> &
  Partial<Pick<PublicEnrollmentClass,'sessions'|'standardPrice'|'learningOutcomes'|'material'|'resources'|'teacher'|'classSize'>>;

export function ChatClassSchedule({row,language,withZone=false}:{
  row:Pick<EnrollmentCardRow,'weeklySchedule'|'schedule'|'minutes'>;language:Language;withZone?:boolean;
}){
  const groups=enrollmentWeeklyScheduleGroups(row.weeklySchedule,row.minutes,language);
  if(!groups.length)return <span>{row.schedule}</span>;
  return <span className="chat-schedule-groups">{groups.map(({days,time},i)=><span key={time}>
    {days} <span className="chat-value">{time}{withZone&&i===groups.length-1?' WIB':''}</span>
  </span>)}</span>;
}

export function EnrollmentClassPreview({row,language,titleLink,actionLink,showDetails=false,detail=false,priceInActions=false,intakeStatus,availabilitySnapshot=false,onNavigate,navigationState,chatPresentation=false,chatPrimaryAction=false}:{
  row:EnrollmentCardRow;language:Language;titleLink?:string;actionLink?:string;showDetails?:boolean;detail?:boolean;priceInActions?:boolean;intakeStatus?:'checking'|'paused'|'unverified';
  availabilitySnapshot?:boolean;onNavigate?:MouseEventHandler<HTMLAnchorElement>;navigationState?:unknown;chatPresentation?:boolean;chatPrimaryAction?:boolean;
}){
 const t=(zh:string,en:string,id:string)=>enrollmentCopy(language,[zh,en,id]);
 const dateValue=new Date(row.firstLesson+':00+07:00');
 const date=Number.isFinite(dateValue.valueOf())?enrollmentDateFormatter(language,'day').format(dateValue).replaceAll(' ','\u00a0'):'';
 const dateLabel=date?(row.opened?t(date+'开课','Starts '+date,'Mulai '+date):t('首课 '+date,'First session '+date,'Pertemuan pertama '+date)):t('首课待确认','Start date pending','Tanggal mulai belum dikonfirmasi');
 const size=enrollmentClassSizeText(row.classSize,language);
 const periods=row.sessions&&row.sessions>0?row.sessions:undefined;
 const title=enrollmentClassTitle(row,language);
 const titleContent=<EnrollmentClassName title={title}/>;
 const primaryLink=chatPresentation?actionLink:titleLink;
 const primaryLabel=chatPresentation
   ? row.availability==='full'?t('加入候补','Join waitlist','Daftar tunggu'):t('申请这个班','Apply for this class','Daftar kelas ini')
   : t('查看班次','View class','Lihat kelas');
 const availability=!intakeStatus&&row.availability&&({
   full:t('满班','Full','Penuh'),limited:t('空位紧张','Limited seats','Kursi terbatas'),available:t('有空位','Seats available','Kursi tersedia'),
 })[row.availability];
 const heading=<h2>{titleLink?<Link to={titleLink} state={navigationState} onClick={onNavigate}>{titleContent}{!chatPresentation&&<ChevronRight size={15} aria-hidden="true"/>}</Link>:titleContent}</h2>;
 const availableText=availability&&((availabilitySnapshot?t('查询时','When checked: ','Saat diperiksa: '):'')+availability);
 const checkingIntake=!!row.price&&(intakeStatus==='checking'||intakeStatus==='unverified');
 const status=!row.price||intakeStatus==='paused'?t('暂不可申请','Applications unavailable','Pendaftaran belum tersedia'):
   intakeStatus==='unverified'?t('报名状态待确认','Application status unconfirmed','Status pendaftaran belum terkonfirmasi'):
   checkingIntake?t('正在确认报名状态','Checking application status','Memeriksa status pendaftaran'):
   row.opened?t('已成班','Confirmed','Dikonfirmasi'):t('报名中','Open for applications','Pendaftaran dibuka');
 const state=checkingIntake?'pending':(chatPresentation&&intakeStatus==='paused')||(!intakeStatus&&row.availability==='full')
   ? 'full' : row.opened||(chatPresentation&&row.availability==='available')?'confirmed':'pending';
 const statusText=chatPresentation&&row.price&&availableText?availableText:status+(availableText&&(!chatPresentation||row.price)?' · '+availableText:'');
 const teacher=enrollmentTeacherLabel(row.teacherType,language);
 const publicStatus=row.price&&availableText||status;
 const publicTone=row.price&&availableText&&row.availability==='available'?'confirmed':state;
 const duration=t('每节 '+row.minutes+' 分钟',row.minutes+' min each',row.minutes+' menit per jam pelajaran');
 const lessonCount=periods?t(periods+' 节',periods+' periods',periods+' jam pelajaran'):undefined;
 const schedule=enrollmentScheduleLabel(row,language);
 if(detail){
   const statusAtSize=Boolean(size&&row.price&&availableText);
   const badge=<span className="enrollment-status" data-state={publicTone}>{publicStatus}</span>;
   const teacherName=row.teacher?.trim();
   const teacherOrigin=row.teacherType&&{
     local:t('印尼教师','Indonesian teacher','Pengajar Indonesia'),
     foreign:t('中国外教','Teacher from China','Pengajar dari Tiongkok'),
   }[row.teacherType];
   const teacherDetails=teacherName&&teacherOrigin
     ? t(`${teacherName}（${teacherOrigin}）`,`${teacherName} (${teacherOrigin})`,`${teacherName} (${teacherOrigin})`)
     : teacherName||teacherOrigin;
   return <div className="enrollment-class-detail">
     <header className="enrollment-detail-heading">
       <h2 className="enrollment-class-heading">{titleContent}</h2>
       {!statusAtSize&&badge}
     </header>
     <section className="enrollment-detail-section">
       <h3 className="enrollment-record-section-title">{t('班次信息','Class information','Informasi kelas')}</h3>
       <EnrollmentDetailFields fields={[
         [t('授课教师','Teacher','Pengajar'),teacherDetails],
         [t('每周课表','Weekly schedule','Jadwal mingguan'),schedule],
         [t('首课时间','First class','Pertemuan pertama'),date
           ? <time dateTime={dateValue.toISOString()}>{enrollmentDateFormatter(language,'dateTime').format(dateValue)} WIB</time>
           : t('待确认','To be confirmed','Belum dikonfirmasi')],
         [t('开班状态','Class opening','Status pembukaan kelas'),row.opened?t('已确认开班','Confirmed','Dikonfirmasi'):undefined],
         [t('班级规模','Class size','Ukuran kelas'),statusAtSize
           ? <span className="enrollment-class-size-value"><span>{size}</span>{badge}</span>
           : size],
         [t('课时安排','Lesson duration','Durasi pelajaran'),[lessonCount,duration].filter(Boolean).join(' · ')],
         [t('每节价格','Approx. per period','Perkiraan per jam pelajaran'),row.price>0&&!!periods&&formatCurrency(Math.round(row.price/periods),language)],
       ]}/>
     </section>
     {!priceInActions&&<section className="enrollment-detail-section">
       <h3 className="enrollment-record-section-title">{t('课程费用','Tuition','Biaya kursus')}</h3>
       <EnrollmentDetailFields fields={[
         [t('课程总价','Total tuition','Total biaya'),row.price>0
           ? <span className="enrollment-main-amount">{formatCurrency(row.price,language)}</span>
           : t('报价待确认','Quote pending','Harga belum dikonfirmasi')],
         [t('标准价','Standard price','Harga standar'),!!row.standardPrice&&row.standardPrice>row.price&&<del>{formatCurrency(row.standardPrice,language)}</del>],
       ]}/>
     </section>}
   </div>;
 }
 return <article className={`enrollment-class-card${chatPresentation?' enrollment-class-card--chat':''}`}>
   {chatPresentation?<div className="chat-class-heading">{heading}<span className="enrollment-status" data-state={state}>{statusText}</span></div>:heading}
   {chatPresentation&&<p><CalendarDays size={15} aria-hidden="true"/>{[dateLabel,enrollmentTeacherLabel(row.teacherType,language)].filter(Boolean).join(' · ')}</p>}
   {chatPresentation&&<p className="enrollment-schedule"><Clock3 size={15} aria-hidden="true"/><ChatClassSchedule row={row} language={language} withZone/></p>}
   {chatPresentation&&<p><BookOpen size={15} aria-hidden="true"/>{[
     size,
     periods&&t(periods+' 节',periods+' periods',periods+' jam pelajaran'),
     t('每节 '+row.minutes+' 分钟',row.minutes+' min each',row.minutes+' menit per jam pelajaran'),
   ].filter(Boolean).join(' · ')}</p>}
   {!chatPresentation&&<>
     {teacher&&<p className="enrollment-teacher">{teacher}</p>}
     <p className="enrollment-schedule">{schedule}</p>
     <div className="enrollment-catalog-facts"><p>{dateLabel}</p><span className="enrollment-status" data-state={publicTone}>{publicStatus}</span></div>
     <p>{[size,lessonCount,duration].filter(Boolean).join(' · ')}</p>
   </>}
   <div className="enrollment-class-bottom">
     <div className="enrollment-prices">{row.price>0?<><strong><span className={chatPresentation?'chat-value':undefined}>{formatCurrency(row.price,language)}</span>{chatPresentation&&<small>{t('实付总价','Total tuition','Total biaya')}</small>}</strong>
       {!!row.standardPrice&&(chatPresentation||row.standardPrice>row.price)&&<small>
         <span className={chatPresentation?undefined:'sr-only'}>{t('标准价','Standard price','Harga standar')}{' '}</span>
         <del className={chatPresentation?'chat-value':'enrollment-reference-price'}>{formatCurrency(row.standardPrice,language)}</del>
       </small>}
       {chatPresentation&&periods&&<small><span className={chatPresentation?'chat-value':undefined}>{formatCurrency(Math.round(row.price/periods),language)}</span>{t('／节',' / period',' / jam pelajaran')}</small>}</>:<strong>{t('报价待确认','Quote pending','Harga belum dikonfirmasi')}</strong>}</div>
     {primaryLink&&<Link className={chatPresentation?`chat-enrollment-next${chatPrimaryAction?' chat-enrollment-next--primary':''}`:'enrollment-primary'} to={primaryLink} state={navigationState} onClick={onNavigate}>{primaryLabel}</Link>}
   </div>
   {showDetails&&<section aria-label={t('课程介绍','Course details','Rincian kursus')}>
     {[[t('学习成果','Learning outcomes','Hasil belajar'),row.learningOutcomes],[t('内容与教材','Content and materials','Materi dan buku'),row.material],[t('练习资源','Practice resources','Sumber latihan'),row.resources],[t('授课教师','Teacher','Pengajar'),row.teacher?.trim()]].filter(([,value])=>value).map(([label,value])=><details key={label}><summary>{label}</summary><p>{value}</p></details>)}
   </section>}
 </article>;
}
