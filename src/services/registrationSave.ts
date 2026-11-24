import {createBrowserUuid} from '../utils/browserUuid';
export type RegistrationSaveState='failed'|'unknown'|'conflict';
export class RegistrationSaveError extends Error {
  constructor(public state:RegistrationSaveState,message='Registration result unknown'){super(message);}
}
type Pending={id:string;submittedAt:string;fingerprint?:string;payload?:Record<string,any>};
const memory=new Map<string,Pending>();
const flights=new Map<string,{answersKey:string|undefined;promise:Promise<any>}>();
const key=(scope:string)=>'uper_registration_pending:'+scope;
function read(scope:string,storage?:Storage){
  if(memory.has(scope))return memory.get(scope);
  try {
    const p=JSON.parse(storage?.getItem(key(scope))||'null') as Pending|null;
    if(!p||typeof p.id!=='string'||!/^[a-f0-9-]{36}$/.test(p.id)||typeof p.submittedAt!=='string')return undefined;
    const payload=p.payload;
    if(!(payload&&typeof payload==='object'&&!Array.isArray(payload))&&typeof p.fingerprint!=='string')return undefined;
    memory.set(scope,p);
    return p;
  } catch {return undefined;}
}
export function hasPendingRegistration(scope:string,storage?:Storage){return !!read(scope,storage);}
export function pendingRegistrationDraft(scope:string,storage?:Storage){const value=read(scope,storage)?.payload;return value?structuredClone(value):null;}
export function registrationSaveText(state:RegistrationSaveState,language:string){const l=language.startsWith('zh')?0:language.startsWith('id')?2:1;return {
  failed:['未保存，已保留填写内容，请核对后重试。','Not saved. Your entries are kept; review and retry.','Belum tersimpan. Isian tetap tersedia; periksa lalu coba lagi.'],
  unknown:['保存结果尚未确认，已保留填写内容。请先核对保存结果。','The save result is unconfirmed. Your entries are kept; check the result first.','Hasil penyimpanan belum terkonfirmasi. Isian tetap tersedia; periksa hasilnya dahulu.'],
  conflict:['本次提交内容与原提交不一致，请先核对保存结果。','This submission differs from the original. Check the original result first.','Isian berbeda dari kiriman awal. Periksa hasil kiriman awal dahulu.'],
}[state][l];}
function canonical(v:any):any{return Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>[k,canonical(v[k])])):v;}
function registrationAnswersKey(payload:Record<string,any>) {
  const {submittedAt,submissionId,...answers}=payload;
  return JSON.stringify(canonical(answers));
}
async function samePendingAnswers(pending:Pending,answersKey:string) {
  if(pending.payload&&typeof pending.payload==='object'&&!Array.isArray(pending.payload))
    return registrationAnswersKey(pending.payload)===answersKey;
  // Legacy drafts may contain only a hash. Preserve their receipt even where Web Crypto cannot read it.
  if(!pending.fingerprint)return undefined;
  const fingerprint=await legacyFingerprint(answersKey);
  return fingerprint===undefined?undefined:fingerprint===pending.fingerprint;
}
async function legacyFingerprint(answersKey:string) {
  const digest=await crypto.subtle?.digest('SHA-256',new TextEncoder().encode(answersKey)).catch(()=>undefined);
  return digest && Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function saveRegistration({scope,payload,fetcher,storage,queryOnly=false,retryOriginal=false}:{scope:string;payload:Record<string,any>;fetcher:(path:string,init:RequestInit)=>Promise<Response>;storage?:Storage;queryOnly?:boolean;retryOriginal?:boolean}){
  if(!scope)throw new RegistrationSaveError('unknown');
  if(retryOriginal){const original=read(scope,storage);if(!original?.payload)throw new RegistrationSaveError('unknown');payload=original.payload;}
  const answersKey=queryOnly?undefined:registrationAnswersKey(payload);
  const active=flights.get(scope);if(active){if(!queryOnly&&active.answersKey!==answersKey)throw new RegistrationSaveError('conflict');return active.promise;}
  const work=async()=>{
    let pending=read(scope,storage);
    const clear=()=>{memory.delete(scope);try{storage?.removeItem(key(scope));}catch{}};
    const confirmed=(data:any)=>{if(data?.saved!==true||data.submissionId!==pending?.id||!data.lead?.id)throw new RegistrationSaveError('unknown');return data;};
    const query=async()=>{if(!pending)throw new RegistrationSaveError('unknown');try{const r=await fetcher('/api/portal/registrations/'+encodeURIComponent(pending.id),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(r.status===404)return null;if(!r.ok)throw new RegistrationSaveError('unknown');return confirmed(await r.json());}catch{throw new RegistrationSaveError('unknown');}};
    const recover=async()=>{
      const result=await query();
      if(!result)throw new RegistrationSaveError('unknown');
      clear();
      return result;
    };
    if(answersKey===undefined)return recover();
    if(pending){
      const result=await query();
      const sameAnswers=await samePendingAnswers(pending,answersKey);
      if(sameAnswers===undefined||(!result&&!sameAnswers))throw new RegistrationSaveError('conflict');
      if(result){
        clear();
        if(sameAnswers)return result;
        pending=undefined;
      }
    }
    if(!pending){
      // Keep the legacy hash where available so a previous build can recover this draft after rollback.
      const fingerprint=await legacyFingerprint(answersKey);
      pending={id:createBrowserUuid(),submittedAt:new Date().toISOString(),payload:JSON.parse(JSON.stringify(payload)),fingerprint};
      memory.set(scope,pending);
      try{storage?.setItem(key(scope),JSON.stringify(pending));}catch{}
    }
    let response:Response;
    try{
      response=await fetcher('/api/portal/register',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...payload,submissionId:pending.id,submittedAt:pending.submittedAt}),signal:AbortSignal.timeout(20000)});
    }catch{return recover();}
    if(!response.ok){
      if(response.status===408||response.status>=500)return recover();
      const {error:message=''}=await response.json().catch(()=>({}))??{};
      if(response.status===400||response.status===422||(response.status===409&&message==='Contact identity changed; start a separate visitor session')){
        clear();
        throw new RegistrationSaveError('failed',message);
      }
      if(response.status===409)throw new RegistrationSaveError('conflict',message);
      throw new RegistrationSaveError('unknown');
    }
    try{const data=confirmed(await response.json());clear();return data;}catch{return recover();}
  };
  const promise=work();flights.set(scope,{answersKey,promise});try{return await promise;}finally{if(flights.get(scope)?.promise===promise)flights.delete(scope);}
}
