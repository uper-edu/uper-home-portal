import { ChevronDown, Mail } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { enrollmentCopy } from '../utils/enrollmentCatalog';
import type { InterestLanguage } from '../utils/enrollmentInterestCopy';
import {maskEnrollmentEmail} from '../utils/enrollmentEmailIdentity';
import {EnrollmentStatusBadge} from './EnrollmentRecordLayout';
export {maskEnrollmentEmail} from '../utils/enrollmentEmailIdentity';

export function EnrollmentEmailIdentity({email,language,compact=false,children}:{
  email:string;
  language:InterestLanguage;
  compact?:boolean;
  children:ReactNode;
}) {
  const label=enrollmentCopy(language,['报名邮箱','Enrollment email','Email pendaftaran']);
  const verified=enrollmentCopy(language,['已验证','Verified','Terverifikasi']);
  const masked=maskEnrollmentEmail(email);
  const menu=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    if(!compact)return;
    const dismiss=(event:PointerEvent)=>{
      const details=menu.current;
      if(details?.open&&event.target instanceof Node&&!details.contains(event.target))details.open=false;
    };
    document.addEventListener('pointerdown',dismiss);
    return ()=>document.removeEventListener('pointerdown',dismiss);
  },[compact]);
  if(compact)return <details ref={menu} className="enrollment-email-disclosure enrollment-email-menu" onBlur={event=>{
    if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget))event.currentTarget.open=false;
  }} onKeyDown={event=>{
    if(event.key!=='Escape'||!event.currentTarget.open)return;
    event.preventDefault();
    event.currentTarget.open=false;
    event.currentTarget.querySelector('summary')?.focus();
  }}>
    <summary aria-label={`${label}: ${masked}, ${verified}`}>
      <Mail className="enrollment-email-menu-icon" size={16} aria-hidden="true"/>
      <span className="enrollment-email-menu-address">{masked}</span>
      <ChevronDown size={16} aria-hidden="true"/>
    </summary>
    <div className="enrollment-email-disclosure-body">
      <div className="enrollment-detail-field-with-badge">
        <span className="enrollment-detail-field-value">{masked}</span>
        <span className="enrollment-detail-field-badge"><EnrollmentStatusBadge status={verified} tone="confirmed"/></span>
      </div>
      {children}
    </div>
  </details>;
  return <details className="enrollment-email-disclosure">
    <summary>
      <span className="enrollment-identity-label">{label}</span>
      <span className="enrollment-identity-detail">
        <strong>{masked}</strong>
        <span className="enrollment-identity-verified">{verified}</span>
      </span>
      <ChevronDown size={16} aria-hidden="true"/>
    </summary>
    <div className="enrollment-email-disclosure-body">{children}</div>
  </details>;
}
