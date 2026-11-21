import {createHash} from 'node:crypto';

export const enrollmentSessionCookie='uper_enrollment_session';
export const portalVisitorCookie='uper_visitor';

export function portalVisitorToken(cookies:string|undefined) {
  return cookies?.match(/(?:^|;\s*)uper_visitor=([a-f0-9]{64})(?=;|$)/)?.[1];
}

export function enrollmentVisitorDigest(token:string,visitorId?:string) {
  const input=visitorId?'enrollment-visitor:'+visitorId+':'+token:token;
  return createHash('sha256').update(input).digest('hex');
}

export function readEnrollmentSessionDigest(cookies:string|undefined) {
  const match=cookies?.match(/(?:^|;\s*)uper_enrollment_session=(v2\.)?([a-f0-9]{64})(?=;|$)/);
  if (!match) return;
  // Previously issued sessions keep their original expiration. Person switch clears both formats.
  if (!match[1]) return enrollmentVisitorDigest(match[2]);
  const visitorId=portalVisitorToken(cookies);
  if (visitorId) return enrollmentVisitorDigest(match[2],visitorId);
}
