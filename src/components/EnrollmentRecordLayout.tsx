import {EnrollmentClassName} from './EnrollmentClassName';
import {useLayoutEffect,useRef,type ReactNode} from 'react';
import {enrollmentCopy,enrollmentFixedLessonDuration,enrollmentInstant,enrollmentTeacherLabel} from '../utils/enrollmentCatalog';
import type {InterestLanguage} from '../utils/enrollmentInterestCopy';
import type {EnrollmentOrder} from './EnrollmentPayment';
import {enrollmentDateFormatter} from '../utils/enrollmentDateFormat';
import {formatCurrency} from '../utils/currency';
import type {EnrollmentStatusTone} from '../utils/enrollmentOrderStatus';
import {maskEnrollmentEmail} from '../utils/enrollmentEmailIdentity';

export function EnrollmentPriceSaving({amount,standardPrice,language}:{
  amount:number;standardPrice?:number;language:InterestLanguage;
}) {
  if(!(amount>0&&standardPrice!==undefined&&standardPrice>amount))return null;
  const saving=formatCurrency(standardPrice-amount,language);
  return <span className="enrollment-price-saving">{enrollmentCopy(language,[
    '省 '+saving,'Save '+saving,'Hemat '+saving,
  ])}</span>;
}

export function EnrollmentStatusBadge({status,tone,announceStatus=false}: {
  status:string;tone:EnrollmentStatusTone;announceStatus?:boolean;
}) {
  return <span className="enrollment-status" data-state={tone} role={announceStatus?'status':undefined}>{status}</span>;
}

export function EnrollmentClassSummaryHeading({title,status,tone='pending',announceStatus=false}: {
  title:string;status?:string;tone?:EnrollmentStatusTone;announceStatus?:boolean;
}) {
  return <div className="enrollment-detail-heading">
    <h2 className="enrollment-class-heading"><EnrollmentClassName title={title}/></h2>
    {status&&<EnrollmentStatusBadge status={status} tone={tone} announceStatus={announceStatus}/>}
  </div>;
}

export function EnrollmentIntakeSummary({title,detail,amount,label,language}:{
  title:string;detail:string;amount:number;label:string;language:InterestLanguage;
}) {
  return <>
    <div className="enrollment-payment-summary">
      <h2 className="enrollment-class-heading"><EnrollmentClassName title={title}/></h2>
      <p>{detail}</p>
    </div>
    <p className="enrollment-tuition">{label} <strong>{formatCurrency(amount,language)}</strong></p>
  </>;
}

export function EnrollmentRecordActions({primary,secondary,tertiary}: {
  primary?:ReactNode;secondary?:ReactNode;tertiary?:ReactNode;
}) {
  if (!primary && !secondary && !tertiary) return null;
  return <div className="enrollment-record-actions" data-primary={!!primary}>
    {tertiary&&<div className="enrollment-record-tertiary">{tertiary}</div>}
    {secondary&&<div className="enrollment-record-secondary">{secondary}</div>}
    {primary&&<div className="enrollment-record-primary">{primary}</div>}
  </div>;
}

export function EnrollmentDetailActions({mobileFixed=false,secondaryLink,price,children,additional}:{
  mobileFixed?:boolean;secondaryLink?:ReactNode;price?:ReactNode;children?:ReactNode;additional?:ReactNode;
}) {
  const actionBar=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const bar=actionBar.current;
    const screen=bar?.closest<HTMLElement>('.enrollment-screen');
    if(!mobileFixed||!bar||!screen)return;
    const update=()=>screen.style.setProperty('--enrollment-fixed-action-height',bar.offsetHeight+'px');
    update();
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(update):undefined;
    observer?.observe(bar,{box:'border-box'});
    return ()=>{
      observer?.disconnect();
      screen.style.removeProperty('--enrollment-fixed-action-height');
    };
  },[mobileFixed]);
  return <div ref={actionBar} className={price?'enrollment-detail-actions enrollment-price-actions':'enrollment-detail-actions'}
    data-mobile-fixed={mobileFixed}>
    {secondaryLink&&<div className="enrollment-detail-action-link">{secondaryLink}</div>}
    {children&&<div className="enrollment-detail-action-main">{price}{children}</div>}
    {additional&&<div className="enrollment-detail-action-link">{additional}</div>}
  </div>;
}

