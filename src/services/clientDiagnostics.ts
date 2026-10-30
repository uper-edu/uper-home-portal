import {classifyClientFailure, diagnosticFrames, sanitizeClientDiagnostic, type DiagnosticSource} from '../utils/clientDiagnostics';
declare const __UPER_BUILD__: {buildId:string} | null;
const recent = new Map<string,{at:number;id:string}>();
let sent = 0;
export function reportClientFailure(error: unknown, source: DiagnosticSource, componentStack?: string) {
  if(typeof window==='undefined') return '';
  try {
  const kind=classifyClientFailure(error,source);
  const e=error as {name?:unknown;stack?:unknown}|null;
  const diagnostic=sanitizeClientDiagnostic({schema:1,id:globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16);}),kind,source,errorName:e?.name,route:location.pathname,buildId:typeof __UPER_BUILD__==='undefined'?'source':__UPER_BUILD__?.buildId,frames:[...diagnosticFrames(e?.stack).slice(0,4),...diagnosticFrames(componentStack).slice(0,4)].slice(0,8)});
  if(!diagnostic) return '';
  const key=[kind,diagnostic.route,diagnostic.frames[0]||''].join('|');
  const previous=recent.get(key);
  if(previous && Date.now()-previous.at<60000)return previous.id;
  recent.set(key,{at:Date.now(),id:diagnostic.id});
  if(recent.size>20)recent.delete(recent.keys().next().value!);
  // Structured, bounded technical data only; no raw exception message or visitor data.
  console.error('[UPER client diagnostic]',diagnostic);
  if(sent++<10)void fetch('/api/client-diagnostics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(diagnostic),keepalive:true}).catch(()=>{});
  return diagnostic.id;
  } catch { return ''; } // Diagnostic transport must never break the error screen.
}
