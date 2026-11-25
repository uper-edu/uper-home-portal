import {createBrowserUuid} from '../utils/browserUuid';
import {visitorScope} from './visitorScope';
import {validContactEmail} from '../utils/contactEmail';
import {watchReadReconnect} from './readReconnect';

const enrollmentSessionChangeKey = 'uper:enrollment-email-session-change';

function notifyEmailSessionChange() {
  try { localStorage.setItem(enrollmentSessionChangeKey, createBrowserUuid()); } catch { /* Storage can be unavailable. */ }
}

// A check returns false when the server's session state could not be read.
export function watchEnrollmentEmailSession(check: (isLatest: () => boolean, signal:AbortSignal, sessionChanged:boolean) => Promise<boolean|void>, immediate=false) {
  const lifetime=new AbortController();
  let checking=false;
  let pending=false;
  let sessionChanged=false;
  let readInconclusive=false;
  let networkRevision=0;
  let activeCheck:AbortController|undefined;
  let wasHidden=document.hidden;
  const refresh=(changed=false,returnedToPage=false)=>{
    if (!changed && !returnedToPage && checking) return;
    sessionChanged ||= changed;
    pending=true;
    // A read issued before another tab changed the session cannot verify it.
    if (changed) activeCheck?.abort();
    if(checking)return;
    checking=true;
    queueMicrotask(async()=>{
      try {
        while(!lifetime.signal.aborted&&pending){
          pending=false;
          const networkAtStart=networkRevision;
          const request=activeCheck=new AbortController();
          const signal=AbortSignal.any([lifetime.signal,request.signal,AbortSignal.timeout(15000)]);
          try {
            const result=await check(()=>!lifetime.signal.aborted&&!pending,signal,sessionChanged);
            if(!lifetime.signal.aborted&&!pending){
              readInconclusive=result===false;
              // A weak connection can recover before the old read reports its failure.
              if(readInconclusive&&networkRevision!==networkAtStart&&!document.hidden)pending=true;
            }
          } catch(error) {
            if(!request.signal.aborted&&!lifetime.signal.aborted)throw error;
          } finally {
            activeCheck=undefined;
          }
          if(!pending)sessionChanged=false;
        }
      } finally {
        checking=false;
      }
    });
  };
  const changed=(event:StorageEvent)=>{if(event.key===enrollmentSessionChangeKey)refresh(true);};
  const reconnected=()=>{
    networkRevision++;
    if(readInconclusive&&!document.hidden)refresh();
  };
  const checkForeground=()=>{
    const returnedToPage=wasHidden&&!document.hidden;
    wasHidden=document.hidden;
    if(!wasHidden)refresh(false,returnedToPage);
  };
  window.addEventListener('focus',checkForeground);
  window.addEventListener('storage',changed);
  window.addEventListener('online',reconnected);
  document.addEventListener('visibilitychange',checkForeground);
  if(immediate)refresh();
  return ()=>{
    lifetime.abort();
    window.removeEventListener('focus',checkForeground);
    window.removeEventListener('storage',changed);
    window.removeEventListener('online',reconnected);
    document.removeEventListener('visibilitychange',checkForeground);
  };
}

async function readEmailSession(body: { email?: string }, signal: AbortSignal) {
  if (globalThis.navigator?.onLine === false) return undefined;
  try {
    return (await enrollmentPost('/api/enrollment/email/session', body, undefined, signal)) ?? undefined;
  } catch (error) {
    if ((error as { status?: number }).status === 401) return null;
  }
}

export async function readEnrollmentEmailVerification(email: string, signal: AbortSignal): Promise<boolean | undefined> {
  const result = await readEmailSession({ email }, signal);
  if (result === null) return false;
  if (typeof result?.verified === 'boolean') return result.verified;
}

export async function readEnrollmentEmailAddress(signal: AbortSignal): Promise<string | null | undefined> {
  const result = await readEmailSession({}, signal);
  if (result === null || result?.verifiedEmail === null) return null;
  if (typeof result?.verifiedEmail === 'string' && validContactEmail(result.verifiedEmail)) return result.verifiedEmail;
}

