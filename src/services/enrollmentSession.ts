import {visitorScope} from './visitorScope';

const enrollmentSessionChangeKey = 'uper:enrollment-email-session-change';

export function watchEnrollmentEmailSession(check: () => void) {
  const changed=(event:StorageEvent)=>{if(event.key===enrollmentSessionChangeKey)check();};
  const visible=()=>{if(!document.hidden)check();};
  window.addEventListener('focus',check);
  window.addEventListener('storage',changed);
  document.addEventListener('visibilitychange',visible);
  return ()=>{
    window.removeEventListener('focus',check);
    window.removeEventListener('storage',changed);
    document.removeEventListener('visibilitychange',visible);
  };
}

export async function enrollmentPost(path: string, body: unknown, expectedEmail?: string) {
  const owner=visitorScope();
  const headers:Record<string,string>={'Content-Type':'application/json'};
  if(owner)headers['X-Visitor-Scope']=owner;
  if(expectedEmail)headers['X-Enrollment-Email']=expectedEmail;
  const response = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
  if(owner&&owner!==visitorScope())throw Error('enrollment_verification_required');
  const data = await response.json();
  if (!response.ok) throw Error(data.error);
  if (path === '/api/enrollment/email/verify' || path === '/api/enrollment/email/logout') {
    try { localStorage.setItem(enrollmentSessionChangeKey, crypto.randomUUID()); } catch { /* Storage can be unavailable. */ }
  }
  return data;
}
