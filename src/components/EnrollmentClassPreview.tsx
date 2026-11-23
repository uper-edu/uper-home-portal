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

export function EnrollmentClassPreview({row,language,titleLink,actionLink,showDetails=false,intakeStatus,availabilitySnapshot=false,onNavigate,navigationState,chatPresentation=false,chatPrimaryAction=false}:{
  row:EnrollmentCardRow;language:Language;titleLink?:string;actionLink?:string;showDetails?:boolean;intakeStatus?:'checking'|'paused'|'unverified';
  availabilitySnapshot?:boolean;onNavigate?:MouseEventHandler<HTMLAnchorElement>;navigationState?:unknown;chatPresentation?:boolean;chatPrimaryAction?:boolean;
}){
 const t=(zh:string,en:string,id:string)=>enrollmentCopy(language,[zh,en,id]);
 const dateValue=new Date(row.firstLesson+':00+07:00');
 const date=Number.isFinite(dateValue.valueOf())?enrollmentDateFormatter(language,'day').format(dateValue).replaceAll(' ','\u00a0'):'';
 const dateLabel=date?(row.opened?t(date+'开课','Starts '+date,'Mulai '+date):t('首课 '+date,'First session '+date,'Pertemuan pertama '+date)):t('首课待确认','Start date pending','Tanggal mulai belum dikonfirmasi');
 const size=enrollmentClassSizeText(row.classSize,language);
 const periods=row.sessions&&row.sessions>0?row.sessions:undefined;
 const title=enrollmentClassTitle(row,language);
 const titleContent=<span className="enrollment-card-title">{title.split(' · ').map((part,index)=><span className="enrollment-title-part" key={index}>{(index?' · ':'')+part}</span>)}</span>;
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
 return <article className={`enrollment-class-card${chatPresentation?' enrollment-class-card--chat':''}`}>
   {chatPresentation?<div className="chat-class-heading">{heading}<span className="enrollment-status" data-state={state}>{statusText}</span></div>:heading}
   <p>{chatPresentation&&<CalendarDays size={15} aria-hidden="true"/>}{(chatPresentation?[dateLabel,enrollmentTeacherLabel(row.teacherType,language)]:[enrollmentTeacherLabel(row.teacherType,language),dateLabel]).filter(Boolean).join(' · ')}</p>
   {chatPresentation&&<p className="enrollment-schedule"><Clock3 size={15} aria-hidden="true"/><ChatClassSchedule row={row} language={language} withZone/></p>}
   <p>{chatPresentation&&<BookOpen size={15} aria-hidden="true"/>}{[
     size,
     periods&&t(periods+' 节',periods+' periods',periods+' jam pelajaran'),
     t('每节 '+row.minutes+' 分钟',row.minutes+' min each',row.minutes+' menit per jam pelajaran'),
   ].filter(Boolean).join(' · ')}</p>
   {!chatPresentation&&<>
     <p className="enrollment-schedule">{enrollmentScheduleLabel(row,language)}</p>
     <div className="enrollment-class-status"><span className="enrollment-status" data-state={state}>{statusText}</span></div>
   </>}
   <div className="enrollment-class-bottom">
     <div className="enrollment-prices">{row.price>0?<><strong><span className={chatPresentation?'chat-value':undefined}>{formatCurrency(row.price,language)}</span>{chatPresentation&&<small>{t('实付总价','Total tuition','Total biaya')}</small>}</strong>
       {row.standardPrice&&<small>{t('标准价','Standard price','Harga standar')} <del className={chatPresentation?'chat-value':undefined}>{formatCurrency(row.standardPrice,language)}</del></small>}
       {periods&&<small><span className={chatPresentation?'chat-value':undefined}>{formatCurrency(Math.round(row.price/periods),language)}</span>{t('／节',' / period',' / jam pelajaran')}</small>}</>:<strong>{t('报价待确认','Quote pending','Harga belum dikonfirmasi')}</strong>}</div>
     {actionLink&&<Link className={chatPresentation?`chat-enrollment-next${chatPrimaryAction?' chat-enrollment-next--primary':''}`:'enrollment-primary'} to={actionLink} state={navigationState} onClick={onNavigate}>{row.availability==='full'?t('加入候补','Join waitlist','Daftar tunggu'):t('申请这个班','Apply for this class','Daftar kelas ini')}</Link>}
   </div>
   {showDetails&&<section aria-label={t('课程介绍','Course details','Rincian kursus')}>
     {[[t('学习成果','Learning outcomes','Hasil belajar'),row.learningOutcomes],[t('内容与教材','Content and materials','Materi dan buku'),row.material],[t('练习资源','Practice resources','Sumber latihan'),row.resources],[t('授课教师','Teacher','Pengajar'),row.teacher?.trim()]].filter(([,value])=>value).map(([label,value])=><details key={label}><summary>{label}</summary><p>{value}</p></details>)}
   </section>}
 </article>;
}