async function readEnrollmentResponse(path:string,email?:string,signal?:AbortSignal,networkRevision?:()=>number,canRetry=()=>true) {
  const owner=visitorScope();
  const before=networkRevision?.();
  const current=()=>!signal?.aborted&&visitorScope()===owner;
  const read=async()=>{
    if(!current() || globalThis.navigator?.onLine===false)return null;
    const deadline=AbortSignal.timeout(15000);
    try {
      const response=await fetch(path,{cache:'no-store',headers:email?{'X-Enrollment-Email':email}:undefined,
        signal:signal?AbortSignal.any([signal,deadline]):deadline});
      if(!current())return null;
      const data:unknown=response.ok?await response.json():undefined;
      return {status:response.status,ok:response.ok,headers:response.headers,data};
    } catch {return null;}
  };
  let response=await read();
  // Reconnection can happen while the response body is still being read.
  if(current()&&before!==networkRevision?.()&&
    (!response||response.status===408||response.status>=500)&&canRetry())response=await read();
  return current()?response:null;
}

export function readEnrollmentOrdersResponse(email:string,signal:AbortSignal,networkRevision:()=>number) {
  return readEnrollmentResponse('/api/enrollment/orders',email,signal,networkRevision);
}

export function readEnrollmentInterestsResponse(email:string,signal:AbortSignal,networkRevision?:()=>number) {
  return readEnrollmentResponse('/api/enrollment/interests',email,signal,networkRevision);
}

export function readEnrollmentAftercareResponse(path:string,email:string,signal:AbortSignal,networkRevision:()=>number) {
  return readEnrollmentResponse(path+'/aftercare',email,signal,networkRevision);
}

export function readEnrollmentOrderResponse(path:string,email:string,signal:AbortSignal,networkRevision:()=>number,canRetry:()=>boolean) {
  return readEnrollmentResponse(path,email,signal,networkRevision,canRetry);
}

export async function enrollmentPost(path: string, body: unknown, expectedEmail?: string, signal?:AbortSignal) {
  return postEnrollmentBody(path, JSON.stringify(body), {'Content-Type':'application/json'}, expectedEmail, signal);
}

export async function submitEnrollmentInterest(kind:'waitlist'|'demands', body:unknown, email:string) {
  try {
    const result = await enrollmentPost('/api/enrollment/'+kind,body,email,AbortSignal.timeout(15000));
    if (typeof result?.id === 'string' && result.id) return result;
  } catch (error) {
    const {status,message} = error as Error & {status?:number};
    if (message==='enrollment_verification_required' || (status && status>=400 && status<500 && status!==408)) throw error;
  }
  throw Error('enrollment_interest_unconfirmed');
}

export function postEnrollmentProof(path:string,file:File,metadata:import('../utils/enrollmentLearnerPayments').EnrollmentProofSubmission & {uploadId:string},expectedEmail:string,signal:AbortSignal) {
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
  const data = await response.json().catch(error=>{
    if(response.ok)throw error;
  });
  if(owner&&owner!==visitorScope())throw Error('enrollment_verification_required');
  if (!response.ok) {
    const fallback=response.status===401?'enrollment_verification_required'
      : response.status===429&&path.endsWith('/email/request')?'enrollment_code_wait':'enrollment_failed';
    const message=typeof data?.error==='string'&&data.error?data.error:fallback;
    throw Object.assign(Error(message),{status:response.status});
  }
  if (path.endsWith('/email/verify') || path === '/api/enrollment/email/logout') {
    notifyEmailSessionChange();
  }
  return data;
}

export async function verifyEnrollmentEmail(email:string,challengeId:string,code:string) {
  const scope=visitorScope();
  try {
    const result=await enrollmentPost('/api/enrollment/email/verify',{email,challengeId,code},undefined,AbortSignal.timeout(15000));
    if(result?.verified===true)return;
  } catch (cause) {
    if(scope!==visitorScope())throw Error('enrollment_verification_required');
    const status=(cause as {status?:number}).status;
    if(status&&status>=400&&status<500&&status!==408)throw cause;
  }
  // The cookie may already be installed even if the verification response body was lost.
  const session=await enrollmentPost('/api/enrollment/email/session',{email},undefined,AbortSignal.timeout(15000)).catch(()=>null);
  if(scope!==visitorScope())throw Error('enrollment_verification_required');
  if(session?.verified!==true)throw Error('enrollment_email_verification_unconfirmed');
  notifyEmailSessionChange();
}

export async function signOutEnrollmentEmail(email:string) {
  const scope=visitorScope();
  try {
    const result=await enrollmentPost('/api/enrollment/email/logout',{},email,AbortSignal.timeout(15000));
    if(result?.signedOut===true)return;
  } catch(error) {
    const {status,message}=error as Error&{status?:number};
    if(message==='enrollment_verification_required'||status&&status<500&&status!==408)throw error;
  }

  // A dropped response can hide a successful revocation. Read the original
  // email's status without sending another logout against a replacement session.
  const active=await readEnrollmentEmailVerification(email,AbortSignal.timeout(15000));
  if(scope!==visitorScope())throw Error('enrollment_verification_required');
  if(active!==false)throw Error('enrollment_email_signout_unconfirmed');
  notifyEmailSessionChange();
}