export function EnrollmentPriceActions({label,hideLabel=false,amount,standardPrice,language,secondaryLink,children}:{
  label:string;hideLabel?:boolean;amount:number;standardPrice?:number;language:InterestLanguage;secondaryLink?:ReactNode;children:ReactNode;
}) {
  return <EnrollmentDetailActions mobileFixed secondaryLink={secondaryLink} price={<dl className="enrollment-price-actions-summary">
      <div>
        <dt className={hideLabel?'sr-only':undefined}>{label}</dt>
        <dd className="enrollment-main-amount">{formatCurrency(amount,language)}</dd>
      </div>
      {standardPrice!==undefined&&standardPrice>amount&&<div className="enrollment-price-actions-standard">
        <dt className="sr-only">{enrollmentCopy(language,['标准价','Standard price','Harga standar'])}</dt>
        <dd><del>{formatCurrency(standardPrice,language)}</del></dd>
      </div>}
      {amount>0&&standardPrice!==undefined&&standardPrice>amount&&<div>
        <dt className="sr-only">{enrollmentCopy(language,['节省金额','Savings','Penghematan'])}</dt>
        <dd><EnrollmentPriceSaving amount={amount} standardPrice={standardPrice} language={language}/></dd>
      </div>}
    </dl>}>{children}</EnrollmentDetailActions>;
}

type EnrollmentDetailField = readonly [label:string,value:ReactNode,badge?:ReactNode];

export function EnrollmentDetailFields({fields,heading}:{
  fields:ReadonlyArray<EnrollmentDetailField>;heading?:string;
}) {
  const visible=fields.filter(([,value])=>value!==undefined&&value!==null&&value!==false&&value!=='');
  if(!visible.length)return null;
  return <>
    {heading&&<h3 className="enrollment-record-section-title">{heading}</h3>}
    <dl className="enrollment-detail-fields">
      {visible.map(([label,value,badge])=><div key={label}>
        <dt>{label}</dt>
        {badge ? <dd className="enrollment-detail-field-with-badge">
          <span className="enrollment-detail-field-value">{value}</span>
          <span className="enrollment-detail-field-badge">{badge}</span>
        </dd> : <dd>{value}</dd>}
      </div>)}
    </dl>
  </>;
}

export function EnrollmentDetailSection({title,fields,action}:{
  title:string;fields:ReadonlyArray<EnrollmentDetailField>;action?:ReactNode;
}) {
  return <section className="enrollment-detail-section">
    {action?<div className="enrollment-detail-heading">
      <h2 className="enrollment-record-section-title">{title}</h2>{action}
    </div>:<h2 className="enrollment-record-section-title">{title}</h2>}
    <EnrollmentDetailFields fields={fields}/>
  </section>;
}

export function EnrollmentRecordStatus({label,status,tone,fields,description}:{
  label:string;status:string;tone:EnrollmentStatusTone;fields?:ReadonlyArray<EnrollmentDetailField>;description?:ReactNode;
}) {
  return <section className="enrollment-record-status" aria-label={label}>
    <div className="enrollment-record-status-heading">
      <h3 className="enrollment-record-section-title">{label}</h3>
      <EnrollmentStatusBadge status={status} tone={tone} announceStatus/>
    </div>
    {fields&&<EnrollmentDetailFields fields={fields}/>}
    {description}
  </section>;
}

