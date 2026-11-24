import {EnrollmentClassName} from './EnrollmentClassName';
import type {ReactNode} from 'react';
import {enrollmentCopy,enrollmentInstant,enrollmentTeacherLabel} from '../utils/enrollmentCatalog';
import type {InterestLanguage} from '../utils/enrollmentInterestCopy';
import type {EnrollmentOrder} from './EnrollmentPayment';
import {enrollmentDateFormatter} from '../utils/enrollmentDateFormat';
import {formatCurrency} from '../utils/currency';

type StatusTone='pending'|'confirmed'|'full';

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

export function EnrollmentPriceActions({label,hideLabel=false,amount,standardPrice,language,children}:{
  label:string;hideLabel?:boolean;amount:number;standardPrice?:number;language:InterestLanguage;children:ReactNode;
}) {
  return <div className="enrollment-price-actions">
    <dl className="enrollment-price-actions-summary">
      <div>
        <dt className={hideLabel?'sr-only':undefined}>{label}</dt>
        <dd className="enrollment-main-amount">{formatCurrency(amount,language)}</dd>
      </div>
      {standardPrice!==undefined&&standardPrice>amount&&<div className="enrollment-price-actions-standard">
        <dt className="sr-only">{enrollmentCopy(language,['标准价','Standard price','Harga standar'])}</dt>
        <dd><del>{formatCurrency(standardPrice,language)}</del></dd>
      </div>}
    </dl>
    {children}
  </div>;
}

export function EnrollmentDetailFields({fields}:{
  fields:ReadonlyArray<readonly [string,ReactNode]>
}) {
  const visible=fields.filter(([,value])=>value!==undefined&&value!==null&&value!==false&&value!=='');
  if(!visible.length)return null;
  return <dl className="enrollment-detail-fields">
    {visible.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
  </dl>;
}

export function EnrollmentRecordSummary({title,status,tone='pending',schedule,teacherType,firstLesson,language,children}: {
  title:string;status?:string;tone?:StatusTone;schedule?:string;teacherType?:'local'|'foreign';firstLesson?:string;
  language:InterestLanguage;children?:ReactNode;
}) {
  const t=(copy:readonly [string,string,string])=>enrollmentCopy(language,copy);
  const firstDate=enrollmentInstant(firstLesson);
  return <header className="enrollment-record-summary">
    <div className="enrollment-detail-heading">
      <h2 className="enrollment-class-heading"><EnrollmentClassName title={title}/></h2>
      {status&&<span className="enrollment-status" data-state={tone} role="status">{status}</span>}
    </div>
    <EnrollmentDetailFields fields={[
      [t(['授课教师','Teacher','Pengajar']),enrollmentTeacherLabel(teacherType,language)],
      [t(['首课时间','First class','Pertemuan pertama']),firstDate&&<time dateTime={firstDate.toISOString()}>
        {enrollmentDateFormatter(language,'dateTime').format(firstDate)} WIB
      </time>],
      [t(['每周课表','Weekly schedule','Jadwal mingguan']),schedule],
    ]}/>
    {children}
  </header>;
}

export function EnrollmentListRecord({category,title,status,tone,children,primary}:{
  category:string;title:ReactNode;status:string;tone:StatusTone;children?:ReactNode;primary?:ReactNode;
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

export function EnrollmentOrderInformation({order,language,identity}: {order:EnrollmentOrder;language:InterestLanguage;identity?:ReactNode}) {
  const t=(copy:readonly [string,string,string])=>enrollmentCopy(language,copy);
  return <section className="enrollment-detail-section">
    <h2 className="enrollment-record-section-title">{t(['报名信息','Enrollment information','Informasi pendaftaran'])}</h2>
    <EnrollmentDetailFields fields={[
      [t(['学员姓名','Learner name','Nama siswa']),order.learnerName],
      [t(['报名编号','Order number','Nomor pendaftaran']),order.id],
    ]}/>
    {identity}
  </section>;
}
