import type {EnrollmentChatSelection} from '../utils/enrollmentChatJourney';
import {chatFollowupPrompts,readChatEnrollmentGuide} from '../utils/chatReplyMetadata';
import {visitorScope} from './visitorScope';

// Browser drafts are scoped by an opaque server visitor tag, never used as identity.
export type Delivery = 'pending' | 'unsaved' | 'unknown' | 'saved' | 'failed' | 'interrupted';
export interface PendingMessage { id:string; content:string; conversationId:string; timestamp:string; delivery:Delivery; action?:'handoff'|'booking'|'enrollment'; enrollmentContext?:EnrollmentChatSelection }
const deliveryStates: readonly Delivery[] = ['pending', 'unsaved', 'unknown', 'saved', 'failed', 'interrupted'];

function isPendingMessage(value: unknown): value is PendingMessage {
  const row = value as Partial<PendingMessage> | null;
  return typeof row?.id === 'string' && !!row.id && typeof row.content === 'string' &&
    typeof row.conversationId === 'string' && typeof row.timestamp === 'string' &&
    deliveryStates.includes(row.delivery as Delivery);
}
function key(scope:string,source:string){return `uper_chat_drafts:${scope}:${source}`;}
export function chatDraftsEmpty(source:string) {
  const scope=visitorScope();
  if(!scope)return false;
  try {
    const stored=localStorage.getItem(key(scope,source));
    return stored===null || stored==='[]';
  } catch {return false;}
}
export function drafts(source:string):PendingMessage[]{
  const scope=visitorScope();
  if(!scope)return [];
  try{
    const stored=JSON.parse(localStorage.getItem(key(scope,source))||'[]');
    return Array.isArray(stored)?stored.filter(isPendingMessage):[];
  }catch{return [];}
}
export function draft(source:string,id:string){return drafts(source).find(m=>m.id===id);}
export function saveDraft(source:string,m:PendingMessage){return writeChatDrafts(source,[...drafts(source).filter(x=>x.id!==m.id),m]);}
export function removeDraft(source: string, id: string, conversationId?: string) {
  const rows = drafts(source);
  const remaining = rows.filter(row => row.id !== id || (conversationId !== undefined && row.conversationId !== conversationId));
  return remaining.length === rows.length || writeChatDrafts(source, remaining);
}

export function updateDraftDelivery(source: string, message: Pick<PendingMessage, 'id' | 'conversationId'>, delivery: Delivery, expected?: Delivery) {
  const rows = drafts(source);
  const index = rows.findIndex(row => row.id === message.id && row.conversationId === message.conversationId);
  if (index < 0 || (expected !== undefined && rows[index].delivery !== expected)) return false;
  if (rows[index].delivery === delivery) return true;
  rows[index] = { ...rows[index], delivery };
  return writeChatDrafts(source, rows);
}
export function writeChatDrafts(source:string,messages:Iterable<PendingMessage>) {
  const scope=visitorScope();
  if(!scope)return false;
  try{localStorage.setItem(key(scope,source),JSON.stringify([...messages]));return true;}catch{return false;}
}
export function deliveryText(status:Delivery,lang:string){
 const zh=lang.startsWith('zh'),en=lang.startsWith('en');
 if(status==='saved')return zh?'已保存':en?'Saved':'Tersimpan';
 if(status==='unsaved')return zh?'消息未保存':en?'Message not saved':'Pesan belum tersimpan';
 if(status==='pending')return zh?'正在保存…':en?'Saving…':'Menyimpan…';
 if(status==='failed')return zh?'消息已保存，回复失败':en?'Message saved · Reply failed':'Pesan tersimpan · Balasan gagal';
 if(status==='interrupted')return zh?'消息已保存，回复中断':en?'Message saved · Reply interrupted':'Pesan tersimpan · Balasan terputus';
 return zh?'尚未确认保存':en?'Save not confirmed':'Penyimpanan belum dikonfirmasi';
}
// Match the gateway's read-idle window without imposing a total model runtime.
function createChatReadDeadline(onTimeout?:()=>void, reconnectBy?:number) {
  const browser=typeof window!=='undefined'&&typeof window.addEventListener==='function'&&
    typeof window.removeEventListener==='function'?window:undefined;
  const controller=new AbortController();
  let wasOffline=browser?.navigator?.onLine===false;
  let reconnectTimer:ReturnType<typeof setTimeout>|undefined;
  const expire=()=>{
    if(controller.signal.aborted)return;
    controller.abort(new DOMException('Chat response timed out','TimeoutError'));
    onTimeout?.();
  };
  const progress=()=>{
    clearTimeout(reconnectTimer);
    reconnectBy=undefined;
  };
  const offline=()=>{
    wasOffline=true;
    progress();
  };
  const online=()=>{
    if(!wasOffline)return;
    wasOffline=false;
    // Give the old stream a chance to recover before restoring saved history.
    reconnectBy=Date.now()+2000;
    reconnectTimer=setTimeout(expire,2000);
  };
  browser?.addEventListener('offline',offline);
  browser?.addEventListener('online',online);
  if(wasOffline)reconnectBy=undefined;
  if(reconnectBy!==undefined){
    const remaining=reconnectBy-Date.now();
    if(remaining<=0)expire();
    else reconnectTimer=setTimeout(expire,remaining);
  }
  return {
    progress,
    reconnectDeadline:()=>reconnectBy,
    async wait<T>(result:Promise<T>):Promise<T> {
      const signal=controller.signal;
      let abort=()=>{};
      const deadline=new Promise<never>((_,reject)=>{
        abort=()=>reject(signal.reason);
        if(signal.aborted)abort();
        else signal.addEventListener('abort',abort,{once:true});
      });
      const timer=setTimeout(expire,180_000);
      try { return await Promise.race([deadline,result]); }
      finally { clearTimeout(timer);signal.removeEventListener('abort',abort); }
    },
    stop(){
      progress();
      browser?.removeEventListener('offline',offline);
      browser?.removeEventListener('online',online);
    },
  };
}

