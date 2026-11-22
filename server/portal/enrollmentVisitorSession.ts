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

export async function readEnrollmentEmailSession(
  client:{query:(sql:string,args?:unknown[])=>Promise<{rows:{email:string}[]}>},
  cookies:string|undefined,
  expected?:string,
):Promise<string|undefined> {
  const digest=readEnrollmentSessionDigest(cookies);
  if(!digest)return;
  const {rows:[row]}=await client.query(
    'SELECT email FROM enrollment_email_sessions WHERE digest=:p1 AND expires_at>UTC_TIMESTAMP(6) FOR SHARE',[digest]);
  if(expected!==undefined&&expected.trim().toLowerCase()!==row?.email)return;
  return row?.email;
}

export async function revokeEnrollmentEmailSession(
  client:{query:(sql:string,args?:unknown[])=>Promise<{rows:{email:string}[]}>},
  cookies:string|undefined,
  expected?:string,
):Promise<boolean> {
  const digest=readEnrollmentSessionDigest(cookies);
  if(!digest)return true;
  const {rows:[row]}=await client.query('SELECT email FROM enrollment_email_sessions WHERE digest=:p1 FOR UPDATE',[digest]);
  if(!row)return true;
  if(expected!==undefined&&row.email!==expected.trim().toLowerCase())return false;
  await client.query('DELETE FROM enrollment_email_sessions WHERE digest=:p1',[digest]);
  return true;
}
