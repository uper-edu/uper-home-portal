import type {ReactNode, Ref} from 'react';
import {Send, UserRound} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {deliveryText, type Delivery} from '../services/chatDelivery';
import {ChatEnrollmentGuide} from './ChatEnrollmentGuide';
import type {EnrollmentGuideAction} from '../utils/enrollmentGuidance';
import type {ChatOrigin,ChatSource} from '../services/portalChat';
import type {ChatMessageAnchor} from '../utils/chatJourneyNavigation';

const copy=(lang:string,zh:string,en:string,id:string)=>lang.startsWith('zh')?zh:lang.startsWith('en')?en:id;

export function ChatFollowups({prompts, onSelect}: {prompts?: string[]; onSelect: (prompt: string) => void}) {
  if (!prompts?.length) return null;
  return <div data-chat-followups className="mt-2 flex flex-wrap gap-1.5">
    {prompts.map(prompt => <button key={prompt} type="button" onClick={() => onSelect(prompt)}
      className="min-h-8 max-w-full rounded-full border border-primary-200 bg-white px-3 py-1 text-left text-xs text-primary-800 hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
      {prompt}
    </button>)}
  </div>;
}

export function ChatMessage({role,content,language,entry,origin,anchor,enrollment,delivery,compact=false,busy,onRetry,children}:{
  role:'user'|'assistant';content:string;language:string;entry:ChatSource;enrollment?:EnrollmentGuideAction;
  origin?:ChatOrigin;anchor?:ChatMessageAnchor;delivery?:Delivery;compact?:boolean;busy?:boolean;onRetry?:()=>void;children?:ReactNode;
}){
  const user=role==='user';
  const guidance=enrollment&&<ChatEnrollmentGuide action={enrollment} language={language} entry={entry} origin={origin} anchor={anchor}/>;
  if(!content&&!children&&!enrollment)return null;
  return <div data-chat-message={role} className={`flex flex-col ${user?'items-end':'items-start'}`}>
    {user&&delivery&&delivery!=='saved'&&<div role="status" className="mb-1 flex items-center gap-2 text-xs text-slate-600">
      <span>{deliveryText(delivery,language)}</span>
      {delivery!=='pending'&&onRetry&&<button type="button" className="min-h-8 rounded px-1 font-semibold text-primary-800 underline underline-offset-2 disabled:opacity-50" disabled={busy} onClick={onRetry}>
        {copy(language,'重试','Retry','Coba lagi')}
      </button>}
    </div>}
    <div className={`flex max-w-[96%] items-start gap-2 ${compact?'':'sm:max-w-[80%]'} ${user?'flex-row-reverse':''}`}>
      <div data-chat-avatar aria-hidden="true" className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border ${compact?'':'sm:size-8'} ${user?'border-primary-200 bg-primary-50 text-primary-700':'border-slate-200 bg-white'}`}>
        {user?<UserRound className="size-4"/>:<img src="/uper-logo-mark.svg" alt="" width="16" height="18" className="h-[18px] w-4 object-contain"/>}
      </div>
      <div data-chat-message-body className="grid min-w-0 justify-items-start">
        {(content||children)&&<div data-chat-bubble className={`min-w-0 max-w-full rounded-2xl px-3 py-2 text-sm leading-relaxed [overflow-wrap:anywhere] ${compact?'':'sm:px-4'} ${user?'rounded-tr-sm bg-primary-600 text-white shadow-sm':'rounded-tl-sm border border-slate-200/80 bg-white text-slate-800 shadow-sm'}`}>
          {children??(user?<span className="whitespace-pre-wrap">{content}</span>:
            <div className="prose prose-sm max-w-none text-inherit prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-a:text-primary-800 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
            </div>)}
        </div>}
        {guidance&&<div data-chat-enrollment className="w-full min-w-0">{guidance}</div>}
      </div>
    </div>
  </div>;
}

export function ChatTyping({language,label}:{language:string;label?:string}){
  return <div data-chat-typing role="status" className="flex items-center gap-2 pl-9 text-xs text-slate-600">
    <span aria-hidden="true" className="flex gap-1">
      {[0,1,2].map(dot=><span key={dot} style={{animationDelay:`${dot*150}ms`}} className="size-1.5 rounded-full bg-primary-600 motion-safe:animate-bounce"/>)}
    </span>
    {label??copy(language,'正在输入…','Typing…','Sedang mengetik…')}
  </div>;
}

export function ChatComposer({language,value,onChange,onSend,busy,inputRef,compact=false,children,placeholder}:{
  language:string;value:string;onChange:(value:string)=>void;onSend:()=>void;busy:boolean;
  inputRef?:Ref<HTMLTextAreaElement>;compact?:boolean;children?:ReactNode;placeholder?:string;
}){
  const canSend=!!value.trim()&&!busy;
  const label=placeholder??copy(language,'请输入课程、HSK或学习规划问题…','Ask about courses, HSK or study planning…','Tanyakan tentang kursus, HSK atau rencana belajar…');
  return <div data-chat-composer className={`shrink-0 border-t border-slate-200 bg-white ${compact?'p-3':'p-3 sm:p-4'}`}>
    <div className="mx-auto max-w-4xl">
      {children}
      <form className="flex items-end gap-2" onSubmit={event=>{event.preventDefault();if(canSend)onSend();}}>
        <textarea ref={inputRef} rows={1} value={value} placeholder={label} aria-label={label}
          onChange={event=>onChange(event.target.value)}
          onKeyDown={event=>{
            if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&event.nativeEvent.keyCode!==229){
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          className="max-h-24 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm leading-5 text-slate-900 focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 [field-sizing:content]"/>
        <button type="submit" disabled={!canSend} aria-label={copy(language,'发送消息','Send message','Kirim pesan')}
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 disabled:cursor-not-allowed disabled:opacity-50">
          <Send aria-hidden="true" className="size-4"/>
        </button>
      </form>
    </div>
  </div>;
}
