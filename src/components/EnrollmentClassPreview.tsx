import {Link} from 'react-router-dom';
import type {MouseEventHandler} from 'react';
import {BookOpen,CalendarDays,ChevronRight,Clock3} from 'lucide-react';
import {formatCurrency} from '../utils/currency';
import {enrollmentClassSizeText,enrollmentClassTitle,enrollmentTeacherLabel,enrollmentWeeklyScheduleText,type PublicEnrollmentClass} from '../utils/enrollmentCatalog';
import {enrollmentCopy} from './EnrollmentApplication';
import '../pages/enrollment.css';

type Language='zh'|'en'|'id';
type EnrollmentCardRow=Pick<PublicEnrollmentClass,'level'|'format'|'period'|'batchNumber'|'teacherType'|
  'firstLesson'|'minutes'|'weeklySchedule'|'schedule'|'opened'|'price'|'availability'> &
  Partial<Pick<PublicEnrollmentClass,'sessions'|'standardPrice'|'learningOutcomes'|'material'|'resources'|'teacher'|'classSize'>>;

export function EnrollmentClassPreview({row,language,titleLink,actionLink,showDetails=false,intakePaused=false,availabilitySnapshot=false,onNavigate,navigationState,chatPresentation=false}:{
  row:EnrollmentCardRow;language:Language;titleLink?:string;actionLink?:string;showDetails?:boolean;intakePaused?:boolean;
  availabilitySnapshot?:boolean;onNavigate?:MouseEventHandler<HTMLAnchorElement>;navigationState?:unknown;chatPresentation?:boolean;
}){
 const t=(zh:string,en:string,id:string)=>enrollmentCopy(language,[zh,en,id]);
 const dateValue=new Date(row.firstLesson+':00+07:00');
 const date=Number.isFinite(dateValue.valueOf())?new Intl.DateTimeFormat({zh:'zh-CN',en:'en-GB',id:'id-ID'}[language],{
   month:'long',day:'numeric',timeZone:'Asia/Jakarta',
 }).format(dateValue).replaceAll(' ','\u00a0'):'';
 const dateLabel=date?(row.opened?t(date+'开课','Starts '+date,'Mulai '+date):t('首课 '+date,'First session '+date,'Pertemuan pertama '+date)):t('首课待确认','Start date pending','Tanggal mulai belum dikonfirmasi');
 const size=enrollmentClassSizeText(row.classSize,language);
 const periods=row.sessions&&row.sessions>0?row.sessions:undefined;
 const title=enrollmentClassTitle(row,language);
 const titleContent=<span className="enrollment-card-title">{title.split(' · ').map((part,index)=><span className="enrollment-title-part" key={index}>{(index?' · ':'')+part}</span>)}</span>;
 const availability=!intakePaused&&row.availability&&({
   full:t('满班','Full','Penuh'),limited:t('空位紧张','Limited seats','Kursi terbatas'),available:t('有空位','Seats available','Kursi tersedia'),
 })[row.availability];
 const heading=<h2>{titleLink?<Link to={titleLink} state={navigationState} onClick={onNavigate}>{titleContent}<ChevronRight size={15} aria-hidden="true"/></Link>:titleContent}</h2>;
 const availableText=availability&&((availabilitySnapshot?t('查询时','When checked: ','Saat diperiksa: '):'')+availability);
 const status=!row.price||intakePaused?t('暂不可申请','Applications unavailable','Pendaftaran belum tersedia'):row.opened?t('已成班','Confirmed','Dikonfirmasi'):t('报名中','Open for applications','Pendaftaran dibuka');
 const state=(chatPresentation&&intakePaused)||(!intakePaused&&row.availability==='full')
   ? 'full' : row.opened||(chatPresentation&&row.availability==='available')?'confirmed':'pending';
 const statusText=chatPresentation&&row.price&&availableText?availableText:status+(availableText&&(!chatPresentation||row.price)?' · '+availableText:'');
 return <article className={`enrollment-class-card${chatPresentation?' enrollment-class-card--chat':''}`}>
   {chatPresentation?<div className="chat-class-heading">{heading}<span className="enrollment-status" data-state={state}>{statusText}</span></div>:heading}
   <p>{chatPresentation&&<CalendarDays size={15} aria-hidden="true"/>}{(chatPresentation?[dateLabel,enrollmentTeacherLabel(row.teacherType,language)]:[enrollmentTeacherLabel(row.teacherType,language),dateLabel]).filter(Boolean).join(' · ')}</p>
   {chatPresentation&&<p className="enrollment-schedule"><Clock3 size={15} aria-hidden="true"/>{enrollmentWeeklyScheduleText(row.weeklySchedule,row.minutes,language)||row.schedule}</p>}
   <p>{chatPresentation&&<BookOpen size={15} aria-hidden="true"/>}{[
     size,
     periods&&t(periods+' 节',periods+' periods',periods+' jam pelajaran'),
     t('每节 '+row.minutes+' 分钟',row.minutes+' min each',row.minutes+' menit per jam pelajaran'),
   ].filter(Boolean).join(' · ')}</p>
   {!chatPresentation&&<>
     <p className="enrollment-schedule">{enrollmentWeeklyScheduleText(row.weeklySchedule,row.minutes,language)||row.schedule}</p>
     <div className="enrollment-class-status"><span className="enrollment-status" data-state={state}>{statusText}</span></div>
   </>}
   <div className="enrollment-class-bottom">
     <div className="enrollment-prices">{row.price>0?<><strong>{formatCurrency(row.price,language)}{chatPresentation&&<small>{t('实付总价','Total tuition','Total biaya')}</small>}</strong>
       {row.standardPrice&&<small>{t('标准价','Standard price','Harga standar')} <del>{formatCurrency(row.standardPrice,language)}</del></small>}
       {periods&&<small>{formatCurrency(Math.round(row.price/periods),language)}{t('／节',' / period',' / jam pelajaran')}</small>}</>:<strong>{t('报价待确认','Quote pending','Harga belum dikonfirmasi')}</strong>}</div>
     {actionLink&&<Link className="enrollment-primary" to={actionLink} state={navigationState} onClick={onNavigate}>{row.availability==='full'?t('加入候补','Join waitlist','Daftar tunggu'):t('申请这个班','Apply for this class','Daftar kelas ini')}</Link>}
   </div>
   {showDetails&&<section aria-label={t('课程介绍','Course details','Rincian kursus')}>
     {[[t('学习成果','Learning outcomes','Hasil belajar'),row.learningOutcomes],[t('内容与教材','Content and materials','Materi dan buku'),row.material],[t('练习资源','Practice resources','Sumber latihan'),row.resources],[t('授课教师','Teacher','Pengajar'),row.teacher?.trim()]].filter(([,value])=>value).map(([label,value])=><details key={label}><summary>{label}</summary><p>{value}</p></details>)}
   </section>}
 </article>;
}
