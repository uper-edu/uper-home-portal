import {EnrollmentClassName} from './EnrollmentClassName';
import type {ReactNode} from 'react';
import {enrollmentCopy} from '../utils/enrollmentCatalog';
import type {InterestLanguage} from '../utils/enrollmentInterestCopy';
import type {EnrollmentOrder} from './EnrollmentPayment';

type StatusTone='pending'|'confirmed'|'full';

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

export function EnrollmentRecordSummary({title,status,tone='pending',schedule,children}: {
  title:string;status?:string;tone?:StatusTone;schedule?:string;children?:ReactNode;
}) {
  return <article className="enrollment-record enrollment-record-summary">
    <header>
      <h2 className="enrollment-class-heading"><EnrollmentClassName title={title}/></h2>
      {status&&<span className="enrollment-status" data-state={tone} role="status">{status}</span>}
    </header>
    {schedule&&<p className="enrollment-record-schedule">{schedule}</p>}
    {children}
  </article>;
}

export function EnrollmentListRecord({category,title,status,tone,children,primary,secondary}:{
  category:string;title:string;status:string;tone:StatusTone;children?:ReactNode;primary?:ReactNode;secondary?:ReactNode;
}) {
  return <article className="enrollment-record enrollment-list-card">
    <header>
      <small>{category}</small>
      <span className="enrollment-status" data-state={tone}>{status}</span>
    </header>
    <h3 className="enrollment-class-heading"><EnrollmentClassName title={title}/></h3>
    {children}
    <EnrollmentRecordActions primary={primary} secondary={secondary}/>
  </article>;
}

export function EnrollmentOrderInformation({order,language}: {order:EnrollmentOrder;language:InterestLanguage}) {
  const t=(copy:readonly [string,string,string])=>enrollmentCopy(language,copy);
  return <article className="enrollment-record">
    <h2>{t(['报名信息','Enrollment information','Informasi pendaftaran'])}</h2>
    <dl className="enrollment-result-amounts enrollment-order-metadata">
      {order.learnerName&&<div><dt>{t(['学员姓名','Learner name','Nama siswa'])}</dt><dd>{order.learnerName}</dd></div>}
      <div><dt>{t(['报名编号','Order number','Nomor pendaftaran'])}</dt><dd>{order.id}</dd></div>
    </dl>
  </article>;
}
