import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { enrollmentCopy } from '../utils/enrollmentCatalog';
import type { InterestLanguage } from '../utils/enrollmentInterestCopy';

export function maskEnrollmentEmail(email: string) {
  const [local,domain]=email.split('@');
  return local.slice(0,1)+'•••@'+domain;
}

export function EnrollmentEmailIdentity({email,language,children}:{
  email:string;
  language:InterestLanguage;
  children:ReactNode;
}) {
  const label=enrollmentCopy(language,['报名邮箱','Enrollment email','Email pendaftaran']);
  const verified=enrollmentCopy(language,['已验证','Verified','Terverifikasi']);
  const masked=maskEnrollmentEmail(email);
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
