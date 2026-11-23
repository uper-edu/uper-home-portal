import type {EnrollmentChatSelection} from '../utils/enrollmentChatJourney';

// Browser drafts are scoped by an opaque server visitor tag, never used as identity.
export type Delivery = 'pending' | 'unsaved' | 'unknown' | 'saved' | 'failed' | 'interrupted';
export interface PendingMessage { id:string; content:string; conversationId:string; timestamp:string; delivery:Delivery; action?:'handoff'|'booking'|'enrollment'; enrollmentContext?:EnrollmentChatSelection }
let scope='';
export function setDraftScope(value:string){scope=value;}
function key(source:string){return `uper_chat_drafts:${scope}:${source}`;}
export function drafts(source:string):PendingMessage[]{
  if(!scope)return [];
  try{
    const stored=JSON.parse(localStorage.getItem(key(source))||'[]');
    return Array.isArray(stored)?stored:[];
  }catch{return [];}
}
export function draft(source:string,id:string){return drafts(source).find(m=>m.id===id);}
export function saveDraft(source:string,m:PendingMessage){return writeChatDrafts(source,[...drafts(source).filter(x=>x.id!==m.id),m]);}
export function removeDraft(source:string,id:string){try{localStorage.setItem(key(source),JSON.stringify(drafts(source).filter(x=>x.id!==id)));}catch{}}
export function writeChatDrafts(source:string,messages:Iterable<PendingMessage>) {
  if(!scope)return false;
  try{localStorage.setItem(key(source),JSON.stringify([...messages]));return true;}catch{return false;}
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
export async function readChatResponse(res:Response,onProgress:(e:any)=>void){
  if(!res.headers.get('content-type')?.includes('text/event-stream')){const data=await res.json();onProgress(data);if(data.error||data.status==='failed'||data.status==='interrupted')throw Error('Reply incomplete');return data;}
  const reader=res.body!.getReader(),decoder=new TextDecoder();let buffer='',final:any;
  const consume=(line:string)=>{if(!line.startsWith('data:'))return;const e=JSON.parse(line.slice(5).trim());onProgress(e);if(e.done)final=e;};
  try{while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,end).trim());buffer=buffer.slice(end+1);}}if(buffer.trim())consume(buffer.trim());if(!final||final.error||final.status==='failed')throw Error('Reply incomplete');return final;}finally{reader.releaseLock();}
}
