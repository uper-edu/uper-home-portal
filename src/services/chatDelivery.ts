// Browser drafts are scoped by an opaque server visitor tag, never used as identity.
export type Delivery = 'pending' | 'unsaved' | 'unknown' | 'saved' | 'failed' | 'interrupted';
export interface PendingMessage { id:string; content:string; conversationId:string; timestamp:string; delivery:Delivery }
let scope='';
export function setDraftScope(value:string){scope=value;}
function key(source:string){return `uper_chat_drafts:${scope}:${source}`;}
export function drafts(source:string):PendingMessage[]{try{return scope?JSON.parse(localStorage.getItem(key(source))||'[]'):[];}catch{return [];}}
export function draft(source:string,id:string){return drafts(source).find(m=>m.id===id);}
export function saveDraft(source:string,m:PendingMessage){if(!scope)return;try{localStorage.setItem(key(source),JSON.stringify([...drafts(source).filter(x=>x.id!==m.id),m]));}catch{}}
export function removeDraft(source:string,id:string){try{localStorage.setItem(key(source),JSON.stringify(drafts(source).filter(x=>x.id!==id)));}catch{}}
export function deliveryText(status:Delivery,lang:string){
 const zh=lang.startsWith('zh'),en=lang.startsWith('en');
 if(status==='saved')return zh?'已保存':en?'Saved':'Tersimpan';
 if(status==='unsaved')return zh?'未保存，可重试':en?'Not saved · Retry available':'Belum tersimpan · Coba lagi';
 if(status==='pending')return zh?'正在保存…':en?'Saving…':'Menyimpan…';
 if(status==='failed'||status==='interrupted')return zh?'消息已保存，回复失败或中断，可重试':en?'Message saved · Reply failed or interrupted · Retry available':'Pesan tersimpan · Balasan gagal atau terputus · Coba lagi';
 return zh?'尚未确认保存，请重试确认':en?'Save not confirmed · Retry to confirm':'Penyimpanan belum dikonfirmasi · Coba lagi';
}
export async function readChatResponse(res:Response,onProgress:(e:any)=>void){
  if(!res.headers.get('content-type')?.includes('text/event-stream')){const data=await res.json();onProgress(data);if(data.error||data.status==='failed'||data.status==='interrupted')throw Error('Reply incomplete');return data;}
  const reader=res.body!.getReader(),decoder=new TextDecoder();let buffer='',final:any;
  const consume=(line:string)=>{if(!line.startsWith('data:'))return;const e=JSON.parse(line.slice(5).trim());onProgress(e);if(e.done)final=e;};
  try{while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,end).trim());buffer=buffer.slice(end+1);}}if(buffer.trim())consume(buffer.trim());if(!final||final.error||final.status==='failed')throw Error('Reply incomplete');return final;}finally{reader.releaseLock();}
}