export function EnrollmentRecordSummary({title,status,tone='pending',schedule,teacherType,firstLesson,sessions,minutes,language,additionalFields,statusSection,children}: {
  title:string;status?:string;tone?:EnrollmentStatusTone;schedule?:string;teacherType?:'local'|'foreign';firstLesson?:string;
  sessions?:number;minutes?:number;
  language:InterestLanguage;additionalFields?:ReadonlyArray<EnrollmentDetailField>;children?:ReactNode;
  statusSection?:{kind:'enrollment'|'booking';fields?:ReadonlyArray<EnrollmentDetailField>;description?:ReactNode};
}) {
  const t=(copy:readonly [string,string,string])=>enrollmentCopy(language,copy);
  const firstDate=enrollmentInstant(firstLesson);
  const booking=statusSection?.kind==='booking';
  const statusLabel=booking?t(['约课状态','Booking status','Status penjadwalan']):
    t(['报名状态','Enrollment status','Status pendaftaran']);
  const courseHeading=statusSection&&(booking?t(['课程信息','Lesson information','Informasi kursus']):
    t(['班次信息','Class information','Informasi kelas']));
  return <header className="enrollment-record-summary">
    <EnrollmentClassSummaryHeading title={title} status={statusSection?undefined:status} tone={tone} announceStatus/>
    {statusSection&&status&&<EnrollmentRecordStatus label={statusLabel} status={status} tone={tone}
      fields={statusSection.fields} description={statusSection.description}/>}
    <EnrollmentDetailFields heading={courseHeading} fields={[
      [t(['授课教师','Teacher','Pengajar']),enrollmentTeacherLabel(teacherType,language)],
      [t(['首课时间','First class','Pertemuan pertama']),firstDate&&<time dateTime={firstDate.toISOString()}>
        {enrollmentDateFormatter(language,'dateTime').format(firstDate)} WIB
      </time>],
      [t(['每周课表','Weekly schedule','Jadwal mingguan']),schedule],
      [t(['课时安排','Lesson duration','Durasi pelajaran']),
        sessions!==undefined&&sessions>0&&minutes!==undefined&&minutes>0&&enrollmentFixedLessonDuration(sessions,minutes,language)],
      ...(additionalFields??[]),
    ]}/>
    {children}
  </header>;
}

export function EnrollmentListRecord({category,title,status,tone,children,primary}:{
  category:string;title:ReactNode;status:string;tone:EnrollmentStatusTone;children?:ReactNode;primary?:ReactNode;
}) {
  return <article className="enrollment-record enrollment-list-card">
    <header>
      <small>{category}</small>
      <span className="enrollment-status" data-state={tone}>{status}</span>
    </header>
    <h3 className="enrollment-class-heading">{title}</h3>
    {children}
    {primary&&<EnrollmentRecordActions primary={primary}/>}
  </article>;
}

export function EnrollmentContactInformation({title,language,learnerName,verifiedEmail,phoneDisplay,additionalFields}:{
  title:string;language:InterestLanguage;learnerName?:string;verifiedEmail?:string;phoneDisplay?:string;
  additionalFields?:ReadonlyArray<EnrollmentDetailField>;
}) {
  const t=(copy:readonly [string,string,string])=>enrollmentCopy(language,copy);
  return <EnrollmentDetailSection title={title} fields={[
    [t(['学员姓名','Learner name','Nama siswa']),learnerName],
    [t(['报名邮箱','Enrollment email','Email pendaftaran']),verifiedEmail&&maskEnrollmentEmail(verifiedEmail),
      <EnrollmentStatusBadge status={t(['已验证','Verified','Terverifikasi'])} tone="confirmed"/>],
    [t(['WhatsApp／手机号','WhatsApp or phone','WhatsApp atau nomor HP']),verifiedEmail&&phoneDisplay],
    ...(additionalFields??[]),
  ]}/>;
}

export function EnrollmentOrderInformation({order,language,verifiedEmail}: {order:EnrollmentOrder;language:InterestLanguage;verifiedEmail?:string}) {
  return <EnrollmentContactInformation title={enrollmentCopy(language,['报名信息','Enrollment information','Informasi pendaftaran'])}
    language={language} learnerName={order.learnerName} verifiedEmail={verifiedEmail} phoneDisplay={order.phoneDisplay}
    additionalFields={[[enrollmentCopy(language,['报名编号','Order number','Nomor pendaftaran']),order.id]]}/>;
}
