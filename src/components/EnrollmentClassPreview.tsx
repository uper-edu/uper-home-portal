import {Link} from 'react-router-dom';
import {ChevronRight} from 'lucide-react';
import {formatCurrency} from '../utils/currency';
import {enrollmentOpeningNotice,enrollmentWeeklyScheduleText,type PublicEnrollmentClass} from '../utils/enrollmentCatalog';
import {enrollmentCopy} from './EnrollmentApplication';
import '../pages/enrollment.css';

type Language='zh'|'en'|'id';
export function EnrollmentClassPreview({row,language,clock,titleLink,actionLink,showDetails=false}:{
  row:PublicEnrollmentClass;language:Language;clock?:number;titleLink?:string;actionLink?:string;showDetails?:boolean;
}){
 const t=(zh:string,en:string,id:string)=>enrollmentCopy(language,[zh,en,id]);
 const dateValue=new Date(row.firstLesson+':00+07:00');
 const date=Number.isFinite(dateValue.valueOf())?new Intl.DateTimeFormat({zh:'zh-CN',en:'en-GB',id:'id-ID'}[language],{
   month:'long',day:'numeric',timeZone:'Asia/Jakarta',
 }).format(dateValue).replaceAll(' ','\u00a0'):'';
 const dateLabel=date?(row.opened?t(date+'开课','Starts '+date,'Mulai '+date):t('预计 '+date+'开课','Expected '+date,'Perkiraan '+date)):t('首课待确认','Start date pending','Tanggal mulai belum dikonfirmasi');
 const type=row.format==='standard'?t('标准班','Standard Class','Kelas Standar'):t('小班','Small Group','Kelas Kecil');
 const period=row.period==='weekend'?t('周末','Weekend','Akhir Pekan'):t('工作日晚间','Weekday Evening','Malam Hari Kerja');
 const classLabel=t(period+type,period+' '+type,type+' '+period);
 const size=row.format==='standard'?'10–15':'4–6';
 const title=row.level+' · '+classLabel+' · '+dateLabel;
 const openingNotice=row.opened?'':enrollmentOpeningNotice(row.decisionAt,language,clock);
 const availability=row.availability&&({
   full:t('满班','Full','Penuh'),limited:t('空位紧张','Limited seats','Kursi terbatas'),available:t('有空位','Seats available','Kursi tersedia'),
 })[row.availability];
 return <article className="enrollment-class-card">
   <h2>{titleLink?<Link to={titleLink}>{title}<ChevronRight size={15} aria-hidden="true"/></Link>:title}</h2>
   <p>{t(size+' 人 · '+row.sessions+' 节 · 每节 '+row.minutes+' 分钟',size+' learners · '+row.sessions+' lessons · '+row.minutes+' min each',size+' siswa · '+row.sessions+' sesi · '+row.minutes+' menit per sesi')}</p>
   <p className="enrollment-schedule">{enrollmentWeeklyScheduleText(row.weeklySchedule,row.minutes,language)||row.schedule}</p>
   {row.teacherType&&<p>{row.teacherType==='foreign'?t('外教','Foreign teacher','Pengajar asing'):t('本土教师','Local teacher','Pengajar lokal')}</p>}
   <div className="enrollment-class-status">
     <span className="enrollment-status" data-state={row.availability==='full'?'full':row.opened?'confirmed':'pending'}>
       {!row.price?t('暂不可申请','Applications unavailable','Pendaftaran belum tersedia'):row.opened?t('已成班','Confirmed','Dikonfirmasi'):t('报名中','Open for applications','Pendaftaran dibuka')}{availability&&' · '+availability}
     </span>{openingNotice&&<small>{openingNotice}</small>}
   </div>
   <div className="enrollment-class-bottom">
     <div className="enrollment-prices">{row.price>0?<><strong>{formatCurrency(row.price,language)}</strong>
       {row.standardPrice&&<small>{t('标准价','Standard price','Harga standar')} <del>{formatCurrency(row.standardPrice,language)}</del></small>}
       <small>{formatCurrency(Math.round(row.price/row.sessions),language)}{t('／节',' / lesson',' / sesi')}</small></>:<strong>{t('报价待确认','Quote pending','Harga belum dikonfirmasi')}</strong>}</div>
     {actionLink&&<Link className="enrollment-primary" to={actionLink}>{row.availability==='full'?t('加入候补','Join waitlist','Daftar tunggu'):t('申请这个班','Apply for this class','Daftar kelas ini')}</Link>}
   </div>
   {showDetails&&<section aria-label={t('课程介绍','Course details','Rincian kursus')}>
     {[[t('学习成果','Learning outcomes','Hasil belajar'),row.learningOutcomes],[t('内容与教材','Content and materials','Materi dan buku'),row.material],[t('练习资源','Practice resources','Sumber latihan'),row.resources],[t('授课教师','Teacher','Pengajar'),row.teacher?.trim()]].filter(([,value])=>value).map(([label,value])=><details key={label}><summary>{label}</summary><p>{value}</p></details>)}
   </section>}
 </article>;
}