const responseReconnectDeadlines = new WeakMap<Response,number>();

export async function waitForChatResponse(result:Promise<Response>,onTimeout?:()=>void):Promise<Response>{
  const deadline=createChatReadDeadline(onTimeout);
  try {
    const response=await deadline.wait(result);
    const reconnectBy=deadline.reconnectDeadline();
    if(reconnectBy!==undefined)responseReconnectDeadlines.set(response,reconnectBy);
    return response;
  }
  finally { deadline.stop(); }
}

function responseReadDeadline(res:Response) {
  const reconnectBy=responseReconnectDeadlines.get(res);
  responseReconnectDeadlines.delete(res);
  return createChatReadDeadline(undefined,reconnectBy);
}

async function* chatResponseChunks(res:Response,deadline=responseReadDeadline(res)){
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  let ended=false;
  try{
    reader=res.body?.getReader();
    if(!reader)return;
    while(true){
      const {done,value}=await deadline.wait(reader.read());
      if(done){ended=true;return;}
      yield value;
    }
  }finally{
    deadline.stop();
    if(reader&&!ended)void reader.cancel().catch(()=>{});
    reader?.releaseLock();
  }
}
export async function readChatJson(res:Response){
  const decoder=new TextDecoder();
  let text='';
  for await(const chunk of chatResponseChunks(res))text+=decoder.decode(chunk,{stream:true});
  return JSON.parse(text+decoder.decode());
}

function completeChatReply(data: any) {
  if (data?.saved !== true || typeof data.reply !== 'string' || data.error ||
    (data.status !== undefined && !['completed','awaiting_advisor','contact_required'].includes(data.status))) {
    throw Error('Reply incomplete');
  }
  return {
    ...data,
    ...(data.enrollment!==undefined&&{enrollment:readChatEnrollmentGuide(data.enrollment)}),
    ...(data.suggestedPrompts!==undefined&&{suggestedPrompts:chatFollowupPrompts(data.suggestedPrompts)}),
  };
}

function readChatFrame(data: any) {
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
    (data.reply !== undefined && typeof data.reply !== 'string') ||
    (data.chunk !== undefined && typeof data.chunk !== 'string') ||
    (data.reset !== undefined && typeof data.reset !== 'boolean') ||
    (data.done !== undefined && typeof data.done !== 'boolean') ||
    (data.saved !== undefined && typeof data.saved !== 'boolean')) {
    throw Error('Reply incomplete');
  }
  return data;
}

export async function readChatResponse(res:Response,onProgress:(e:any)=>void){
  if(!res.headers.get('content-type')?.includes('text/event-stream')){
    const data=readChatFrame(await readChatJson(res));
    onProgress(data);
    return completeChatReply(data);
  }
  const deadline=responseReadDeadline(res);
  const decoder=new TextDecoder();let buffer='',final:any;
  const consume=(line:string)=>{
    if(!line.startsWith('data:'))return;
    const e=readChatFrame(JSON.parse(line.slice(5).trim()));
    // An incomplete network chunk cannot prove the stream resumed.
    deadline.progress();
    onProgress(e);
    if(e.done===true)final=e;
  };
  for await(const chunk of chatResponseChunks(res,deadline)){
    buffer+=decoder.decode(chunk,{stream:true});
    let end:number;
    while(!final&&(end=buffer.indexOf('\n'))>=0){
      consume(buffer.slice(0,end).trim());
      buffer=buffer.slice(end+1);
    }
    if(final)break;
  }
  if(!final){buffer+=decoder.decode();if(buffer.trim())consume(buffer.trim());}
  return completeChatReply(final);
}