const pendingCodeSends = new Map<string,Promise<string>>();
type AssistanceLookup = {applicationId:string} | {token:string};

export function requestEnrollmentEmailCode(email:string,language:string,purpose:'mine'|'apply'):Promise<string> {
  return requestEmailCode('/api/enrollment/email/request',[email.trim().toLowerCase(),purpose],{email,language,purpose});
}

export function requestAssistanceEmailCode(lookup:AssistanceLookup,language:string) {
  return requestEmailCode('/api/enrollment/assistance/email/request',lookup,{...lookup,language});
}

export async function verifyAssistanceEmailCode(lookup:AssistanceLookup,challengeId:string,code:string) {
  const result=await enrollmentPost('/api/enrollment/assistance/email/verify',{...lookup,challengeId,code},undefined,AbortSignal.timeout(15000));
  if(result?.verified!==true)throw Error('enrollment_email_verification_unconfirmed');
}

function requestEmailCode(path:string,identity:unknown,body:object):Promise<string> {
  const key=JSON.stringify([visitorScope(),path,identity]);
  const existing=pendingCodeSends.get(key);
  if(existing)return existing;
  const response=sendEnrollmentEmailCode(path,body).finally(()=>pendingCodeSends.delete(key));
  pendingCodeSends.set(key,response);
  return response;
}

async function sendEnrollmentEmailCode(path:string,body:object):Promise<string> {
  if(globalThis.navigator?.onLine===false)throw Error('enrollment_code_offline');
  try {
    const result=await enrollmentPost(path,body,undefined,AbortSignal.timeout(60000));
    if(typeof result?.challengeId==='string'&&result.challengeId)return result.challengeId;
  } catch(error) {
    const cause=error as Error&{status?:number};
    const status=cause.status;
    if(cause.message==='enrollment_verification_required' ||
      status&&status!==408&&(status<500||cause.message!=='enrollment_failed'))throw error;
  }
  throw Error('enrollment_code_send_unconfirmed');
}

export function enrollmentCodeInput(value:string,current:string) {
  const digits=value.replace(/\D/g,'');
  // Strip grouping before measuring the code. Never truncate a different code to six digits.
  return digits.length<=6 ? digits : current;
}

export async function readEnrollmentOperation<T extends {id:string}>(path:string, expectedEmail?:string, signal?:AbortSignal, networkRevision?:()=>number, matchesOrder?:(order:T)=>boolean) {
  const scope=visitorScope();
  const response=await readEnrollmentResponse(path,expectedEmail,signal,networkRevision);
  signal?.throwIfAborted();
  if(scope!==visitorScope()||response?.status===401)throw Error('enrollment_verification_required');
  if(!response?.ok)throw Error('enrollment_operation_unconfirmed');
  const result=response.data as {state:'saved';order:T}|{state:'unconfirmed';proofTransport?:'binary-v1';uploadActive?:boolean}|null;
  if(!result||(result.state==='unconfirmed'
    ? result.uploadActive!==undefined&&typeof result.uploadActive!=='boolean'
    : result.state!=='saved'||typeof result.order?.id!=='string'||!result.order.id||
      matchesOrder?.(result.order)===false))
    throw Error('enrollment_operation_unconfirmed');
  return result;
}

export function recoverEnrollmentOperation<T extends {id:string}>({path,email,waitForConnection,isCurrent,matchesOrder,onResult,onVerificationRequired,onChecking,onUnavailable}:{
  path:string;email:string;waitForConnection:boolean;isCurrent:()=>boolean;
  matchesOrder:(order:T)=>boolean;
  onResult:(result:Awaited<ReturnType<typeof readEnrollmentOperation<T>>>)=>void;
  onVerificationRequired:()=>void;
  onChecking?:(checking:boolean)=>void;
  onUnavailable?:()=>void;
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
    void readEnrollmentOperation<T>(path,email,controller.signal,undefined,matchesOrder).then(result=>{
      setChecking(false);
      reconnect.stop();
      if(current())onResult(result);
    },error=>{
      setChecking(false);
      if(!current()){reconnect.stop();return;}
      if((error as Error).message==='enrollment_verification_required'){
        reconnect.stop();
        onVerificationRequired();
      }else{
        onUnavailable?.();
        reconnect.failed();
      }
    });
  }
  if(waitForConnection)reconnect.failed();
  else read();
  return ()=>{controller.abort();reconnect.stop();setChecking(false);};
}
