import {watchReadReconnect} from './readReconnect';
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
  return postEnrollmentBody(path,JSON.stringify(body),{'Content-Type':'application/json'},expectedEmail,signal);
}

export function postEnrollmentProof(path:string,file:File,metadata:{uploadId:string;reportedAmount?:number;bankReference?:string},expectedEmail:string,signal:AbortSignal) {
  return postEnrollmentBody(path,file,{
    'Content-Type':file.type,
    'X-Enrollment-Proof':encodeURIComponent(JSON.stringify(metadata)),
  },expectedEmail,signal);
}

async function postEnrollmentBody(path:string,body:BodyInit,headers:Record<string,string>,expectedEmail?:string,signal?:AbortSignal) {
  const owner=visitorScope();
  if(owner)headers['X-Visitor-Scope']=owner;
  if(expectedEmail)headers['X-Enrollment-Email']=expectedEmail;
  const response = await fetch(path, { method: 'POST', headers, body, ...(signal&&{signal}) });
  if(owner&&owner!==visitorScope())throw Error('enrollment_verification_required');
  const data = await response.json().catch(error=>{if(response.ok)throw error;});
  if(owner&&owner!==visitorScope())throw Error('enrollment_verification_required');
  if (!response.ok) throw Object.assign(Error(data?.error || (response.status===401?'enrollment_verification_required':'enrollment_failed')),{status:response.status});
  if (path === '/api/enrollment/email/verify' || path === '/api/enrollment/email/logout') {
    try { localStorage.setItem(enrollmentSessionChangeKey, crypto.randomUUID()); } catch { /* Storage can be unavailable. */ }
  }
  return data;
}

export async function readEnrollmentOperation<T extends {id:string}>(path:string, expectedEmail?:string, signal?:AbortSignal) {
  const scope=visitorScope();
  const response=await fetch(path,{
    cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),
    headers:expectedEmail?{'X-Enrollment-Email':expectedEmail}:undefined,
  }).catch(()=>null);
  signal?.throwIfAborted();
  if(scope!==visitorScope()||response?.status===401)throw Error('enrollment_verification_required');
  if(!response?.ok)throw Error('enrollment_operation_unconfirmed');
  const result=await response.json().catch(()=>null) as {state:'saved';order:T}|{state:'unconfirmed';proofTransport?:'binary-v1';uploadActive?:boolean}|null;
  if(scope!==visitorScope())throw Error('enrollment_verification_required');
  signal?.throwIfAborted();
  if(!result||(result.state==='unconfirmed'
    ? result.uploadActive!==undefined&&typeof result.uploadActive!=='boolean'
    : result.state!=='saved'||typeof result.order?.id!=='string'||!result.order.id))
    throw Error('enrollment_operation_unconfirmed');
  return result;
}

export function recoverEnrollmentOperation<T extends {id:string}>({path,email,waitForConnection,isCurrent,onResult,onVerificationRequired,onChecking}:{
  path:string;email:string;waitForConnection:boolean;isCurrent:()=>boolean;
  onResult:(result:Awaited<ReturnType<typeof readEnrollmentOperation<T>>>)=>void;
  onVerificationRequired:()=>void;
  onChecking?:(checking:boolean)=>void;
}) {
  const controller=new AbortController();
  const current=()=>!controller.signal.aborted&&isCurrent();
  const reconnect=watchReadReconnect(read);
  let checking=false;
  function setChecking(next:boolean) {
    if(checking===next)return;
    checking=next;
    onChecking?.(next);
  }
  function read() {
    if(!current()){reconnect.stop();return;}
    setChecking(true);
    void readEnrollmentOperation<T>(path,email,controller.signal).then(result=>{
      setChecking(false);
      reconnect.stop();
      if(current())onResult(result);
    },error=>{
      setChecking(false);
      if(!current()){reconnect.stop();return;}
      if((error as Error).message==='enrollment_verification_required'){
        reconnect.stop();
        onVerificationRequired();
      }else reconnect.failed();
    });
  }
  if(waitForConnection)reconnect.failed();
  else read();
  return ()=>{controller.abort();reconnect.stop();setChecking(false);};
}
