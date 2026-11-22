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

export async function enrollmentPost(path: string, body: unknown, expectedEmail?: string, signal?:AbortSignal) {
  const owner=visitorScope();
  const headers:Record<string,string>={'Content-Type':'application/json'};
  if(owner)headers['X-Visitor-Scope']=owner;
  if(expectedEmail)headers['X-Enrollment-Email']=expectedEmail;
  const response = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body), ...(signal&&{signal}) });
  if(owner&&owner!==visitorScope())throw Error('enrollment_verification_required');
  const data = await response.json();
  if(owner&&owner!==visitorScope())throw Error('enrollment_verification_required');
  if (!response.ok) throw Object.assign(Error(data.error),{status:response.status});
  if (path === '/api/enrollment/email/verify' || path === '/api/enrollment/email/logout') {
    try { localStorage.setItem(enrollmentSessionChangeKey, crypto.randomUUID()); } catch { /* Storage can be unavailable. */ }
  }
  return data;
}

export async function readEnrollmentOperation<T extends {id:string}>(path:string, expectedEmail?:string) {
  const scope=visitorScope();
  const response=await fetch(path,{
    cache:'no-store',signal:AbortSignal.timeout(15000),
    headers:expectedEmail?{'X-Enrollment-Email':expectedEmail}:undefined,
  }).catch(()=>null);
  if(scope!==visitorScope()||response?.status===401)throw Error('enrollment_verification_required');
  if(!response?.ok)throw Error('enrollment_operation_unconfirmed');
  const result=await response.json().catch(()=>null) as {state:'saved';order:T}|{state:'unconfirmed'}|null;
  if(scope!==visitorScope())throw Error('enrollment_verification_required');
  if(!result||result.state!=='unconfirmed'&&(result.state!=='saved'||typeof result.order?.id!=='string'||!result.order.id))
    throw Error('enrollment_operation_unconfirmed');
  return result;
}
